/**
 * Launcher cover mockup frame ratio — from Journeys G4 student book PDF page 1
 * (`book-library/journeys-g4/journeys G4 学生用书.pdf`, measured via pdf.js viewport).
 */
export const BOOK_COVER_MOCKUP_REF_PAGE_WIDTH = 595.22
export const BOOK_COVER_MOCKUP_REF_PAGE_HEIGHT = 759.7953

/** CSS `aspect-ratio` value (width / height). */
export const BOOK_COVER_MOCKUP_ASPECT_RATIO =
  BOOK_COVER_MOCKUP_REF_PAGE_WIDTH / BOOK_COVER_MOCKUP_REF_PAGE_HEIGHT

export function bookCoverMockupHeightPx(widthPx: number): number {
  return Math.round(widthPx * (BOOK_COVER_MOCKUP_REF_PAGE_HEIGHT / BOOK_COVER_MOCKUP_REF_PAGE_WIDTH))
}
