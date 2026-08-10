import { describe, expect, it } from 'vitest'
import {
  alignSelectedCommands,
  distributeVerticalSpacingSelectedCommands,
} from '@/lib/books/annotation-align'
import { getAnnotationBounds } from '@/lib/books/annotation-select'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

const PAGE_W = 800
const PAGE_H = 600

function rect(id: string, x: number, y: number, w = 0.1, h = 0.05): AnnotationCommand {
  return { kind: 'rect', id, x, y, w, h, strokeColor: '#000' }
}

function boundsTop(cmd: AnnotationCommand): number {
  const b = getAnnotationBounds(cmd, PAGE_W, PAGE_H)
  expect(b).not.toBeNull()
  return b!.y
}

function boundsBottom(cmd: AnnotationCommand): number {
  const b = getAnnotationBounds(cmd, PAGE_W, PAGE_H)
  expect(b).not.toBeNull()
  return b!.y + b!.h
}

function verticalGapBetween(topCmd: AnnotationCommand, bottomCmd: AnnotationCommand): number {
  return boundsTop(bottomCmd) - boundsBottom(topCmd)
}

function boundsLeft(cmd: AnnotationCommand): number {
  const b = getAnnotationBounds(cmd, PAGE_W, PAGE_H)
  expect(b).not.toBeNull()
  return b!.x
}

function boundsCenterX(cmd: AnnotationCommand): number {
  const b = getAnnotationBounds(cmd, PAGE_W, PAGE_H)
  expect(b).not.toBeNull()
  return b!.x + b!.w / 2
}

function boundsRight(cmd: AnnotationCommand): number {
  const b = getAnnotationBounds(cmd, PAGE_W, PAGE_H)
  expect(b).not.toBeNull()
  return b!.x + b!.w
}

describe('alignSelectedCommands', () => {
  it('returns the same array when fewer than two items are selected', () => {
    const commands = [rect('a', 0.1, 0.1), rect('b', 0.5, 0.5)]
    const result = alignSelectedCommands(commands, ['a'], 'left', PAGE_W, PAGE_H)
    expect(result).toBe(commands)
  })

  it('returns the same array when already left-aligned', () => {
    const commands = [rect('a', 0.2, 0.1), rect('b', 0.2, 0.5), rect('c', 0.2, 0.8)]
    const result = alignSelectedCommands(commands, ['a', 'b', 'c'], 'left', PAGE_W, PAGE_H)
    expect(result).toBe(commands)
  })

  it('aligns left edges to the selection union', () => {
    const commands = [rect('a', 0.1, 0.1), rect('b', 0.35, 0.2), rect('c', 0.2, 0.3)]
    const next = alignSelectedCommands(commands, ['a', 'b', 'c'], 'left', PAGE_W, PAGE_H)
    expect(next).not.toBe(commands)

    const lefts = next.map(boundsLeft)
    expect(lefts[0]).toBeCloseTo(lefts[1]!)
    expect(lefts[1]).toBeCloseTo(lefts[2]!)
    expect(lefts[0]).toBeCloseTo(0.1)
  })

  it('aligns horizontal centers to the selection union', () => {
    const commands = [rect('a', 0.1, 0.1), rect('b', 0.4, 0.2), rect('c', 0.25, 0.3)]
    const next = alignSelectedCommands(commands, ['a', 'b', 'c'], 'center', PAGE_W, PAGE_H)
    const centers = next.map(boundsCenterX)
    expect(centers[0]).toBeCloseTo(centers[1]!)
    expect(centers[1]).toBeCloseTo(centers[2]!)
  })

  it('aligns right edges to the selection union', () => {
    const commands = [rect('a', 0.1, 0.1), rect('b', 0.35, 0.2), rect('c', 0.2, 0.3)]
    const next = alignSelectedCommands(commands, ['a', 'b', 'c'], 'right', PAGE_W, PAGE_H)
    const rights = next.map(boundsRight)
    expect(rights[0]).toBeCloseTo(rights[1]!)
    expect(rights[1]).toBeCloseTo(rights[2]!)
    expect(rights[0]).toBeCloseTo(0.45)
  })

  it('skips locked images and aligns the remaining shapes', () => {
    const commands: AnnotationCommand[] = [
      rect('a', 0.1, 0.1),
      rect('b', 0.4, 0.2),
      {
        kind: 'image',
        id: 'img',
        x: 0.05,
        y: 0.5,
        w: 0.15,
        h: 0.1,
        src: 'data:image/png;base64,abc',
        locked: true,
      },
    ]
    const next = alignSelectedCommands(commands, ['a', 'b', 'img'], 'left', PAGE_W, PAGE_H)
    const img = next.find((c) => c.id === 'img')
    expect(img?.kind).toBe('image')
    if (img?.kind === 'image') {
      expect(img.x).toBeCloseTo(0.05)
    }
    const shapeLefts = next.filter((c) => c.kind === 'rect').map(boundsLeft)
    expect(shapeLefts[0]).toBeCloseTo(shapeLefts[1]!)
  })

  it('aligns mixed text and shape selections', () => {
    const commands: AnnotationCommand[] = [
      rect('shape', 0.35, 0.2),
      {
        kind: 'text',
        id: 'label',
        x: 0.1,
        y: 0.1,
        yAnchor: 'top',
        text: 'Hello',
        fontSizeNorm: 0.04,
        color: '#111',
      },
    ]
    const next = alignSelectedCommands(commands, ['shape', 'label'], 'left', PAGE_W, PAGE_H)
    const lefts = next.map(boundsLeft)
    expect(lefts[0]).toBeCloseTo(lefts[1]!)
  })

  it('does not move items outside the selection', () => {
    const commands = [rect('a', 0.1, 0.1), rect('b', 0.4, 0.2), rect('c', 0.7, 0.3)]
    const next = alignSelectedCommands(commands, ['a', 'b'], 'left', PAGE_W, PAGE_H)
    const untouched = next.find((c) => c.id === 'c')
    expect(untouched?.kind).toBe('rect')
    if (untouched?.kind === 'rect') {
      expect(untouched.x).toBeCloseTo(0.7)
    }
  })
})

describe('distributeVerticalSpacingSelectedCommands', () => {
  it('returns the same array when fewer than three items are selected', () => {
    const commands = [rect('a', 0.1, 0.1), rect('b', 0.1, 0.5)]
    const result = distributeVerticalSpacingSelectedCommands(commands, ['a', 'b'], PAGE_W, PAGE_H)
    expect(result).toBe(commands)
  })

  it('equalizes vertical gaps while keeping top and bottom items anchored', () => {
    const commands = [rect('a', 0.1, 0.1), rect('b', 0.1, 0.25), rect('c', 0.1, 0.6)]
    const originalA = commands.find((cmd) => cmd.id === 'a')!
    const originalC = commands.find((cmd) => cmd.id === 'c')!
    const next = distributeVerticalSpacingSelectedCommands(commands, ['a', 'b', 'c'], PAGE_W, PAGE_H)
    expect(next).not.toBe(commands)

    const a = next.find((c) => c.id === 'a')!
    const b = next.find((c) => c.id === 'b')!
    const c = next.find((c) => c.id === 'c')!

    expect(boundsTop(a)).toBeCloseTo(boundsTop(originalA), 6)
    expect(boundsBottom(c)).toBeCloseTo(boundsBottom(originalC), 6)

    const gapAB = verticalGapBetween(a, b)
    const gapBC = verticalGapBetween(b, c)
    expect(gapAB).toBeCloseTo(gapBC, 6)
    expect(gapAB).toBeGreaterThan(verticalGapBetween(originalA, commands.find((cmd) => cmd.id === 'b')!))

    const originalB = commands.find((cmd) => cmd.id === 'b')!
    expect(boundsTop(b)).toBeGreaterThan(boundsTop(originalB))
  })

  it('does not move items outside the selection', () => {
    const commands = [rect('a', 0.1, 0.1), rect('b', 0.1, 0.25), rect('c', 0.1, 0.6), rect('d', 0.5, 0.8)]
    const next = distributeVerticalSpacingSelectedCommands(commands, ['a', 'b', 'c'], PAGE_W, PAGE_H)
    const untouched = next.find((cmd) => cmd.id === 'd')
    expect(untouched?.kind).toBe('rect')
    if (untouched?.kind === 'rect') {
      expect(untouched.y).toBeCloseTo(0.8, 6)
    }
  })
})
