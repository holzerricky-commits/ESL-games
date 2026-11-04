import type { OcrWordBox } from '@/lib/books/searchable-pdf-text-layer'

export const SEARCHABLE_OCR_RESULT_VERSION = 1 as const

/**
 * Render + Tesseract settings that produced a saved result. Pages read with older
 * settings are read again instead of reusing the cached words.
 */
export const SEARCHABLE_OCR_PROFILE = 'sparse-gray-2600-c60' as const

/** OCR words for one page in image pixels, before body filtering and stamping. */
export type SearchableOcrResultFile = {
  version: typeof SEARCHABLE_OCR_RESULT_VERSION
  profile: string | null
  pdfPage: number
  imageWidth: number
  imageHeight: number
  source: 'tesseract' | 'cloud'
  words: OcrWordBox[]
}

export function buildSearchableOcrResultFile(args: {
  pdfPage: number
  imageWidth: number
  imageHeight: number
  source: SearchableOcrResultFile['source']
  words: readonly OcrWordBox[]
}): SearchableOcrResultFile {
  return {
    version: SEARCHABLE_OCR_RESULT_VERSION,
    profile: SEARCHABLE_OCR_PROFILE,
    pdfPage: Math.max(1, Math.floor(args.pdfPage)),
    imageWidth: args.imageWidth,
    imageHeight: args.imageHeight,
    source: args.source,
    words: args.words.map(({ text, x0, y0, x1, y1 }) => ({ text, x0, y0, x1, y1 })),
  }
}

export function parseSearchableOcrResultFile(raw: unknown): SearchableOcrResultFile | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.version !== SEARCHABLE_OCR_RESULT_VERSION) return null
  const pdfPage = Number(obj.pdfPage)
  const imageWidth = Number(obj.imageWidth)
  const imageHeight = Number(obj.imageHeight)
  if (!Number.isFinite(pdfPage) || !(imageWidth > 0) || !(imageHeight > 0)) return null
  if (!Array.isArray(obj.words)) return null
  const words: OcrWordBox[] = []
  for (const item of obj.words) {
    if (!item || typeof item !== 'object') continue
    const w = item as Record<string, unknown>
    if (typeof w.text !== 'string' || !w.text.trim()) continue
    const x0 = Number(w.x0)
    const y0 = Number(w.y0)
    const x1 = Number(w.x1)
    const y1 = Number(w.y1)
    if (![x0, y0, x1, y1].every(Number.isFinite)) continue
    words.push({ text: w.text, x0, y0, x1, y1 })
  }
  return {
    version: SEARCHABLE_OCR_RESULT_VERSION,
    profile: typeof obj.profile === 'string' ? obj.profile : null,
    pdfPage: Math.floor(pdfPage),
    imageWidth,
    imageHeight,
    source: obj.source === 'cloud' ? 'cloud' : 'tesseract',
    words,
  }
}

/** True when a saved result was read with the current render + Tesseract settings. */
export function isCurrentSearchableOcrProfile(result: SearchableOcrResultFile): boolean {
  return result.profile === SEARCHABLE_OCR_PROFILE
}
