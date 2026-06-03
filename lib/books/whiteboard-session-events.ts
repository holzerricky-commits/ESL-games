export const WHITEBOARD_SESSION_FLUSH_EVENT = 'esl:whiteboard-session-flush'

export function requestWhiteboardSessionFlush(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WHITEBOARD_SESSION_FLUSH_EVENT))
}
