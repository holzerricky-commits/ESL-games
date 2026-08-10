import type { PageNumberingMode } from '@/lib/books/page-numbering'
import type { PasteImageOutcome } from '@/lib/books/clipboard-image'

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
}
