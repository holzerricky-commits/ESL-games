import { useCallback, useEffect, useState } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  lessonBoardAllowsRunwayGrowth,
  lessonBoardMinContentHeightPx,
  lessonBoardResolveContentHeightPx,
  type LessonBoardPageOrientation,
} from '@/lib/books/lesson-board-types'

const GROWTH_BAND_THRESHOLD = 0.85

function maxNormY(commands: readonly AnnotationCommand[]): number {
  let max = 0
  for (const cmd of commands) {
    if (cmd.kind === 'stroke') {
      for (const [, y] of cmd.points) max = Math.max(max, y)
    } else if (cmd.kind === 'line') {
      max = Math.max(max, cmd.a[1], cmd.b[1])
    } else if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') {
      max = Math.max(max, cmd.y, cmd.y + cmd.h)
    } else if (cmd.kind === 'arrow') {
      max = Math.max(max, cmd.from[1], cmd.to[1])
    } else if (cmd.kind === 'callout') {
      max = Math.max(max, cmd.center[1])
    } else if (cmd.kind === 'text' || cmd.kind === 'sticky') {
      max = Math.max(max, cmd.y, cmd.y + ('h' in cmd ? cmd.h : 0))
    } else if (cmd.kind === 'stamp') {
      max = Math.max(max, cmd.center[1])
    }
  }
  return max
}

interface UseLessonBoardPageRunwayArgs {
  enabled: boolean
  viewportHeightPx: number
  logicalWidthPx: number
  orientation: LessonBoardPageOrientation
  /** Persisted height on the active lesson-board page. */
  storedContentHeightPx: number
  activePageId: string
  commands: readonly AnnotationCommand[]
  onPersistContentHeight: (heightPx: number) => void
}

export function useLessonBoardPageRunway({
  enabled,
  viewportHeightPx,
  logicalWidthPx,
  orientation,
  storedContentHeightPx,
  activePageId,
  commands,
  onPersistContentHeight,
}: UseLessonBoardPageRunwayArgs) {
  const resolveHeight = useCallback(
    (stored = storedContentHeightPx) =>
      lessonBoardResolveContentHeightPx(
        orientation,
        Math.max(1, logicalWidthPx),
        stored,
        viewportHeightPx,
      ),
    [logicalWidthPx, orientation, storedContentHeightPx, viewportHeightPx],
  )

  const [contentHeightPx, setContentHeightPx] = useState(() => resolveHeight())

  useEffect(() => {
    if (!enabled || viewportHeightPx <= 0) return
    const resolved = resolveHeight()
    setContentHeightPx(resolved)
    if (orientation === 'wide' && storedContentHeightPx > resolved) {
      onPersistContentHeight(resolved)
    }
  }, [
    activePageId,
    enabled,
    logicalWidthPx,
    onPersistContentHeight,
    orientation,
    resolveHeight,
    storedContentHeightPx,
    viewportHeightPx,
  ])

  const maybeGrowFromCommands = useCallback(
    (cmds: readonly AnnotationCommand[]) => {
      if (!enabled || viewportHeightPx <= 0 || !lessonBoardAllowsRunwayGrowth(orientation)) return
      const maxY = maxNormY(cmds)
      if (maxY < GROWTH_BAND_THRESHOLD) return
      const min = lessonBoardMinContentHeightPx(orientation, Math.max(1, logicalWidthPx), viewportHeightPx)
      setContentHeightPx((prev) => {
        const needed = Math.ceil(maxY * prev + viewportHeightPx)
        const next = Math.max(prev, min, needed)
        if (next !== prev) onPersistContentHeight(next)
        return next
      })
    },
    [enabled, logicalWidthPx, onPersistContentHeight, orientation, viewportHeightPx],
  )

  useEffect(() => {
    maybeGrowFromCommands(commands)
  }, [commands, maybeGrowFromCommands])

  const extendRunway = useCallback(() => {
    if (viewportHeightPx <= 0 || !lessonBoardAllowsRunwayGrowth(orientation)) return
    setContentHeightPx((prev) => {
      const next = prev + viewportHeightPx
      onPersistContentHeight(next)
      return next
    })
  }, [onPersistContentHeight, orientation, viewportHeightPx])

  return {
    lessonBoardContentHeightPx: contentHeightPx,
    extendLessonBoardRunway: extendRunway,
  }
}
