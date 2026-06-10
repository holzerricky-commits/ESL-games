import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

class LocalStorageMock {
  private map = new Map<string, string>()

  clear() {
    this.map.clear()
  }

  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null
  }

  removeItem(key: string) {
    this.map.delete(key)
  }

  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

function mockBrowserStorage() {
  const storage = new LocalStorageMock()
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    writable: true,
    configurable: true,
  })
}

const existingText: AnnotationCommand = {
  kind: 'text',
  id: 'text-1',
  x: 0.1,
  y: 0.1,
  w: 0.2,
  h: 0.1,
  text: 'keep me',
  color: '#111827',
  fontSizeNorm: 0.04,
}

const oldSpreadCopy: AnnotationCommand = {
  kind: 'stroke',
  id: 'old-stroke',
  tool: 'pen',
  points: [
    [0.1, 0.1],
    [0.2, 0.2],
  ],
}

describe('spread-session-persist', () => {
  beforeEach(() => {
    mockBrowserStorage()
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    })
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

  it('flushSpreadSessionDocumentToPageStorage preserves page-owned notes when spread doc is empty', () => {
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, [existingText, oldSpreadCopy])
    const doc = createEmptySpreadSession(key)

    flushSpreadSessionDocumentToPageStorage({
      doc,
      key,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })

    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage)).toEqual([existingText])
  })

  it('flushSpreadSessionDocumentToPageStorage refreshes spread ink without dropping page-owned notes', () => {
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, [existingText, oldSpreadCopy])
    const doc = createEmptySpreadSession(key)
    doc.commands = [
      {
        kind: 'stroke',
        id: 'new-stroke',
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

    const saved = getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage)
    expect(saved.map((cmd) => cmd.id)).toEqual(['text-1', 'new-stroke'])
  })
})
