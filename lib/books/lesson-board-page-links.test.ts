import { describe, expect, it } from 'vitest'
import { createEmptyWhiteboardSession } from '@/lib/books/whiteboard-session-types'
import { appendLessonBoardStandardPage } from '@/lib/books/lesson-board-session-ops'
import {
  createMemoryLessonBoardPageLinksStorage,
  findLessonBoardPageLinkForBoardPage,
  listLessonBoardPageLinksForPdfPage,
  loadLessonBoardPageLinks,
  removeLessonBoardPageLink,
  resolveLessonBoardPageIdFromLink,
  upsertLessonBoardPageLink,
} from '@/lib/books/lesson-board-page-links'

const scope = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
}

describe('lesson-board-page-links', () => {
  it('upserts one link per board page and replaces position on re-link', () => {
    const storage = createMemoryLessonBoardPageLinksStorage()
    const first = upsertLessonBoardPageLink(
      scope,
      {
        pdfPage: 12,
        center: [0.2, 0.3],
        boardPage: { id: 'page-a', orientation: 'standard', title: 'Warm up' },
        ordinal: 0,
        now: () => '2026-01-01T00:00:00.000Z',
      },
      storage,
    )
    expect(first.pdfPage).toBe(12)
    expect(first.center).toEqual([0.2, 0.3])

    const second = upsertLessonBoardPageLink(
      scope,
      {
        pdfPage: 14,
        center: [0.5, 0.6],
        boardPage: { id: 'page-a', orientation: 'standard', title: 'Warm up' },
        ordinal: 0,
      },
      storage,
    )
    const links = loadLessonBoardPageLinks(scope, storage)
    expect(links).toHaveLength(1)
    expect(second.id).toBe(first.id)
    expect(second.pdfPage).toBe(14)
    expect(second.center).toEqual([0.5, 0.6])
  })

  it('lists links for a pdf page', () => {
    const storage = createMemoryLessonBoardPageLinksStorage()
    upsertLessonBoardPageLink(
      scope,
      {
        pdfPage: 5,
        center: [0.1, 0.1],
        boardPage: { id: 'p1', orientation: 'standard' },
        ordinal: 0,
      },
      storage,
    )
    upsertLessonBoardPageLink(
      scope,
      {
        pdfPage: 5,
        center: [0.8, 0.2],
        boardPage: { id: 'p2', orientation: 'wide' },
        ordinal: 1,
      },
      storage,
    )
    upsertLessonBoardPageLink(
      scope,
      {
        pdfPage: 6,
        center: [0.4, 0.4],
        boardPage: { id: 'p3', orientation: 'standard' },
        ordinal: 2,
      },
      storage,
    )
    expect(listLessonBoardPageLinksForPdfPage(loadLessonBoardPageLinks(scope, storage), 5)).toHaveLength(2)
    expect(findLessonBoardPageLinkForBoardPage(loadLessonBoardPageLinks(scope, storage), 'p2')?.pdfPage).toBe(5)
  })

  it('removes link by board page id', () => {
    const storage = createMemoryLessonBoardPageLinksStorage()
    upsertLessonBoardPageLink(
      scope,
      {
        pdfPage: 3,
        center: [0.5, 0.5],
        boardPage: { id: 'page-x', orientation: 'standard' },
        ordinal: 0,
      },
      storage,
    )
    expect(removeLessonBoardPageLink(scope, 'page-x', storage)).toBe(true)
    expect(loadLessonBoardPageLinks(scope, storage)).toHaveLength(0)
  })

  it('resolveLessonBoardPageIdFromLink falls back to title then ordinal', () => {
    let doc = createEmptyWhiteboardSession({
      studentId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      storagePageKey: 'wb-local',
    })
    doc = appendLessonBoardStandardPage(doc)
    const page2 = doc.pages[1]!
    doc = {
      ...doc,
      pages: doc.pages.map((page, index) =>
        index === 1 ? { ...page, title: 'Diagram' } : page,
      ),
    }

    const linkByTitle = {
      id: 'l1',
      pdfPage: 8,
      center: [0.5, 0.5] as [number, number],
      boardPageRef: {
        pageId: 'missing-id',
        ordinal: 9,
        title: 'Diagram',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(resolveLessonBoardPageIdFromLink(linkByTitle, doc.pages)).toBe(page2.id)

    const linkByOrdinal = {
      ...linkByTitle,
      boardPageRef: { pageId: 'missing-id', ordinal: 1 },
    }
    expect(resolveLessonBoardPageIdFromLink(linkByOrdinal, doc.pages)).toBe(page2.id)
  })
})
