import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { getUnitReaderBounds } from '@/lib/books/page-range'

interface UseFullscreenOverlayPanelsArgs {
  animationMs: number
  open: boolean
  setIsMounted: (v: boolean) => void
  setIsVisible: (v: boolean) => void
  setIsPageListOpen: (v: boolean) => void
  setIsNotesOpen: (v: boolean) => void
  setIsWhiteboardOpen: (v: boolean) => void
  isLessonPaperOpen: boolean
  setLessonPaperViewMode: (v: 'left' | 'right' | 'split') => void
  lessonPaperPanRef: MutableRefObject<number>
  isNotesOpen: boolean
  isWhiteboardOpen: boolean
  isPageListOpen: boolean
  pageNumber: number
  isSinglePageMode: boolean
  numPages: number | null
  library: BookLibraryPayload | null
  selectedBookId: string | null
  selectedUnitId: string | null
  setNotesPage: Dispatch<SetStateAction<number>>
  setWhiteboardPage: Dispatch<SetStateAction<number>>
}

export function useFullscreenOverlayPanels({
  animationMs,
  open,
  setIsMounted,
  setIsVisible,
  setIsPageListOpen,
  setIsNotesOpen,
  setIsWhiteboardOpen,
  isLessonPaperOpen,
  setLessonPaperViewMode,
  lessonPaperPanRef,
  isNotesOpen,
  isWhiteboardOpen,
  isPageListOpen,
  pageNumber,
  isSinglePageMode,
  numPages,
  library,
  selectedBookId,
  selectedUnitId,
  setNotesPage,
  setWhiteboardPage,
}: UseFullscreenOverlayPanelsArgs) {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    if (open) {
      setIsMounted(true)
      timeoutId = setTimeout(() => setIsVisible(true), 16)
    } else {
      setIsVisible(false)
      timeoutId = setTimeout(() => setIsMounted(false), animationMs)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [animationMs, open, setIsMounted, setIsVisible])

  useEffect(() => {
    if (!open) {
      setIsPageListOpen(false)
      setIsNotesOpen(false)
      setIsWhiteboardOpen(false)
    }
  }, [open, setIsNotesOpen, setIsPageListOpen, setIsWhiteboardOpen])

  useEffect(() => {
    if (!isLessonPaperOpen) {
      setLessonPaperViewMode('left')
      lessonPaperPanRef.current = 0
    }
  }, [isLessonPaperOpen, setLessonPaperViewMode])

  useEffect(() => {
    if (!isNotesOpen) return
    if (isSinglePageMode) {
      setNotesPage(pageNumber)
      return
    }
    if (numPages == null || !library || !selectedBookId || !selectedUnitId) return
    const book = library.books.find((b) => b.id === selectedBookId)
    const unit = book?.units.find((u) => u.id === selectedUnitId)
    if (!unit) return
    const cap = Math.min(numPages, getUnitReaderBounds(unit, numPages, book ?? undefined).max)
    setNotesPage((p) => {
      const right = pageNumber + 1
      if (p === pageNumber || (right <= cap && p === right)) return p
      return pageNumber
    })
  }, [
    isNotesOpen,
    isSinglePageMode,
    library,
    numPages,
    pageNumber,
    selectedBookId,
    selectedUnitId,
    setNotesPage,
  ])

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

  useEffect(() => {
    if (isNotesOpen) setIsWhiteboardOpen(false)
  }, [isNotesOpen, setIsWhiteboardOpen])

  useEffect(() => {
    if (isWhiteboardOpen) setIsNotesOpen(false)
  }, [isWhiteboardOpen, setIsNotesOpen])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (isNotesOpen) {
        e.preventDefault()
        setIsNotesOpen(false)
        return
      }
      if (isWhiteboardOpen) {
        e.preventDefault()
        setIsWhiteboardOpen(false)
        return
      }
      if (!isPageListOpen) return
      e.preventDefault()
      setIsPageListOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, isNotesOpen, isWhiteboardOpen, isPageListOpen, setIsNotesOpen, setIsPageListOpen, setIsWhiteboardOpen])
}
