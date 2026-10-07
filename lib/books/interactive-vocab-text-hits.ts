import { PDF_TEXT_CONTENT_SELECTOR, PDF_TEXT_SPAN_SELECTOR } from '@/lib/books/pdf-text-selectors'

export type InteractiveVocabMatchWord = {
  id: string
  word: string
}

/** Page-normalized box (0–1) relative to the page root element. */
export type InteractiveVocabTextHit = {
  wordId: string
  word: string
  x: number
  y: number
  w: number
  h: number
}

/** Strip edge punctuation; keep inner apostrophes (e.g. don't). */
export function normalizeVocabMatchToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '')
}

/**
 * Whole-word (or whole multi-word phrase) matches of `headword` inside `haystack`.
 * Returns character ranges in the original haystack string.
 */
export function findHeadwordRangesInText(haystack: string, headword: string): { start: number; end: number }[] {
  const needle = normalizeVocabMatchToken(headword)
  if (!needle) return []

  const lower = haystack.toLowerCase()
  const ranges: { start: number; end: number }[] = []
  let from = 0

  while (from <= lower.length) {
    const idx = lower.indexOf(needle, from)
    if (idx < 0) break
    const end = idx + needle.length
    const before = idx === 0 ? '' : lower[idx - 1]!
    const after = end >= lower.length ? '' : lower[end]!
    const boundaryBefore = idx === 0 || /[^a-z0-9']/i.test(before)
    const boundaryAfter = end >= lower.length || /[^a-z0-9']/i.test(after)
    if (boundaryBefore && boundaryAfter) {
      ranges.push({ start: idx, end })
    }
    from = idx + 1
  }

  return ranges
}

export type SpanTextSlice = {
  index: number
  /** Inclusive start offset in the concatenated string. */
  start: number
  /** Exclusive end offset in the concatenated string. */
  end: number
  text: string
}

/** Concatenate span texts (PDF spans sit adjacent) and map char offsets back to span indices. */
export function buildSpanConcatMap(spanTexts: readonly string[]): {
  concat: string
  slices: SpanTextSlice[]
} {
  const slices: SpanTextSlice[] = []
  let concat = ''
  for (let i = 0; i < spanTexts.length; i++) {
    const text = spanTexts[i] ?? ''
    const start = concat.length
    concat += text
    slices.push({ index: i, start, end: concat.length, text })
  }
  return { concat, slices }
}

/** Span indices that overlap any of the given character ranges. */
export function spanIndicesForRanges(
  slices: readonly SpanTextSlice[],
  ranges: readonly { start: number; end: number }[],
): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  for (const range of ranges) {
    for (const slice of slices) {
      if (slice.end <= range.start || slice.start >= range.end) continue
      if (seen.has(slice.index)) continue
      seen.add(slice.index)
      out.push(slice.index)
    }
  }
  return out
}

/**
 * Pure match: given ordered span texts and pack words, return hits as
 * `{ wordId, word, spanIndices }` (one entry per occurrence group).
 */
export function matchVocabWordsToSpanTexts(
  spanTexts: readonly string[],
  words: readonly InteractiveVocabMatchWord[],
): { wordId: string; word: string; spanIndices: number[] }[] {
  const { concat, slices } = buildSpanConcatMap(spanTexts)
  if (!concat.trim() || words.length === 0) return []

  const hits: { wordId: string; word: string; spanIndices: number[] }[] = []
  // Longer headwords first so "championship" wins over "champion" if both exist.
  const ordered = [...words].sort((a, b) => b.word.length - a.word.length)

  for (const w of ordered) {
    const needle = normalizeVocabMatchToken(w.word)
    if (!needle) continue
    const ranges = findHeadwordRangesInText(concat, w.word)
    for (const range of ranges) {
      const spanIndices = spanIndicesForRanges(slices, [range])
      if (spanIndices.length === 0) continue
      hits.push({ wordId: w.id, word: w.word, spanIndices })
    }
  }

  return hits
}

function clientRectToPageNorm(
  pageRect: DOMRectReadOnly,
  box: DOMRectReadOnly,
): { x: number; y: number; w: number; h: number } | null {
  if (!(pageRect.width > 0) || !(pageRect.height > 0)) return null
  if (!(box.width > 0) || !(box.height > 0)) return null
  return {
    x: (box.left - pageRect.left) / pageRect.width,
    y: (box.top - pageRect.top) / pageRect.height,
    w: box.width / pageRect.width,
    h: box.height / pageRect.height,
  }
}

function unionClientRects(rects: DOMRectReadOnly[]): DOMRect | null {
  if (rects.length === 0) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const r of rects) {
    if (!(r.width > 0) || !(r.height > 0)) continue
    left = Math.min(left, r.left)
    top = Math.min(top, r.top)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null
  return new DOMRect(left, top, right - left, bottom - top)
}

/**
 * Scan the live react-pdf text layer under `pageRoot` and return page-normalized highlight boxes
 * for pack headwords that appear on the page.
 */
export function collectInteractiveVocabTextHits(
  pageRoot: Element,
  words: readonly InteractiveVocabMatchWord[],
): InteractiveVocabTextHit[] {
  if (typeof document === 'undefined' || words.length === 0) return []

  const textLayer = pageRoot.querySelector(PDF_TEXT_CONTENT_SELECTOR)
  if (!textLayer) return []

  const spanEls = Array.from(textLayer.querySelectorAll(PDF_TEXT_SPAN_SELECTOR)).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )
  if (spanEls.length === 0) return []

  const spanTexts = spanEls.map((el) => el.textContent ?? '')
  const matches = matchVocabWordsToSpanTexts(spanTexts, words)
  if (matches.length === 0) return []

  const pageRect = pageRoot.getBoundingClientRect()
  const out: InteractiveVocabTextHit[] = []

  for (const match of matches) {
    const rects = match.spanIndices
      .map((i) => spanEls[i]?.getBoundingClientRect())
      .filter((r): r is DOMRect => r != null)
    const union = unionClientRects(rects)
    if (!union) continue
    const norm = clientRectToPageNorm(pageRect, union)
    if (!norm) continue
    // Skip near-zero / off-page noise
    if (norm.w < 0.002 || norm.h < 0.002) continue
    out.push({
      wordId: match.wordId,
      word: match.word,
      x: norm.x,
      y: norm.y,
      w: norm.w,
      h: norm.h,
    })
  }

  return out
}
