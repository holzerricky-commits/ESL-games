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

/** Project document-space session commands onto the visible viewport canvas for paint. */
export function projectCommandsForWhiteboardViewport(
  commands: readonly AnnotationCommand[],
  config: WhiteboardViewportInkConfig,
): AnnotationCommand[] {
  if (!isWhiteboardViewportInkActive(config)) return [...commands]
  const out: AnnotationCommand[] = []
  for (const cmd of commands) {
    if (cmd.kind !== 'stroke') {
      continue
    }
    if (!strokeIntersectsViewport(cmd, config)) continue
    out.push(projectStrokeCommand(cmd, config))
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
