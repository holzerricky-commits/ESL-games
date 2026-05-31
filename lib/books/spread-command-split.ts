/** Split two-point spread gestures into per-page annotation commands at the seam. */

import type {
  AnnotationCommand,
  AnnotationLineDashStyle,
  ArrowAnnotationCommand,
  EllipseAnnotationCommand,
  LineAnnotationCommand,
  RectAnnotationCommand,
  ShapeFillMode,
  TriangleAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { shapeFillAlphaForMode } from '@/lib/books/annotation-command-types'
import {
  clientPointToPageNorm,
  seamClientX,
  intersectSegmentWithVerticalLine,
  firstSeamSplitChain,
  splitPolylineAtVerticalSeam,
  splitSpreadNormPolylineAtSeam,
  spreadNormPointToPageNorm,
  type PageRect,
  type SpreadInkLayout,
} from '@/lib/books/spread-stroke-split'

export type TwoPointShapeKind = 'line' | 'rect' | 'ellipse' | 'triangle' | 'arrow'

export const SPREAD_TWO_POINT_EPS = 0.004

export type ShapeCommitOptions = {
  shapeColor: string
  shapeStrokeWidthScale: number
  shapeLineDashStyle: AnnotationLineDashStyle
  shapeStrokeEnabled: boolean
  shapeFillMode: ShapeFillMode
  shapeFillColor: string
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

function normalizeSpreadRect(a: [number, number], b: [number, number]) {
  const x0 = clamp01(Math.min(a[0], b[0]))
  const y0 = clamp01(Math.min(a[1], b[1]))
  const x1 = clamp01(Math.max(a[0], b[0]))
  const y1 = clamp01(Math.max(a[1], b[1]))
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

function pageOriginForSide(layout: SpreadInkLayout, side: 'left' | 'right'): number {
  return side === 'left' ? layout.leftPageOriginXPx : layout.rightPageOriginXPx
}

function spreadPointToPage(side: 'left' | 'right', nx: number, ny: number, layout: SpreadInkLayout): [number, number] {
  return spreadNormPointToPageNorm(
    nx,
    ny,
    pageOriginForSide(layout, side),
    layout.spreadPageWidthPx,
    layout.spreadOverlayWidthPx,
  )
}

function spreadRectToPageNorm(
  spreadRect: { x: number; y: number; w: number; h: number },
  side: 'left' | 'right',
  layout: SpreadInkLayout,
): { x: number; y: number; w: number; h: number } | null {
  const x1 = spreadRect.x + spreadRect.w
  const y1 = spreadRect.y + spreadRect.h
  const tl = spreadPointToPage(side, spreadRect.x, spreadRect.y, layout)
  const br = spreadPointToPage(side, x1, y1, layout)
  const x0 = Math.min(tl[0], br[0])
  const y0 = Math.min(tl[1], br[1])
  const xMax = Math.max(tl[0], br[0])
  const yMax = Math.max(tl[1], br[1])
  const w = xMax - x0
  const h = yMax - y0
  if (w < SPREAD_TWO_POINT_EPS || h < SPREAD_TWO_POINT_EPS) return null
  return { x: x0, y: y0, w, h }
}

function clipSpreadRectAtSeam(
  spreadRect: { x: number; y: number; w: number; h: number },
  seamNormX: number,
): { left: { x: number; y: number; w: number; h: number } | null; right: { x: number; y: number; w: number; h: number } | null } {
  const x1 = spreadRect.x + spreadRect.w
  if (x1 <= seamNormX + 1e-9) {
    return { left: spreadRect, right: null }
  }
  if (spreadRect.x >= seamNormX - 1e-9) {
    return { left: null, right: spreadRect }
  }
  const leftW = Math.max(0, seamNormX - spreadRect.x)
  const rightX = seamNormX
  const rightW = Math.max(0, x1 - seamNormX)
  const left = leftW >= SPREAD_TWO_POINT_EPS ? { ...spreadRect, w: leftW } : null
  const right = rightW >= SPREAD_TWO_POINT_EPS ? { ...spreadRect, x: rightX, w: rightW } : null
  return { left, right }
}

function lineOrArrowFromSpreadSegment(
  kind: 'line' | 'arrow',
  anchor: [number, number],
  current: [number, number],
  layout: SpreadInkLayout,
  options: ShapeCommitOptions,
): { left: AnnotationCommand | null; right: AnnotationCommand | null } {
  const { left: leftChains, right: rightChains } = splitSpreadNormPolylineAtSeam(
    [anchor, current],
    layout.seamNormX,
  )
  const leftPts = firstSeamSplitChain(leftChains)
  const rightPts = firstSeamSplitChain(rightChains)
  let leftCmd: AnnotationCommand | null = null
  let rightCmd: AnnotationCommand | null = null

  if (leftPts.length >= 2) {
    const a = spreadPointToPage('left', leftPts[0]![0], leftPts[0]![1], layout)
    const b = spreadPointToPage('left', leftPts[leftPts.length - 1]![0], leftPts[leftPts.length - 1]![1], layout)
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= SPREAD_TWO_POINT_EPS) {
      const id = newAnnotationId()
      leftCmd =
        kind === 'line'
          ? ({
              kind: 'line',
              id,
              a,
              b,
              color: options.shapeColor,
              widthScale: options.shapeStrokeWidthScale,
              lineDashStyle: options.shapeLineDashStyle,
            } satisfies LineAnnotationCommand)
          : ({
              kind: 'arrow',
              id,
              from: a,
              to: b,
              color: options.shapeColor,
              widthScale: options.shapeStrokeWidthScale,
              lineDashStyle: options.shapeLineDashStyle,
            } satisfies ArrowAnnotationCommand)
    }
  }

  if (rightPts.length >= 2) {
    const a = spreadPointToPage('right', rightPts[0]![0], rightPts[0]![1], layout)
    const b = spreadPointToPage('right', rightPts[rightPts.length - 1]![0], rightPts[rightPts.length - 1]![1], layout)
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= SPREAD_TWO_POINT_EPS) {
      const id = newAnnotationId()
      rightCmd =
        kind === 'line'
          ? ({
              kind: 'line',
              id,
              a,
              b,
              color: options.shapeColor,
              widthScale: options.shapeStrokeWidthScale,
              lineDashStyle: options.shapeLineDashStyle,
            } satisfies LineAnnotationCommand)
          : ({
              kind: 'arrow',
              id,
              from: a,
              to: b,
              color: options.shapeColor,
              widthScale: options.shapeStrokeWidthScale,
              lineDashStyle: options.shapeLineDashStyle,
            } satisfies ArrowAnnotationCommand)
    }
  }

  return { left: leftCmd, right: rightCmd }
}

function boxCommandFromPageRect(
  kind: 'rect' | 'ellipse' | 'triangle',
  pageRect: { x: number; y: number; w: number; h: number },
  options: ShapeCommitOptions,
): AnnotationCommand {
  const id = newAnnotationId()
  let strokeOn = options.shapeStrokeEnabled
  const fillAlpha = shapeFillAlphaForMode(options.shapeFillMode)
  let fillOn = fillAlpha != null
  if (!strokeOn && !fillOn) strokeOn = true
  const base = {
    id,
    x: pageRect.x,
    y: pageRect.y,
    w: pageRect.w,
    h: pageRect.h,
    strokeColor: options.shapeColor,
    strokeWidthScale: options.shapeStrokeWidthScale,
    strokeVisible: strokeOn,
    fillVisible: fillOn,
    lineDashStyle: options.shapeLineDashStyle,
    ...(fillOn && fillAlpha != null ? { fillColor: options.shapeFillColor, fillAlpha } : {}),
  }
  if (kind === 'rect') return { kind: 'rect', ...base } satisfies RectAnnotationCommand
  if (kind === 'ellipse') return { kind: 'ellipse', ...base } satisfies EllipseAnnotationCommand
  return { kind: 'triangle', ...base } satisfies TriangleAnnotationCommand
}

function boxShapeFromSpreadRect(
  kind: 'rect' | 'ellipse' | 'triangle',
  anchor: [number, number],
  current: [number, number],
  layout: SpreadInkLayout,
  options: ShapeCommitOptions,
): { left: AnnotationCommand | null; right: AnnotationCommand | null } {
  const spreadRect = normalizeSpreadRect(anchor, current)
  if (spreadRect.w < SPREAD_TWO_POINT_EPS || spreadRect.h < SPREAD_TWO_POINT_EPS) {
    return { left: null, right: null }
  }
  const { left: leftSpread, right: rightSpread } = clipSpreadRectAtSeam(spreadRect, layout.seamNormX)
  let leftCmd: AnnotationCommand | null = null
  let rightCmd: AnnotationCommand | null = null
  if (leftSpread) {
    const pageRect = spreadRectToPageNorm(leftSpread, 'left', layout)
    if (pageRect) leftCmd = boxCommandFromPageRect(kind, pageRect, options)
  }
  if (rightSpread) {
    const pageRect = spreadRectToPageNorm(rightSpread, 'right', layout)
    if (pageRect) rightCmd = boxCommandFromPageRect(kind, pageRect, options)
  }
  return { left: leftCmd, right: rightCmd }
}

function linkSplitPairIds(
  pair: { left: AnnotationCommand | null; right: AnnotationCommand | null },
): { left: AnnotationCommand | null; right: AnnotationCommand | null } {
  if (!pair.left || !pair.right) return pair
  const sharedId = newAnnotationId()
  pair.left.id = sharedId
  pair.right.id = sharedId
  return pair
}

/** Split a spread-normalized two-point gesture into page-local commands. */
export function splitTwoPointShapeCommands(
  kind: TwoPointShapeKind,
  anchor: [number, number],
  current: [number, number],
  layout: SpreadInkLayout,
  options: ShapeCommitOptions,
): { left: AnnotationCommand | null; right: AnnotationCommand | null } {
  if (kind === 'line' || kind === 'arrow') {
    return linkSplitPairIds(lineOrArrowFromSpreadSegment(kind, anchor, current, layout, options))
  }
  return linkSplitPairIds(boxShapeFromSpreadRect(kind, anchor, current, layout, options))
}

function spreadNormToClientPoint(
  p: [number, number],
  spreadRect: PageRect,
): [number, number] {
  return [spreadRect.left + p[0] * spreadRect.width, spreadRect.top + p[1] * spreadRect.height]
}

function normalizeClientRect(a: [number, number], b: [number, number]) {
  const x0 = Math.min(a[0], b[0])
  const y0 = Math.min(a[1], b[1])
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function clipClientRectAtSeam(
  r: { x: number; y: number; w: number; h: number },
  seamX: number,
): { left: { x: number; y: number; w: number; h: number } | null; right: { x: number; y: number; w: number; h: number } | null } {
  const x1 = r.x + r.w
  if (x1 <= seamX) return { left: r, right: null }
  if (r.x >= seamX) return { left: null, right: r }
  const leftW = Math.max(0, seamX - r.x)
  const rightW = Math.max(0, x1 - seamX)
  const left = leftW > 0 ? { ...r, w: leftW } : null
  const right = rightW > 0 ? { ...r, x: seamX, w: rightW } : null
  return { left, right }
}

function clientRectToPageNormRect(
  r: { x: number; y: number; w: number; h: number },
  pageRect: PageRect,
): { x: number; y: number; w: number; h: number } | null {
  const tl = clientPointToPageNorm(pageRect, r.x, r.y)
  const br = clientPointToPageNorm(pageRect, r.x + r.w, r.y + r.h)
  const x = Math.min(tl[0], br[0])
  const y = Math.min(tl[1], br[1])
  const w = Math.abs(br[0] - tl[0])
  const h = Math.abs(br[1] - tl[1])
  if (w < SPREAD_TWO_POINT_EPS || h < SPREAD_TWO_POINT_EPS) return null
  return { x, y, w, h }
}

/**
 * Commit split through live DOM rects so two-point shape geometry matches spread preview at release.
 */
export function splitTwoPointShapeCommandsViaClientRects(
  kind: TwoPointShapeKind,
  anchor: [number, number],
  current: [number, number],
  spreadRect: PageRect,
  leftRect: PageRect,
  rightRect: PageRect,
  options: ShapeCommitOptions,
): { left: AnnotationCommand | null; right: AnnotationCommand | null } {
  const aClient = spreadNormToClientPoint(anchor, spreadRect)
  const bClient = spreadNormToClientPoint(current, spreadRect)
  const seamX = seamClientX(leftRect, rightRect)

  if (kind === 'line' || kind === 'arrow') {
    const { left: leftChains, right: rightChains } = splitPolylineAtVerticalSeam([aClient, bClient], seamX)
    const leftPts = firstSeamSplitChain(leftChains)
    const rightPts = firstSeamSplitChain(rightChains)
    let leftCmd: AnnotationCommand | null = null
    let rightCmd: AnnotationCommand | null = null

    if (leftPts.length >= 2) {
      const a = clientPointToPageNorm(leftRect, leftPts[0]![0], leftPts[0]![1])
      const b = clientPointToPageNorm(leftRect, leftPts[leftPts.length - 1]![0], leftPts[leftPts.length - 1]![1])
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= SPREAD_TWO_POINT_EPS) {
        const id = newAnnotationId()
        leftCmd =
          kind === 'line'
            ? ({
                kind: 'line',
                id,
                a,
                b,
                color: options.shapeColor,
                widthScale: options.shapeStrokeWidthScale,
                lineDashStyle: options.shapeLineDashStyle,
              } satisfies LineAnnotationCommand)
            : ({
                kind: 'arrow',
                id,
                from: a,
                to: b,
                color: options.shapeColor,
                widthScale: options.shapeStrokeWidthScale,
                lineDashStyle: options.shapeLineDashStyle,
              } satisfies ArrowAnnotationCommand)
      }
    }

    if (rightPts.length >= 2) {
      const a = clientPointToPageNorm(rightRect, rightPts[0]![0], rightPts[0]![1])
      const b = clientPointToPageNorm(
        rightRect,
        rightPts[rightPts.length - 1]![0],
        rightPts[rightPts.length - 1]![1],
      )
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= SPREAD_TWO_POINT_EPS) {
        const id = newAnnotationId()
        rightCmd =
          kind === 'line'
            ? ({
                kind: 'line',
                id,
                a,
                b,
                color: options.shapeColor,
                widthScale: options.shapeStrokeWidthScale,
                lineDashStyle: options.shapeLineDashStyle,
              } satisfies LineAnnotationCommand)
            : ({
                kind: 'arrow',
                id,
                from: a,
                to: b,
                color: options.shapeColor,
                widthScale: options.shapeStrokeWidthScale,
                lineDashStyle: options.shapeLineDashStyle,
              } satisfies ArrowAnnotationCommand)
      }
    }
    return linkSplitPairIds({ left: leftCmd, right: rightCmd })
  }

  const spreadClientRect = normalizeClientRect(aClient, bClient)
  if (spreadClientRect.w < SPREAD_TWO_POINT_EPS || spreadClientRect.h < SPREAD_TWO_POINT_EPS) {
    return { left: null, right: null }
  }
  const { left: leftClientRect, right: rightClientRect } = clipClientRectAtSeam(spreadClientRect, seamX)
  let leftCmd: AnnotationCommand | null = null
  let rightCmd: AnnotationCommand | null = null
  if (leftClientRect) {
    const pageRect = clientRectToPageNormRect(leftClientRect, leftRect)
    if (pageRect) leftCmd = boxCommandFromPageRect(kind, pageRect, options)
  }
  if (rightClientRect) {
    const pageRect = clientRectToPageNormRect(rightClientRect, rightRect)
    if (pageRect) rightCmd = boxCommandFromPageRect(kind, pageRect, options)
  }
  return linkSplitPairIds({ left: leftCmd, right: rightCmd })
}

/** Live two-point drafts per page (page-normalized anchor/current). */
export function splitTwoPointDraftForPreview(
  kind: TwoPointShapeKind,
  anchor: [number, number],
  current: [number, number],
  layout: SpreadInkLayout,
): {
  left: { kind: TwoPointShapeKind; anchor: [number, number]; current: [number, number] } | null
  right: { kind: TwoPointShapeKind; anchor: [number, number]; current: [number, number] } | null
} {
  if (kind === 'line' || kind === 'arrow') {
    const { left: leftChains, right: rightChains } = splitSpreadNormPolylineAtSeam(
      [anchor, current],
      layout.seamNormX,
    )
    const leftPts = firstSeamSplitChain(leftChains)
    const rightPts = firstSeamSplitChain(rightChains)
    const left =
      leftPts.length >= 2
        ? {
            kind,
            anchor: spreadPointToPage('left', leftPts[0]![0], leftPts[0]![1], layout),
            current: spreadPointToPage(
              'left',
              leftPts[leftPts.length - 1]![0],
              leftPts[leftPts.length - 1]![1],
              layout,
            ),
          }
        : null
    const right =
      rightPts.length >= 2
        ? {
            kind,
            anchor: spreadPointToPage('right', rightPts[0]![0], rightPts[0]![1], layout),
            current: spreadPointToPage(
              'right',
              rightPts[rightPts.length - 1]![0],
              rightPts[rightPts.length - 1]![1],
              layout,
            ),
          }
        : null
    return { left, right }
  }

  const spreadRect = normalizeSpreadRect(anchor, current)
  const { left: leftSpread, right: rightSpread } = clipSpreadRectAtSeam(spreadRect, layout.seamNormX)
  let left: { kind: TwoPointShapeKind; anchor: [number, number]; current: [number, number] } | null = null
  let right: { kind: TwoPointShapeKind; anchor: [number, number]; current: [number, number] } | null = null
  if (leftSpread) {
    const tl = spreadPointToPage('left', leftSpread.x, leftSpread.y, layout)
    const br = spreadPointToPage('left', leftSpread.x + leftSpread.w, leftSpread.y + leftSpread.h, layout)
    left = { kind, anchor: tl, current: br }
  }
  if (rightSpread) {
    const tl = spreadPointToPage('right', rightSpread.x, rightSpread.y, layout)
    const br = spreadPointToPage('right', rightSpread.x + rightSpread.w, rightSpread.y + rightSpread.h, layout)
    right = { kind, anchor: tl, current: br }
  }
  return { left, right }
}

/** Seam junction in spread-normalized space (for optional spread-canvas preview). */
export function spreadSeamJunctionPoint(
  anchor: [number, number],
  current: [number, number],
  seamNormX: number,
): [number, number] | null {
  return intersectSegmentWithVerticalLine(anchor[0], anchor[1], current[0], current[1], seamNormX)
}
