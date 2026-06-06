import { beforeEach, describe, expect, it } from 'vitest'
import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
import { createMemorySpreadSessionStorage } from '@/lib/books/spread-session-storage'
import { loadSpreadSession } from '@/lib/books/spread-session-storage'
import {
  checkpointSpreadSessionDocument,
  flushSpreadSessionDocumentToPageStorage,
} from '@/lib/books/spread-session-persist'
import { createEmptySpreadSession, spreadSessionDocId } from '@/lib/books/spread-session-types'
import { projectSpreadSessionToOwnerPages } from '@/lib/books/spread-session-commit'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

const storage = new Map<string, string>()

function mockLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: globalThis.localStorage },
  })
}

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
  beforeEach(() => {
    mockLocalStorage()
    storage.clear()
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

  it('preserves page-layer annotations when spread session has no ink', () => {
    const sticky: AnnotationCommand = {
      kind: 'sticky',
      id: 'sticky-1',
      x: 0.1,
      y: 0.2,
      w: 0.2,
      h: 0.1,
      text: 'Keep this note',
      fontSizeNorm: 0.024,
    }
    const staleDelegatedStroke: AnnotationCommand = {
      kind: 'stroke',
      id: 'stale-stroke-1',
      tool: 'pen',
      points: [
        [0.1, 0.1],
        [0.2, 0.2],
      ],
    }
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, [
      sticky,
      staleDelegatedStroke,
    ])

    flushSpreadSessionDocumentToPageStorage({
      doc: createEmptySpreadSession(key),
      key,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })

    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage)).toEqual([
      sticky,
    ])
  })

  it('merges projected spread ink with existing page-layer annotations', () => {
    const text: AnnotationCommand = {
      kind: 'text',
      id: 'text-1',
      x: 0.25,
      y: 0.25,
      text: 'Remember',
      fontSizeNorm: 0.028,
      color: '#111111',
    }
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, [text])
    const doc = createEmptySpreadSession(key)
    doc.commands = [
      {
        kind: 'stroke',
        id: 'stroke-2',
        tool: 'pen',
        points: [
          [0.1, 0.1],
          [0.4, 0.4],
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

    const left = getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage)
    expect(left[0]).toEqual(text)
    expect(left.some((cmd) => cmd.kind === 'stroke' && cmd.id === 'stroke-2')).toBe(true)
  })
})
