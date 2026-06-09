'use client'

import type { CSSProperties, MutableRefObject } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import type { LiveStrokeDraft } from '@/components/students/book-page-annotation-layer'
import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  applyAnnotationCanvasDpr,
  clearAnnotationCanvas,
  drawStrokePath,
  replayMarkerSlice,
} from '@/lib/books/annotation-draw'
import { buildAnnotationRenderSlices } from '@/lib/books/annotation-render-slices'
import {
  projectSpreadMarkerCommandsToPage,
  projectSpreadMarkerDraftToPage,
} from '@/lib/books/spread-page-marker-projection'
import type { PageRect, SpreadInkLayout } from '@/lib/books/spread-stroke-split'

/** Above ReaderPageSlot PDF (`z-[1]`) so multiply blends with the page bitmap. */
const MARKER_STACK_BASE_Z = 2

const MARKER_CANVAS_BLEND: CSSProperties = { mixBlendMode: 'multiply' }

function sizeCanvas(el: HTMLCanvasElement, widthPx: number, heightPx: number): void {
  const dpr = window.devicePixelRatio || 1
  const nextW = Math.max(1, Math.floor(widthPx * dpr))
  const nextH = Math.max(1, Math.floor(heightPx * dpr))
  if (el.width !== nextW || el.height !== nextH) {
    el.width = nextW
    el.height = nextH
  }
  el.style.width = `${widthPx}px`
  el.style.height = `${heightPx}px`
}

function pageBox(widthPx: number, heightPx: number, zIndex: number): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    zIndex,
  }
}

function readMarkerClientRects(
  leftPageCaptureRef: MutableRefObject<HTMLDivElement | null>,
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>,
): { spread: PageRect; left: PageRect; right: PageRect } | undefined {
  const leftEl = leftPageCaptureRef.current
  const rightEl = rightPageCaptureRef.current
  if (!leftEl || !rightEl) return undefined
  const leftRect = leftEl.getBoundingClientRect()
  const rightRect = rightEl.getBoundingClientRect()
  if (!(leftRect.width > 0) || !(rightRect.width > 0)) return undefined
  const spreadLeft = Math.min(leftRect.left, rightRect.left)
  const spreadTop = Math.min(leftRect.top, rightRect.top)
  const spreadRight = Math.max(leftRect.right, rightRect.right)
  const spreadBottom = Math.max(leftRect.bottom, rightRect.bottom)
  return {
    spread: {
      left: spreadLeft,
      top: spreadTop,
      width: spreadRight - spreadLeft,
      height: spreadBottom - spreadTop,
      right: spreadRight,
    },
    left: leftRect,
    right: rightRect,
  }
}

function markerCommandIdForSlice(
  commandsForPaint: readonly AnnotationCommand[],
  index: number,
): string {
  const cmd = commandsForPaint[index]
  return cmd?.kind === 'stroke' && cmd.tool === 'marker' ? cmd.id : `marker-slice-${index}`
}

type BookSpreadPageMarkerLayerProps = {
  side: 'left' | 'right'
  widthPx: number
  heightPx: number
  commands: readonly AnnotationCommand[]
  layout: SpreadInkLayout
  /** Bumps when capture rects / seam origins are re-measured in BookCanvasStage. */
  layoutMeasureRevision?: number
  leftPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  trailingMarkerStrokeDraft?: LiveStrokeDraft | null
}

export function BookSpreadPageMarkerLayer({
  side,
  widthPx,
  heightPx,
  commands,
  layout,
  layoutMeasureRevision = 0,
  leftPageCaptureRef,
  rightPageCaptureRef,
  trailingMarkerStrokeDraft = null,
}: BookSpreadPageMarkerLayerProps) {
  const markerSliceRefs = useRef<Map<string, HTMLCanvasElement | null>>(new Map())
  const trailingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const paintRetryRafRef = useRef<number | null>(null)
  const [paintPass, setPaintPass] = useState(0)
  const zoomRepaintRevision = useBrowserZoomRepaintRevision()

  const getClientRects = useCallback(
    () => readMarkerClientRects(leftPageCaptureRef, rightPageCaptureRef),
    [leftPageCaptureRef, rightPageCaptureRef],
  )

  const clientRects = getClientRects()
  const pageMarkerCommands = projectSpreadMarkerCommandsToPage(commands, side, layout, clientRects)
  const slices = buildAnnotationRenderSlices(pageMarkerCommands, new Set())
  const markerSlices = slices.filter((s) => s.kind === 'marker')
  const markerSliceCount = markerSlices.length

  const showTrailing =
    trailingMarkerStrokeDraft?.tool === 'marker' && trailingMarkerStrokeDraft.points.length >= 1

  const paintMarkerCanvases = useCallback(() => {
    if (!(widthPx > 0) || !(heightPx > 0)) return false

    const rects = getClientRects()
    const commandsForPaint = projectSpreadMarkerCommandsToPage(commands, side, layout, rects)
    const paintSlices = buildAnnotationRenderSlices(commandsForPaint, new Set())
    const paintMarkerSlices = paintSlices.filter((s) => s.kind === 'marker')

    for (const el of markerSliceRefs.current.values()) {
      if (el) sizeCanvas(el, widthPx, heightPx)
    }
    const trailEl = trailingCanvasRef.current
    if (trailEl) sizeCanvas(trailEl, widthPx, heightPx)

    let missingRef = false
    for (const slice of paintMarkerSlices) {
      if (slice.kind !== 'marker') continue
      const cmdId = markerCommandIdForSlice(commandsForPaint, slice.indices[0]!)
      const el = markerSliceRefs.current.get(cmdId)
      const ctx = el?.getContext('2d', { alpha: true })
      if (!el || !ctx) {
        missingRef = true
        continue
      }
      clearAnnotationCanvas(ctx)
      applyAnnotationCanvasDpr(ctx)
      replayMarkerSlice(ctx, commandsForPaint, slice.indices, widthPx, heightPx)
    }

    for (const [id, el] of markerSliceRefs.current) {
      if (!paintMarkerSlices.some((s) => markerCommandIdForSlice(commandsForPaint, s.indices[0]!) === id)) {
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) clearAnnotationCanvas(ctx)
      }
    }

    const trailCtx = trailingCanvasRef.current?.getContext('2d', { alpha: true })
    if (trailCtx) {
      clearAnnotationCanvas(trailCtx)
      const trail = trailingMarkerStrokeDraft
      if (trail?.tool === 'marker' && trail.points.length >= 1) {
        const pagePoints = projectSpreadMarkerDraftToPage(trail.points, side, layout, rects)
        if (pagePoints && pagePoints.length >= 1) {
          applyAnnotationCanvasDpr(trailCtx)
          const trailCmd: StrokeAnnotationCommand = {
            kind: 'stroke',
            id: '__trailing_marker__',
            tool: 'marker',
            points: pagePoints,
            ...(trail.widthScale != null ? { widthScale: trail.widthScale } : {}),
            ...(trail.color ? { color: trail.color } : {}),
            ...(trail.lineDashStyle ? { lineDashStyle: trail.lineDashStyle } : {}),
            ...(trail.markerDecoratedEdge ? { markerDecoratedEdge: true } : {}),
          }
          drawStrokePath(trailCtx, trailCmd, widthPx, heightPx)
        }
      }
    }

    return paintMarkerSlices.length > 0 && missingRef
  }, [
    commands,
    widthPx,
    heightPx,
    trailingMarkerStrokeDraft,
    side,
    layout,
    getClientRects,
  ])

  useLayoutEffect(() => {
    if (paintRetryRafRef.current != null) {
      cancelAnimationFrame(paintRetryRafRef.current)
      paintRetryRafRef.current = null
    }

    const needsRetry = paintMarkerCanvases()
    if (needsRetry) {
      paintRetryRafRef.current = requestAnimationFrame(() => {
        paintRetryRafRef.current = null
        paintMarkerCanvases()
        setPaintPass((n) => n + 1)
      })
    }

    return () => {
      if (paintRetryRafRef.current != null) {
        cancelAnimationFrame(paintRetryRafRef.current)
        paintRetryRafRef.current = null
      }
    }
  }, [
    paintMarkerCanvases,
    layoutMeasureRevision,
    zoomRepaintRevision,
    paintPass,
  ])

  useLayoutEffect(() => {
    const leftEl = leftPageCaptureRef.current
    const rightEl = rightPageCaptureRef.current
    if (!leftEl || !rightEl) return

    const bump = () => paintMarkerCanvases()
    const ro = new ResizeObserver(bump)
    ro.observe(leftEl)
    ro.observe(rightEl)
    return () => ro.disconnect()
  }, [leftPageCaptureRef, rightPageCaptureRef, paintMarkerCanvases])

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {markerSlices.map((slice) => {
        const cmdId = markerCommandIdForSlice(pageMarkerCommands, slice.indices[0]!)
        const z = MARKER_STACK_BASE_Z + slice.zIndex
        return (
          <canvas
            key={`page-marker-${side}-${cmdId}`}
            ref={(el) => {
              markerSliceRefs.current.set(cmdId, el)
            }}
            className="pointer-events-none"
            style={{ ...pageBox(widthPx, heightPx, z), ...MARKER_CANVAS_BLEND }}
          />
        )
      })}
      {showTrailing ? (
        <canvas
          key={`page-marker-trail-${side}`}
          ref={trailingCanvasRef}
          className="pointer-events-none"
          style={{
            ...pageBox(widthPx, heightPx, MARKER_STACK_BASE_Z + markerSliceCount + 1),
            ...MARKER_CANVAS_BLEND,
          }}
        />
      ) : null}
    </div>
  )
}
