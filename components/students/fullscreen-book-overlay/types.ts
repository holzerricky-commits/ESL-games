import type { ReactNode } from 'react'
import type { StudentBookAssignmentStatus } from '@/lib/types'
import type { PageNumberingMode } from '@/lib/books/page-numbering'
import type { PasteImageOutcome } from '@/lib/books/clipboard-image'
import type { ReadingCheckStop } from '@/lib/books/reading-check-pack'

/** Paste pictures onto the book spread (spread session layer). */
export type SpreadImagePasteHandle = {
  pasteImageFromSystemClipboard: () => Promise<PasteImageOutcome>
}

/** Emitted when a unit PDF is ready; optional `pageAspectRatio` primes layout before first `PdfPage` paint (B3). */
export interface BookReaderDocumentReadyMeta {
  numPages: number
  pageAspectRatio?: number
}

export interface FullscreenBookOverlayProps {
  studentId: string
  activeClassSessionId?: string | null
  assignedBookIds: string[]
  /** When set, class tabs use in-class books only. Missing ids stay in class. */
  bookAssignmentStatus?: Record<string, StudentBookAssignmentStatus>
  assignedUnitRefs?: Array<{ bookId: string; unitId: string }>
  curriculumHistory?: Array<{
    id: string
    bookId: string
    unitId: string
    page: number
    openedAt: string
    closedAt?: string
  }>
  /** Display name for watermarks and export metadata. */
  studentName?: string
  numberingMode?: PageNumberingMode
  open: boolean
  onClose: () => void
  /**
   * When `false` while `open`, the book shell stays invisible and does not capture pointers until
   * `onBookReadyToPresent` runs (first spread painted). Use with map-side loading. Defaults to `true`.
   */
  presented?: boolean
  /** Fired once when the first spread is painted off-screen; parent should enable the open control (not auto-present). */
  onBookReadyToPresent?: () => void
  /** Fired when spread layout width changes and paint must be re-validated; parent should disable the open control. */
  onBookPaintInvalidated?: () => void
  /** Fired if first-spread paint exceeds the wait cap while `presented` is still false; parent should disarm `open`. */
  onBookOpenPaintTimeout?: () => void
  /** Fired when focus-zoom presentation mode (theater scrim) turns on or off. */
  onFocusPresentationChange?: (active: boolean) => void
  /** Fired when the lesson board is open and not minimized (covers class chrome). */
  onLessonBoardOpenChange?: (open: boolean) => void
  /** Planned/prepared class (not live yet). Board chrome keeps link-to-book visible
   * instead of burying it under More.
   */
  isPrepMode?: boolean
  /** Map URL `book` — explicit teaching target (overrides assignment defaults when valid). */
  preferBookId?: string | null
  /** Map URL `unit` — explicit unit when paired with `preferBookId`. */
  preferUnitId?: string | null
  /** Open on this PDF page (Books workshop / jump-to-part). Wins over student resume. */
  preferOpenPdfPage?: number | null
  /** When true, open the Exercises rail once the book is open (workshop mark → Exercise). */
  preferOpenExercises?: boolean
  /** Switch the teaching book without closing the overlay (class source strip). */
  onSwitchTeachingBook?: (bookId: string, unitId: string) => void
  /** Docked top chrome (place bar). Reserves space so it does not cover the book. */
  topChrome?: ReactNode
  /** Left desk rail (e.g. workshop story tools). Pushes the book like Listening. */
  deskRail?: ReactNode
  deskRailOpen?: boolean
  onDeskRailOpenChange?: (open: boolean) => void
  /** Width the book is pushed by while `deskRail` is open. Defaults to the icon rail width. */
  deskRailWidthPx?: number
  /** Turn to the spread holding this PDF page whenever the value changes. */
  focusPdfPage?: number | null
  /** Prep desk: show draft check stops as pins instead of the approved live pack. */
  prepReadingCheckPins?: PrepReadingCheckPins | null
  /** Fired when the visible spread changes (PDF pages; right is null on a single page). */
  onSpreadChange?: (spread: BookReaderSpread) => void
}

export interface BookReaderSpread {
  leftPdfPage: number
  rightPdfPage: number | null
}

export interface PrepReadingCheckPins {
  storyId: string
  stops: readonly ReadingCheckStop[]
  activeStopId: string | null
  onSelectStop?: (stopId: string) => void
}
