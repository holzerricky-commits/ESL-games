import { useCallback, useEffect, useMemo } from 'react'
import type { RefObject } from 'react'

interface UseLessonPaperNotebookCanvasScrollArgs {
  isLessonPaperOpen: boolean
  visiblePages: number[]
  lessonPaperScrollRef: RefObject<HTMLDivElement | null>
  setLessonPaperCanvasPageIndex: (index: number) => void
}

export function useLessonPaperNotebookCanvasScroll({
  isLessonPaperOpen,
  visiblePages,
  lessonPaperScrollRef,
  setLessonPaperCanvasPageIndex,
}: UseLessonPaperNotebookCanvasScrollArgs) {
  const pageListNumbers = useMemo(() => visiblePages, [visiblePages])

  const scrollNotebookCanvasByPage = useCallback(
    (direction: -1 | 1) => {
      const host = lessonPaperScrollRef.current
      if (!host) return
      const pageHeight = Math.max(1, host.clientHeight)
      const currentIndex = Math.round(host.scrollTop / pageHeight)
      const nextIndex = Math.max(
        0,
        Math.min(Math.max(0, pageListNumbers.length - 1), currentIndex + direction),
      )
      host.scrollTo({ top: nextIndex * pageHeight, behavior: 'smooth' })
      setLessonPaperCanvasPageIndex(nextIndex)
    },
    [lessonPaperScrollRef, pageListNumbers],
  )

  useEffect(() => {
    if (!isLessonPaperOpen) return
    const host = lessonPaperScrollRef.current
    if (!host) return
    const syncIndex = () => {
      const pageHeight = Math.max(1, host.clientHeight)
      const idx = Math.round(host.scrollTop / pageHeight)
      const bounded = Math.max(0, Math.min(Math.max(0, pageListNumbers.length - 1), idx))
      setLessonPaperCanvasPageIndex(bounded)
    }
    syncIndex()
    host.addEventListener('scroll', syncIndex, { passive: true })
    return () => host.removeEventListener('scroll', syncIndex)
  }, [isLessonPaperOpen, pageListNumbers.length, lessonPaperScrollRef, setLessonPaperCanvasPageIndex])

  return { pageListNumbers, scrollNotebookCanvasByPage }
}
