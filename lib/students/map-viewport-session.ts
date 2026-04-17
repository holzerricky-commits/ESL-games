const storageKey = (studentId: string) => `esl-map-viewport:${studentId}`

export interface MapViewportSnapshot {
  offset: { x: number; y: number }
  scale: number
}

export function readMapViewportSession(studentId: string): MapViewportSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(studentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = (parsed as { offset?: unknown }).offset
    const s = (parsed as { scale?: unknown }).scale
    if (!o || typeof o !== 'object') return null
    const ox = Number((o as { x?: unknown }).x)
    const oy = Number((o as { y?: unknown }).y)
    const sc = Number(s)
    if (!Number.isFinite(ox) || !Number.isFinite(oy) || !Number.isFinite(sc)) return null
    return { offset: { x: ox, y: oy }, scale: sc }
  } catch {
    return null
  }
}

export function writeMapViewportSession(studentId: string, snapshot: MapViewportSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(studentId), JSON.stringify(snapshot))
  } catch {
    // ignore quota / private mode
  }
}

export function clearMapViewportSession(studentId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(studentId))
  } catch {
    // ignore
  }
}

export function getInitialViewportState(
  studentId: string,
  fullscreen: boolean,
): { offset: { x: number; y: number }; scale: number; restored: boolean } {
  if (!fullscreen) return { offset: { x: 0, y: 0 }, scale: 1, restored: false }
  const snap = readMapViewportSession(studentId)
  if (!snap) return { offset: { x: 0, y: 0 }, scale: 1, restored: false }
  return { offset: snap.offset, scale: snap.scale, restored: true }
}
