const storageKey = (studentId: string) => `esl-map-book-overlay-open:${studentId}`

/** Whether the fullscreen book overlay was open on the map before the last refresh in this tab. */
export function readMapBookOverlayOpenSession(studentId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(storageKey(studentId)) === '1'
  } catch {
    return false
  }
}

export function writeMapBookOverlayOpenSession(studentId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(studentId), '1')
  } catch {
    // ignore quota / private mode
  }
}

export function clearMapBookOverlayOpenSession(studentId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(studentId))
  } catch {
    // ignore
  }
}
