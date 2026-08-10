import { describe, expect, it } from 'vitest'
import { createMemorySpreadSessionStorage } from '@/lib/books/spread-session-storage'
import { createSpreadSessionStore } from '@/lib/books/spread-session-store'
import { spreadSessionDocId, type SpreadSessionKey } from '@/lib/books/spread-session-types'
import { moveCommandsInStack } from '@/lib/books/annotation-layer-order'

const key: SpreadSessionKey = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
  leftPage: 4,
  rightPage: 5,
}

const widthPx = 800
const heightPx = 600

function penStroke(id: string, y: number) {
  return {
    kind: 'stroke' as const,
    id,
    tool: 'pen' as const,
    points: [
      [0.1, y],
      [0.25, y],
    ] as [number, number][],
  }
}

describe('ink-session-store R1 op undo', () => {
  it('appendPenWithAutoGroup undoes stroke and grouping in one step', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.appendPenWithAutoGroup(penStroke('s1', 0.5), {
      penAutoGroupConnected: true,
      widthPx,
      heightPx,
    })
    store.appendPenWithAutoGroup(penStroke('s2', 0.52), {
      penAutoGroupConnected: true,
      widthPx,
      heightPx,
    })
    expect(store.getState().doc.commands).toHaveLength(2)
    const grouped = store.getState().doc.commands.every(
      (c) => c.kind === 'stroke' && c.figureGroupId,
    )
    expect(grouped).toBe(true)

    expect(store.undo()).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(1)
    expect(store.getState().doc.commands[0]?.id).toBe('s1')

    expect(store.undo()).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(0)
  })

  it('500 pen auto-group appends keep undo payload linear not quadratic', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    const strokeCount = 500

    for (let i = 0; i < strokeCount; i++) {
      store.appendPenWithAutoGroup(penStroke(`s-${i}`, 0.02 + i * 0.04), {
        penAutoGroupConnected: true,
        widthPx,
        heightPx,
      })
    }

    expect(store.getState().doc.commands).toHaveLength(strokeCount)

    const payload = store.undoPayloadCommandCount()
    const quadraticBudget = (strokeCount * (strokeCount + 1)) / 2
    const linearBudget = strokeCount * 12

    expect(payload).toBeLessThan(linearBudget)
    expect(payload).toBeLessThan(quadraticBudget / 10)
  })

  it('moveSelectedForward records reorder undo and restores stack order', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    const l1 = {
      kind: 'line' as const,
      id: 'l1',
      a: [0.1, 0.1] as [number, number],
      b: [0.2, 0.2] as [number, number],
      color: '#111827',
    }
    const l2 = {
      kind: 'line' as const,
      id: 'l2',
      a: [0.3, 0.3] as [number, number],
      b: [0.4, 0.4] as [number, number],
      color: '#111827',
    }
    store.setCommands([l1, l2])
    store.setSelectedIds(['l1'])
    expect(store.moveSelectedForward()).toBe(true)
    expect(store.getState().doc.commands.map((c) => c.id)).toEqual(['l2', 'l1'])
    expect(store.undo()).toBe(true)
    expect(store.getState().doc.commands.map((c) => c.id)).toEqual(['l1', 'l2'])
  })

  it('patchCommands move in stack matches moveCommandsInStack undo', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      { kind: 'line', id: 'a', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' },
      { kind: 'line', id: 'b', a: [0.3, 0.3], b: [0.4, 0.4], color: '#111827' },
    ])
    store.patchCommands((cmds) => moveCommandsInStack(cmds, ['a'], 1))
    expect(store.getState().doc.commands.map((c) => c.id)).toEqual(['b', 'a'])
    expect(store.undo()).toBe(true)
    expect(store.getState().doc.commands.map((c) => c.id)).toEqual(['a', 'b'])
  })
})

describe('ink-session-store R2 destructive eraser', () => {
  function widePenStroke(id: string, y: number) {
    return {
      kind: 'stroke' as const,
      id,
      tool: 'pen' as const,
      points: [
        [0.1, y],
        [0.9, y],
      ] as [number, number][],
    }
  }

  const verticalEraser: [number, number][] = [
    [0.5, 0.1],
    [0.5, 0.9],
  ]

  it('commitEraserLine removes hits and does not store eraser-line stroke', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([
      widePenStroke('s1', 0.5),
      {
        kind: 'line',
        id: 'l1',
        a: [0.4, 0.4],
        b: [0.6, 0.6],
        color: '#111827',
      },
    ])
    expect(store.commitEraserLine(verticalEraser)).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(0)
    expect(
      store.getState().doc.commands.some((c) => c.kind === 'stroke' && c.tool === 'eraser-line'),
    ).toBe(false)
  })

  it('selectAll after erase-all selects nothing', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([widePenStroke('s1', 0.5)])
    store.commitEraserLine(verticalEraser)
    store.selectAll()
    expect(store.getState().selectedIds).toEqual([])
  })

  it('undo restores erased commands', () => {
    const storage = createMemorySpreadSessionStorage()
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    store.setCommands([widePenStroke('s1', 0.5)])
    store.commitEraserLine(verticalEraser)
    expect(store.getState().doc.commands).toHaveLength(0)
    expect(store.undo()).toBe(true)
    expect(store.getState().doc.commands).toHaveLength(1)
    expect(store.getState().doc.commands[0]?.id).toBe('s1')
  })

  it('loads legacy eraser-line scenes compacted', () => {
    const legacyDoc = {
      docId: spreadSessionDocId(key),
      key,
      commands: [
        widePenStroke('s1', 0.5),
        {
          kind: 'stroke' as const,
          id: 'e1',
          tool: 'eraser-line' as const,
          points: verticalEraser,
        },
      ],
      meta: { revision: 1, dirty: false, updatedAt: 1 },
    }
    const storage = createMemorySpreadSessionStorage({ [legacyDoc.docId]: legacyDoc })
    const store = createSpreadSessionStore(key, { storage, autosaveMs: 60_000 })
    expect(store.getState().doc.commands).toHaveLength(0)
  })
})
