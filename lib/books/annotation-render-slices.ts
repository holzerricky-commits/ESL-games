import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { isMarkerStrokeCommand } from '@/lib/books/annotation-draw'

export type InkRenderSlice = {
  kind: 'ink'
  /** Command indices drawn on this slice's ink canvas (pen, shapes, stamps, etc.). */
  indices: number[]
  /** CSS z-index; matches first command index in paint order. */
  zIndex: number
}

export type MarkerRenderSlice = {
  kind: 'marker'
  /** One highlighter command per slice so multiply stacks at crossings between strokes. */
  indices: [number]
  zIndex: number
}

export type DomRenderSlice = {
  kind: 'dom'
  indices: number[]
  zIndex: number
}

export type AnnotationRenderSlice = InkRenderSlice | MarkerRenderSlice | DomRenderSlice

/** @deprecated Use InkRenderSlice; kept for callers migrating off combined canvas slices. */
export type CanvasRenderSlice = InkRenderSlice

function isDomCommand(cmd: AnnotationCommand): boolean {
  return cmd.kind === 'text' || cmd.kind === 'sticky'
}

/**
 * Split visible annotations into ink, marker, and DOM slices in `commands[]` order.
 * Each highlighter stroke gets its own multiply canvas so overlaps darken; a single
 * stroke stays one layer (self-crossings do not stack). Ink commands still batch per run.
 */
export function buildAnnotationRenderSlices(
  commands: readonly AnnotationCommand[],
  deadIndices: ReadonlySet<number>,
): AnnotationRenderSlice[] {
  const slices: AnnotationRenderSlice[] = []
  let inkIndices: number[] = []

  const flushInk = () => {
    if (inkIndices.length === 0) return
    slices.push({
      kind: 'ink',
      indices: inkIndices,
      zIndex: inkIndices[0]!,
    })
    inkIndices = []
  }

  for (let i = 0; i < commands.length; i++) {
    if (deadIndices.has(i)) continue
    const cmd = commands[i]!
    if (isDomCommand(cmd)) {
      flushInk()
      slices.push({ kind: 'dom', indices: [i], zIndex: i })
    } else if (isMarkerStrokeCommand(cmd)) {
      flushInk()
      slices.push({ kind: 'marker', indices: [i], zIndex: i })
    } else {
      inkIndices.push(i)
    }
  }
  flushInk()
  return slices
}

/** z-index for live draft preview (above all committed slices). */
export function draftOverlayZIndex(commandsLength: number): number {
  return commandsLength
}
