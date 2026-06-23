import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  countPathDirectionReversals,
  scorePenScribbleEraseGesture,
  scribbleEraseHitsInk,
  shouldCommitPenStrokeAsScribbleErase,
} from '@/lib/books/pen-scribble-erase'

/** Back-and-forth scribble like a real erase gesture (long path, short chord). */
function eraseScribble(cx: number, cy: number, span = 0.08, passes = 5): [number, number][] {
  const pts: [number, number][] = []
  let x = cx - span / 2
  for (let i = 0; i < passes * 2; i++) {
    x += i % 2 === 0 ? span : -span
    const y = cy + (i % 2 === 0 ? 0.018 : -0.018)
    pts.push([x, y])
  }
  return pts
}

function smoothLine(x0: number, x1: number, y: number): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    pts.push([x0 + t * (x1 - x0), y])
  }
  return pts
}

const rectOnPage: AnnotationCommand[] = [
  {
    kind: 'rect',
    id: 'r1',
    x: 0.4,
    y: 0.4,
    w: 0.2,
    h: 0.2,
    strokeColor: '#000',
  },
]

describe('pen-scribble-erase', () => {
  it('counts direction reversals on zigzag paths', () => {
    const pts = eraseScribble(0.5, 0.5)
    expect(countPathDirectionReversals(pts)).toBeGreaterThanOrEqual(3)
  })

  it('scores zigzag scribbles highly', () => {
    const pts = eraseScribble(0.5, 0.5)
    expect(scorePenScribbleEraseGesture(pts, 350)).toBeGreaterThanOrEqual(0.55)
  })

  it('scores smooth lines low', () => {
    const pts = smoothLine(0.1, 0.9, 0.5)
    expect(scorePenScribbleEraseGesture(pts, 400)).toBeLessThan(0.55)
  })

  it('rejects tap-sized movement', () => {
    expect(scorePenScribbleEraseGesture([[0.5, 0.5], [0.5001, 0.5001]], 200)).toBe(0)
  })

  it('detects ink hits for eraser simulation', () => {
    const pts = eraseScribble(0.5, 0.5)
    expect(scribbleEraseHitsInk(rectOnPage, pts, 1)).toBe(true)
  })

  it('commits zigzag through rect as erase', () => {
    const pts = eraseScribble(0.5, 0.5)
    expect(
      shouldCommitPenStrokeAsScribbleErase({
        mode: 'pen',
        pointerType: 'pen',
        draft: { tool: 'pen', points: pts },
        durationMs: 350,
        commands: rectOnPage,
        eraserLineWidthScale: 1,
      }),
    ).toBe(true)
  })

  it('does not commit smooth line through rect as erase', () => {
    const pts = smoothLine(0.35, 0.65, 0.5)
    expect(
      shouldCommitPenStrokeAsScribbleErase({
        mode: 'pen',
        pointerType: 'pen',
        draft: { tool: 'pen', points: pts },
        durationMs: 500,
        commands: rectOnPage,
        eraserLineWidthScale: 1,
      }),
    ).toBe(false)
  })

  it('does not commit zigzag on blank page as erase', () => {
    const pts = eraseScribble(0.15, 0.15)
    expect(
      shouldCommitPenStrokeAsScribbleErase({
        mode: 'pen',
        pointerType: 'pen',
        draft: { tool: 'pen', points: pts },
        durationMs: 350,
        commands: [],
        eraserLineWidthScale: 1,
      }),
    ).toBe(false)
  })

  it('rejects touch and marker mode', () => {
    const pts = eraseScribble(0.5, 0.5)
    expect(
      shouldCommitPenStrokeAsScribbleErase({
        mode: 'pen',
        pointerType: 'touch',
        draft: { tool: 'pen', points: pts },
        durationMs: 350,
        commands: rectOnPage,
        eraserLineWidthScale: 1,
      }),
    ).toBe(false)
    expect(
      shouldCommitPenStrokeAsScribbleErase({
        mode: 'marker',
        pointerType: 'pen',
        draft: { tool: 'pen', points: pts },
        durationMs: 350,
        commands: rectOnPage,
        eraserLineWidthScale: 1,
      }),
    ).toBe(false)
  })

  it('does not erase messy freehand cat-like paths', () => {
    const pts: [number, number][] = [
      [0.15, 0.2],
      [0.22, 0.35],
      [0.18, 0.5],
      [0.35, 0.42],
      [0.28, 0.25],
      [0.45, 0.38],
      [0.52, 0.22],
      [0.4, 0.15],
      [0.55, 0.48],
    ]
    expect(
      shouldCommitPenStrokeAsScribbleErase({
        mode: 'pen',
        pointerType: 'pen',
        draft: { tool: 'pen', points: pts },
        durationMs: 800,
        commands: rectOnPage,
        eraserLineWidthScale: 1,
      }),
    ).toBe(false)
  })
})
