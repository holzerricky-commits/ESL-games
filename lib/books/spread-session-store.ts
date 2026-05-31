import type { SpreadSessionCommand, SpreadSessionDocument, SpreadSessionKey } from '@/lib/books/spread-session-types'
import { loadSpreadSession, saveSpreadSessionCheckpoint, type SpreadSessionStorageAdapter } from '@/lib/books/spread-session-storage'
import { translateAnnotationCommands } from '@/lib/books/annotation-select'
import { duplicateCommandsForPaste, getAnnotationClipboard, setAnnotationClipboard } from '@/lib/books/annotation-clipboard'
import { assignFigureGroupId, clearFigureGroupId, newFigureGroupId, shouldToggleSelectionToUngroup } from '@/lib/books/annotation-figure-group'

type SpreadSessionState = {
  doc: SpreadSessionDocument
  canUndo: boolean
  canRedo: boolean
  selectedIds: string[]
}

type Listener = (state: SpreadSessionState) => void

export type SpreadSessionStore = {
  getState: () => SpreadSessionState
  subscribe: (listener: Listener) => () => void
  setCommands: (commands: SpreadSessionCommand[]) => void
  patchCommands: (updater: (commands: SpreadSessionCommand[]) => SpreadSessionCommand[]) => void
  setSelectedIds: (ids: string[]) => void
  selectAll: () => void
  deleteSelected: () => boolean
  moveSelectedBy: (dx: number, dy: number) => boolean
  copySelected: () => boolean
  pasteFromClipboard: () => boolean
  duplicateSelected: () => boolean
  toggleGroupSelected: () => boolean
  removeFromGroupSelected: () => boolean
  selectNextInStack: (direction: 1 | -1) => boolean
  undo: () => boolean
  redo: () => boolean
  checkpointNow: () => void
  markClean: () => void
  destroy: () => void
}

export type CreateSpreadSessionStoreOptions = {
  storage?: SpreadSessionStorageAdapter
  autosaveMs?: number
  now?: () => number
}

export function createSpreadSessionStore(
  key: SpreadSessionKey,
  options: CreateSpreadSessionStoreOptions = {},
): SpreadSessionStore {
  const storage = options.storage
  const autosaveMs = Math.max(250, options.autosaveMs ?? 3000)
  const now = options.now ?? (() => Date.now())
  const listeners = new Set<Listener>()
  const undoStack: SpreadSessionCommand[][] = []
  const redoStack: SpreadSessionCommand[][] = []
  let selectedIds: string[] = []
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  let doc = loadSpreadSession(key, storage)

  function emit(): void {
    const state = getState()
    for (const listener of listeners) listener(state)
  }

  function getState(): SpreadSessionState {
    return {
      doc,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      selectedIds,
    }
  }

  function scheduleAutosave(): void {
    if (destroyed) return
    if (autosaveTimer) return
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null
      saveSpreadSessionCheckpoint(doc, storage)
    }, autosaveMs)
  }

  function applyCommands(nextCommands: SpreadSessionCommand[]): void {
    const next = [...nextCommands]
    const prev = doc.commands
    if (prev.length === next.length && prev.every((c, i) => c === next[i])) return
    undoStack.push(prev)
    redoStack.length = 0
    doc = {
      ...doc,
      commands: next,
      meta: {
        ...doc.meta,
        revision: doc.meta.revision + 1,
        dirty: true,
        updatedAt: now(),
      },
    }
    scheduleAutosave()
    emit()
  }

  function restore(commands: SpreadSessionCommand[], dirty: boolean): void {
    doc = {
      ...doc,
      commands: [...commands],
      meta: {
        ...doc.meta,
        revision: doc.meta.revision + 1,
        dirty,
        updatedAt: now(),
      },
    }
    if (dirty) scheduleAutosave()
    emit()
  }

  return {
    getState,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setCommands: (commands) => applyCommands(commands),
    patchCommands: (updater) => applyCommands(updater([...doc.commands])),
    setSelectedIds: (ids) => {
      const live = new Set(doc.commands.map((c) => c.id))
      selectedIds = [...new Set(ids)].filter((id) => live.has(id))
      emit()
    },
    selectAll: () => {
      selectedIds = [...new Set(doc.commands.map((c) => c.id))]
      emit()
    },
    deleteSelected: () => {
      if (selectedIds.length === 0) return false
      const picked = new Set(selectedIds)
      applyCommands(doc.commands.filter((c) => !picked.has(c.id)))
      selectedIds = []
      emit()
      return true
    },
    moveSelectedBy: (dx, dy) => {
      if (dx === 0 && dy === 0) return false
      if (selectedIds.length === 0) return false
      const picked = new Set(selectedIds)
      applyCommands(translateAnnotationCommands(doc.commands, picked, dx, dy))
      return true
    },
    copySelected: () => {
      if (selectedIds.length === 0) return false
      const picked = new Set(selectedIds)
      const source = doc.commands.filter((c) => picked.has(c.id))
      if (source.length === 0) return false
      setAnnotationClipboard(source)
      return true
    },
    pasteFromClipboard: () => {
      const source = getAnnotationClipboard()
      if (source.length === 0) return false
      const pasted = duplicateCommandsForPaste(source)
      applyCommands([...doc.commands, ...pasted])
      selectedIds = pasted.map((c) => c.id)
      emit()
      return true
    },
    duplicateSelected: () => {
      if (selectedIds.length === 0) return false
      const picked = new Set(selectedIds)
      const source = doc.commands.filter((c) => picked.has(c.id))
      if (source.length === 0) return false
      const dupes = duplicateCommandsForPaste(source)
      applyCommands([...doc.commands, ...dupes])
      selectedIds = dupes.map((c) => c.id)
      emit()
      return true
    },
    toggleGroupSelected: () => {
      if (selectedIds.length === 0) return false
      if (shouldToggleSelectionToUngroup(doc.commands, selectedIds)) {
        const { commands: next, affectedIds } = clearFigureGroupId(doc.commands, new Set(selectedIds))
        if (affectedIds.length === 0) return false
        applyCommands(next)
        selectedIds = affectedIds
        emit()
        return true
      }
      const groupId = newFigureGroupId()
      const { commands: next, affectedIds } = assignFigureGroupId(doc.commands, new Set(selectedIds), groupId)
      if (affectedIds.length === 0) return false
      applyCommands(next)
      selectedIds = affectedIds
      emit()
      return true
    },
    removeFromGroupSelected: () => {
      if (selectedIds.length === 0) return false
      const { commands: next, affectedIds } = clearFigureGroupId(doc.commands, new Set(selectedIds))
      if (affectedIds.length === 0) return false
      applyCommands(next)
      selectedIds = affectedIds
      emit()
      return true
    },
    selectNextInStack: (direction) => {
      if (doc.commands.length === 0) return false
      const idsInStack = doc.commands.map((c) => c.id)
      const current = selectedIds.find((id) => idsInStack.includes(id))
      const currentIndex = current ? idsInStack.indexOf(current) : -1
      const nextIndex =
        currentIndex < 0
          ? direction === -1
            ? idsInStack.length - 1
            : 0
          : (currentIndex + direction + idsInStack.length) % idsInStack.length
      selectedIds = [idsInStack[nextIndex]!]
      emit()
      return true
    },
    undo: () => {
      const prev = undoStack.pop()
      if (!prev) return false
      redoStack.push(doc.commands)
      restore(prev, true)
      return true
    },
    redo: () => {
      const next = redoStack.pop()
      if (!next) return false
      undoStack.push(doc.commands)
      restore(next, true)
      return true
    },
    checkpointNow: () => {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      saveSpreadSessionCheckpoint(doc, storage)
    },
    markClean: () => {
      doc = {
        ...doc,
        meta: {
          ...doc.meta,
          dirty: false,
          updatedAt: now(),
        },
      }
      emit()
    },
    destroy: () => {
      destroyed = true
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      listeners.clear()
    },
  }
}
