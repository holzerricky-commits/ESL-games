import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemorySpreadSessionStorage, loadSpreadSession } from '@/lib/books/spread-session-storage'
import { createSpreadSessionStore } from '@/lib/books/spread-session-store'
import type { SpreadSessionKey } from '@/lib/books/spread-session-types'
import { getAnnotationClipboard, setAnnotationClipboard } from '@/lib/books/annotation-clipboard'

const key: SpreadSessionKey = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
  leftPage: 4,
  rightPage: 5,
}

describe('spread-session-store', () => {
  it('debounced autosave resets on each append', () => {
    vi.useFakeTimers()
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 3000 })
    store.appendCommand({
      kind: 'line',
      id: 'l1',
      a: [0.1, 0.1],
      b: [0.2, 0.2],
      color: '#111827',
    })
    vi.advanceTimersByTime(2000)
    store.appendCommand({
      kind: 'line',
      id: 'l2',
      a: [0.3, 0.3],
      b: [0.4, 0.4],
      color: '#111827',
    })
    vi.advanceTimersByTime(2000)
    expect(loadSpreadSession(key, storage).commands).toHaveLength(0)
    vi.advanceTimersByTime(1000)
    expect(loadSpreadSession(key, storage).commands).toHaveLength(2)
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('appendCommand extends list and undo removes only that command', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    const line1 = { kind: 'line' as const, id: 'l1', a: [0.1, 0.1] as [number, number], b: [0.2, 0.2] as [number, number], color: '#111827' }
    const line2 = { kind: 'line' as const, id: 'l2', a: [0.3, 0.3] as [number, number], b: [0.4, 0.4] as [number, number], color: '#111827' }
    store.appendCommand(line1)
    store.appendCommand(line2)
    expect(store.getState().doc.commands).toHaveLength(2)
    expect(store.getState().canUndo).toBe(true)
    store.undo()
    expect(store.getState().doc.commands).toEqual([line1])
    expect(store.redo()).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(2)
  })

  it('syncCommands updates doc without undo history', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([{ kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.5, 0.5], color: '#111827' }])
    store.syncCommands([
      { kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.5, 0.5], color: '#111827' },
      { kind: 'line', id: 'l2', a: [0.2, 0.2], b: [0.6, 0.6], color: '#111827' },
    ])
    expect(store.getState().doc.commands).toHaveLength(2)
    expect(store.getState().canUndo).toBe(true)
    store.undo()
    expect(store.getState().doc.commands).toHaveLength(0)
  })

  it('setCommands updates revision and undo stack', () => {
    const storage = createMemorySpreadSessionStorage()
    let t = 1_700_000_000_000
    const store = createSpreadSessionStore(key, {
      storage,
      now: () => ++t,
      autosaveMs: 60_000,
    })
    store.setCommands([{ kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.5, 0.5], color: '#111827' }])
    expect(store.getState().doc.meta.revision).toBe(1)
    expect(store.getState().canUndo).toBe(true)
    expect(store.undo()).toBe(true)
    expect(store.getState().doc.commands).toEqual([])
  })

  it('redo restores commands', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([{ kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' }])
    store.undo()
    expect(store.redo()).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(1)
  })

  it('checkpointNow writes to storage immediately', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([{ kind: 'line', id: 'l2', a: [0, 0], b: [1, 1], color: '#111827' }])
    store.checkpointNow()
    const loaded = loadSpreadSession(key, storage)
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.commands[0]?.id).toBe('l2')
  })

  it('selectAll + deleteSelected mutates session commands', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' },
      { kind: 'line', id: 'l2', a: [0.3, 0.3], b: [0.4, 0.4], color: '#111827' },
    ])
    store.selectAll()
    expect(store.getState().selectedIds).toEqual(['l1', 'l2'])
    expect(store.deleteSelected()).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(0)
  })

  it('moveSelectedBy translates selected command geometry', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' },
      { kind: 'line', id: 'l2', a: [0.5, 0.5], b: [0.6, 0.6], color: '#111827' },
    ])
    store.setSelectedIds(['l2'])
    expect(store.moveSelectedBy(0.1, -0.1)).toBe(true)
    const moved = store.getState().doc.commands.find((c) => c.id === 'l2')
    if (moved?.kind === 'line') {
      expect(moved.a[0]).toBeCloseTo(0.6, 6)
      expect(moved.a[1]).toBeCloseTo(0.4, 6)
    }
    const untouched = store.getState().doc.commands.find((c) => c.id === 'l1')
    if (untouched?.kind === 'line') {
      expect(untouched.a[0]).toBeCloseTo(0.1, 6)
      expect(untouched.a[1]).toBeCloseTo(0.1, 6)
    }
  })

  it('duplicateSelected clones selected commands and selects duplicates', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' },
    ])
    store.setSelectedIds(['l1'])
    expect(store.duplicateSelected()).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(2)
    const ids = store.getState().doc.commands.map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
    expect(store.getState().selectedIds).toHaveLength(1)
    expect(store.getState().selectedIds[0]).not.toBe('l1')
  })

  it('copySelected writes selected commands to clipboard', () => {
    setAnnotationClipboard([])
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' },
      { kind: 'line', id: 'l2', a: [0.3, 0.3], b: [0.4, 0.4], color: '#111827' },
    ])
    store.setSelectedIds(['l2'])
    expect(store.copySelected()).toBe(true)
    expect(getAnnotationClipboard()).toHaveLength(1)
    expect(getAnnotationClipboard()[0]?.id).toBe('l2')
  })

  it('pasteFromClipboard appends duplicated commands and selects them', () => {
    setAnnotationClipboard([
      { kind: 'line', id: 'clip-1', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' },
    ])
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'line', id: 'l1', a: [0.5, 0.5], b: [0.6, 0.6], color: '#111827' },
    ])
    expect(store.pasteFromClipboard()).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(2)
    expect(store.getState().selectedIds).toHaveLength(1)
    expect(store.getState().selectedIds[0]).not.toBe('clip-1')
  })

  it('selectNextInStack cycles selection forward and backward', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' },
      { kind: 'line', id: 'l2', a: [0.3, 0.3], b: [0.4, 0.4], color: '#111827' },
      { kind: 'line', id: 'l3', a: [0.5, 0.5], b: [0.6, 0.6], color: '#111827' },
    ])
    expect(store.selectNextInStack(1)).toBe(true)
    expect(store.getState().selectedIds).toEqual(['l1'])
    expect(store.selectNextInStack(1)).toBe(true)
    expect(store.getState().selectedIds).toEqual(['l2'])
    expect(store.selectNextInStack(-1)).toBe(true)
    expect(store.getState().selectedIds).toEqual(['l1'])
    expect(store.selectNextInStack(-1)).toBe(true)
    expect(store.getState().selectedIds).toEqual(['l3'])
  })

  it('selectNextInStack returns false when no commands exist', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    expect(store.selectNextInStack(1)).toBe(false)
  })

  it('toggleGroupSelected groups selected pen/marker strokes', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      {
        kind: 'stroke',
        id: 's1',
        tool: 'pen',
        color: '#111827',
        widthNorm: 0.01,
        points: [[0.1, 0.1], [0.2, 0.2]],
      },
      {
        kind: 'stroke',
        id: 's2',
        tool: 'marker',
        color: '#111827',
        widthNorm: 0.02,
        points: [[0.3, 0.3], [0.4, 0.4]],
      },
    ])
    store.setSelectedIds(['s1', 's2'])
    expect(store.toggleGroupSelected()).toBe(true)
    const grouped = store.getState().doc.commands.filter((c) => c.id === 's1' || c.id === 's2')
    const fg1 = grouped[0]?.kind === 'stroke' ? grouped[0].figureGroupId : undefined
    const fg2 = grouped[1]?.kind === 'stroke' ? grouped[1].figureGroupId : undefined
    expect(fg1).toBeTruthy()
    expect(fg1).toBe(fg2)
  })

  it('removeFromGroupSelected clears figureGroupId from selected strokes', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      {
        kind: 'stroke',
        id: 's1',
        tool: 'pen',
        color: '#111827',
        widthNorm: 0.01,
        points: [[0.1, 0.1], [0.2, 0.2]],
        figureGroupId: 'fg-1',
      },
    ])
    store.setSelectedIds(['s1'])
    expect(store.removeFromGroupSelected()).toBe(true)
    const cmd = store.getState().doc.commands[0]
    if (cmd?.kind === 'stroke') {
      expect(cmd.figureGroupId).toBeUndefined()
    }
  })
})
