import type { StudentClassSessionView } from '@/lib/students/types'

export interface ReaderBookmarkLocation {
  bookId: string
  unitId?: string
  pdfPage: number
}

export function buildAutoBookmarkAtEnd(
  session: StudentClassSessionView,
  assignedBookIds: string[],
  readerLocation?: ReaderBookmarkLocation | null,
): { bookId: string; pdfPage: number; unitId?: string } | null {
  if (readerLocation?.bookId?.trim() && Number.isFinite(readerLocation.pdfPage) && readerLocation.pdfPage >= 1) {
    const bookId = readerLocation.bookId.trim()
    const pdfPage = Math.floor(readerLocation.pdfPage)
    const unitId = readerLocation.unitId?.trim() || undefined
    return unitId ? { bookId, pdfPage, unitId } : { bookId, pdfPage }
  }

  const bookId = (session.selectedSection?.bookId ?? assignedBookIds[0] ?? '').trim()
  if (!bookId) return null
  const s = session.selectedSection
  const hint = s?.endPageHint ?? s?.startPageHint
  const pdfPage =
    typeof hint === 'number' && Number.isFinite(hint) && hint >= 1 ? Math.floor(hint) : 1
  const unitId = s?.unitId?.trim() || undefined
  return unitId ? { bookId, pdfPage, unitId } : { bookId, pdfPage }
}
