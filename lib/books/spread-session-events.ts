export const SPREAD_SESSION_FLUSH_EVENT = 'esl:spread-session-flush'

export function requestSpreadSessionFlush(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SPREAD_SESSION_FLUSH_EVENT))
}
