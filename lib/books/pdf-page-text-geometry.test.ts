import { describe, expect, it } from 'vitest'
import type { PdfTextItem } from '@/lib/books/toc-import'
import {
  hitTestNormPoint,
  pdfTextItemsToRuns,
  runsToPlainText,
  selectRunsBetween,
  selectRunsInNormRect,
} from '@/lib/books/pdf-page-text-geometry'

/** Create a fixture item at screen position (x, yTop) on a page of given height. */
function item(str: string, x: number, yTop: number, width = 40, height = 12, pageHeight = 600): PdfTextItem {
  const pdfBaselineY = pageHeight - yTop - height
  return {
    str,
    transform: [height, 0, 0, height, x, pdfBaselineY],
    width,
    height,
  }
}

describe('pdfTextItemsToRuns', () => {
  it('maps items to normalized runs in reading order', () => {
    const runs = pdfTextItemsToRuns(
      [item('Hello', 100, 50), item('world', 160, 50)],
      400,
      600,
    )
    expect(runs.length).toBe(2)
    expect(runs[0]!.text).toBe('Hello')
    expect(runs[1]!.text).toBe('world')
    expect(runs[0]!.x).toBeGreaterThan(0)
    expect(runs[0]!.y).toBeGreaterThan(0)
    expect(runs[0]!.w).toBeGreaterThan(0)
    expect(runs[0]!.h).toBeGreaterThan(0)
  })

  it('skips empty items', () => {
    const runs = pdfTextItemsToRuns([item('  ', 10, 10, 40, 12, 300), item('Hi', 20, 10, 40, 12, 300)], 200, 300)
    expect(runs.length).toBe(1)
    expect(runs[0]!.text).toBe('Hi')
  })

  it('uses vertical scale for height when text is horizontally stretched', () => {
    const stretched: PdfTextItem = {
      str: 'Wide',
      // t[0] inflated by horizontal stretch; t[3] is true font size
      transform: [36, 0, 0, 12, 40, 500],
      width: 80,
      height: 12,
    }
    const runs = pdfTextItemsToRuns([stretched], 400, 600)
    expect(runs).toHaveLength(1)
    expect(runs[0]!.h * 600).toBeCloseTo(12 * 1.16, 0) // includes pad
    expect(runs[0]!.w * 400).toBeGreaterThan(70)
  })
})

describe('hitTestNormPoint', () => {
  const runs = pdfTextItemsToRuns([item('Hello', 100, 50, 50, 12)], 400, 600)

  it('returns index when point is inside run', () => {
    const run = runs[0]!
    const nx = run.x + run.w * 0.5
    const ny = run.y + run.h * 0.5
    expect(hitTestNormPoint(runs, nx, ny)).toBe(run.index)
  })

  it('returns null outside runs', () => {
    expect(hitTestNormPoint(runs, 0.01, 0.01)).toBeNull()
  })
})

describe('selectRunsBetween', () => {
  const runs = pdfTextItemsToRuns(
    [item('One', 10, 10, 40, 12, 300), item('Two', 60, 10, 40, 12, 300), item('Three', 110, 10, 40, 12, 300)],
    200,
    300,
  )

  it('selects inclusive range in reading order', () => {
    const selected = selectRunsBetween(runs, runs[0]!.index, runs[2]!.index)
    expect(selected.map((r) => r.text)).toEqual(['One', 'Two', 'Three'])
  })

  it('selects backwards drag', () => {
    const selected = selectRunsBetween(runs, runs[2]!.index, runs[0]!.index)
    expect(selected.map((r) => r.text)).toEqual(['One', 'Two', 'Three'])
  })
})

describe('selectRunsInNormRect', () => {
  const runs = pdfTextItemsToRuns(
    [item('A', 10, 10, 40, 12, 300), item('B', 60, 10, 40, 12, 300), item('C', 10, 40, 40, 12, 300)],
    200,
    300,
  )

  it('returns runs intersecting marquee', () => {
    const first = runs[0]!
    const second = runs[1]!
    const rect = {
      x: first.x,
      y: first.y,
      w: second.x + second.w - first.x,
      h: first.h,
    }
    const selected = selectRunsInNormRect(runs, rect)
    expect(selected.map((r) => r.text)).toEqual(['A', 'B'])
  })
})

describe('runsToPlainText', () => {
  it('joins run text', () => {
    const runs = pdfTextItemsToRuns([item('Hello', 10, 10, 40, 12, 300), item('world', 60, 10, 40, 12, 300)], 200, 300)
    expect(runsToPlainText(runs)).toBe('Hello world')
  })
})
