import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type {
  InkEngineV2HistoryBatch,
  InkEngineV2HistoryEntry,
} from '@/lib/books/ink-engine-v2-contract'

/** Max undo steps retained; oldest dropped when exceeded (history only, not a paint cap). */
export const INK_SESSION_UNDO_MAX_ENTRIES = 200

export type InkSessionHistoryAppend = {
  type: 'append'
  commands: AnnotationCommand[]
}

export type InkSessionHistoryDelete = {
  type: 'delete'
  /** Removed commands with original indices in the scene before delete. */
  removed: ReadonlyArray<{ index: number; command: AnnotationCommand }>
}

export type InkSessionHistoryPatch = {
  type: 'patch'
  ids: string[]
  before: AnnotationCommand[]
  after: AnnotationCommand[]
}

export type InkSessionHistoryReorder = {
  type: 'reorder'
  beforeOrder: string[]
  afterOrder: string[]
}

export type InkSessionHistoryEntry =
  | InkSessionHistoryAppend
  | InkSessionHistoryDelete
  | InkSessionHistoryPatch
  | InkSessionHistoryReorder
  | InkSessionHistoryBatch

function commandsEqualAtIndices(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): boolean {
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i++) {
    if (prev[i]?.id !== next[i]?.id || prev[i] !== next[i]) return false
  }
  return true
}

function collectRemoved(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): InkSessionHistoryDelete['removed'] {
  const nextIds = new Set(next.map((c) => c.id))
  const removed: { index: number; command: AnnotationCommand }[] = []
  for (let i = 0; i < prev.length; i++) {
    const cmd = prev[i]!
    if (!nextIds.has(cmd.id)) removed.push({ index: i, command: cmd })
  }
  return removed
}

function collectAppended(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): AnnotationCommand[] {
  const prevIds = new Set(prev.map((c) => c.id))
  return next.filter((c) => !prevIds.has(c.id))
}

function collectPatch(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): InkSessionHistoryPatch | null {
  const prevById = new Map(prev.map((c) => [c.id, c]))
  const before: AnnotationCommand[] = []
  const after: AnnotationCommand[] = []
  const ids: string[] = []
  for (const n of next) {
    const p = prevById.get(n.id)
    if (p && p !== n) {
      before.push(p)
      after.push(n)
      ids.push(n.id)
    }
  }
  if (ids.length === 0) return null
  return { type: 'patch', ids, before, after }
}

function isPureDelete(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
  removed: InkSessionHistoryDelete['removed'],
): boolean {
  if (removed.length === 0) return false
  const nextIds = new Set(next.map((c) => c.id))
  for (const cmd of prev) {
    if (nextIds.has(cmd.id) && next.find((c) => c.id === cmd.id) !== cmd) return false
  }
  return removed.length === prev.length - next.length
}

function isPureAppendAtEnd(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
  appended: readonly AnnotationCommand[],
): boolean {
  if (appended.length === 0) return false
  if (next.length !== prev.length + appended.length) return false
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false
  }
  return next.slice(prev.length).every((c, i) => c === appended[i])
}

function isPureReorder(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): boolean {
  if (prev.length !== next.length) return false
  const prevIds = prev.map((c) => c.id).sort().join(',')
  const nextIds = next.map((c) => c.id).sort().join(',')
  if (prevIds !== nextIds) return false
  const prevRefs = new Map(prev.map((c) => [c.id, c]))
  for (const c of next) {
    if (prevRefs.get(c.id) !== c) return false
  }
  return !commandsEqualAtIndices(prev, next)
}

/**
 * Classify a scene mutation into a compact history entry for undo/redo.
 * Returns null when prev and next are equivalent.
 */
export function diffCommandsToHistoryEntry(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): InkSessionHistoryEntry | null {
  if (prev.length === next.length && prev.every((c, i) => c === next[i])) return null

  const removed = collectRemoved(prev, next)
  const appended = collectAppended(prev, next)

  if (next.length === 0 && removed.length > 0) {
    return { type: 'delete', removed: [...removed] }
  }

  if (prev.length === 0 && appended.length > 0) {
    return { type: 'append', commands: [...appended] }
  }

  if (isPureAppendAtEnd(prev, next, appended)) {
    return { type: 'append', commands: [...appended] }
  }

  if (isPureDelete(prev, next, removed)) {
    return { type: 'delete', removed: [...removed] }
  }

  if (isPureReorder(prev, next)) {
    return {
      type: 'reorder',
      beforeOrder: prev.map((c) => c.id),
      afterOrder: next.map((c) => c.id),
    }
  }

  const patch = collectPatch(prev, next)
  const entries: InkSessionHistoryEntry[] = []

  if (removed.length > 0) entries.push({ type: 'delete', removed: [...removed] })
  if (patch) entries.push(patch)
  if (appended.length > 0) entries.push({ type: 'append', commands: [...appended] })

  if (entries.length === 0) {
    const fallbackPatch = collectPatch(prev, next)
    if (fallbackPatch) return fallbackPatch
    return {
      type: 'batch',
      entries: [
        { type: 'delete', removed: prev.map((command, index) => ({ index, command })) },
        { type: 'append', commands: [...next] },
      ],
    }
  }

  if (entries.length === 1) return entries[0]!
  return { type: 'batch', entries }
}

/** Build one undo batch for pen commit + figure auto-group metadata patches. */
export function buildPenAutoGroupHistoryBatch(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
  newStrokeId: string,
): InkSessionHistoryEntry {
  const newCmd = next.find((c) => c.id === newStrokeId)
  if (!newCmd) {
    const fallback = diffCommandsToHistoryEntry(prev, next)
    if (!fallback) throw new Error('buildPenAutoGroupHistoryBatch: no scene change')
    return fallback
  }

  const entries: InkSessionHistoryEntry[] = [{ type: 'append', commands: [newCmd] }]

  const prevById = new Map(prev.map((c) => [c.id, c]))
  const before: AnnotationCommand[] = []
  const after: AnnotationCommand[] = []
  const ids: string[] = []
  for (const n of next) {
    if (n.id === newStrokeId) continue
    const p = prevById.get(n.id)
    if (p && p !== n) {
      before.push(p)
      after.push(n)
      ids.push(n.id)
    }
  }
  if (ids.length > 0) entries.push({ type: 'patch', ids, before, after })

  if (entries.length === 1) return entries[0]!
  return { type: 'batch', entries }
}

export function applyHistoryUndo(
  commands: readonly AnnotationCommand[],
  entry: InkSessionHistoryEntry,
): AnnotationCommand[] {
  switch (entry.type) {
    case 'append': {
      const drop = new Set(entry.commands.map((c) => c.id))
      return commands.filter((c) => !drop.has(c.id))
    }
    case 'delete': {
      let result = [...commands]
      for (const { index, command } of [...entry.removed].sort((a, b) => b.index - a.index)) {
        result.splice(index, 0, command)
      }
      return result
    }
    case 'patch': {
      const beforeById = new Map(entry.before.map((c) => [c.id, c]))
      return commands.map((c) => beforeById.get(c.id) ?? c)
    }
    case 'reorder': {
      const byId = new Map(commands.map((c) => [c.id, c]))
      return entry.beforeOrder.map((id) => byId.get(id)).filter((c): c is AnnotationCommand => c != null)
    }
    case 'batch': {
      let result = [...commands]
      for (let i = entry.entries.length - 1; i >= 0; i--) {
        result = applyHistoryUndo(result, entry.entries[i]!)
      }
      return result
    }
    default:
      return [...commands]
  }
}

export function applyHistoryRedo(
  commands: readonly AnnotationCommand[],
  entry: InkSessionHistoryEntry,
): AnnotationCommand[] {
  switch (entry.type) {
    case 'append':
      return [...commands, ...entry.commands]
    case 'delete': {
      let result = [...commands]
      for (const { command } of [...entry.removed].sort((a, b) => b.index - a.index)) {
        const idx = result.findIndex((c) => c.id === command.id)
        if (idx >= 0) result.splice(idx, 1)
      }
      return result
    }
    case 'patch': {
      const afterById = new Map(entry.after.map((c) => [c.id, c]))
      return commands.map((c) => afterById.get(c.id) ?? c)
    }
    case 'reorder': {
      const byId = new Map(commands.map((c) => [c.id, c]))
      return entry.afterOrder.map((id) => byId.get(id)).filter((c): c is AnnotationCommand => c != null)
    }
    case 'batch': {
      let result = [...commands]
      for (const sub of entry.entries) {
        result = applyHistoryRedo(result, sub)
      }
      return result
    }
    default:
      return [...commands]
  }
}

/** Structural size of undo payload (command copies stored), for perf regression tests. */
export function countHistoryPayloadCommands(entry: InkSessionHistoryEntry): number {
  switch (entry.type) {
    case 'append':
      return entry.commands.length
    case 'delete':
      return entry.removed.length
    case 'patch':
      return entry.before.length + entry.after.length
    case 'reorder':
      return entry.beforeOrder.length + entry.afterOrder.length
    case 'batch':
      return entry.entries.reduce((sum, e) => sum + countHistoryPayloadCommands(e), 0)
    default:
      return 0
  }
}

export function trimUndoStack<T>(stack: T[], maxEntries: number): void {
  if (stack.length <= maxEntries) return
  stack.splice(0, stack.length - maxEntries)
}

/** @deprecated Use InkSessionHistoryEntry */
export type InkEngineV2HistoryEntryAlias = InkEngineV2HistoryEntry
