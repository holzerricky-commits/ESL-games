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

export interface BookFilePageAlignment {
  notCountedPdfPages: number[]
  hiddenPdfPages?: number[]
}

export interface BookRecord {
  id: string
  title: string
  description?: string
  pageAlignmentByFile?: Record<string, BookFilePageAlignment>
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
