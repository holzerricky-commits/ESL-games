import type { InkSessionCommand, InkSessionDocument } from '@/lib/books/ink-session-types'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import { selectNextStackId } from '@/lib/books/annotation-selection-ops'
import { translateAnnotationCommands } from '@/lib/books/annotation-select'
import { duplicateCommandsForPaste, getAnnotationClipboard, setAnnotationClipboard } from '@/lib/books/annotation-clipboard'
import { assignFigureGroupId, clearFigureGroupId, newFigureGroupId, shouldToggleSelectionToUngroup } from '@/lib/books/annotation-figure-group'

type InkSessionState<TDoc extends InkSessionDocument> = {
  doc: TDoc
  canUndo: boolean
  canRedo: boolean
  selectedIds: string[]
}

type Listener<TDoc extends InkSessionDocument> = (state: InkSessionState<TDoc>) => void

type InkSessionUndoEntry =
  | { type: 'append'; cmd: InkSessionCommand }
  | { type: 'snapshot'; commands: InkSessionCommand[] }

type InkSessionRedoEntry = InkSessionUndoEntry

export type InkSessionStore<TDoc extends InkSessionDocument = InkSessionDocument> = {
  getState: () => InkSessionState<TDoc>
  subscribe: (listener: Listener<TDoc>) => () => void
  setCommands: (commands: InkSessionCommand[]) => void
  appendCommand: (cmd: InkSessionCommand) => void
  syncCommands: (commands: InkSessionCommand[]) => void
  patchCommands: (updater: (commands: InkSessionCommand[]) => InkSessionCommand[]) => void
  clearCommands: () => void
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
  /** Replace the full document (e.g. lesson-board page switch). Does not record undo. */
  replaceDoc: (doc: TDoc) => void
  destroy: () => void
}

export type CreateInkSessionStoreOptions<TDoc extends InkSessionDocument = InkSessionDocument> = {
  loadInitialDoc: () => TDoc
  saveCheckpoint: (doc: TDoc) => void
  autosaveMs?: number
  /** When false, no debounced save and no checkpoint on destroy (Phase 1 whiteboard dev). */
  persistEnabled?: boolean
  now?: () => number
}

export function createInkSessionStore<TDoc extends InkSessionDocument>(
  options: CreateInkSessionStoreOptions<TDoc>,
): InkSessionStore<TDoc> {
  const persistEnabled = options.persistEnabled !== false
  const autosaveMs = persistEnabled ? Math.max(250, options.autosaveMs ?? 3000) : Number.MAX_SAFE_INTEGER
  const now = options.now ?? (() => Date.now())
  const listeners = new Set<Listener<TDoc>>()
  const undoStack: InkSessionUndoEntry[] = []
  const redoStack: InkSessionRedoEntry[] = []
  let selectedIds: string[] = []
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  let doc = options.loadInitialDoc()

  function emit(): void {
    const state = getState()
    for (const listener of listeners) listener(state)
  }

  function getState(): InkSessionState<TDoc> {
    return {
      doc,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      selectedIds,
    }
  }

  function writeCheckpoint(): void {
    if (!persistEnabled) return
    options.saveCheckpoint(doc)
    doc = {
      ...doc,
      meta: {
        ...doc.meta,
        dirty: false,
        updatedAt: now(),
      },
    }
  }

  function scheduleAutosave(): void {
    if (!persistEnabled || destroyed) return
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null
      if (destroyed || !doc.meta.dirty) return
      writeCheckpoint()
      emit()
    }, autosaveMs)
  }

  function pushSnapshotUndo(): void {
    undoStack.push({ type: 'snapshot', commands: [...doc.commands] })
    redoStack.length = 0
  }

  function replaceCommands(nextCommands: InkSessionCommand[], recordUndo: boolean): void {
    const next = [...nextCommands]
    const prev = doc.commands
    if (prev.length === next.length && prev.every((c, i) => c === next[i])) return
    if (recordUndo) {
      pushSnapshotUndo()
    }
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

  function applyCommands(nextCommands: InkSessionCommand[]): void {
    replaceCommands(nextCommands, true)
  }

  function restore(commands: InkSessionCommand[], dirty: boolean): void {
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
    appendCommand: (cmd) => {
      undoStack.push({ type: 'append', cmd })
      redoStack.length = 0
      doc = {
        ...doc,
        commands: [...doc.commands, cmd],
        meta: {
          ...doc.meta,
          revision: doc.meta.revision + 1,
          dirty: true,
          updatedAt: now(),
        },
      }
      scheduleAutosave()
      emit()
    },
    syncCommands: (commands) => replaceCommands(commands, false),
    patchCommands: (updater) => applyCommands(updater([...doc.commands])),
    clearCommands: () => {
      if (doc.commands.length === 0) return
      pushSnapshotUndo()
      replaceCommands([], false)
    },
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
      const dead = computeEraserLineDeadIndices(doc.commands)
      const nextId = selectNextStackId(doc.commands, selectedIds, direction, dead)
      if (!nextId) return false
      selectedIds = [nextId]
      emit()
      return true
    },
    undo: () => {
      const entry = undoStack.pop()
      if (!entry) return false
      if (entry.type === 'append') {
        redoStack.push(entry)
        const nextCommands = doc.commands.filter((c) => c.id !== entry.cmd.id)
        doc = {
          ...doc,
          commands: nextCommands,
          meta: {
            ...doc.meta,
            revision: doc.meta.revision + 1,
            dirty: true,
            updatedAt: now(),
          },
        }
        scheduleAutosave()
        emit()
        return true
      }
      redoStack.push({ type: 'snapshot', commands: [...doc.commands] })
      restore(entry.commands, true)
      return true
    },
    redo: () => {
      const entry = redoStack.pop()
      if (!entry) return false
      if (entry.type === 'append') {
        undoStack.push(entry)
        doc = {
          ...doc,
          commands: [...doc.commands, entry.cmd],
          meta: {
            ...doc.meta,
            revision: doc.meta.revision + 1,
            dirty: true,
            updatedAt: now(),
          },
        }
        scheduleAutosave()
        emit()
        return true
      }
      undoStack.push({ type: 'snapshot', commands: [...doc.commands] })
      restore(entry.commands, true)
      return true
    },
    checkpointNow: () => {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      writeCheckpoint()
      emit()
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
    replaceDoc: (nextDoc) => {
      doc = {
        ...nextDoc,
        meta: {
          ...nextDoc.meta,
          revision: nextDoc.meta.revision + 1,
          dirty: true,
          updatedAt: now(),
        },
      }
      selectedIds = selectedIds.filter((id) => doc.commands.some((c) => c.id === id))
      scheduleAutosave()
      emit()
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      if (persistEnabled && doc.meta.dirty) {
        writeCheckpoint()
      }
      listeners.clear()
    },
  }
}
