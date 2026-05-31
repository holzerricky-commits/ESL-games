import { describe, expect, it } from 'vitest'
import {
  clearSpreadSession,
  createMemorySpreadSessionStorage,
  loadSpreadSession,
  saveSpreadSessionCheckpoint,
} from '@/lib/books/spread-session-storage'
import { createEmptySpreadSession, spreadSessionDocId, type SpreadSessionKey } from '@/lib/books/spread-session-types'

const key: SpreadSessionKey = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
  leftPage: 2,
  rightPage: 3,
}

describe('spread-session-storage', () => {
  it('returns empty doc when none exists', () => {
    const storage = createMemorySpreadSessionStorage()
    const doc = loadSpreadSession(key, storage)
    expect(doc.docId).toBe(spreadSessionDocId(key))
    expect(doc.commands).toEqual([])
    expect(doc.meta.revision).toBe(0)
  })

  it('saves and loads checkpoint', () => {
    const storage = createMemorySpreadSessionStorage()
    const doc = createEmptySpreadSession(key)
    doc.commands = [{ kind: 'line', id: 'l1', a: [0.1, 0.2], b: [0.3, 0.4], color: '#111827' }]
    doc.meta.revision = 2
    saveSpreadSessionCheckpoint(doc, storage)
    const loaded = loadSpreadSession(key, storage)
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.meta.revision).toBe(2)
  })

  it('clears one stored session', () => {
    const storage = createMemorySpreadSessionStorage()
    const doc = createEmptySpreadSession(key)
    saveSpreadSessionCheckpoint(doc, storage)
    clearSpreadSession(key, storage)
    const loaded = loadSpreadSession(key, storage)
    expect(loaded.meta.revision).toBe(0)
    expect(loaded.commands).toEqual([])
  })
})
