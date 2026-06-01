/**
 * Tracks the anchor spread the map route is warming so cache-readiness checks
 * match `warmMapInitialBookSpreadPrefetch` without re-parsing the PDF.
 */

import { areReaderSpreadPagesPrefetched } from '@/lib/books/reader-spread-prefetch-ready'

export type MapAnchorSpreadContext = {
  unitId: string
  anchorPage: number
  visiblePages: number[]
  isSinglePageMode: boolean
  widthPx: number
}

let mapAnchorSpreadContext: MapAnchorSpreadContext | null = null

export function setMapAnchorSpreadContext(ctx: MapAnchorSpreadContext | null): void {
  mapAnchorSpreadContext = ctx
}

export function getMapAnchorSpreadContext(): MapAnchorSpreadContext | null {
  return mapAnchorSpreadContext
}

export function isMapAnchorSpreadCacheReady(widthPx?: number): boolean {
  const ctx = mapAnchorSpreadContext
  if (!ctx) return false
  const w = widthPx ?? ctx.widthPx
  return areReaderSpreadPagesPrefetched({
    unitId: ctx.unitId,
    anchorPage: ctx.anchorPage,
    visiblePages: ctx.visiblePages,
    isSinglePageMode: ctx.isSinglePageMode,
    spreadPageWidthPx: w,
  })
}
