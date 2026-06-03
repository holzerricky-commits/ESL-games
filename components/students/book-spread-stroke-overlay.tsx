'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import type { CSSProperties, MutableRefObject } from 'react'
import type {
  AnnotationCommand,
  AnnotationLineDashStyle,
  ShapeFillMode,
  StrokeAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import {
  splitTwoPointDraftForPreview,
  splitTwoPointShapeCommandsViaClientRects,
  type ShapeCommitOptions,
  type TwoPointShapeKind,
} from '@/lib/books/spread-command-split'
import { resolveAnnotationToolCursor } from '@/lib/books/annotation-tool-cursor'
import {
  applyAnnotationCanvasDpr,
  clearAnnotationCanvas,
  drawStrokePath,
  type DrawStrokePathOptions,
} from '@/lib/books/annotation-draw'
import { penStrokeUsesRichLivePaint } from '@/lib/books/annotation-live-pen-paint'
import { subscribeBrushPatternTileLoads } from '@/lib/books/brush-pattern-loader'
import { isEffectPenInkStyle } from '@/lib/books/pen-ink'
import {
  canIncrementallyAppendStrokeDraft,
  incrementalStrokeDraftSegmentPoints,
  type IncrementalStrokeDraftState,
} from '@/lib/books/incremental-stroke-draft-paint'
import {
  spreadLiveStrokeIncrementalPaintEnabled,
  spreadLiveStrokeRafCoalesceEnabled,
  whiteboardViewportLiveStrokeIncrementalPaintEnabled,
} from '@/lib/books/spread-live-draw-config'
import { createRafCoalescer } from '@/lib/books/raf-coalesce'
import { attachPenInkPatternPhase } from '@/lib/books/pen-ink'
import { clientToSpreadNorm } from '@/lib/books/spread-canvas-coords'
import {
  clientToWhiteboardDocumentNorm,
  projectStrokeDraftForWhiteboardViewport,
  type WhiteboardViewportInkConfig,
} from '@/lib/books/whiteboard-viewport-ink'
import {
  seamClientX,
  splitClientPolylineToPageNormalizedChains,
  splitSpreadNormPolylineToPageNormalizedChains,
  type SpreadInkLayout,
} from '@/lib/books/spread-stroke-split'
import type {
  AnnotationCapabilities,
  BookPageAnnotationHandle,
  LiveEraserLineDraft,
} from '@/components/students/book-page-annotation-layer'
import { cn } from '@/lib/utils'
import {
  strokeWidthScaleForStrokeTool,
} from '@/lib/books/annotation-stroke-utils'
import {
  effectiveStrokeToolForPointer,
  isAnnotationPointerDownAccepted,
} from '@/lib/books/pen-barrel-button'
import {
  extendStrokeDraftFromMove,
  finalizeStrokeDraftEndPoint,
  type StraightStrokeAxis,
} from '@/lib/books/stroke-straight-line'
import { coalescedPointerEvents } from '@/lib/books/stroke-pointer-samples'
import { ensureStrokeCommitPoints } from '@/lib/books/stroke-tap-dot'
import type { StrokeTool } from '@/lib/books/annotation-command-types'

function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

type SpreadStrokeGestureEntry = {
  kind: 'stroke'
  left: StrokeAnnotationCommand[]
  right: StrokeAnnotationCommand[]
}

type SpreadShapeGestureEntry = {
  kind: 'shape'
  left: AnnotationCommand | null
  right: AnnotationCommand | null
}

type SpreadGestureEntry = SpreadStrokeGestureEntry | SpreadShapeGestureEntry

type TwoPointDraft = {
  kind: TwoPointShapeKind
  anchor: [number, number]
  current: [number, number]
}

function isTwoPointShapeMode(mode: BookAnnotationInteractionMode): mode is TwoPointShapeKind {
  return (
    mode === 'line' ||
    mode === 'rect' ||
    mode === 'ellipse' ||
    mode === 'triangle' ||
    mode === 'arrow'
  )
}

function cloneStroke(cmd: StrokeAnnotationCommand): StrokeAnnotationCommand {
  return {
    ...cmd,
    points: cmd.points.map((p) => [p[0], p[1]] as [number, number]),
  }
}

/** Copy ink metadata from live draft onto a page-local stroke command. */
function strokeInkFieldsFromDraft(
  draft: StrokeAnnotationCommand,
): Pick<
  StrokeAnnotationCommand,
  | 'widthScale'
  | 'color'
  | 'lineDashStyle'
  | 'penInkStyle'
  | 'penStrokeProfile'
  | 'penInkPatternPhaseX'
  | 'penInkPatternPhaseY'
  | 'markerDecoratedEdge'
> {
  return {
    ...(draft.widthScale != null ? { widthScale: draft.widthScale } : {}),
    ...(draft.color ? { color: draft.color } : {}),
    ...(draft.lineDashStyle ? { lineDashStyle: draft.lineDashStyle } : {}),
    ...(draft.penInkStyle && draft.penInkStyle !== 'solid' ? { penInkStyle: draft.penInkStyle } : {}),
    ...(draft.penStrokeProfile ? { penStrokeProfile: draft.penStrokeProfile } : {}),
    ...(draft.penInkPatternPhaseX != null ? { penInkPatternPhaseX: draft.penInkPatternPhaseX } : {}),
    ...(draft.penInkPatternPhaseY != null ? { penInkPatternPhaseY: draft.penInkPatternPhaseY } : {}),
    ...(draft.markerDecoratedEdge ? { markerDecoratedEdge: true } : {}),
  }
}

const MARKER_CANVAS_BLEND: CSSProperties = { mixBlendMode: 'multiply' }

function clearSpreadCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  clearAnnotationCanvas(ctx)
}

function spreadLiveStrokeDrawOptions(draft: StrokeAnnotationCommand): DrawStrokePathOptions {
  const base: DrawStrokePathOptions = { pagePatternOrigin: { x: 0, y: 0 } }
  if (
    draft.tool !== 'pen' ||
    penStrokeUsesRichLivePaint({
      penInkStyle: draft.penInkStyle,
      penStrokeProfile: draft.penStrokeProfile,
    })
  ) {
    return base
  }
  return { ...base, livePaintFast: true }
}

function paintSpreadLiveStrokeDraft(
  draftInkCanvas: HTMLCanvasElement | null,
  draftMarkerCanvas: HTMLCanvasElement | null,
  draft: StrokeAnnotationCommand | null,
  spreadOverlayWidthPx: number,
  spreadCanvasHeightPx: number,
  incrementalRef: MutableRefObject<IncrementalStrokeDraftState | null>,
  viewportInk?: WhiteboardViewportInkConfig | null,
): void {
  if (!draftInkCanvas || !draftMarkerCanvas) return
  const inkCtx = draftInkCanvas.getContext('2d', { alpha: true })
  const markerCtx = draftMarkerCanvas.getContext('2d', { alpha: true })
  if (!inkCtx || !markerCtx) return

  if (!draft || draft.points.length < 1 || draft.tool === 'eraser-line') {
    incrementalRef.current = null
    clearAnnotationCanvas(inkCtx)
    clearAnnotationCanvas(markerCtx)
    return
  }

  const draftForPaint = viewportInk
    ? projectStrokeDraftForWhiteboardViewport(draft, viewportInk)
    : draft
  if (!draftForPaint) {
    incrementalRef.current = null
    clearAnnotationCanvas(inkCtx)
    clearAnnotationCanvas(markerCtx)
    return
  }

  const drawOptions = spreadLiveStrokeDrawOptions(draft)
  const prev = incrementalRef.current
  const incrementalLiveEnabled =
    spreadLiveStrokeIncrementalPaintEnabled ||
    (viewportInk != null && whiteboardViewportLiveStrokeIncrementalPaintEnabled)
  const canAppend =
    incrementalLiveEnabled && canIncrementallyAppendStrokeDraft(prev, draftForPaint)

  if (!canAppend) {
    clearAnnotationCanvas(inkCtx)
    clearAnnotationCanvas(markerCtx)
    applyAnnotationCanvasDpr(inkCtx)
    applyAnnotationCanvasDpr(markerCtx)
    const ctx = draft.tool === 'marker' ? markerCtx : inkCtx
    drawStrokePath(ctx, draftForPaint, spreadOverlayWidthPx, spreadCanvasHeightPx, drawOptions)
    if (draft.tool === 'pen' || draft.tool === 'marker') {
      incrementalRef.current = { tool: draft.tool, pointsLength: draftForPaint.points.length }
    } else {
      incrementalRef.current = null
    }
    return
  }

  const ctx = draft.tool === 'marker' ? markerCtx : inkCtx
  applyAnnotationCanvasDpr(ctx)
  const segmentPoints = incrementalStrokeDraftSegmentPoints(draftForPaint.points, prev!.pointsLength)
  drawStrokePath(
    ctx,
    { ...draftForPaint, points: segmentPoints },
    spreadOverlayWidthPx,
    spreadCanvasHeightPx,
    drawOptions,
  )
  if (draft.tool === 'pen' || draft.tool === 'marker') {
    incrementalRef.current = { tool: draft.tool, pointsLength: draftForPaint.points.length }
  } else {
    incrementalRef.current = null
  }
}

function clearLiveEraserDraftsBothPages(
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
): void {
  leftAnnRef.current?.setLiveEraserLineDraft(null)
  rightAnnRef.current?.setLiveEraserLineDraft(null)
}

function clearLiveStrokeDraftsBothPages(
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
): void {
  leftAnnRef.current?.setLiveStrokeDraft(null)
  rightAnnRef.current?.setLiveStrokeDraft(null)
}

function clearLiveTwoPointDraftsBothPages(
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
): void {
  leftAnnRef.current?.setLiveTwoPointDraft(null)
  rightAnnRef.current?.setLiveTwoPointDraft(null)
}

function pushLiveTwoPointDraftsForSpread(
  draft: TwoPointDraft,
  layout: SpreadInkLayout,
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
): void {
  const { left, right } = splitTwoPointDraftForPreview(draft.kind, draft.anchor, draft.current, layout)
  leftAnnRef.current?.setLiveTwoPointDraft(left)
  rightAnnRef.current?.setLiveTwoPointDraft(right)
}

function pushLiveEraserDraftsForSpread(
  clientPts: readonly (readonly [number, number])[],
  leftEl: HTMLElement,
  rightEl: HTMLElement,
  widthScale: number | undefined,
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
): void {
  const leftRect = leftEl.getBoundingClientRect()
  const rightRect = rightEl.getBoundingClientRect()
  const { leftNorm, rightNorm } = splitClientPolylineToPageNormalizedChains(clientPts, leftRect, rightRect)
  const leftChain = leftNorm.find((chain) => chain.length >= 2) ?? leftNorm[leftNorm.length - 1]
  const rightChain = rightNorm.find((chain) => chain.length >= 2) ?? rightNorm[rightNorm.length - 1]
  leftAnnRef.current?.setLiveEraserLineDraft(
    leftChain && leftChain.length >= 2 ? { tool: 'eraser-line', points: leftChain, widthScale } : null,
  )
  rightAnnRef.current?.setLiveEraserLineDraft(
    rightChain && rightChain.length >= 2 ? { tool: 'eraser-line', points: rightChain, widthScale } : null,
  )
}

/** Live pen/marker/eraser: one continuous stroke on the spread overlay; eraser-line still splits to pages. */
function pushLiveStrokeDraftsForSpread(
  draft: StrokeAnnotationCommand,
  spreadOverlayWidthPx: number,
  spreadCanvasHeightPx: number,
  draftInkCanvas: HTMLCanvasElement | null,
  draftMarkerCanvas: HTMLCanvasElement | null,
  incrementalRef: MutableRefObject<IncrementalStrokeDraftState | null>,
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
  viewportInk?: WhiteboardViewportInkConfig | null,
): void {
  if (draft.tool === 'eraser-line' || draft.points.length < 1) {
    clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
    paintSpreadLiveStrokeDraft(
      draftInkCanvas,
      draftMarkerCanvas,
      null,
      spreadOverlayWidthPx,
      spreadCanvasHeightPx,
      incrementalRef,
      viewportInk,
    )
    return
  }
  clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
  paintSpreadLiveStrokeDraft(
    draftInkCanvas,
    draftMarkerCanvas,
    draft,
    spreadOverlayWidthPx,
    spreadCanvasHeightPx,
    incrementalRef,
    viewportInk,
  )
}

export interface BookSpreadStrokeOverlayProps {
  leftPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  annotationMode: BookAnnotationInteractionMode
  strokeWidthScale: number
  eraserLineStrokeWidthScale: number
  penStrokeWidthScale: number
  strokeColor?: string
  penInkColor?: string
  penInkStyle?: import('@/lib/books/pen-ink').PenInkStyle
  penStrokeProfile?: import('@/lib/books/pen-stroke-profile').PenStrokeProfile
  /** Pen/marker ink dash; ignored for erasers. */
  strokeLineDashStyle?: AnnotationLineDashStyle
  markerStraightStroke?: boolean
  markerDecoratedEdge?: boolean
  shapeColor: string
  shapeStrokeWidthScale: number
  shapeLineDashStyle?: AnnotationLineDashStyle
  shapeStrokeEnabled?: boolean
  shapeFillMode?: ShapeFillMode
  shapeFillColor?: string
  pageNumberLeft: number
  pageNumberRight: number
  annotationTargetPage: number
  setAnnotationTargetPage: (page: number) => void
  onCapabilitiesChange: (caps: AnnotationCapabilities) => void
  /** When false, overlay is visually present but does not capture pointer events (non-stroke tools use page layers). */
  captureEnabled: boolean
  /** Logical spread width/height (cluster width = 2–page − one overlap). */
  spreadOverlayWidthPx: number
  spreadOverlayHeightPx: number
  /** Physical capture/draft canvas height (whiteboard viewport). Defaults to spreadOverlayHeightPx. */
  spreadCanvasHeightPx?: number
  /** Whiteboard: map pointer on viewport canvas into document-normalized storage. */
  whiteboardViewportInk?: WhiteboardViewportInkConfig
  spreadPageWidthPx: number
  /** Logical X offset of each page slot within the spread (for ink pattern + commit split). */
  leftPenInkPatternOriginXPx: number
  rightPenInkPatternOriginXPx: number
  /** Seam between pages in spread-overlay normalized X (0..1). */
  spreadSeamNormX: number
  /** Phase 3: spread edits mutate session mirror only (no immediate page commits). */
  spreadSessionMode?: boolean
  /** Phase 2: append one committed command to the spread session store. */
  onSpreadSessionAppendCommand?: (cmd: AnnotationCommand) => void
  spreadSessionUndo?: () => boolean
  spreadSessionRedo?: () => boolean
  spreadSessionClear?: () => void
  /** Live eraser-line preview on spread session layer (spread-normalized points). */
  onSpreadEraserLineDraftChange?: (draft: LiveEraserLineDraft | null) => void
}

export const BookSpreadStrokeOverlay = forwardRef<BookPageAnnotationHandle, BookSpreadStrokeOverlayProps>(
  function BookSpreadStrokeOverlay(
    {
      leftPageCaptureRef,
      rightPageCaptureRef,
      leftAnnRef,
      rightAnnRef,
      annotationMode,
      strokeWidthScale,
      eraserLineStrokeWidthScale,
      penStrokeWidthScale,
      strokeColor,
      penInkColor,
      penInkStyle,
      penStrokeProfile,
      strokeLineDashStyle = 'solid',
      markerStraightStroke = false,
      markerDecoratedEdge = false,
      shapeColor,
      shapeStrokeWidthScale,
      shapeLineDashStyle = 'solid',
      shapeStrokeEnabled = true,
      shapeFillMode = 'none',
      shapeFillColor = '#eab308',
      pageNumberLeft,
      pageNumberRight,
      annotationTargetPage,
      setAnnotationTargetPage,
      onCapabilitiesChange,
      captureEnabled,
      spreadOverlayWidthPx,
      spreadOverlayHeightPx,
      spreadCanvasHeightPx: spreadCanvasHeightPxProp,
      whiteboardViewportInk,
      spreadPageWidthPx,
      leftPenInkPatternOriginXPx,
      rightPenInkPatternOriginXPx,
      spreadSeamNormX,
      spreadSessionMode = false,
      onSpreadSessionAppendCommand,
      spreadSessionUndo,
      spreadSessionRedo,
      spreadSessionClear,
      onSpreadEraserLineDraftChange,
    },
    ref,
  ) {
    const captureRef = useRef<HTMLDivElement | null>(null)
    const draftInkCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const draftMarkerCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const zoomRepaintRevision = useBrowserZoomRepaintRevision()
    const spreadCanvasHeightPx = spreadCanvasHeightPxProp ?? spreadOverlayHeightPx

    const clientToInkNorm = useCallback(
      (
        canvasRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
        clientX: number,
        clientY: number,
      ): [number, number] => {
        if (whiteboardViewportInk) {
          return clientToWhiteboardDocumentNorm(whiteboardViewportInk, canvasRect, clientX, clientY)
        }
        return clientToSpreadNorm(canvasRect, clientX, clientY)
      },
      [whiteboardViewportInk],
    )

    const gestureRef = useRef<'stroke' | 'two' | null>(null)
    const straightStrokeAxisRef = useRef<StraightStrokeAxis | null>(null)
    const draftStrokeRef = useRef<StrokeAnnotationCommand | null>(null)
    const spreadIncrementalDraftRef = useRef<IncrementalStrokeDraftState | null>(null)
    const liveStrokePaintCoalescerRef = useRef<ReturnType<typeof createRafCoalescer> | null>(null)
    const twoDraftRef = useRef<TwoPointDraft | null>(null)
    const pointsClientRef = useRef<[number, number][]>([])
    const deferClearDraftRafRef = useRef<number | null>(null)

    const cancelDeferredClearSpreadDraft = useCallback(() => {
      if (deferClearDraftRafRef.current != null) {
        cancelAnimationFrame(deferClearDraftRafRef.current)
        deferClearDraftRafRef.current = null
      }
    }, [])

    const clearSpreadLiveDraftCanvasesRef = useRef<() => void>(() => {})

    const scheduleDeferredClearSpreadDraft = useCallback(() => {
      cancelDeferredClearSpreadDraft()
      let frames = 0
      const tick = () => {
        frames += 1
        if (frames < 2) {
          deferClearDraftRafRef.current = requestAnimationFrame(tick)
          return
        }
        deferClearDraftRafRef.current = null
        clearSpreadLiveDraftCanvasesRef.current()
      }
      deferClearDraftRafRef.current = requestAnimationFrame(tick)
    }, [cancelDeferredClearSpreadDraft])

    useEffect(() => () => cancelDeferredClearSpreadDraft(), [cancelDeferredClearSpreadDraft])

    const shapeCommitOptions = useMemo<ShapeCommitOptions>(
      () => ({
        shapeColor,
        shapeStrokeWidthScale,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
      }),
      [
        shapeColor,
        shapeStrokeWidthScale,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
      ],
    )

    const undoStackRef = useRef<SpreadGestureEntry[]>([])
    const redoStackRef = useRef<SpreadGestureEntry[]>([])

    const onCapabilitiesChangeRef = useRef(onCapabilitiesChange)
    onCapabilitiesChangeRef.current = onCapabilitiesChange

    const spreadInkLayoutRef = useRef<SpreadInkLayout>({
      spreadOverlayWidthPx,
      spreadPageWidthPx,
      leftPageOriginXPx: leftPenInkPatternOriginXPx,
      rightPageOriginXPx: rightPenInkPatternOriginXPx,
      seamNormX: spreadSeamNormX,
    })
    spreadInkLayoutRef.current = {
      spreadOverlayWidthPx,
      spreadPageWidthPx,
      leftPageOriginXPx: leftPenInkPatternOriginXPx,
      rightPageOriginXPx: rightPenInkPatternOriginXPx,
      seamNormX: spreadSeamNormX,
    }

    const emitCapabilities = useCallback(() => {
      if (spreadSessionMode) return
      onCapabilitiesChangeRef.current?.({
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
      })
    }, [spreadSessionMode])

    useEffect(() => {
      queueMicrotask(emitCapabilities)
    }, [emitCapabilities])

    const repaintLiveSpreadStroke = useCallback(() => {
      const draft = draftStrokeRef.current
      if (!draft) {
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
        paintSpreadLiveStrokeDraft(
          draftInkCanvasRef.current,
          draftMarkerCanvasRef.current,
          null,
          spreadOverlayWidthPx,
          spreadCanvasHeightPx,
          spreadIncrementalDraftRef,
          whiteboardViewportInk,
        )
        return
      }
      pushLiveStrokeDraftsForSpread(
        draft,
        spreadOverlayWidthPx,
        spreadCanvasHeightPx,
        draftInkCanvasRef.current,
        draftMarkerCanvasRef.current,
        spreadIncrementalDraftRef,
        leftAnnRef,
        rightAnnRef,
        whiteboardViewportInk,
      )
    }, [leftAnnRef, rightAnnRef, spreadCanvasHeightPx, spreadOverlayWidthPx, whiteboardViewportInk])

    const syncLiveSpreadStroke = repaintLiveSpreadStroke

    useEffect(() => {
      if (!spreadLiveStrokeRafCoalesceEnabled) {
        liveStrokePaintCoalescerRef.current = null
        return
      }
      const coalescer = createRafCoalescer(repaintLiveSpreadStroke)
      liveStrokePaintCoalescerRef.current = coalescer
      return () => coalescer.cancel()
    }, [repaintLiveSpreadStroke])

    const scheduleLiveSpreadStrokePaint = useCallback(() => {
      if (spreadLiveStrokeRafCoalesceEnabled && liveStrokePaintCoalescerRef.current) {
        liveStrokePaintCoalescerRef.current.schedule()
        return
      }
      repaintLiveSpreadStroke()
    }, [repaintLiveSpreadStroke])

    const flushLiveSpreadStrokePaint = useCallback(() => {
      if (spreadLiveStrokeRafCoalesceEnabled && liveStrokePaintCoalescerRef.current) {
        liveStrokePaintCoalescerRef.current.flush()
        return
      }
      repaintLiveSpreadStroke()
    }, [repaintLiveSpreadStroke])

    const cancelLiveSpreadStrokePaint = useCallback(() => {
      liveStrokePaintCoalescerRef.current?.cancel()
    }, [])

    useEffect(() => {
      if (gestureRef.current === 'stroke' && draftStrokeRef.current) {
        syncLiveSpreadStroke()
      }
    }, [
      syncLiveSpreadStroke,
      spreadOverlayWidthPx,
      spreadPageWidthPx,
      leftPenInkPatternOriginXPx,
      rightPenInkPatternOriginXPx,
      spreadSeamNormX,
    ])

    useEffect(
      () =>
        subscribeBrushPatternTileLoads(() => {
          const draft = draftStrokeRef.current
          if (
            draft?.tool === 'pen' &&
            isEffectPenInkStyle(draft.penInkStyle) &&
            draft.points.length >= 1
          ) {
            syncLiveSpreadStroke()
          }
        }),
      [syncLiveSpreadStroke],
    )

    const syncSpreadDraftCanvasSize = useCallback(
      (el: HTMLCanvasElement) => {
        const dpr = window.devicePixelRatio || 1
        const nextW = Math.max(1, Math.floor(spreadOverlayWidthPx * dpr))
        const nextH = Math.max(1, Math.floor(spreadCanvasHeightPx * dpr))
        el.style.width = `${spreadOverlayWidthPx}px`
        el.style.height = `${spreadCanvasHeightPx}px`
        if (el.width !== nextW || el.height !== nextH) {
          el.width = nextW
          el.height = nextH
        }
        clearSpreadCanvas(el)
      },
      [spreadCanvasHeightPx, spreadOverlayWidthPx],
    )

    useLayoutEffect(() => {
      const inkEl = draftInkCanvasRef.current
      const markerEl = draftMarkerCanvasRef.current
      if (!inkEl || !markerEl || !(spreadOverlayWidthPx > 0) || !(spreadCanvasHeightPx > 0)) return
      syncSpreadDraftCanvasSize(inkEl)
      syncSpreadDraftCanvasSize(markerEl)
      spreadIncrementalDraftRef.current = null
      paintSpreadLiveStrokeDraft(
        inkEl,
        markerEl,
        draftStrokeRef.current,
        spreadOverlayWidthPx,
        spreadCanvasHeightPx,
        spreadIncrementalDraftRef,
        whiteboardViewportInk,
      )
    }, [
      spreadOverlayWidthPx,
      spreadCanvasHeightPx,
      annotationMode,
      captureEnabled,
      syncSpreadDraftCanvasSize,
      zoomRepaintRevision,
      whiteboardViewportInk,
    ])

    useEffect(() => {
      const el = captureRef.current
      if (!el || !captureEnabled) return
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) e.preventDefault()
      }
      el.addEventListener('touchstart', onTouchStart, { passive: false })
      return () => el.removeEventListener('touchstart', onTouchStart)
    }, [captureEnabled])

    const commitStrokeFromClientPoints = useCallback(() => {
      pointsClientRef.current = []
      const draft = draftStrokeRef.current
      if (!draft || draft.points.length < 1) return

      const commitPoints = ensureStrokeCommitPoints(draft.points)
      if (commitPoints.length < 2) return

      const layout = spreadInkLayoutRef.current
      if (!(layout.spreadOverlayWidthPx > 0) || !(layout.spreadPageWidthPx > 0)) return

      clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)

      const gestureId = newAnnotationId()
      const sessionCmd: StrokeAnnotationCommand = {
        kind: 'stroke',
        id: gestureId,
        tool: draft.tool,
        points: commitPoints.map((p) => [p[0], p[1]] as [number, number]),
        ...strokeInkFieldsFromDraft(draft),
      }

      if (spreadSessionMode) {
        onSpreadSessionAppendCommand?.(sessionCmd)
        return
      }

      // Legacy: split to per-page storage and replay on each page layer.
      const { leftNorm, rightNorm } = splitSpreadNormPolylineToPageNormalizedChains(commitPoints, layout)
      const leftCmds: StrokeAnnotationCommand[] = []
      const rightCmds: StrokeAnnotationCommand[] = []

      for (const chain of leftNorm) {
        if (chain.length < 2) continue
        const cmd: StrokeAnnotationCommand = {
          kind: 'stroke',
          id: gestureId,
          tool: draft.tool,
          points: chain,
          ...strokeInkFieldsFromDraft(draft),
        }
        leftCmds.push(cmd)
        leftAnnRef.current?.appendCommand(cmd)
      }
      for (const chain of rightNorm) {
        if (chain.length < 2) continue
        const cmd: StrokeAnnotationCommand = {
          kind: 'stroke',
          id: gestureId,
          tool: draft.tool,
          points: chain,
          ...strokeInkFieldsFromDraft(draft),
        }
        rightCmds.push(cmd)
        rightAnnRef.current?.appendCommand(cmd)
      }

      if (leftCmds.length > 0 || rightCmds.length > 0) {
        undoStackRef.current.push({
          kind: 'stroke',
          left: leftCmds.map(cloneStroke),
          right: rightCmds.map(cloneStroke),
        })
        redoStackRef.current = []
        emitCapabilities()
      }
    }, [emitCapabilities, leftAnnRef, onSpreadSessionAppendCommand, spreadSessionMode, rightAnnRef])

    const commitTwoPointFromSpread = useCallback(() => {
      const td = twoDraftRef.current
      twoDraftRef.current = null
      if (!td) return

      clearLiveTwoPointDraftsBothPages(leftAnnRef, rightAnnRef)

      let sessionCmd: AnnotationCommand | null = null
      if (td.kind === 'line' || td.kind === 'arrow') {
        sessionCmd =
          td.kind === 'line'
            ? ({
                kind: 'line',
                id: newAnnotationId(),
                a: td.anchor,
                b: td.current,
                color: shapeCommitOptions.shapeColor,
                widthScale: shapeCommitOptions.shapeStrokeWidthScale,
                lineDashStyle: shapeCommitOptions.shapeLineDashStyle,
              } satisfies AnnotationCommand)
            : ({
                kind: 'arrow',
                id: newAnnotationId(),
                from: td.anchor,
                to: td.current,
                color: shapeCommitOptions.shapeColor,
                widthScale: shapeCommitOptions.shapeStrokeWidthScale,
                lineDashStyle: shapeCommitOptions.shapeLineDashStyle,
              } satisfies AnnotationCommand)
      } else {
        const x = Math.min(td.anchor[0], td.current[0])
        const y = Math.min(td.anchor[1], td.current[1])
        const w = Math.abs(td.current[0] - td.anchor[0])
        const h = Math.abs(td.current[1] - td.anchor[1])
        if (w >= 0.004 && h >= 0.004) {
          const base = {
            id: newAnnotationId(),
            x,
            y,
            w,
            h,
            strokeColor: shapeCommitOptions.shapeColor,
            strokeWidthScale: shapeCommitOptions.shapeStrokeWidthScale,
            lineDashStyle: shapeCommitOptions.shapeLineDashStyle,
            strokeVisible: shapeCommitOptions.shapeStrokeEnabled,
            fillVisible: shapeCommitOptions.shapeFillMode !== 'none',
          }
          if (td.kind === 'rect') {
            sessionCmd = { kind: 'rect', ...base } satisfies AnnotationCommand
          } else if (td.kind === 'ellipse') {
            sessionCmd = { kind: 'ellipse', ...base } satisfies AnnotationCommand
          } else {
            sessionCmd = { kind: 'triangle', ...base } satisfies AnnotationCommand
          }
        }
      }
      if (!sessionCmd) return

      if (spreadSessionMode) {
        onSpreadSessionAppendCommand?.(sessionCmd)
        return
      }

      const overlayEl = captureRef.current
      const leftEl = leftPageCaptureRef.current
      const rightEl = rightPageCaptureRef.current
      if (!overlayEl || !leftEl || !rightEl) return

      const { left, right } = splitTwoPointShapeCommandsViaClientRects(
        td.kind,
        td.anchor,
        td.current,
        overlayEl.getBoundingClientRect(),
        leftEl.getBoundingClientRect(),
        rightEl.getBoundingClientRect(),
        shapeCommitOptions,
      )

      if (left) leftAnnRef.current?.appendCommand(left)
      if (right) rightAnnRef.current?.appendCommand(right)

      if (left || right) {
        undoStackRef.current.push({ kind: 'shape', left, right })
        redoStackRef.current = []
        emitCapabilities()
      }
    }, [
      emitCapabilities,
      leftAnnRef,
      leftPageCaptureRef,
      onSpreadSessionAppendCommand,
      rightAnnRef,
      rightPageCaptureRef,
      shapeCommitOptions,
      spreadSessionMode,
    ])

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          if (spreadSessionMode) {
            spreadSessionUndo?.()
            return
          }
          const g = undoStackRef.current.pop()
          if (!g) return
          if (g.kind === 'stroke') {
            for (const cmd of g.left) leftAnnRef.current?.removeCommandById(cmd.id)
            for (const cmd of g.right) rightAnnRef.current?.removeCommandById(cmd.id)
          } else if (g.kind === 'shape') {
            if (g.left) leftAnnRef.current?.removeCommandById(g.left.id)
            if (g.right) rightAnnRef.current?.removeCommandById(g.right.id)
          }
          redoStackRef.current.push(g)
          emitCapabilities()
        },
        redo: () => {
          if (spreadSessionMode) {
            spreadSessionRedo?.()
            return
          }
          const g = redoStackRef.current.pop()
          if (!g) return
          if (g.kind === 'stroke') {
            for (const cmd of g.left) leftAnnRef.current?.appendCommand(cmd)
            for (const cmd of g.right) rightAnnRef.current?.appendCommand(cmd)
          } else if (g.kind === 'shape') {
            if (g.left) leftAnnRef.current?.appendCommand(g.left)
            if (g.right) rightAnnRef.current?.appendCommand(g.right)
          }
          undoStackRef.current.push(g)
          emitCapabilities()
        },
        clear: () => {
          if (spreadSessionMode) {
            spreadSessionClear?.()
            return
          }
          undoStackRef.current = []
          redoStackRef.current = []
          leftAnnRef.current?.clear()
          rightAnnRef.current?.clear()
          emitCapabilities()
        },
        appendCommand: () => {
          /* spread overlay commits via split only */
        },
        removeCommandById: () => {
          /* use undo() for spread gestures */
        },
        setLiveEraserLineDraft: () => {
          /* live draft is pushed to left/right page refs from pointer handlers */
        },
        setLiveStrokeDraft: () => {
          /* live draft is pushed to left/right page refs from pointer handlers */
        },
        setLiveTwoPointDraft: () => {
          /* live draft is pushed to left/right page refs from pointer handlers */
        },
      }),
      [
        emitCapabilities,
        leftAnnRef,
        rightAnnRef,
        spreadSessionClear,
        spreadSessionMode,
        spreadSessionRedo,
        spreadSessionUndo,
      ],
    )

    const strokeWidthForTool = useCallback(
      (tool: StrokeTool) =>
        strokeWidthScaleForStrokeTool(tool, {
          strokeWidthScale,
          eraserLineStrokeWidthScale,
          penStrokeWidthScale,
        }),
      [eraserLineStrokeWidthScale, penStrokeWidthScale, strokeWidthScale],
    )

    function makeStrokeDraft(
      tool: StrokeTool,
      spreadPoint: [number, number],
      clientPoint: [number, number],
    ): StrokeAnnotationCommand {
      const base: StrokeAnnotationCommand = {
        kind: 'stroke',
        id: newAnnotationId(),
        tool,
        points: [spreadPoint],
        widthScale: strokeWidthForTool(tool),
      }
      if (tool === 'pen') {
        const inkColor = strokeColor ?? penInkColor
        if (inkColor) base.color = inkColor
        base.lineDashStyle = strokeLineDashStyle
        if (penInkStyle && penInkStyle !== 'solid') {
          base.penInkStyle = penInkStyle
          attachPenInkPatternPhase(base, penInkStyle)
        }
        if (penStrokeProfile) base.penStrokeProfile = penStrokeProfile
      } else if (tool === 'marker' && strokeColor) {
        base.color = strokeColor
        base.lineDashStyle = strokeLineDashStyle
        if (markerDecoratedEdge) base.markerDecoratedEdge = true
      }
      pointsClientRef.current = [clientPoint]
      return base
    }

    function pushLiveDraftForStroke(draft: StrokeAnnotationCommand): void {
      if (draft.tool === 'eraser-line') {
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
        spreadIncrementalDraftRef.current = null
        paintSpreadLiveStrokeDraft(
          draftInkCanvasRef.current,
          draftMarkerCanvasRef.current,
          null,
          spreadOverlayWidthPx,
          spreadCanvasHeightPx,
          spreadIncrementalDraftRef,
          whiteboardViewportInk,
        )
        if (spreadSessionMode) {
          const pts = draft.points
          onSpreadEraserLineDraftChange?.(
            pts.length >= 2
              ? {
                  tool: 'eraser-line',
                  points: pts.map((p) => [p[0], p[1]] as [number, number]),
                  widthScale: draft.widthScale,
                }
              : null,
          )
          return
        }
        const leftEl = leftPageCaptureRef.current
        const rightEl = rightPageCaptureRef.current
        if (leftEl && rightEl && pointsClientRef.current.length >= 1) {
          pushLiveEraserDraftsForSpread(
            pointsClientRef.current,
            leftEl,
            rightEl,
            draft.widthScale,
            leftAnnRef,
            rightAnnRef,
          )
        }
        return
      }
      clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
      syncLiveSpreadStroke()
    }

    function clearSpreadLiveDraftCanvases(): void {
      paintSpreadLiveStrokeDraft(
        draftInkCanvasRef.current,
        draftMarkerCanvasRef.current,
        null,
        spreadOverlayWidthPx,
        spreadCanvasHeightPx,
        spreadIncrementalDraftRef,
        whiteboardViewportInk,
      )
    }
    clearSpreadLiveDraftCanvasesRef.current = clearSpreadLiveDraftCanvases

    function commitCurrentDraftIfReady(): void {
      if (draftStrokeRef.current && draftStrokeRef.current.points.length >= 2) {
        commitStrokeFromClientPoints()
      }
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (!captureEnabled || !isAnnotationPointerDownAccepted(e)) return
      cancelDeferredClearSpreadDraft()
      if (e.pointerType === 'touch') e.preventDefault()
      const strokeTool = effectiveStrokeToolForPointer(annotationMode, e)
      const canvasRect = e.currentTarget.getBoundingClientRect()

      const leftEl = leftPageCaptureRef.current
      const rightEl = rightPageCaptureRef.current
      if (leftEl && rightEl) {
        const seam = seamClientX(leftEl.getBoundingClientRect(), rightEl.getBoundingClientRect())
        const targetPage = e.clientX < seam ? pageNumberLeft : pageNumberRight
        if (targetPage !== annotationTargetPage) {
          setAnnotationTargetPage(targetPage)
        }
      }

      if (strokeTool) {
        gestureRef.current = 'stroke'
        straightStrokeAxisRef.current = null
        clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
        clearLiveTwoPointDraftsBothPages(leftAnnRef, rightAnnRef)
        clearSpreadLiveDraftCanvases()
        onSpreadEraserLineDraftChange?.(null)
        const p0 = clientToInkNorm(canvasRect, e.clientX, e.clientY)
        draftStrokeRef.current = makeStrokeDraft(strokeTool, p0, [e.clientX, e.clientY])
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        flushLiveSpreadStrokePaint()
        return
      }

      if (isTwoPointShapeMode(annotationMode)) {
        gestureRef.current = 'two'
        clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
        const p0 = clientToInkNorm(canvasRect, e.clientX, e.clientY)
        twoDraftRef.current = { kind: annotationMode, anchor: p0, current: p0 }
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        pushLiveTwoPointDraftsForSpread(twoDraftRef.current, spreadInkLayoutRef.current, leftAnnRef, rightAnnRef)
        return
      }
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      if (e.pointerType === 'touch') e.preventDefault()
      const canvasRect = e.currentTarget.getBoundingClientRect()

      if (gestureRef.current === 'two') {
        const td = twoDraftRef.current
        if (!td) return
        const p = clientToInkNorm(canvasRect, e.clientX, e.clientY)
        td.current = p
        pushLiveTwoPointDraftsForSpread(td, spreadInkLayoutRef.current, leftAnnRef, rightAnnRef)
        return
      }

      if (gestureRef.current !== 'stroke') return
      const draft = draftStrokeRef.current
      if (!draft) return

      const p = clientToInkNorm(canvasRect, e.clientX, e.clientY)
      const nextTool = effectiveStrokeToolForPointer(annotationMode, e)
      if (nextTool !== draft.tool) {
        commitCurrentDraftIfReady()
        straightStrokeAxisRef.current = null
        if (nextTool) {
          draftStrokeRef.current = makeStrokeDraft(nextTool, p, [e.clientX, e.clientY])
          flushLiveSpreadStrokePaint()
        } else {
          draftStrokeRef.current = null
          gestureRef.current = null
          pointsClientRef.current = []
          cancelLiveSpreadStrokePaint()
          clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
          clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
          clearSpreadLiveDraftCanvases()
        }
        return
      }

      const samples: [number, number][] = []
      for (const ev of coalescedPointerEvents(e.nativeEvent)) {
        samples.push(clientToInkNorm(canvasRect, ev.clientX, ev.clientY))
        pointsClientRef.current.push([ev.clientX, ev.clientY])
      }
      if (samples.length === 0) return
      straightStrokeAxisRef.current = extendStrokeDraftFromMove(draft, samples, {
        shiftKey: e.shiftKey,
        markerStraightStrokeEnabled: markerStraightStroke,
        penInkStyle: draft.tool === 'pen' ? penInkStyle : undefined,
        straightStrokeAxis: straightStrokeAxisRef.current,
      })

      scheduleLiveSpreadStrokePaint()
    }

    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      const gesture = gestureRef.current
      gestureRef.current = null

      if (gesture === 'two') {
        const td = twoDraftRef.current
        if (td) {
          const canvasRect = e.currentTarget.getBoundingClientRect()
          td.current = clientToInkNorm(canvasRect, e.clientX, e.clientY)
        }
        commitTwoPointFromSpread()
        clearSpreadLiveDraftCanvases()
        return
      }

      const draft = draftStrokeRef.current
      if (gesture === 'stroke' && draft) {
        const canvasRect = e.currentTarget.getBoundingClientRect()
        const p = clientToInkNorm(canvasRect, e.clientX, e.clientY)
        finalizeStrokeDraftEndPoint(draft, p, {
          shiftKey: e.shiftKey,
          markerStraightStrokeEnabled: markerStraightStroke,
          penInkStyle: draft.tool === 'pen' ? penInkStyle : undefined,
          straightStrokeAxis: straightStrokeAxisRef.current,
        })
      }
      straightStrokeAxisRef.current = null

      flushLiveSpreadStrokePaint()
      if (gesture === 'stroke' && draft && draft.points.length >= 1) {
        commitStrokeFromClientPoints()
      }
      draftStrokeRef.current = null
      pointsClientRef.current = []
      clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
      clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
      if (spreadSessionMode) {
        scheduleDeferredClearSpreadDraft()
      } else {
        clearSpreadLiveDraftCanvases()
      }
      onSpreadEraserLineDraftChange?.(null)
    }

    function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      gestureRef.current = null
      straightStrokeAxisRef.current = null
      draftStrokeRef.current = null
      twoDraftRef.current = null
      pointsClientRef.current = []
      cancelLiveSpreadStrokePaint()
      clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
      clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
      clearLiveTwoPointDraftsBothPages(leftAnnRef, rightAnnRef)
      clearSpreadLiveDraftCanvases()
      onSpreadEraserLineDraftChange?.(null)
    }

    const overlayCursor = useMemo(() => {
      if (!captureEnabled) return undefined
      return resolveAnnotationToolCursor(
        annotationMode,
        {
          strokeWidthScale,
          eraserLineStrokeWidthScale,
          penStrokeWidthScale,
        },
        {
          color: strokeColor,
          penStrokeProfile,
        },
      )
    }, [
      captureEnabled,
      annotationMode,
      strokeWidthScale,
      eraserLineStrokeWidthScale,
      penStrokeWidthScale,
      strokeColor,
      penStrokeProfile,
    ])

    const draftCanvasClass = cn('pointer-events-none absolute inset-0 touch-none')

    return (
      <div
        ref={captureRef}
        className={cn(
          'pointer-events-none absolute inset-0 z-[30] touch-none',
          captureEnabled && 'pointer-events-auto',
        )}
        aria-hidden={!captureEnabled}
        style={{
          cursor: captureEnabled ? overlayCursor : undefined,
          touchAction: captureEnabled ? 'none' : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => {
          if ((e.nativeEvent as PointerEvent).pointerType === 'pen') e.preventDefault()
        }}
      >
        <canvas
          ref={draftInkCanvasRef}
          role="presentation"
          aria-label="Spread stroke live preview"
          className={cn(draftCanvasClass, 'z-[19]')}
        />
        <canvas
          ref={draftMarkerCanvasRef}
          role="presentation"
          aria-hidden
          className={cn(draftCanvasClass, 'z-[20]')}
          style={MARKER_CANVAS_BLEND}
        />
      </div>
    )
  },
)

BookSpreadStrokeOverlay.displayName = 'BookSpreadStrokeOverlay'
