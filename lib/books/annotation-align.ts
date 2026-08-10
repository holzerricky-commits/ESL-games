import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  filterUnlockedTransformIds,
  getAnnotationBounds,
  translateAnnotationCommand,
  unionNormRects,
  type NormRect,
} from '@/lib/books/annotation-select'

/** Horizontal object-align axis relative to the selection bounding box. */
export type HorizontalAlignAxis = 'left' | 'center' | 'right'

const ALIGN_EPS = 1e-9

type BoundsEntry = { id: string; bounds: NormRect }

function collectTransformableBoundsEntries(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
): BoundsEntry[] {
  const transformable = filterUnlockedTransformIds(commands, selectedIds)
  const byId = new Map(commands.map((c) => [c.id, c]))
  const entries: BoundsEntry[] = []
  for (const id of transformable) {
    const cmd = byId.get(id)
    if (!cmd) continue
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    if (!bounds) continue
    entries.push({ id, bounds })
  }
  return entries
}

function horizontalAlignDelta(bounds: NormRect, union: NormRect, axis: HorizontalAlignAxis): number {
  switch (axis) {
    case 'left':
      return union.x - bounds.x
    case 'center':
      return union.x + union.w / 2 - (bounds.x + bounds.w / 2)
    case 'right':
      return union.x + union.w - (bounds.x + bounds.w)
  }
}

/**
 * Align selected commands horizontally to the union of their axis-aligned bounds.
 * Returns the original array when fewer than two transformable items move, or when already aligned.
 */
export function alignSelectedCommands(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  axis: HorizontalAlignAxis,
  widthPx: number,
  heightPx: number,
): AnnotationCommand[] {
  const transformable = filterUnlockedTransformIds(commands, selectedIds)
  if (transformable.length < 2) return commands as AnnotationCommand[]

  const idSet = new Set(transformable)
  const byId = new Map(commands.map((c) => [c.id, c]))
  const deltas = new Map<string, number>()

  const boundsList: NormRect[] = []
  for (const id of transformable) {
    const cmd = byId.get(id)
    if (!cmd) continue
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    if (!bounds) continue
    boundsList.push(bounds)
    deltas.set(id, 0)
  }

  if (boundsList.length < 2) return commands as AnnotationCommand[]

  const union = unionNormRects(boundsList)
  if (!union) return commands as AnnotationCommand[]

  let anyChange = false
  for (const id of transformable) {
    const cmd = byId.get(id)
    if (!cmd) continue
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    if (!bounds) continue
    const dx = horizontalAlignDelta(bounds, union, axis)
    if (Math.abs(dx) < ALIGN_EPS) continue
    anyChange = true
    deltas.set(id, dx)
  }

  if (!anyChange) return commands as AnnotationCommand[]

  return commands.map((cmd) => {
    const dx = deltas.get(cmd.id)
    if (dx == null || Math.abs(dx) < ALIGN_EPS) return cmd
    return translateAnnotationCommand(cmd, dx, 0)
  })
}

/**
 * Distribute vertical spacing evenly between selected items.
 * Top edge of the topmost item and bottom edge of the bottommost item stay fixed.
 * Requires three or more transformable items.
 */
export function distributeVerticalSpacingSelectedCommands(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
): AnnotationCommand[] {
  const entries = collectTransformableBoundsEntries(commands, selectedIds, widthPx, heightPx)
  if (entries.length < 3) return commands as AnnotationCommand[]

  const sorted = [...entries].sort((a, b) => {
    const dy = a.bounds.y - b.bounds.y
    if (Math.abs(dy) > ALIGN_EPS) return dy
    return a.bounds.x - b.bounds.x
  })

  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const spanTop = first.bounds.y
  const spanBottom = last.bounds.y + last.bounds.h
  const totalHeight = sorted.reduce((sum, entry) => sum + entry.bounds.h, 0)
  const gap = (spanBottom - spanTop - totalHeight) / (sorted.length - 1)
  if (gap < -ALIGN_EPS) return commands as AnnotationCommand[]

  const dyById = new Map<string, number>()
  let anyChange = false
  let targetY = spanTop

  for (const entry of sorted) {
    const dy = targetY - entry.bounds.y
    if (Math.abs(dy) >= ALIGN_EPS) {
      anyChange = true
      dyById.set(entry.id, dy)
    }
    targetY += entry.bounds.h + gap
  }

  if (!anyChange) return commands as AnnotationCommand[]

  return commands.map((cmd) => {
    const dy = dyById.get(cmd.id)
    if (dy == null || Math.abs(dy) < ALIGN_EPS) return cmd
    return translateAnnotationCommand(cmd, 0, dy)
  })
}
