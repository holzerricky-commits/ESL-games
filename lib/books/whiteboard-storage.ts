/** Sentinel page number for eyedropper routing to the session whiteboard layer. */
export const WHITEBOARD_EYEDROPER_PAGE = 0

/** Legacy per-class key — kept for migration reads of boards saved before lasting notebooks. */
export function annotationStorageSessionKey(classSessionId: string): string {
  const id = classSessionId.trim()
  if (!id) throw new Error('classSessionId is required')
  return `wb:session:${id}`
}

/** Canonical lasting board key: one notebook per book/unit (shared across classes). */
export function annotationStorageLocalWhiteboardKey(bookId: string, unitId: string): string {
  return `wb:session:local:${bookId}:${unitId}`
}

/**
 * Canonical storage key for the lesson board.
 * Always lasting (local) so ink and book links survive across class sessions.
 * `classSessionId` is ignored for the write key; candidates may still include it for migration.
 */
export function resolveWhiteboardStorageKey(args: {
  classSessionId?: string | null | undefined
  bookId: string
  unitId: string
}): string {
  return annotationStorageLocalWhiteboardKey(args.bookId, args.unitId)
}

/**
 * Keys to try on load: lasting local first, then current class (legacy), so prior notes migrate in.
 * `loadWhiteboardSessionBestMatch` also discovers other `wb:session:*` siblings on disk.
 */
export function listWhiteboardStorageKeyCandidates(args: {
  classSessionId: string | null | undefined
  bookId: string
  unitId: string
}): string[] {
  const local = annotationStorageLocalWhiteboardKey(args.bookId, args.unitId)
  const sessionId = args.classSessionId?.trim()
  const keys: string[] = [local]
  if (sessionId) keys.push(annotationStorageSessionKey(sessionId))
  return [...new Set(keys)]
}
