import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { createMemorySpreadSessionStorage, loadSpreadSession } from '@/lib/books/spread-session-storage'
import {
  checkpointSpreadSessionDocument,
  flushSpreadSessionDocumentToPageStorage,
  mergeSpreadPageLayerWithSession,
} from '@/lib/books/spread-session-persist'
import { createEmptySpreadSession, spreadSessionDocId } from '@/lib/books/spread-session-types'
import { projectSpreadSessionToOwnerPages } from '@/lib/books/spread-session-commit'

const sticky: AnnotationCommand = {
  kind: 'sticky',
  id: 'sticky-1',
  x: 0.1,
  y: 0.1,
  w: 0.2,
  h: 0.1,
  text: 'Remember this word',
  color: '#facc15',
}

const existingStroke: AnnotationCommand = {
  kind: 'stroke',
  id: 'old-stroke',
  tool: 'pen',
  points: [[0.1, 0.1], [0.2, 0.2]],
}

const sessionStroke: AnnotationCommand = {
  kind: 'stroke',
  id: 'session-stroke',
  tool: 'pen',
  points: [[0.3, 0.3], [0.4, 0.4]],
}

describe('spread-session-persist', () => {
  it('keeps page-layer notes when a spread with no session ink is flushed', () => {
    expect(mergeSpreadPageLayerWithSession([sticky], []).map((command) => command.id)).toEqual(['sticky-1'])
  })

  it('replaces delegated spread ink without deleting page-layer notes', () => {
    expect(
      mergeSpreadPageLayerWithSession([sticky, existingStroke], [sessionStroke]).map((command) => command.id),
    ).toEqual(['sticky-1', 'session-stroke'])
  })
})

const key = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
  leftPage: 4,
  rightPage: 5,
}

const layout = {
  spreadOverlayWidthPx: 1200,
  spreadPageWidthPx: 600,
  leftPageOriginXPx: 0,
  rightPageOriginXPx: 590,
  seamNormX: 0.5,
}

describe('spread-session-persist', () => {
  it('checkpointSpreadSessionDocument writes spread storage', () => {
    const storage = createMemorySpreadSessionStorage()
    const doc = createEmptySpreadSession(key)
    doc.commands = [
      {
        kind: 'stroke',
        id: 'stroke-1',
        tool: 'pen',
        points: [
          [0.1, 0.1],
          [0.5, 0.5],
        ],
      },
    ]
    checkpointSpreadSessionDocument(doc, storage)
    const loaded = loadSpreadSession(key, storage)
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.commands[0]?.id).toBe('stroke-1')
    expect(spreadSessionDocId(loaded.key)).toBe(spreadSessionDocId(key))
  })

  it('flushSpreadSessionDocumentToPageStorage uses page projection helper', () => {
    const doc = createEmptySpreadSession(key)
    doc.commands = [
      {
        kind: 'stroke',
        id: 'stroke-1',
        tool: 'pen',
        points: [
          [0.1, 0.1],
          [0.9, 0.9],
        ],
      },
    ]
    const projected = projectSpreadSessionToOwnerPages(doc.commands, layout)
    expect(projected.left.length + projected.right.length).toBeGreaterThan(0)
    expect(() =>
      flushSpreadSessionDocumentToPageStorage({
        doc,
        key,
        layout,
        studentId: key.studentId,
        bookId: key.bookId,
        unitId: key.unitId,
      }),
    ).not.toThrow()
  })
})
