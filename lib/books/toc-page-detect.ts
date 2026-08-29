/**
 * Phase 1a/1b — score early PDF pages for contents / scope likeness
 * and propose an inclusive PDF page range for the structure wizard.
 *
 * 1b: Contents + Scope/Academic Skills packs, softer early-stop, A:/B: tables.
 */

export const TOC_DETECT_DEFAULT_MAX_SCAN = 20
/** Stop scanning after this many low-scoring pages past a found TOC block. */
export const TOC_DETECT_EARLY_STOP_LOW_PAGES = 2
export const TOC_DETECT_MIN_PAGE_SCORE = 22
/** Soft floor for companion front-matter pages (Scope / skills grids). */
export const TOC_DETECT_COMPANION_MIN_SCORE = 14
/** After a Contents hit, peek this many following PDF pages for Scope/skills. */
export const TOC_DETECT_FRONT_MATTER_LOOKAHEAD = 3

export type TocPageScore = {
  pdfPage: number
  score: number
  reasons: string[]
  textLength: number
}

export type TocRangeProposal = {
  from: number
  to: number
  confidence: 'high' | 'medium' | 'low'
  scores: TocPageScore[]
  scannedThroughPage: number
  earlyStopped: boolean
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function countMatches(text: string, re: RegExp): number {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  const copy = new RegExp(re.source, flags)
  return [...text.matchAll(copy)].length
}

function hasScopeAndSequenceCue(text: string): boolean {
  if (/\bscope\s+and\s+sequence\b/i.test(text)) return true
  // Split title lines: "SCOPE AND" … "SEQUENCE"
  return /\bscope\s+and\b/i.test(text) && /\bsequence\b/i.test(text)
}

/**
 * Explorer-style Scope / Academic Skills grids (may lack classic page-number TOC lines).
 */
export function isFrontMatterCompanionPage(rawText: string): boolean {
  const text = normalizeText(rawText)
  if (text.length < 8) return false

  if (hasScopeAndSequenceCue(text)) return true
  if (/\bacademic\s+skills\b/i.test(text)) return true
  if (/\breading\s+skill\b/i.test(text) && /\bvocabulary\s+building\b/i.test(text)) return true
  if (/\bunit\b/i.test(text) && /\btheme\b/i.test(text) && /\breading\b/i.test(text)) return true

  const abColon = countMatches(text, /\b[AB]\s*:\s*\S/g)
  if (abColon >= 6) return true

  const { score } = scoreTocCandidatePage(rawText)
  return (
    score >= TOC_DETECT_COMPANION_MIN_SCORE &&
    (abColon >= 4 || /\bvideo\b/i.test(text) || /\btheme\b/i.test(text))
  )
}

/** Body / intro prose — do not pull into the TOC pack via look-ahead. */
export function isLikelyBodyAfterToc(rawText: string): boolean {
  const text = normalizeText(rawText)
  if (text.length < 40) return false
  if (isFrontMatterCompanionPage(rawText)) return false
  const { score, reasons } = scoreTocCandidatePage(rawText)
  if (score >= TOC_DETECT_MIN_PAGE_SCORE) return false
  if (reasons.includes('long_prose_penalty')) return true
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const avgLineLen =
    lines.length > 0 ? lines.reduce((sum, line) => sum + line.length, 0) / lines.length : 0
  const unitHits = countMatches(text, /\bunit\s*\d+/gi)
  return avgLineLen > 60 && unitHits < 2 && !hasScopeAndSequenceCue(text) && !/\bcontents\b/i.test(text)
}

/**
 * Heuristic score for one page’s plain text (pdf.js selectable text).
 * Image-only scans score near 0 — caller should fall back to manual range.
 */
export function scoreTocCandidatePage(rawText: string): { score: number; reasons: string[] } {
  const text = normalizeText(rawText)
  if (text.length < 12) {
    return { score: 0, reasons: ['too_little_text'] }
  }

  const lower = text.toLowerCase()
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let score = 0
  const reasons: string[] = []

  if (/\btable of contents\b/i.test(text)) {
    score += 45
    reasons.push('table_of_contents')
  } else if (/\bcontents\b/i.test(text) && !/\bcontents of\b/i.test(lower)) {
    score += 38
    reasons.push('contents')
  }

  if (hasScopeAndSequenceCue(text)) {
    score += 40
    reasons.push('scope_and_sequence')
  }

  if (/\bacademic\s+skills\b/i.test(text)) {
    score += 28
    reasons.push('academic_skills')
  }

  if (/\breading\s+skill\b/i.test(text) && /\bvocabulary\s+building\b/i.test(text)) {
    score += 18
    reasons.push('skills_grid_headers')
  }

  if (/\bcritical\s+thinking\b/i.test(text) && /\b(reading\s+skill|vocabulary)\b/i.test(text)) {
    score += 10
    reasons.push('critical_thinking_grid')
  }

  if (/\bunit\b/i.test(text) && /\btheme\b/i.test(text) && /\breading\b/i.test(text)) {
    score += 16
    reasons.push('scope_table_headers')
  }

  const unitHits = countMatches(text, /\bunit\s*\d+/gi)
  if (unitHits >= 2) {
    const add = Math.min(32, unitHits * 4)
    score += add
    reasons.push(`units_${unitHits}`)
  } else if (unitHits === 1 && /\b(contents|scope)\b/i.test(text)) {
    score += 8
    reasons.push('unit_once_with_front_matter')
  }

  const lessonHits = countMatches(text, /\blesson\s*\d+/gi)
  if (lessonHits >= 2) {
    score += Math.min(18, lessonHits * 3)
    reasons.push(`lessons_${lessonHits}`)
  }

  const readingAb = countMatches(text, /\breading\s*[ab]\b/gi)
  if (readingAb >= 2) {
    score += Math.min(20, readingAb * 3)
    reasons.push(`reading_ab_${readingAb}`)
  }

  // Reading Explorer Scope rows: "A: Title" / "B: Title"
  const abColon = countMatches(text, /\b[AB]\s*:\s*\S/g)
  if (abColon >= 4) {
    score += Math.min(24, abColon * 2)
    reasons.push(`ab_colon_${abColon}`)
  }

  const pageNumLines = lines.filter((line) => /\d{1,3}\s*$/.test(line) && /[A-Za-z]/.test(line)).length
  if (pageNumLines >= 4) {
    score += Math.min(28, pageNumLines * 2)
    reasons.push(`page_number_lines_${pageNumLines}`)
  }

  const dotted = lines.filter((line) => /\.{3,}|…/.test(line)).length
  if (dotted >= 3) {
    score += Math.min(16, dotted * 2)
    reasons.push(`dotted_leaders_${dotted}`)
  }

  // Long prose without TOC cues → likely story / intro body.
  const avgLineLen =
    lines.length > 0 ? lines.reduce((sum, line) => sum + line.length, 0) / lines.length : 0
  if (
    avgLineLen > 72 &&
    unitHits < 2 &&
    !/\bcontents\b/i.test(text) &&
    !hasScopeAndSequenceCue(text) &&
    !/\bacademic\s+skills\b/i.test(text)
  ) {
    score -= 18
    reasons.push('long_prose_penalty')
  }

  return { score: Math.max(0, score), reasons }
}

export function scoreTocPages(
  pages: Array<{ pdfPage: number; text: string }>,
): TocPageScore[] {
  return pages.map(({ pdfPage, text }) => {
    const { score, reasons } = scoreTocCandidatePage(text)
    return {
      pdfPage,
      score,
      reasons,
      textLength: normalizeText(text).length,
    }
  })
}

function confidenceForRun(runScores: TocPageScore[], peak: number): 'high' | 'medium' | 'low' {
  const hasStrongCue = runScores.some((s) =>
    s.reasons.some(
      (r) =>
        r === 'contents' ||
        r === 'table_of_contents' ||
        r === 'scope_and_sequence' ||
        r === 'academic_skills',
    ),
  )
  if (peak >= 55 && hasStrongCue) return 'high'
  if (peak >= 35 || hasStrongCue) return 'medium'
  return 'low'
}

function runHasContentsCue(runScores: TocPageScore[]): boolean {
  return runScores.some((s) =>
    s.reasons.some((r) => r === 'contents' || r === 'table_of_contents'),
  )
}

/**
 * After a Contents page, pull in Scope / Academic Skills (and weak text pages
 * that are not clearly body), up to LOOKAHEAD pages.
 */
export function extendRangeWithFrontMatterPack(
  pages: Array<{ pdfPage: number; text: string }>,
  scores: TocPageScore[],
  endIdx: number,
  options?: { lookahead?: number; minScore?: number },
): number {
  const lookahead = options?.lookahead ?? TOC_DETECT_FRONT_MATTER_LOOKAHEAD
  const minScore = options?.minScore ?? TOC_DETECT_MIN_PAGE_SCORE
  let toIdx = endIdx

  for (let k = 1; k <= lookahead; k++) {
    const idx = endIdx + k
    if (idx >= scores.length || idx >= pages.length) break
    const text = pages[idx]!.text
    const pageScore = scores[idx]!.score

    if (isLikelyBodyAfterToc(text)) break

    if (
      pageScore >= minScore ||
      pageScore >= TOC_DETECT_COMPANION_MIN_SCORE ||
      isFrontMatterCompanionPage(text) ||
      normalizeText(text).length < 40
    ) {
      // Include companions, soft-scoring grids, or nearly empty pages (image-heavy Scope).
      toIdx = idx
      continue
    }

    // Bridge one soft miss if the following page is clearly front matter.
    const nextIdx = idx + 1
    if (
      nextIdx < scores.length &&
      nextIdx <= endIdx + lookahead &&
      (isFrontMatterCompanionPage(pages[nextIdx]!.text) ||
        scores[nextIdx]!.score >= TOC_DETECT_COMPANION_MIN_SCORE)
    ) {
      toIdx = nextIdx
      break
    }
    break
  }

  return toIdx
}

/**
 * Pick the best contiguous high-scoring run in early pages.
 * Returns null when nothing clears the minimum score.
 */
export function proposeTocPdfRange(
  pages: Array<{ pdfPage: number; text: string }>,
  options?: {
    maxScanPages?: number
    minScore?: number
    frontMatterLookahead?: number
  },
): TocRangeProposal | null {
  const maxScan = options?.maxScanPages ?? TOC_DETECT_DEFAULT_MAX_SCAN
  const minScore = options?.minScore ?? TOC_DETECT_MIN_PAGE_SCORE
  const lookahead = options?.frontMatterLookahead ?? TOC_DETECT_FRONT_MATTER_LOOKAHEAD

  const limited = [...pages]
    .filter((p) => Number.isFinite(p.pdfPage) && p.pdfPage >= 1)
    .sort((a, b) => a.pdfPage - b.pdfPage)
    .filter((p) => p.pdfPage <= maxScan)

  if (limited.length === 0) return null

  const scores = scoreTocPages(limited)
  const scannedThroughPage = scores[scores.length - 1]?.pdfPage ?? limited[limited.length - 1]!.pdfPage

  type Run = { startIdx: number; endIdx: number; sum: number; peak: number }
  let best: Run | null = null
  let i = 0
  while (i < scores.length) {
    if (scores[i]!.score < minScore) {
      i += 1
      continue
    }
    let j = i
    let sum = 0
    let peak = 0
    while (j < scores.length && scores[j]!.score >= minScore) {
      sum += scores[j]!.score
      peak = Math.max(peak, scores[j]!.score)
      j += 1
    }
    const run: Run = { startIdx: i, endIdx: j - 1, sum, peak }
    if (
      !best ||
      run.sum > best.sum ||
      (run.sum === best.sum && run.peak > best.peak) ||
      (run.sum === best.sum &&
        run.peak === best.peak &&
        run.endIdx - run.startIdx > best.endIdx - best.startIdx)
    ) {
      best = run
    }
    i = j
  }

  if (!best) return null

  let endIdx = best.endIdx
  const runScoresInitial = scores.slice(best.startIdx, best.endIdx + 1)
  if (runHasContentsCue(runScoresInitial)) {
    endIdx = extendRangeWithFrontMatterPack(limited, scores, best.endIdx, {
      lookahead,
      minScore,
    })
  }

  const runScores = scores.slice(best.startIdx, endIdx + 1)
  return {
    from: scores[best.startIdx]!.pdfPage,
    to: scores[endIdx]!.pdfPage,
    confidence: confidenceForRun(runScores, best.peak),
    scores,
    scannedThroughPage,
    earlyStopped: false,
  }
}

/**
 * Decide whether to stop scanning after scoring `pageScore` at `pdfPage`,
 * given a TOC run already started at `tocStartPage` and last high page `tocEndPage`.
 */
export function shouldEarlyStopTocScan(input: {
  pdfPage: number
  pageScore: number
  tocStartPage: number | null
  tocEndPage: number | null
  minScore?: number
  lowPagesAfterToc?: number
  /** When true, require peeking further after Contents before stopping. */
  forcePeekAfterContents?: boolean
  contentsEndedAtPage?: number | null
}): boolean {
  const minScore = input.minScore ?? TOC_DETECT_MIN_PAGE_SCORE
  const lowNeeded = input.lowPagesAfterToc ?? TOC_DETECT_EARLY_STOP_LOW_PAGES
  if (input.tocStartPage == null || input.tocEndPage == null) return false
  if (input.pdfPage <= input.tocEndPage) return false
  if (input.pageScore >= minScore) return false

  // Always read at least Contents + LOOKAHEAD pages before early-stop.
  if (
    input.forcePeekAfterContents &&
    input.contentsEndedAtPage != null &&
    input.pdfPage <= input.contentsEndedAtPage + TOC_DETECT_FRONT_MATTER_LOOKAHEAD
  ) {
    return false
  }

  const gap = input.pdfPage - input.tocEndPage
  return gap >= lowNeeded
}
