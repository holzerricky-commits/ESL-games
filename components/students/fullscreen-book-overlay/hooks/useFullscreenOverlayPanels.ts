import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { getUnitReaderBounds } from '@/lib/books/page-range'

interface UseFullscreenOverlayPanelsArgs {
  open: boolean
  /** When false while `open`, keep exit opacity until reader shell can show real content (B2). */
  presentationReady: boolean
  /** When false while `open`, do not fade the overlay in yet (map defers visible open until first paint). */
  userPresented: boolean
  setIsMounted: (v: boolean) => void
  setIsVisible: (v: boolean) => void
  setIsPageListOpen: (v: boolean) => void
  setIsWhiteboardOpen: (v: boolean) => void
  isLessonPaperOpen: boolean
  setLessonPaperViewMode: (v: 'left' | 'right' | 'split') => void
  lessonPaperPanRef: MutableRefObject<number>
  isWhiteboardOpen: boolean
  isPageListOpen: boolean
  pageNumber: number
  isSinglePageMode: boolean
  numPages: number | null
  library: BookLibraryPayload | null
  selectedBookId: string | null
  selectedUnitId: string | null
  setWhiteboardPage: Dispatch<SetStateAction<number>>
}

export function useFullscreenOverlayPanels({
  open,
  presentationReady,
  userPresented,
  setIsMounted,
  setIsVisible,
  setIsPageListOpen,
  setIsWhiteboardOpen,
  isLessonPaperOpen,
  setLessonPaperViewMode,
  lessonPaperPanRef,
  isWhiteboardOpen,
  isPageListOpen,
  pageNumber,
  isSinglePageMode,
  numPages,
  library,
  selectedBookId,
  selectedUnitId,
  setWhiteboardPage,
}: UseFullscreenOverlayPanelsArgs) {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    if (open) {
      setIsMounted(true)
      if (presentationReady && userPresented) {
        timeoutId = setTimeout(() => setIsVisible(true), 16)
      } else {
        setIsVisible(false)
      }
    } else {
      setIsVisible(false)
      // B1: keep `isMounted` true after the first open so reader DOM + cached PDF stay warm (no delayed unmount).
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [open, presentationReady, userPresented, setIsMounted, setIsVisible])

  useEffect(() => {
    if (!open) {
      setIsPageListOpen(false)
      setIsWhiteboardOpen(false)
    }
  }, [open, setIsPageListOpen, setIsWhiteboardOpen])

  useEffect(() => {
    if (!isLessonPaperOpen) {
      setLessonPaperViewMode('left')
      lessonPaperPanRef.current = 0
    }
  }, [isLessonPaperOpen, setLessonPaperViewMode])

  useEffect(() => {
    if (!isWhiteboardOpen) return
    if (isSinglePageMode) {
      setWhiteboardPage(pageNumber)
      return
    }
    if (numPages == null || !library || !selectedBookId || !selectedUnitId) return
    const book = library.books.find((b) => b.id === selectedBookId)
    const unit = book?.units.find((u) => u.id === selectedUnitId)
    if (!unit) return
    const cap = Math.min(numPages, getUnitReaderBounds(unit, numPages, book ?? undefined).max)
    setWhiteboardPage((p) => {
      const right = pageNumber + 1
      if (p === pageNumber || (right <= cap && p === right)) return p
      return pageNumber
    })
  }, [
    isSinglePageMode,
    isWhiteboardOpen,
    library,
    numPages,
    pageNumber,
    selectedBookId,
    selectedUnitId,
    setWhiteboardPage,
  ])

}
