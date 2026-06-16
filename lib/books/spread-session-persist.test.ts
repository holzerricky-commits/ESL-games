import { beforeEach, describe, expect, it } from 'vitest'
import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { createMemorySpreadSessionStorage } from '@/lib/books/spread-session-storage'
import { loadSpreadSession } from '@/lib/books/spread-session-storage'
import {
  checkpointSpreadSessionDocument,
  flushSpreadSessionDocumentToPageStorage,
} from '@/lib/books/spread-session-persist'
import { createEmptySpreadSession, spreadSessionDocId } from '@/lib/books/spread-session-types'
import { projectSpreadSessionToOwnerPages } from '@/lib/books/spread-session-commit'

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

const storage = new Map<string, string>()

function mockLocalStorage() {
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, String(v))
    },
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() {
      return storage.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  })
}

describe('spread-session-persist', () => {
  beforeEach(() => {
    storage.clear()
    mockLocalStorage()
  })

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

  it('flushSpreadSessionDocumentToPageStorage keeps page-layer notes while replacing delegated spread ink', () => {
    const leftSticky: AnnotationCommand = {
      kind: 'sticky',
      id: 'left-sticky',
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.12,
      text: 'Remember this',
      fontSizeNorm: 0.024,
    }
    const rightText: AnnotationCommand = {
      kind: 'text',
      id: 'right-text',
      x: 0.2,
      y: 0.2,
      text: 'Still here',
      color: '#111111',
      fontSizeNorm: 0.028,
    }
    const staleLeftInk: AnnotationCommand = {
      kind: 'stroke',
      id: 'stale-left-ink',
      tool: 'pen',
      points: [
        [0.1, 0.1],
        [0.2, 0.2],
      ],
    }
    const staleRightInk: AnnotationCommand = {
      kind: 'line',
      id: 'stale-right-ink',
      a: [0.1, 0.1],
      b: [0.2, 0.2],
      color: '#222222',
    }
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, [leftSticky, staleLeftInk], 'pdf')
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.rightPage, [rightText, staleRightInk], 'pdf')

    const doc = createEmptySpreadSession(key)
    doc.commands = [
      {
        kind: 'stroke',
        id: 'fresh-spread-ink',
        tool: 'pen',
        points: [
          [0.1, 0.1],
          [0.2, 0.2],
        ],
      },
    ]

    flushSpreadSessionDocumentToPageStorage({
      doc,
      key,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })

    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, 'pdf').map((c) => c.id)).toEqual([
      'left-sticky',
      'fresh-spread-ink',
    ])
    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.rightPage, 'pdf').map((c) => c.id)).toEqual([
      'right-text',
    ])
  })

  it('flushSpreadSessionDocumentToPageStorage does not clear notes when spread ink is empty', () => {
    const note: AnnotationCommand = {
      kind: 'stamp',
      id: 'note-stamp',
      variant: 'star',
      center: [0.4, 0.4],
      color: '#f59e0b',
    }
    const staleInk: AnnotationCommand = {
      kind: 'stroke',
      id: 'stale-ink',
      tool: 'marker',
      points: [
        [0.3, 0.3],
        [0.4, 0.4],
      ],
    }
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, [note, staleInk], 'pdf')

    flushSpreadSessionDocumentToPageStorage({
      doc: createEmptySpreadSession(key),
      key,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })

    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, 'pdf').map((c) => c.id)).toEqual([
      'note-stamp',
    ])
  })
})
