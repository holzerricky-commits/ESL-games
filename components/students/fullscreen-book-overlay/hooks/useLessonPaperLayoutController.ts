import { useEffect, useRef, useState } from 'react'

interface UseLessonPaperLayoutControllerArgs {
  isLessonPaperOpen: boolean
}

export function useLessonPaperLayoutController({ isLessonPaperOpen }: UseLessonPaperLayoutControllerArgs) {
  const [lessonPaperScrollRunwayPx, setLessonPaperScrollRunwayPx] = useState(1200)
  const lessonPaperScrollRef = useRef<HTMLDivElement | null>(null)

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
    lessonPaperScrollRunwayPx,
    lessonPaperScrollRef,
  }
}
