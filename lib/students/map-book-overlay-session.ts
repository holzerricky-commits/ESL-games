const storageKey = (studentId: string) => `esl-map-book-overlay-open:${studentId}`

export interface MapBookOverlaySessionState {
  open: boolean
  bookId: string | null
  unitId: string | null
}

function normalizeId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Read open state plus active teaching target for this browser tab. */
export function readMapBookOverlaySession(studentId: string): MapBookOverlaySessionState {
  if (typeof window === 'undefined') {
    return { open: false, bookId: null, unitId: null }
  }
  try {
    const raw = sessionStorage.getItem(storageKey(studentId))
    if (!raw) return { open: false, bookId: null, unitId: null }
    if (raw === '1') return { open: true, bookId: null, unitId: null }
    const parsed = JSON.parse(raw) as {
      open?: unknown
      bookId?: unknown
      unitId?: unknown
    }
    return {
      open: parsed.open === true,
      bookId: normalizeId(parsed.bookId),
      unitId: normalizeId(parsed.unitId),
    }
  } catch {
    return { open: false, bookId: null, unitId: null }
  }
}

/** Whether the fullscreen book overlay was open on the map before the last refresh in this tab. */
export function readMapBookOverlayOpenSession(studentId: string): boolean {
  return readMapBookOverlaySession(studentId).open
}

export function writeMapBookOverlayOpenSession(
  studentId: string,
  next?: { bookId?: string | null; unitId?: string | null },
): void {
  if (typeof window === 'undefined') return
  try {
    const state: MapBookOverlaySessionState = {
      open: true,
      bookId: normalizeId(next?.bookId),
      unitId: normalizeId(next?.unitId),
    }
    sessionStorage.setItem(storageKey(studentId), JSON.stringify(state))
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
