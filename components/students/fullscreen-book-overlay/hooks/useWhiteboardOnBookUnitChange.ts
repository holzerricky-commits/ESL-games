import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

interface UseWhiteboardOnBookUnitChangeArgs {
  selectedBookId: string | null
  selectedUnitId: string | null
  resetWhiteboardPlacementForUnit: () => void
  setLessonPaperViewMode: Dispatch<SetStateAction<'left' | 'right' | 'split'>>
  lessonPaperPanRef: MutableRefObject<number>
}

/** When the focused book/unit changes, reset whiteboard placement and lesson-paper split pan. */
export function useWhiteboardOnBookUnitChange({
  selectedBookId,
  selectedUnitId,
  resetWhiteboardPlacementForUnit,
  setLessonPaperViewMode,
  lessonPaperPanRef,
}: UseWhiteboardOnBookUnitChangeArgs) {
  useEffect(() => {
    if (!selectedBookId || !selectedUnitId) return
    resetWhiteboardPlacementForUnit()
    setLessonPaperViewMode('left')
    lessonPaperPanRef.current = 0
  }, [selectedBookId, selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps -- reset only when book/unit changes
}
