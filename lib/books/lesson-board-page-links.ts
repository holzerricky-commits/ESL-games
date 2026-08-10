import type { LessonBoardPage, LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import { lessonBoardPageDisplayLabel } from '@/lib/books/lesson-board-session-ops'
import {
  getLessonBoardLinksRoot,
  LESSON_BOARD_PAGE_LINKS_BROWSER_KEY,
  setLessonBoardLinksRoot,
} from '@/lib/local-data/lesson-board-links-disk-client'

/** @deprecated Prefer disk-backed storage; kept for older references. */
export const LESSON_BOARD_PAGE_LINKS_STORAGE_KEY = LESSON_BOARD_PAGE_LINKS_BROWSER_KEY

export type LessonBoardPageLinkBoardRef = {
  pageId: string
  ordinal: number
  title?: string
  orientation?: LessonBoardPageOrientation
}

export type LessonBoardPageLink = {
  id: string
  pdfPage: number
  center: [number, number]
  boardPageRef: LessonBoardPageLinkBoardRef
  createdAt: string
}

export type LessonBoardPageLinksScope = {
  studentId: string
  bookId: string
  unitId: string
}

type LessonBoardPageLinksRoot = Record<string, LessonBoardPageLink[]>

export type LessonBoardPageLinksStorageAdapter = {
  readRoot: () => LessonBoardPageLinksRoot
  writeRoot: (root: LessonBoardPageLinksRoot) => void
}

export function lessonBoardPageLinksDocId(scope: LessonBoardPageLinksScope): string {
  return `${scope.studentId}::${scope.bookId}::${scope.unitId}`
}

function browserLinksStorageAdapter(): LessonBoardPageLinksStorageAdapter {
  return {
    readRoot: () => {
      if (typeof window === 'undefined') return {}
      return getLessonBoardLinksRoot() as LessonBoardPageLinksRoot
    },
    writeRoot: (root) => {
      if (typeof window === 'undefined') return
      setLessonBoardLinksRoot(root)
    },
  }
}

export function createMemoryLessonBoardPageLinksStorage(
  initial: LessonBoardPageLinksRoot = {},
): LessonBoardPageLinksStorageAdapter {
  let root: LessonBoardPageLinksRoot = { ...initial }
  return {
    readRoot: () => ({ ...root }),
    writeRoot: (next) => {
      root = { ...next }
    },
  }
}

export function newLessonBoardPageLinkId(): string {
  return `lb-link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function clampLinkCenter(center: [number, number]): [number, number] {
  return [
    Math.max(0, Math.min(1, center[0])),
    Math.max(0, Math.min(1, center[1])),
  ]
}

export function loadLessonBoardPageLinks(
  scope: LessonBoardPageLinksScope,
  adapter: LessonBoardPageLinksStorageAdapter = browserLinksStorageAdapter(),
): LessonBoardPageLink[] {
  const root = adapter.readRoot()
  const links = root[lessonBoardPageLinksDocId(scope)]
  return Array.isArray(links) ? [...links] : []
}

export function saveLessonBoardPageLinks(
  scope: LessonBoardPageLinksScope,
  links: readonly LessonBoardPageLink[],
  adapter: LessonBoardPageLinksStorageAdapter = browserLinksStorageAdapter(),
): void {
  const root = adapter.readRoot()
  root[lessonBoardPageLinksDocId(scope)] = [...links]
  adapter.writeRoot(root)
}

export function findLessonBoardPageLinkForBoardPage(
  links: readonly LessonBoardPageLink[],
  boardPageId: string,
): LessonBoardPageLink | null {
  return links.find((link) => link.boardPageRef.pageId === boardPageId) ?? null
}

export function listLessonBoardPageLinksForPdfPage(
  links: readonly LessonBoardPageLink[],
  pdfPage: number,
): LessonBoardPageLink[] {
  return links.filter((link) => link.pdfPage === pdfPage)
}

export function upsertLessonBoardPageLink(
  scope: LessonBoardPageLinksScope,
  input: {
    pdfPage: number
    center: [number, number]
    boardPage: Pick<LessonBoardPage, 'id' | 'title' | 'orientation'>
    ordinal: number
    now?: () => string
  },
  adapter: LessonBoardPageLinksStorageAdapter = browserLinksStorageAdapter(),
): LessonBoardPageLink {
  const links = loadLessonBoardPageLinks(scope, adapter)
  const existingIndex = links.findIndex((link) => link.boardPageRef.pageId === input.boardPage.id)
  const trimmedTitle = input.boardPage.title?.trim()
  const next: LessonBoardPageLink = {
    id: existingIndex >= 0 ? links[existingIndex]!.id : newLessonBoardPageLinkId(),
    pdfPage: input.pdfPage,
    center: clampLinkCenter(input.center),
    boardPageRef: {
      pageId: input.boardPage.id,
      ordinal: input.ordinal,
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
      orientation: input.boardPage.orientation,
    },
    createdAt:
      existingIndex >= 0 ? links[existingIndex]!.createdAt : (input.now?.() ?? new Date().toISOString()),
  }
  const nextLinks =
    existingIndex >= 0
      ? links.map((link, index) => (index === existingIndex ? next : link))
      : [...links, next]
  saveLessonBoardPageLinks(scope, nextLinks, adapter)
  return next
}

export function removeLessonBoardPageLink(
  scope: LessonBoardPageLinksScope,
  boardPageId: string,
  adapter: LessonBoardPageLinksStorageAdapter = browserLinksStorageAdapter(),
): boolean {
  const links = loadLessonBoardPageLinks(scope, adapter)
  const nextLinks = links.filter((link) => link.boardPageRef.pageId !== boardPageId)
  if (nextLinks.length === links.length) return false
  saveLessonBoardPageLinks(scope, nextLinks, adapter)
  return true
}

export function removeLessonBoardPageLinksForBoardPageIds(
  scope: LessonBoardPageLinksScope,
  boardPageIds: readonly string[],
  adapter: LessonBoardPageLinksStorageAdapter = browserLinksStorageAdapter(),
): void {
  if (boardPageIds.length === 0) return
  const idSet = new Set(boardPageIds)
  const links = loadLessonBoardPageLinks(scope, adapter)
  const nextLinks = links.filter((link) => !idSet.has(link.boardPageRef.pageId))
  if (nextLinks.length === links.length) return
  saveLessonBoardPageLinks(scope, nextLinks, adapter)
}

export function resolveLessonBoardPageIdFromLink(
  link: LessonBoardPageLink,
  pages: readonly LessonBoardPage[],
): string | null {
  const byId = pages.find((page) => page.id === link.boardPageRef.pageId)
  if (byId) return byId.id

  const refTitle = link.boardPageRef.title?.trim().toLowerCase()
  if (refTitle) {
    const byTitle = pages.find((page) => page.title?.trim().toLowerCase() === refTitle)
    if (byTitle) return byTitle.id
  }

  const ordinal = link.boardPageRef.ordinal
  if (ordinal >= 0 && ordinal < pages.length) {
    return pages[ordinal]?.id ?? null
  }

  return null
}

export function lessonBoardPageLinkDisplayLabel(
  link: LessonBoardPageLink,
  pages: readonly LessonBoardPage[],
): string {
  const resolvedId = resolveLessonBoardPageIdFromLink(link, pages)
  if (resolvedId) {
    const index = pages.findIndex((page) => page.id === resolvedId)
    const page = pages[index]
    if (page) return lessonBoardPageDisplayLabel(page, index)
  }
  const refTitle = link.boardPageRef.title?.trim()
  if (refTitle) return refTitle
  return `Page ${link.boardPageRef.ordinal + 1}`
}
