import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { StampVariant } from '@/lib/books/annotation-command-types'

/** Max gap between repeated key presses to count as cycling variants. */
export const BOOK_OVERLAY_SHORTCUT_TAP_MAX_MS = 450

/** Shape tools in toolbar / M shortcut cycle order. */
export const BOOK_OVERLAY_SHAPE_MODES = ['line', 'rect', 'ellipse', 'triangle', 'arrow'] as const

export type BookOverlayShapeMode = (typeof BOOK_OVERLAY_SHAPE_MODES)[number]

export function isBookOverlayShapeMode(mode: BookAnnotationInteractionMode): mode is BookOverlayShapeMode {
  return (BOOK_OVERLAY_SHAPE_MODES as readonly string[]).includes(mode)
}

export const BOOK_OVERLAY_DEFAULT_SHAPE_MODE: BookOverlayShapeMode = 'rect'

export function cycleBookOverlayShapeMode(current: BookOverlayShapeMode): BookOverlayShapeMode {
  const idx = BOOK_OVERLAY_SHAPE_MODES.indexOf(current)
  const next = idx < 0 ? 0 : (idx + 1) % BOOK_OVERLAY_SHAPE_MODES.length
  return BOOK_OVERLAY_SHAPE_MODES[next]!
}

/** Stamp icons in toolbar / S shortcut cycle order. */
export const BOOK_OVERLAY_STAMP_VARIANTS: readonly StampVariant[] = [
  'check',
  'cross',
  'question',
  'star',
  'heart',
]

/** Eraser modes in E shortcut cycle order. */
export const BOOK_OVERLAY_ERASER_MODES = ['eraser-line', 'eraser'] as const satisfies readonly BookAnnotationInteractionMode[]

export type ShortcutTapState = {
  lastAt: number
  /** Index chosen on the last tap in the current burst; -1 when idle. */
  lastIndex: number
}

export const INITIAL_SHORTCUT_TAP_STATE: ShortcutTapState = { lastAt: 0, lastIndex: -1 }

/**
 * Variant index for a tool shortcut burst.
 * First press (or after tap window expires) → currentIndex.
 * Rapid repeat within BOOK_OVERLAY_SHORTCUT_TAP_MAX_MS → next index, wrapping.
 */
export function resolveShortcutTapIndex(
  state: ShortcutTapState,
  now: number,
  variantCount: number,
  currentIndex: number,
): { index: number; nextState: ShortcutTapState } {
  if (variantCount <= 0) {
    return { index: 0, nextState: { lastAt: now, lastIndex: 0 } }
  }
  const safeCurrent =
    currentIndex >= 0 && currentIndex < variantCount ? currentIndex : 0
  const withinWindow =
    state.lastAt > 0 && now - state.lastAt <= BOOK_OVERLAY_SHORTCUT_TAP_MAX_MS
  const index = withinWindow
    ? (state.lastIndex + 1) % variantCount
    : safeCurrent
  return { index, nextState: { lastAt: now, lastIndex: index } }
}

/** Alt+1 … Alt+5 for direct stamp variant selection. */
export const BOOK_OVERLAY_STAMP_VARIANT_BY_DIGIT: Record<string, StampVariant> = {
  '1': 'check',
  '2': 'cross',
  '3': 'question',
  '4': 'star',
  '5': 'heart',
}

/** Single-key labels shown in tooltips. */
export const BOOK_OVERLAY_SHORTCUT_LABELS = {
  pen: 'P',
  eyedropper: 'I',
  eyedropperCycle: 'I again',
  highlighter: 'H',
  shapes: 'M',
  shapeCycle: 'M again',
  shapeRect: 'R',
  shapeEllipse: 'O',
  shapeArrow: 'A',
  shapeLineAndTriangle: 'M again to cycle',
  stamp: 'S',
  stampVariants: 'S again, Alt+1–5',
  text: 'T',
  sticky: 'N',
  callout: 'K',
  eraserStroke: 'E',
  eraserRub: 'E again',
  laser: 'L',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Shift+Z',
  clearPage: 'Ctrl+Shift+Backspace',
  toggleTools: '`',
  pageList: 'G',
  whiteboard: 'W',
  thicknessDown: '[',
  thicknessUp: ']',
  pagePrev: '←',
  pageNext: '→',
  closePanelOrBook: 'Esc',
} as const
