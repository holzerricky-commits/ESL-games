import { useCallback, useRef } from 'react'
import type { LessonBoardFloatRect } from '@/lib/books/lesson-board-float-layout'
import {
  clampLessonBoardFloatRect,
  lessonBoardFloatScaleFromResizeDelta,
} from '@/lib/books/lesson-board-float-layout'

interface UseWhiteboardFloatMotionArgs {
  rect: LessonBoardFloatRect
  naturalWidthPx: number
  naturalHeightPx: number
  boundsWidthPx: number
  boundsHeightPx: number
  enabled: boolean
  onCommitRect: (rect: LessonBoardFloatRect) => void
}

export function useWhiteboardFloatMotion({
  rect,
  naturalWidthPx,
  naturalHeightPx,
  boundsWidthPx,
  boundsHeightPx,
  enabled,
  onCommitRect,
}: UseWhiteboardFloatMotionArgs) {
  const dragStartRef = useRef<{
    clientX: number
    clientY: number
    leftPx: number
    topPx: number
  } | null>(null)
  const resizeStartRef = useRef<{
    clientX: number
    clientY: number
    scale: number
  } | null>(null)

  const clampRect = useCallback(
    (next: LessonBoardFloatRect) =>
      clampLessonBoardFloatRect(
        next,
        naturalWidthPx,
        naturalHeightPx,
        boundsWidthPx,
        boundsHeightPx,
      ),
    [boundsHeightPx, boundsWidthPx, naturalHeightPx, naturalWidthPx],
  )

  const onFloatDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        leftPx: rect.leftPx,
        topPx: rect.topPx,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [enabled, rect.leftPx, rect.topPx],
  )

  const onFloatDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || dragStartRef.current == null) return
      const start = dragStartRef.current
      const deltaX = e.clientX - start.clientX
      const deltaY = e.clientY - start.clientY
      onCommitRect(
        clampRect({
          ...rect,
          leftPx: start.leftPx + deltaX,
          topPx: start.topPx + deltaY,
        }),
      )
    },
    [clampRect, enabled, onCommitRect, rect],
  )

  const finishPointer = useCallback((e: React.PointerEvent) => {
    dragStartRef.current = null
    resizeStartRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }, [])

  const onFloatDragPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      finishPointer(e)
    },
    [enabled, finishPointer],
  )

  const onFloatDragPointerCancel = useCallback(() => {
    dragStartRef.current = null
    resizeStartRef.current = null
  }, [])

  const onFloatResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      resizeStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        scale: rect.scale,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [enabled, rect.scale],
  )

  const onFloatResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || resizeStartRef.current == null) return
      const start = resizeStartRef.current
      const deltaX = e.clientX - start.clientX
      const deltaY = e.clientY - start.clientY
      const scale = lessonBoardFloatScaleFromResizeDelta(
        start.scale,
        naturalWidthPx,
        naturalHeightPx,
        deltaX,
        deltaY,
      )
      onCommitRect(clampRect({ ...rect, scale }))
    },
    [clampRect, enabled, naturalHeightPx, naturalWidthPx, onCommitRect, rect],
  )

  const onFloatResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return
      finishPointer(e)
    },
    [enabled, finishPointer],
  )

  const onFloatResizePointerCancel = useCallback(() => {
    resizeStartRef.current = null
  }, [])

  return {
    onFloatDragPointerDown,
    onFloatDragPointerMove,
    onFloatDragPointerUp,
    onFloatDragPointerCancel,
    onFloatResizePointerDown,
    onFloatResizePointerMove,
    onFloatResizePointerUp,
    onFloatResizePointerCancel,
  }
}
