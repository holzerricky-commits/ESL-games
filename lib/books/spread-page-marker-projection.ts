import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { isMarkerStrokeCommand } from '@/lib/books/annotation-draw'
import {
  clientPointToPageNorm,
  seamClientX,
  spreadNormPointToPageNorm,
  splitSpreadNormPolylineToPageNormalizedChains,
  splitSpreadNormPolylineViaClientRects,
  type PageRect,
  type SpreadInkLayout,
} from '@/lib/books/spread-stroke-split'

function strokeFields(cmd: StrokeAnnotationCommand): Omit<StrokeAnnotationCommand, 'kind' | 'id' | 'tool' | 'points'> {
  return {
    ...(cmd.widthScale != null ? { widthScale: cmd.widthScale } : {}),
    ...(cmd.color ? { color: cmd.color } : {}),
    ...(cmd.lineDashStyle ? { lineDashStyle: cmd.lineDashStyle } : {}),
    ...(cmd.markerDecoratedEdge ? { markerDecoratedEdge: true } : {}),
  }
}

function chainsForSide(
  spreadPoints: readonly (readonly [number, number])[],
  side: 'left' | 'right',
  layout: SpreadInkLayout,
  clientRects?: { spread: PageRect; left: PageRect; right: PageRect },
): [number, number][][] {
  if (clientRects) {
    const { leftNorm, rightNorm } = splitSpreadNormPolylineViaClientRects(
      spreadPoints,
      clientRects.spread,
      clientRects.left,
      clientRects.right,
    )
    return side === 'left' ? leftNorm : rightNorm
  }
  const { leftNorm, rightNorm } = splitSpreadNormPolylineToPageNormalizedChains(spreadPoints, layout)
  return side === 'left' ? leftNorm : rightNorm
}

/** Map spread-session highlighter strokes to one page's normalized chains (for multiply on the PDF). */
export function projectSpreadMarkerCommandsToPage(
  commands: readonly AnnotationCommand[],
  side: 'left' | 'right',
  layout: SpreadInkLayout,
  clientRects?: { spread: PageRect; left: PageRect; right: PageRect },
): StrokeAnnotationCommand[] {
  const out: StrokeAnnotationCommand[] = []
  for (const cmd of commands) {
    if (!isMarkerStrokeCommand(cmd) || cmd.kind !== 'stroke') continue
    const chains = chainsForSide(cmd.points, side, layout, clientRects)
    chains.forEach((chain, chainIndex) => {
      if (chain.length < 1) return
      out.push({
        kind: 'stroke',
        id: chains.length > 1 ? `${cmd.id}__${side}_${chainIndex}` : cmd.id,
        tool: 'marker',
        points: chain.map((p) => [p[0], p[1]] as [number, number]),
        ...strokeFields(cmd),
      })
    })
  }
  return out
}

function singleSpreadPointOnPage(
  spreadPoint: readonly [number, number],
  side: 'left' | 'right',
  layout: SpreadInkLayout,
  clientRects?: { spread: PageRect; left: PageRect; right: PageRect },
): [number, number] | null {
  const [spreadNx, spreadNy] = spreadPoint
  if (clientRects) {
    const { spread, left, right } = clientRects
    if (!(spread.width > 0) || !(spread.height > 0)) return null
    const cx = spread.left + spreadNx * spread.width
    const cy = spread.top + spreadNy * spread.height
    const seam = seamClientX(left, right)
    if (side === 'left' && cx <= seam + 1e-6) return clientPointToPageNorm(left, cx, cy)
    if (side === 'right' && cx >= seam - 1e-6) return clientPointToPageNorm(right, cx, cy)
    return null
  }
  const seam = layout.seamNormX
  if (side === 'left' && spreadNx <= seam + 1e-6) {
    return spreadNormPointToPageNorm(
      spreadNx,
      spreadNy,
      layout.leftPageOriginXPx,
      layout.spreadPageWidthPx,
      layout.spreadOverlayWidthPx,
    )
  }
  if (side === 'right' && spreadNx >= seam - 1e-6) {
    return spreadNormPointToPageNorm(
      spreadNx,
      spreadNy,
      layout.rightPageOriginXPx,
      layout.spreadPageWidthPx,
      layout.spreadOverlayWidthPx,
    )
  }
  return null
}

export function projectSpreadMarkerDraftToPage(
  spreadPoints: readonly (readonly [number, number])[],
  side: 'left' | 'right',
  layout: SpreadInkLayout,
  clientRects?: { spread: PageRect; left: PageRect; right: PageRect },
): [number, number][] | null {
  const chains = chainsForSide(spreadPoints, side, layout, clientRects)
  const best = chains.reduce<[number, number][] | null>(
    (acc, chain) => (chain.length > (acc?.length ?? 0) ? chain : acc),
    null,
  )
  if (best && best.length >= 1) return best
  if (spreadPoints.length === 1) {
    const p = singleSpreadPointOnPage(spreadPoints[0]!, side, layout, clientRects)
    return p ? [p] : null
  }
  return null
}
