import type { NormRect, PdfPageTextRun } from '@/lib/books/pdf-page-text-geometry'

/** One text area on the page (main text, a caption, a speech bubble). */
export type TextBlock = {
  id: number
  /** Runs in reading order: lines top to bottom, words left to right. */
  runs: PdfPageTextRun[]
  rect: NormRect
}

export type PageTextBlocks = {
  blocks: TextBlock[]
  blockOfRun: Map<number, number>
}

/** Taller / shorter run height above this means a different font size (title vs body vs caption). */
const MAX_SIZE_RATIO = 1.35
/** Same line: vertical centers within this × the smaller height. */
const SAME_LINE_CENTER_RATIO = 0.5
/** Same line: horizontal gap up to this × height still joins (wider = other column or side caption). */
const SAME_LINE_MAX_GAP_RATIO = 1.5
/** Next line: vertical gap up to this × height joins. */
const NEXT_LINE_MAX_GAP_RATIO = 1.0
/** Next line: horizontal ranges must overlap or be this close (× height). */
const NEXT_LINE_X_SLACK_RATIO = 0.5

function centerY(run: PdfPageTextRun): number {
  return run.y + run.h / 2
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function horizontalGap(a: PdfPageTextRun, b: PdfPageTextRun): number {
  return Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w))
}

function runsBelongTogether(a: PdfPageTextRun, b: PdfPageTextRun): boolean {
  const minH = Math.min(a.h, b.h)
  const maxH = Math.max(a.h, b.h)
  if (!(minH > 0) || maxH / minH > MAX_SIZE_RATIO) return false
  const xGap = horizontalGap(a, b)
  if (Math.abs(centerY(a) - centerY(b)) <= minH * SAME_LINE_CENTER_RATIO) {
    return xGap <= minH * SAME_LINE_MAX_GAP_RATIO
  }
  const [upper, lower] = a.y <= b.y ? [a, b] : [b, a]
  const yGap = Math.max(0, lower.y - (upper.y + upper.h))
  return yGap <= minH * NEXT_LINE_MAX_GAP_RATIO && xGap <= minH * NEXT_LINE_X_SLACK_RATIO
}

/** Lines top to bottom (grouped by vertical center), words left to right. */
function readingOrder(runs: readonly PdfPageTextRun[]): PdfPageTextRun[] {
  const sorted = [...runs].sort((a, b) => centerY(a) - centerY(b))
  const lines: PdfPageTextRun[][] = []
  let current: PdfPageTextRun[] = []
  for (const run of sorted) {
    if (current.length > 0) {
      const lineCenter = median(current.map(centerY))
      const lineHeight = median(current.map((r) => r.h))
      if (Math.abs(centerY(run) - lineCenter) > lineHeight * SAME_LINE_CENTER_RATIO) {
        lines.push(current)
        current = []
      }
    }
    current.push(run)
  }
  if (current.length > 0) lines.push(current)
  return lines.flatMap((line) => line.sort((a, b) => a.x - b.x))
}

function boundingRect(runs: readonly PdfPageTextRun[]): NormRect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of runs) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * Split page runs into text blocks by linking neighboring words of a similar size:
 * on the same line with a small gap, or on the next line with overlapping x.
 * Side captions, bubbles and other columns end up in their own blocks.
 */
export function buildTextBlocks(runs: readonly PdfPageTextRun[]): PageTextBlocks {
  const sorted = [...runs].filter((r) => r.w > 0 && r.h > 0).sort((a, b) => a.y - b.y)
  const parent = sorted.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!
      i = parent[i]!
    }
    return i
  }

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!
    // A partner must start within the next-line gap below `a`, so stop scanning past it.
    const yLimit = a.y + a.h * (2 + NEXT_LINE_MAX_GAP_RATIO)
    for (let j = i + 1; j < sorted.length && sorted[j]!.y <= yLimit; j++) {
      if (!runsBelongTogether(a, sorted[j]!)) continue
      const ra = find(i)
      const rb = find(j)
      if (ra !== rb) parent[rb] = ra
    }
  }

  const groups = new Map<number, PdfPageTextRun[]>()
  sorted.forEach((run, i) => {
    const root = find(i)
    const group = groups.get(root)
    if (group) group.push(run)
    else groups.set(root, [run])
  })

  const blocks = [...groups.values()]
    .map((group) => ({ runs: readingOrder(group), rect: boundingRect(group) }))
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .map((block, id) => ({ id, ...block }))

  const blockOfRun = new Map<number, number>()
  for (const block of blocks) {
    for (const run of block.runs) blockOfRun.set(run.index, block.id)
  }
  return { blocks, blockOfRun }
}
