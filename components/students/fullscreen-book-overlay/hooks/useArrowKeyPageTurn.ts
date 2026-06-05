import { useEffect } from 'react'
import { isBookOverlayKeyboardTypingTarget, shouldHandleBookOverlayKeyboard } from '@/lib/books/book-overlay-keyboard-guards'

interface UseArrowKeyPageTurnArgs {
  open: boolean
  userPresented: boolean
  isLessonPaperOpen: boolean
  goToAdjacentPage: (direction: -1 | 1) => void
}

export function useArrowKeyPageTurn({
  open,
  userPresented,
  isLessonPaperOpen,
  goToAdjacentPage,
}: UseArrowKeyPageTurnArgs) {
  useEffect(() => {
    if (!shouldHandleBookOverlayKeyboard(open, userPresented) || isLessonPaperOpen) return

    function onArrowPageTurn(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (isBookOverlayKeyboardTypingTarget()) return

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
  }, [open, userPresented, isLessonPaperOpen, goToAdjacentPage])
}
