import { describe, expect, it } from 'vitest'
import { createEmptyWhiteboardSession } from '@/lib/books/whiteboard-session-types'
import {
  appendLessonBoardPage,
  appendLessonBoardStandardPage,
  goToAdjacentLessonBoardPage,
  lessonBoardPageDisplayLabel,
  lessonBoardPageStorageKey,
  setLessonBoardActivePageId,
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
})
