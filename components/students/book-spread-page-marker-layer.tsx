'use client'

import type { CSSProperties, MutableRefObject } from 'react'
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
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

/** Page-normalized live strip (0–1); drawn with fillRect — no stroke projection. */
export type MarkerTrailingPageStrip = {
  x: number
  y: number
  w: number
  h: number
}

export type BookSpreadPageMarkerHandle = {
  /** Imperative live highlighter paint (same rAF as pointer); null clears. */
  paintTrailing: (draft: LiveStrokeDraft | null) => void
  /** Multi-strip text-snap live preview (clears when empty). */
  paintTrailingDrafts: (drafts: readonly LiveStrokeDraft[]) => void
  /**
   * Instant text-snap / strip ghost: page-norm fillRects on the trailing canvas.
   * Empty array clears. Prefer this on pointermove — skips projection + path stroke.
   */
  paintTrailingPageStrips: (strips: readonly MarkerTrailingPageStrip[], color: string) => void
}

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

type MarkerClientRects = NonNullable<ReturnType<typeof readMarkerClientRects>>

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
}

export const BookSpreadPageMarkerLayer = forwardRef<
  BookSpreadPageMarkerHandle,
  BookSpreadPageMarkerLayerProps
>(function BookSpreadPageMarkerLayer(
  {
    side,
    widthPx,
    heightPx,
    commands,
    layout,
    layoutMeasureRevision = 0,
    leftPageCaptureRef,
    rightPageCaptureRef,
  },
  ref,
) {
  const markerSliceRefs = useRef<Map<string, HTMLCanvasElement | null>>(new Map())
  const trailingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const paintRetryRafRef = useRef<number | null>(null)
  const cachedClientRectsRef = useRef<MarkerClientRects | null>(null)
  const lastTrailingDraftsRef = useRef<LiveStrokeDraft[]>([])
  const lastTrailingPageStripsRef = useRef<{
    strips: MarkerTrailingPageStrip[]
    color: string
  } | null>(null)
  const trailingCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const layoutRef = useRef(layout)
  const widthPxRef = useRef(widthPx)
  const heightPxRef = useRef(heightPx)
  const sideRef = useRef(side)
  const [paintPass, setPaintPass] = useState(0)
  const zoomRepaintRevision = useBrowserZoomRepaintRevision()

  layoutRef.current = layout
  widthPxRef.current = widthPx
  heightPxRef.current = heightPx
  sideRef.current = side

  const invalidateClientRectsCache = useCallback(() => {
    cachedClientRectsRef.current = null
  }, [])

  const getClientRects = useCallback(
    (opts?: { force?: boolean }): MarkerClientRects | undefined => {
      if (!opts?.force && cachedClientRectsRef.current) {
        return cachedClientRectsRef.current
      }
      const rects = readMarkerClientRects(leftPageCaptureRef, rightPageCaptureRef)
      cachedClientRectsRef.current = rects ?? null
      return rects
    },
    [leftPageCaptureRef, rightPageCaptureRef],
  )

  const ensureTrailingCtx = useCallback((): CanvasRenderingContext2D | null => {
    const w = widthPxRef.current
    const h = heightPxRef.current
    const trailEl = trailingCanvasRef.current
    if (!trailEl || !(w > 0) || !(h > 0)) return null
    sizeCanvas(trailEl, w, h)
    let ctx = trailingCtxRef.current
    if (!ctx || ctx.canvas !== trailEl) {
      ctx =
        trailEl.getContext('2d', { alpha: true, desynchronized: true } as CanvasRenderingContext2DSettings) ??
        trailEl.getContext('2d', { alpha: true })
      trailingCtxRef.current = ctx
    }
    return ctx
  }, [])

  const clientRects = getClientRects()
  const pageMarkerCommands = projectSpreadMarkerCommandsToPage(commands, side, layout, clientRects)
  const slices = buildAnnotationRenderSlices(pageMarkerCommands, new Set())
  const markerSlices = slices.filter((s) => s.kind === 'marker')
  const markerSliceCount = markerSlices.length

  const paintTrailingCanvas = useCallback(
    (drafts: readonly LiveStrokeDraft[], rects: MarkerClientRects | undefined) => {
      lastTrailingPageStripsRef.current = null
      const w = widthPxRef.current
      const h = heightPxRef.current
      const trailCtx = ensureTrailingCtx()
      if (!trailCtx || !(w > 0) || !(h > 0)) return
      clearAnnotationCanvas(trailCtx)
      applyAnnotationCanvasDpr(trailCtx)
      let i = 0
      for (const draft of drafts) {
        if (draft.tool !== 'marker' || draft.points.length < 1) continue
        const pagePoints = projectSpreadMarkerDraftToPage(
          draft.points,
          sideRef.current,
          layoutRef.current,
          rects,
        )
        if (!pagePoints || pagePoints.length < 1) continue
        const trailCmd: StrokeAnnotationCommand = {
          kind: 'stroke',
          id: `__trailing_marker_${i++}`,
          tool: 'marker',
          points: pagePoints,
          ...(draft.widthScale != null ? { widthScale: draft.widthScale } : {}),
          ...(draft.color ? { color: draft.color } : {}),
          ...(draft.lineDashStyle ? { lineDashStyle: draft.lineDashStyle } : {}),
          ...(draft.markerDecoratedEdge ? { markerDecoratedEdge: true } : {}),
        }
        drawStrokePath(trailCtx, trailCmd, w, h)
      }
    },
    [ensureTrailingCtx],
  )

  const paintTrailingPageStripsCanvas = useCallback(
    (strips: readonly MarkerTrailingPageStrip[], color: string) => {
      lastTrailingDraftsRef.current = []
      lastTrailingPageStripsRef.current = { strips: [...strips], color }
      const w = widthPxRef.current
      const h = heightPxRef.current
      const trailCtx = ensureTrailingCtx()
      if (!trailCtx || !(w > 0) || !(h > 0)) return
      clearAnnotationCanvas(trailCtx)
      if (strips.length === 0) return
      applyAnnotationCanvasDpr(trailCtx)
      trailCtx.globalCompositeOperation = 'source-over'
      trailCtx.globalAlpha = 1
      trailCtx.fillStyle = color
      for (const strip of strips) {
        if (!(strip.w > 0) || !(strip.h > 0)) continue
        trailCtx.fillRect(strip.x * w, strip.y * h, strip.w * w, strip.h * h)
      }
    },
    [ensureTrailingCtx],
  )

  useImperativeHandle(
    ref,
    () => ({
      paintTrailing(draft: LiveStrokeDraft | null) {
        const drafts = draft ? [draft] : []
        lastTrailingDraftsRef.current = drafts
        paintTrailingCanvas(drafts, getClientRects())
      },
      paintTrailingDrafts(drafts: readonly LiveStrokeDraft[]) {
        const next = drafts.length > 0 ? [...drafts] : []
        lastTrailingDraftsRef.current = next
        paintTrailingCanvas(next, getClientRects())
      },
      paintTrailingPageStrips(strips: readonly MarkerTrailingPageStrip[], color: string) {
        paintTrailingPageStripsCanvas(strips, color)
      },
    }),
    [getClientRects, paintTrailingCanvas, paintTrailingPageStripsCanvas],
  )

  const paintMarkerCanvases = useCallback(() => {
    if (!(widthPx > 0) || !(heightPx > 0)) return false

    invalidateClientRectsCache()
    const rects = getClientRects({ force: true })
    const commandsForPaint = projectSpreadMarkerCommandsToPage(commands, side, layout, rects)
    const paintSlices = buildAnnotationRenderSlices(commandsForPaint, new Set())
    const paintMarkerSlices = paintSlices.filter((s) => s.kind === 'marker')

    for (const el of markerSliceRefs.current.values()) {
      if (el) sizeCanvas(el, widthPx, heightPx)
    }

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

    const pageStrips = lastTrailingPageStripsRef.current
    if (pageStrips) {
      paintTrailingPageStripsCanvas(pageStrips.strips, pageStrips.color)
    } else {
      paintTrailingCanvas(lastTrailingDraftsRef.current, rects)
    }

    return paintMarkerSlices.length > 0 && missingRef
  }, [
    commands,
    widthPx,
    heightPx,
    side,
    layout,
    getClientRects,
    invalidateClientRectsCache,
    paintTrailingCanvas,
    paintTrailingPageStripsCanvas,
  ])

  useLayoutEffect(() => {
    invalidateClientRectsCache()
  }, [layoutMeasureRevision, zoomRepaintRevision, invalidateClientRectsCache])

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

    const bump = () => {
      invalidateClientRectsCache()
      paintMarkerCanvases()
    }
    const ro = new ResizeObserver(bump)
    ro.observe(leftEl)
    ro.observe(rightEl)
    return () => ro.disconnect()
  }, [leftPageCaptureRef, rightPageCaptureRef, paintMarkerCanvases, invalidateClientRectsCache])

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
      <canvas
        key={`page-marker-trail-${side}`}
        ref={trailingCanvasRef}
        className="pointer-events-none"
        style={{
          ...pageBox(widthPx, heightPx, MARKER_STACK_BASE_Z + markerSliceCount + 1),
          ...MARKER_CANVAS_BLEND,
        }}
      />
    </div>
  )
})
