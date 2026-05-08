import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

interface UseNotesWhiteboardOnBookUnitChangeArgs {
  selectedBookId: string | null
  selectedUnitId: string | null
  pageNumber: number
  setNotesPage: Dispatch<SetStateAction<number>>
  setWhiteboardPage: Dispatch<SetStateAction<number>>
  setLessonPaperViewMode: Dispatch<SetStateAction<'left' | 'right' | 'split'>>
  lessonPaperPanRef: MutableRefObject<number>
}

/** When the focused book/unit changes, sync notes/whiteboard targets to the current reader page and reset lesson-paper split pan. */
export function useNotesWhiteboardOnBookUnitChange({
  selectedBookId,
  selectedUnitId,
  pageNumber,
  setNotesPage,
  setWhiteboardPage,
  setLessonPaperViewMode,
  lessonPaperPanRef,
}: UseNotesWhiteboardOnBookUnitChangeArgs) {
  useEffect(() => {
    if (!selectedBookId || !selectedUnitId) return
    setNotesPage(pageNumber)
    setWhiteboardPage(pageNumber)
    setLessonPaperViewMode('left')
    lessonPaperPanRef.current = 0
  }, [selectedBookId, selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps -- sync to current page only when book/unit changes
}
