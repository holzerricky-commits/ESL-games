'use client'

import { useLayoutEffect, useRef, type MutableRefObject } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  applyEraserLivePreviewPunchOut,
  deadKeyFromIndices,
} from '@/lib/books/ink-session-eraser-live-preview'

export type UseInkSessionEraserLivePreviewOptions = {
  active: boolean
  widthPx: number
  heightPx: number
  paintDisplayCommands: readonly AnnotationCommand[]
  deadIndices: ReadonlySet<number>
  markersOnSessionLayer: boolean
  inkSliceRefs: MutableRefObject<(HTMLCanvasElement | null)[]>
  markerSliceRefs: MutableRefObject<(HTMLCanvasElement | null)[]>
}

/** R2.5 — incremental slice repaint while line eraser is dragged (no full-scene replay). */
export function useInkSessionEraserLivePreview({
  active,
  widthPx,
  heightPx,
  paintDisplayCommands,
  deadIndices,
  markersOnSessionLayer,
  inkSliceRefs,
  markerSliceRefs,
}: UseInkSessionEraserLivePreviewOptions) {
  const prevActiveRef = useRef(false)
  const prevDeadKeyRef = useRef('')

  useLayoutEffect(() => {
    if (!(widthPx > 0) || !(heightPx > 0)) return

    if (!active) {
      if (prevActiveRef.current) {
        prevDeadKeyRef.current = ''
      }
      prevActiveRef.current = false
      return
    }

    prevActiveRef.current = true
    const deadKey = deadKeyFromIndices(deadIndices)
    if (deadKey === prevDeadKeyRef.current) return

    applyEraserLivePreviewPunchOut(
      paintDisplayCommands,
      deadIndices,
      prevDeadKeyRef.current,
      inkSliceRefs.current,
      markerSliceRefs.current,
      markersOnSessionLayer,
      widthPx,
      heightPx,
    )
    prevDeadKeyRef.current = deadKey
  }, [
    active,
    deadIndices,
    heightPx,
    inkSliceRefs,
    markerSliceRefs,
    markersOnSessionLayer,
    paintDisplayCommands,
    widthPx,
  ])
}
