/** Legacy optional PDF span metadata. */
export interface BookPdfPageRange {
  start: number
  end: number
}

export type BookAnchorConfidence = 'high' | 'medium' | 'low'
export type BookAnchorSource = 'toc' | 'heading' | 'fallback'

/**
 * Semantic lesson-part slice (stable for features and scheduling).
 * Auto-filled from the part title when missing; override in the structure editor.
 */
export const BOOK_LESSON_PART_TAGS = [
  'unspecified',
  'vocabulary_in_context',
  'vocabulary_background',
  'comprehension',
  'main_story',
  'your_turn',
  'paired_story',
  'making_connections',
  'grammar',
  'writing_narrate',
  /** Wonders Workshop: Genre / Genre Study row */
  'genre',
  /** Wonders Workshop: Vocabulary Strategy (not the Words-to-Know list) */
  'vocabulary_strategy',
  /** Wonders Workshop poetry weeks: Literary Element */
  'literary_element',
] as const

export type BookLessonPartTag = (typeof BOOK_LESSON_PART_TAGS)[number]

/** Optional subdivision inside a unit (e.g. “Lesson A”, “Lesson B”). */
export interface BookLessonPartRecord {
  id: string
  title: string
  pdfPageRange?: BookPdfPageRange
  /** Optional start-page anchor for preview jump/navigation. */
  startPageHint?: number
  /** Optional end-page anchor inferred from TOC or sibling boundaries. */
  endPageHint?: number
  anchorConfidence?: BookAnchorConfidence
  anchorSource?: BookAnchorSource
  /** What kind of section this is (vocab block, main story, grammar, etc.). */
  structureTag?: BookLessonPartTag
}

export interface BookLessonRecord {
  id: string
  title: string
  pdfPageRange?: BookPdfPageRange
  /** Optional start-page anchor for preview jump/navigation. */
  startPageHint?: number
  /** Optional end-page anchor inferred from TOC or sibling boundaries. */
  endPageHint?: number
  anchorConfidence?: BookAnchorConfidence
  anchorSource?: BookAnchorSource
  /** Optional sections within a lesson. */
  parts?: BookLessonPartRecord[]
}

export interface BookUnitRecord {
  id: string
  title: string
  filePath: string
  /** When the book has `volumes`, which volume this unit belongs to. */
  volumeId?: string
  pdfPageRange?: BookPdfPageRange
  pdfContentStart?: number
  /** Optional start-page anchor for preview jump/navigation. */
  startPageHint?: number
  /** Optional end-page anchor inferred from TOC or sibling boundaries. */
  endPageHint?: number
  anchorConfidence?: BookAnchorConfidence
  anchorSource?: BookAnchorSource
  /** Optional lesson outline for this unit. */
  lessons?: BookLessonRecord[]
}

/** One physical/digital PDF under a teaching book (optional multi-volume products). */
export interface BookVolumeRecord {
  id: string
  title: string
  filePath: string
}

export interface BookFilePageAlignment {
  notCountedPdfPages: number[]
  hiddenPdfPages?: number[]
}

/** How a library PDF is taught. Still a PDF either way; presentation = simplified slide deck. */
export const BOOK_CONTENT_FORMATS = ['book', 'presentation'] as const

export type BookContentFormat = (typeof BOOK_CONTENT_FORMATS)[number]

export interface BookRecord {
  id: string
  title: string
  description?: string
  /**
   * Curriculum family for Library shelves (e.g. Journeys, Wonders).
   * Missing = infer on load.
   */
  series?: string
  /**
   * Optional grade label (K, G1–G6).
   * Missing = infer on load; empty string = explicitly cleared.
   */
  grade?: string
  /**
   * Optional role within a series (Student book, Workshop, Literature, …).
   * Missing = infer on load; empty string = explicitly cleared.
   */
  role?: string
  /**
   * Classic textbook vs simplified slide deck (PowerPoint exported as PDF).
   * Missing = book.
   */
  contentFormat?: BookContentFormat
  pageAlignmentByFile?: Record<string, BookFilePageAlignment>
  /** Fraction of page width pulled at spread seam (default 0.018). */
  spreadGutterPullRatio?: number
  /** Per unit PDF filePath overrides; wins over book default when present. */
  spreadGutterByFile?: Record<string, number>
  /** Relative path under book-library, e.g. book-library/journeys/cover.jpg */
  coverImagePath?: string
  /**
   * Optional physical/digital volumes (PDFs) under this teaching book.
   * Omit for classic single-PDF books. Multi-file books get volumes on load.
   */
  volumes?: BookVolumeRecord[]
  units: BookUnitRecord[]
}

export interface BookLibraryPayload {
  books: BookRecord[]
}

export interface ReaderProgressMap {
  [bookId: string]: {
    [unitId: string]: {
      page: number
      updatedAt: string
    }
  }
}
