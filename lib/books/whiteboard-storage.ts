/** Sentinel page number for eyedropper routing to the session whiteboard layer. */
export const WHITEBOARD_EYEDROPER_PAGE = 0

// TODO(post-class): export session board ink (`wb:session:{classSessionId}`) for student analytics.

export function annotationStorageSessionKey(classSessionId: string): string {
  const id = classSessionId.trim()
  if (!id) throw new Error('classSessionId is required')
  return `wb:session:${id}`
}

export function annotationStorageLocalWhiteboardKey(bookId: string, unitId: string): string {
  return `wb:session:local:${bookId}:${unitId}`
}

export function resolveWhiteboardStorageKey(args: {
  classSessionId: string | null | undefined
  bookId: string
  unitId: string
}): string {
  const sessionId = args.classSessionId?.trim()
  if (sessionId) return annotationStorageSessionKey(sessionId)
  return annotationStorageLocalWhiteboardKey(args.bookId, args.unitId)
}

/** Keys to try on load so reload finds ink saved under class or local session id. */
export function listWhiteboardStorageKeyCandidates(args: {
  classSessionId: string | null | undefined
  bookId: string
  unitId: string
}): string[] {
  const local = annotationStorageLocalWhiteboardKey(args.bookId, args.unitId)
  const sessionId = args.classSessionId?.trim()
  const keys: string[] = []
  if (sessionId) keys.push(annotationStorageSessionKey(sessionId))
  keys.push(local)
  return [...new Set(keys)]
}
