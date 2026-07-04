import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import {
  createLessonBoardPage,
  getLessonBoardActivePage,
  lessonBoardMinContentHeightPx,
  syncLessonBoardActivePageToCommands,
  syncLessonBoardCommandsToActivePage,
  type LessonBoardPage,
  type LessonBoardPageOrientation,
} from '@/lib/books/lesson-board-types'

export function lessonBoardPageStorageKey(sessionStoragePageKey: string, pageId: string): string {
  const base = sessionStoragePageKey.trim()
  return `${base}::lb-page::${pageId}`
}

type LessonBoardPageFields = Pick<WhiteboardSessionDocument, 'pages' | 'activePageId'>

export function getLessonBoardActivePageIndex(doc: LessonBoardPageFields): number {
  const idx = doc.pages.findIndex((p) => p.id === doc.activePageId)
  return idx >= 0 ? idx : 0
}

export function setLessonBoardActivePageContentHeight(
  doc: WhiteboardSessionDocument,
  contentHeightPx: number,
): WhiteboardSessionDocument {
  const synced = syncLessonBoardCommandsToActivePage(doc)
  const pages = synced.pages.map((p) =>
    p.id === synced.activePageId ? { ...p, contentHeightPx } : p,
  )
  return { ...synced, pages }
}

export function setLessonBoardActivePageId(
  doc: WhiteboardSessionDocument,
  pageId: string,
): WhiteboardSessionDocument | null {
  const flushed = syncLessonBoardCommandsToActivePage(doc)
  if (!flushed.pages.some((p) => p.id === pageId)) return null
  const switched = syncLessonBoardActivePageToCommands({
    ...flushed,
    activePageId: pageId,
  })
  return switched
}

export function appendLessonBoardPage(
  doc: WhiteboardSessionDocument,
  orientation: LessonBoardPageOrientation = 'standard',
  options: {
    viewportHeightPx?: number
    slotWidthPx?: number
    spreadWidthPx?: number
    bookPageHint?: number
  } = {},
): WhiteboardSessionDocument {
  const flushed = syncLessonBoardCommandsToActivePage(doc)
  const slotWidthPx = Math.max(1, options.slotWidthPx ?? 320)
  const spreadWidthPx = Math.max(1, options.spreadWidthPx ?? slotWidthPx)
  const logicalWidthPx = orientation === 'wide' ? spreadWidthPx : slotWidthPx
  const contentHeightPx = lessonBoardMinContentHeightPx(
    orientation,
    logicalWidthPx,
    options.viewportHeightPx,
  )
  const page = createLessonBoardPage(orientation, {
    contentHeightPx,
    logicalWidthPx,
    ...(options.bookPageHint != null ? { bookPageHint: options.bookPageHint } : {}),
    commands: [],
  })
  return syncLessonBoardActivePageToCommands({
    ...flushed,
    pages: [...flushed.pages, page],
    activePageId: page.id,
    commands: [],
  })
}

/** @deprecated Use appendLessonBoardPage */
export function appendLessonBoardStandardPage(
  doc: WhiteboardSessionDocument,
  options: { viewportHeightPx?: number; bookPageHint?: number; slotWidthPx?: number } = {},
): WhiteboardSessionDocument {
  return appendLessonBoardPage(doc, 'standard', options)
}

export function goToAdjacentLessonBoardPage(
  doc: WhiteboardSessionDocument,
  delta: -1 | 1,
): WhiteboardSessionDocument | null {
  const index = getLessonBoardActivePageIndex(doc)
  const nextIndex = index + delta
  if (nextIndex < 0 || nextIndex >= doc.pages.length) return null
  const target = doc.pages[nextIndex]
  if (!target) return null
  return setLessonBoardActivePageId(doc, target.id)
}

export function lessonBoardPageCount(doc: Pick<WhiteboardSessionDocument, 'pages'>): number {
  return doc.pages.length
}

export function lessonBoardActivePageSummary(
  doc: Pick<WhiteboardSessionDocument, 'pages' | 'activePageId'>,
): { index: number; total: number; page: LessonBoardPage | null } {
  const total = doc.pages.length
  const index = getLessonBoardActivePageIndex(doc)
  const page = getLessonBoardActivePage(doc.pages, doc.activePageId)
  return { index, total, page }
}

/** Grow runway height from commands on the active page only. */
export function growLessonBoardActivePageContentHeight(
  doc: WhiteboardSessionDocument,
  viewportHeightPx: number,
  commands: readonly AnnotationCommand[],
  maxNormY: (cmds: readonly AnnotationCommand[]) => number,
  growthBandThreshold = 0.85,
): WhiteboardSessionDocument {
  const active = getLessonBoardActivePage(doc.pages, doc.activePageId)
  if (!active || viewportHeightPx <= 0) return doc
  const maxY = maxNormY(commands)
  if (maxY < growthBandThreshold) return doc
  const min = lessonBoardMinContentHeightPx(active.orientation, 320, viewportHeightPx)
  const needed = Math.ceil(maxY * active.contentHeightPx + viewportHeightPx)
  const nextHeight = Math.max(active.contentHeightPx, min, needed)
  if (nextHeight === active.contentHeightPx) return doc
  return setLessonBoardActivePageContentHeight(doc, nextHeight)
}

export function extendLessonBoardActivePageContentHeight(
  doc: WhiteboardSessionDocument,
  viewportHeightPx: number,
): WhiteboardSessionDocument {
  const active = getLessonBoardActivePage(doc.pages, doc.activePageId)
  if (!active || viewportHeightPx <= 0) return doc
  return setLessonBoardActivePageContentHeight(doc, active.contentHeightPx + viewportHeightPx)
}

export function setLessonBoardPageTitle(
  doc: WhiteboardSessionDocument,
  pageId: string,
  title: string | undefined,
): WhiteboardSessionDocument | null {
  const flushed = syncLessonBoardCommandsToActivePage(doc)
  if (!flushed.pages.some((p) => p.id === pageId)) return null
  const trimmed = title?.trim() ?? ''
  const pages = flushed.pages.map((p) => {
    if (p.id !== pageId) return p
    if (!trimmed) {
      const { title: _removed, ...rest } = p
      return rest
    }
    return { ...p, title: trimmed }
  })
  return { ...flushed, pages }
}

export function lessonBoardPageDisplayLabel(page: LessonBoardPage, index: number): string {
  const trimmed = page.title?.trim()
  if (trimmed) return trimmed
  return `Page ${index + 1}`
}
