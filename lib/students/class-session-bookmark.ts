import {
  flushPendingUnitPageSave,
  getReaderProgressMap,
} from '@/lib/books/progress'
import type {
  StudentClassSessionView,
  StudentCurriculumUnitAssignmentView,
} from '@/lib/students/types'
import type { ClassSessionBookmarkAtEnd } from '@/lib/types'

function validPage(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : null
}

function getSavedUnitPageIfPresent(bookId: string, unitId: string): number | null {
  const page = getReaderProgressMap()[bookId]?.[unitId]?.page
  return validPage(page)
}

export function buildAutoBookmarkAtEnd(
  session: StudentClassSessionView,
  assignedBookIds: readonly string[],
  assignedUnitRefs: readonly StudentCurriculumUnitAssignmentView[] = [],
): ClassSessionBookmarkAtEnd | null {
  flushPendingUnitPageSave()

  const bookId = (session.selectedSection?.bookId ?? assignedBookIds[0] ?? '').trim()
  if (!bookId) return null

  const section = session.selectedSection
  const unitId =
    section?.unitId?.trim() ||
    assignedUnitRefs.find((ref) => ref.bookId === bookId)?.unitId?.trim() ||
    undefined
  const hint = section?.endPageHint ?? section?.startPageHint
  const pdfPage = (unitId ? getSavedUnitPageIfPresent(bookId, unitId) : null) ?? validPage(hint) ?? 1

  return unitId ? { bookId, pdfPage, unitId } : { bookId, pdfPage }
}
