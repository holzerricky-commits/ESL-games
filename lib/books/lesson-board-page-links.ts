import type { LessonBoardPage, LessonBoardPageOrientation, LessonBoardPagePrimaryLink } from '@/lib/books/lesson-board-types'
import { lessonBoardPageDisplayLabel } from '@/lib/books/lesson-board-session-ops'
import { lessonBoardDisplayLabel } from '@/lib/books/lesson-board-nav'
import type { BookLibraryPayload } from '@/lib/books/types'
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
  bookId: string
  /** Unit file that owns `pdfPage`, when the citation recorded one. */
  unitId?: string
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

export function parseLessonBoardPageLinksDocId(docId: string): LessonBoardPageLinksScope | null {
  const parts = docId.split('::')
  if (parts.length !== 3) return null
  const studentId = parts[0]?.trim() ?? ''
  const bookId = parts[1]?.trim() ?? ''
  const unitId = parts[2]?.trim() ?? ''
  if (!studentId || !bookId || !unitId) return null
  return { studentId, bookId, unitId }
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
  if (!Array.isArray(links)) return []
  return links.map((link) => ({
    ...link,
    bookId: link.bookId?.trim() || scope.bookId,
  }))
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
  bookId?: string,
  unitId?: string,
): LessonBoardPageLink[] {
  const book = bookId?.trim()
  const unit = unitId?.trim()
  return links.filter((link) => {
    if (link.pdfPage !== pdfPage) return false
    if (book && link.bookId !== book) return false
    if (unit && link.unitId && link.unitId !== unit) return false
    return true
  })
}

/**
 * Unit to open for a notebook citation.
 * The link's own unit wins, then the legacy per-unit link, then the strip chip.
 * A candidate is skipped when the book no longer has that unit.
 */
export function resolveNotebookLinkUnitId(args: {
  linkUnitId?: string | null
  legacyUnitId?: string | null
  chipUnitId?: string | null
  openUnitId?: string | null
  bookUnitIds?: readonly string[]
}): string | null {
  const allowed = (args.bookUnitIds ?? []).map((id) => id.trim()).filter(Boolean)
  const allow = new Set(allowed)
  const pick = (id?: string | null): string | null => {
    const trimmed = id?.trim() ?? ''
    if (!trimmed) return null
    if (allow.size > 0 && !allow.has(trimmed)) return null
    return trimmed
  }
  return (
    pick(args.linkUnitId) ??
    pick(args.legacyUnitId) ??
    pick(args.chipUnitId) ??
    pick(args.openUnitId) ??
    null
  )
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
    bookId: scope.bookId,
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

export function notebookPageToBoardLink(
  page: LessonBoardPage,
  ordinal: number,
): LessonBoardPageLink | null {
  const primary = page.primaryLink
  if (!primary) return null
  if (!primary.center) return null
  return {
    id: `nb-link:${page.id}`,
    bookId: primary.bookId,
    ...(primary.unitId?.trim() ? { unitId: primary.unitId.trim() } : {}),
    pdfPage: primary.pdfPage,
    center: clampLinkCenter(primary.center),
    boardPageRef: {
      pageId: page.id,
      ordinal,
      ...(page.title?.trim() ? { title: page.title.trim() } : {}),
      orientation: page.orientation,
    },
    createdAt: '',
  }
}

export function listBoardLinksFromNotebookPages(
  pages: readonly LessonBoardPage[],
): LessonBoardPageLink[] {
  const links: LessonBoardPageLink[] = []
  pages.forEach((page, ordinal) => {
    const link = notebookPageToBoardLink(page, ordinal)
    if (link) links.push(link)
  })
  return links
}

export function findPrimaryLinkForNotebookPage(
  pages: readonly LessonBoardPage[],
  pageId: string,
): LessonBoardPagePrimaryLink | null {
  return pages.find((page) => page.id === pageId)?.primaryLink ?? null
}

export function formatNotebookBookLinkLabel(
  link: Pick<LessonBoardPagePrimaryLink, 'bookId' | 'pdfPage'>,
  library: Pick<BookLibraryPayload, 'books'> | null | undefined,
): string {
  const book = library?.books.find((item) => item.id === link.bookId)
  const role = book ? lessonBoardDisplayLabel(book) : 'book'
  return `${role} p.${link.pdfPage}`
}

export function formatNotebookBookLinkGoToLabel(
  link: Pick<LessonBoardPagePrimaryLink, 'bookId' | 'pdfPage'> | null | undefined,
  library: Pick<BookLibraryPayload, 'books'> | null | undefined,
): string | null {
  if (!link) return null
  return `Go to ${formatNotebookBookLinkLabel(link, library)}`
}

/**
 * Copy old per-book-unit links onto notebook pages that do not yet have a primary link.
 * bookId comes from the old scope, not the currently open PDF.
 */
export function stampLegacyBoardLinksOntoPages(
  studentId: string,
  pages: readonly LessonBoardPage[],
  adapter: LessonBoardPageLinksStorageAdapter = browserLinksStorageAdapter(),
): { pages: LessonBoardPage[]; changed: boolean } {
  const id = studentId.trim()
  if (!id || pages.length === 0) return { pages: [...pages], changed: false }
  const root = adapter.readRoot()
  const candidates = new Map<string, LessonBoardPagePrimaryLink[]>()
  for (const [docId, rawLinks] of Object.entries(root)) {
    const scope = parseLessonBoardPageLinksDocId(docId)
    if (!scope || scope.studentId !== id) continue
    if (!Array.isArray(rawLinks)) continue
    for (const raw of rawLinks) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Partial<LessonBoardPageLink>
      const pageId = o.boardPageRef?.pageId?.trim()
      const pdfPage = typeof o.pdfPage === 'number' ? Math.floor(o.pdfPage) : Number.NaN
      if (!pageId || !Number.isFinite(pdfPage) || pdfPage < 1) continue
      const bookId = (typeof o.bookId === 'string' && o.bookId.trim()) || scope.bookId
      const unitId = scope.unitId.trim()
      const center = Array.isArray(o.center) && o.center.length >= 2
        ? clampLinkCenter([Number(o.center[0]), Number(o.center[1])])
        : undefined
      const stamped: LessonBoardPagePrimaryLink = {
        bookId,
        pdfPage,
        ...(unitId ? { unitId } : {}),
        ...(center ? { center } : {}),
      }
      const list = candidates.get(pageId) ?? []
      list.push(stamped)
      candidates.set(pageId, list)
    }
  }
  let changed = false
  const next = pages.map((page) => {
    const options = candidates.get(page.id)
    const preferred = pickLegacyLinkForPage(page, options)
    if (!page.primaryLink) {
      if (!preferred) return page
      changed = true
      return { ...page, primaryLink: preferred }
    }
    if (page.primaryLink.unitId?.trim()) return page
    const unitId = preferred?.unitId?.trim()
    if (!unitId || !preferred) return page
    if (preferred.bookId !== page.primaryLink.bookId || preferred.pdfPage !== page.primaryLink.pdfPage) {
      return page
    }
    changed = true
    return { ...page, primaryLink: { ...page.primaryLink, unitId } }
  })
  return { pages: next, changed }
}

function pickLegacyLinkForPage(
  page: LessonBoardPage,
  options: LessonBoardPagePrimaryLink[] | undefined,
): LessonBoardPagePrimaryLink | null {
  if (!options?.length) return null
  return (
    (page.sourceBookId ? options.find((item) => item.bookId === page.sourceBookId) : undefined) ??
    options[0]!
  )
}

/** Unit stored on the old per-book-unit link for this notebook page, if the page and spot still match. */
export function findLegacyBoardLinkUnitId(
  studentId: string,
  boardPageId: string,
  link: Pick<LessonBoardPagePrimaryLink, 'bookId' | 'pdfPage'>,
  adapter: LessonBoardPageLinksStorageAdapter = browserLinksStorageAdapter(),
): string | null {
  const id = studentId.trim()
  const pageId = boardPageId.trim()
  const bookId = link.bookId.trim()
  if (!id || !pageId || !bookId || link.pdfPage < 1) return null
  const root = adapter.readRoot()
  for (const [docId, rawLinks] of Object.entries(root)) {
    const scope = parseLessonBoardPageLinksDocId(docId)
    if (!scope || scope.studentId !== id || scope.bookId !== bookId) continue
    if (!Array.isArray(rawLinks)) continue
    for (const raw of rawLinks) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Partial<LessonBoardPageLink>
      if (o.boardPageRef?.pageId?.trim() !== pageId) continue
      const pdfPage = typeof o.pdfPage === 'number' ? Math.floor(o.pdfPage) : Number.NaN
      if (pdfPage !== link.pdfPage) continue
      const unitId = scope.unitId.trim()
      if (unitId) return unitId
    }
  }
  return null
}
