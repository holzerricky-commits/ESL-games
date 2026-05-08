import type { PageNumberingMode } from '@/lib/books/page-numbering'

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
}
