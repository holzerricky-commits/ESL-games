import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { degToRad, rotateNormPointInPixelSpace } from '@/lib/books/annotation-rotation'
import {
  clampSelectionMoveDelta,
  clampSelectionTranslationDelta,
  cursorForScaleHandle,
  cursorForScaleHandleOnFrame,
  hitTestScaleHandle,
  hitTestScaleHandleForFrame,
  mapPointInOrientedFrame,
  orientedFrameHandlePositionsNorm,
  resizeBoundsFromHandle,
  resizeOrientedFrameFromHandle,
  scaleAnnotationCommand,
  scaleAnnotationCommandFromOrientedFrames,
  SELECTION_MIN_VISIBLE_GRAB_NORM,
  thicknessScaleFromBounds,
  unionSelectionBounds,
} from '@/lib/books/annotation-scale'

describe('annotation-scale', () => {
  it('unionSelectionBounds merges selected items', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'rect',
        id: 'a',
        x: 0.1,
        y: 0.1,
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
      {
        kind: 'rect',
        id: 'b',
        x: 0.5,
        y: 0.5,
        w: 0.2,
        h: 0.15,
        strokeColor: '#000',
      },
    ]
    const u = unionSelectionBounds(commands, ['a', 'b'], 800, 600)
    expect(u).not.toBeNull()
    expect(u!.x).toBeCloseTo(0.1, 3)
    expect(u!.y).toBeCloseTo(0.1, 3)
    expect(u!.w).toBeCloseTo(0.6, 3)
    expect(u!.h).toBeCloseTo(0.55, 3)
  })

  it('hitTestScaleHandle finds corner handles', () => {
    const bounds = { x: 0.2, y: 0.2, w: 0.3, h: 0.2 }
    const se = hitTestScaleHandle([0.5, 0.4], bounds, 800, 600, 20)
    expect(se).toBe('se')
  })

  it('resizeBoundsFromHandle grows se corner', () => {
    const start = { x: 0.2, y: 0.2, w: 0.2, h: 0.2 }
    const next = resizeBoundsFromHandle(start, 'se', [0.5, 0.5])
    expect(next.x).toBeCloseTo(0.2, 3)
    expect(next.y).toBeCloseTo(0.2, 3)
    expect(next.w).toBeCloseTo(0.3, 3)
    expect(next.h).toBeCloseTo(0.3, 3)
  })

  it('resizeBoundsFromHandle preserves aspect when uniform (default gesture)', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 }
    const next = resizeBoundsFromHandle(start, 'se', [0.6, 0.5], { uniform: true })
    expect(next.w / next.h).toBeCloseTo(start.w / start.h, 2)
  })

  it('resizeBoundsFromHandle allows free aspect when uniform is off', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 }
    const next = resizeBoundsFromHandle(start, 'se', [0.6, 0.5], { uniform: false })
    expect(next.w / next.h).not.toBeCloseTo(start.w / start.h, 2)
  })

  it('uniform resize stops at page edge without breaking aspect', () => {
    const start = { x: 0.7, y: 0.7, w: 0.2, h: 0.1 }
    const next = resizeBoundsFromHandle(start, 'se', [2, 2], { uniform: true })
    expect(next.x + next.w).toBeLessThanOrEqual(1 + 1e-9)
    expect(next.y + next.h).toBeLessThanOrEqual(1 + 1e-9)
    expect(next.w / next.h).toBeCloseTo(start.w / start.h, 4)
    expect(next.x + next.w).toBeCloseTo(1, 3)
  })

  it('scaleAnnotationCommand scales stroke points', () => {
    const start = { x: 0, y: 0, w: 1, h: 1 }
    const next = { x: 0, y: 0, w: 0.5, h: 0.5 }
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's',
      tool: 'pen',
      points: [
        [0, 0],
        [1, 1],
      ],
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('stroke')
    if (scaled.kind === 'stroke') {
      expect(scaled.points[1]![0]).toBeCloseTo(0.5, 3)
      expect(scaled.points[1]![1]).toBeCloseTo(0.5, 3)
    }
  })

  it('thicknessScaleFromBounds uses sx when aspect locked', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 }
    const next = { x: 0.1, y: 0.1, w: 0.8, h: 0.4 }
    expect(thicknessScaleFromBounds(start, next)).toBeCloseTo(2, 5)
  })

  it('thicknessScaleFromBounds uses geometric mean when aspect free', () => {
    const start = { x: 0, y: 0, w: 0.4, h: 0.2 }
    const next = { x: 0, y: 0, w: 0.8, h: 0.2 }
    expect(thicknessScaleFromBounds(start, next)).toBeCloseTo(Math.sqrt(2), 5)
    expect(thicknessScaleFromBounds(start, next)).not.toBeCloseTo(1.5, 2)
  })

  it('uniform 2x scale doubles stroke widthScale', () => {
    const start = { x: 0, y: 0, w: 1, h: 1 }
    const next = { x: 0, y: 0, w: 2, h: 2 }
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's',
      tool: 'pen',
      points: [[0.25, 0.25], [0.75, 0.75]],
      widthScale: 1.2,
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('stroke')
    if (scaled.kind === 'stroke') {
      expect(scaled.widthScale).toBeCloseTo(2.4, 5)
    }
  })

  it('legacy stroke without widthScale gets thickness after scale', () => {
    const start = { x: 0, y: 0, w: 1, h: 1 }
    const next = { x: 0, y: 0, w: 0.5, h: 0.5 }
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's',
      tool: 'marker',
      points: [[0, 0], [1, 0]],
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('stroke')
    if (scaled.kind === 'stroke') {
      expect(scaled.widthScale).toBeCloseTo(0.5, 5)
    }
  })

  it('arrow scales headLengthNorm with bounds', () => {
    const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }
    const next = { x: 0.2, y: 0.2, w: 0.8, h: 0.8 }
    const cmd: AnnotationCommand = {
      kind: 'arrow',
      id: 'a',
      from: [0.3, 0.5],
      to: [0.5, 0.5],
      color: '#000',
      headLengthNorm: 0.04,
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('arrow')
    if (scaled.kind === 'arrow') {
      expect(scaled.headLengthNorm).toBeCloseTo(0.08, 5)
    }
  })

  it('text scales fontSizeNorm and maxWidthNorm with same factor', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 }
    const next = { x: 0.1, y: 0.1, w: 0.8, h: 0.4 }
    const cmd: AnnotationCommand = {
      kind: 'text',
      id: 't',
      x: 0.2,
      y: 0.2,
      text: 'hi',
      fontSizeNorm: 0.04,
      color: '#000',
      maxWidthNorm: 0.3,
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('text')
    if (scaled.kind === 'text') {
      expect(scaled.fontSizeNorm).toBeCloseTo(0.08, 5)
      expect(scaled.maxWidthNorm).toBeCloseTo(0.6, 5)
    }
  })

  it('cursorForScaleHandle matches upright frame', () => {
    const frame = { rect: { x: 0, y: 0, w: 1, h: 1 }, rotationDeg: 0 }
    expect(cursorForScaleHandle('n')).toBe('ns-resize')
    expect(cursorForScaleHandleOnFrame('n', frame, 800, 600)).toBe('ns-resize')
    expect(cursorForScaleHandleOnFrame('e', frame, 800, 600)).toBe('ew-resize')
    expect(cursorForScaleHandleOnFrame('nw', frame, 800, 600)).toBe('nwse-resize')
  })

  it('cursorForScaleHandleOnFrame rotates with frame', () => {
    const frame = { rect: { x: 0, y: 0, w: 1, h: 1 }, rotationDeg: 90 }
    expect(cursorForScaleHandleOnFrame('n', frame, 800, 600)).toBe('ew-resize')
    expect(cursorForScaleHandleOnFrame('e', frame, 800, 600)).toBe('ns-resize')
    expect(cursorForScaleHandleOnFrame('nw', frame, 800, 600)).toBe('nesw-resize')
  })

  it('resize cursor follows handle screen direction (Photoshop-style 45° sectors)', () => {
    const upright = { rect: { x: 0, y: 0, w: 1, h: 1 }, rotationDeg: 0 }
    expect(cursorForScaleHandleOnFrame('nw', upright, 800, 600)).toBe('nwse-resize')
    expect(cursorForScaleHandleOnFrame('n', upright, 800, 600)).toBe('ns-resize')

    const rotated45 = { rect: { x: 0, y: 0, w: 1, h: 1 }, rotationDeg: 45 }
    // After 45° rotation the NW corner points mostly upward on screen → vertical cursor
    expect(cursorForScaleHandleOnFrame('nw', rotated45, 800, 600)).toBe('ns-resize')

    const rotated90 = { rect: { x: 0, y: 0, w: 1, h: 1 }, rotationDeg: 90 }
    // Top edge handle has moved to the right → horizontal cursor
    expect(cursorForScaleHandleOnFrame('n', rotated90, 800, 600)).toBe('ew-resize')
  })

  it('hitTestScaleHandleForFrame finds handles on a rotated frame', () => {
    const frame = { rect: { x: 0.3, y: 0.3, w: 0.2, h: 0.1 }, rotationDeg: 45 }
    const [sx, sy] = orientedFrameHandlePositionsNorm(frame, 800, 600).se
    const hit = hitTestScaleHandleForFrame([sx, sy], frame, 800, 600, 24)
    expect(hit).toBe('se')
  })

  it('hitTestScaleHandleForFrame finds handles at 90° on non-square page', () => {
    const widthPx = 800
    const heightPx = 600
    const frame = { rect: { x: 0.3, y: 0.3, w: 0.2, h: 0.1 }, rotationDeg: 90 }
    const [sx, sy] = orientedFrameHandlePositionsNorm(frame, widthPx, heightPx).se
    const hit = hitTestScaleHandleForFrame([sx, sy], frame, widthPx, heightPx, 24)
    expect(hit).toBe('se')
  })

  it('resizeOrientedFrameFromHandle grows the se corner in local space', () => {
    const widthPx = 800
    const heightPx = 600
    const start = { rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 }, rotationDeg: 45 }
    const cx = start.rect.x + start.rect.w / 2
    const cy = start.rect.y + start.rect.h / 2
    const localDrag: [number, number] = [start.rect.x + start.rect.w + 0.05, start.rect.y + start.rect.h + 0.05]
    const pageDrag = rotateNormPointInPixelSpace(localDrag, [cx, cy], degToRad(45), widthPx, heightPx)
    const next = resizeOrientedFrameFromHandle(start, 'se', pageDrag, widthPx, heightPx)
    expect(next.rotationDeg).toBeCloseTo(45, 3)
    expect(next.rect.w).toBeGreaterThan(start.rect.w)
    expect(next.rect.h).toBeGreaterThan(start.rect.h)
  })

  it('uniform resize from sw keeps ne anchor fixed on screen at 45°', () => {
    const widthPx = 800
    const heightPx = 600
    const start = { rect: { x: 0.3, y: 0.3, w: 0.2, h: 0.1 }, rotationDeg: 45 }
    const startPos = orientedFrameHandlePositionsNorm(start, widthPx, heightPx)
    const anchorBefore = startPos.ne
    const sw = startPos.sw
    const pointer: [number, number] = [
      anchorBefore[0] + (sw[0] - anchorBefore[0]) * 1.5,
      anchorBefore[1] + (sw[1] - anchorBefore[1]) * 1.5,
    ]
    const next = resizeOrientedFrameFromHandle(start, 'sw', pointer, widthPx, heightPx, {
      uniform: true,
    })
    const nextPos = orientedFrameHandlePositionsNorm(next, widthPx, heightPx)
    expect(nextPos.ne[0]).toBeCloseTo(anchorBefore[0], 5)
    expect(nextPos.ne[1]).toBeCloseTo(anchorBefore[1], 5)
    expect(next.rect.w / next.rect.h).toBeCloseTo(start.rect.w / start.rect.h, 3)
  })

  it('uniform resize from se keeps nw anchor fixed at 90° on non-square page', () => {
    const widthPx = 800
    const heightPx = 600
    const start = { rect: { x: 0.3, y: 0.3, w: 0.2, h: 0.1 }, rotationDeg: 90 }
    const startPos = orientedFrameHandlePositionsNorm(start, widthPx, heightPx)
    const anchorBefore = startPos.nw
    const se = startPos.se
    const pointer: [number, number] = [
      anchorBefore[0] + (se[0] - anchorBefore[0]) * 1.4,
      anchorBefore[1] + (se[1] - anchorBefore[1]) * 1.4,
    ]
    const next = resizeOrientedFrameFromHandle(start, 'se', pointer, widthPx, heightPx, {
      uniform: true,
    })
    const nextPos = orientedFrameHandlePositionsNorm(next, widthPx, heightPx)
    expect(nextPos.nw[0]).toBeCloseTo(anchorBefore[0], 5)
    expect(nextPos.nw[1]).toBeCloseTo(anchorBefore[1], 5)
    expect(next.rect.w / next.rect.h).toBeCloseTo(start.rect.w / start.rect.h, 3)
  })

  it('mapPointInOrientedFrame keeps uniform scale anchor corner fixed at 45°', () => {
    const widthPx = 800
    const heightPx = 600
    const start = { rect: { x: 0.3, y: 0.3, w: 0.2, h: 0.1 }, rotationDeg: 45 }
    const startPos = orientedFrameHandlePositionsNorm(start, widthPx, heightPx)
    const anchor = startPos.ne
    const sw = startPos.sw
    const pointer: [number, number] = [
      anchor[0] + (sw[0] - anchor[0]) * 2,
      anchor[1] + (sw[1] - anchor[1]) * 2,
    ]
    const next = resizeOrientedFrameFromHandle(start, 'sw', pointer, widthPx, heightPx, {
      uniform: true,
    })
    const mapped = mapPointInOrientedFrame(anchor, start, next, widthPx, heightPx)
    expect(mapped[0]).toBeCloseTo(anchor[0], 5)
    expect(mapped[1]).toBeCloseTo(anchor[1], 5)
  })

  it('scaleAnnotationCommandFromOrientedFrames preserves shared pen group rotation', () => {
    const sharedBounds = { x: 0.2, y: 0.2, w: 0.3, h: 0.15 }
    const start = { rect: sharedBounds, rotationDeg: 45 }
    const next = { rect: { x: 0.2, y: 0.2, w: 0.45, h: 0.225 }, rotationDeg: 45 }
    const stroke = {
      kind: 'stroke' as const,
      id: 's1',
      tool: 'pen' as const,
      points: [
        [0.25, 0.25],
        [0.35, 0.25],
      ],
      color: '#000',
      rotationBounds: sharedBounds,
      rotationDeg: 45,
    }
    const scaled = scaleAnnotationCommandFromOrientedFrames(stroke, start, next, 800, 600)
    expect(scaled.kind).toBe('stroke')
    if (scaled.kind === 'stroke') {
      expect(scaled.rotationDeg).toBeCloseTo(45, 3)
      expect(scaled.rotationBounds).toEqual(next.rect)
      expect(scaled.points[0]![0]).not.toBeCloseTo(stroke.points[0]![0], 3)
    }
  })

  it('scaleAnnotationCommandFromOrientedFrames preserves rect rotationDeg', () => {
    const start = { rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.1 }, rotationDeg: 30 }
    const next = { rect: { x: 0.2, y: 0.2, w: 0.3, h: 0.15 }, rotationDeg: 30 }
    const cmd = {
      kind: 'rect' as const,
      id: 'r1',
      x: 0.22,
      y: 0.22,
      w: 0.16,
      h: 0.06,
      rotationDeg: 30,
      strokeColor: '#000',
    }
    const scaled = scaleAnnotationCommandFromOrientedFrames(cmd, start, next, 800, 600)
    expect(scaled.kind).toBe('rect')
    if (scaled.kind === 'rect') {
      expect(scaled.rotationDeg).toBeCloseTo(30, 3)
      expect(scaled.w).toBeGreaterThan(cmd.w)
      expect(scaled.h).toBeGreaterThan(cmd.h)
    }
  })

  it('mapPointInOrientedFrame maps through rotated frame scale', () => {
    const start = { rect: { x: 0, y: 0, w: 0.2, h: 0.1 }, rotationDeg: 0 }
    const next = { rect: { x: 0, y: 0, w: 0.4, h: 0.2 }, rotationDeg: 0 }
    const mapped = mapPointInOrientedFrame([0.1, 0.05], start, next, 800, 600)
    expect(mapped[0]).toBeCloseTo(0.2, 3)
    expect(mapped[1]).toBeCloseTo(0.1, 3)
  })

  it('clampSelectionTranslationDelta stops before selection leaves canvas entirely', () => {
    const bounds = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }
    const farRight = clampSelectionTranslationDelta(bounds, 2, 0)
    expect(farRight.dx).toBeCloseTo(1 - SELECTION_MIN_VISIBLE_GRAB_NORM - bounds.x, 5)
    const farLeft = clampSelectionTranslationDelta(bounds, -2, 0)
    expect(farLeft.dx).toBeCloseTo(SELECTION_MIN_VISIBLE_GRAB_NORM - (bounds.x + bounds.w), 5)
  })

  it('clampSelectionMoveDelta applies to command selection bounds', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'rect',
        id: 'a',
        x: 0.85,
        y: 0.4,
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
    ]
    const { dx } = clampSelectionMoveDelta(commands, ['a'], 0.5, 0, 800, 600)
    expect(dx).toBeLessThan(0.5)
    expect(0.85 + dx + 0.1).toBeGreaterThan(1 - SELECTION_MIN_VISIBLE_GRAB_NORM - 1e-6)
  })
})
