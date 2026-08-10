import { useCallback, useEffect, useState } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  lessonBoardAllowsRunwayGrowth,
  lessonBoardHeightToKeepOneViewportBelowView,
  lessonBoardMaxContentHeightPx,
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
    } else if (cmd.kind === 'text' || cmd.kind === 'sticky' || cmd.kind === 'image' || cmd.kind === 'flashcard') {
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
    (stored = storedContentHeightPx) => {
      const width = Math.max(1, logicalWidthPx)
      const min = lessonBoardMinContentHeightPx(orientation, width, viewportHeightPx)
      // Empty pages stay at min (~two viewports) — drop leftover taller runway from older sessions.
      if (orientation === 'standard' && commands.length === 0) {
        return min
      }
      return lessonBoardResolveContentHeightPx(orientation, width, stored, viewportHeightPx)
    },
    [commands.length, logicalWidthPx, orientation, storedContentHeightPx, viewportHeightPx],
  )

  const [contentHeightPx, setContentHeightPx] = useState(() => resolveHeight())

  useEffect(() => {
    if (!enabled || viewportHeightPx <= 0) return
    const resolved = resolveHeight()
    setContentHeightPx(resolved)
    if (resolved !== storedContentHeightPx && storedContentHeightPx > 0) {
      // Wide clamp, or empty standard page trimmed to min (view + one blank).
      if (
        orientation === 'wide' ||
        (orientation === 'standard' && commands.length === 0 && resolved < storedContentHeightPx)
      ) {
        onPersistContentHeight(resolved)
      }
    }
  }, [
    activePageId,
    commands.length,
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
      const max = lessonBoardMaxContentHeightPx(viewportHeightPx)
      setContentHeightPx((prev) => {
        const needed = Math.ceil(maxY * prev + viewportHeightPx)
        const next = Math.min(max, Math.max(prev, min, needed))
        if (next !== prev) onPersistContentHeight(next)
        return next
      })
    },
    [enabled, logicalWidthPx, onPersistContentHeight, orientation, viewportHeightPx],
  )

  /**
   * Trim only extreme leftover empty runway under notes.
   * Always keep ≥ one viewport below the last content (and ≥ min = view + one blank).
   */
  const maybeShrinkExcessEmpty = useCallback(
    (cmds: readonly AnnotationCommand[]) => {
      if (!enabled || viewportHeightPx <= 0 || !lessonBoardAllowsRunwayGrowth(orientation)) return
      if (cmds.length === 0) return
      const maxY = maxNormY(cmds)
      if (maxY <= 0 || maxY >= GROWTH_BAND_THRESHOLD) return
      const min = lessonBoardMinContentHeightPx(orientation, Math.max(1, logicalWidthPx), viewportHeightPx)
      setContentHeightPx((prev) => {
        const contentBottomPx = maxY * prev
        const unusedPx = prev - contentBottomPx
        // More than two blank viewports under content → trim down to one blank viewport.
        if (unusedPx <= viewportHeightPx * 2) return prev
        const next = Math.max(min, Math.ceil(contentBottomPx + viewportHeightPx))
        if (next >= prev - 8) return prev
        onPersistContentHeight(next)
        return next
      })
    },
    [enabled, logicalWidthPx, onPersistContentHeight, orientation, viewportHeightPx],
  )

  useEffect(() => {
    maybeGrowFromCommands(commands)
    maybeShrinkExcessEmpty(commands)
  }, [commands, maybeGrowFromCommands, maybeShrinkExcessEmpty])

  /** While scrolling: always keep one clean screen below the current view. */
  const ensureRunwayBelowView = useCallback(
    (scrollTopPx: number) => {
      if (!enabled || viewportHeightPx <= 0 || !lessonBoardAllowsRunwayGrowth(orientation)) return
      const max = lessonBoardMaxContentHeightPx(viewportHeightPx)
      setContentHeightPx((prev) => {
        const next = lessonBoardHeightToKeepOneViewportBelowView(
          scrollTopPx,
          viewportHeightPx,
          prev,
          max,
        )
        if (next !== prev) onPersistContentHeight(next)
        return next
      })
    },
    [enabled, onPersistContentHeight, orientation, viewportHeightPx],
  )

  return {
    lessonBoardContentHeightPx: contentHeightPx,
    ensureLessonBoardRunwayBelowView: ensureRunwayBelowView,
  }
}
