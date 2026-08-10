import type {
  AnnotationCommand,
  AnnotationLineDashStyle,
  ArrowAnnotationCommand,
  EllipseAnnotationCommand,
  ImageAnnotationCommand,
  LineAnnotationCommand,
  RectAnnotationCommand,
  ShapeFillMode,
  StickyAnnotationCommand,
  TextAnnotationCommand,
  TriangleAnnotationCommand,
  StrokeAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { shapeFillAlphaForMode } from '@/lib/books/annotation-command-types'
import { ANNOTATION_MARKER_SWATCHES } from '@/lib/books/annotation-palettes'
import { isFilledShapeCommand, isShapeSelectionCommand } from '@/lib/books/shape-selection'
import { isPenOrMarkerStroke } from '@/lib/books/annotation-connected-strokes'

function patchSelectedCommandsOfKind<K extends 'text' | 'sticky'>(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  kind: K,
  partial: K extends 'text' ? Partial<TextAnnotationCommand> : Partial<StickyAnnotationCommand>,
): AnnotationCommand[] {
  if (selectedIds.length === 0) return [...commands]
  const ids = new Set(selectedIds)
  let changed = false
  const next = commands.map((cmd) => {
    if (cmd.kind !== kind || !ids.has(cmd.id)) return cmd
    let cmdChanged = false
    const merged = { ...cmd }
    for (const [key, value] of Object.entries(partial)) {
      if (value === undefined) continue
      if ((merged as Record<string, unknown>)[key] !== value) {
        ;(merged as Record<string, unknown>)[key] = value
        cmdChanged = true
      }
    }
    if (!cmdChanged) return cmd
    changed = true
    return merged
  })
  if (!changed) return [...commands]
  return next
}

/** Patch `partial` onto every selected text command. Returns the original array reference when nothing changes. */
export function patchSelectedTextCommands(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  partial: Partial<TextAnnotationCommand>,
): AnnotationCommand[] {
  return patchSelectedCommandsOfKind(commands, selectedIds, 'text', partial)
}

/** Patch `partial` onto every selected sticky command. */
export function patchSelectedStickyCommands(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  partial: Partial<StickyAnnotationCommand>,
): AnnotationCommand[] {
  return patchSelectedCommandsOfKind(commands, selectedIds, 'sticky', partial)
}

export type ShapeSelectionPatch = {
  strokeColor?: string
  lineDashStyle?: AnnotationLineDashStyle
  strokeWidthScale?: number
  fillMode?: ShapeFillMode
  fillColor?: string
  strokeEnabled?: boolean
  locked?: boolean
}

function applyShapeLockPatch<T extends { locked?: boolean }>(
  cmd: T,
  patch: ShapeSelectionPatch,
): { next: T; changed: boolean } {
  if (patch.locked == null || (cmd.locked === true) === patch.locked) {
    return { next: cmd, changed: false }
  }
  return { next: { ...cmd, locked: patch.locked }, changed: true }
}

function patchLineLikeCommand(
  cmd: LineAnnotationCommand | ArrowAnnotationCommand,
  patch: ShapeSelectionPatch,
): LineAnnotationCommand | ArrowAnnotationCommand {
  let next = cmd
  let changed = false

  const lockPatch = applyShapeLockPatch(cmd, patch)
  if (lockPatch.changed) {
    next = lockPatch.next
    changed = true
  }
  if (patch.strokeColor != null && cmd.color !== patch.strokeColor) {
    next = { ...next, color: patch.strokeColor }
    changed = true
  }
  if (patch.strokeWidthScale != null && (cmd.widthScale ?? 1) !== patch.strokeWidthScale) {
    next = { ...next, widthScale: patch.strokeWidthScale }
    changed = true
  }
  if (patch.lineDashStyle != null && (cmd.lineDashStyle ?? 'solid') !== patch.lineDashStyle) {
    next = { ...next, lineDashStyle: patch.lineDashStyle }
    changed = true
  }

  return changed ? next : cmd
}

function patchFilledShapeCommand(
  cmd: RectAnnotationCommand | EllipseAnnotationCommand | TriangleAnnotationCommand,
  patch: ShapeSelectionPatch,
): RectAnnotationCommand | EllipseAnnotationCommand | TriangleAnnotationCommand {
  let next = { ...cmd }
  let changed = false

  const lockPatch = applyShapeLockPatch(cmd, patch)
  if (lockPatch.changed) {
    next = lockPatch.next
    changed = true
  }

  if (patch.strokeColor != null && cmd.strokeColor !== patch.strokeColor) {
    next.strokeColor = patch.strokeColor
    changed = true
  }
  if (patch.strokeWidthScale != null && (cmd.strokeWidthScale ?? 1) !== patch.strokeWidthScale) {
    next.strokeWidthScale = patch.strokeWidthScale
    changed = true
  }
  if (patch.lineDashStyle != null && (cmd.lineDashStyle ?? 'solid') !== patch.lineDashStyle) {
    next.lineDashStyle = patch.lineDashStyle
    changed = true
  }
  if (patch.strokeEnabled != null && (cmd.strokeVisible !== false) !== patch.strokeEnabled) {
    next.strokeVisible = patch.strokeEnabled
    changed = true
  }
  if (patch.fillColor != null && (cmd.fillColor ?? ANNOTATION_MARKER_SWATCHES[0]) !== patch.fillColor) {
    next.fillColor = patch.fillColor
    changed = true
  }
  if (patch.fillMode != null) {
    const alpha = shapeFillAlphaForMode(patch.fillMode)
    const fillOn = alpha != null
    const prevFillOn = cmd.fillVisible === true
    const prevAlpha = cmd.fillAlpha ?? 1
    const nextAlpha = alpha ?? prevAlpha
    if (fillOn !== prevFillOn || (fillOn && nextAlpha !== prevAlpha)) {
      next.fillVisible = fillOn
      if (fillOn) {
        next.fillAlpha = nextAlpha
        if (!next.fillColor) next.fillColor = cmd.fillColor ?? ANNOTATION_MARKER_SWATCHES[0]
      }
      changed = true
    }
  }

  if (!changed) return cmd
  return next
}

function patchShapeCommand(cmd: AnnotationCommand, patch: ShapeSelectionPatch): AnnotationCommand {
  if (!isShapeSelectionCommand(cmd)) return cmd
  if (cmd.kind === 'line' || cmd.kind === 'arrow') return patchLineLikeCommand(cmd, patch)
  if (isFilledShapeCommand(cmd)) return patchFilledShapeCommand(cmd, patch)
  return cmd
}

/** Patch style fields onto every selected shape command (line, arrow, rect, ellipse, triangle). */
export function patchSelectedShapeCommands(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  patch: ShapeSelectionPatch,
): AnnotationCommand[] {
  if (selectedIds.length === 0) return [...commands]
  const ids = new Set(selectedIds)
  let changed = false
  const next = commands.map((cmd) => {
    if (!ids.has(cmd.id) || !isShapeSelectionCommand(cmd)) return cmd
    const patched = patchShapeCommand(cmd, patch)
    if (patched !== cmd) changed = true
    return patched
  })
  if (!changed) return [...commands]
  return next
}

export type ImageSelectionPatch = {
  strokeColor?: string
  strokeWidthScale?: number
  strokeVisible?: boolean
  locked?: boolean
}

function patchImageCommand(
  cmd: ImageAnnotationCommand,
  patch: ImageSelectionPatch,
): ImageAnnotationCommand {
  let next = { ...cmd }
  let changed = false

  if (patch.strokeColor != null && cmd.strokeColor !== patch.strokeColor) {
    next.strokeColor = patch.strokeColor
    changed = true
  }
  if (patch.strokeWidthScale != null && (cmd.strokeWidthScale ?? 1) !== patch.strokeWidthScale) {
    next.strokeWidthScale = patch.strokeWidthScale
    changed = true
  }
  if (patch.strokeVisible != null && (cmd.strokeVisible === true) !== patch.strokeVisible) {
    next.strokeVisible = patch.strokeVisible
    changed = true
  }
  if (patch.locked != null && (cmd.locked === true) !== patch.locked) {
    next.locked = patch.locked
    changed = true
  }

  if (!changed) return cmd
  return next
}

/** Patch border / lock fields onto every selected image command. */
export function patchSelectedImageCommands(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  patch: ImageSelectionPatch,
): AnnotationCommand[] {
  if (selectedIds.length === 0) return [...commands]
  const ids = new Set(selectedIds)
  let changed = false
  const next = commands.map((cmd) => {
    if (cmd.kind !== 'image' || !ids.has(cmd.id)) return cmd
    const patched = patchImageCommand(cmd, patch)
    if (patched !== cmd) changed = true
    return patched
  })
  if (!changed) return [...commands]
  return next
}

export type InkStrokeSelectionPatch = {
  color?: string
  widthScale?: number
  lineDashStyle?: AnnotationLineDashStyle
  markerDecoratedEdge?: boolean
}

function patchInkStrokeCommand(
  cmd: StrokeAnnotationCommand,
  patch: InkStrokeSelectionPatch,
): StrokeAnnotationCommand {
  let next: StrokeAnnotationCommand = { ...cmd }
  let changed = false

  if (patch.color != null && (cmd.color ?? '#111827') !== patch.color) {
    const { penInkStyle: _removed, ...rest } = next
    next = { ...rest, color: patch.color }
    changed = true
  }
  if (patch.widthScale != null && (cmd.widthScale ?? 1) !== patch.widthScale) {
    next = { ...next, widthScale: patch.widthScale }
    changed = true
  }
  if (patch.lineDashStyle != null && (cmd.lineDashStyle ?? 'solid') !== patch.lineDashStyle) {
    next = { ...next, lineDashStyle: patch.lineDashStyle }
    changed = true
  }
  if (
    patch.markerDecoratedEdge != null &&
    cmd.tool === 'marker' &&
    (cmd.markerDecoratedEdge === true) !== patch.markerDecoratedEdge
  ) {
    next = { ...next, markerDecoratedEdge: patch.markerDecoratedEdge ? true : undefined }
    changed = true
  }

  if (!changed) return cmd
  return next
}

/** Patch style fields onto every selected pen/marker stroke. */
export function patchSelectedInkStrokeCommands(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  patch: InkStrokeSelectionPatch,
): AnnotationCommand[] {
  if (selectedIds.length === 0) return [...commands]
  const ids = new Set(selectedIds)
  let changed = false
  const next = commands.map((cmd) => {
    if (!ids.has(cmd.id) || !isPenOrMarkerStroke(cmd)) return cmd
    const patched = patchInkStrokeCommand(cmd, patch)
    if (patched !== cmd) changed = true
    return patched
  })
  if (!changed) return [...commands]
  return next
}

function sameCommandList(
  a: readonly AnnotationCommand[],
  b: readonly AnnotationCommand[],
): boolean {
  if (a.length !== b.length) return false
  return a.every((cmd, i) => cmd === b[i])
}

export function patchSelectedTextCommandsChanged(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  partial: Partial<TextAnnotationCommand>,
): boolean {
  const next = patchSelectedTextCommands(commands, selectedIds, partial)
  return !sameCommandList(commands, next)
}
