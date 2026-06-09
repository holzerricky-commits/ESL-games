import { penStrokeUsesRichLivePaint } from '@/lib/books/annotation-live-pen-paint'
import type { DrawStrokePathOptions } from '@/lib/books/annotation-draw'
import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import type {
  IncrementalDraftSource,
  IncrementalDraftState,
  LiveStrokeDraft,
  TwoPointDraft,
} from '@/components/students/book-page-annotation-layer/types'

export function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function normalizeRect(a: [number, number], b: [number, number]) {
  const x0 = clamp01(Math.min(a[0], b[0]))
  const y0 = clamp01(Math.min(a[1], b[1]))
  const x1 = clamp01(Math.max(a[0], b[0]))
  const y1 = clamp01(Math.max(a[1], b[1]))
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

/** Stable key for live eraser preview dead-index sets (avoids erasePreviewEpoch loops). */
export function eraserDeadIndicesKey(dead: ReadonlySet<number>): string | null {
  if (dead.size === 0) return null
  return [...dead].sort((a, b) => a - b).join(',')
}

export function cloneCommandStack(stack: AnnotationCommand[]): AnnotationCommand[] {
  return stack.map((c) =>
    typeof structuredClone === 'function'
      ? structuredClone(c)
      : (JSON.parse(JSON.stringify(c)) as AnnotationCommand),
  )
}

export function nextCalloutIndex(commands: AnnotationCommand[]): number {
  let m = 0
  for (const c of commands) {
    if (c.kind === 'callout') m = Math.max(m, c.index)
  }
  return m + 1
}

export function activeLiveStrokeDraftForPaint(
  draftStroke: StrokeAnnotationCommand | null,
  liveSpread: LiveStrokeDraft | null,
): { source: IncrementalDraftSource; draft: StrokeAnnotationCommand | LiveStrokeDraft } | null {
  if (draftStroke && draftStroke.points.length >= 1 && draftStroke.tool !== 'eraser-line') {
    return { source: 'local', draft: draftStroke }
  }
  if (liveSpread && liveSpread.points.length >= 1) {
    return { source: 'spread', draft: liveSpread }
  }
  return null
}

export function canIncrementallyAppendDraftSegment(
  prev: IncrementalDraftState | null,
  active: { source: IncrementalDraftSource; draft: StrokeAnnotationCommand | LiveStrokeDraft },
  twoDraft: TwoPointDraft | null,
): boolean {
  if (twoDraft) return false
  // Full redraw keeps pen quadratic joins and marker multiply blend consistent.
  return false
}

export function incrementalDraftSegmentPoints(
  points: readonly [number, number][],
  previousLength: number,
): [number, number][] {
  const start = Math.max(0, previousLength - 2)
  return points.slice(start) as [number, number][]
}

export function liveStrokeDrawOptions(
  draft: Pick<StrokeAnnotationCommand, 'tool' | 'penInkStyle' | 'penStrokeProfile'>,
  base: DrawStrokePathOptions,
): DrawStrokePathOptions {
  if (
    draft.tool !== 'pen' ||
    penStrokeUsesRichLivePaint({
      penInkStyle: draft.penInkStyle,
      penStrokeProfile: draft.penStrokeProfile,
    })
  ) {
    return base
  }
  return { ...base, livePaintFast: true }
}

export function sizeAnnotationPageCanvas(el: HTMLCanvasElement, widthPx: number, heightPx: number): void {
  const dpr = window.devicePixelRatio || 1
  const nextW = Math.max(1, Math.floor(widthPx * dpr))
  const nextH = Math.max(1, Math.floor(heightPx * dpr))
  if (el.width !== nextW || el.height !== nextH) {
    el.width = nextW
    el.height = nextH
  }
  el.style.width = `${widthPx}px`
  el.style.height = `${heightPx}px`
}
