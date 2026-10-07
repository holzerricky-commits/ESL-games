/** Stable page tags embedded in scanned story text for evidence → page resolve. */

export const READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER =
  '[illustration only — no story text]'

export const READING_STORY_PAGE_MARKER_RE =
  /<<<page\s+display="(\d+|·)"\s+pdf="(\d+)">>>/g

export type ReadingStoryPageSection = {
  displayPage: number | null
  pdfPage: number
  text: string
}

export type ReadingStoryPageRangeHint = {
  startPdfPage: number
  startDisplayPage: number | null
  endDisplayPage: number | null
}

export function formatReadingStoryPageMarker(args: {
  displayPage: number | null
  pdfPage: number
}): string {
  const pdf = Math.max(1, Math.floor(args.pdfPage))
  const display =
    args.displayPage != null && Number.isFinite(args.displayPage) && args.displayPage >= 1
      ? String(Math.floor(args.displayPage))
      : '·'
  return `<<<page display="${display}" pdf="${pdf}">>>`
}

export function displayPageForPdfInStoryRange(
  pdfPage: number,
  range: {
    startPdfPage: number
    startDisplayPage: number | null
    endDisplayPage: number | null
  },
): number | null {
  if (
    typeof range.startDisplayPage === 'number' &&
    range.startDisplayPage >= 1 &&
    range.startPdfPage >= 1
  ) {
    const display = range.startDisplayPage + (pdfPage - range.startPdfPage)
    return display >= 1 ? display : null
  }
  return null
}

/** Legacy Gemini / PDF headings: `--- Page N ---` or `--- Pages A–B ---` (pdf indices). */
const LEGACY_PAGE_HEADING_RE =
  /---\s*Pages?\s+(\d+)(?:\s*[–—-]\s*(\d+))?\s*---/gi

const NUMERIC_STORY_PAGE_MARKER_RE =
  /<<<page\s+display="(\d+)"\s+pdf="(\d+)">>>/i

function inferStoryPageRangeFromMarkers(text: string): ReadingStoryPageRangeHint | null {
  const match = text.match(NUMERIC_STORY_PAGE_MARKER_RE)
  if (!match) return null
  const displayPage = Math.floor(Number(match[1]))
  const pdfPage = Math.floor(Number(match[2]))
  if (!Number.isFinite(displayPage) || !Number.isFinite(pdfPage) || displayPage < 1 || pdfPage < 1) {
    return null
  }
  return {
    startPdfPage: pdfPage,
    startDisplayPage: displayPage,
    endDisplayPage: null,
  }
}

export function resolveReadingStoryPageRangeHint(
  text: string,
  range?: ReadingStoryPageRangeHint | null,
): ReadingStoryPageRangeHint {
  if (
    range &&
    typeof range.startDisplayPage === 'number' &&
    range.startDisplayPage >= 1 &&
    range.startPdfPage >= 1
  ) {
    return range
  }
  const inferred = inferStoryPageRangeFromMarkers(text)
  if (inferred) {
    return {
      ...inferred,
      endDisplayPage: range?.endDisplayPage ?? null,
    }
  }
  return range ?? { startPdfPage: 1, startDisplayPage: null, endDisplayPage: null }
}

function markerForPdfPage(pdfPage: number, range: ReadingStoryPageRangeHint): string {
  return formatReadingStoryPageMarker({
    displayPage: displayPageForPdfInStoryRange(pdfPage, range),
    pdfPage,
  })
}

/** Drop back-to-back markers for the same PDF page (heading + Gemini illustration tag). */
export function collapseAdjacentDuplicatePdfMarkers(text: string): string {
  return text.replace(
    /(<<<page\s+display="(?:\d+|·)"\s+pdf="(\d+)">>>)(?:\s*<<<page\s+display="(?:\d+|·)"\s+pdf="\2">>>)+/gi,
    '$1',
  )
}

/**
 * Convert leftover `--- Page N ---` / `--- Pages A–B ---` headings to `<<<page>>>`
 * markers. Range headings become the first PDF page (A). Display offset comes from
 * `range` when present, otherwise from the first numeric marker already in the text.
 */
export function normalizeStoryTextPageMarkers(
  rawText: string,
  range?: ReadingStoryPageRangeHint | null,
): string {
  const text = typeof rawText === 'string' ? rawText : ''
  if (!text.trim()) return text

  const resolved = resolveReadingStoryPageRangeHint(text, range)
  const headingRe = new RegExp(LEGACY_PAGE_HEADING_RE.source, 'gi')
  const converted = text.replace(headingRe, (full, startRaw: string) => {
    const start = Math.floor(Number(startRaw))
    if (!Number.isFinite(start) || start < 1) return full
    return markerForPdfPage(start, resolved)
  })
  return collapseAdjacentDuplicatePdfMarkers(converted)
}

/** True when a page section has no story prose (illustration-only placeholder). */
export function isIllustrationOnlySectionText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed === READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER) return true
  const withoutPlaceholder = trimmed
    .replace(new RegExp(`^${READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '')
    .trim()
  return withoutPlaceholder.length === 0
}

/**
 * Build tagged placeholder text for PDF pages with no extractable story prose.
 * One marker per PDF page in [chunkStart..chunkEnd].
 */
export function buildPlaceholderChunkForPdfPages(
  chunkStartPdfPage: number,
  chunkEndPdfPage: number,
  range: {
    startPdfPage: number
    startDisplayPage: number | null
    endDisplayPage: number | null
  },
): string {
  const start = Math.max(1, Math.floor(chunkStartPdfPage))
  const end = Math.max(start, Math.floor(chunkEndPdfPage))
  const parts: string[] = []
  for (let pdfPage = start; pdfPage <= end; pdfPage += 1) {
    const displayPage = displayPageForPdfInStoryRange(pdfPage, range)
    parts.push(
      `${formatReadingStoryPageMarker({ displayPage, pdfPage })}\n${READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER}`,
    )
  }
  return parts.join('\n\n')
}

/**
 * Convert `--- Page N ---` / `--- Pages A–B ---` and ensure this chunk starts on
 * its first PDF page so prose is not glued to the previous spread.
 */
export function tagScannedChunkText(
  rawText: string,
  args: {
    chunkStartPdfPage: number
    chunkEndPdfPage: number
    range: {
      startPdfPage: number
      startDisplayPage: number | null
      endDisplayPage: number | null
    }
  },
): string {
  const trimmed = rawText.trim()
  if (!trimmed) return ''

  const chunkStart = Math.max(1, Math.floor(args.chunkStartPdfPage))
  const chunkEnd = Math.max(chunkStart, Math.floor(args.chunkEndPdfPage))
  const range = resolveReadingStoryPageRangeHint(trimmed, args.range)
  let text = normalizeStoryTextPageMarkers(trimmed, range)

  const startMarker = markerForPdfPage(chunkStart, range)
  const startsOnChunk = new RegExp(
    `^<<<page\\s+display="(?:\\d+|·)"\\s+pdf="${chunkStart}">>>`,
    'i',
  )
  if (!startsOnChunk.test(text)) {
    text = `${startMarker}\n${text}`
  }

  const present = new Set(
    [...text.matchAll(/<<<page\s+display="(?:\d+|·)"\s+pdf="(\d+)">>>/gi)].map((m) =>
      Math.floor(Number(m[1])),
    ),
  )
  const missing: string[] = []
  for (let pdfPage = chunkStart; pdfPage <= chunkEnd; pdfPage += 1) {
    if (!present.has(pdfPage)) missing.push(markerForPdfPage(pdfPage, range))
  }
  if (missing.length > 0) text = `${text.trim()}\n${missing.join('\n')}`
  return collapseAdjacentDuplicatePdfMarkers(text).trim()
}

/** Split story text into page sections using markers (skips unmarked leading preamble). */
export function parseReadingStoryPageSections(storyText: string): ReadingStoryPageSection[] {
  const raw = typeof storyText === 'string' ? storyText : ''
  if (!raw.trim()) return []
  const text = normalizeStoryTextPageMarkers(raw)

  const re = new RegExp(READING_STORY_PAGE_MARKER_RE.source, 'g')
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return []

  const sections: ReadingStoryPageSection[] = []
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]!
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length
    const displayRaw = match[1]!
    const pdfRaw = match[2]!
    const pdfPage = Math.floor(Number(pdfRaw))
    if (!Number.isFinite(pdfPage) || pdfPage < 1) continue
    const displayPage =
      displayRaw !== '·' && /^\d+$/.test(displayRaw) ? Math.floor(Number(displayRaw)) : null
    sections.push({
      displayPage: displayPage != null && displayPage >= 1 ? displayPage : null,
      pdfPage,
      text: text.slice(start, end).trim(),
    })
  }
  return sections
}

/**
 * PDF pages already present in saved story text (markers + legacy page headings).
 * Used to resume an interrupted chunked scan without redoing finished pages.
 */
export function coveredPdfPagesFromStoryText(storyText: string): Set<number> {
  const covered = new Set<number>()
  const text = typeof storyText === 'string' ? storyText : ''
  if (!text.trim()) return covered

  for (const section of parseReadingStoryPageSections(text)) {
    covered.add(section.pdfPage)
  }

  const headingRe = new RegExp(LEGACY_PAGE_HEADING_RE.source, 'gi')
  for (const match of text.matchAll(headingRe)) {
    const start = Math.floor(Number(match[1]))
    const endRaw = match[2] != null ? Math.floor(Number(match[2])) : start
    if (!Number.isFinite(start) || start < 1) continue
    const end = Number.isFinite(endRaw) && endRaw >= start ? endRaw : start
    for (let p = start; p <= end; p += 1) covered.add(p)
  }

  return covered
}

/** Plan pdf pages that are not yet covered by saved story text. */
export function remainingScanPdfPages(
  planPdfPages: number[],
  covered: Set<number>,
): number[] {
  return planPdfPages.filter((p) => Number.isFinite(p) && p >= 1 && !covered.has(p))
}

/**
 * True when text has some scanned page coverage but is missing pages in [startPdf..endPdf].
 * Paste-only text (no markers/headings) returns false.
 */
export function storyTextScanCanContinue(args: {
  text: string
  startPdfPage: number | null | undefined
  endPdfPage: number | null | undefined
}): boolean {
  const start = typeof args.startPdfPage === 'number' ? Math.floor(args.startPdfPage) : NaN
  const end = typeof args.endPdfPage === 'number' ? Math.floor(args.endPdfPage) : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
    return false
  }
  const covered = coveredPdfPagesFromStoryText(args.text)
  if (covered.size === 0) return false
  for (let p = start; p <= end; p += 1) {
    if (!covered.has(p)) return true
  }
  return false
}

export type EvidencePageHit = {
  displayPage: number | null
  pdfPage: number
}

/**
 * Find which tagged page contains the evidence (unique hit preferred).
 * Tries evidenceSnippet first, then evidenceHighlight.
 */
function collapseEvidenceWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function resolvePageFromStoryEvidence(
  storyText: string,
  evidenceSnippet: string | null | undefined,
  evidenceHighlight?: string | null | undefined,
): EvidencePageHit | null {
  const sections = parseReadingStoryPageSections(storyText)
  if (sections.length === 0) return null

  const candidates = [evidenceSnippet, evidenceHighlight]
    .map((s) => (typeof s === 'string' ? collapseEvidenceWhitespace(s) : ''))
    .filter((s) => s.length >= 8)

  for (const needle of candidates) {
    const hits = sections.filter((sec) => collapseEvidenceWhitespace(sec.text).includes(needle))
    if (hits.length === 1) {
      return { displayPage: hits[0]!.displayPage, pdfPage: hits[0]!.pdfPage }
    }
    if (hits.length === 0) {
      const lowerNeedle = needle.toLowerCase()
      const soft = sections.filter((sec) =>
        collapseEvidenceWhitespace(sec.text).toLowerCase().includes(lowerNeedle),
      )
      if (soft.length === 1) {
        return { displayPage: soft[0]!.displayPage, pdfPage: soft[0]!.pdfPage }
      }
    }
  }
  return null
}
