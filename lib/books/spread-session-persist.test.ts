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

function mockBrowserStorage() {
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
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
    mockBrowserStorage()
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

  it('flushSpreadSessionDocumentToPageStorage keeps page notes when spread ink is empty', () => {
    const doc = createEmptySpreadSession(key)
    const oldStroke: AnnotationCommand = {
      kind: 'stroke',
      id: 'old-spread-ink',
      tool: 'pen',
      points: [
        [0.1, 0.1],
        [0.2, 0.2],
      ],
    }
    const pageNote: AnnotationCommand = {
      kind: 'text',
      id: 'teacher-note',
      x: 0.2,
      y: 0.2,
      text: 'Keep this note',
      color: '#111827',
      fontSizeNorm: 0.03,
    }
    const rightSticky: AnnotationCommand = {
      kind: 'sticky',
      id: 'right-note',
      x: 0.3,
      y: 0.3,
      w: 0.2,
      h: 0.1,
      text: 'Keep this too',
      fontSizeNorm: 0.02,
      fillColor: '#fef3c7',
    }
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, [oldStroke, pageNote], 'pdf')
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.rightPage, [rightSticky], 'pdf')

    flushSpreadSessionDocumentToPageStorage({
      doc,
      key,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })

    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, 'pdf')).toEqual([pageNote])
    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.rightPage, 'pdf')).toEqual([rightSticky])
  })
})
