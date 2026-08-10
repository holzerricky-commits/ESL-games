import { describe, expect, it } from 'vitest'
import { createEmptyWhiteboardSession } from '@/lib/books/whiteboard-session-types'
import {
  appendLessonBoardPage,
  appendLessonBoardStandardPage,
  deleteLessonBoardPage,
  goToAdjacentLessonBoardPage,
  lessonBoardPageDisplayLabel,
  lessonBoardPageStorageKey,
  orderLessonBoardPagesForToc,
  setLessonBoardActivePageContentHeight,
  setLessonBoardActivePageId,
  setLessonBoardPageBookPageHint,
  setLessonBoardPageTitle,
} from '@/lib/books/lesson-board-session-ops'

const key = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
  storagePageKey: 'wb-lesson-1',
}

const stroke = {
  kind: 'stroke' as const,
  id: 'p1',
  tool: 'pen' as const,
  points: [
    [0.1, 0.1],
    [0.2, 0.2],
  ] as [number, number][],
}

describe('lesson-board-session-ops', () => {
  it('lessonBoardPageStorageKey scopes DOM layer per page', () => {
    expect(lessonBoardPageStorageKey('wb-lesson-1', 'page-a')).toBe('wb-lesson-1::lb-page::page-a')
  })

  it('appendLessonBoardPage wide uses spread width and 16:9 height', () => {
    let doc = createEmptyWhiteboardSession(key)
    doc = appendLessonBoardPage(doc, 'wide', {
      slotWidthPx: 320,
      spreadWidthPx: 640,
      viewportHeightPx: 400,
    })
    const page = doc.pages[doc.pages.length - 1]
    expect(page?.orientation).toBe('wide')
    expect(page?.logicalWidthPx).toBe(640)
    expect(page?.contentHeightPx).toBe(Math.round(640 / (16 / 9)))
    expect(doc.activePageId).toBe(page?.id)
  })

  it('appendLessonBoardStandardPage adds empty active page', () => {
    let doc = createEmptyWhiteboardSession(key)
    doc.commands = [stroke]
    doc = appendLessonBoardStandardPage(doc, { viewportHeightPx: 600 })
    expect(doc.pages).toHaveLength(2)
    expect(doc.commands).toHaveLength(0)
    expect(doc.pages[0]?.commands).toHaveLength(1)
    expect(doc.pages[1]?.id).toBe(doc.activePageId)
    expect(doc.pages[1]?.contentHeightPx).toBe(1200)
  })

  it('setLessonBoardActivePageContentHeight remaps stickies so pixels stay put', () => {
    let doc = createEmptyWhiteboardSession(key)
    const sticky = {
      kind: 'sticky' as const,
      id: 'st1',
      x: 0.1,
      y: 0.2,
      w: 0.3,
      h: 0.15,
      text: 'note',
      fontSizeNorm: 0.05,
      fillColor: '#fef08a',
    }
    doc.commands = [sticky]
    doc = {
      ...doc,
      pages: doc.pages.map((p) =>
        p.id === doc.activePageId ? { ...p, contentHeightPx: 1000, commands: [sticky] } : p,
      ),
    }
    const grown = setLessonBoardActivePageContentHeight(doc, 2000)
    const next = grown.commands[0]
    expect(next?.kind).toBe('sticky')
    if (next?.kind !== 'sticky') return
    expect(next.y * 2000).toBeCloseTo(0.2 * 1000, 5)
    expect(next.h * 2000).toBeCloseTo(0.15 * 1000, 5)
    expect(grown.pages[0]?.contentHeightPx).toBe(2000)

    const shrunk = setLessonBoardActivePageContentHeight(grown, 1000)
    const back = shrunk.commands[0]
    expect(back?.kind).toBe('sticky')
    if (back?.kind !== 'sticky') return
    expect(back.y).toBeCloseTo(0.2, 5)
    expect(back.h).toBeCloseTo(0.15, 5)
  })

  it('setLessonBoardActivePageId swaps commands', () => {
    let doc = createEmptyWhiteboardSession(key)
    doc.commands = [stroke]
    doc = appendLessonBoardStandardPage(doc)
    const page2Id = doc.activePageId
    const page1Id = doc.pages[0]!.id
    const switched = setLessonBoardActivePageId(doc, page1Id)
    expect(switched?.commands).toHaveLength(1)
    expect(switched?.activePageId).toBe(page1Id)
    const back = setLessonBoardActivePageId(switched!, page2Id)
    expect(back?.commands).toHaveLength(0)
  })

  it('setLessonBoardPageTitle sets and clears optional title', () => {
    const doc = createEmptyWhiteboardSession(key)
    const pageId = doc.pages[0]!.id
    const titled = setLessonBoardPageTitle(doc, pageId, '  Irregular verbs  ')
    expect(titled?.pages[0]?.title).toBe('Irregular verbs')
    expect(lessonBoardPageDisplayLabel(titled!.pages[0]!, 0)).toBe('Irregular verbs')
    const cleared = setLessonBoardPageTitle(titled!, pageId, '   ')
    expect(cleared?.pages[0]?.title).toBeUndefined()
    expect(lessonBoardPageDisplayLabel(cleared!.pages[0]!, 0)).toBe('Page 1')
  })

  it('orderLessonBoardPagesForToc puts titled pages first', () => {
    let doc = createEmptyWhiteboardSession(key)
    doc = appendLessonBoardStandardPage(doc)
    doc = appendLessonBoardStandardPage(doc)
    const untitled = doc.pages[0]!
    const mid = setLessonBoardPageTitle(doc, doc.pages[1]!.id, 'Grammar')!
    const titled = setLessonBoardPageTitle(mid, mid.pages[2]!.id, 'Vocab')!
    const ordered = orderLessonBoardPagesForToc(titled.pages)
    expect(ordered.map((e) => e.index)).toEqual([1, 2, 0])
    expect(ordered.map((e) => lessonBoardPageDisplayLabel(e.page, e.index))).toEqual([
      'Grammar',
      'Vocab',
      'Page 1',
    ])
    expect(untitled.title).toBeUndefined()
  })

  it('setLessonBoardPageBookPageHint sets and skips unchanged', () => {
    const doc = createEmptyWhiteboardSession(key)
    const pageId = doc.pages[0]!.id
    const once = setLessonBoardPageBookPageHint(doc, pageId, 12)
    expect(once?.pages[0]?.bookPageHint).toBe(12)
    expect(setLessonBoardPageBookPageHint(once!, pageId, 12)).toBeNull()
    expect(setLessonBoardPageBookPageHint(once!, pageId, 0)).toBeNull()
  })

  it('goToAdjacentLessonBoardPage respects bounds', () => {
    let doc = createEmptyWhiteboardSession(key)
    expect(goToAdjacentLessonBoardPage(doc, -1)).toBeNull()
    doc = appendLessonBoardStandardPage(doc)
    const onFirst = goToAdjacentLessonBoardPage(doc, -1)
    expect(onFirst?.activePageId).toBe(doc.pages[0]?.id)
    const onSecond = goToAdjacentLessonBoardPage(onFirst!, 1)
    expect(onSecond).not.toBeNull()
    expect(goToAdjacentLessonBoardPage(onSecond!, 1)).toBeNull()
  })

  it('deleteLessonBoardPage removes page and switches active when needed', () => {
    let doc = createEmptyWhiteboardSession(key)
    doc.commands = [stroke]
    doc = appendLessonBoardStandardPage(doc)
    const page2Id = doc.activePageId
    const page1Id = doc.pages[0]!.id
    const deleted = deleteLessonBoardPage(doc, page2Id)
    expect(deleted?.pages).toHaveLength(1)
    expect(deleted?.activePageId).toBe(page1Id)
    expect(deleted?.commands).toHaveLength(1)
    expect(deleteLessonBoardPage(deleted!, page1Id)).toBeNull()
  })
})
