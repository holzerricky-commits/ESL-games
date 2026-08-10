/** Cross-UI signals: check editor ↔ book reader for pin placement. */

export const READING_CHECK_HOTSPOT_PLACE_START_EVENT = 'reading-check-hotspot-place-start'
export const READING_CHECK_HOTSPOT_PLACE_RESULT_EVENT = 'reading-check-hotspot-place-result'
export const READING_CHECK_HOTSPOT_PLACE_CANCELLED_EVENT = 'reading-check-hotspot-place-cancelled'
export const READING_CHECK_HOTSPOT_TRY_EVENT = 'reading-check-hotspot-try'
/** Close check editor / prep sheet so the full spread is visible for placing. */
export const READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT = 'reading-check-hotspot-place-ui-dismiss'

export type ReadingCheckHotspotPlaceStartDetail = {
  stopId: string
  storyId: string
  bookId: string
  unitId: string
}

export type ReadingCheckHotspotPlaceResultDetail = {
  stopId: string
  storyId: string
  bookId: string
  unitId: string
  pdfPage: number
  x: number
  y: number
  pageSide: 'left' | 'right'
  displayPage: number | null
}

export type ReadingCheckHotspotTryDetail = {
  stopId: string
  storyId: string
}

type PlaceStartHandler = (detail: ReadingCheckHotspotPlaceStartDetail) => boolean

let placeStartHandler: PlaceStartHandler | null = null

/** Book overlay registers while open so the editor can start placement. */
export function registerReadingCheckHotspotPlaceStartHandler(handler: PlaceStartHandler): () => void {
  placeStartHandler = handler
  return () => {
    if (placeStartHandler === handler) placeStartHandler = null
  }
}

/** Returns false when no open book is ready to place on. */
export function requestReadingCheckHotspotPlacement(detail: ReadingCheckHotspotPlaceStartDetail): boolean {
  return placeStartHandler?.(detail) ?? false
}

/** Hide check editor dialogs / prep sheets while the teacher places on the book. */
export function dismissReadingCheckPlacementUi(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT))
}

export function dispatchReadingCheckHotspotPlaceResult(detail: ReadingCheckHotspotPlaceResultDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(READING_CHECK_HOTSPOT_PLACE_RESULT_EVENT, { detail }))
}

export function dispatchReadingCheckHotspotPlaceCancelled(detail: { stopId: string }): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(READING_CHECK_HOTSPOT_PLACE_CANCELLED_EVENT, { detail }))
}

export function dispatchReadingCheckHotspotTry(detail: ReadingCheckHotspotTryDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(READING_CHECK_HOTSPOT_TRY_EVENT, { detail }))
}
