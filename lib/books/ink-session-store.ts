import type { InkSessionCommand, InkSessionDocument } from '@/lib/books/ink-session-types'

import {
  applyEraserLineCommit,
  compactLegacyEraserLineScene,
  computeEraserLineDeadIndices,
  sceneNeedsEraserLineCompaction,
} from '@/lib/books/annotation-geometry'

import { selectNextStackId } from '@/lib/books/annotation-selection-ops'

import { alignSelectedCommands, type HorizontalAlignAxis } from '@/lib/books/annotation-align'

import { translateAnnotationCommands, filterUnlockedTransformIds, selectAllCommandIds } from '@/lib/books/annotation-select'

import { moveCommandsInStack } from '@/lib/books/annotation-layer-order'

import {

  clampSelectionMoveDelta,

  type SelectionMoveClampContext,

} from '@/lib/books/annotation-scale'

import { duplicateCommandsForPaste, getAnnotationClipboard, setAnnotationClipboard } from '@/lib/books/annotation-clipboard'

import { getBoardPasteAnchorNorm, pasteOffsetForAnchor } from '@/lib/books/board-paste-placement'

import { registerPasteRevealIds } from '@/lib/books/board-paste-reveal'

import { assignFigureGroupId, clearFigureGroupId, newFigureGroupId, shouldToggleSelectionToUngroup } from '@/lib/books/annotation-figure-group'

import { appendCommandWithPenAutoGroup } from '@/lib/books/annotation-pen-auto-group'

import {

  applyHistoryRedo,

  applyHistoryUndo,

  buildPenAutoGroupHistoryBatch,

  countHistoryPayloadCommands,

  diffCommandsToHistoryEntry,

  INK_SESSION_UNDO_MAX_ENTRIES,

  trimUndoStack,

  type InkSessionHistoryEntry,

} from '@/lib/books/ink-session-history'

import {
  createInkSessionPersistV2Writer,
  markInkSessionDrawingHot,
  resolveInkSessionAutosaveMs,
} from '@/lib/books/ink-session-persist-v2'
import { notifyReaderPrefetchInkRevisionHot } from '@/lib/books/reader-prefetch-ink-coordinator'



export type InkSessionNudgePreview = { dx: number; dy: number }



export type AppendPenWithAutoGroupOptions = {

  penAutoGroupConnected: boolean

  widthPx: number

  heightPx: number

  skipIndices?: ReadonlySet<number>

  nowMs?: number

}



export type InkSessionState<TDoc extends InkSessionDocument = InkSessionDocument> = {

  doc: TDoc

  canUndo: boolean

  canRedo: boolean

  selectedIds: string[]

  /** Live keyboard nudge offset (not committed until `commitNudgePreview`). */

  nudgePreview: InkSessionNudgePreview | null

}



type Listener<TDoc extends InkSessionDocument> = (state: InkSessionState<TDoc>) => void



export type InkSessionStore<TDoc extends InkSessionDocument = InkSessionDocument> = {

  getState: () => InkSessionState<TDoc>

  subscribe: (listener: Listener<TDoc>) => () => void

  setCommands: (commands: InkSessionCommand[]) => void

  appendCommand: (cmd: InkSessionCommand) => void

  /** Pen lift with optional connect-strokes auto-group — one batch undo entry. */

  appendPenWithAutoGroup: (cmd: InkSessionCommand, options: AppendPenWithAutoGroupOptions) => void

  /** Line eraser commit — removes hit commands; does not store eraser-line stroke. */

  commitEraserLine: (points: readonly [number, number][], widthScale?: number) => boolean

  syncCommands: (commands: InkSessionCommand[]) => void

  patchCommands: (updater: (commands: InkSessionCommand[]) => InkSessionCommand[]) => void

  clearCommands: () => void

  setSelectedIds: (ids: string[]) => void

  selectAll: () => void

  selectAllIncludingLocked: () => void

  deleteSelected: () => boolean

  moveSelectedBy: (dx: number, dy: number) => boolean

  alignSelected: (axis: HorizontalAlignAxis) => boolean

  setNudgePreview: (dx: number, dy: number) => void

  commitNudgePreview: () => boolean

  clearNudgePreview: () => void

  copySelected: () => boolean

  pasteFromClipboard: () => boolean

  duplicateSelected: () => boolean

  moveSelectedForward: () => boolean

  moveSelectedBackward: () => boolean

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

  /** Sum of command copies held in undo entries (diagnostics / perf tests). */

  undoPayloadCommandCount: () => number

}



export type CreateInkSessionStoreOptions<TDoc extends InkSessionDocument = InkSessionDocument> = {

  loadInitialDoc: () => TDoc

  saveCheckpoint: (doc: TDoc) => void

  autosaveMs?: number

  /** When false, no debounced save and no checkpoint on destroy (Phase 1 whiteboard dev). */

  persistEnabled?: boolean

  now?: () => number

  /** Page/board size for keeping moved ink partially on-canvas. */

  getSelectionMoveClamp?: () => SelectionMoveClampContext | null

}



export function createInkSessionStore<TDoc extends InkSessionDocument>(

  options: CreateInkSessionStoreOptions<TDoc>,

): InkSessionStore<TDoc> {

  const persistEnabled = options.persistEnabled !== false

  const autosaveMs = persistEnabled ? Math.max(250, options.autosaveMs ?? 3000) : Number.MAX_SAFE_INTEGER

  const now = options.now ?? (() => Date.now())

  const listeners = new Set<Listener<TDoc>>()

  const undoStack: InkSessionHistoryEntry[] = []

  const redoStack: InkSessionHistoryEntry[] = []

  let selectedIds: string[] = []

  let nudgePreviewDx = 0

  let nudgePreviewDy = 0

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null

  const persistWriter = createInkSessionPersistV2Writer()

  let destroyed = false



  let doc = options.loadInitialDoc()

  if (sceneNeedsEraserLineCompaction(doc.commands)) {
    doc = { ...doc, commands: compactLegacyEraserLineScene(doc.commands) }
  }



  function clampMoveDelta(dx: number, dy: number): { dx: number; dy: number } {

    if (dx === 0 && dy === 0 || selectedIds.length === 0) return { dx, dy }

    const ctx = options.getSelectionMoveClamp?.()

    if (!ctx || !(ctx.widthPx > 0) || !(ctx.heightPx > 0)) return { dx, dy }

    return clampSelectionMoveDelta(

      doc.commands,

      selectedIds,

      dx,

      dy,

      ctx.widthPx,

      ctx.heightPx,

      { canvas: ctx.canvas, deadIndices: ctx.deadIndices },

    )

  }



  function emit(): void {

    const state = getState()

    for (const listener of listeners) listener(state)

  }



  function clearNudgePreviewInternal(): void {

    nudgePreviewDx = 0

    nudgePreviewDy = 0

  }



  function getState(): InkSessionState<TDoc> {

    return {

      doc,

      canUndo: undoStack.length > 0,

      canRedo: redoStack.length > 0,

      selectedIds,

      nudgePreview:

        nudgePreviewDx === 0 && nudgePreviewDy === 0

          ? null

          : { dx: nudgePreviewDx, dy: nudgePreviewDy },

    }

  }



  function runCheckpointWrite(): void {
    if (destroyed || !doc.meta.dirty) return
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

  function writeCheckpoint(mode: 'sync' | 'idle' = 'sync'): void {
    if (!persistEnabled) return
    if (mode === 'idle') {
      persistWriter.queueAutosaveCheckpoint(runCheckpointWrite)
      return
    }
    persistWriter.flushSync(runCheckpointWrite)
  }

  function scheduleAutosave(): void {
    if (!persistEnabled || destroyed) return
    if (autosaveTimer) clearTimeout(autosaveTimer)
    const delay = resolveInkSessionAutosaveMs(autosaveMs)
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null
      if (destroyed || !doc.meta.dirty) return
      writeCheckpoint('idle')
      emit()
    }, delay)
  }



  function pushUndo(entry: InkSessionHistoryEntry): void {

    undoStack.push(entry)

    trimUndoStack(undoStack, INK_SESSION_UNDO_MAX_ENTRIES)

    redoStack.length = 0

  }



  function bumpCommands(nextCommands: readonly InkSessionCommand[]): void {

    doc = {

      ...doc,

      commands: [...nextCommands],

      meta: {

        ...doc.meta,

        revision: doc.meta.revision + 1,

        dirty: true,

        updatedAt: now(),

      },

    }

    markInkSessionDrawingHot()
    notifyReaderPrefetchInkRevisionHot()

    scheduleAutosave()

    emit()

  }



  function commitCommands(

    nextCommands: InkSessionCommand[],

    historyEntry: InkSessionHistoryEntry | null,

  ): void {

    const prev = doc.commands

    if (prev.length === nextCommands.length && prev.every((c, i) => c === nextCommands[i])) return

    const entry = historyEntry ?? diffCommandsToHistoryEntry(prev, nextCommands)

    if (entry) pushUndo(entry)

    bumpCommands(nextCommands)

  }



  function replaceCommands(nextCommands: InkSessionCommand[], recordUndo: boolean): void {

    const next = [...nextCommands]

    const prev = doc.commands

    if (prev.length === next.length && prev.every((c, i) => c === next[i])) return

    if (recordUndo) {

      const entry = diffCommandsToHistoryEntry(prev, next)

      if (entry) pushUndo(entry)

    }

    bumpCommands(next)

  }



  function applyCommands(nextCommands: InkSessionCommand[]): void {

    replaceCommands(nextCommands, true)

  }



  function resolvePasteDuplicateOffset(source: readonly InkSessionCommand[]): [number, number] {

    const anchor = getBoardPasteAnchorNorm()

    if (!anchor) return [0.02, 0.02]

    const ctx = options.getSelectionMoveClamp?.()

    if (!ctx || !(ctx.widthPx > 0) || !(ctx.heightPx > 0)) return [0.02, 0.02]

    return pasteOffsetForAnchor(source, anchor, ctx.widthPx, ctx.heightPx)

  }



  return {

    getState,

    subscribe: (listener) => {

      listeners.add(listener)

      return () => listeners.delete(listener)

    },

    setCommands: (commands) => applyCommands(commands),

    appendCommand: (cmd) => {

      if (cmd.kind === 'stroke' && cmd.tool === 'eraser-line') {
        if (cmd.points.length < 2) return
        const { nextCommands, removed } = applyEraserLineCommit(doc.commands, cmd.points, cmd.widthScale)
        if (removed.length === 0) return
        commitCommands(nextCommands, { type: 'delete', removed })
        const removedIds = new Set(removed.map((r) => r.command.id))
        selectedIds = selectedIds.filter((id) => !removedIds.has(id))
        emit()
        return
      }

      pushUndo({ type: 'append', commands: [cmd] })

      bumpCommands([...doc.commands, cmd])

    },

    commitEraserLine: (points, widthScale) => {

      if (points.length < 2) return false

      const { nextCommands, removed } = applyEraserLineCommit(doc.commands, points, widthScale)

      if (removed.length === 0) return false

      commitCommands(nextCommands, { type: 'delete', removed })

      const removedIds = new Set(removed.map((r) => r.command.id))

      selectedIds = selectedIds.filter((id) => !removedIds.has(id))

      emit()

      return true

    },

    appendPenWithAutoGroup: (cmd, opts) => {

      const prev = doc.commands

      const next = appendCommandWithPenAutoGroup(prev, cmd, opts)

      const entry =

        opts.penAutoGroupConnected && cmd.kind === 'stroke' && cmd.tool === 'pen'

          ? buildPenAutoGroupHistoryBatch(prev, next, cmd.id)

          : diffCommandsToHistoryEntry(prev, next)

      commitCommands(next, entry)

    },

    syncCommands: (commands) => replaceCommands(commands, false),

    patchCommands: (updater) => applyCommands(updater([...doc.commands])),

    clearCommands: () => {

      if (doc.commands.length === 0) return

      const removed = doc.commands.map((command, index) => ({ index, command }))

      pushUndo({ type: 'delete', removed })

      bumpCommands([])

    },

    setSelectedIds: (ids) => {

      const live = new Set(doc.commands.map((c) => c.id))

      selectedIds = [...new Set(ids)].filter((id) => live.has(id))

      emit()

    },

    selectAll: () => {

      selectedIds = selectAllCommandIds(doc.commands, false)

      emit()

    },

    selectAllIncludingLocked: () => {

      selectedIds = selectAllCommandIds(doc.commands, true)

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

      const transformable = filterUnlockedTransformIds(doc.commands, selectedIds)

      if (transformable.length === 0) return false

      clearNudgePreviewInternal()

      const clamped = clampMoveDelta(dx, dy)

      if (clamped.dx === 0 && clamped.dy === 0) return false

      const picked = new Set(transformable)

      applyCommands(translateAnnotationCommands(doc.commands, picked, clamped.dx, clamped.dy))

      return true

    },

    alignSelected: (axis) => {

      if (selectedIds.length < 2) return false

      const ctx = options.getSelectionMoveClamp?.()

      if (!ctx || !(ctx.widthPx > 0) || !(ctx.heightPx > 0)) return false

      clearNudgePreviewInternal()

      const next = alignSelectedCommands(

        doc.commands,

        selectedIds,

        axis,

        ctx.widthPx,

        ctx.heightPx,

      )

      if (next === doc.commands) return false

      applyCommands(next)

      return true

    },

    setNudgePreview: (dx, dy) => {

      const clamped = clampMoveDelta(dx, dy)

      nudgePreviewDx = clamped.dx

      nudgePreviewDy = clamped.dy

      emit()

    },

    commitNudgePreview: () => {

      if (nudgePreviewDx === 0 && nudgePreviewDy === 0) return false

      const dx = nudgePreviewDx

      const dy = nudgePreviewDy

      clearNudgePreviewInternal()

      if (selectedIds.length === 0) {

        emit()

        return false

      }

      const transformable = filterUnlockedTransformIds(doc.commands, selectedIds)

      if (transformable.length === 0) {

        emit()

        return false

      }

      const picked = new Set(transformable)

      applyCommands(translateAnnotationCommands(doc.commands, picked, dx, dy))

      return true

    },

    clearNudgePreview: () => {

      if (nudgePreviewDx === 0 && nudgePreviewDy === 0) return

      clearNudgePreviewInternal()

      emit()

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

      const pasted = duplicateCommandsForPaste(source, resolvePasteDuplicateOffset(source))

      applyCommands([...doc.commands, ...pasted])

      selectedIds = pasted.map((c) => c.id)

      registerPasteRevealIds(selectedIds)

      emit()

      return true

    },

    duplicateSelected: () => {

      if (selectedIds.length === 0) return false

      const picked = new Set(selectedIds)

      const source = doc.commands.filter((c) => picked.has(c.id))

      if (source.length === 0) return false

      const dupes = duplicateCommandsForPaste(source, resolvePasteDuplicateOffset(source))

      applyCommands([...doc.commands, ...dupes])

      selectedIds = dupes.map((c) => c.id)

      emit()

      return true

    },

    moveSelectedForward: () => {

      if (selectedIds.length === 0) return false

      const next = moveCommandsInStack(doc.commands, selectedIds, 1)

      const unchanged =

        next.length === doc.commands.length &&

        next.every((c, i) => c.id === doc.commands[i]!.id)

      if (unchanged) return false

      applyCommands(next)

      return true

    },

    moveSelectedBackward: () => {

      if (selectedIds.length === 0) return false

      const next = moveCommandsInStack(doc.commands, selectedIds, -1)

      const unchanged =

        next.length === doc.commands.length &&

        next.every((c, i) => c.id === doc.commands[i]!.id)

      if (unchanged) return false

      applyCommands(next)

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

      redoStack.push(entry)

      trimUndoStack(redoStack, INK_SESSION_UNDO_MAX_ENTRIES)

      const nextCommands = applyHistoryUndo(doc.commands, entry)

      bumpCommands(nextCommands)

      return true

    },

    redo: () => {

      const entry = redoStack.pop()

      if (!entry) return false

      undoStack.push(entry)

      trimUndoStack(undoStack, INK_SESSION_UNDO_MAX_ENTRIES)

      const nextCommands = applyHistoryRedo(doc.commands, entry)

      bumpCommands(nextCommands)

      return true

    },

    checkpointNow: () => {

      if (autosaveTimer) {

        clearTimeout(autosaveTimer)

        autosaveTimer = null

      }

      writeCheckpoint('sync')

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

        writeCheckpoint('sync')

      }

      persistWriter.cancelPending()

      listeners.clear()

    },

    undoPayloadCommandCount: () =>

      undoStack.reduce((sum, entry) => sum + countHistoryPayloadCommands(entry), 0),

  }

}


