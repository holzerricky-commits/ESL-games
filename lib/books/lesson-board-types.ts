import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type { InkSessionMeta } from '@/lib/books/ink-session-types'
import type { WhiteboardSessionKey } from '@/lib/books/whiteboard-session-types'

/** Width ÷ height for a portrait lesson-board page (taller than wide). */
export const LESSON_BOARD_STANDARD_ASPECT = 3 / 4

/** Width ÷ height for a wide / diagram page (16∶9). */
export const LESSON_BOARD_WIDE_ASPECT = 16 / 9

/** Default stored runway height until a viewport baseline is supplied. */
export const LESSON_BOARD_DEFAULT_CONTENT_HEIGHT_PX = 2400

export type LessonBoardPageOrientation = 'standard' | 'wide'

export type LessonBoardPage = {
  id: string
  orientation: LessonBoardPageOrientation
  title?: string
  /** Optional PDF page number when this board page was created or last edited. */
  bookPageHint?: number
  /** Locked logical canvas width (slot for standard, spread for wide). */
  logicalWidthPx?: number
  contentHeightPx: number
  commands: AnnotationCommand[]
}

export type LessonBoardWidthFallbacks = {
  slotWidthPx: number
  spreadWidthPx: number
}

export type LessonBoardDocumentFields = {
  pages: LessonBoardPage[]
  activePageId: string
}

export function newLessonBoardPageId(): string {
  return `lb-page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function defaultLessonBoardContentHeightPx(viewportHeightPx?: number): number {
  if (viewportHeightPx != null && viewportHeightPx > 0) {
    return Math.max(LESSON_BOARD_DEFAULT_CONTENT_HEIGHT_PX, Math.round(viewportHeightPx * 2.5))
  }
  return LESSON_BOARD_DEFAULT_CONTENT_HEIGHT_PX
}

export function createLessonBoardPage(
  orientation: LessonBoardPageOrientation = 'standard',
  options: {
    id?: string
    title?: string
    bookPageHint?: number
    logicalWidthPx?: number
    contentHeightPx?: number
    commands?: AnnotationCommand[]
  } = {},
): LessonBoardPage {
  return {
    id: options.id ?? newLessonBoardPageId(),
    orientation,
    ...(options.title != null ? { title: options.title } : {}),
    ...(options.bookPageHint != null ? { bookPageHint: options.bookPageHint } : {}),
    ...(options.logicalWidthPx != null && options.logicalWidthPx > 0
      ? { logicalWidthPx: options.logicalWidthPx }
      : {}),
    contentHeightPx: options.contentHeightPx ?? LESSON_BOARD_DEFAULT_CONTENT_HEIGHT_PX,
    commands: options.commands ? [...options.commands] : [],
  }
}

export function lessonBoardLogicalWidthPx(
  page: Pick<LessonBoardPage, 'orientation' | 'logicalWidthPx'>,
  fallbacks: LessonBoardWidthFallbacks,
): number {
  if (page.logicalWidthPx != null && page.logicalWidthPx > 0) return page.logicalWidthPx
  return page.orientation === 'wide'
    ? Math.max(1, fallbacks.spreadWidthPx)
    : Math.max(1, fallbacks.slotWidthPx)
}

/** Wide pages present across the spread; standard stays in the docked slot. */
export function lessonBoardUsesSpreadPresentation(orientation: LessonBoardPageOrientation): boolean {
  return orientation === 'wide'
}

export function lessonBoardPageAspect(orientation: LessonBoardPageOrientation): number {
  return orientation === 'wide' ? LESSON_BOARD_WIDE_ASPECT : LESSON_BOARD_STANDARD_ASPECT
}

/** Height from locked width ÷ aspect (wide ≈ 16∶9, standard portrait min slice). */
export function lessonBoardAspectHeightPx(
  logicalWidthPx: number,
  orientation: LessonBoardPageOrientation,
): number {
  if (logicalWidthPx <= 0) return 1
  return Math.max(1, Math.round(logicalWidthPx / lessonBoardPageAspect(orientation)))
}

/** Default stored runway height when a page is created or reset. */
export function lessonBoardMinContentHeightPx(
  orientation: LessonBoardPageOrientation,
  logicalWidthPx: number,
  viewportHeightPx?: number,
): number {
  const aspectHeight = lessonBoardAspectHeightPx(logicalWidthPx, orientation)
  if (orientation === 'wide') return aspectHeight
  return Math.max(aspectHeight, defaultLessonBoardContentHeightPx(viewportHeightPx))
}

/** Wide pages stay at fixed aspect height; standard pages may grow beyond stored min. */
export function lessonBoardResolveContentHeightPx(
  orientation: LessonBoardPageOrientation,
  logicalWidthPx: number,
  storedContentHeightPx: number,
  viewportHeightPx?: number,
): number {
  const minHeightPx = lessonBoardMinContentHeightPx(orientation, logicalWidthPx, viewportHeightPx)
  if (orientation === 'wide') return minHeightPx
  return Math.max(minHeightPx, storedContentHeightPx > 0 ? storedContentHeightPx : minHeightPx)
}

/** Wide diagram pages do not use infinite vertical runway growth. */
export function lessonBoardAllowsRunwayGrowth(orientation: LessonBoardPageOrientation): boolean {
  return orientation !== 'wide'
}

/** TOC preview box size (portrait vs landscape) inside the left rail. */
export function lessonBoardThumbDimensions(
  orientation: LessonBoardPageOrientation,
  maxBoxPx = 120,
): { widthPx: number; heightPx: number } {
  const aspect = lessonBoardPageAspect(orientation)
  if (orientation === 'wide') {
    const widthPx = maxBoxPx
    return { widthPx, heightPx: Math.max(1, Math.round(maxBoxPx / aspect)) }
  }
  const heightPx = maxBoxPx
  return { widthPx: Math.max(1, Math.round(maxBoxPx * aspect)), heightPx }
}

export function normalizeLessonBoardPageOrientation(
  page: LessonBoardPage,
): LessonBoardPage {
  return { ...page, orientation: page.orientation ?? 'standard' }
}

export function getLessonBoardActivePage(
  pages: readonly LessonBoardPage[],
  activePageId: string,
): LessonBoardPage | null {
  return pages.find((p) => p.id === activePageId) ?? null
}

/** Copy root `commands` onto the active page before persist. */
export function syncLessonBoardCommandsToActivePage<
  T extends LessonBoardDocumentFields & { commands: AnnotationCommand[] },
>(doc: T): T {
  const active = getLessonBoardActivePage(doc.pages, doc.activePageId)
  if (!active) return doc
  const pages = doc.pages.map((p) =>
    p.id === doc.activePageId ? { ...p, commands: [...doc.commands] } : p,
  )
  return { ...doc, pages }
}

/** Set root `commands` from the active page after load / page switch. */
export function syncLessonBoardActivePageToCommands<
  T extends LessonBoardDocumentFields & { commands: AnnotationCommand[] },
>(doc: T): T {
  const active = getLessonBoardActivePage(doc.pages, doc.activePageId)
  if (!active) return doc
  return { ...doc, commands: [...active.commands] }
}

export function hasLessonBoardPages(doc: { pages?: readonly LessonBoardPage[] | null }): boolean {
  return Array.isArray(doc.pages) && doc.pages.length > 0
}

/**
 * Upgrade pre–Phase-1 docs (flat `commands` only) to `pages[]` + `activePageId`.
 * Idempotent when `pages` already exist.
 */
export function migrateLessonBoardDocument<
  T extends { commands: AnnotationCommand[]; meta?: InkSessionMeta } & Partial<LessonBoardDocumentFields>,
>(doc: T, options: { defaultContentHeightPx?: number } = {}): T & LessonBoardDocumentFields {
  if (hasLessonBoardPages(doc)) {
    const pages = doc.pages!.map(normalizeLessonBoardPageOrientation)
    const activePageId =
      doc.activePageId && pages.some((p) => p.id === doc.activePageId)
        ? doc.activePageId
        : pages[0]!.id
    return { ...doc, pages: [...pages], activePageId }
  }

  const contentHeightPx =
    options.defaultContentHeightPx ?? defaultLessonBoardContentHeightPx()
  const page = createLessonBoardPage('standard', {
    contentHeightPx,
    commands: [...doc.commands],
  })
  return {
    ...doc,
    pages: [page],
    activePageId: page.id,
  }
}

export function normalizeLessonBoardSessionDocument<
  T extends { commands: AnnotationCommand[] } & Partial<LessonBoardDocumentFields>,
>(doc: T, options: { defaultContentHeightPx?: number } = {}): T & LessonBoardDocumentFields {
  const migrated = migrateLessonBoardDocument(doc, options)
  return syncLessonBoardActivePageToCommands(migrated)
}

export function prepareLessonBoardSessionForPersist<
  T extends { commands: AnnotationCommand[] } & LessonBoardDocumentFields,
>(doc: T): T {
  return syncLessonBoardCommandsToActivePage(doc)
}

/** @internal shape check for raw localStorage JSON */
export type PersistedWhiteboardSessionRaw = {
  docId: string
  key: WhiteboardSessionKey
  commands?: AnnotationCommand[]
  pages?: LessonBoardPage[]
  activePageId?: string
  meta: InkSessionMeta
}
