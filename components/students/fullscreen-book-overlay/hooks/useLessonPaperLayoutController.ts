import { useEffect, useMemo, useRef, useState } from 'react'

interface UseLessonPaperLayoutControllerArgs {
  activeClassSessionId: string | null
  isLessonPaperOpen: boolean
}

export function useLessonPaperLayoutController({
  activeClassSessionId,
  isLessonPaperOpen,
}: UseLessonPaperLayoutControllerArgs) {
  const [lessonPaperOverlaySize, setLessonPaperOverlaySize] = useState({ w: 0, h: 0 })
  const [lessonPaperScrollRunwayPx, setLessonPaperScrollRunwayPx] = useState(1200)
  const lessonPaperOverlayHostRef = useRef<HTMLDivElement | null>(null)
  const lessonPaperScrollRef = useRef<HTMLDivElement | null>(null)

  const lessonPaperOverlayPageNumber = useMemo(() => {
    const key = (activeClassSessionId ?? 'lesson-paper-default').trim()
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) % 100000
    }
    return 700000 + Math.max(1, hash)
  }, [activeClassSessionId])

  useEffect(() => {
    const el = lessonPaperOverlayHostRef.current
    if (!el) return

    const syncSize = () => {
      const rect = el.getBoundingClientRect()
      setLessonPaperOverlaySize({ w: Math.max(0, rect.width), h: Math.max(0, rect.height) })
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isLessonPaperOpen])

  useEffect(() => {
    const host = lessonPaperScrollRef.current
    if (!host) return

    const syncRunway = () => {
      const viewport = host.clientHeight
      const runway = Math.max(1200, Math.round(viewport * 2.6))
      setLessonPaperScrollRunwayPx(runway)
    }

    syncRunway()
    const ro = new ResizeObserver(syncRunway)
    ro.observe(host)
    return () => ro.disconnect()
  }, [isLessonPaperOpen])

  return {
    lessonPaperOverlayPageNumber,
    lessonPaperOverlaySize,
    lessonPaperScrollRunwayPx,
    lessonPaperOverlayHostRef,
    lessonPaperScrollRef,
  }
}
