import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

interface UseWhiteboardOnBookUnitChangeArgs {
  selectedBookId: string | null
  selectedUnitId: string | null
  pageNumber: number
  setWhiteboardPage: Dispatch<SetStateAction<number>>
  setLessonPaperViewMode: Dispatch<SetStateAction<'left' | 'right' | 'split'>>
  lessonPaperPanRef: MutableRefObject<number>
}

/** When the focused book/unit changes, sync whiteboard target to the current reader page and reset lesson-paper split pan. */
export function useWhiteboardOnBookUnitChange({
  selectedBookId,
  selectedUnitId,
  pageNumber,
  setWhiteboardPage,
  setLessonPaperViewMode,
  lessonPaperPanRef,
}: UseWhiteboardOnBookUnitChangeArgs) {
  useEffect(() => {
    if (!selectedBookId || !selectedUnitId) return
    setWhiteboardPage(pageNumber)
    setLessonPaperViewMode('left')
    lessonPaperPanRef.current = 0
  }, [selectedBookId, selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps -- sync to current page only when book/unit changes
}
