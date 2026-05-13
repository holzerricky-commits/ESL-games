import { getSavedUnitProgress } from '@/lib/books/progress'
import type { StudentClassSession } from '@/lib/types'

function progressPageFromThisClass(session: StudentClassSession, bookId: string, unitId: string): number | null {
  const progress = getSavedUnitProgress(bookId, unitId)
  if (!progress) return null
  const progressMs = Date.parse(progress.updatedAt)
  const classStartedMs = Date.parse(session.classStartedAt ?? '')
  if (!Number.isFinite(progressMs)) return null
  if (Number.isFinite(classStartedMs) && progressMs < classStartedMs) return null
  return progress.page
}

export function buildAutoBookmarkAtEnd(
  session: StudentClassSession,
  assignedBookIds: string[],
): { bookId: string; pdfPage: number; unitId?: string } | null {
  const bookId = (session.selectedSection?.bookId ?? assignedBookIds[0] ?? '').trim()
  if (!bookId) return null
  const section = session.selectedSection
  const unitId = section?.unitId?.trim() || undefined
  const progressPage = unitId ? progressPageFromThisClass(session, bookId, unitId) : null
  const hint = section?.endPageHint ?? section?.startPageHint
  const pdfPage =
    progressPage ??
    (typeof hint === 'number' && Number.isFinite(hint) && hint >= 1 ? Math.floor(hint) : 1)
  return unitId ? { bookId, pdfPage, unitId } : { bookId, pdfPage }
}
