import type { VocabTapSpot } from '@/lib/context/types'
import type { PdfPageTextRun } from '@/lib/books/pdf-page-text-geometry'
import { normalizeVocabMatchToken } from '@/lib/books/interactive-vocab-text-hits'

/**
 * Find the first occurrence of `headword` in the page runs and return
 * a normalized bounding box covering the matched runs.
 */
export function suggestTapSpotOnPage(
  runs: readonly PdfPageTextRun[],
  pdfPage: number,
  headword: string,
): VocabTapSpot | null {
  const needle = normalizeVocabMatchToken(headword)
  if (!needle || runs.length === 0) return null

  // Build concatenated text with run boundaries
  const parts: { runIdx: number; start: number; end: number }[] = []
  let concat = ''
  for (let i = 0; i < runs.length; i++) {
    const text = runs[i].text
    if (!text) continue
    // Separate runs with a space so word boundaries work across runs
    if (concat.length > 0 && !/\s$/.test(concat)) concat += ' '
    const start = concat.length
    concat += text
    parts.push({ runIdx: i, start, end: concat.length })
  }

  const lower = concat.toLowerCase()
  const idx = lower.indexOf(needle)
  if (idx < 0) return null
  const end = idx + needle.length

  // Check word boundaries
  const before = idx === 0 ? '' : lower[idx - 1]!
  const after = end >= lower.length ? '' : lower[end]!
  const boundaryBefore = idx === 0 || /[^a-z0-9']/i.test(before)
  const boundaryAfter = end >= lower.length || /[^a-z0-9']/i.test(after)
  if (!boundaryBefore || !boundaryAfter) return null

  // Find which runs overlap the match
  const matchedRuns: PdfPageTextRun[] = []
  for (const part of parts) {
    if (part.end <= idx || part.start >= end) continue
    matchedRuns.push(runs[part.runIdx])
  }
  if (matchedRuns.length === 0) return null

  // Union bounding box
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of matchedRuns) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }

  const w = maxX - minX
  const h = maxY - minY
  if (w < 0.001 || h < 0.001) return null

  return { pdfPage, x: minX, y: minY, w, h }
}

/**
 * Suggest tap spots for a list of vocab words across multiple pages of runs.
 * Returns a map of wordId → VocabTapSpot for words that were found.
 */
export function suggestTapSpots(
  pageRuns: { pdfPage: number; runs: PdfPageTextRun[] }[],
  words: { id: string; word: string }[],
): Map<string, VocabTapSpot> {
  const result = new Map<string, VocabTapSpot>()

  for (const w of words) {
    for (const page of pageRuns) {
      const spot = suggestTapSpotOnPage(page.runs, page.pdfPage, w.word)
      if (spot) {
        result.set(w.id, spot)
        break
      }
    }
  }

  return result
}
