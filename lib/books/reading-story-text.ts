/** Saved story body for reading checks (Phase 2 fuel). */
export interface ReadingStoryTextRecord {
  storyId: string
  bookId: string
  unitId: string
  text: string
  source: 'pdf' | 'paste' | 'gemini'
  /** PDF indices used when source is pdf or gemini (inclusive). */
  startPdfPage: number | null
  endPdfPage: number | null
  /** Printed pages shown on Stories when saved. */
  startDisplayPage: number | null
  endDisplayPage: number | null
  updatedAt: string
}

export function sanitizeReadingStoryTextRecord(
  input: Partial<ReadingStoryTextRecord> & { storyId: string; bookId: string; unitId: string },
): ReadingStoryTextRecord | null {
  const storyId = String(input.storyId ?? '').trim()
  const bookId = String(input.bookId ?? '').trim()
  const unitId = String(input.unitId ?? '').trim()
  if (!storyId || !bookId || !unitId) return null
  const text = typeof input.text === 'string' ? input.text : ''
  const source =
    input.source === 'paste' ? 'paste' : input.source === 'gemini' ? 'gemini' : 'pdf'
  const toPage = (v: unknown): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    const n = Math.floor(v)
    return n >= 1 ? n : null
  }
  return {
    storyId,
    bookId,
    unitId,
    text,
    source,
    startPdfPage: toPage(input.startPdfPage),
    endPdfPage: toPage(input.endPdfPage),
    startDisplayPage: toPage(input.startDisplayPage),
    endDisplayPage: toPage(input.endDisplayPage),
    updatedAt:
      typeof input.updatedAt === 'string' && input.updatedAt.trim()
        ? input.updatedAt.trim()
        : new Date().toISOString(),
  }
}

export function readingStoryTextStatus(text: string | null | undefined): 'none' | 'ready' {
  return typeof text === 'string' && text.trim().length > 0 ? 'ready' : 'none'
}
