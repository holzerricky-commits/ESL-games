import { afterEach, describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
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

const browserStorage = new Map<string, string>()

function mockBrowserStorage() {
  const localStorage = {
    getItem: (k: string) => browserStorage.get(k) ?? null,
    setItem: (k: string, v: string) => browserStorage.set(k, v),
    removeItem: (k: string) => browserStorage.delete(k),
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

const layout = {
  spreadOverlayWidthPx: 1200,
  spreadPageWidthPx: 600,
  leftPageOriginXPx: 0,
  rightPageOriginXPx: 590,
  seamNormX: 0.5,
}

afterEach(() => {
  browserStorage.clear()
  Reflect.deleteProperty(globalThis, 'localStorage')
  Reflect.deleteProperty(globalThis, 'window')
})

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

  it('keeps existing page notes when an empty spread session is flushed', () => {
    mockBrowserStorage()
    const doc = createEmptySpreadSession(key)
    const leftText: AnnotationCommand = {
      kind: 'text',
      id: 'left-note',
      x: 0.1,
      y: 0.2,
      text: 'Review this line',
      fontSizeNorm: 0.03,
      color: '#111827',
    }
    const rightSticky: AnnotationCommand = {
      kind: 'sticky',
      id: 'right-note',
      x: 0.2,
      y: 0.3,
      w: 0.25,
      h: 0.18,
      text: 'Homework',
      fontSizeNorm: 0.025,
      fillColor: '#fef3c7',
    }
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, [leftText], 'pdf')
    setAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.rightPage, [rightSticky], 'pdf')

    flushSpreadSessionDocumentToPageStorage({
      doc,
      key,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })

    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, 'pdf')).toEqual([
      leftText,
    ])
    expect(getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.rightPage, 'pdf')).toEqual([
      rightSticky,
    ])
  })

  it('refreshes spread ink without deleting page-layer notes', () => {
    mockBrowserStorage()
    const doc = createEmptySpreadSession(key)
    const leftText: AnnotationCommand = {
      kind: 'text',
      id: 'left-note',
      x: 0.1,
      y: 0.2,
      text: 'Keep me',
      fontSizeNorm: 0.03,
      color: '#111827',
    }
    const staleStroke: AnnotationCommand = {
      kind: 'stroke',
      id: 'old-ink',
      tool: 'pen',
      points: [
        [0.1, 0.1],
        [0.2, 0.2],
      ],
    }
    doc.commands = [
      {
        kind: 'stroke',
        id: 'new-ink',
        tool: 'pen',
        points: [
          [0.1, 0.1],
          [0.3, 0.3],
        ],
      },
    ]
    setAnnotationsForPage(
      key.studentId,
      key.bookId,
      key.unitId,
      key.leftPage,
      [leftText, staleStroke],
      'pdf',
    )

    flushSpreadSessionDocumentToPageStorage({
      doc,
      key,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })

    const left = getAnnotationsForPage(key.studentId, key.bookId, key.unitId, key.leftPage, 'pdf')
    expect(left.map((c) => c.id)).toEqual(['left-note', 'new-ink'])
  })
})
