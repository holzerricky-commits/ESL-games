'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { drawAnnotationCommand, drawLaserTrail, drawStrokePath, applyAnnotationLineDash } from '@/lib/books/annotation-draw'
import { subscribeBrushPatternTileLoads } from '@/lib/books/brush-pattern-loader'
import { attachPenInkPatternPhase, type PenInkPatternOrigin } from '@/lib/books/pen-ink'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import { DEFAULT_STAMP_QUESTION_COLOR, stampColorForVariant } from '@/lib/books/annotation-palettes'
import {
  shapeFillAlphaForMode,
  type AnnotationCommand,
  type ArrowAnnotationCommand,
  type EllipseAnnotationCommand,
  type LineAnnotationCommand,
  type RectAnnotationCommand,
  type TriangleAnnotationCommand,
  type StampVariant,
  type StrokeAnnotationCommand,
  type StickyAnnotationCommand,
  type TextAnnotationCommand,
  type TextAnnotationVisualStyle,
  type AnnotationLineDashStyle,
  type ShapeFillMode,
  type StrokeTool,
} from '@/lib/books/annotation-command-types'
import type { AnnotationStorageChannel, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'

type TapMode = Extract<
  BookAnnotationInteractionMode,
  'stamp' | 'callout' | 'text' | 'sticky' | 'eyedropper'
>
import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
import {
  strokeWidthScaleForStrokeTool,
} from '@/lib/books/annotation-stroke-utils'
import {
  effectiveStrokeToolForPointer,
  isAnnotationPointerDownAccepted,
} from '@/lib/books/pen-barrel-button'
import { BookPageAnnotationDomLayer } from '@/components/students/book-page-annotation-dom-layer'

const TWO_POINT_EPS = 0.004
const TAP_MOVE_EPS = 0.006
const EYEDROPPER_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.7 5.6 18.4 3.3a1 1 0 0 0-1.4 0l-3.1 3.1-1.9-1.9-1.5 1.4 1.5 1.5-9 9V21h4.6l9-9 1.5 1.5 1.4-1.5-1.9-1.9 3.1-3.1a1 1 0 0 0 0-1.4ZM6.9 19 5 17.1 13.1 9l1.9 1.9L6.9 19Z' fill='none' stroke='white' stroke-width='3.25' stroke-linejoin='round' stroke-linecap='round'/%3E%3Cpath d='M20.7 5.6 18.4 3.3a1 1 0 0 0-1.4 0l-3.1 3.1-1.9-1.9-1.5 1.4 1.5 1.5-9 9V21h4.6l9-9 1.5 1.5 1.4-1.5-1.9-1.9 3.1-3.1a1 1 0 0 0 0-1.4ZM6.9 19 5 17.1 13.1 9l1.9 1.9L6.9 19Z' fill='black'/%3E%3C/svg%3E\") 4 20, crosshair"

function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function nextCalloutIndex(commands: AnnotationCommand[]): number {
  let m = 0
  for (const c of commands) {
    if (c.kind === 'callout') m = Math.max(m, c.index)
  }
  return m + 1
}

type TwoDraftKind = 'line' | 'rect' | 'ellipse' | 'triangle' | 'arrow'

interface TwoPointDraft {
  kind: TwoDraftKind
  anchor: [number, number]
  current: [number, number]
}

function normalizeRect(a: [number, number], b: [number, number]) {
  const x0 = clamp01(Math.min(a[0], b[0]))
  const y0 = clamp01(Math.min(a[1], b[1]))
  const x1 = clamp01(Math.max(a[0], b[0]))
  const y1 = clamp01(Math.max(a[1], b[1]))
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

type ShapePreviewOpts = {
  shapeColor: string
  shapeStrokeWidthScale: number
  shapeLineDashStyle: AnnotationLineDashStyle
  shapeStrokeEnabled: boolean
  shapeFillMode: ShapeFillMode
  shapeFillColor: string
}

function shapeFillRgba(hex: string, mode: ShapeFillMode): string | null {
  const alpha = shapeFillAlphaForMode(mode)
  if (alpha == null) return null
  const rr = parseInt(hex.slice(1, 3), 16)
  const gg = parseInt(hex.slice(3, 5), 16)
  const bb = parseInt(hex.slice(5, 7), 16)
  return `rgba(${rr},${gg},${bb},${alpha})`
}

function drawTwoPointPreview(
  ctx: CanvasRenderingContext2D,
  draft: TwoPointDraft,
  widthPx: number,
  heightPx: number,
  opts: ShapePreviewOpts,
): void {
  const { shapeColor, shapeStrokeWidthScale, shapeLineDashStyle, shapeStrokeEnabled, shapeFillMode, shapeFillColor } =
    opts
  const fillPaint = shapeFillRgba(shapeFillColor, shapeFillMode)
  const sx = (nx: number) => nx * widthPx
  const sy = (ny: number) => ny * heightPx
  const { x, y, w, h } = normalizeRect(draft.anchor, draft.current)
  const ax = sx(draft.anchor[0])
  const ay = sy(draft.anchor[1])
  const bx = sx(draft.current[0])
  const by = sy(draft.current[1])
  const lw = Math.max(1, 2.25 * (shapeStrokeWidthScale || 1))
  ctx.save()
  ctx.globalAlpha = 0.88
  ctx.lineCap = 'round'
  if (draft.kind === 'line' || draft.kind === 'arrow') {
    ctx.strokeStyle = shapeColor
    ctx.lineWidth = lw
    applyAnnotationLineDash(ctx, shapeLineDashStyle, lw)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.setLineDash([])
    if (draft.kind === 'arrow') {
      const dx = bx - ax
      const dy = by - ay
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const headLen = 0.035 * Math.min(widthPx, heightPx)
      const hw = headLen * 0.45
      const bxShaft = bx - ux * headLen
      const byShaft = by - uy * headLen
      const px = -uy
      const py = ux
      ctx.fillStyle = shapeColor
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(bxShaft + px * hw, byShaft + py * hw)
      ctx.lineTo(bxShaft - px * hw, byShaft - py * hw)
      ctx.closePath()
      ctx.fill()
    }
  } else if (draft.kind === 'rect') {
    const rx = sx(x)
    const ry = sy(y)
    const rw = w * widthPx
    const rh = h * heightPx
    if (fillPaint) {
      ctx.fillStyle = fillPaint
      ctx.fillRect(rx, ry, rw, rh)
    }
    if (shapeStrokeEnabled) {
      ctx.strokeStyle = shapeColor
      ctx.lineWidth = lw
      ctx.lineCap = 'butt'
      applyAnnotationLineDash(ctx, shapeLineDashStyle, lw)
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
    }
  } else if (draft.kind === 'triangle') {
    const rx = sx(x)
    const ry = sy(y)
    const rw = w * widthPx
    const rh = h * heightPx
    const topX = rx + rw / 2
    const topY = ry
    const blX = rx
    const blY = ry + rh
    const brX = rx + rw
    const brY = ry + rh
    ctx.beginPath()
    ctx.moveTo(topX, topY)
    ctx.lineTo(blX, blY)
    ctx.lineTo(brX, brY)
    ctx.closePath()
    if (fillPaint) {
      ctx.fillStyle = fillPaint
      ctx.fill()
    }
    if (shapeStrokeEnabled) {
      ctx.beginPath()
      ctx.moveTo(topX, topY)
      ctx.lineTo(blX, blY)
      ctx.lineTo(brX, brY)
      ctx.closePath()
      ctx.strokeStyle = shapeColor
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      applyAnnotationLineDash(ctx, shapeLineDashStyle, lw)
      ctx.stroke()
      ctx.setLineDash([])
    }
  } else {
    const cx = sx(x) + (w * widthPx) / 2
    const cy = sy(y) + (h * heightPx) / 2
    const rx = (w * widthPx) / 2
    const ry = (h * heightPx) / 2
    if (rx > 0 && ry > 0) {
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
      if (fillPaint) {
        ctx.fillStyle = fillPaint
        ctx.fill()
      }
      if (shapeStrokeEnabled) {
        ctx.beginPath()
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
        ctx.strokeStyle = shapeColor
        ctx.lineWidth = lw
        applyAnnotationLineDash(ctx, shapeLineDashStyle, lw)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }
  ctx.restore()
}

export type LiveEraserLineDraft = Pick<StrokeAnnotationCommand, 'tool' | 'points' | 'widthScale'>

/** Spread-mode live pen/marker/eraser preview pushed from `BookSpreadStrokeOverlay`. */
export type LiveStrokeDraft = Pick<
  StrokeAnnotationCommand,
  | 'tool'
  | 'points'
  | 'widthScale'
  | 'color'
  | 'lineDashStyle'
  | 'penInkStyle'
  | 'penInkPatternPhaseX'
  | 'penInkPatternPhaseY'
>

export type BookPageAnnotationHandle = {
  undo: () => void
  redo: () => void
  clear: () => void
  /** Append one command (e.g. spread overlay split commit); clears redo like an in-app stroke commit. */
  appendCommand: (cmd: AnnotationCommand) => void
  /** Remove a command by id (used for merged spread-gesture undo). Clears redo. */
  removeCommandById: (id: string) => void
  /** Spread-mode stroke eraser: live-remove ink on this page while dragging (null clears). */
  setLiveEraserLineDraft: (draft: LiveEraserLineDraft | null) => void
  /** Spread-mode pen/marker/eraser: live stroke on this page (null clears). */
  setLiveStrokeDraft: (draft: LiveStrokeDraft | null) => void
}

export type AnnotationCapabilities = {
  canUndo: boolean
  canRedo: boolean
}

function eraserLineTrailingForReplay(
  draftStroke: StrokeAnnotationCommand | null,
  liveEraserLineDraft: LiveEraserLineDraft | null,
): LiveEraserLineDraft | null {
  if (draftStroke?.tool === 'eraser-line' && draftStroke.points.length >= 2) {
    return draftStroke
  }
  if (liveEraserLineDraft?.tool === 'eraser-line' && liveEraserLineDraft.points.length >= 2) {
    return liveEraserLineDraft
  }
  return null
}

function replayAll(
  ctx: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
  commands: AnnotationCommand[],
  draftStroke: StrokeAnnotationCommand | null,
  twoDraft: TwoPointDraft | null,
  laserPts: [number, number][],
  shapePreview: ShapePreviewOpts,
  liveEraserLineDraft: LiveEraserLineDraft | null,
  liveSpreadStrokeDraft: LiveStrokeDraft | null,
  penInkPatternOrigin?: PenInkPatternOrigin,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const trailing = eraserLineTrailingForReplay(draftStroke, liveEraserLineDraft)
  const dead = computeEraserLineDeadIndices(commands, trailing)
  for (let i = 0; i < commands.length; i++) {
    if (dead.has(i)) continue
    drawAnnotationCommand(ctx, commands[i], widthPx, heightPx, penInkPatternOrigin)
  }

  if (draftStroke && draftStroke.points.length >= 2 && draftStroke.tool !== 'eraser-line') {
    drawStrokePath(ctx, draftStroke, widthPx, heightPx, penInkPatternOrigin)
  } else if (liveSpreadStrokeDraft && liveSpreadStrokeDraft.points.length >= 2) {
    drawStrokePath(ctx, liveSpreadStrokeDraft, widthPx, heightPx, penInkPatternOrigin)
  }

  if (twoDraft) {
    drawTwoPointPreview(ctx, twoDraft, widthPx, heightPx, shapePreview)
  }

  if (laserPts.length >= 2) {
    drawLaserTrail(ctx, laserPts, widthPx, heightPx)
  }
}

export interface BookPageAnnotationLayerProps {
  studentId: string
  bookId: string
  unitId: string
  pageNumber: number
  /** Separate localStorage slot from PDF ink (`wb:{page}` vs page number string). */
  storageChannel?: AnnotationStorageChannel
  widthPx: number
  heightPx: number
  mode: BookAnnotationInteractionMode
  stampVariant: StampVariant
  stampQuestionColor?: string
  strokeWidthScale: number
  /** Width for stroke eraser (toolbar). */
  eraserLineStrokeWidthScale: number
  penStrokeWidthScale: number
  /** Line width scale for line, rect, ellipse, arrow previews and commits. */
  shapeStrokeWidthScale: number
  /** Stamp / callout size multiplier (same numeric range as stroke width scales). */
  stampScale: number
  /** Pen or marker stroke color (#RRGGBB); omit for erasers. */
  strokeColor?: string
  /** Pen ink color when auto-inking from laser/eraser (toolbar strokeColor may be unset). */
  penInkColor?: string
  /** Effect ink for pen strokes; omit for marker/eraser. */
  penInkStyle?: import('@/lib/books/pen-ink').PenInkStyle
  /** Spread-space X offset so effect ink matches live spread overlay after commit. */
  penInkPatternOriginXPx?: number
  penInkPatternOriginYPx?: number
  /** Dash style for pen/marker ink on this layer. */
  strokeLineDashStyle?: AnnotationLineDashStyle
  /** Shapes and callout stroke/fill color (#RRGGBB). */
  shapeColor: string
  /** Text annotation color (#RRGGBB). */
  textColor: string
  shapeLineDashStyle?: AnnotationLineDashStyle
  /** Rectangle and ellipse only; line and arrow always draw an outline. */
  shapeStrokeEnabled?: boolean
  shapeFillMode?: ShapeFillMode
  /** Fill color (#RRGGBB) when fill mode is solid or transparent. */
  shapeFillColor?: string
  textFontSizeNorm: number
  stickyFontSizeNorm: number
  /** New text boxes: plain (no box) or filled background (no border). */
  textVisualStyle?: TextAnnotationVisualStyle
  /** Background hex when `textVisualStyle` is `filled`. */
  textFillColor?: string
  /** New sticky notes background (#RRGGBB). */
  stickyFillColor?: string
  defaultStickyWNorm: number
  defaultStickyHNorm: number
  onPointerSessionStart?: () => void
  /** Client coords when eyedropper completes a tap. */
  onEyedropperPick?: (clientX: number, clientY: number) => void
  onCapabilitiesChange?: (caps: AnnotationCapabilities) => void
}

export const BookPageAnnotationLayer = forwardRef<BookPageAnnotationHandle, BookPageAnnotationLayerProps>(
  function BookPageAnnotationLayer(
    {
      studentId,
      bookId,
      unitId,
      pageNumber,
      storageChannel = 'pdf',
      widthPx,
      heightPx,
      mode,
      stampVariant,
      stampQuestionColor = DEFAULT_STAMP_QUESTION_COLOR,
      strokeWidthScale,
      eraserLineStrokeWidthScale,
      penStrokeWidthScale,
      shapeStrokeWidthScale,
      stampScale,
      strokeColor,
      penInkColor,
      penInkStyle,
      penInkPatternOriginXPx = 0,
      penInkPatternOriginYPx = 0,
      strokeLineDashStyle = 'solid',
      shapeColor,
      textColor,
      shapeLineDashStyle = 'solid',
      shapeStrokeEnabled = true,
      shapeFillMode = 'none',
      shapeFillColor = '#eab308',
      textFontSizeNorm,
      stickyFontSizeNorm,
      textVisualStyle = 'plain',
      textFillColor = '#fef9c3',
      stickyFillColor = '#fef3c7',
      defaultStickyWNorm,
      defaultStickyHNorm,
      onPointerSessionStart,
      onEyedropperPick,
      onCapabilitiesChange,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [commands, setCommands] = useState<AnnotationCommand[]>([])
    const commandsRef = useRef<AnnotationCommand[]>([])
    const redoStackRef = useRef<AnnotationCommand[]>([])
    const draftStrokeRef = useRef<StrokeAnnotationCommand | null>(null)
    const liveEraserLineDraftRef = useRef<LiveEraserLineDraft | null>(null)
    const liveSpreadStrokeDraftRef = useRef<LiveStrokeDraft | null>(null)
    const twoDraftRef = useRef<TwoPointDraft | null>(null)
    const laserRef = useRef<[number, number][]>([])
    const tapStartRef = useRef<[number, number] | null>(null)
    const tapStartClientRef = useRef<[number, number] | null>(null)
    const gestureRef = useRef<'laser' | 'stroke' | 'two' | 'tap' | null>(null)
    const tapModeRef = useRef<TapMode | null>(null)
    const [focusNewId, setFocusNewId] = useState<string | null>(null)
    /** Bumped during live stroke-eraser preview so DOM text/stickies hide in sync with canvas. */
    const [erasePreviewEpoch, setErasePreviewEpoch] = useState(0)

    const onCapabilitiesChangeRef = useRef(onCapabilitiesChange)
    onCapabilitiesChangeRef.current = onCapabilitiesChange

    const penInkPatternOrigin = useMemo<PenInkPatternOrigin>(
      () => ({ x: penInkPatternOriginXPx, y: penInkPatternOriginYPx }),
      [penInkPatternOriginXPx, penInkPatternOriginYPx],
    )

    commandsRef.current = commands

    const emitCapabilities = useCallback(() => {
      onCapabilitiesChangeRef.current?.({
        canUndo: commandsRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
      })
    }, [])

    useEffect(() => {
      const loaded = getAnnotationsForPage(studentId, bookId, unitId, pageNumber, storageChannel)
      setCommands(loaded)
      redoStackRef.current = []
      commandsRef.current = loaded
      liveEraserLineDraftRef.current = null
      liveSpreadStrokeDraftRef.current = null
      setFocusNewId(null)
      queueMicrotask(emitCapabilities)
    }, [studentId, bookId, unitId, pageNumber, storageChannel, emitCapabilities])

    const persist = useCallback(
      (next: AnnotationCommand[]) => {
        commandsRef.current = next
        setAnnotationsForPage(studentId, bookId, unitId, pageNumber, next, storageChannel)
        emitCapabilities()
      },
      [studentId, bookId, unitId, pageNumber, storageChannel, emitCapabilities],
    )

    const patchCommand = useCallback(
      (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => {
        const next = commandsRef.current.map((c) => (c.id === id ? ({ ...c, ...partial } as AnnotationCommand) : c))
        setCommands(next)
        persist(next)
      },
      [persist],
    )

    const deleteStickyCommand = useCallback(
      (id: string) => {
        const next = commandsRef.current.filter((c) => c.id !== id)
        redoStackRef.current = []
        setCommands(next)
        persist(next)
      },
      [persist],
    )

    const paint = useCallback(
      (
        draftStroke: StrokeAnnotationCommand | null,
        twoDraft: TwoPointDraft | null,
        laserPts: [number, number][],
      ) => {
        const el = canvasRef.current
        if (!el || widthPx <= 0 || heightPx <= 0) return
        const ctx = el.getContext('2d')
        if (!ctx) return
        const trailing = eraserLineTrailingForReplay(draftStroke, liveEraserLineDraftRef.current)
        replayAll(
          ctx,
          widthPx,
          heightPx,
          commandsRef.current,
          draftStroke,
          twoDraft,
          laserPts,
          {
            shapeColor,
            shapeStrokeWidthScale,
            shapeLineDashStyle,
            shapeStrokeEnabled,
            shapeFillMode,
            shapeFillColor,
          },
          liveEraserLineDraftRef.current,
          liveSpreadStrokeDraftRef.current,
          penInkPatternOrigin,
        )
        if (trailing) setErasePreviewEpoch((n) => n + 1)
      },
      [
        widthPx,
        heightPx,
        shapeColor,
        shapeStrokeWidthScale,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
        penInkPatternOrigin,
      ],
    )

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          const stack = commandsRef.current
          if (stack.length === 0) return
          const popped = stack[stack.length - 1]
          const next = stack.slice(0, -1)
          redoStackRef.current.push(popped)
          setCommands(next)
          persist(next)
        },
        redo: () => {
          const tail = redoStackRef.current.pop()
          if (!tail) return
          const next = [...commandsRef.current, tail]
          setCommands(next)
          persist(next)
        },
        clear: () => {
          redoStackRef.current = []
          liveEraserLineDraftRef.current = null
          liveSpreadStrokeDraftRef.current = null
          setCommands([])
          persist([])
        },
        appendCommand: (cmd: AnnotationCommand) => {
          redoStackRef.current = []
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
        },
        removeCommandById: (id: string) => {
          const prev = commandsRef.current
          const next = prev.filter((c) => c.id !== id)
          if (next.length === prev.length) return
          redoStackRef.current = []
          setCommands(next)
          persist(next)
        },
        setLiveEraserLineDraft: (draft: LiveEraserLineDraft | null) => {
          liveEraserLineDraftRef.current = draft
          paint(draftStrokeRef.current, twoDraftRef.current, laserRef.current)
        },
        setLiveStrokeDraft: (draft: LiveStrokeDraft | null) => {
          liveSpreadStrokeDraftRef.current = draft
          paint(draftStrokeRef.current, twoDraftRef.current, laserRef.current)
        },
      }),
      [persist, paint],
    )

    useLayoutEffect(() => {
      const el = canvasRef.current
      if (!el || widthPx <= 0 || heightPx <= 0) return
      const dpr = window.devicePixelRatio || 1
      const nextW = Math.max(1, Math.floor(widthPx * dpr))
      const nextH = Math.max(1, Math.floor(heightPx * dpr))
      if (el.width !== nextW || el.height !== nextH) {
        el.width = nextW
        el.height = nextH
        el.style.width = `${widthPx}px`
        el.style.height = `${heightPx}px`
      }
      paint(draftStrokeRef.current, twoDraftRef.current, laserRef.current)
    }, [widthPx, heightPx, commands, paint, mode, strokeColor, strokeWidthScale, strokeLineDashStyle, penInkPatternOrigin])

    useEffect(
      () =>
        subscribeBrushPatternTileLoads(() => {
          paint(draftStrokeRef.current, twoDraftRef.current, laserRef.current)
        }),
      [paint],
    )

    function clientToNorm(clientX: number, clientY: number): [number, number] | null {
      const el = canvasRef.current
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      const nx = (clientX - r.left) / r.width
      const ny = (clientY - r.top) / r.height
      return [clamp01(nx), clamp01(ny)]
    }

    const strokeWidthForTool = useCallback(
      (tool: StrokeAnnotationCommand['tool']) =>
        strokeWidthScaleForStrokeTool(tool, {
          strokeWidthScale,
          eraserLineStrokeWidthScale,
          penStrokeWidthScale,
        }),
      [eraserLineStrokeWidthScale, penStrokeWidthScale, strokeWidthScale],
    )
    const isTwoPointTool =
      mode === 'line' || mode === 'rect' || mode === 'ellipse' || mode === 'triangle' || mode === 'arrow'
    const isTapTool =
      mode === 'stamp' ||
      mode === 'callout' ||
      mode === 'text' ||
      mode === 'sticky' ||
      mode === 'eyedropper'
    const isLaser = mode === 'laser'

    function makeStrokeDraft(tool: StrokeTool, p: [number, number]): StrokeAnnotationCommand {
      const base: StrokeAnnotationCommand = {
        kind: 'stroke',
        id: newAnnotationId(),
        tool,
        points: [p],
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
      return base
    }

    function commitDraftStroke(draft: StrokeAnnotationCommand): void {
      if (draft.points.length < 2) return
      const next = [...commandsRef.current, draft]
      setCommands(next)
      persist(next)
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isAnnotationPointerDownAccepted(e)) return
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return
      onPointerSessionStart?.()

      const strokeTool = effectiveStrokeToolForPointer(mode, e)

      if (strokeTool) {
        gestureRef.current = 'stroke'
        redoStackRef.current = []
        draftStrokeRef.current = makeStrokeDraft(strokeTool, p)
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(draftStrokeRef.current, null, [])
        emitCapabilities()
        return
      }

      if (isLaser) {
        gestureRef.current = 'laser'
        laserRef.current = [p]
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(null, null, laserRef.current)
        return
      }

      if (isTwoPointTool) {
        gestureRef.current = 'two'
        redoStackRef.current = []
        twoDraftRef.current = {
          kind: mode,
          anchor: p,
          current: p,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(null, twoDraftRef.current, [])
        emitCapabilities()
        return
      }

      if (isTapTool) {
        gestureRef.current = 'tap'
        tapModeRef.current = mode as TapMode
        tapStartRef.current = p
        tapStartClientRef.current = [e.clientX, e.clientY]
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return

      if (gestureRef.current === 'laser') {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) return
        const arr = laserRef.current
        const last = arr[arr.length - 1]
        if (last) {
          const dx = p[0] - last[0]
          const dy = p[1] - last[1]
          if (dx * dx + dy * dy < 1e-8) return
        }
        arr.push(p)
        paint(null, null, arr)
        return
      }

      if (gestureRef.current !== 'stroke' && gestureRef.current !== 'two') return

      const draft = draftStrokeRef.current
      if (draft) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) return
        const nextTool = effectiveStrokeToolForPointer(mode, e)
        if (nextTool !== draft.tool) {
          commitDraftStroke(draft)
          if (nextTool) {
            draftStrokeRef.current = makeStrokeDraft(nextTool, p)
            paint(draftStrokeRef.current, null, [])
          } else {
            draftStrokeRef.current = null
            gestureRef.current = null
            paint(null, null, [])
          }
          return
        }
        const last = draft.points[draft.points.length - 1]
        const dx = p[0] - last[0]
        const dy = p[1] - last[1]
        if (dx * dx + dy * dy < 1e-8) return
        draft.points.push(p)
        paint(draft, null, [])
        return
      }

      const td = twoDraftRef.current
      if (td) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) return
        td.current = p
        paint(null, td, [])
      }
    }

    function commitTwoPoint(): void {
      const td = twoDraftRef.current
      twoDraftRef.current = null
      if (!td) return
      const dx = td.current[0] - td.anchor[0]
      const dy = td.current[1] - td.anchor[1]
      const dist = Math.hypot(dx, dy)
      const id = newAnnotationId()
      let cmd: AnnotationCommand | null = null
      if (td.kind === 'line' || td.kind === 'arrow') {
        if (dist < TWO_POINT_EPS) return
        if (td.kind === 'line') {
          cmd = {
            kind: 'line',
            id,
            a: td.anchor,
            b: td.current,
            color: shapeColor,
            widthScale: shapeStrokeWidthScale,
            lineDashStyle: shapeLineDashStyle,
          } satisfies LineAnnotationCommand
        } else {
          cmd = {
            kind: 'arrow',
            id,
            from: td.anchor,
            to: td.current,
            color: shapeColor,
            widthScale: shapeStrokeWidthScale,
            lineDashStyle: shapeLineDashStyle,
          } satisfies ArrowAnnotationCommand
        }
      } else {
        const { x, y, w, h } = normalizeRect(td.anchor, td.current)
        if (w < TWO_POINT_EPS || h < TWO_POINT_EPS) return
        let strokeOn = shapeStrokeEnabled
        let fillAlpha = shapeFillAlphaForMode(shapeFillMode)
        let fillOn = fillAlpha != null
        if (!strokeOn && !fillOn) {
          strokeOn = true
        }
        if (td.kind === 'rect') {
          cmd = {
            kind: 'rect',
            id,
            x,
            y,
            w,
            h,
            strokeColor: shapeColor,
            strokeWidthScale: shapeStrokeWidthScale,
            strokeVisible: strokeOn,
            fillVisible: fillOn,
            lineDashStyle: shapeLineDashStyle,
            ...(fillOn && fillAlpha != null ? { fillColor: shapeFillColor, fillAlpha } : {}),
          } satisfies RectAnnotationCommand
        } else if (td.kind === 'ellipse') {
          cmd = {
            kind: 'ellipse',
            id,
            x,
            y,
            w,
            h,
            strokeColor: shapeColor,
            strokeWidthScale: shapeStrokeWidthScale,
            strokeVisible: strokeOn,
            fillVisible: fillOn,
            lineDashStyle: shapeLineDashStyle,
            ...(fillOn && fillAlpha != null ? { fillColor: shapeFillColor, fillAlpha } : {}),
          } satisfies EllipseAnnotationCommand
        } else {
          cmd = {
            kind: 'triangle',
            id,
            x,
            y,
            w,
            h,
            strokeColor: shapeColor,
            strokeWidthScale: shapeStrokeWidthScale,
            strokeVisible: strokeOn,
            fillVisible: fillOn,
            lineDashStyle: shapeLineDashStyle,
            ...(fillOn && fillAlpha != null ? { fillColor: shapeFillColor, fillAlpha } : {}),
          } satisfies TriangleAnnotationCommand
        }
      }
      if (!cmd) return
      const next = [...commandsRef.current, cmd]
      setCommands(next)
      persist(next)
    }

    function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      const gesture = gestureRef.current
      gestureRef.current = null

      if (gesture === 'laser') {
        laserRef.current = []
        paint(null, null, [])
        return
      }

      const draft = draftStrokeRef.current
      draftStrokeRef.current = null
      if (draft && draft.points.length >= 2) {
        const next = [...commandsRef.current, draft]
        setCommands(next)
        persist(next)
      }

      if (gesture === 'two' && twoDraftRef.current) {
        commitTwoPoint()
      } else {
        twoDraftRef.current = null
      }

      const tap0 = tapStartRef.current
      tapStartRef.current = null
      const tapClient0 = tapStartClientRef.current
      tapStartClientRef.current = null
      const tapMode = tapModeRef.current
      tapModeRef.current = null
      if (tap0 && gesture === 'tap' && tapMode) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) {
          paint(null, null, [])
          return
        }
        const dx = p[0] - tap0[0]
        const dy = p[1] - tap0[1]
        if (dx * dx + dy * dy > TAP_MOVE_EPS * TAP_MOVE_EPS) {
          paint(null, null, [])
          return
        }
        redoStackRef.current = []
        const at = tap0
        const id = newAnnotationId()
        if (tapMode === 'stamp') {
          const cmd: AnnotationCommand = {
            kind: 'stamp',
            id,
            variant: stampVariant,
            center: at,
            color: stampColorForVariant(stampVariant, stampQuestionColor),
            scale: stampScale,
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
        } else if (tapMode === 'callout') {
          const cmd: AnnotationCommand = {
            kind: 'callout',
            id,
            index: nextCalloutIndex(commandsRef.current),
            center: at,
            color: shapeColor,
            scale: stampScale,
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
        } else if (tapMode === 'text') {
          const cmd: TextAnnotationCommand = {
            kind: 'text',
            id,
            x: at[0],
            y: at[1],
            text: '',
            fontSizeNorm: textFontSizeNorm,
            color: textColor,
            ...(textVisualStyle === 'filled'
              ? { visualStyle: 'filled' as const, fillColor: textFillColor }
              : {}),
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
          setFocusNewId(id)
        } else if (tapMode === 'eyedropper') {
          const [sampleClientX, sampleClientY] = tapClient0 ?? [e.clientX, e.clientY]
          onEyedropperPick?.(sampleClientX, sampleClientY)
        } else if (tapMode === 'sticky') {
          const w = defaultStickyWNorm
          const h = defaultStickyHNorm
          let sx = at[0] - w / 2
          let sy = at[1] - h / 2
          sx = clamp01(sx)
          sy = clamp01(sy)
          if (sx + w > 1) sx = Math.max(0, 1 - w)
          if (sy + h > 1) sy = Math.max(0, 1 - h)
          const cmd: StickyAnnotationCommand = {
            kind: 'sticky',
            id,
            x: sx,
            y: sy,
            w,
            h,
            text: '',
            fontSizeNorm: stickyFontSizeNorm,
            fillColor: stickyFillColor,
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
          setFocusNewId(id)
        }
        emitCapabilities()
      }

      paint(null, null, [])
    }

    function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      gestureRef.current = null
      draftStrokeRef.current = null
      twoDraftRef.current = null
      tapStartRef.current = null
      tapStartClientRef.current = null
      tapModeRef.current = null
      laserRef.current = []
      paint(null, null, [])
    }

    if (widthPx <= 0 || heightPx <= 0) return null

    const trailingEraser = eraserLineTrailingForReplay(
      draftStrokeRef.current,
      liveEraserLineDraftRef.current,
    )
    const deadIndices = computeEraserLineDeadIndices(commands, trailingEraser)
    void erasePreviewEpoch
    const domCommands = commands.filter((_, i) => !deadIndices.has(i))

    const canvasClass =
      mode === 'laser' || mode === 'text' || mode === 'sticky' || mode === 'eyedropper'
        ? 'absolute inset-0 z-[2] touch-none cursor-crosshair'
        : 'absolute inset-0 z-[2] touch-none'

    return (
      <>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Annotations for page ${pageNumber}`}
          className={canvasClass}
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            cursor: mode === 'eyedropper' ? EYEDROPPER_CURSOR : undefined,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => {
            if ((e.nativeEvent as PointerEvent).pointerType === 'pen') e.preventDefault()
          }}
        />
        <BookPageAnnotationDomLayer
          widthPx={widthPx}
          heightPx={heightPx}
          commands={domCommands}
          onUpdateCommand={patchCommand}
          onDeleteSticky={deleteStickyCommand}
          focusNewId={focusNewId}
          onConsumedFocusNew={() => setFocusNewId(null)}
        />
      </>
    )
  },
)

BookPageAnnotationLayer.displayName = 'BookPageAnnotationLayer'
