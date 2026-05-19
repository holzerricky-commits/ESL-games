import { getSavedUnitPageIfPresent } from '@/lib/books/progress'
import type { StudentClassSession } from '@/lib/types'

export interface BuildClassSessionEndBookmarkArgs {
  session: StudentClassSession
  assignedBookIds: string[]
  assignedUnitRefs: Array<{ bookId: string; unitId: string }>
}

export interface ClassSessionEndBookmark {
  bookId: string
  pdfPage: number
  unitId?: string
}

function firstAssignedUnitForBook(
  bookId: string,
  assignedUnitRefs: Array<{ bookId: string; unitId: string }>,
): string | undefined {
  const match = assignedUnitRefs.find((row) => row.bookId.trim() === bookId)
  return match?.unitId?.trim() || undefined
}

function plannedSectionPageHint(session: StudentClassSession): number {
  const section = session.selectedSection
  const hint = section?.endPageHint ?? section?.startPageHint
  return typeof hint === 'number' && Number.isFinite(hint) && hint >= 1 ? Math.floor(hint) : 1
}

export function buildClassSessionEndBookmark({
  session,
  assignedBookIds,
  assignedUnitRefs,
}: BuildClassSessionEndBookmarkArgs): ClassSessionEndBookmark | null {
  const section = session.selectedSection
  const bookId = (section?.bookId ?? assignedUnitRefs[0]?.bookId ?? assignedBookIds[0] ?? '').trim()
  if (!bookId) return null

  const unitId = section?.unitId?.trim() || firstAssignedUnitForBook(bookId, assignedUnitRefs)
  const savedReaderPage = unitId ? getSavedUnitPageIfPresent(bookId, unitId) : null
  const pdfPage = savedReaderPage ?? plannedSectionPageHint(session)

  return unitId ? { bookId, pdfPage, unitId } : { bookId, pdfPage }
}
