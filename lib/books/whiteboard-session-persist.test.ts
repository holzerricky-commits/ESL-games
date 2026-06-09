import { describe, expect, it } from 'vitest'
import { createMemoryWhiteboardSessionStorage, loadWhiteboardSession } from '@/lib/books/whiteboard-session-storage'
import { createEmptyWhiteboardSession, whiteboardSessionDocId } from '@/lib/books/whiteboard-session-types'
import {
  checkpointWhiteboardSessionDocument,
  flushWhiteboardSessionDocumentToLegacyStorage,
  mergeWhiteboardLegacyWithSession,
  resolveWhiteboardSessionCommandsOnMount,
} from '@/lib/books/whiteboard-session-persist'
import { hydrateWhiteboardSessionFromLegacyStorage } from '@/lib/books/whiteboard-session-hydrate'

const key = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
  storagePageKey: 'wb-lesson-1',
}

describe('whiteboard-session-persist', () => {
  it('hydrateWhiteboardSessionFromLegacyStorage keeps pen and marker strokes', () => {
    const legacy = [
      { kind: 'stroke' as const, id: 'p1', tool: 'pen' as const, points: [[0.1, 0.1], [0.2, 0.2]] },
      { kind: 'stroke' as const, id: 'm1', tool: 'marker' as const, points: [[0.3, 0.3], [0.4, 0.4]] },
      { kind: 'text' as const, id: 't1', x: 0.1, y: 0.1, w: 0.2, h: 0.05, text: 'hi', color: '#000', fontSizeNorm: 0.02 },
    ]
    const ink = hydrateWhiteboardSessionFromLegacyStorage(legacy)
    expect(ink).toHaveLength(2)
    expect(ink.map((c) => c.id)).toEqual(['p1', 'm1'])
  })

  it('resolveWhiteboardSessionCommandsOnMount merges session with legacy ink', () => {
    const session = [{ kind: 'stroke' as const, id: 's1', tool: 'pen' as const, points: [[0, 0], [1, 1]] }]
    const legacy = [{ kind: 'stroke' as const, id: 'l1', tool: 'pen' as const, points: [[0.5, 0.5], [0.6, 0.6]] }]
    expect(resolveWhiteboardSessionCommandsOnMount(session, legacy).map((c) => c.id).sort()).toEqual(['l1', 's1'])
    expect(resolveWhiteboardSessionCommandsOnMount([], legacy).map((c) => c.id)).toEqual(['l1'])
    const clash = resolveWhiteboardSessionCommandsOnMount(
      [{ kind: 'stroke' as const, id: 's1', tool: 'pen' as const, points: [[0, 0], [1, 1]] }],
      [{ kind: 'stroke' as const, id: 's1', tool: 'pen' as const, points: [[0.2, 0.2], [0.3, 0.3]] }],
    )
    expect(clash).toHaveLength(1)
    expect(clash[0]?.points[0]).toEqual([0, 0])
  })

  it('mergeWhiteboardLegacyWithSession appends session pen', () => {
    const page = [{ kind: 'text' as const, id: 't1', x: 0, y: 0, w: 0.1, h: 0.05, text: 'x', color: '#000', fontSizeNorm: 0.02 }]
    const session = [{ kind: 'stroke' as const, id: 'p1', tool: 'pen' as const, points: [[0, 0], [1, 1]] }]
    const merged = mergeWhiteboardLegacyWithSession(page, session)
    expect(merged).toHaveLength(2)
    expect(merged[1]?.id).toBe('p1')
  })

  it('checkpointWhiteboardSessionDocument writes whiteboard session storage', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const doc = createEmptyWhiteboardSession(key)
    doc.commands = [
      { kind: 'stroke', id: 'stroke-1', tool: 'pen', points: [[0.1, 0.1], [0.5, 0.5]] },
    ]
    checkpointWhiteboardSessionDocument(doc, storage)
    const loaded = loadWhiteboardSession(key, storage)
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.pages).toHaveLength(1)
    expect(loaded.pages[0]?.commands).toHaveLength(1)
    expect(whiteboardSessionDocId(loaded.key)).toBe(whiteboardSessionDocId(key))
  })

  it('flushWhiteboardSessionDocumentToLegacyStorage does not throw', () => {
    const doc = createEmptyWhiteboardSession(key)
    doc.commands = [
      { kind: 'stroke', id: 'stroke-1', tool: 'pen', points: [[0.1, 0.1], [0.5, 0.5]] },
    ]
    expect(() =>
      flushWhiteboardSessionDocumentToLegacyStorage({
        doc,
        studentId: key.studentId,
        bookId: key.bookId,
        unitId: key.unitId,
        storagePageKey: key.storagePageKey,
      }),
    ).not.toThrow()
  })
})
