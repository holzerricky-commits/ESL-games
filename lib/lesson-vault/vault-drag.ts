/** Marks elements a dragged word can be dropped on to save it (vault rail button, open vault panel). */
export const LESSON_VAULT_DROP_ATTR = 'data-lesson-vault-drop'

/** Marks the vault rail button — where saved words fly to. */
export const LESSON_VAULT_RAIL_ATTR = 'data-lesson-vault-rail'

export type VaultDragState = {
  word: string
  x: number
  y: number
  overVault: boolean
}

export type VaultFlyIn = {
  id: number
  word: string
  from: { x: number; y: number }
}

let dragState: VaultDragState | null = null
const dragListeners = new Set<() => void>()
const flyListeners = new Set<(flight: VaultFlyIn) => void>()
let nextFlightId = 1

export function subscribeVaultDrag(listener: () => void): () => void {
  dragListeners.add(listener)
  return () => dragListeners.delete(listener)
}

export function getVaultDrag(): VaultDragState | null {
  return dragState
}

export function setVaultDrag(next: VaultDragState | null): void {
  if (next === dragState) return
  dragState = next
  for (const listener of dragListeners) listener()
}

export function isOverVaultDropTarget(x: number, y: number): boolean {
  if (typeof document === 'undefined') return false
  const el = document.elementFromPoint(x, y)
  return el instanceof Element && el.closest(`[${LESSON_VAULT_DROP_ATTR}]`) != null
}

export function subscribeVaultFlyIn(listener: (flight: VaultFlyIn) => void): () => void {
  flyListeners.add(listener)
  return () => flyListeners.delete(listener)
}

export function requestVaultFlyIn(input: { word: string; from: { x: number; y: number } }): void {
  const flight: VaultFlyIn = { id: nextFlightId++, word: input.word, from: input.from }
  for (const listener of flyListeners) listener(flight)
}
