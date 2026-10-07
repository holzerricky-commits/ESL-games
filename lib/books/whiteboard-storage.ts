/** Sentinel page number for eyedropper routing to the session whiteboard layer. */
export const WHITEBOARD_EYEDROPER_PAGE = 0

/** Stable WhiteboardSessionKey.bookId for the student notebook (not a real PDF). */
export const STUDENT_NOTEBOOK_BOOK_ID = 'student'

/** Stable WhiteboardSessionKey.unitId for the student notebook (not a curriculum unit). */
export const STUDENT_NOTEBOOK_UNIT_ID = 'notebook'

/** Legacy per-class key — kept for migration reads of boards saved before lasting notebooks. */
export function annotationStorageSessionKey(classSessionId: string): string {
  const id = classSessionId.trim()
  if (!id) throw new Error('classSessionId is required')
  return `wb:session:${id}`
}

/** Legacy lasting board key: one notebook per book/unit. Kept for copy-merge reads. */
export function annotationStorageLocalWhiteboardKey(bookId: string, unitId: string): string {
  return `wb:session:local:${bookId}:${unitId}`
}

/** Canonical lasting notebook key: one notebook per student. */
export function annotationStorageStudentWhiteboardKey(studentId: string): string {
  const id = studentId.trim()
  if (!id) throw new Error('studentId is required')
  return `wb:session:local:student:${id}`
}

export function isStudentNotebookStorageKey(storagePageKey: string | null | undefined): boolean {
  return Boolean(storagePageKey?.startsWith('wb:session:local:student:'))
}

/**
 * Canonical storage key for the lesson notebook.
 * Always lasting (local) so ink survives across class sessions and book swaps.
 * `classSessionId` / book / unit are ignored for the write key.
 */
export function resolveWhiteboardStorageKey(args: {
  studentId: string
  classSessionId?: string | null | undefined
  bookId?: string
  unitId?: string
}): string {
  return annotationStorageStudentWhiteboardKey(args.studentId)
}

/**
 * Keys to try on load for the student notebook itself.
 * Book/unit boards are copy-merged separately (see `student-notebook-merge.ts`).
 */
export function listWhiteboardStorageKeyCandidates(args: {
  studentId: string
  classSessionId?: string | null | undefined
  bookId?: string
  unitId?: string
}): string[] {
  return [annotationStorageStudentWhiteboardKey(args.studentId)]
}
