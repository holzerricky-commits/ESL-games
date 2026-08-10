import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  applyHistoryRedo,
  applyHistoryUndo,
  buildPenAutoGroupHistoryBatch,
  countHistoryPayloadCommands,
  diffCommandsToHistoryEntry,
} from '@/lib/books/ink-session-history'

const line = (id: string, ax: number): AnnotationCommand => ({
  kind: 'line',
  id,
  a: [ax, 0.1],
  b: [ax + 0.1, 0.2],
  color: '#111827',
})

const pen = (id: string, y: number): AnnotationCommand => ({
  kind: 'stroke',
  id,
  tool: 'pen',
  points: [
    [0.1, y],
    [0.2, y],
  ],
})

describe('ink-session-history', () => {
  it('diffCommandsToHistoryEntry classifies append at end', () => {
    const prev = [line('a', 0.1)]
    const next = [...prev, line('b', 0.3)]
    expect(diffCommandsToHistoryEntry(prev, next)).toEqual({
      type: 'append',
      commands: [next[1]],
    })
  })

  it('diffCommandsToHistoryEntry classifies delete', () => {
    const prev = [line('a', 0.1), line('b', 0.3)]
    const next = [prev[0]!]
    const entry = diffCommandsToHistoryEntry(prev, next)
    expect(entry?.type).toBe('delete')
    if (entry?.type === 'delete') {
      expect(entry.removed).toHaveLength(1)
      expect(entry.removed[0]?.command.id).toBe('b')
    }
  })

  it('applyHistoryUndo/redo round-trips patch', () => {
    const a = line('a', 0.1)
    const b = line('b', 0.3)
    const moved = { ...b, a: [0.5, 0.5] as [number, number] }
    const prev = [a, b]
    const next = [a, moved]
    const entry = diffCommandsToHistoryEntry(prev, next)
    expect(entry?.type).toBe('patch')
    const undone = applyHistoryUndo(next, entry!)
    expect(undone).toEqual(prev)
    expect(applyHistoryRedo(undone, entry!)).toEqual(next)
  })

  it('applyHistoryUndo/redo round-trips reorder', () => {
    const a = line('a', 0.1)
    const b = line('b', 0.3)
    const prev = [a, b]
    const next = [b, a]
    const entry = diffCommandsToHistoryEntry(prev, next)
    expect(entry?.type).toBe('reorder')
    expect(applyHistoryUndo(next, entry!)).toEqual(prev)
    expect(applyHistoryRedo(prev, entry!)).toEqual(next)
  })

  it('buildPenAutoGroupHistoryBatch uses batch when grouping touches neighbors', () => {
    const prev = [
      { ...pen('p1', 0.5), figureGroupId: 'g1' },
      pen('p2', 0.52),
    ] as AnnotationCommand[]
    const incoming = pen('p3', 0.51)
    const next = [
      { ...prev[0]!, figureGroupId: 'g1' },
      { ...prev[1]!, figureGroupId: 'g1' },
      { ...incoming, figureGroupId: 'g1', committedAtMs: 1 },
    ] as AnnotationCommand[]
    const entry = buildPenAutoGroupHistoryBatch(prev, next, 'p3')
    expect(entry.type).toBe('batch')
    if (entry.type === 'batch') {
      expect(entry.entries[0]?.type).toBe('append')
      expect(countHistoryPayloadCommands(entry)).toBeLessThan(next.length * 2)
    }
  })
})
