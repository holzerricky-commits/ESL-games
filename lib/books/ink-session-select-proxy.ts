import type { RefObject } from 'react'
import type { BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import type { InkSessionStore } from '@/lib/books/ink-session-store'
import type { InkSessionDocument } from '@/lib/books/ink-session-types'
import type { SpreadSessionStore } from '@/lib/books/spread-session-store'

type PageAnnotationRef = RefObject<BookPageAnnotationHandle | null>

/** Imperative select/undo API for ink session stores (toolbar + keyboard). */
export type InkSessionSelectProxyHandle = Required<
  Pick<
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
    | 'moveSelectedBy'
    | 'setNudgePreview'
    | 'commitNudgePreview'
    | 'clearNudgePreview'
    | 'undo'
    | 'redo'
    | 'clear'
  >
>

/** @deprecated Use InkSessionSelectProxyHandle */
export type SpreadSessionSelectProxyHandle = InkSessionSelectProxyHandle

export function createInkSessionSelectProxy<TDoc extends InkSessionDocument>(
  getStore: () => InkSessionStore<TDoc> | null,
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
    moveSelectedBy: (dx, dy) => getStore()?.moveSelectedBy(dx, dy) ?? false,
    setNudgePreview: (dx, dy) => {
      getStore()?.setNudgePreview(dx, dy)
    },
    commitNudgePreview: () => getStore()?.commitNudgePreview() ?? false,
    clearNudgePreview: () => {
      getStore()?.clearNudgePreview()
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

/** Session ink store plus page-local layers (stamp, text, sticky, callout). */
export function createCompositeInkSessionSelectProxy<TDoc extends InkSessionDocument>(
  getStore: () => InkSessionStore<TDoc> | null,
  pageRefs: readonly PageAnnotationRef[],
): InkSessionSelectProxyHandle {
  const session = createInkSessionSelectProxy(getStore)

  const unionSelectedIds = (): string[] => {
    const ids = new Set(session.getSelectedIds())
    for (const ref of pageRefs) {
      for (const id of ref.current?.getSelectedIds?.() ?? []) {
        ids.add(id)
      }
    }
    return [...ids]
  }

  const forEachPage = (fn: (handle: BookPageAnnotationHandle) => void) => {
    for (const ref of pageRefs) {
      const handle = ref.current
      if (handle) fn(handle)
    }
  }

  return {
    ...session,
    getSelectedIds: unionSelectedIds,
    selectAll: () => {
      session.selectAll()
      forEachPage((h) => h.selectAll?.())
    },
    deselectAll: () => {
      session.deselectAll()
      forEachPage((h) => h.deselectAll?.())
    },
    deleteSelected: () => {
      let changed = session.deleteSelected()
      forEachPage((h) => {
        if (h.deleteSelected?.()) changed = true
      })
      return changed
    },
    moveSelectedBy: (dx, dy) => {
      let moved = session.moveSelectedBy(dx, dy)
      forEachPage((h) => {
        if (h.moveSelectedBy?.(dx, dy)) moved = true
      })
      return moved
    },
    setNudgePreview: (dx, dy) => {
      session.setNudgePreview(dx, dy)
      forEachPage((h) => h.setNudgePreview?.(dx, dy))
    },
    commitNudgePreview: () => {
      let committed = session.commitNudgePreview()
      forEachPage((h) => {
        if (h.commitNudgePreview?.()) committed = true
      })
      return committed
    },
    clearNudgePreview: () => {
      session.clearNudgePreview()
      forEachPage((h) => h.clearNudgePreview?.())
    },
  }
}
