import type {
  AnnotationCommand,
  AnnotationLineDashStyle,
  ImageAnnotationCommand,
  ShapeFillMode,
  StickyAnnotationCommand,
  StrokeAnnotationCommand,
  TextAnnotationCommand,
  TextAnnotationAlign,
  TextAnnotationVisualStyle,
} from '@/lib/books/annotation-command-types'
import { isPenOrMarkerStroke } from '@/lib/books/annotation-connected-strokes'
import { DEFAULT_STICKY_FILL_COLOR } from '@/lib/books/annotation-palettes'
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import {
  getAnnotationBounds,
  type NormRect,
  unionNormRects,
} from '@/lib/books/annotation-select'
import { resolveSelectionBarPlacement, type SelectionBarPlacement } from '@/lib/books/selection-context-anchor'
import {
  isFilledShapeCommand,
  shapeFillColorForFilled,
  shapeFillModeForFilled,
  shapeLineDashStyle,
  shapeIsLocked,
  shapeStrokeColorHex,
  shapeStrokeEnabledForFilled,
  shapeWidthScale,
  type ShapeSelectionCommand,
} from '@/lib/books/shape-selection'
import {
  inkStrokeColor,
  inkStrokeIsMarker,
  inkStrokeIsPen,
  inkStrokeLineDash,
  inkStrokeWidthScale,
  type InkStrokeCommand,
} from '@/lib/books/stroke-selection'

export type SelectionContextKind = 'text' | 'sticky' | 'shape' | 'stroke' | 'image' | 'mixed'

export type SelectionContext = {
  kind: SelectionContextKind
  commandIds: string[]
  textCommands: TextAnnotationCommand[]
  stickyCommands: StickyAnnotationCommand[]
  shapeCommands: ShapeSelectionCommand[]
  strokeCommands: InkStrokeCommand[]
  imageCommands: ImageAnnotationCommand[]
  anchorRect: NormRect
  placement: SelectionBarPlacement
  visible: boolean
}

export type ResolveSelectionContextOpts = {
  commands: readonly AnnotationCommand[]
  selectedIds: readonly string[]
  widthPx: number
  heightPx: number
  editingId?: string | null
  deadIndices?: ReadonlySet<number>
}

function commandKindBucket(cmd: AnnotationCommand): SelectionContextKind {
  switch (cmd.kind) {
    case 'text':
      return 'text'
    case 'sticky':
      return 'sticky'
    case 'image':
      return 'image'
    case 'stroke':
      return 'stroke'
  }
  if (
    cmd.kind === 'rect' ||
    cmd.kind === 'ellipse' ||
    cmd.kind === 'triangle' ||
    cmd.kind === 'line' ||
    cmd.kind === 'arrow'
  ) {
    return 'shape'
  }
  return 'mixed'
}

function resolveSelectedCommands(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  deadIndices?: ReadonlySet<number>,
): AnnotationCommand[] {
  if (selectedIds.length === 0) return []
  const byId = new Map(commands.map((c, i) => [c.id, { cmd: c, index: i }]))
  const picked: AnnotationCommand[] = []
  for (const id of selectedIds) {
    const entry = byId.get(id)
    if (!entry) continue
    if (deadIndices?.has(entry.index) && entry.cmd.kind === 'stroke') continue
    picked.push(entry.cmd)
  }
  return picked
}

function classifySelectionKinds(
  selected: readonly AnnotationCommand[],
): SelectionContextKind | null {
  if (selected.length === 0) return null
  const buckets = new Set<SelectionContextKind>()
  for (const cmd of selected) {
    buckets.add(commandKindBucket(cmd))
  }
  if (buckets.size === 1) return [...buckets][0]!
  return 'mixed'
}

function anchorRectForSelection(
  selected: readonly AnnotationCommand[],
  widthPx: number,
  heightPx: number,
): NormRect | null {
  const rects: NormRect[] = []
  for (const cmd of selected) {
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    if (bounds) rects.push(bounds)
  }
  return unionNormRects(rects)
}

/** Derive selection context for the floating context bar. Returns null when the bar should not show. */
export function resolveSelectionContext(
  opts: ResolveSelectionContextOpts,
): SelectionContext | null {
  const { commands, selectedIds, widthPx, heightPx, editingId, deadIndices } = opts
  if (editingId != null) return null
  if (selectedIds.length === 0) return null
  if (!(widthPx > 0) || !(heightPx > 0)) return null

  const selected = resolveSelectedCommands(commands, selectedIds, deadIndices)
  if (selected.length === 0) return null

  const kind = classifySelectionKinds(selected)
  if (kind == null) return null

  const anchorRect = anchorRectForSelection(selected, widthPx, heightPx)
  if (anchorRect == null || anchorRect.w <= 0 || anchorRect.h <= 0) return null

  const placement = resolveSelectionBarPlacement(anchorRect)

  const textCommands = selected.filter((c): c is TextAnnotationCommand => c.kind === 'text')
  const stickyCommands = selected.filter((c): c is StickyAnnotationCommand => c.kind === 'sticky')
  const shapeCommands = selected.filter(
    (c): c is ShapeSelectionCommand =>
      c.kind === 'line' ||
      c.kind === 'arrow' ||
      c.kind === 'rect' ||
      c.kind === 'ellipse' ||
      c.kind === 'triangle',
  )
  const strokeCommands = selected.filter(
    (c): c is InkStrokeCommand => isPenOrMarkerStroke(c),
  )
  const imageCommands = selected.filter((c): c is ImageAnnotationCommand => c.kind === 'image')

  return {
    kind,
    commandIds: selected.map((c) => c.id),
    textCommands,
    stickyCommands,
    shapeCommands,
    strokeCommands,
    imageCommands,
    anchorRect,
    placement,
    visible: true,
  }
}

/** Common stroke color across text commands, or `mixed` when they disagree. */
export function commonTextStrokeColor(
  texts: readonly TextAnnotationCommand[],
): string | 'mixed' | null {
  if (texts.length === 0) return null
  const first = texts[0]!.color.toLowerCase()
  for (let i = 1; i < texts.length; i++) {
    if (texts[i]!.color.toLowerCase() !== first) return 'mixed'
  }
  return texts[0]!.color
}

type CommonValue<T> = T | 'mixed' | null

function commonFieldOn<T, V>(
  items: readonly T[],
  read: (item: T) => V,
  eq: (a: V, b: V) => boolean = (a, b) => a === b,
): CommonValue<V> {
  if (items.length === 0) return null
  const first = read(items[0]!)
  for (let i = 1; i < items.length; i++) {
    if (!eq(read(items[i]!), first)) return 'mixed'
  }
  return first
}

function commonField<T extends TextAnnotationCommand, V>(
  texts: readonly T[],
  read: (cmd: T) => V,
  eq: (a: V, b: V) => boolean = (a, b) => a === b,
): CommonValue<V> {
  return commonFieldOn(texts, read, eq)
}

export function commonTextFontId(
  texts: readonly TextAnnotationCommand[],
): CommonValue<AnnotationTextFontId | undefined> {
  return commonField(texts, (cmd) => cmd.fontId, (a, b) => a === b)
}

export function commonTextVisualStyle(
  texts: readonly TextAnnotationCommand[],
): CommonValue<TextAnnotationVisualStyle | undefined> {
  return commonField(texts, (cmd) => cmd.visualStyle ?? 'plain')
}

export function commonTextAlign(
  texts: readonly TextAnnotationCommand[],
): CommonValue<TextAnnotationAlign | undefined> {
  return commonField(texts, (cmd) => cmd.textAlign ?? 'left')
}

export function commonTextFillColor(
  texts: readonly TextAnnotationCommand[],
): CommonValue<string | undefined> {
  return commonField(texts, (cmd) => cmd.fillColor, (a, b) => a?.toLowerCase() === b?.toLowerCase())
}

export function commonTextFontSizeNorm(
  texts: readonly TextAnnotationCommand[],
): CommonValue<number> {
  return commonField(texts, (cmd) => cmd.fontSizeNorm, (a, b) => Math.abs(a - b) < 1e-6)
}

/** True when every selected live command is a text label (ignores layout). */
export function isTextOnlySelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  deadIndices?: ReadonlySet<number>,
): boolean {
  if (selectedIds.length === 0) return false
  const selected = resolveSelectedCommands(commands, selectedIds, deadIndices)
  if (selected.length === 0) return false
  return classifySelectionKinds(selected) === 'text'
}

export function anySelectedTextFilled(texts: readonly TextAnnotationCommand[]): boolean {
  return texts.some((cmd) => (cmd.visualStyle ?? 'plain') === 'filled')
}

export function commonStickyFillColor(
  stickies: readonly StickyAnnotationCommand[],
): CommonValue<string> {
  return commonFieldOn(
    stickies,
    (cmd) => cmd.fillColor ?? DEFAULT_STICKY_FILL_COLOR,
    (a, b) => a.toLowerCase() === b.toLowerCase(),
  )
}

export function commonStickyFontId(
  stickies: readonly StickyAnnotationCommand[],
): CommonValue<AnnotationTextFontId | undefined> {
  return commonFieldOn(stickies, (cmd) => cmd.fontId, (a, b) => a === b)
}

export function commonStickyFontSizeNorm(
  stickies: readonly StickyAnnotationCommand[],
): CommonValue<number> {
  return commonFieldOn(
    stickies,
    (cmd) => cmd.fontSizeNorm,
    (a, b) => Math.abs(a - b) < 1e-6,
  )
}

/** True when every selected live command is a sticky / writable note. */
export function isStickyOnlySelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  deadIndices?: ReadonlySet<number>,
): boolean {
  if (selectedIds.length === 0) return false
  const selected = resolveSelectedCommands(commands, selectedIds, deadIndices)
  if (selected.length === 0) return false
  return classifySelectionKinds(selected) === 'sticky'
}

export function anySelectedFilledShapes(shapes: readonly ShapeSelectionCommand[]): boolean {
  return shapes.some(isFilledShapeCommand)
}

function filledShapeCommands(shapes: readonly ShapeSelectionCommand[]) {
  return shapes.filter(isFilledShapeCommand)
}

export function commonShapeStrokeColor(
  shapes: readonly ShapeSelectionCommand[],
): CommonValue<string> {
  return commonFieldOn(
    shapes,
    shapeStrokeColorHex,
    (a, b) => a.toLowerCase() === b.toLowerCase(),
  )
}

export function commonShapeLineDashStyle(
  shapes: readonly ShapeSelectionCommand[],
): CommonValue<AnnotationLineDashStyle> {
  return commonFieldOn(shapes, shapeLineDashStyle)
}

export function commonShapeWidthScale(shapes: readonly ShapeSelectionCommand[]): CommonValue<number> {
  return commonFieldOn(shapes, shapeWidthScale, (a, b) => Math.abs(a - b) < 1e-6)
}

export function commonShapeFillMode(
  shapes: readonly ShapeSelectionCommand[],
): CommonValue<ShapeFillMode> {
  const filled = filledShapeCommands(shapes)
  if (filled.length === 0) return null
  return commonFieldOn(filled, shapeFillModeForFilled)
}

export function commonShapeFillColor(
  shapes: readonly ShapeSelectionCommand[],
): CommonValue<string> {
  const filled = filledShapeCommands(shapes)
  if (filled.length === 0) return null
  return commonFieldOn(
    filled,
    shapeFillColorForFilled,
    (a, b) => a.toLowerCase() === b.toLowerCase(),
  )
}

export function commonShapeStrokeEnabled(
  shapes: readonly ShapeSelectionCommand[],
): CommonValue<boolean> {
  const filled = filledShapeCommands(shapes)
  if (filled.length === 0) return null
  return commonFieldOn(filled, shapeStrokeEnabledForFilled)
}

export function commonShapeLocked(shapes: readonly ShapeSelectionCommand[]): CommonValue<boolean> {
  return commonFieldOn(shapes, shapeIsLocked)
}

/** True when every selected live command is a vector shape. */
export function isShapeOnlySelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  deadIndices?: ReadonlySet<number>,
): boolean {
  if (selectedIds.length === 0) return false
  const selected = resolveSelectedCommands(commands, selectedIds, deadIndices)
  if (selected.length === 0) return false
  return classifySelectionKinds(selected) === 'shape'
}

export function commonInkStrokeColor(strokes: readonly InkStrokeCommand[]): CommonValue<string> {
  return commonFieldOn(
    strokes,
    inkStrokeColor,
    (a, b) => a.toLowerCase() === b.toLowerCase(),
  )
}

export function commonInkStrokeWidthScale(strokes: readonly InkStrokeCommand[]): CommonValue<number> {
  return commonFieldOn(strokes, inkStrokeWidthScale, (a, b) => Math.abs(a - b) < 1e-6)
}

export function commonInkStrokeLineDash(
  strokes: readonly InkStrokeCommand[],
): CommonValue<AnnotationLineDashStyle> {
  return commonFieldOn(strokes, inkStrokeLineDash)
}

export function commonInkStrokeMarkerDecoratedEdge(
  strokes: readonly InkStrokeCommand[],
): CommonValue<boolean> {
  const markers = strokes.filter(inkStrokeIsMarker)
  if (markers.length === 0) return null
  return commonFieldOn(markers, (cmd) => cmd.markerDecoratedEdge === true)
}

export type InkStrokeToolMix = 'pen' | 'marker' | 'mixed'

export function inkStrokeToolMix(strokes: readonly InkStrokeCommand[]): InkStrokeToolMix | null {
  if (strokes.length === 0) return null
  const hasPen = strokes.some(inkStrokeIsPen)
  const hasMarker = strokes.some(inkStrokeIsMarker)
  if (hasPen && hasMarker) return 'mixed'
  if (hasPen) return 'pen'
  return 'marker'
}

/** True when every selected live command is a pen or marker stroke. */
export function isInkStrokeOnlySelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  deadIndices?: ReadonlySet<number>,
): boolean {
  if (selectedIds.length === 0) return false
  const selected = resolveSelectedCommands(commands, selectedIds, deadIndices)
  if (selected.length === 0) return false
  return selected.every((cmd) => isPenOrMarkerStroke(cmd))
}

export function isPenStrokeOnlySelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  deadIndices?: ReadonlySet<number>,
): boolean {
  if (selectedIds.length === 0) return false
  const selected = resolveSelectedCommands(commands, selectedIds, deadIndices)
  if (selected.length === 0) return false
  return selected.every((cmd) => cmd.kind === 'stroke' && cmd.tool === 'pen')
}

export function isMarkerStrokeOnlySelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  deadIndices?: ReadonlySet<number>,
): boolean {
  if (selectedIds.length === 0) return false
  const selected = resolveSelectedCommands(commands, selectedIds, deadIndices)
  if (selected.length === 0) return false
  return selected.every((cmd) => cmd.kind === 'stroke' && cmd.tool === 'marker')
}

export function commonImageStrokeColor(
  images: readonly ImageAnnotationCommand[],
): CommonValue<string> {
  return commonFieldOn(
    images,
    (cmd) => cmd.strokeColor ?? '#111827',
    (a, b) => a.toLowerCase() === b.toLowerCase(),
  )
}

export function commonImageWidthScale(images: readonly ImageAnnotationCommand[]): CommonValue<number> {
  return commonFieldOn(images, (cmd) => cmd.strokeWidthScale ?? 1, (a, b) => Math.abs(a - b) < 1e-6)
}

export function commonImageStrokeVisible(images: readonly ImageAnnotationCommand[]): CommonValue<boolean> {
  return commonFieldOn(images, (cmd) => cmd.strokeVisible === true)
}

export function commonImageLocked(images: readonly ImageAnnotationCommand[]): CommonValue<boolean> {
  return commonFieldOn(images, (cmd) => cmd.locked === true)
}

/** True when every selected live command is a pasted image. */
export function isImageOnlySelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  deadIndices?: ReadonlySet<number>,
): boolean {
  if (selectedIds.length === 0) return false
  const selected = resolveSelectedCommands(commands, selectedIds, deadIndices)
  if (selected.length === 0) return false
  return classifySelectionKinds(selected) === 'image'
}
