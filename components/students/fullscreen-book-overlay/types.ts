import type { PageNumberingMode } from '@/lib/books/page-numbering'

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
  /** Fired once when the first spread is ready to show; parent should set `presented` to `true`. */
  onBookReadyToPresent?: () => void
  /** Fired if first-spread paint exceeds the wait cap while `presented` is still false; parent should disarm `open`. */
  onBookOpenPaintTimeout?: () => void
}
