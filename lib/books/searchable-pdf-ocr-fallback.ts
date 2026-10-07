/**
 * Page-confidence gate and cloud-OCR box parsing for selectable picture PDFs.
 * Pure helpers — no network, no server-only.
 */

/** Median Tesseract confidence below this sends the page to cloud OCR. */
export const OCR_PAGE_CONFIDENCE_MIN = 65

/** Confidence assigned to words read by the cloud model (no Tesseract score). */
export const CLOUD_OCR_WORD_CONFIDENCE = 100

const MAX_CLOUD_WORDS = 2500

export type ScoredOcrWord = {
  text: string
  confidence: number
  x0: number
  y0: number
  x1: number
  y1: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/** Median word confidence, 0 when the page produced no boxes. */
export function medianOcrConfidence(words: readonly { confidence: number }[]): number {
  const scores = words.map((w) => w.confidence).filter((n) => Number.isFinite(n))
  return median(scores)
}

/**
 * True when local OCR is too weak to stamp.
 * Empty pages and medians under {@link OCR_PAGE_CONFIDENCE_MIN} both qualify.
 */
export function pageNeedsCloudOcrFallback(words: readonly { confidence: number }[]): boolean {
  if (words.length === 0) return true
  return medianOcrConfidence(words) < OCR_PAGE_CONFIDENCE_MIN
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed
  const first = withoutFence.indexOf('{')
  const last = withoutFence.lastIndexOf('}')
  const candidate = first >= 0 && last > first ? withoutFence.slice(first, last + 1) : withoutFence
  return JSON.parse(candidate)
}

function finiteCoord(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

/**
 * Turn a cloud OCR JSON payload into image-pixel word boxes.
 * Coordinates at or under 1.5 are fractions of the image; larger values are pixels.
 */
export function parseCloudOcrWords(
  raw: unknown,
  imageWidth: number,
  imageHeight: number,
): ScoredOcrWord[] {
  if (imageWidth <= 0 || imageHeight <= 0) return []
  if (!raw || typeof raw !== 'object') return []
  const wordsRaw = (raw as { words?: unknown }).words
  if (!Array.isArray(wordsRaw)) return []

  const rows: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }> = []
  for (const row of wordsRaw) {
    if (!row || typeof row !== 'object') continue
    const src = row as Record<string, unknown>
    const text = typeof src.text === 'string' ? src.text.trim() : ''
    const x0 = finiteCoord(src.x0)
    const y0 = finiteCoord(src.y0)
    const x1 = finiteCoord(src.x1)
    const y1 = finiteCoord(src.y1)
    if (!text || x0 == null || y0 == null || x1 == null || y1 == null) continue
    rows.push({ text, x0, y0, x1, y1 })
    if (rows.length >= MAX_CLOUD_WORDS) break
  }
  if (rows.length === 0) return []

  let maxCoord = 0
  for (const row of rows) {
    maxCoord = Math.max(maxCoord, row.x0, row.y0, row.x1, row.y1)
  }
  const normalized = maxCoord <= 1.5

  const words: ScoredOcrWord[] = []
  for (const row of rows) {
    const x0 = normalized ? row.x0 * imageWidth : row.x0
    const y0 = normalized ? row.y0 * imageHeight : row.y0
    const x1 = normalized ? row.x1 * imageWidth : row.x1
    const y1 = normalized ? row.y1 * imageHeight : row.y1
    const left = Math.max(0, Math.min(x0, x1))
    const right = Math.min(imageWidth, Math.max(x0, x1))
    const top = Math.max(0, Math.min(y0, y1))
    const bottom = Math.min(imageHeight, Math.max(y0, y1))
    if (!(right - left > 1) || !(bottom - top > 1)) continue
    words.push({
      text: row.text,
      confidence: CLOUD_OCR_WORD_CONFIDENCE,
      x0: left,
      y0: top,
      x1: right,
      y1: bottom,
    })
  }

  words.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
  return words
}

/** Parse a model text reply (optional markdown fence) into pixel word boxes. */
export function parseCloudOcrWordsFromModelText(
  text: string,
  imageWidth: number,
  imageHeight: number,
): ScoredOcrWord[] {
  try {
    return parseCloudOcrWords(parseJsonFromModelText(text), imageWidth, imageHeight)
  } catch {
    return []
  }
}
