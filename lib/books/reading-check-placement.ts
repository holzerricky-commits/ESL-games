import { resolveMappedPageToPdfPage } from '@/lib/books/page-numbering'
import {
  createReadingCheckHotspotPlacement,
  DEFAULT_READING_CHECK_HOTSPOT_X,
  DEFAULT_READING_CHECK_HOTSPOT_Y,
  isDefaultReadingCheckHotspotCoords,
  primaryQuestionOfStop,
  type ReadingCheckHotspotPageSide,
  type ReadingCheckHotspotPlacement,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import { resolvePageFromStoryEvidence } from '@/lib/books/reading-story-page-markers'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

export {
  DEFAULT_READING_CHECK_HOTSPOT_X,
  DEFAULT_READING_CHECK_HOTSPOT_Y,
  isDefaultReadingCheckHotspotCoords,
}

export function guessReadingCheckPageSide(displayPage: number | null): ReadingCheckHotspotPageSide {
  if (typeof displayPage !== 'number' || displayPage < 1) return 'right'
  return displayPage % 2 === 0 ? 'left' : 'right'
}

export function createDefaultReadingCheckHotspot(args: {
  pdfPage?: number | null
  displayPage?: number | null
  pageSide?: ReadingCheckHotspotPageSide
}): ReadingCheckHotspotPlacement {
  const displayPage =
    typeof args.displayPage === 'number' && args.displayPage >= 1 ? Math.floor(args.displayPage) : null
  const pdfPage =
    typeof args.pdfPage === 'number' && args.pdfPage >= 1 ? Math.floor(args.pdfPage) : null
  return createReadingCheckHotspotPlacement({
    pdfPage,
    pageSide: args.pageSide ?? guessReadingCheckPageSide(displayPage),
    x: DEFAULT_READING_CHECK_HOTSPOT_X,
    y: DEFAULT_READING_CHECK_HOTSPOT_Y,
  })
}

export type EnsureReadingCheckPlacementCtx = {
  book?: BookRecord | null
  unit?: BookUnitRecord | null
  totalPdfPages?: number | null
  /** When true, replace hotspot with default bottom even if one exists. */
  resetHotspot?: boolean
}

function resolvePdfPageForDisplay(
  displayPage: number,
  ctx: EnsureReadingCheckPlacementCtx,
): number | null {
  if (!ctx.book || !ctx.unit) return null
  return resolveMappedPageToPdfPage(displayPage, ctx.book, ctx.unit, ctx.totalPdfPages ?? null)
}

/**
 * If the stop has a display page, ensure a bottom default pin (unless a custom pin
 * exists and resetHotspot is false).
 */
export function ensureReadingCheckStopPlacement(
  stop: ReadingCheckStop,
  ctx: EnsureReadingCheckPlacementCtx = {},
): ReadingCheckStop {
  if (stop.displayPage == null || stop.displayPage < 1) return stop
  const displayPage = Math.floor(stop.displayPage)
  const shouldReset = ctx.resetHotspot === true
  if (stop.hotspot && !shouldReset) {
    if (stop.hotspot.pdfPage == null) {
      const pdfPage = resolvePdfPageForDisplay(displayPage, ctx)
      if (pdfPage != null) {
        return {
          ...stop,
          hotspot: createReadingCheckHotspotPlacement({
            ...stop.hotspot,
            pdfPage,
          }),
        }
      }
    }
    return stop
  }

  const pdfPage = resolvePdfPageForDisplay(displayPage, ctx)
  return {
    ...stop,
    hotspot: createDefaultReadingCheckHotspot({
      displayPage,
      pdfPage,
      pageSide: guessReadingCheckPageSide(displayPage),
    }),
  }
}

export function ensureReadingCheckPackPlacements(
  stops: ReadingCheckStop[],
  ctx: EnsureReadingCheckPlacementCtx = {},
): ReadingCheckStop[] {
  return stops.map((s) => ensureReadingCheckStopPlacement(s, ctx))
}

/**
 * Prefer unique evidence→page hit over AI displayPage whenever the quote
 * resolves to one story page — so pins never land before the beat is on-page.
 * Then attach default bottom pins.
 */
export function applyStoryEvidencePagesToStops(
  stops: ReadingCheckStop[],
  storyText: string,
  ctx: EnsureReadingCheckPlacementCtx & {
    startDisplayPage?: number | null
    endDisplayPage?: number | null
  } = {},
): ReadingCheckStop[] {
  return stops.map((stop) => {
    const q = primaryQuestionOfStop(stop)
    const hit = q
      ? resolvePageFromStoryEvidence(storyText, q.evidenceSnippet, q.evidenceHighlight)
      : null

    let displayPage = stop.displayPage
    let pdfFromEvidence: number | null = null

    if (hit) {
      pdfFromEvidence = hit.pdfPage
      // Always trust a unique evidence page — even when AI’s page is still
      // inside the story range (e.g. one page early before the event appears).
      if (hit.displayPage != null) {
        displayPage = hit.displayPage
      }
    }

    const withPage: ReadingCheckStop = {
      ...stop,
      displayPage: displayPage != null && displayPage >= 1 ? Math.floor(displayPage) : null,
    }

    if (withPage.displayPage == null && pdfFromEvidence == null) {
      return withPage
    }

    if (withPage.displayPage == null && pdfFromEvidence != null) {
      return {
        ...withPage,
        hotspot: createDefaultReadingCheckHotspot({
          pdfPage: pdfFromEvidence,
          pageSide: 'right',
        }),
      }
    }

    const ensured = ensureReadingCheckStopPlacement(withPage, {
      ...ctx,
      resetHotspot: true,
    })
    if (pdfFromEvidence != null && ensured.hotspot) {
      return {
        ...ensured,
        hotspot: createReadingCheckHotspotPlacement({
          ...ensured.hotspot,
          pdfPage: pdfFromEvidence,
        }),
      }
    }
    return ensured
  })
}
