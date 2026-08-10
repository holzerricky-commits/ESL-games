import { useCallback, useEffect, useState } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

const MIN_RUNWAY_MULTIPLIER = 2.5
const MIN_RUNWAY_PX = 2400
const GROWTH_BAND_THRESHOLD = 0.85

function maxNormY(commands: AnnotationCommand[]): number {
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

interface UseInfiniteWhiteboardRunwayArgs {
  viewportHeightPx: number
  enabled: boolean
}

export function useInfiniteWhiteboardRunway({ viewportHeightPx, enabled }: UseInfiniteWhiteboardRunwayArgs) {
  const [contentHeightPx, setContentHeightPx] = useState(() =>
    Math.max(MIN_RUNWAY_PX, Math.round(viewportHeightPx * MIN_RUNWAY_MULTIPLIER)),
  )

  useEffect(() => {
    if (!enabled || viewportHeightPx <= 0) return
    setContentHeightPx((prev) => {
      const min = Math.max(MIN_RUNWAY_PX, Math.round(viewportHeightPx * MIN_RUNWAY_MULTIPLIER))
      return Math.max(prev, min)
    })
  }, [enabled, viewportHeightPx])

  const maybeGrowFromCommands = useCallback(
    (commands: AnnotationCommand[]) => {
      if (!enabled || viewportHeightPx <= 0) return
      const maxY = maxNormY(commands)
      if (maxY < GROWTH_BAND_THRESHOLD) return
      setContentHeightPx((prev) => {
        const min = Math.max(MIN_RUNWAY_PX, Math.round(viewportHeightPx * MIN_RUNWAY_MULTIPLIER))
        const needed = Math.ceil(maxY * prev + viewportHeightPx)
        return Math.max(prev, min, needed)
      })
    },
    [enabled, viewportHeightPx],
  )

  const extendWhiteboardRunway = useCallback(() => {
    if (viewportHeightPx <= 0) return
    setContentHeightPx((prev) => prev + viewportHeightPx)
  }, [viewportHeightPx])

  return {
    whiteboardContentHeightPx: contentHeightPx,
    maybeGrowWhiteboardFromCommands: maybeGrowFromCommands,
    extendWhiteboardRunway,
  }
}
