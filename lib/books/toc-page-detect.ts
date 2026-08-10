/**
 * Phase 1a — score early PDF pages for “table of contents / scope” likeness
 * and propose an inclusive PDF page range for the structure wizard.
 */

export const TOC_DETECT_DEFAULT_MAX_SCAN = 20
/** Stop scanning after this many low-scoring pages past a found TOC block. */
export const TOC_DETECT_EARLY_STOP_LOW_PAGES = 1
export const TOC_DETECT_MIN_PAGE_SCORE = 22

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

  if (/\bscope and sequence\b/i.test(text)) {
    score += 40
    reasons.push('scope_and_sequence')
  }

  if (/\bacademic skills\b/i.test(text)) {
    score += 22
    reasons.push('academic_skills')
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
  if (avgLineLen > 72 && unitHits < 2 && !/\bcontents\b/i.test(text) && !/\bscope and sequence\b/i.test(text)) {
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
    s.reasons.some((r) =>
      r === 'contents' ||
      r === 'table_of_contents' ||
      r === 'scope_and_sequence',
    ),
  )
  if (peak >= 55 && hasStrongCue) return 'high'
  if (peak >= 35 || hasStrongCue) return 'medium'
  return 'low'
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
  },
): TocRangeProposal | null {
  const maxScan = options?.maxScanPages ?? TOC_DETECT_DEFAULT_MAX_SCAN
  const minScore = options?.minScore ?? TOC_DETECT_MIN_PAGE_SCORE

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
      (run.sum === best.sum && run.peak === best.peak && run.endIdx - run.startIdx > best.endIdx - best.startIdx)
    ) {
      best = run
    }
    i = j
  }

  if (!best) return null

  const runScores = scores.slice(best.startIdx, best.endIdx + 1)
  return {
    from: scores[best.startIdx]!.pdfPage,
    to: scores[best.endIdx]!.pdfPage,
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
}): boolean {
  const minScore = input.minScore ?? TOC_DETECT_MIN_PAGE_SCORE
  const lowNeeded = input.lowPagesAfterToc ?? TOC_DETECT_EARLY_STOP_LOW_PAGES
  if (input.tocStartPage == null || input.tocEndPage == null) return false
  if (input.pdfPage <= input.tocEndPage) return false
  if (input.pageScore >= minScore) return false
  const gap = input.pdfPage - input.tocEndPage
  return gap >= lowNeeded
}
