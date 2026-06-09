import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

/**
 * Maps pointer on the visible board window to normalized coords on the page document.
 * All dimensions are in the same pixel space as the mounted ink canvases (display pixels).
 */
export type WhiteboardViewportInkConfig = {
  contentHeightPx: number
  viewportHeightPx: number
  /** Used only for viewport projection (live draft on viewport-sized canvas). */
  scrollTopPx: number
}

export function isWhiteboardViewportInkActive(config: WhiteboardViewportInkConfig): boolean {
  return config.contentHeightPx > config.viewportHeightPx + 1
}

/**
 * Pointer → document norm using the tall content element's bounding rect.
 * The content rect moves with scroll, so scrollTop does not need to be added.
 */
export function clientToWhiteboardDocumentNormFromContent(
  config: WhiteboardViewportInkConfig,
  contentRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
): [number, number] {
  const w = contentRect.width
  const h = contentRect.height
  if (!(w > 0) || !(h > 0) || !(config.contentHeightPx > 0)) {
    return [0, 0]
  }
  const nx = (clientX - contentRect.left) / w
  const yPx = clientY - contentRect.top
  const paintHeightPx = h > 0 ? h : config.contentHeightPx
  const nyDoc = yPx / Math.max(1, paintHeightPx)
  return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, nyDoc))]
}

/** @deprecated Prefer clientToWhiteboardDocumentNormFromContent when a content ref is available. */
export function clientToWhiteboardDocumentNormFromScrollport(
  config: WhiteboardViewportInkConfig,
  scrollportRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width'>,
  clientX: number,
  clientY: number,
): [number, number] {
  const w = scrollportRect.width
  if (!(w > 0) || !(config.contentHeightPx > 0)) {
    return [0, 0]
  }
  const nx = (clientX - scrollportRect.left) / w
  const yPx = config.scrollTopPx + (clientY - scrollportRect.top)
  const nyDoc = yPx / config.contentHeightPx
  return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, nyDoc))]
}

/** Paint on a canvas as tall as the full runway (ink scrolls with content). */
export function isWhiteboardDocumentScrollPaint(
  config: WhiteboardViewportInkConfig,
  canvasHeightPx: number,
): boolean {
  if (!isWhiteboardViewportInkActive(config)) return false
  // Tall runway: paint in document space on a canvas taller than the visible window.
  if (canvasHeightPx > config.viewportHeightPx + 1) return true
  return canvasHeightPx >= config.contentHeightPx - 1
}

export function clientToWhiteboardDocumentNorm(
  config: WhiteboardViewportInkConfig,
  canvasRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
): [number, number] {
  if (isWhiteboardViewportInkActive(config)) {
    return clientToWhiteboardDocumentNormFromContent(config, canvasRect, clientX, clientY)
  }

  const w = canvasRect.width
  const h = canvasRect.height
  if (!(w > 0) || !(h > 0) || !(config.contentHeightPx > 0)) {
    return [0, 0]
  }
  const nx = (clientX - canvasRect.left) / w
  const ny = (clientY - canvasRect.top) / h
  return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))]
}

function mapDocumentYNormToViewportNorm(yDoc: number, config: WhiteboardViewportInkConfig): number {
  if (!(config.viewportHeightPx > 0)) return 0
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
