const storageKey = (studentId: string, classSessionId: string | null) =>
  `esl-map-welcome-consumed:${studentId}:${classSessionId?.trim() || 'none'}:live`

/**
 * Whether the student-facing class-start welcome was already shown for this
 * live class visit in this browser tab. Prep mode does not use this.
 */
export function readMapWelcomeConsumed(
  studentId: string,
  classSessionId: string | null,
): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(storageKey(studentId, classSessionId)) === '1'
  } catch {
    return false
  }
}

export function writeMapWelcomeConsumed(
  studentId: string,
  classSessionId: string | null,
): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(studentId, classSessionId), '1')
  } catch {
    // ignore quota / private mode
  }
}
