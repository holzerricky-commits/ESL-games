import type { MutableRefObject } from 'react'
import type {
  AnnotationCommand,
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  StrokeAnnotationCommand,
  TextAnnotationVisualStyle,
  WritableStickerVariant,
} from '@/lib/books/annotation-command-types'
import type { StickerKind } from '@/lib/books/sticker-tool'
import type { EyedropperVariant } from '@/lib/books/eyedropper-variant'
import type {
  AnnotationStorageChannel,
  BookAnnotationInteractionMode,
} from '@/lib/books/annotation-storage'
import type { MarqueeSelectRule } from '@/lib/books/annotation-select'
import type { WhiteboardSessionStore } from '@/lib/books/whiteboard-session-store'

export type TwoDraftKind = 'line' | 'rect' | 'ellipse' | 'triangle' | 'arrow'

export interface TwoPointDraft {
  kind: TwoDraftKind
  anchor: [number, number]
  current: [number, number]
}

/** Spread-mode two-point shape preview pushed from `BookSpreadStrokeOverlay`. */
export type LiveTwoPointDraft = TwoPointDraft

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
  /** Keyboard nudge / programmatic move of the current selection. */
  moveSelectedBy?: (dx: number, dy: number) => boolean
  /** Live keyboard nudge preview (cumulative offset from gesture start). */
  setNudgePreview?: (dx: number, dy: number) => void
  commitNudgePreview?: () => boolean
  clearNudgePreview?: () => void
  /** Stop auto-group from merging new pen ink into existing figures (leaving pen tool). */
  lockPenFigureAutoJoin?: () => void
}

export type AnnotationCapabilities = {
  canUndo: boolean
  canRedo: boolean
}

export type TapMode = Extract<
  BookAnnotationInteractionMode,
  'stamp' | 'callout' | 'text' | 'sticky' | 'eyedropper'
>

export type IncrementalDraftSource = 'local' | 'spread'

export type IncrementalDraftState = {
  source: IncrementalDraftSource
  tool: 'pen' | 'marker'
  pointsLength: number
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
  /** Unified sticker tool: quick symbols vs writable cards. */
  stickerKind?: StickerKind
  writableStickerVariant?: WritableStickerVariant
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
  /** Pen / brush / effects (legacy pencil / fine-liner on old strokes). */
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
  shapeRoundedCorners?: boolean
  textFontSizeNorm: number
  textFontId: import('@/lib/books/annotation-text-fonts').AnnotationTextFontId
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
  /** When spread ink is delegated, stamp/callout commits go to the spread session (page-norm cmd). */
  onSpreadCanvasCommandCommit?: (cmd: AnnotationCommand, pageNumber: number) => void
}
