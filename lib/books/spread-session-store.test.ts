import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INK_SESSION_AUTOSAVE_MS_DRAWING } from '@/lib/books/ink-session-persist-config'
import {
  createMemorySpreadSessionStorage,
  invalidateSpreadSessionRootCache,
  loadSpreadSession,
} from '@/lib/books/spread-session-storage'
import { createSpreadSessionStore } from '@/lib/books/spread-session-store'
import { __resetInkSessionPersistV2ForTests } from '@/lib/books/ink-session-persist-v2'
import type { SpreadSessionKey } from '@/lib/books/spread-session-types'
import { getAnnotationClipboard, setAnnotationClipboard } from '@/lib/books/annotation-clipboard'
import { setBoardPasteAnchorNorm } from '@/lib/books/board-paste-placement'
import { alignSelectedCommands } from '@/lib/books/annotation-align'

const key: SpreadSessionKey = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
  leftPage: 4,
  rightPage: 5,
}

describe('spread-session-store', () => {
  beforeEach(() => {
    invalidateSpreadSessionRootCache()
    __resetInkSessionPersistV2ForTests()
  })

  afterEach(() => {
    invalidateSpreadSessionRootCache()
    __resetInkSessionPersistV2ForTests()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('debounced autosave resets on each append', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
      return 1
    })
    vi.stubGlobal('cancelIdleCallback', () => {})
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
    vi.advanceTimersByTime(INK_SESSION_AUTOSAVE_MS_DRAWING - 2000)
    expect(loadSpreadSession(key, storage).commands).toHaveLength(2)
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
    expect(store.getState().doc.commands).toHaveLength(1)
    expect(store.getState().doc.commands[0]?.id).toBe('l2')
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

  it('alignSelected aligns selected commands and records undo', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, {
      storage,
      autosaveMs: 60_000,
      getSelectionMoveClamp: () => ({ widthPx: 800, heightPx: 600, canvas: null }),
    })
    store.setCommands([
      { kind: 'rect', id: 'a', x: 0.1, y: 0.1, w: 0.1, h: 0.1, strokeColor: '#000' },
      { kind: 'rect', id: 'b', x: 0.4, y: 0.2, w: 0.1, h: 0.1, strokeColor: '#000' },
    ])
    store.setSelectedIds(['a', 'b'])
    expect(store.alignSelected('left')).toBe(true)
    const a = store.getState().doc.commands.find((c) => c.id === 'a')
    const b = store.getState().doc.commands.find((c) => c.id === 'b')
    if (a?.kind === 'rect' && b?.kind === 'rect') {
      expect(a.x).toBeCloseTo(0.1, 6)
      expect(b.x).toBeCloseTo(0.1, 6)
    }
    expect(store.getState().canUndo).toBe(true)
    expect(store.undo()).toBe(true)
    const aAfterUndo = store.getState().doc.commands.find((c) => c.id === 'a')
    const bAfterUndo = store.getState().doc.commands.find((c) => c.id === 'b')
    if (aAfterUndo?.kind === 'rect' && bAfterUndo?.kind === 'rect') {
      expect(aAfterUndo.x).toBeCloseTo(0.1, 6)
      expect(bAfterUndo.x).toBeCloseTo(0.4, 6)
    }
  })

  it('arrange via patchCommands works without getSelectionMoveClamp', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'rect', id: 'a', x: 0.1, y: 0.1, w: 0.1, h: 0.1, strokeColor: '#000' },
      { kind: 'rect', id: 'b', x: 0.4, y: 0.2, w: 0.1, h: 0.1, strokeColor: '#000' },
    ])
    store.setSelectedIds(['a', 'b'])
    const widthPx = 800
    const heightPx = 600
    store.patchCommands((cmds) =>
      alignSelectedCommands(cmds, ['a', 'b'], 'left', widthPx, heightPx),
    )
    const a = store.getState().doc.commands.find((c) => c.id === 'a')
    const b = store.getState().doc.commands.find((c) => c.id === 'b')
    if (a?.kind === 'rect' && b?.kind === 'rect') {
      expect(a.x).toBeCloseTo(0.1, 6)
      expect(b.x).toBeCloseTo(0.1, 6)
    }
    expect(store.getState().canUndo).toBe(true)
  })

  it('alignSelected returns false without selection move clamp context', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'rect', id: 'a', x: 0.1, y: 0.1, w: 0.1, h: 0.1, strokeColor: '#000' },
      { kind: 'rect', id: 'b', x: 0.4, y: 0.2, w: 0.1, h: 0.1, strokeColor: '#000' },
    ])
    store.setSelectedIds(['a', 'b'])
    expect(store.alignSelected('left')).toBe(false)
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

  it('pasteFromClipboard places copied ink at the last board click anchor', () => {
    setBoardPasteAnchorNorm({ x: 0.5, y: 0.5 })
    setAnnotationClipboard([
      { kind: 'rect', id: 'clip-1', x: 0.1, y: 0.1, w: 0.1, h: 0.1, strokeColor: '#111827' },
    ])
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, {
      storage,
      autosaveMs: 60_000,
      getSelectionMoveClamp: () => ({ widthPx: 400, heightPx: 400, canvas: true }),
    })
    expect(store.pasteFromClipboard()).toBe(true)
    const pasted = store.getState().doc.commands.find((c) => c.id !== 'clip-1')
    expect(pasted?.kind).toBe('rect')
    if (pasted?.kind === 'rect') {
      expect(pasted.x + pasted.w / 2).toBeCloseTo(0.5, 4)
      expect(pasted.y + pasted.h / 2).toBeCloseTo(0.5, 4)
    }
    setBoardPasteAnchorNorm(null)
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

  it('toggleGroupSelected groups selected pen strokes only (not highlighter)', () => {
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
      {
        kind: 'stroke',
        id: 's3',
        tool: 'pen',
        color: '#111827',
        widthNorm: 0.01,
        points: [[0.5, 0.5], [0.6, 0.6]],
      },
    ])
    store.setSelectedIds(['s1', 's2', 's3'])
    expect(store.toggleGroupSelected()).toBe(true)
    const grouped = store.getState().doc.commands.filter((c) => c.id === 's1' || c.id === 's2' || c.id === 's3')
    const byId = Object.fromEntries(
      grouped.map((c) => [c.id, c.kind === 'stroke' ? c.figureGroupId : undefined]),
    )
    expect(byId.s1).toBeTruthy()
    expect(byId.s3).toBe(byId.s1)
    expect(byId.s2).toBeUndefined()
  })

  it('toggleGroupSelected does nothing for highlighter-only selection', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      {
        kind: 'stroke',
        id: 'm1',
        tool: 'marker',
        color: '#ffff00',
        widthNorm: 0.02,
        points: [[0.1, 0.1], [0.2, 0.2]],
      },
      {
        kind: 'stroke',
        id: 'm2',
        tool: 'marker',
        color: '#ffff00',
        widthNorm: 0.02,
        points: [[0.3, 0.3], [0.4, 0.4]],
      },
    ])
    store.setSelectedIds(['m1', 'm2'])
    expect(store.toggleGroupSelected()).toBe(false)
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
