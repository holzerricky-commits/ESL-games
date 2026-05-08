import { BookPageNotesPanel } from '@/components/students/book-page-notes-panel'

interface BookNotesPanelSectionProps {
  hasResolvedUnit: boolean
  numPages: number | null
  selectedBookId: string | null
  studentId: string
  selectedUnitId?: string
  isNotesOpen: boolean
  setIsNotesOpen: (v: boolean) => void
  notesPage: number
  setNotesPage: (v: number) => void
  unitPageBoundsMax: number
  pageNumber: number
  isSinglePageMode: boolean
}

export function BookNotesPanelSection({
  hasResolvedUnit,
  numPages,
  selectedBookId,
  studentId,
  selectedUnitId,
  isNotesOpen,
  setIsNotesOpen,
  notesPage,
  setNotesPage,
  unitPageBoundsMax,
  pageNumber,
  isSinglePageMode,
}: BookNotesPanelSectionProps) {
  if (!hasResolvedUnit || numPages == null || !selectedBookId || !selectedUnitId) return null

  return (
    <BookPageNotesPanel
      open={isNotesOpen}
      onClose={() => setIsNotesOpen(false)}
      studentId={studentId}
      bookId={selectedBookId}
      unitId={selectedUnitId}
      notesPage={notesPage}
      onNotesPageChange={setNotesPage}
      numPages={Math.min(numPages, unitPageBoundsMax)}
      spreadLeftPage={pageNumber}
      isSinglePageMode={isSinglePageMode}
    />
  )
}
