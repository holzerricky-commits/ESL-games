import type {
  AnnotationCommand,
  AnnotationLineDashStyle,
  ShapeFillMode,
  StrokeAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import type { ShapeCommitOptions, TwoPointShapeKind } from '@/lib/books/spread-command-split'
import { splitTwoPointShapeCommandsViaClientRects } from '@/lib/books/spread-command-split'
import {
  splitSpreadNormPolylineViaClientRects,
  spreadNormPointToPageNorm,
  type PageRect,
  type SpreadInkLayout,
} from '@/lib/books/spread-stroke-split'

function strokeInkFields(cmd: StrokeAnnotationCommand): Omit<StrokeAnnotationCommand, 'kind' | 'id' | 'tool' | 'points'> {
  return {
    ...(cmd.widthScale != null ? { widthScale: cmd.widthScale } : {}),
    ...(cmd.color ? { color: cmd.color } : {}),
    ...(cmd.lineDashStyle ? { lineDashStyle: cmd.lineDashStyle } : {}),
    ...(cmd.penInkStyle ? { penInkStyle: cmd.penInkStyle } : {}),
    ...(cmd.penStrokeProfile ? { penStrokeProfile: cmd.penStrokeProfile } : {}),
    ...(cmd.penInkPatternPhaseX != null ? { penInkPatternPhaseX: cmd.penInkPatternPhaseX } : {}),
    ...(cmd.penInkPatternPhaseY != null ? { penInkPatternPhaseY: cmd.penInkPatternPhaseY } : {}),
    ...(cmd.markerDecoratedEdge ? { markerDecoratedEdge: true } : {}),
    ...(cmd.figureGroupId ? { figureGroupId: cmd.figureGroupId } : {}),
    ...(cmd.committedAtMs != null ? { committedAtMs: cmd.committedAtMs } : {}),
    ...(cmd.figureAutoJoinClosed ? { figureAutoJoinClosed: true } : {}),
    ...(cmd.rotationBounds ? { rotationBounds: cmd.rotationBounds } : {}),
    ...(cmd.rotationDeg != null ? { rotationDeg: cmd.rotationDeg } : {}),
  }
}

function shapeFillModeForCommand(cmd: Extract<AnnotationCommand, { kind: 'rect' | 'ellipse' | 'triangle' }>): ShapeFillMode {
  if (!cmd.fillVisible) return 'none'
  return (cmd.fillAlpha ?? 1) < 1 ? 'transparent' : 'solid'
}

function lineDash(lineDashStyle: AnnotationLineDashStyle | undefined): AnnotationLineDashStyle {
  return lineDashStyle ?? 'solid'
}

type SpreadSide = 'left' | 'right'

function ownerSideForCommand(cmd: AnnotationCommand, seamNormX: number): SpreadSide {
  if (cmd.kind === 'stroke') {
    const p = cmd.points[0]
    return (p?.[0] ?? 0) <= seamNormX ? 'left' : 'right'
  }
  if (cmd.kind === 'line') return cmd.a[0] <= seamNormX ? 'left' : 'right'
  if (cmd.kind === 'arrow') return cmd.from[0] <= seamNormX ? 'left' : 'right'
  if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') return cmd.x <= seamNormX ? 'left' : 'right'
  if (cmd.kind === 'stamp' || cmd.kind === 'callout') return cmd.center[0] <= seamNormX ? 'left' : 'right'
  if (cmd.kind === 'text' || cmd.kind === 'sticky') return cmd.x <= seamNormX ? 'left' : 'right'
  return 'left'
}

function pageNormWidthToSpreadNorm(widthNorm: number, layout: SpreadInkLayout): number {
  if (!(layout.spreadOverlayWidthPx > 0)) return widthNorm
  return widthNorm * (layout.spreadPageWidthPx / layout.spreadOverlayWidthPx)
}

function spreadNormWidthToPageNorm(widthNorm: number, layout: SpreadInkLayout): number {
  if (!(layout.spreadPageWidthPx > 0)) return widthNorm
  return widthNorm * (layout.spreadOverlayWidthPx / layout.spreadPageWidthPx)
}

function mapSpreadPointToOwnerPage(
  p: [number, number],
  side: SpreadSide,
  layout: SpreadInkLayout,
): [number, number] {
  return spreadNormPointToPageNorm(
    p[0],
    p[1],
    side === 'left' ? layout.leftPageOriginXPx : layout.rightPageOriginXPx,
    layout.spreadPageWidthPx,
    layout.spreadOverlayWidthPx,
  )
}

function pageNormPointToSpreadNorm(
  p: [number, number],
  side: SpreadSide,
  layout: SpreadInkLayout,
): [number, number] {
  if (!(layout.spreadPageWidthPx > 0) || !(layout.spreadOverlayWidthPx > 0)) return [0, 0]
  const pageOrigin = side === 'left' ? layout.leftPageOriginXPx : layout.rightPageOriginXPx
  const spreadX = pageOrigin + p[0] * layout.spreadPageWidthPx
  return [Math.max(0, Math.min(1, spreadX / layout.spreadOverlayWidthPx)), Math.max(0, Math.min(1, p[1]))]
}

function mapCommandSpreadToOwnerPage(
  cmd: AnnotationCommand,
  side: SpreadSide,
  layout: SpreadInkLayout,
): AnnotationCommand {
  if (cmd.kind === 'stroke') {
    let rotationBounds = cmd.rotationBounds
    if (rotationBounds) {
      const tl = mapSpreadPointToOwnerPage([rotationBounds.x, rotationBounds.y], side, layout)
      const br = mapSpreadPointToOwnerPage(
        [rotationBounds.x + rotationBounds.w, rotationBounds.y + rotationBounds.h],
        side,
        layout,
      )
      rotationBounds = {
        x: Math.min(tl[0], br[0]),
        y: Math.min(tl[1], br[1]),
        w: Math.abs(br[0] - tl[0]),
        h: Math.abs(br[1] - tl[1]),
      }
    }
    return {
      ...cmd,
      points: cmd.points.map((p) => mapSpreadPointToOwnerPage(p, side, layout)),
      ...(rotationBounds ? { rotationBounds } : {}),
    }
  }
  if (cmd.kind === 'line') {
    return {
      ...cmd,
      a: mapSpreadPointToOwnerPage(cmd.a, side, layout),
      b: mapSpreadPointToOwnerPage(cmd.b, side, layout),
    }
  }
  if (cmd.kind === 'arrow') {
    return {
      ...cmd,
      from: mapSpreadPointToOwnerPage(cmd.from, side, layout),
      to: mapSpreadPointToOwnerPage(cmd.to, side, layout),
    }
  }
  if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') {
    const tl = mapSpreadPointToOwnerPage([cmd.x, cmd.y], side, layout)
    const br = mapSpreadPointToOwnerPage([cmd.x + cmd.w, cmd.y + cmd.h], side, layout)
    return {
      ...cmd,
      x: Math.min(tl[0], br[0]),
      y: Math.min(tl[1], br[1]),
      w: Math.abs(br[0] - tl[0]),
      h: Math.abs(br[1] - tl[1]),
    }
  }
  if (cmd.kind === 'stamp' || cmd.kind === 'callout') {
    return {
      ...cmd,
      center: mapSpreadPointToOwnerPage(cmd.center, side, layout),
    }
  }
  if (cmd.kind === 'text') {
    const pos = mapSpreadPointToOwnerPage([cmd.x, cmd.y], side, layout)
    return {
      ...cmd,
      x: pos[0],
      y: pos[1],
      ...(cmd.maxWidthNorm != null
        ? { maxWidthNorm: spreadNormWidthToPageNorm(cmd.maxWidthNorm, layout) }
        : {}),
    }
  }
  if (cmd.kind === 'sticky') {
    const tl = mapSpreadPointToOwnerPage([cmd.x, cmd.y], side, layout)
    const br = mapSpreadPointToOwnerPage([cmd.x + cmd.w, cmd.y + cmd.h], side, layout)
    return {
      ...cmd,
      x: Math.min(tl[0], br[0]),
      y: Math.min(tl[1], br[1]),
      w: Math.abs(br[0] - tl[0]),
      h: Math.abs(br[1] - tl[1]),
    }
  }
  return cmd
}

export function mapCommandPageToSpread(
  cmd: AnnotationCommand,
  side: SpreadSide,
  layout: SpreadInkLayout,
): AnnotationCommand {
  if (cmd.kind === 'stroke') {
    return {
      ...cmd,
      points: cmd.points.map((p) => pageNormPointToSpreadNorm(p, side, layout)),
    }
  }
  if (cmd.kind === 'line') {
    return {
      ...cmd,
      a: pageNormPointToSpreadNorm(cmd.a, side, layout),
      b: pageNormPointToSpreadNorm(cmd.b, side, layout),
    }
  }
  if (cmd.kind === 'arrow') {
    return {
      ...cmd,
      from: pageNormPointToSpreadNorm(cmd.from, side, layout),
      to: pageNormPointToSpreadNorm(cmd.to, side, layout),
    }
  }
  if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') {
    const tl = pageNormPointToSpreadNorm([cmd.x, cmd.y], side, layout)
    const br = pageNormPointToSpreadNorm([cmd.x + cmd.w, cmd.y + cmd.h], side, layout)
    return {
      ...cmd,
      x: Math.min(tl[0], br[0]),
      y: Math.min(tl[1], br[1]),
      w: Math.abs(br[0] - tl[0]),
      h: Math.abs(br[1] - tl[1]),
    }
  }
  if (cmd.kind === 'stamp' || cmd.kind === 'callout') {
    return {
      ...cmd,
      center: pageNormPointToSpreadNorm(cmd.center, side, layout),
    }
  }
  if (cmd.kind === 'text') {
    const pos = pageNormPointToSpreadNorm([cmd.x, cmd.y], side, layout)
    return {
      ...cmd,
      x: pos[0],
      y: pos[1],
      ...(cmd.maxWidthNorm != null
        ? { maxWidthNorm: pageNormWidthToSpreadNorm(cmd.maxWidthNorm, layout) }
        : {}),
    }
  }
  if (cmd.kind === 'sticky') {
    const tl = pageNormPointToSpreadNorm([cmd.x, cmd.y], side, layout)
    const br = pageNormPointToSpreadNorm([cmd.x + cmd.w, cmd.y + cmd.h], side, layout)
    return {
      ...cmd,
      x: Math.min(tl[0], br[0]),
      y: Math.min(tl[1], br[1]),
      w: Math.abs(br[0] - tl[0]),
      h: Math.abs(br[1] - tl[1]),
    }
  }
  return cmd
}

function isPageOwnedSpreadCommand(cmd: AnnotationCommand): boolean {
  return (
    cmd.kind === 'stamp' ||
    cmd.kind === 'callout' ||
    cmd.kind === 'text' ||
    cmd.kind === 'sticky'
  )
}

/** Page-owned items merged into spread session with correct spread coords. */
export function mergeSpreadSessionPageOwnedFromOwnerPages(
  sessionCommands: readonly AnnotationCommand[],
  leftCommands: readonly AnnotationCommand[],
  rightCommands: readonly AnnotationCommand[],
  layout: SpreadInkLayout,
): AnnotationCommand[] {
  const sessionIds = new Set(sessionCommands.map((c) => c.id))
  const pageOwnedLeft = leftCommands.filter(isPageOwnedSpreadCommand)
  const pageOwnedRight = rightCommands.filter(isPageOwnedSpreadCommand)
  const mapped = hydrateSpreadSessionFromOwnerPages(pageOwnedLeft, pageOwnedRight, layout)
    .filter((cmd) => !sessionIds.has(cmd.id))
  return [...sessionCommands, ...mapped]
}

/** @deprecated Use mergeSpreadSessionPageOwnedFromOwnerPages */
export function mergeSpreadSessionStampCalloutsFromOwnerPages(
  sessionCommands: readonly AnnotationCommand[],
  leftCommands: readonly AnnotationCommand[],
  rightCommands: readonly AnnotationCommand[],
  layout: SpreadInkLayout,
): AnnotationCommand[] {
  return mergeSpreadSessionPageOwnedFromOwnerPages(
    sessionCommands,
    leftCommands,
    rightCommands,
    layout,
  )
}

export function projectSpreadSessionToOwnerPages(
  commands: readonly AnnotationCommand[],
  layout: SpreadInkLayout,
): { left: AnnotationCommand[]; right: AnnotationCommand[] } {
  const left: AnnotationCommand[] = []
  const right: AnnotationCommand[] = []
  for (const cmd of commands) {
    const side = ownerSideForCommand(cmd, layout.seamNormX)
    const mapped = mapCommandSpreadToOwnerPage(cmd, side, layout)
    if (side === 'left') left.push(mapped)
    else right.push(mapped)
  }
  return { left, right }
}

export function hydrateSpreadSessionFromOwnerPages(
  leftCommands: readonly AnnotationCommand[],
  rightCommands: readonly AnnotationCommand[],
  layout: SpreadInkLayout,
): AnnotationCommand[] {
  const out = new Map<string, AnnotationCommand>()
  for (const cmd of leftCommands) {
    const mapped = mapCommandPageToSpread(cmd, 'left', layout)
    if (!out.has(mapped.id)) out.set(mapped.id, mapped)
  }
  for (const cmd of rightCommands) {
    const mapped = mapCommandPageToSpread(cmd, 'right', layout)
    if (!out.has(mapped.id)) out.set(mapped.id, mapped)
  }
  return [...out.values()]
}

export function splitSpreadSessionCommandsViaClientRects(
  commands: readonly AnnotationCommand[],
  spreadRect: PageRect,
  leftRect: PageRect,
  rightRect: PageRect,
): { left: AnnotationCommand[]; right: AnnotationCommand[] } {
  const left: AnnotationCommand[] = []
  const right: AnnotationCommand[] = []

  for (const cmd of commands) {
    if (cmd.kind === 'stroke') {
      const { leftNorm, rightNorm } = splitSpreadNormPolylineViaClientRects(cmd.points, spreadRect, leftRect, rightRect)
      for (const chain of leftNorm) {
        if (chain.length < 2) continue
        left.push({
          kind: 'stroke',
          id: cmd.id,
          tool: cmd.tool,
          points: chain,
          ...strokeInkFields(cmd),
        })
      }
      for (const chain of rightNorm) {
        if (chain.length < 2) continue
        right.push({
          kind: 'stroke',
          id: cmd.id,
          tool: cmd.tool,
          points: chain,
          ...strokeInkFields(cmd),
        })
      }
      continue
    }

    let kind: TwoPointShapeKind | null = null
    let anchor: [number, number] | null = null
    let current: [number, number] | null = null
    let options: ShapeCommitOptions | null = null

    if (cmd.kind === 'line') {
      kind = 'line'
      anchor = cmd.a
      current = cmd.b
      options = {
        shapeColor: cmd.color,
        shapeStrokeWidthScale: cmd.widthScale ?? 1,
        shapeLineDashStyle: lineDash(cmd.lineDashStyle),
        shapeStrokeEnabled: true,
        shapeFillMode: 'none',
        shapeFillColor: cmd.color,
      }
    } else if (cmd.kind === 'arrow') {
      kind = 'arrow'
      anchor = cmd.from
      current = cmd.to
      options = {
        shapeColor: cmd.color,
        shapeStrokeWidthScale: cmd.widthScale ?? 1,
        shapeLineDashStyle: lineDash(cmd.lineDashStyle),
        shapeStrokeEnabled: true,
        shapeFillMode: 'none',
        shapeFillColor: cmd.color,
      }
    } else if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') {
      kind = cmd.kind
      anchor = [cmd.x, cmd.y]
      current = [cmd.x + cmd.w, cmd.y + cmd.h]
      options = {
        shapeColor: cmd.strokeColor,
        shapeStrokeWidthScale: cmd.strokeWidthScale ?? 1,
        shapeLineDashStyle: lineDash(cmd.lineDashStyle),
        shapeStrokeEnabled: cmd.strokeVisible ?? true,
        shapeFillMode: shapeFillModeForCommand(cmd),
        shapeFillColor: cmd.fillColor ?? cmd.strokeColor,
      }
    }

    if (!kind || !anchor || !current || !options) continue

    const split = splitTwoPointShapeCommandsViaClientRects(
      kind,
      anchor,
      current,
      spreadRect,
      leftRect,
      rightRect,
      options,
    )
    if (split.left) {
      split.left.id = cmd.id
      left.push(split.left)
    }
    if (split.right) {
      split.right.id = cmd.id
      right.push(split.right)
    }
  }

  return { left, right }
}
