import { getSavedUnitProgress } from '@/lib/books/progress'
import type { StudentClassSessionView } from '@/lib/students/types'

export interface ClassSessionBookmarkBookUnitRef {
  bookId: string
  unitId: string
}

export function buildAutoBookmarkAtEnd(
  session: StudentClassSessionView,
  assignedBookIds: string[],
  assignedUnitRefs: ClassSessionBookmarkBookUnitRef[] = [],
): { bookId: string; pdfPage: number; unitId?: string } | null {
  const bookId = (session.selectedSection?.bookId ?? assignedBookIds[0] ?? '').trim()
  if (!bookId) return null
  const s = session.selectedSection
  const unitId =
    s?.unitId?.trim() ||
    assignedUnitRefs.find((ref) => ref.bookId.trim() === bookId)?.unitId.trim() ||
    undefined
  const hint = s?.endPageHint ?? s?.startPageHint
  let pdfPage =
    typeof hint === 'number' && Number.isFinite(hint) && hint >= 1 ? Math.floor(hint) : 1

  if (unitId) {
    const saved = getSavedUnitProgress(bookId, unitId)
    const savedAt = saved?.updatedAt ? Date.parse(saved.updatedAt) : NaN
    const startedAt = session.classStartedAt ? Date.parse(session.classStartedAt) : NaN
    if (saved && Number.isFinite(savedAt) && Number.isFinite(startedAt) && savedAt >= startedAt) {
      pdfPage = saved.page
    }
  }

  return unitId ? { bookId, pdfPage, unitId } : { bookId, pdfPage }
}
