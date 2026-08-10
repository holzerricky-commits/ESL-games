export const BOARD_PASTE_REVEAL_MS = 450

type PasteRevealEntry = {
  id: string
  startedAt: number
}

const reveals = new Map<string, PasteRevealEntry>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Progress 0..1 through the paste pop animation. */
export function boardPasteRevealProgress(elapsedMs: number): number {
  return Math.max(0, Math.min(1, elapsedMs / BOARD_PASTE_REVEAL_MS))
}

/** Scale for canvas redraw: 0 -> 1.06 overshoot -> 1. */
export function boardPasteRevealScaleAtProgress(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  if (progress < 0.7) {
    const t = progress / 0.7
    return t * 1.06
  }
  const t = (progress - 0.7) / 0.3
  return 1.06 + (1 - 1.06) * t
}

export function boardPasteRevealScaleAtElapsed(elapsedMs: number): number {
  return boardPasteRevealScaleAtProgress(boardPasteRevealProgress(elapsedMs))
}

export function registerPasteRevealIds(ids: readonly string[], now: number = Date.now()): void {
  if (ids.length === 0) return
  for (const id of ids) {
    if (!id) continue
    reveals.set(id, { id, startedAt: now })
  }
  emit()
}

export function getPasteRevealScale(id: string, now: number = Date.now()): number | null {
  const entry = reveals.get(id)
  if (!entry) return null
  const elapsed = now - entry.startedAt
  if (elapsed >= BOARD_PASTE_REVEAL_MS) return null
  return boardPasteRevealScaleAtElapsed(elapsed)
}

export function getPasteRevealOpacity(id: string, now: number = Date.now()): number | null {
  const entry = reveals.get(id)
  if (!entry) return null
  const elapsed = now - entry.startedAt
  if (elapsed >= BOARD_PASTE_REVEAL_MS) return null
  const progress = boardPasteRevealProgress(elapsed)
  if (progress >= 0.3) return 1
  return progress / 0.3
}

export function getActivePasteRevealIds(now: number = Date.now()): ReadonlySet<string> {
  const out = new Set<string>()
  for (const [id, entry] of reveals) {
    if (now - entry.startedAt < BOARD_PASTE_REVEAL_MS) out.add(id)
  }
  return out
}

export function hasActivePasteReveals(now: number = Date.now()): boolean {
  for (const entry of reveals.values()) {
    if (now - entry.startedAt < BOARD_PASTE_REVEAL_MS) return true
  }
  return false
}

export function clearFinishedPasteReveals(now: number = Date.now()): boolean {
  let removed = false
  for (const [id, entry] of reveals) {
    if (now - entry.startedAt >= BOARD_PASTE_REVEAL_MS) {
      reveals.delete(id)
      removed = true
    }
  }
  if (removed) emit()
  return removed
}

export function subscribePasteRevealChanges(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test helper — reset module state. */
export function resetPasteRevealRegistry(): void {
  reveals.clear()
  emit()
}
