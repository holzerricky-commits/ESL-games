import { useEffect } from 'react'

interface UseWhiteboardOnBookUnitChangeArgs {
  selectedBookId: string | null
  selectedUnitId: string | null
  resetWhiteboardPlacementForUnit: () => void
}

/** When the focused book/unit changes, reset whiteboard placement. */
export function useWhiteboardOnBookUnitChange({
  selectedBookId,
  selectedUnitId,
  resetWhiteboardPlacementForUnit,
}: UseWhiteboardOnBookUnitChangeArgs) {
  useEffect(() => {
    if (!selectedBookId || !selectedUnitId) return
    resetWhiteboardPlacementForUnit()
  }, [selectedBookId, selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps -- reset only when book/unit changes
}
