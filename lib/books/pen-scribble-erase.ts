import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import { isPenBarrelEraserActive } from '@/lib/books/pen-barrel-button'
import { STROKE_TAP_MAX_DIST_SQ } from '@/lib/books/stroke-tap-dot'

/** Min bbox diagonal (norm) for a scribble-erase gesture. */
export const PEN_SCRIBBLE_ERASE_MIN_DIAG = 0.012

/** Path length / chord length — zigzag scribbles exceed this; smooth lines do not. */
export const PEN_SCRIBBLE_ERASE_MIN_PATH_CHORD_RATIO = 2.8

/** Minimum axis direction reversals along the sampled path. */
export const PEN_SCRIBBLE_ERASE_MIN_REVERSALS = 3

/** Minimum polyline points (after downsampling). */
export const PEN_SCRIBBLE_ERASE_MIN_POINTS = 6

/** Gesture duration bounds (ms). */
export const PEN_SCRIBBLE_ERASE_MIN_DURATION_MS = 120
export const PEN_SCRIBBLE_ERASE_MAX_DURATION_MS = 900

/** Combined score threshold for scribble-erase classification. */
export const PEN_SCRIBBLE_ERASE_SCORE_THRESHOLD = 0.55

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function polylineLength(points: readonly [number, number][]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1]!, points[i]!)
  }
  return len
}

function bboxDiag(points: readonly [number, number][]): number {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const [x, y] of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return Math.hypot(maxX - minX, maxY - minY)
}

function maxDistSqFromFirst(points: readonly [number, number][]): number {
  if (points.length < 2) return 0
  const [fx, fy] = points[0]!
  let maxSq = 0
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    const dx = p[0] - fx
    const dy = p[1] - fy
    const sq = dx * dx + dy * dy
    if (sq > maxSq) maxSq = sq
  }
  return maxSq
}

/** Count sign flips on sampled segment deltas (zigzag indicator). */
export function countPathDirectionReversals(points: readonly [number, number][]): number {
  if (points.length < 3) return 0
  let reversals = 0
  let prevDx = 0
  let prevDy = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]![0] - points[i - 1]![0]
    const dy = points[i]![1] - points[i - 1]![1]
    if (Math.hypot(dx, dy) < 1e-8) continue
    if (prevDx !== 0 || prevDy !== 0) {
      const flipX = prevDx !== 0 && dx !== 0 && Math.sign(prevDx) !== Math.sign(dx)
      const flipY = prevDy !== 0 && dy !== 0 && Math.sign(prevDy) !== Math.sign(dy)
      if (flipX || flipY) reversals += 1
    }
    prevDx = dx
    prevDy = dy
  }
  return reversals
}

/**
 * Score how likely a pen stroke is an intentional zigzag erase scribble (0–1).
 * Does not check whether ink was hit — use {@link shouldCommitPenStrokeAsScribbleErase}.
 */
export function scorePenScribbleEraseGesture(
  points: readonly [number, number][],
  durationMs: number,
): number {
  if (points.length < PEN_SCRIBBLE_ERASE_MIN_POINTS) return 0
  if (maxDistSqFromFirst(points) < STROKE_TAP_MAX_DIST_SQ) return 0

  const diag = bboxDiag(points)
  if (diag < PEN_SCRIBBLE_ERASE_MIN_DIAG) return 0

  if (durationMs < PEN_SCRIBBLE_ERASE_MIN_DURATION_MS || durationMs > PEN_SCRIBBLE_ERASE_MAX_DURATION_MS) {
    return 0
  }

  const chord = dist(points[0]!, points[points.length - 1]!)
  if (chord < 1e-8) return 0

  const pathLen = polylineLength(points)
  const pathChordRatio = pathLen / chord
  if (pathChordRatio < PEN_SCRIBBLE_ERASE_MIN_PATH_CHORD_RATIO) return 0

  const reversals = countPathDirectionReversals(points)
  if (reversals < PEN_SCRIBBLE_ERASE_MIN_REVERSALS) return 0

  const ratioScore = Math.min(1, (pathChordRatio - PEN_SCRIBBLE_ERASE_MIN_PATH_CHORD_RATIO) / 2)
  const reversalScore = Math.min(1, (reversals - PEN_SCRIBBLE_ERASE_MIN_REVERSALS + 1) / 4)
  const durationMid = (PEN_SCRIBBLE_ERASE_MIN_DURATION_MS + PEN_SCRIBBLE_ERASE_MAX_DURATION_MS) / 2
  const durationSpan = PEN_SCRIBBLE_ERASE_MAX_DURATION_MS - PEN_SCRIBBLE_ERASE_MIN_DURATION_MS
  const durationScore = 1 - Math.min(1, Math.abs(durationMs - durationMid) / (durationSpan / 2))

  return 0.45 * ratioScore + 0.4 * reversalScore + 0.15 * durationScore
}

/** True when the trailing eraser path would newly hide at least one command. */
export function scribbleEraseHitsInk(
  commands: readonly AnnotationCommand[],
  points: readonly [number, number][],
  eraserLineWidthScale: number,
): boolean {
  if (points.length < 2) return false
  const baseDead = computeEraserLineDeadIndices([...commands])
  const withTrailing = computeEraserLineDeadIndices([...commands], {
    tool: 'eraser-line',
    points: points.map((p) => [p[0], p[1]] as [number, number]),
    widthScale: eraserLineWidthScale,
  })
  for (const idx of withTrailing) {
    if (!baseDead.has(idx)) return true
  }
  return false
}

export type PenScribbleEraseCommitArgs = {
  mode: BookAnnotationInteractionMode
  pointerType: string
  draft: Pick<StrokeAnnotationCommand, 'tool' | 'points'>
  durationMs: number
  commands: readonly AnnotationCommand[]
  eraserLineWidthScale: number
  pointerSample?: Pick<PointerEvent, 'pointerType' | 'button' | 'buttons' | 'pointerId'>
}

/** Whether a finished pen stroke should commit as eraser-line instead of pen ink. */
export function shouldCommitPenStrokeAsScribbleErase(args: PenScribbleEraseCommitArgs): boolean {
  if (args.mode !== 'pen') return false
  if (args.pointerType !== 'pen') return false
  if (args.draft.tool !== 'pen') return false
  if (args.pointerSample && isPenBarrelEraserActive(args.pointerSample)) return false
  if (args.draft.points.length < 2) return false

  const score = scorePenScribbleEraseGesture(args.draft.points, args.durationMs)
  if (score < PEN_SCRIBBLE_ERASE_SCORE_THRESHOLD) return false

  return scribbleEraseHitsInk(args.commands, args.draft.points, args.eraserLineWidthScale)
}

/** Rewrite a pen draft as an invisible eraser-line for commit. */
export function penDraftAsScribbleEraserLine(
  draft: StrokeAnnotationCommand,
  commitPoints: readonly [number, number][],
  eraserLineWidthScale: number,
): StrokeAnnotationCommand {
  return {
    kind: 'stroke',
    id: draft.id,
    tool: 'eraser-line',
    points: commitPoints.map((p) => [p[0], p[1]] as [number, number]),
    widthScale: eraserLineWidthScale,
  }
}
