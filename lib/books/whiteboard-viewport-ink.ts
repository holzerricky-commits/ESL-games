import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

/** Maps pointer on the visible viewport to normalized coords on the full scrollable board. */
export type WhiteboardViewportInkConfig = {
  contentHeightPx: number
  viewportHeightPx: number
  scrollTopPx: number
}

export function isWhiteboardViewportInkActive(config: WhiteboardViewportInkConfig): boolean {
  return config.contentHeightPx > config.viewportHeightPx + 1
}

export function clientToWhiteboardDocumentNorm(
  config: WhiteboardViewportInkConfig,
  canvasRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
): [number, number] {
  const w = canvasRect.width
  const h = canvasRect.height
  if (!(w > 0) || !(h > 0) || !(config.viewportHeightPx > 0) || !(config.contentHeightPx > 0)) {
    return [0, 0]
  }
  const nx = (clientX - canvasRect.left) / w
  const nyViewport = (clientY - canvasRect.top) / h
  const yPx = config.scrollTopPx + nyViewport * config.viewportHeightPx
  const nyDoc = yPx / config.contentHeightPx
  return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, nyDoc))]
}

function mapDocumentYNormToViewportNorm(yDoc: number, config: WhiteboardViewportInkConfig): number {
  return (yDoc * config.contentHeightPx - config.scrollTopPx) / config.viewportHeightPx
}

function strokeIntersectsViewport(cmd: StrokeAnnotationCommand, config: WhiteboardViewportInkConfig): boolean {
  for (const [, y] of cmd.points) {
    const yv = mapDocumentYNormToViewportNorm(y, config)
    if (yv >= -0.02 && yv <= 1.02) return true
  }
  return false
}

function commandYBounds(cmd: AnnotationCommand): [number, number] | null {
  if (cmd.kind === 'stroke') {
    if (cmd.points.length === 0) return null
    const ys = cmd.points.map(([, y]) => y)
    return [Math.min(...ys), Math.max(...ys)]
  }
  if (cmd.kind === 'line') return [Math.min(cmd.a[1], cmd.b[1]), Math.max(cmd.a[1], cmd.b[1])]
  if (cmd.kind === 'arrow') return [Math.min(cmd.from[1], cmd.to[1]), Math.max(cmd.from[1], cmd.to[1])]
  if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') {
    return [Math.min(cmd.y, cmd.y + cmd.h), Math.max(cmd.y, cmd.y + cmd.h)]
  }
  return null
}

function commandIntersectsViewport(cmd: AnnotationCommand, config: WhiteboardViewportInkConfig): boolean {
  if (cmd.kind === 'stroke') return strokeIntersectsViewport(cmd, config)
  const bounds = commandYBounds(cmd)
  if (!bounds) return false
  const minY = mapDocumentYNormToViewportNorm(bounds[0], config)
  const maxY = mapDocumentYNormToViewportNorm(bounds[1], config)
  return Math.max(minY, maxY) >= -0.02 && Math.min(minY, maxY) <= 1.02
}

function projectStrokeCommand(
  cmd: StrokeAnnotationCommand,
  config: WhiteboardViewportInkConfig,
): StrokeAnnotationCommand {
  return {
    ...cmd,
    points: cmd.points.map(([x, y]) => [
      x,
      mapDocumentYNormToViewportNorm(y, config),
    ] as [number, number]),
  }
}

function projectCommandForWhiteboardViewport(
  cmd: AnnotationCommand,
  config: WhiteboardViewportInkConfig,
): AnnotationCommand | null {
  if (cmd.kind === 'stroke') return projectStrokeCommand(cmd, config)
  if (cmd.kind === 'line') {
    return {
      ...cmd,
      a: [cmd.a[0], mapDocumentYNormToViewportNorm(cmd.a[1], config)] as [number, number],
      b: [cmd.b[0], mapDocumentYNormToViewportNorm(cmd.b[1], config)] as [number, number],
    }
  }
  if (cmd.kind === 'arrow') {
    return {
      ...cmd,
      from: [cmd.from[0], mapDocumentYNormToViewportNorm(cmd.from[1], config)] as [number, number],
      to: [cmd.to[0], mapDocumentYNormToViewportNorm(cmd.to[1], config)] as [number, number],
    }
  }
  if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') {
    const top = mapDocumentYNormToViewportNorm(cmd.y, config)
    const bottom = mapDocumentYNormToViewportNorm(cmd.y + cmd.h, config)
    return {
      ...cmd,
      y: Math.min(top, bottom),
      h: Math.abs(bottom - top),
    }
  }
  return null
}

/** Project document-space session commands onto the visible viewport canvas for paint. */
export function projectCommandsForWhiteboardViewport(
  commands: readonly AnnotationCommand[],
  config: WhiteboardViewportInkConfig,
): AnnotationCommand[] {
  if (!isWhiteboardViewportInkActive(config)) return [...commands]
  const out: AnnotationCommand[] = []
  for (const cmd of commands) {
    if (!commandIntersectsViewport(cmd, config)) continue
    const projected = projectCommandForWhiteboardViewport(cmd, config)
    if (projected) out.push(projected)
  }
  return out
}

export function projectStrokeDraftForWhiteboardViewport(
  draft: StrokeAnnotationCommand | null,
  config: WhiteboardViewportInkConfig,
): StrokeAnnotationCommand | null {
  if (!draft || !isWhiteboardViewportInkActive(config)) return draft
  return projectStrokeCommand(draft, config)
}
