import { useEffect } from 'react'
import { shouldDeferBookOverlayToolShortcuts } from '@/lib/books/book-overlay-keyboard-guards'

interface UseArrowKeyPageTurnArgs {
  open: boolean
  /** When false (e.g. Overview grid), leave arrows alone so the grid can scroll. */
  enabled?: boolean
  goToAdjacentPage: (direction: -1 | 1) => void
}

export function useArrowKeyPageTurn({
  open,
  enabled = true,
  goToAdjacentPage,
}: UseArrowKeyPageTurnArgs) {
  useEffect(() => {
    if (!open || !enabled) return

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

    window.addEventListener('keydown', onArrowPageTurn, true)
    return () => window.removeEventListener('keydown', onArrowPageTurn, true)
  }, [open, enabled, goToAdjacentPage])
}
