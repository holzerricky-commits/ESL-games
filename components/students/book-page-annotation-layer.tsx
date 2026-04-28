'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  drawAnnotationCommand,
  drawEraserLinePreview,
  drawLaserTrail,
  drawStrokePath,
} from '@/lib/books/annotation-draw'
import { computeEraserLineDeadStrokeIndices } from '@/lib/books/annotation-geometry'
import type {
  AnnotationCommand,
  ArrowAnnotationCommand,
  EllipseAnnotationCommand,
  LineAnnotationCommand,
  RectAnnotationCommand,
  StampVariant,
  StrokeAnnotationCommand,
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import type { AnnotationStorageChannel, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'

type TapMode = Extract<
  BookAnnotationInteractionMode,
  'stamp' | 'callout' | 'text' | 'sticky'
>
import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
import { BookPageAnnotationDomLayer } from '@/components/students/book-page-annotation-dom-layer'

const TWO_POINT_EPS = 0.004
const TAP_MOVE_EPS = 0.006

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

type TwoDraftKind = 'line' | 'rect' | 'ellipse' | 'arrow'

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

function drawTwoPointPreview(
  ctx: CanvasRenderingContext2D,
  draft: TwoPointDraft,
  color: string,
  shapeStrokeWidthScale: number,
  widthPx: number,
  heightPx: number,
): void {
  const sx = (nx: number) => nx * widthPx
  const sy = (ny: number) => ny * heightPx
  const { x, y, w, h } = normalizeRect(draft.anchor, draft.current)
  const ax = sx(draft.anchor[0])
  const ay = sy(draft.anchor[1])
  const bx = sx(draft.current[0])
  const by = sy(draft.current[1])
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, 2.25 * (shapeStrokeWidthScale || 1))
  ctx.setLineDash([5, 4])
  ctx.lineCap = 'round'
  if (draft.kind === 'line' || draft.kind === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  } else if (draft.kind === 'rect') {
    ctx.strokeRect(sx(x), sy(y), w * widthPx, h * heightPx)
  } else {
    const cx = sx(x) + (w * widthPx) / 2
    const cy = sy(y) + (h * heightPx) / 2
    const rx = (w * widthPx) / 2
    const ry = (h * heightPx) / 2
    if (rx > 0 && ry > 0) {
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.setLineDash([])
  ctx.restore()
}

export type BookPageAnnotationHandle = {
  undo: () => void
  redo: () => void
  clear: () => void
}

export type AnnotationCapabilities = {
  canUndo: boolean
  canRedo: boolean
}

function replayAll(
  ctx: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
  commands: AnnotationCommand[],
  draftStroke: StrokeAnnotationCommand | null,
  twoDraft: TwoPointDraft | null,
  laserPts: [number, number][],
  shapeColor: string,
  shapeStrokeWidthScale: number,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const dead = computeEraserLineDeadStrokeIndices(commands)
  for (let i = 0; i < commands.length; i++) {
    if (dead.has(i)) continue
    drawAnnotationCommand(ctx, commands[i], widthPx, heightPx)
  }

  if (draftStroke && draftStroke.points.length >= 2) {
    if (draftStroke.tool === 'eraser-line') {
      drawEraserLinePreview(ctx, draftStroke.points, widthPx, heightPx)
    } else {
      drawStrokePath(ctx, draftStroke, widthPx, heightPx)
    }
  }

  if (twoDraft) {
    drawTwoPointPreview(ctx, twoDraft, shapeColor, shapeStrokeWidthScale, widthPx, heightPx)
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
  strokeWidthScale: number
  /** Line width scale for line, rect, ellipse, arrow previews and commits. */
  shapeStrokeWidthScale: number
  /** Stamp / callout size multiplier (same numeric range as stroke width scales). */
  stampScale: number
  /** Pen or marker stroke color (#RRGGBB); omit for erasers. */
  strokeColor?: string
  /** Shapes, text, callout color (#RRGGBB). */
  shapeColor: string
  textFontSizeNorm: number
  stickyFontSizeNorm: number
  defaultStickyWNorm: number
  defaultStickyHNorm: number
  onPointerSessionStart?: () => void
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
      strokeWidthScale,
      shapeStrokeWidthScale,
      stampScale,
      strokeColor,
      shapeColor,
      textFontSizeNorm,
      stickyFontSizeNorm,
      defaultStickyWNorm,
      defaultStickyHNorm,
      onPointerSessionStart,
      onCapabilitiesChange,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [commands, setCommands] = useState<AnnotationCommand[]>([])
    const commandsRef = useRef<AnnotationCommand[]>([])
    const redoStackRef = useRef<AnnotationCommand[]>([])
    const draftStrokeRef = useRef<StrokeAnnotationCommand | null>(null)
    const twoDraftRef = useRef<TwoPointDraft | null>(null)
    const laserRef = useRef<[number, number][]>([])
    const tapStartRef = useRef<[number, number] | null>(null)
    const gestureRef = useRef<'laser' | 'stroke' | 'two' | 'tap' | null>(null)
    const tapModeRef = useRef<TapMode | null>(null)
    const [focusNewId, setFocusNewId] = useState<string | null>(null)

    const onCapabilitiesChangeRef = useRef(onCapabilitiesChange)
    onCapabilitiesChangeRef.current = onCapabilitiesChange

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
          setCommands([])
          persist([])
        },
      }),
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
        replayAll(
          ctx,
          widthPx,
          heightPx,
          commandsRef.current,
          draftStroke,
          twoDraft,
          laserPts,
          shapeColor,
          shapeStrokeWidthScale,
        )
      },
      [widthPx, heightPx, shapeColor, shapeStrokeWidthScale],
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
    }, [widthPx, heightPx, commands, paint, mode, strokeColor, strokeWidthScale])

    function clientToNorm(clientX: number, clientY: number): [number, number] | null {
      const el = canvasRef.current
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      const nx = (clientX - r.left) / r.width
      const ny = (clientY - r.top) / r.height
      return [clamp01(nx), clamp01(ny)]
    }

    const isStrokeTool =
      mode === 'pen' || mode === 'marker' || mode === 'eraser' || mode === 'eraser-line'
    const isTwoPointTool = mode === 'line' || mode === 'rect' || mode === 'ellipse' || mode === 'arrow'
    const isTapTool = mode === 'stamp' || mode === 'callout' || mode === 'text' || mode === 'sticky'
    const isLaser = mode === 'laser'

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (e.button !== 0) return
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return
      onPointerSessionStart?.()

      if (isLaser) {
        gestureRef.current = 'laser'
        laserRef.current = [p]
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(null, null, laserRef.current)
        return
      }

      if (isStrokeTool) {
        gestureRef.current = 'stroke'
        redoStackRef.current = []
        const base: StrokeAnnotationCommand = {
          kind: 'stroke',
          id: newAnnotationId(),
          tool: mode,
          points: [p],
          widthScale: strokeWidthScale,
        }
        if ((mode === 'pen' || mode === 'marker') && strokeColor) {
          base.color = strokeColor
        }
        draftStrokeRef.current = base
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(draftStrokeRef.current, null, [])
        emitCapabilities()
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
          } satisfies LineAnnotationCommand
        } else {
          cmd = {
            kind: 'arrow',
            id,
            from: td.anchor,
            to: td.current,
            color: shapeColor,
            widthScale: shapeStrokeWidthScale,
          } satisfies ArrowAnnotationCommand
        }
      } else {
        const { x, y, w, h } = normalizeRect(td.anchor, td.current)
        if (w < TWO_POINT_EPS || h < TWO_POINT_EPS) return
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
          } satisfies RectAnnotationCommand
        } else {
          cmd = {
            kind: 'ellipse',
            id,
            x,
            y,
            w,
            h,
            strokeColor: shapeColor,
            strokeWidthScale: shapeStrokeWidthScale,
          } satisfies EllipseAnnotationCommand
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
            color: shapeColor,
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
          setFocusNewId(id)
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
      tapModeRef.current = null
      laserRef.current = []
      paint(null, null, [])
    }

    if (widthPx <= 0 || heightPx <= 0) return null

    const canvasClass =
      mode === 'laser' || mode === 'text' || mode === 'sticky'
        ? 'absolute inset-0 z-[2] touch-none cursor-crosshair'
        : 'absolute inset-0 z-[2] touch-none'

    return (
      <>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Annotations for page ${pageNumber}`}
          className={canvasClass}
          style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
        <BookPageAnnotationDomLayer
          widthPx={widthPx}
          heightPx={heightPx}
          commands={commands}
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
