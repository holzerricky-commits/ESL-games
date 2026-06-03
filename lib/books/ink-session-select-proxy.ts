import type { BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import type { InkSessionStore } from '@/lib/books/ink-session-store'
import type { SpreadSessionStore } from '@/lib/books/spread-session-store'

/** Imperative select/undo API for ink session stores (toolbar + keyboard). */
export type InkSessionSelectProxyHandle = Pick<
  BookPageAnnotationHandle,
  | 'getSelectedIds'
  | 'setSelectedIds'
  | 'selectAll'
  | 'deselectAll'
  | 'deleteSelected'
  | 'copySelected'
  | 'pasteFromClipboard'
  | 'duplicateSelected'
  | 'toggleGroupSelected'
  | 'removeFromGroupSelected'
  | 'selectNextInStack'
  | 'undo'
  | 'redo'
  | 'clear'
>

/** @deprecated Use InkSessionSelectProxyHandle */
export type SpreadSessionSelectProxyHandle = InkSessionSelectProxyHandle

export function createInkSessionSelectProxy(
  getStore: () => InkSessionStore | null,
): InkSessionSelectProxyHandle {
  return {
    getSelectedIds: () => getStore()?.getState().selectedIds ?? [],
    setSelectedIds: (ids) => getStore()?.setSelectedIds(ids),
    selectAll: () => getStore()?.selectAll(),
    deselectAll: () => getStore()?.setSelectedIds([]),
    deleteSelected: () => getStore()?.deleteSelected() ?? false,
    copySelected: () => getStore()?.copySelected() ?? false,
    pasteFromClipboard: () => getStore()?.pasteFromClipboard() ?? false,
    duplicateSelected: () => getStore()?.duplicateSelected() ?? false,
    toggleGroupSelected: () => getStore()?.toggleGroupSelected() ?? false,
    removeFromGroupSelected: () => getStore()?.removeFromGroupSelected() ?? false,
    selectNextInStack: (direction) => {
      getStore()?.selectNextInStack(direction)
    },
    undo: () => {
      getStore()?.undo()
    },
    redo: () => {
      getStore()?.redo()
    },
    clear: () => {
      getStore()?.clearCommands()
    },
  }
}

export function createSpreadSessionSelectProxy(
  getStore: () => SpreadSessionStore | null,
): InkSessionSelectProxyHandle {
  return createInkSessionSelectProxy(getStore)
}
