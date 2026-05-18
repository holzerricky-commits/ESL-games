import { useEffect } from 'react'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { clampPdfPageToVisible, getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import { saveUnitPage } from '@/lib/books/progress'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseArrowKeyPageTurnArgs {
  open: boolean
  isLessonPaperOpen: boolean
  selectedBookId: string | null
  selectedUnitId: string | null
  library: BookLibraryPayload | null
  numPages: number | null
  isSinglePageMode: boolean
  pageNumber: number
  setPageNumber: (v: number) => void
}

export function useArrowKeyPageTurn({
  open,
  isLessonPaperOpen,
  selectedBookId,
  selectedUnitId,
  library,
  numPages,
  isSinglePageMode,
  pageNumber,
  setPageNumber,
}: UseArrowKeyPageTurnArgs) {
  useEffect(() => {
    if (!open || isLessonPaperOpen || !selectedUnitId || numPages == null) return

    function onArrowPageTurn(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (e.altKey || e.ctrlKey || e.metaKey) return

      if (isBookOverlayKeyboardTypingTarget()) return

      const turn = (direction: -1 | 1) => {
        if (!selectedBookId || !selectedUnitId || !library) return
        const book = library.books.find((b) => b.id === selectedBookId)
        const unit = book?.units.find((u) => u.id === selectedUnitId)
        if (!unit) return
        const nextVisiblePages = getVisiblePdfPages(unit, numPages, book ?? undefined)
        if (!nextVisiblePages.length) return
        const step = isSinglePageMode ? 1 : 2
        const currentIndex = Math.max(0, nextVisiblePages.indexOf(pageNumber))
        const nextIndex = Math.max(0, Math.min(currentIndex + direction * step, nextVisiblePages.length - 1))
        const nextPage = nextVisiblePages[nextIndex] ?? pageNumber
        const bounds = getUnitReaderBounds(unit, numPages, book ?? undefined)
        let normalizedNext = clampPdfPageToVisible(nextPage, nextVisiblePages, bounds)
        if (!isSinglePageMode) {
          const idx = nextVisiblePages.indexOf(normalizedNext)
          normalizedNext = idx >= 0 ? nextVisiblePages[Math.max(0, idx - (idx % 2))] ?? normalizedNext : normalizedNext
        }
        setPageNumber(normalizedNext)
        saveUnitPage(selectedBookId, selectedUnitId, normalizedNext)
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        turn(-1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        turn(1)
      }
    }

    window.addEventListener('keydown', onArrowPageTurn)
    return () => window.removeEventListener('keydown', onArrowPageTurn)
  }, [
    open,
    isLessonPaperOpen,
    selectedUnitId,
    numPages,
    selectedBookId,
    library,
    isSinglePageMode,
    pageNumber,
    setPageNumber,
  ])
}
