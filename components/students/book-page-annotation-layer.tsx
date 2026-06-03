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
  type CSSProperties,
  type MutableRefObject,
} from 'react'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import {
  clearAnnotationCanvas,
  drawStrokePath,
  applyAnnotationLineDash,
  applyAnnotationCanvasDpr,
  replayInkSlice,
  replayMarkerSlice,
  type DrawStrokePathOptions,
} from '@/lib/books/annotation-draw'
import { penStrokeUsesRichLivePaint } from '@/lib/books/annotation-live-pen-paint'
import {
  buildAnnotationRenderSlices,
  draftOverlayZIndex,
} from '@/lib/books/annotation-render-slices'
import {
  isInkSessionDelegatedCanvasCommand,
  pageLayerCanvasCommandsWhenSpreadInkDelegated,
  pageLayerCanvasCommandsWhenWhiteboardInkDelegated,
} from '@/lib/books/ink-session-page-layer'
import {
  eraserLineTrailingForReplay,
  strokeToolSkipsCommittedReplayOnLivePaint,
  type AnnotationPaintOptions,
} from '@/lib/books/annotation-live-paint'
import { subscribeBrushPatternTileLoads } from '@/lib/books/brush-pattern-loader'
import { attachPenInkPatternPhase, type PenInkPatternOrigin } from '@/lib/books/pen-ink'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import {
  DEFAULT_STAMP_QUESTION_COLOR,
  DEFAULT_TEXT_FILL_COLOR,
  stampColorForVariant,
} from '@/lib/books/annotation-palettes'
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
import type { EyedropperVariant } from '@/lib/books/eyedropper-variant'
import type { AnnotationStorageChannel, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import { mergeWhiteboardLegacyWithSession } from '@/lib/books/whiteboard-session-persist'
import type { WhiteboardSessionStore } from '@/lib/books/whiteboard-session-store'

type TapMode = Extract<
  BookAnnotationInteractionMode,
  'stamp' | 'callout' | 'text' | 'sticky' | 'eyedropper'
>
import {
  getAnnotationsForPage,
  getAnnotationsForStorageKey,
  setAnnotationsForPage,
  setAnnotationsForStorageKey,
} from '@/lib/books/annotation-storage'
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
import { resolveAnnotationToolCursor } from '@/lib/books/annotation-tool-cursor'
import {
  annotationIdsInMarquee,
  hitTestAnnotationIndex,
  hitTestSelectedAnnotationIndex,
  normalizeMarqueeRect,
  resolveMarqueeSelectMode,
  selectionOutlineRects,
  translateAnnotationCommands,
  type GroupSelectionChrome,
  type MarqueeSelectMode,
  type MarqueeSelectRule,
  type NormRect,
} from '@/lib/books/annotation-select'
import { resolvePenMarkerSelectionIds } from '@/lib/books/annotation-connected-strokes'
import { autoGroupPenStrokeAfterCommit } from '@/lib/books/annotation-pen-auto-group'
import {
  applySelectionChange,
  selectNextStackId,
  selectionChangeModeFromPointerKeys,
  type SelectionChangeMode,
} from '@/lib/books/annotation-selection-ops'
import {
  assignFigureGroupId,
  clearFigureGroupId,
  idsInFigureGroup,
  newFigureGroupId,
  shouldToggleSelectionToUngroup,
} from '@/lib/books/annotation-figure-group'
import {
  duplicateCommandsForPaste,
  getAnnotationClipboard,
  hasAnnotationClipboard,
  setAnnotationClipboard,
} from '@/lib/books/annotation-clipboard'
import {
  SELECTION_MARQUEE_CROSSING_CLASS,
  SELECTION_MARQUEE_WINDOW_CLASS,
} from '@/lib/books/annotation-selection-chrome'
import {
  cursorForScaleHandle,
  hitTestScaleHandle,
  resizeBoundsFromHandle,
  scaleAnnotationCommands,
  unionSelectionBounds,
  type ScaleHandleId,
} from '@/lib/books/annotation-scale'
import { SelectionBoundsChrome } from '@/components/students/selection-bounds-chrome'
import { isBookOverlayShapeMode } from '@/lib/books/book-overlay-keyboard-shortcuts'
import {
  commitBookOverlayTypingTarget,
  isAnnotationTextFieldFocused,
} from '@/lib/books/book-overlay-keyboard-guards'
import type { PenStrokeProfile } from '@/lib/books/pen-stroke-profile'
import { BookPageAnnotationDomLayer } from '@/components/students/book-page-annotation-dom-layer'
import { useLessonCoachSyncActions } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { cn } from '@/lib/utils'

/** Above ReaderPageSlot pdf (`z-[1]`) so slices composite as siblings of the page bitmap. */
const ANNOTATION_STACK_BASE_Z = 2

function sliceStackZ(commandIndex: number): number {
  return ANNOTATION_STACK_BASE_Z + commandIndex
}

/** Must be on marker canvas elements (not a parent) so multiply reaches the PDF/image below. */
const MARKER_CANVAS_BLEND: CSSProperties = { mixBlendMode: 'multiply' }

function pageLayerBox(widthPx: number, heightPx: number, zIndex: number): React.CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    zIndex,
  }
}

const TWO_POINT_EPS = 0.004
const TAP_MOVE_EPS = 0.006
/** Marquee smaller than this (normalized area) counts as a click on empty space. */
const MARQUEE_MIN_AREA = 0.00004
function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Stable key for live eraser preview dead-index sets (avoids erasePreviewEpoch loops). */
function eraserDeadIndicesKey(dead: ReadonlySet<number>): string | null {
  if (dead.size === 0) return null
  return [...dead].sort((a, b) => a - b).join(',')
}

function cloneCommandStack(stack: AnnotationCommand[]): AnnotationCommand[] {
  return stack.map((c) =>
    typeof structuredClone === 'function'
      ? structuredClone(c)
      : (JSON.parse(JSON.stringify(c)) as AnnotationCommand),
  )
}

function nextCalloutIndex(commands: AnnotationCommand[]): number {
  let m = 0
  for (const c of commands) {
    if (c.kind === 'callout') m = Math.max(m, c.index)
  }
  return m + 1
}

export type TwoDraftKind = 'line' | 'rect' | 'ellipse' | 'triangle' | 'arrow'

export interface TwoPointDraft {
  kind: TwoDraftKind
  anchor: [number, number]
  current: [number, number]
}

/** Spread-mode two-point shape preview pushed from `BookSpreadStrokeOverlay`. */
export type LiveTwoPointDraft = TwoPointDraft

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
  | 'penStrokeProfile'
  | 'penInkPatternPhaseX'
  | 'penInkPatternPhaseY'
  | 'markerDecoratedEdge'
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
  /** Spread-mode line/rect/ellipse/triangle/arrow live preview (null clears). */
  setLiveTwoPointDraft: (draft: LiveTwoPointDraft | null) => void
  /** Select tool (page layer only). */
  getSelectedIds?: () => string[]
  setSelectedIds?: (ids: string[]) => void
  selectAll?: () => void
  deleteSelected?: () => boolean
  copySelected?: () => boolean
  pasteFromClipboard?: () => boolean
  groupSelected?: () => boolean
  ungroupSelected?: () => boolean
  /** Group selection, or ungroup if every selected pen/marker is already grouped. */
  toggleGroupSelected?: () => boolean
  /** Clear `figureGroupId` on selected pen/marker only (partial remove from group). */
  removeFromGroupSelected?: () => boolean
  deselectAll?: () => void
  duplicateSelected?: () => boolean
  /** Tab = next in stack, Shift+Tab = previous. */
  selectNextInStack?: (direction: 1 | -1) => void
  /** Translate specific commands (used to mirror cross-page moves in spread select mode). */
  translateByIds?: (ids: string[], dx: number, dy: number) => boolean
}

export type AnnotationCapabilities = {
  canUndo: boolean
  canRedo: boolean
}

type IncrementalDraftSource = 'local' | 'spread'

type IncrementalDraftState = {
  source: IncrementalDraftSource
  tool: 'pen' | 'marker'
  pointsLength: number
}

function activeLiveStrokeDraftForPaint(
  draftStroke: StrokeAnnotationCommand | null,
  liveSpread: LiveStrokeDraft | null,
): { source: IncrementalDraftSource; draft: StrokeAnnotationCommand | LiveStrokeDraft } | null {
  if (draftStroke && draftStroke.points.length >= 1 && draftStroke.tool !== 'eraser-line') {
    return { source: 'local', draft: draftStroke }
  }
  if (liveSpread && liveSpread.points.length >= 1) {
    return { source: 'spread', draft: liveSpread }
  }
  return null
}

function canIncrementallyAppendDraftSegment(
  prev: IncrementalDraftState | null,
  active: { source: IncrementalDraftSource; draft: StrokeAnnotationCommand | LiveStrokeDraft },
  twoDraft: TwoPointDraft | null,
): boolean {
  if (twoDraft) return false
  // Full redraw keeps pen quadratic joins and marker multiply blend consistent.
  return false
}

function incrementalDraftSegmentPoints(
  points: readonly [number, number][],
  previousLength: number,
): [number, number][] {
  const start = Math.max(0, previousLength - 2)
  return points.slice(start) as [number, number][]
}


function liveStrokeDrawOptions(
  draft: Pick<StrokeAnnotationCommand, 'tool' | 'penInkStyle' | 'penStrokeProfile'>,
  base: DrawStrokePathOptions,
): DrawStrokePathOptions {
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

function sizeAnnotationPageCanvas(el: HTMLCanvasElement, widthPx: number, heightPx: number): void {
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

export interface BookPageAnnotationLayerProps {
  studentId: string
  bookId: string
  unitId: string
  pageNumber: number
  /** Separate localStorage slot from PDF ink (`wb:{page}` vs page number string). */
  storageChannel?: AnnotationStorageChannel
  /** When set (whiteboard session board), overrides page-based storage key. */
  storagePageKey?: string
  widthPx: number
  heightPx: number
  mode: BookAnnotationInteractionMode
  eyedropperVariant?: EyedropperVariant
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
  /** Pen ink color when auto-inking from eraser (toolbar strokeColor may be unset). */
  penInkColor?: string
  /** Effect ink for pen strokes; omit for marker/eraser. */
  penInkStyle?: import('@/lib/books/pen-ink').PenInkStyle
  /** Pen / brush / pencil / fine-liner / effects profile. */
  penStrokeProfile?: import('@/lib/books/pen-stroke-profile').PenStrokeProfile
  /** Spread-space X offset so effect ink matches live spread overlay after commit. */
  penInkPatternOriginXPx?: number
  penInkPatternOriginYPx?: number
  /** Dash style for pen/marker ink on this layer. */
  strokeLineDashStyle?: AnnotationLineDashStyle
  /** When true, highlighter strokes snap horizontal or vertical (Shift does the same for pen/marker). */
  markerStraightStroke?: boolean
  /** When true, themed ornaments draw on the upper edge of highlighter strokes. */
  markerDecoratedEdge?: boolean
  /** When true, each committed pen stroke auto-joins a figureGroupId with touching pen strokes. */
  penAutoGroupConnected?: boolean
  /** How select marquee resolves window vs crossing (follow-drag default). */
  marqueeSelectRule?: MarqueeSelectRule
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
  /** Spread overlay owns pointer input for drawing tools (avoids overlap hit-test fights). */
  delegatePointerToSpread?: boolean
  /** Whiteboard stroke overlay owns pen/marker pointer when session ink is enabled. */
  delegatePointerToWhiteboardPen?: boolean
  /** When true, pen/marker/shape canvas ink is shown on the spread session layer only. */
  spreadInkDelegated?: boolean
  /** When true, pen/marker canvas ink is shown on the whiteboard session layer only. */
  whiteboardPenInkDelegated?: boolean
  /** Alias for whiteboardPenInkDelegated (Phase 3+). */
  whiteboardInkDelegated?: boolean
  /** When session ink is delegated, merges pen/marker into legacy storage on each save. */
  whiteboardSessionStoreRef?: MutableRefObject<WhiteboardSessionStore | null>
  /** Called after select-move commit on this page (spread uses it to mirror same-id move on sibling page). */
  onSelectionMoveCommitted?: (ids: string[], dx: number, dy: number) => void
}

export const BookPageAnnotationLayer = forwardRef<BookPageAnnotationHandle, BookPageAnnotationLayerProps>(
  function BookPageAnnotationLayer(
    {
      studentId,
      bookId,
      unitId,
      pageNumber,
      storageChannel = 'pdf',
      storagePageKey,
      widthPx,
      heightPx,
      mode,
      eyedropperVariant = 'sample',
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
      penStrokeProfile,
      penInkPatternOriginXPx = 0,
      penInkPatternOriginYPx = 0,
      strokeLineDashStyle = 'solid',
      markerStraightStroke = false,
      markerDecoratedEdge = false,
      penAutoGroupConnected = true,
      marqueeSelectRule = 'follow-drag',
      shapeColor,
      textColor,
      shapeLineDashStyle = 'solid',
      shapeStrokeEnabled = true,
      shapeFillMode = 'none',
      shapeFillColor = '#eab308',
      textFontSizeNorm,
      stickyFontSizeNorm,
      textVisualStyle = 'plain',
      textFillColor = DEFAULT_TEXT_FILL_COLOR,
      stickyFillColor = '#fef3c7',
      defaultStickyWNorm,
      defaultStickyHNorm,
      onPointerSessionStart,
      onEyedropperPick,
      onCapabilitiesChange,
      delegatePointerToSpread = false,
      delegatePointerToWhiteboardPen = false,
      spreadInkDelegated = false,
      whiteboardPenInkDelegated = false,
      whiteboardInkDelegated = false,
      whiteboardSessionStoreRef,
      onSelectionMoveCommitted,
    },
    ref,
  ) {
    const { setAnnotationGestureActive } = useLessonCoachSyncActions()
    const overlayRef = useRef<HTMLDivElement | null>(null)
    const inkSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
    const markerSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
    const draftInkCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const draftMarkerCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const [commands, setCommands] = useState<AnnotationCommand[]>([])
    const commandsRef = useRef<AnnotationCommand[]>([])
    const redoStackRef = useRef<AnnotationCommand[]>([])
    const snapshotUndoRef = useRef<AnnotationCommand[][]>([])
    const snapshotRedoRef = useRef<AnnotationCommand[][]>([])
    const draftStrokeRef = useRef<StrokeAnnotationCommand | null>(null)
    const liveEraserLineDraftRef = useRef<LiveEraserLineDraft | null>(null)
    const liveSpreadStrokeDraftRef = useRef<LiveStrokeDraft | null>(null)
    const twoDraftRef = useRef<TwoPointDraft | null>(null)
    const tapStartRef = useRef<[number, number] | null>(null)
    const tapStartClientRef = useRef<[number, number] | null>(null)
    const gestureRef = useRef<'stroke' | 'two' | 'tap' | null>(null)
    const straightStrokeAxisRef = useRef<StraightStrokeAxis | null>(null)
    const tapModeRef = useRef<TapMode | null>(null)
    const [focusNewId, setFocusNewId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [groupSelectionChrome, setGroupSelectionChrome] =
      useState<GroupSelectionChrome>('union')
    const groupSelectionChromeRef = useRef<GroupSelectionChrome>('union')
    groupSelectionChromeRef.current = groupSelectionChrome
    const [editingId, setEditingId] = useState<string | null>(null)
    const [marqueeRect, setMarqueeRect] = useState<NormRect | null>(null)
    const [marqueeMode, setMarqueeMode] = useState<MarqueeSelectMode | null>(null)
    const [selectDragLive, setSelectDragLive] = useState<{ dx: number; dy: number } | null>(null)
    const [selectScaleLiveBounds, setSelectScaleLiveBounds] = useState<NormRect | null>(null)
    const [pointerOverSelection, setPointerOverSelection] = useState(false)
    const [hoveredScaleHandle, setHoveredScaleHandle] = useState<ScaleHandleId | null>(null)
    const selectedIdsRef = useRef<string[]>([])
    const selectGestureRef = useRef<'marquee' | 'move' | 'scale' | null>(null)
    const marqueeSelModeRef = useRef<SelectionChangeMode>('replace')
    const selectAnchorRef = useRef<[number, number] | null>(null)
    const selectDragLiveRef = useRef<{ dx: number; dy: number } | null>(null)
    /** Ids translated during an active select drag (whole selection or one limb in group-edit). */
    const selectMoveIdsRef = useRef<string[]>([])
    const selectScaleIdsRef = useRef<string[]>([])
    const selectScaleStartBoundsRef = useRef<NormRect | null>(null)
    const selectScaleHandleRef = useRef<ScaleHandleId | null>(null)
    const selectScaleLiveBoundsRef = useRef<NormRect | null>(null)
    selectScaleLiveBoundsRef.current = selectScaleLiveBounds
    selectedIdsRef.current = selectedIds
    selectDragLiveRef.current = selectDragLive
    /** Bumped when live eraser preview dead indices change so DOM text/stickies hide in sync with canvas. */
    const [erasePreviewEpoch, setErasePreviewEpoch] = useState(0)
    const erasePreviewDeadKeyRef = useRef<string | null>(null)
    const incrementalDraftStateRef = useRef<IncrementalDraftState | null>(null)
    const zoomRepaintRevision = useBrowserZoomRepaintRevision()

    const onCapabilitiesChangeRef = useRef(onCapabilitiesChange)
    onCapabilitiesChangeRef.current = onCapabilitiesChange

    const penInkPatternOrigin = useMemo<PenInkPatternOrigin>(
      () => ({ x: penInkPatternOriginXPx, y: penInkPatternOriginYPx }),
      [penInkPatternOriginXPx, penInkPatternOriginYPx],
    )

    const strokeDrawOptions = useMemo(
      () => ({ pagePatternOrigin: penInkPatternOrigin }),
      [penInkPatternOrigin],
    )

    commandsRef.current = commands

    const canvasPaintCommands = useMemo(() => {
      if (spreadInkDelegated) {
        return pageLayerCanvasCommandsWhenSpreadInkDelegated(commands, true)
      }
      if (whiteboardInkDelegated || whiteboardPenInkDelegated) {
        return pageLayerCanvasCommandsWhenWhiteboardInkDelegated(commands, true)
      }
      return [...commands]
    }, [commands, spreadInkDelegated, whiteboardInkDelegated, whiteboardPenInkDelegated])

    /** Phase 5: canvas ink commits only on session layer when delegated (no full page replay). */
    const sessionOwnsCanvasInk =
      spreadInkDelegated || whiteboardInkDelegated || whiteboardPenInkDelegated

    const pushUndoSnapshot = useCallback(() => {
      snapshotUndoRef.current.push(cloneCommandStack(commandsRef.current))
      snapshotRedoRef.current = []
      redoStackRef.current = []
    }, [])

    const emitCapabilities = useCallback(() => {
      onCapabilitiesChangeRef.current?.({
        canUndo: snapshotUndoRef.current.length > 0 || commandsRef.current.length > 0,
        canRedo: snapshotRedoRef.current.length > 0 || redoStackRef.current.length > 0,
      })
    }, [])

    const resolvedStoragePageKey = storagePageKey?.trim() || undefined

    useEffect(() => {
      const raw = resolvedStoragePageKey
        ? getAnnotationsForStorageKey(studentId, bookId, unitId, resolvedStoragePageKey)
        : getAnnotationsForPage(studentId, bookId, unitId, pageNumber, storageChannel)
      const loaded = raw.filter((c) => c.kind !== 'text' || c.text.trim().length > 0)
      if (loaded.length !== raw.length) {
        if (resolvedStoragePageKey) {
          setAnnotationsForStorageKey(studentId, bookId, unitId, resolvedStoragePageKey, loaded)
        } else {
          setAnnotationsForPage(studentId, bookId, unitId, pageNumber, loaded, storageChannel)
        }
      }
      setCommands(loaded)
      redoStackRef.current = []
      snapshotUndoRef.current = []
      snapshotRedoRef.current = []
      commandsRef.current = loaded
      liveEraserLineDraftRef.current = null
      liveSpreadStrokeDraftRef.current = null
      erasePreviewDeadKeyRef.current = null
      setFocusNewId(null)
      queueMicrotask(emitCapabilities)
    }, [studentId, bookId, unitId, pageNumber, storageChannel, resolvedStoragePageKey, emitCapabilities])

    const persist = useCallback(
      (next: AnnotationCommand[]) => {
        commandsRef.current = next
        let toSave = next
        if (
          whiteboardInkDelegated &&
          whiteboardSessionStoreRef?.current &&
          resolvedStoragePageKey
        ) {
          toSave = mergeWhiteboardLegacyWithSession(
            next,
            whiteboardSessionStoreRef.current.getState().doc.commands,
          )
        }
        if (resolvedStoragePageKey) {
          setAnnotationsForStorageKey(studentId, bookId, unitId, resolvedStoragePageKey, toSave)
        } else {
          setAnnotationsForPage(studentId, bookId, unitId, pageNumber, toSave, storageChannel)
        }
        emitCapabilities()
      },
      [
        studentId,
        bookId,
        unitId,
        pageNumber,
        storageChannel,
        resolvedStoragePageKey,
        emitCapabilities,
        whiteboardInkDelegated,
        whiteboardSessionStoreRef,
      ],
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

    const deleteTextCommand = useCallback(
      (id: string) => {
        const next = commandsRef.current.filter((c) => c.id !== id)
        redoStackRef.current = []
        setCommands(next)
        persist(next)
        setFocusNewId((prev) => (prev === id ? null : prev))
        setSelectedIds((prev) => prev.filter((x) => x !== id))
        setEditingId((prev) => (prev === id ? null : prev))
      },
      [persist],
    )

    const paint = useCallback(
      (
        draftStroke: StrokeAnnotationCommand | null,
        twoDraft: TwoPointDraft | null,
        options?: AnnotationPaintOptions,
      ) => {
        if (widthPx <= 0 || heightPx <= 0) return
        const trailing = eraserLineTrailingForReplay(draftStroke, liveEraserLineDraftRef.current)
        const stack = selectDragLiveRef.current
        const replayCommitted = !options?.skipCommittedReplay

        if (replayCommitted) {
          const painted = stack
            ? translateAnnotationCommands(
                canvasPaintCommands,
                new Set(selectMoveIdsRef.current),
                stack.dx,
                stack.dy,
              )
            : canvasPaintCommands
          const dead = computeEraserLineDeadIndices(painted, trailing)
          const slices = buildAnnotationRenderSlices(painted, dead)

          let inkIdx = 0
          let markerIdx = 0
          for (const slice of slices) {
            if (slice.kind === 'ink') {
              const el = inkSliceRefs.current[inkIdx++]
              const inkCtx = el?.getContext('2d', { alpha: true })
              if (!inkCtx) continue
              replayInkSlice(inkCtx, painted, slice.indices, widthPx, heightPx, penInkPatternOrigin)
            } else if (slice.kind === 'marker') {
              const el = markerSliceRefs.current[markerIdx++]
              const markerCtx = el?.getContext('2d', { alpha: true })
              if (!markerCtx) continue
              replayMarkerSlice(markerCtx, painted, slice.indices, widthPx, heightPx, strokeDrawOptions)
            }
          }

          const deadKey = trailing ? eraserDeadIndicesKey(dead) : null
          if (erasePreviewDeadKeyRef.current !== deadKey) {
            erasePreviewDeadKeyRef.current = deadKey
            setErasePreviewEpoch((n) => n + 1)
          }
        }

        const draftInkEl = draftInkCanvasRef.current
        const draftMarkerEl = draftMarkerCanvasRef.current
        if (draftInkEl && draftMarkerEl) {
          const draftInkCtx = draftInkEl.getContext('2d', { alpha: true })
          const draftMarkerCtx = draftMarkerEl.getContext('2d', { alpha: true })
          if (draftInkCtx && draftMarkerCtx) {
            const liveSpread = liveSpreadStrokeDraftRef.current
            const active = activeLiveStrokeDraftForPaint(draftStroke, liveSpread)
            const prevIncremental = incrementalDraftStateRef.current
            const canIncremental = active
              ? canIncrementallyAppendDraftSegment(prevIncremental, active, twoDraft)
              : false

            if (canIncremental && active && prevIncremental) {
              const ctx = active.draft.tool === 'marker' ? draftMarkerCtx : draftInkCtx
              applyAnnotationCanvasDpr(ctx)
              const segPoints = incrementalDraftSegmentPoints(active.draft.points, prevIncremental.pointsLength)
              drawStrokePath(
                ctx,
                { ...active.draft, points: segPoints },
                widthPx,
                heightPx,
                liveStrokeDrawOptions(active.draft, strokeDrawOptions),
              )
            } else {
              clearAnnotationCanvas(draftInkCtx)
              clearAnnotationCanvas(draftMarkerCtx)
              applyAnnotationCanvasDpr(draftInkCtx)
              applyAnnotationCanvasDpr(draftMarkerCtx)
              if (active) {
                const ctx = active.draft.tool === 'marker' ? draftMarkerCtx : draftInkCtx
                drawStrokePath(
                  ctx,
                  active.draft,
                  widthPx,
                  heightPx,
                  liveStrokeDrawOptions(active.draft, strokeDrawOptions),
                )
              }
              if (twoDraft) {
                drawTwoPointPreview(draftInkCtx, twoDraft, widthPx, heightPx, {
                  shapeColor,
                  shapeStrokeWidthScale,
                  shapeLineDashStyle,
                  shapeStrokeEnabled,
                  shapeFillMode,
                  shapeFillColor,
                })
              }
            }

            if (active && (active.draft.tool === 'pen' || active.draft.tool === 'marker') && !twoDraft) {
              incrementalDraftStateRef.current = {
                source: active.source,
                tool: active.draft.tool,
                pointsLength: active.draft.points.length,
              }
            } else {
              incrementalDraftStateRef.current = null
            }
          }
        }
      },
      [
        canvasPaintCommands,
        widthPx,
        heightPx,
        penInkPatternOrigin,
        shapeColor,
        shapeStrokeWidthScale,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
        strokeDrawOptions,
      ],
    )

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          const snapshot = snapshotUndoRef.current
          if (snapshot.length > 0) {
            const prev = snapshot.pop()!
            snapshotRedoRef.current.push(cloneCommandStack(commandsRef.current))
            setCommands(prev)
            persist(prev)
            return
          }
          const stack = commandsRef.current
          if (stack.length === 0) return
          const popped = stack[stack.length - 1]
          const next = stack.slice(0, -1)
          redoStackRef.current.push(popped)
          setCommands(next)
          persist(next)
        },
        redo: () => {
          const snapRedo = snapshotRedoRef.current
          if (snapRedo.length > 0) {
            const next = snapRedo.pop()!
            snapshotUndoRef.current.push(cloneCommandStack(commandsRef.current))
            setCommands(next)
            persist(next)
            return
          }
          const tail = redoStackRef.current.pop()
          if (!tail) return
          const next = [...commandsRef.current, tail]
          setCommands(next)
          persist(next)
        },
        clear: () => {
          snapshotUndoRef.current = []
          snapshotRedoRef.current = []
          redoStackRef.current = []
          liveEraserLineDraftRef.current = null
          liveSpreadStrokeDraftRef.current = null
          setCommands([])
          persist([])
        },
        appendCommand: (cmd: AnnotationCommand) => {
          if (sessionOwnsCanvasInk && isInkSessionDelegatedCanvasCommand(cmd)) return
          redoStackRef.current = []
          let next = [...commandsRef.current, cmd]
          if (penAutoGroupConnected && cmd.kind === 'stroke' && cmd.tool === 'pen') {
            const trailing = eraserLineTrailingForReplay(
              draftStrokeRef.current,
              liveEraserLineDraftRef.current,
            )
            const dead = computeEraserLineDeadIndices(next, trailing)
            next = autoGroupPenStrokeAfterCommit(next, cmd.id, widthPx, heightPx, dead)
          }
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
          paint(draftStrokeRef.current, twoDraftRef.current)
        },
        setLiveStrokeDraft: (draft: LiveStrokeDraft | null) => {
          liveSpreadStrokeDraftRef.current = draft
          paint(draftStrokeRef.current, twoDraftRef.current, { skipCommittedReplay: true })
        },
        setLiveTwoPointDraft: (draft: LiveTwoPointDraft | null) => {
          twoDraftRef.current = draft
          paint(draftStrokeRef.current, twoDraftRef.current)
        },
        getSelectedIds: () => [...selectedIdsRef.current],
        setSelectedIds: (ids: string[]) => {
          const liveIds = new Set(commandsRef.current.map((c) => c.id))
          const unique = [...new Set(ids)].filter((id) => liveIds.has(id))
          setSelectedIds(unique)
          setEditingId(null)
        },
        translateByIds: (ids: string[], dx: number, dy: number) => {
          if (dx === 0 && dy === 0) return false
          const targetIds = new Set(ids)
          if (targetIds.size === 0) return false
          const next = translateAnnotationCommands(commandsRef.current, targetIds, dx, dy)
          if (next === commandsRef.current) return false
          setCommands(next)
          persist(next)
          return true
        },
        selectAll: () => {
          const trailing = eraserLineTrailingForReplay(
            draftStrokeRef.current,
            liveEraserLineDraftRef.current,
          )
          const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
          const ids = commandsRef.current
            .filter((_, i) => !dead.has(i))
            .map((c) => c.id)
          setSelectedIds(ids)
          setEditingId(null)
        },
        deleteSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          pushUndoSnapshot()
          const next = commandsRef.current.filter((c) => !ids.has(c.id))
          setCommands(next)
          persist(next)
          setSelectedIds([])
          setEditingId(null)
          return true
        },
        copySelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          const picked = commandsRef.current.filter((c) => ids.has(c.id))
          setAnnotationClipboard(picked)
          return true
        },
        pasteFromClipboard: () => {
          if (!hasAnnotationClipboard()) return false
          pushUndoSnapshot()
          const dupes = duplicateCommandsForPaste(getAnnotationClipboard())
          const next = [...commandsRef.current, ...dupes]
          setCommands(next)
          persist(next)
          setSelectedIds(dupes.map((c) => c.id))
          setEditingId(null)
          return true
        },
        groupSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          const groupId = newFigureGroupId()
          const { commands: next, affectedIds } = assignFigureGroupId(
            commandsRef.current,
            ids,
            groupId,
          )
          if (affectedIds.length === 0) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          setSelectedIds(affectedIds)
          setEditingId(null)
          return true
        },
        ungroupSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          const { commands: next, affectedIds } = clearFigureGroupId(commandsRef.current, ids)
          if (affectedIds.length === 0) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          setSelectedIds(affectedIds)
          setEditingId(null)
          return true
        },
        removeFromGroupSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          const { commands: next, affectedIds } = clearFigureGroupId(commandsRef.current, ids)
          if (affectedIds.length === 0) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          setSelectedIds(affectedIds)
          setEditingId(null)
          return true
        },
        toggleGroupSelected: () => {
          const ids = selectedIdsRef.current
          if (ids.length === 0) return false
          if (shouldToggleSelectionToUngroup(commandsRef.current, ids)) {
            const idSet = new Set(ids)
            const { commands: next, affectedIds } = clearFigureGroupId(commandsRef.current, idSet)
            if (affectedIds.length === 0) return false
            pushUndoSnapshot()
            setCommands(next)
            persist(next)
            setSelectedIds(affectedIds)
            setEditingId(null)
            return true
          }
          const groupId = newFigureGroupId()
          const { commands: next, affectedIds } = assignFigureGroupId(
            commandsRef.current,
            new Set(ids),
            groupId,
          )
          if (affectedIds.length === 0) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          setSelectedIds(affectedIds)
          setEditingId(null)
          return true
        },
        deselectAll: () => {
          clearSelectionState()
        },
        duplicateSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          pushUndoSnapshot()
          const picked = commandsRef.current.filter((c) => ids.has(c.id))
          const dupes = duplicateCommandsForPaste(picked)
          const next = [...commandsRef.current, ...dupes]
          setCommands(next)
          persist(next)
          setSelectedIds(dupes.map((c) => c.id))
          setEditingId(null)
          return true
        },
        selectNextInStack: (direction: 1 | -1) => {
          const dead = computeEraserLineDeadIndices(
            commandsRef.current,
            eraserLineTrailingForReplay(draftStrokeRef.current, liveEraserLineDraftRef.current),
          )
          const nextId = selectNextStackId(commandsRef.current, selectedIdsRef.current, direction, dead)
          if (!nextId) return
          setSelectedIds([nextId])
          setEditingId(null)
        },
      }),
      [persist, paint, pushUndoSnapshot],
    )

    useLayoutEffect(() => {
      if (widthPx <= 0 || heightPx <= 0) return
      const trailing = eraserLineTrailingForReplay(
        draftStrokeRef.current,
        liveEraserLineDraftRef.current,
      )
      const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
      const slices = buildAnnotationRenderSlices(commandsRef.current, dead)
      const inkCount = slices.filter((s) => s.kind === 'ink').length
      const markerCount = slices.filter((s) => s.kind === 'marker').length
      while (inkSliceRefs.current.length < inkCount) inkSliceRefs.current.push(null)
      while (markerSliceRefs.current.length < markerCount) markerSliceRefs.current.push(null)
      inkSliceRefs.current.length = inkCount
      markerSliceRefs.current.length = markerCount
      for (const el of inkSliceRefs.current) {
        if (el) sizeAnnotationPageCanvas(el, widthPx, heightPx)
      }
      for (const el of markerSliceRefs.current) {
        if (el) sizeAnnotationPageCanvas(el, widthPx, heightPx)
      }
      const draftInk = draftInkCanvasRef.current
      const draftMarker = draftMarkerCanvasRef.current
      if (draftInk) sizeAnnotationPageCanvas(draftInk, widthPx, heightPx)
      if (draftMarker) sizeAnnotationPageCanvas(draftMarker, widthPx, heightPx)
      paint(draftStrokeRef.current, twoDraftRef.current)
    }, [
      widthPx,
      heightPx,
      commands,
      paint,
      mode,
      strokeColor,
      strokeWidthScale,
      strokeLineDashStyle,
      penInkPatternOrigin,
      strokeDrawOptions,
      selectedIds,
      selectDragLive,
      selectScaleLiveBounds,
      zoomRepaintRevision,
    ])

    const moveSelectedBy = useCallback(
      (dx: number, dy: number) => {
        if (dx === 0 && dy === 0) return
        pushUndoSnapshot()
        const ids = new Set(selectMoveIdsRef.current)
        const next = translateAnnotationCommands(commandsRef.current, ids, dx, dy)
        setCommands(next)
        persist(next)
        onSelectionMoveCommitted?.([...ids], dx, dy)
      },
      [onSelectionMoveCommitted, persist, pushUndoSnapshot],
    )

    const scaleSelectedBy = useCallback(
      (startBounds: NormRect, newBounds: NormRect) => {
        pushUndoSnapshot()
        const ids = new Set(selectScaleIdsRef.current)
        const next = scaleAnnotationCommands(commandsRef.current, ids, startBounds, newBounds)
        setCommands(next)
        persist(next)
      },
      [persist, pushUndoSnapshot],
    )

    function clearSelectScaleLive(): void {
      selectScaleStartBoundsRef.current = null
      selectScaleHandleRef.current = null
      selectScaleLiveBoundsRef.current = null
      setSelectScaleLiveBounds(null)
    }

    function resolveClickTargetIds(cmd: AnnotationCommand, dead: Set<number>): string[] {
      if (cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')) {
        return resolvePenMarkerSelectionIds(
          commandsRef.current,
          cmd.id,
          widthPx,
          heightPx,
          dead,
        )
      }
      return [cmd.id]
    }

    function applyPenAutoGroupAfterAppend(
      commands: AnnotationCommand[],
      strokeId: string,
    ): AnnotationCommand[] {
      if (!penAutoGroupConnected) return commands
      const trailing = eraserLineTrailingForReplay(
        draftStrokeRef.current,
        liveEraserLineDraftRef.current,
      )
      const dead = computeEraserLineDeadIndices(commands, trailing)
      return autoGroupPenStrokeAfterCommit(commands, strokeId, widthPx, heightPx, dead)
    }

    function selectMoveIdsForDrag(hitCmd: AnnotationCommand): string[] {
      if (
        groupSelectionChromeRef.current === 'perStroke' &&
        hitCmd.kind === 'stroke' &&
        (hitCmd.tool === 'pen' || hitCmd.tool === 'marker') &&
        selectedIdsRef.current.includes(hitCmd.id)
      ) {
        return [hitCmd.id]
      }
      return [...selectedIdsRef.current]
    }

    function beginSelectMove(
      e: React.PointerEvent<HTMLDivElement>,
      p: [number, number],
      moveIds?: string[],
    ): void {
      clearSelectScaleLive()
      selectMoveIdsRef.current = moveIds ?? [...selectedIdsRef.current]
      selectGestureRef.current = 'move'
      selectAnchorRef.current = p
      selectDragLiveRef.current = { dx: 0, dy: 0 }
      setSelectDragLive({ dx: 0, dy: 0 })
      setMarqueeRect(null)
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    function beginSelectScale(
      e: React.PointerEvent<HTMLDivElement>,
      handle: ScaleHandleId,
      startBounds: NormRect,
    ): void {
      setSelectDragLive(null)
      selectDragLiveRef.current = null
      setMarqueeRect(null)
      setMarqueeMode(null)
      selectScaleIdsRef.current = [...selectedIdsRef.current]
      selectScaleStartBoundsRef.current = startBounds
      selectScaleHandleRef.current = handle
      selectScaleLiveBoundsRef.current = startBounds
      setSelectScaleLiveBounds(startBounds)
      selectGestureRef.current = 'scale'
      selectAnchorRef.current = null
      e.currentTarget.setPointerCapture(e.pointerId)
      paint(null, null)
    }

    function enterGroupStrokeEditMode(
      targetIds: string[],
      hitCmd: AnnotationCommand,
    ): void {
      setEditingId(null)
      setSelectedIds(targetIds)
      setGroupSelectionChrome('perStroke')
      selectGestureRef.current = null
      selectAnchorRef.current = null
      selectDragLiveRef.current = null
      setSelectDragLive(null)
      clearSelectScaleLive()
      selectMoveIdsRef.current =
        hitCmd.kind === 'stroke' && (hitCmd.tool === 'pen' || hitCmd.tool === 'marker')
          ? [hitCmd.id]
          : [...targetIds]
    }

    function onSelectDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
      if (!isSelect) return
      e.preventDefault()
      e.stopPropagation()
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return
      const dead = pointerHitDeadIndices()
      const idx = hitTestAnnotationIndex(commandsRef.current, p[0], p[1], widthPx, heightPx, dead)
      if (idx == null) return
      const cmd = commandsRef.current[idx]!
      if (cmd.kind === 'text' || cmd.kind === 'sticky') {
        setSelectedIds([cmd.id])
        setEditingId(cmd.id)
        return
      }
      if (cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')) {
        const targetIds = resolveClickTargetIds(cmd, dead)
        if (targetIds.length > 1) {
          enterGroupStrokeEditMode(targetIds, cmd)
        }
      }
    }

    function onSelectPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (!isAnnotationPointerDownAccepted(e)) return
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return

      const trailing = eraserLineTrailingForReplay(
        draftStrokeRef.current,
        liveEraserLineDraftRef.current,
      )
      const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
      const selMode = selectionChangeModeFromPointerKeys(e)

      if (editingId == null && selectedIdsRef.current.length > 0) {
        const union = unionSelectionBounds(
          commandsRef.current,
          selectedIdsRef.current,
          widthPx,
          heightPx,
          dead,
        )
        if (union) {
          const handle = hitTestScaleHandle(p, union, widthPx, heightPx)
          if (handle) {
            beginSelectScale(e, handle, union)
            return
          }
        }
      }

      setEditingId(null)
      const idx = hitTestAnnotationIndex(commandsRef.current, p[0], p[1], widthPx, heightPx, dead)
      if (idx != null) {
        const cmd = commandsRef.current[idx]!
        const targetIds = resolveClickTargetIds(cmd, dead)
        const fullySelected = targetIds.every((id) => selectedIdsRef.current.includes(id))

        if (selMode === 'replace' && fullySelected) {
          beginSelectMove(e, p, selectMoveIdsForDrag(cmd))
          return
        }

        const nextIds = applySelectionChange(selectedIdsRef.current, targetIds, selMode)
        setSelectedIds(nextIds)
        setGroupSelectionChrome('union')

        if (selMode === 'shiftClick' || selMode === 'subtract') return
        if (selMode === 'toggle' && fullySelected) return
        if (nextIds.length === 0) return

        beginSelectMove(e, p, selectMoveIdsForDrag(cmd))
        return
      }

      if (selMode === 'replace') {
        setSelectedIds([])
        setGroupSelectionChrome('union')
      }
      marqueeSelModeRef.current = selMode === 'shiftClick' ? 'add' : selMode
      selectGestureRef.current = 'marquee'
      selectAnchorRef.current = p
      setMarqueeRect(normalizeMarqueeRect(p, p))
      setMarqueeMode(resolveMarqueeSelectMode(p, p, marqueeSelectRule))
      setSelectDragLive(null)
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    function onSelectPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return

      if (selectGestureRef.current === 'scale') {
        const start = selectScaleStartBoundsRef.current
        const handle = selectScaleHandleRef.current
        if (!start || !handle) return
        const next = resizeBoundsFromHandle(start, handle, p, { uniform: !e.shiftKey })
        selectScaleLiveBoundsRef.current = next
        setSelectScaleLiveBounds(next)
        paint(null, null)
        return
      }

      const anchor = selectAnchorRef.current
      if (!anchor) return

      if (selectGestureRef.current === 'marquee') {
        setMarqueeRect(normalizeMarqueeRect(anchor, p))
        setMarqueeMode(resolveMarqueeSelectMode(anchor, p, marqueeSelectRule))
        return
      }

      if (selectGestureRef.current === 'move') {
        const live = { dx: p[0] - anchor[0], dy: p[1] - anchor[1] }
        selectDragLiveRef.current = live
        setSelectDragLive(live)
        paint(null, null)
      }
    }

    function onSelectPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      const gesture = selectGestureRef.current
      selectGestureRef.current = null
      const anchor = selectAnchorRef.current
      selectAnchorRef.current = null

      if (gesture === 'marquee' && anchor) {
        const p = clientToNorm(e.clientX, e.clientY)
        const rect = p ? normalizeMarqueeRect(anchor, p) : marqueeRect
        const mode = p
          ? resolveMarqueeSelectMode(anchor, p, marqueeSelectRule)
          : marqueeMode ?? 'crossing'
        setMarqueeRect(null)
        setMarqueeMode(null)
        if (rect && rect.w * rect.h >= MARQUEE_MIN_AREA) {
          const trailing = eraserLineTrailingForReplay(
            draftStrokeRef.current,
            liveEraserLineDraftRef.current,
          )
          const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
          const hits = annotationIdsInMarquee(
            commandsRef.current,
            rect,
            widthPx,
            heightPx,
            mode,
            dead,
          )
          setSelectedIds(
            applySelectionChange(selectedIdsRef.current, hits, marqueeSelModeRef.current),
          )
          setGroupSelectionChrome('union')
        }
        return
      }

      if (gesture === 'move') {
        const live = selectDragLiveRef.current
        selectDragLiveRef.current = null
        setSelectDragLive(null)
        if (live && (live.dx !== 0 || live.dy !== 0)) {
          moveSelectedBy(live.dx, live.dy)
        } else {
          paint(null, null)
        }
        return
      }

      if (gesture === 'scale') {
        const start = selectScaleStartBoundsRef.current
        const live = selectScaleLiveBoundsRef.current
        clearSelectScaleLive()
        if (
          start &&
          live &&
          (Math.abs(start.w - live.w) > 1e-6 ||
            Math.abs(start.h - live.h) > 1e-6 ||
            Math.abs(start.x - live.x) > 1e-6 ||
            Math.abs(start.y - live.y) > 1e-6)
        ) {
          scaleSelectedBy(start, live)
        } else {
          paint(null, null)
        }
      }
    }

    function onSelectPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      selectGestureRef.current = null
      selectAnchorRef.current = null
      selectDragLiveRef.current = null
      setMarqueeRect(null)
      setMarqueeMode(null)
      setSelectDragLive(null)
      clearSelectScaleLive()
      paint(null, null)
    }

    useEffect(
      () =>
        subscribeBrushPatternTileLoads(() => {
          paint(draftStrokeRef.current, twoDraftRef.current)
        }),
      [paint],
    )

    function clientToNorm(clientX: number, clientY: number): [number, number] | null {
      const el = overlayRef.current
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      const nx = (clientX - r.left) / r.width
      const ny = (clientY - r.top) / r.height
      return [clamp01(nx), clamp01(ny)]
    }

    function pointerHitDeadIndices(): Set<number> {
      const trailing = eraserLineTrailingForReplay(
        draftStrokeRef.current,
        liveEraserLineDraftRef.current,
      )
      return computeEraserLineDeadIndices(commandsRef.current, trailing)
    }

    function clearSelectionState(): void {
      setSelectedIds([])
      setGroupSelectionChrome('union')
      setEditingId(null)
      setMarqueeRect(null)
      setMarqueeMode(null)
      setSelectDragLive(null)
      clearSelectScaleLive()
      selectGestureRef.current = null
      selectAnchorRef.current = null
      selectDragLiveRef.current = null
      setPointerOverSelection(false)
      setHoveredScaleHandle(null)
    }

    function isPointerOverSelected(p: [number, number]): boolean {
      if (selectedIdsRef.current.length === 0) return false
      return (
        hitTestSelectedAnnotationIndex(
          commandsRef.current,
          selectedIdsRef.current,
          p[0],
          p[1],
          widthPx,
          heightPx,
          pointerHitDeadIndices(),
        ) != null
      )
    }

    function updateSelectionHover(e: React.PointerEvent<HTMLDivElement>): void {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) return
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return

      if (
        isSelect &&
        editingId == null &&
        selectedIdsRef.current.length > 0 &&
        !marqueeRect
      ) {
        const dead = pointerHitDeadIndices()
        const union = unionSelectionBounds(
          commandsRef.current,
          selectedIdsRef.current,
          widthPx,
          heightPx,
          dead,
        )
        if (union) {
          const handle = hitTestScaleHandle(p, union, widthPx, heightPx)
          if (handle !== hoveredScaleHandle) setHoveredScaleHandle(handle)
          if (handle) {
            if (pointerOverSelection) setPointerOverSelection(false)
            return
          }
        }
      }

      if (hoveredScaleHandle) setHoveredScaleHandle(null)

      if (selectedIdsRef.current.length === 0) {
        if (pointerOverSelection) setPointerOverSelection(false)
        return
      }
      const over = isPointerOverSelected(p)
      if (over !== pointerOverSelection) setPointerOverSelection(over)
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
    const isSelect = mode === 'select'

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
        if (penStrokeProfile) base.penStrokeProfile = penStrokeProfile
      } else if (tool === 'marker' && strokeColor) {
        base.color = strokeColor
        base.lineDashStyle = strokeLineDashStyle
        if (markerDecoratedEdge) base.markerDecoratedEdge = true
      }
      return base
    }

    function commitDraftStroke(draft: StrokeAnnotationCommand): void {
      if (sessionOwnsCanvasInk) return
      const commitPoints = ensureStrokeCommitPoints(draft.points)
      if (commitPoints.length < 2) return
      const cmd: StrokeAnnotationCommand = { ...draft, points: commitPoints }
      let next = [...commandsRef.current, cmd]
      if (cmd.tool === 'pen') {
        next = applyPenAutoGroupAfterAppend(next, cmd.id)
      }
      setCommands(next)
      persist(next)
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (isSelect) return
      if (!isAnnotationPointerDownAccepted(e)) return
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return

      if (selectedIdsRef.current.length > 0) {
        if (isPointerOverSelected(p)) {
          setEditingId(null)
          const hitIdx = hitTestSelectedAnnotationIndex(
            commandsRef.current,
            selectedIdsRef.current,
            p[0],
            p[1],
            widthPx,
            heightPx,
            pointerHitDeadIndices(),
          )
          const hitCmd = hitIdx != null ? commandsRef.current[hitIdx] : null
          selectMoveIdsRef.current =
            hitCmd != null ? selectMoveIdsForDrag(hitCmd) : [...selectedIdsRef.current]
          selectGestureRef.current = 'move'
          selectAnchorRef.current = p
          selectDragLiveRef.current = { dx: 0, dy: 0 }
          setSelectDragLive({ dx: 0, dy: 0 })
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
        clearSelectionState()
      }

      onPointerSessionStart?.()

      const strokeTool = effectiveStrokeToolForPointer(mode, e)

      if (strokeTool) {
        if (sessionOwnsCanvasInk) return
        setAnnotationGestureActive(true)
        gestureRef.current = 'stroke'
        straightStrokeAxisRef.current = null
        redoStackRef.current = []
        draftStrokeRef.current = makeStrokeDraft(strokeTool, p)
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(draftStrokeRef.current, null, {
          skipCommittedReplay: strokeToolSkipsCommittedReplayOnLivePaint(strokeTool),
        })
        emitCapabilities()
        return
      }

      if (isTwoPointTool) {
        if (sessionOwnsCanvasInk) return
        setAnnotationGestureActive(true)
        gestureRef.current = 'two'
        redoStackRef.current = []
        twoDraftRef.current = {
          kind: mode,
          anchor: p,
          current: p,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(null, twoDraftRef.current, { skipCommittedReplay: true })
        emitCapabilities()
        return
      }

      if (isTapTool) {
        if (mode === 'text') {
          const trailing = eraserLineTrailingForReplay(
            draftStrokeRef.current,
            liveEraserLineDraftRef.current,
          )
          const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
          const hitIdx = hitTestAnnotationIndex(
            commandsRef.current,
            p[0],
            p[1],
            widthPx,
            heightPx,
            dead,
          )
          if (hitIdx != null && commandsRef.current[hitIdx]?.kind === 'text') {
            const hitId = commandsRef.current[hitIdx]!.id
            if (isAnnotationTextFieldFocused(hitId)) return
            if (commitBookOverlayTypingTarget()) setFocusNewId(null)
            setFocusNewId(hitId)
            return
          }
          if (commitBookOverlayTypingTarget()) {
            setFocusNewId(null)
          }
        }
        gestureRef.current = 'tap'
        tapModeRef.current = mode as TapMode
        tapStartRef.current = p
        tapStartClientRef.current = [e.clientX, e.clientY]
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return

      if (gestureRef.current !== 'stroke' && gestureRef.current !== 'two') return

      const draft = draftStrokeRef.current
      if (draft) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) return
        const nextTool = effectiveStrokeToolForPointer(mode, e)
        if (nextTool !== draft.tool) {
          commitDraftStroke(draft)
          straightStrokeAxisRef.current = null
          if (nextTool) {
            draftStrokeRef.current = makeStrokeDraft(nextTool, p)
            paint(draftStrokeRef.current, null, {
              skipCommittedReplay: strokeToolSkipsCommittedReplayOnLivePaint(nextTool),
            })
          } else {
            draftStrokeRef.current = null
            gestureRef.current = null
            paint(null, null)
          }
          return
        }
        const samples: [number, number][] = []
        for (const ev of coalescedPointerEvents(e.nativeEvent)) {
          const sp = clientToNorm(ev.clientX, ev.clientY)
          if (sp) samples.push(sp)
        }
        if (samples.length === 0) return
        straightStrokeAxisRef.current = extendStrokeDraftFromMove(draft, samples, {
          shiftKey: e.shiftKey,
          markerStraightStrokeEnabled: markerStraightStroke,
          penInkStyle: draft.tool === 'pen' ? penInkStyle : undefined,
          straightStrokeAxis: straightStrokeAxisRef.current,
        })
        paint(draft, null, {
          skipCommittedReplay: strokeToolSkipsCommittedReplayOnLivePaint(draft.tool),
        })
        return
      }

      const td = twoDraftRef.current
      if (td) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) return
        td.current = p
        paint(null, td, { skipCommittedReplay: true })
      }
    }

    function commitTwoPoint(): void {
      if (sessionOwnsCanvasInk) return
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

    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      const gesture = gestureRef.current
      gestureRef.current = null
      if (gesture === 'stroke' || gesture === 'two') {
        setAnnotationGestureActive(false)
      }

      const draft = draftStrokeRef.current
      if (draft && gesture === 'stroke') {
        const p = clientToNorm(e.clientX, e.clientY)
        if (p) {
          finalizeStrokeDraftEndPoint(draft, p, {
            shiftKey: e.shiftKey,
            markerStraightStrokeEnabled: markerStraightStroke,
            penInkStyle: draft.tool === 'pen' ? penInkStyle : undefined,
            straightStrokeAxis: straightStrokeAxisRef.current,
          })
        }
      }
      straightStrokeAxisRef.current = null
      draftStrokeRef.current = null
      if (draft && draft.points.length >= 1) {
        commitDraftStroke(draft)
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
          paint(null, null)
          return
        }
        const dx = p[0] - tap0[0]
        const dy = p[1] - tap0[1]
        if (dx * dx + dy * dy > TAP_MOVE_EPS * TAP_MOVE_EPS) {
          paint(null, null)
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
            yAnchor: 'top',
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

      paint(null, null)
    }

    function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (gestureRef.current === 'stroke' || gestureRef.current === 'two') {
        setAnnotationGestureActive(false)
      }
      gestureRef.current = null
      draftStrokeRef.current = null
      twoDraftRef.current = null
      tapStartRef.current = null
      tapStartClientRef.current = null
      tapModeRef.current = null
      paint(null, null)
    }

    function pointerUsesSelectInteraction(e: React.PointerEvent): boolean {
      return isSelect || e.ctrlKey
    }

    function onOverlayPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (pointerUsesSelectInteraction(e)) {
        onSelectPointerDown(e)
        return
      }
      onPointerDown(e)
    }

    function onOverlayPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (selectGestureRef.current) {
        onSelectPointerMove(e)
        return
      }
      if (
        !pointerUsesSelectInteraction(e) &&
        (gestureRef.current === 'stroke' || gestureRef.current === 'two')
      ) {
        onPointerMove(e)
        return
      }
      if (pointerUsesSelectInteraction(e) || selectedIdsRef.current.length > 0) {
        updateSelectionHover(e)
      }
    }

    function onOverlayPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      if (selectGestureRef.current) {
        onSelectPointerUp(e)
        return
      }
      onPointerUp(e)
    }

    function onOverlayPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
      if (selectGestureRef.current) {
        onSelectPointerCancel(e)
        return
      }
      onPointerCancel(e)
    }

    const overlayCursor = useMemo(
      () =>
        resolveAnnotationToolCursor(
          mode,
          {
            strokeWidthScale,
            eraserLineStrokeWidthScale,
            penStrokeWidthScale,
          },
          {
            color: strokeColor,
            penStrokeProfile: penStrokeProfile as PenStrokeProfile | undefined,
            eyedropperVariant,
          },
        ),
      [
        mode,
        strokeWidthScale,
        eraserLineStrokeWidthScale,
        penStrokeWidthScale,
        strokeColor,
        penStrokeProfile,
        eyedropperVariant,
      ],
    )

    const hasSelection = selectedIds.length > 0
    const showSelectionChrome = isSelect || hasSelection

    const effectiveOverlayCursor: CSSProperties['cursor'] = selectScaleLiveBounds
      ? 'default'
      : selectDragLive
        ? 'grabbing'
        : hoveredScaleHandle
          ? cursorForScaleHandle(hoveredScaleHandle)
          : pointerOverSelection && hasSelection
            ? 'grab'
            : isSelect
              ? 'default'
              : (overlayCursor ?? 'crosshair')

    const overlayClass = cn('absolute inset-0 touch-none')

    const trailingEraserForSelect = eraserLineTrailingForReplay(
      draftStrokeRef.current,
      liveEraserLineDraftRef.current,
    )
    const deadIndicesForSelect = computeEraserLineDeadIndices(commands, trailingEraserForSelect)
    const paintedCommands =
      selectScaleLiveBounds && selectScaleStartBoundsRef.current
        ? scaleAnnotationCommands(
            commands,
            new Set(selectScaleIdsRef.current),
            selectScaleStartBoundsRef.current,
            selectScaleLiveBounds,
          )
        : selectDragLive && selectMoveIdsRef.current.length > 0
          ? translateAnnotationCommands(
              commands,
              new Set(selectMoveIdsRef.current),
              selectDragLive.dx,
              selectDragLive.dy,
            )
          : commands

    const selectionOutlineRectsList = selectionOutlineRects(
      paintedCommands,
      selectedIds,
      widthPx,
      heightPx,
      groupSelectionChrome,
      deadIndicesForSelect,
    )

    const selectionUnionBounds =
      hasSelection && isSelect && editingId == null && !marqueeRect
        ? selectScaleLiveBounds ??
          unionSelectionBounds(
            paintedCommands,
            selectedIds,
            widthPx,
            heightPx,
            deadIndicesForSelect,
          )
        : null

    const showScaleHandles =
      isSelect && hasSelection && editingId == null && !marqueeRect && selectionUnionBounds != null

    if (widthPx <= 0 || heightPx <= 0) return null

    const trailingEraser = trailingEraserForSelect
    const deadIndices = deadIndicesForSelect
    void erasePreviewEpoch
    const renderSlices = buildAnnotationRenderSlices(paintedCommands, deadIndices)
    const cmdCount = paintedCommands.length
    const draftZ = sliceStackZ(draftOverlayZIndex(cmdCount))
    const selectChromeZ = draftZ + 1
    const pointerOverlayZ = draftZ + 2
    /** Let stickies / text fields receive clicks when editing; text tool uses overlay hit-testing. */
    const pointerEventsOnOverlay =
      !delegatePointerToSpread &&
      !delegatePointerToWhiteboardPen &&
      mode !== 'sticky' &&
      !(isSelect && editingId != null)

    let inkSliceIdx = 0
    let markerSliceIdx = 0

    const pageBox = (zIndex: number): CSSProperties => pageLayerBox(widthPx, heightPx, zIndex)

    return (
      <>
        {renderSlices.map((slice) => {
          if (slice.kind === 'ink') {
            const idx = inkSliceIdx++
            const isFirstInk = idx === 0
            const z = sliceStackZ(slice.zIndex)
            return (
              <canvas
                key={`ink-${slice.zIndex}-${slice.indices.join(',')}`}
                ref={(el) => {
                  inkSliceRefs.current[idx] = el
                }}
                role={isFirstInk ? 'img' : undefined}
                aria-label={isFirstInk ? `Annotations for page ${pageNumber}` : undefined}
                className="pointer-events-none"
                style={pageBox(z)}
              />
            )
          }
          if (slice.kind === 'marker') {
            const idx = markerSliceIdx++
            const z = sliceStackZ(slice.zIndex)
            return (
              <canvas
                key={`marker-${slice.zIndex}-${slice.indices.join(',')}`}
                ref={(el) => {
                  markerSliceRefs.current[idx] = el
                }}
                aria-hidden
                className="pointer-events-none"
                style={{ ...pageBox(z), ...MARKER_CANVAS_BLEND }}
              />
            )
          }
          const sliceCommands = slice.indices.map((i) => paintedCommands[i]!)
          return (
            <BookPageAnnotationDomLayer
              key={`dom-${slice.zIndex}`}
              widthPx={widthPx}
              heightPx={heightPx}
              zIndex={mode === 'text' ? pointerOverlayZ + 1 : sliceStackZ(slice.zIndex)}
              commands={sliceCommands}
              onUpdateCommand={patchCommand}
              onDeleteSticky={deleteStickyCommand}
              onDeleteText={deleteTextCommand}
              focusNewId={focusNewId}
              onConsumedFocusNew={() => setFocusNewId(null)}
              selectMode={isSelect}
              textToolActive={mode === 'text'}
              editingId={editingId}
              onEditingIdChange={setEditingId}
              coachField={storageChannel === 'whiteboard' ? 'whiteboard' : 'label'}
            />
          )
        })}
        <canvas
          ref={draftInkCanvasRef}
          aria-hidden
          className="pointer-events-none"
          style={pageBox(draftZ)}
        />
        <canvas
          ref={draftMarkerCanvasRef}
          aria-hidden
          className="pointer-events-none"
          style={{ ...pageBox(draftZ), ...MARKER_CANVAS_BLEND }}
        />
        {showSelectionChrome ? (
          <div className="pointer-events-none" style={{ ...pageBox(selectChromeZ) }} aria-hidden>
              {marqueeRect ? (
                <div
                  className={cn(
                    'absolute box-border',
                    marqueeMode === 'window'
                      ? SELECTION_MARQUEE_WINDOW_CLASS
                      : SELECTION_MARQUEE_CROSSING_CLASS,
                  )}
                  style={{
                    left: `${marqueeRect.x * 100}%`,
                    top: `${marqueeRect.y * 100}%`,
                    width: `${marqueeRect.w * 100}%`,
                    height: `${marqueeRect.h * 100}%`,
                  }}
                />
              ) : null}
              <SelectionBoundsChrome
                outlineRects={selectionOutlineRectsList}
                unionBounds={selectionUnionBounds}
                showHandles={showScaleHandles}
              />
            </div>
          ) : null}
        <div
          ref={overlayRef}
          role="presentation"
          className={overlayClass}
          style={{
            ...pageBox(pointerOverlayZ),
            cursor: effectiveOverlayCursor,
            pointerEvents: pointerEventsOnOverlay ? 'auto' : 'none',
          }}
          onPointerDown={onOverlayPointerDown}
          onPointerMove={onOverlayPointerMove}
          onPointerUp={onOverlayPointerUp}
          onPointerCancel={onOverlayPointerCancel}
          onDoubleClick={isSelect ? onSelectDoubleClick : undefined}
          onPointerLeave={() => {
            setPointerOverSelection(false)
            setHoveredScaleHandle(null)
          }}
          onContextMenu={(e) => {
            if ((e.nativeEvent as PointerEvent).pointerType === 'pen') e.preventDefault()
          }}
        />
      </>
    )
  },
)

BookPageAnnotationLayer.displayName = 'BookPageAnnotationLayer'
