import { describe, expect, it, vi } from 'vitest'
import { createMemorySpreadSessionStorage } from '@/lib/books/spread-session-storage'
import { loadSpreadSession } from '@/lib/books/spread-session-storage'
import {
  checkpointSpreadSessionDocument,
  flushSpreadSessionDocumentToPageStorage,
  isLastPageSpreadKey,
} from '@/lib/books/spread-session-persist'
import { createEmptySpreadSession, spreadSessionDocId } from '@/lib/books/spread-session-types'
import { projectSpreadSessionToOwnerPages } from '@/lib/books/spread-session-commit'

vi.mock('@/lib/books/annotation-storage', () => ({
  setAnnotationsForPage: vi.fn(),
}))

import { setAnnotationsForPage } from '@/lib/books/annotation-storage'

const mockedSetAnnotationsForPage = vi.mocked(setAnnotationsForPage)

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
    mockedSetAnnotationsForPage.mockClear()
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
    expect(mockedSetAnnotationsForPage).toHaveBeenCalledTimes(2)
  })

  it('isLastPageSpreadKey detects lone last-page spread session key', () => {
    expect(isLastPageSpreadKey({ leftPage: 6, rightPage: 6 })).toBe(true)
    expect(isLastPageSpreadKey({ leftPage: 6, rightPage: 7 })).toBe(false)
  })

  it('flushSpreadSessionDocumentToPageStorage writes left page only on last-page spread', () => {
    mockedSetAnnotationsForPage.mockClear()
    const lastPageKey = { leftPage: 6, rightPage: 6 }
    const doc = createEmptySpreadSession({ ...key, ...lastPageKey })
    doc.commands = [
      {
        kind: 'text',
        id: 'text-1',
        x: 0.2,
        y: 0.3,
        text: 'last',
        color: '#111827',
        fontSizeNorm: 0.02,
      },
    ]
    flushSpreadSessionDocumentToPageStorage({
      doc,
      key: lastPageKey,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })
    expect(mockedSetAnnotationsForPage).toHaveBeenCalledTimes(1)
    expect(mockedSetAnnotationsForPage).toHaveBeenCalledWith(
      key.studentId,
      key.bookId,
      key.unitId,
      6,
      expect.any(Array),
      'pdf',
    )
  })

  it('flushSpreadSessionDocumentToPageStorage skips page writes when spread is empty', () => {
    mockedSetAnnotationsForPage.mockClear()
    const lastPageKey = { leftPage: 6, rightPage: 6 }
    const doc = createEmptySpreadSession({ ...key, ...lastPageKey })
    flushSpreadSessionDocumentToPageStorage({
      doc,
      key: lastPageKey,
      layout,
      studentId: key.studentId,
      bookId: key.bookId,
      unitId: key.unitId,
    })
    expect(mockedSetAnnotationsForPage).not.toHaveBeenCalled()
  })
})
