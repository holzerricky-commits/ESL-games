'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react'
import type { MutableRefObject } from 'react'
import type { AnnotationLineDashStyle, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import { drawLaserTrail } from '@/lib/books/annotation-draw'
import { attachPenInkPatternPhase } from '@/lib/books/pen-ink'
import { clientToSpreadNorm } from '@/lib/books/spread-canvas-coords'
import {
  seamClientX,
  splitClientPolylineToPageNormalizedChains,
  splitSpreadNormPolylineToPageNormalizedChains,
  type SpreadInkLayout,
} from '@/lib/books/spread-stroke-split'
import type {
  AnnotationCapabilities,
  BookPageAnnotationHandle,
  LiveStrokeDraft,
} from '@/components/students/book-page-annotation-layer'
import { cn } from '@/lib/utils'
import {
  strokeWidthScaleForStrokeTool,
} from '@/lib/books/annotation-stroke-utils'
import {
  effectiveStrokeToolForPointer,
  isAnnotationPointerDownAccepted,
} from '@/lib/books/pen-barrel-button'
import type { StrokeTool } from '@/lib/books/annotation-command-types'

function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

type SpreadGestureEntry = {
  left: StrokeAnnotationCommand | null
  right: StrokeAnnotationCommand | null
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
  | 'penInkPatternPhaseX'
  | 'penInkPatternPhaseY'
> {
  return {
    ...(draft.widthScale != null ? { widthScale: draft.widthScale } : {}),
    ...(draft.color ? { color: draft.color } : {}),
    ...(draft.lineDashStyle ? { lineDashStyle: draft.lineDashStyle } : {}),
    ...(draft.penInkStyle && draft.penInkStyle !== 'solid' ? { penInkStyle: draft.penInkStyle } : {}),
    ...(draft.penInkPatternPhaseX != null ? { penInkPatternPhaseX: draft.penInkPatternPhaseX } : {}),
    ...(draft.penInkPatternPhaseY != null ? { penInkPatternPhaseY: draft.penInkPatternPhaseY } : {}),
  }
}

function toLiveStrokeDraft(
  draft: StrokeAnnotationCommand,
  points: [number, number][],
): LiveStrokeDraft {
  return {
    tool: draft.tool,
    points,
    ...strokeInkFieldsFromDraft(draft),
  }
}

function clearSpreadCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function paintSpreadLaser(
  canvas: HTMLCanvasElement,
  laserPts: [number, number][],
  spreadW: number,
  spreadH: number,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (laserPts.length < 2) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawLaserTrail(ctx, laserPts, spreadW, spreadH)
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
  leftAnnRef.current?.setLiveEraserLineDraft(
    leftNorm.length >= 2 ? { tool: 'eraser-line', points: leftNorm, widthScale } : null,
  )
  rightAnnRef.current?.setLiveEraserLineDraft(
    rightNorm.length >= 2 ? { tool: 'eraser-line', points: rightNorm, widthScale } : null,
  )
}

/** Live pen/marker/eraser on page canvases — same split path as commit (no spread overlay ink). */
function pushLiveStrokeDraftsForSpread(
  draft: StrokeAnnotationCommand,
  layout: SpreadInkLayout,
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>,
): void {
  if (draft.tool === 'eraser-line' || draft.points.length < 2) {
    clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
    return
  }
  const { leftNorm, rightNorm } = splitSpreadNormPolylineToPageNormalizedChains(draft.points, layout)
  leftAnnRef.current?.setLiveStrokeDraft(
    leftNorm.length >= 2 ? toLiveStrokeDraft(draft, leftNorm) : null,
  )
  rightAnnRef.current?.setLiveStrokeDraft(
    rightNorm.length >= 2 ? toLiveStrokeDraft(draft, rightNorm) : null,
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
  /** Pen/marker ink dash; ignored for erasers. */
  strokeLineDashStyle?: AnnotationLineDashStyle
  pageNumberLeft: number
  pageNumberRight: number
  setAnnotationTargetPage: (page: number) => void
  onCapabilitiesChange: (caps: AnnotationCapabilities) => void
  /** When false, overlay is visually present but does not capture pointer events (non-stroke tools use page layers). */
  captureEnabled: boolean
  /** Logical spread width/height (cluster width = 2–page − one overlap). */
  spreadOverlayWidthPx: number
  spreadOverlayHeightPx: number
  spreadPageWidthPx: number
  /** Logical X offset of each page slot within the spread (for ink pattern + commit split). */
  leftPenInkPatternOriginXPx: number
  rightPenInkPatternOriginXPx: number
  /** Seam between pages in spread-overlay normalized X (0..1). */
  spreadSeamNormX: number
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
      strokeLineDashStyle = 'solid',
      pageNumberLeft,
      pageNumberRight,
      setAnnotationTargetPage,
      onCapabilitiesChange,
      captureEnabled,
      spreadOverlayWidthPx,
      spreadOverlayHeightPx,
      spreadPageWidthPx,
      leftPenInkPatternOriginXPx,
      rightPenInkPatternOriginXPx,
      spreadSeamNormX,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    const gestureRef = useRef<'laser' | 'stroke' | null>(null)
    const draftStrokeRef = useRef<StrokeAnnotationCommand | null>(null)
    const laserRef = useRef<[number, number][]>([])
    const pointsClientRef = useRef<[number, number][]>([])

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
      onCapabilitiesChangeRef.current?.({
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
      })
    }, [])

    useEffect(() => {
      queueMicrotask(emitCapabilities)
    }, [emitCapabilities])

    const paintLaserOverlay = useCallback(() => {
      const el = canvasRef.current
      if (!el || !(spreadOverlayWidthPx > 0) || !(spreadOverlayHeightPx > 0)) return
      if (laserRef.current.length >= 2) {
        paintSpreadLaser(el, laserRef.current, spreadOverlayWidthPx, spreadOverlayHeightPx)
      } else {
        clearSpreadCanvas(el)
      }
    }, [spreadOverlayWidthPx, spreadOverlayHeightPx])

    const syncLivePageStrokes = useCallback(() => {
      const draft = draftStrokeRef.current
      if (!draft) {
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
        return
      }
      pushLiveStrokeDraftsForSpread(draft, spreadInkLayoutRef.current, leftAnnRef, rightAnnRef)
    }, [leftAnnRef, rightAnnRef])

    useEffect(() => {
      if (gestureRef.current === 'stroke' && draftStrokeRef.current) {
        syncLivePageStrokes()
      }
    }, [
      syncLivePageStrokes,
      spreadOverlayWidthPx,
      spreadPageWidthPx,
      leftPenInkPatternOriginXPx,
      rightPenInkPatternOriginXPx,
      spreadSeamNormX,
    ])

    useLayoutEffect(() => {
      const el = canvasRef.current
      if (!el || !(spreadOverlayWidthPx > 0) || !(spreadOverlayHeightPx > 0)) return
      const dpr = window.devicePixelRatio || 1
      const nextW = Math.max(1, Math.floor(spreadOverlayWidthPx * dpr))
      const nextH = Math.max(1, Math.floor(spreadOverlayHeightPx * dpr))
      el.style.width = `${spreadOverlayWidthPx}px`
      el.style.height = `${spreadOverlayHeightPx}px`
      if (el.width !== nextW || el.height !== nextH) {
        el.width = nextW
        el.height = nextH
      }
      paintLaserOverlay()
    }, [paintLaserOverlay, spreadOverlayWidthPx, spreadOverlayHeightPx, annotationMode, captureEnabled])

    const commitStrokeFromClientPoints = useCallback(() => {
      pointsClientRef.current = []
      const draft = draftStrokeRef.current
      if (!draft || draft.points.length < 2) return

      clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)

      const { leftNorm, rightNorm } = splitSpreadNormPolylineToPageNormalizedChains(draft.points, {
        spreadOverlayWidthPx: spreadOverlayWidthPx,
        spreadPageWidthPx,
        leftPageOriginXPx: leftPenInkPatternOriginXPx,
        rightPageOriginXPx: rightPenInkPatternOriginXPx,
        seamNormX: spreadSeamNormX,
      })

      let leftCmd: StrokeAnnotationCommand | null = null
      let rightCmd: StrokeAnnotationCommand | null = null

      if (leftNorm.length >= 2) {
        leftCmd = {
          kind: 'stroke',
          id: newAnnotationId(),
          tool: draft.tool,
          points: leftNorm,
          ...strokeInkFieldsFromDraft(draft),
        }
        leftAnnRef.current?.appendCommand(leftCmd)
      }
      if (rightNorm.length >= 2) {
        rightCmd = {
          kind: 'stroke',
          id: newAnnotationId(),
          tool: draft.tool,
          points: rightNorm,
          ...strokeInkFieldsFromDraft(draft),
        }
        rightAnnRef.current?.appendCommand(rightCmd)
      }

      if (leftCmd || rightCmd) {
        undoStackRef.current.push({
          left: leftCmd ? cloneStroke(leftCmd) : null,
          right: rightCmd ? cloneStroke(rightCmd) : null,
        })
        redoStackRef.current = []
        emitCapabilities()
      }
    }, [
      emitCapabilities,
      leftAnnRef,
      rightAnnRef,
      spreadOverlayWidthPx,
      spreadPageWidthPx,
      leftPenInkPatternOriginXPx,
      rightPenInkPatternOriginXPx,
      spreadSeamNormX,
    ])

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          const g = undoStackRef.current.pop()
          if (!g) return
          if (g.left) leftAnnRef.current?.removeCommandById(g.left.id)
          if (g.right) rightAnnRef.current?.removeCommandById(g.right.id)
          redoStackRef.current.push(g)
          emitCapabilities()
        },
        redo: () => {
          const g = redoStackRef.current.pop()
          if (!g) return
          if (g.left) leftAnnRef.current?.appendCommand(g.left)
          if (g.right) rightAnnRef.current?.appendCommand(g.right)
          undoStackRef.current.push(g)
          emitCapabilities()
        },
        clear: () => {
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
      }),
      [emitCapabilities, leftAnnRef, rightAnnRef],
    )

    const isLaser = annotationMode === 'laser'

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
      } else if (tool === 'marker' && strokeColor) {
        base.color = strokeColor
        base.lineDashStyle = strokeLineDashStyle
      }
      pointsClientRef.current = [clientPoint]
      return base
    }

    function pushLiveDraftForStroke(draft: StrokeAnnotationCommand): void {
      if (draft.tool === 'eraser-line') {
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
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
      syncLivePageStrokes()
    }

    function commitCurrentDraftIfReady(): void {
      if (draftStrokeRef.current && draftStrokeRef.current.points.length >= 2) {
        commitStrokeFromClientPoints()
      }
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!captureEnabled || !isAnnotationPointerDownAccepted(e)) return
      const strokeTool = effectiveStrokeToolForPointer(annotationMode, e)
      const canvasRect = e.currentTarget.getBoundingClientRect()

      const leftEl = leftPageCaptureRef.current
      const rightEl = rightPageCaptureRef.current
      if (leftEl && rightEl) {
        const seam = seamClientX(leftEl.getBoundingClientRect(), rightEl.getBoundingClientRect())
        setAnnotationTargetPage(e.clientX < seam ? pageNumberLeft : pageNumberRight)
      }

      if (strokeTool) {
        gestureRef.current = 'stroke'
        clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
        const el = canvasRef.current
        if (el) clearSpreadCanvas(el)
        const p0 = clientToSpreadNorm(canvasRect, e.clientX, e.clientY)
        draftStrokeRef.current = makeStrokeDraft(strokeTool, p0, [e.clientX, e.clientY])
        e.currentTarget.setPointerCapture(e.pointerId)
        pushLiveDraftForStroke(draftStrokeRef.current)
        return
      }

      if (isLaser) {
        gestureRef.current = 'laser'
        clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
        const p = clientToSpreadNorm(canvasRect, e.clientX, e.clientY)
        laserRef.current = [p]
        e.currentTarget.setPointerCapture(e.pointerId)
        paintLaserOverlay()
      }
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      const canvasRect = e.currentTarget.getBoundingClientRect()

      if (gestureRef.current === 'laser') {
        const p = clientToSpreadNorm(canvasRect, e.clientX, e.clientY)
        const arr = laserRef.current
        const last = arr[arr.length - 1]
        if (last) {
          const dx = p[0] - last[0]
          const dy = p[1] - last[1]
          if (dx * dx + dy * dy < 1e-8) return
        }
        arr.push(p)
        paintLaserOverlay()
        return
      }

      if (gestureRef.current !== 'stroke') return
      const draft = draftStrokeRef.current
      if (!draft) return

      const p = clientToSpreadNorm(canvasRect, e.clientX, e.clientY)
      const nextTool = effectiveStrokeToolForPointer(annotationMode, e)
      if (nextTool !== draft.tool) {
        commitCurrentDraftIfReady()
        if (nextTool) {
          draftStrokeRef.current = makeStrokeDraft(nextTool, p, [e.clientX, e.clientY])
          pushLiveDraftForStroke(draftStrokeRef.current)
        } else {
          draftStrokeRef.current = null
          gestureRef.current = null
          pointsClientRef.current = []
          clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
          clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
          const el = canvasRef.current
          if (el) clearSpreadCanvas(el)
        }
        return
      }

      pointsClientRef.current.push([e.clientX, e.clientY])
      const last = draft.points[draft.points.length - 1]
      const dx = p[0] - last[0]
      const dy = p[1] - last[1]
      if (dx * dx + dy * dy < 1e-8) return
      draft.points.push(p)

      pushLiveDraftForStroke(draft)
    }

    function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      const gesture = gestureRef.current
      gestureRef.current = null

      if (gesture === 'laser') {
        laserRef.current = []
        draftStrokeRef.current = null
        pointsClientRef.current = []
        clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
        clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
        paintLaserOverlay()
        return
      }

      if (gesture === 'stroke' && draftStrokeRef.current && draftStrokeRef.current.points.length >= 2) {
        commitStrokeFromClientPoints()
      }
      draftStrokeRef.current = null
      pointsClientRef.current = []
      clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
      clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
      const el = canvasRef.current
      if (el) clearSpreadCanvas(el)
    }

    function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      gestureRef.current = null
      draftStrokeRef.current = null
      laserRef.current = []
      pointsClientRef.current = []
      clearLiveEraserDraftsBothPages(leftAnnRef, rightAnnRef)
      clearLiveStrokeDraftsBothPages(leftAnnRef, rightAnnRef)
      const el = canvasRef.current
      if (el) clearSpreadCanvas(el)
      paintLaserOverlay()
    }

    const canvasClass =
      annotationMode === 'laser'
        ? 'absolute inset-0 z-[19] touch-none cursor-crosshair'
        : 'absolute inset-0 z-[19] touch-none'

    return (
      <div
        className={cn('pointer-events-none absolute inset-0', captureEnabled && 'pointer-events-auto')}
        aria-hidden={!captureEnabled}
      >
        <canvas
          ref={canvasRef}
          role="presentation"
          aria-label="Spread stroke overlay"
          className={canvasClass}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => {
            if ((e.nativeEvent as PointerEvent).pointerType === 'pen') e.preventDefault()
          }}
        />
      </div>
    )
  },
)

BookSpreadStrokeOverlay.displayName = 'BookSpreadStrokeOverlay'
