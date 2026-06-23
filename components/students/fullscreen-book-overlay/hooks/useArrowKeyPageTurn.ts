import { useEffect } from 'react'
import { shouldDeferBookOverlayToolShortcuts } from '@/lib/books/book-overlay-keyboard-guards'

interface UseArrowKeyPageTurnArgs {
  open: boolean
  isLessonPaperOpen: boolean
  goToAdjacentPage: (direction: -1 | 1) => void
}

export function useArrowKeyPageTurn({
  open,
  isLessonPaperOpen,
  goToAdjacentPage,
}: UseArrowKeyPageTurnArgs) {
  useEffect(() => {
    if (!open || isLessonPaperOpen) return

    function onArrowPageTurn(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (shouldDeferBookOverlayToolShortcuts()) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToAdjacentPage(-1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToAdjacentPage(1)
      }
    }

    window.addEventListener('keydown', onArrowPageTurn)
    return () => window.removeEventListener('keydown', onArrowPageTurn)
  }, [open, isLessonPaperOpen, goToAdjacentPage])
}
