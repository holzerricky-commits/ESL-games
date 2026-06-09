'use client'

import { useEffect, useRef } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  lessonBoardPageHasCanvasInk,
  LESSON_BOARD_THUMB_WIDTH_PX,
  paintLessonBoardPageThumbnail,
} from '@/lib/books/lesson-board-page-thumbnail'
import {
  lessonBoardThumbDimensions,
  type LessonBoardPageOrientation,
} from '@/lib/books/lesson-board-types'
import { cn } from '@/lib/utils'

export interface LessonBoardPageThumbnailProps {
  commands: readonly AnnotationCommand[]
  orientation?: LessonBoardPageOrientation
  width?: number
  scrollRoot?: HTMLElement | null
  label: string
  className?: string
}

export function LessonBoardPageThumbnail({
  commands,
  orientation = 'standard',
  width = LESSON_BOARD_THUMB_WIDTH_PX,
  scrollRoot,
  label,
  className,
}: LessonBoardPageThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inkRef = useRef<HTMLCanvasElement | null>(null)
  const markerRef = useRef<HTMLCanvasElement | null>(null)
  const paintedRef = useRef(false)
  const { widthPx, heightPx } = lessonBoardThumbDimensions(orientation, width)
  const hasInk = lessonBoardPageHasCanvasInk(commands)

  useEffect(() => {
    paintedRef.current = false
  }, [commands, heightPx, orientation, widthPx])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    const paint = () => {
      if (cancelled || paintedRef.current) return
      const ink = inkRef.current
      const marker = markerRef.current
      if (!ink || !marker) return
      paintLessonBoardPageThumbnail(ink, marker, commands, widthPx, heightPx)
      paintedRef.current = true
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) paint()
      },
      { root: scrollRoot ?? null, rootMargin: '200px 0px', threshold: 0 },
    )
    obs.observe(el)
    paint()
    return () => {
      cancelled = true
      obs.disconnect()
    }
  }, [commands, heightPx, scrollRoot, widthPx])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded border border-[#5c4030]/20 bg-[#FDFCFB] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]',
        className,
      )}
      style={{
        width: widthPx,
        height: heightPx,
        backgroundImage: 'radial-gradient(circle, rgba(75, 85, 99, 0.22) 0.7px, transparent 0.82px)',
        backgroundSize: '12px 12px',
      }}
      aria-label={label}
    >
      <canvas ref={inkRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      <canvas
        ref={markerRef}
        className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
        aria-hidden
      />
      {!hasInk ? (
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-[#5c4030]/35">
          Empty
        </span>
      ) : null}
    </div>
  )
}
