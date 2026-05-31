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
