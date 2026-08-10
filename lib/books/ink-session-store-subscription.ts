import type { InkSessionDocument } from '@/lib/books/ink-session-types'
import type { InkSessionNudgePreview, InkSessionStore } from '@/lib/books/ink-session-store'

/** Narrow React boundary snapshot — no full `commands[]` in state (R4). */
export type InkSessionStoreUiSnapshot = {
  revision: number
  selectedIds: readonly string[]
  nudgePreview: InkSessionNudgePreview | null
  canUndo: boolean
  canRedo: boolean
}

export function pickInkSessionStoreUiSnapshot<TDoc extends InkSessionDocument>(
  state: ReturnType<InkSessionStore<TDoc>['getState']>,
): InkSessionStoreUiSnapshot {
  return {
    revision: state.doc.meta.revision,
    selectedIds: state.selectedIds,
    nudgePreview: state.nudgePreview,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  }
}

function uiSnapshotsEqual(a: InkSessionStoreUiSnapshot, b: InkSessionStoreUiSnapshot): boolean {
  if (
    a.revision !== b.revision ||
    a.canUndo !== b.canUndo ||
    a.canRedo !== b.canRedo ||
    a.selectedIds.length !== b.selectedIds.length
  ) {
    return false
  }
  for (let i = 0; i < a.selectedIds.length; i++) {
    if (a.selectedIds[i] !== b.selectedIds[i]) return false
  }
  const an = a.nudgePreview
  const bn = b.nudgePreview
  if (an == null && bn == null) return true
  if (an == null || bn == null) return false
  return an.dx === bn.dx && an.dy === bn.dy
}

/** Lesson-board doc shape changes (pages / active page) — not every pen lift. */
export function whiteboardSessionStructureKey(doc: {
  activePageId: string
  pages: readonly { id: string; contentHeightPx?: number }[]
}): string {
  return `${doc.activePageId}|${doc.pages.map((p) => `${p.id}:${p.contentHeightPx ?? 0}`).join(';')}`
}

/**
 * Subscribe to store emits but only notify when the UI snapshot changes.
 * Always updates `docRef` imperatively (for checkpoint / flush).
 */
export function subscribeInkSessionStoreUi<TDoc extends InkSessionDocument>(
  store: InkSessionStore<TDoc>,
  docRef: { current: TDoc | null },
  onUiChange: (snapshot: InkSessionStoreUiSnapshot) => void,
): () => void {
  let last = pickInkSessionStoreUiSnapshot(store.getState())
  docRef.current = store.getState().doc
  return store.subscribe((state) => {
    docRef.current = state.doc
    const next = pickInkSessionStoreUiSnapshot(state)
    if (uiSnapshotsEqual(last, next)) return
    last = next
    onUiChange(next)
  })
}
