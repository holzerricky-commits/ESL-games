import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type { OrientedSelectionFrame } from '@/lib/books/annotation-select'
import { SELECTION_ROTATION_HANDLE_SIZE_PX } from '@/lib/books/annotation-selection-chrome'
import {
  angleFromPivotToPoint,
  boxShapeRotatedBounds,
  hitTestRotationHandle,
  hitTestRotationHandleForFrame,
  normalizeDeg,
  rotationHandleNormPositionForFrame,
  SELECTION_ROTATION_HANDLE_OFFSET_PX,
  commitRotatedAnnotationCommands,
  isRotateCommitOverlaySynced,
  mergeRotatedCommandOverlay,
  rotateAnnotationCommand,
  rotateAnnotationCommands,
  rotateNormPointInPixelSpace,
  rotatePointAroundPivot,
  selectionPivotFromBounds,
} from '@/lib/books/annotation-rotation'

/** Independent geometry matching selection-bounds-chrome OrientedFrameShell layout. */
function visualRotationHandleNorm(
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): [number, number] {
  const half = SELECTION_ROTATION_HANDLE_SIZE_PX / 2
  const cx = (frame.rect.x + frame.rect.w / 2) * widthPx
  const cy = (frame.rect.y + frame.rect.h / 2) * heightPx
  const hPx = frame.rect.h * heightPx
  const d = hPx / 2 + SELECTION_ROTATION_HANDLE_OFFSET_PX + half
  const rad = (frame.rotationDeg * Math.PI) / 180
  return [(cx + d * Math.sin(rad)) / widthPx, (cy - d * Math.cos(rad)) / heightPx]
}

describe('annotation-rotation', () => {
  it('rotatePointAroundPivot rotates 90deg around origin', () => {
    const next = rotatePointAroundPivot([1, 0], [0, 0], Math.PI / 2)
    expect(next[0]).toBeCloseTo(0, 5)
    expect(next[1]).toBeCloseTo(1, 5)
  })

  it('boxShapeRotatedBounds expands for rotated rect', () => {
    const bounds = boxShapeRotatedBounds({
      x: 0.4,
      y: 0.4,
      w: 0.2,
      h: 0.1,
      rotationDeg: 45,
    })
    expect(bounds.w).toBeGreaterThan(0.2)
    expect(bounds.h).toBeGreaterThan(0.1)
  })

  it('rotateAnnotationCommand adds rotationDeg on rect', () => {
    const cmd: AnnotationCommand = {
      kind: 'rect',
      id: 'r1',
      x: 0.2,
      y: 0.2,
      w: 0.2,
      h: 0.1,
      strokeColor: '#000',
    }
    const next = rotateAnnotationCommand(cmd, [0.3, 0.25], Math.PI / 4)
    expect(next.kind).toBe('rect')
    if (next.kind === 'rect') {
      expect(next.rotationDeg).toBeCloseTo(45, 3)
      expect(next.x).toBeCloseTo(0.2, 5)
    }
  })

  it('rotateAnnotationCommand rotates line endpoints', () => {
    const cmd: AnnotationCommand = {
      kind: 'line',
      id: 'l1',
      a: [0.5, 0.5],
      b: [0.6, 0.5],
      color: '#000',
    }
    const next = rotateAnnotationCommand(cmd, [0.5, 0.5], Math.PI / 2)
    expect(next.kind).toBe('line')
    if (next.kind === 'line') {
      expect(next.a[0]).toBeCloseTo(0.5, 5)
      expect(next.a[1]).toBeCloseTo(0.5, 5)
      expect(next.b[0]).toBeCloseTo(0.5, 5)
      expect(next.b[1]).toBeCloseTo(0.6, 5)
    }
  })

  it('rotateAnnotationCommands only touches selected ids', () => {
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
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
    ]
    const next = rotateAnnotationCommands(commands, new Set(['a']), [0.15, 0.15], Math.PI / 2)
    expect(next[0]!.kind).toBe('rect')
    if (next[0]!.kind === 'rect') expect(next[0]!.rotationDeg).toBeCloseTo(90, 3)
    if (next[1]!.kind === 'rect') expect(next[1]!.rotationDeg).toBeUndefined()
  })

  it('rotation handle position matches visual chrome when rotated', () => {
    const widthPx = 800
    const heightPx = 600
    for (const rotationDeg of [0, 45, 90, 135, 180]) {
      const frame = { rect: { x: 0.3, y: 0.3, w: 0.2, h: 0.1 }, rotationDeg }
      const expected = visualRotationHandleNorm(frame, widthPx, heightPx)
      const actual = rotationHandleNormPositionForFrame(frame, widthPx, heightPx)
      expect(actual[0]).toBeCloseTo(expected[0], 5)
      expect(actual[1]).toBeCloseTo(expected[1], 5)
      expect(hitTestRotationHandleForFrame(expected, frame, widthPx, heightPx, 24)).toBe(true)
    }
  })

  it('rotation handle miss is far from visual chrome at 90deg', () => {
    const frame = { rect: { x: 0.3, y: 0.3, w: 0.2, h: 0.1 }, rotationDeg: 90 }
    const widthPx = 800
    const heightPx = 600
    const [hx, hy] = visualRotationHandleNorm(frame, widthPx, heightPx)
    // Legacy bug: offset from top-center in norm space (not where the handle is drawn).
    const topY = frame.rect.y
    const offsetNorm = SELECTION_ROTATION_HANDLE_OFFSET_PX / heightPx
    const legacyX = frame.rect.x + frame.rect.w / 2 - offsetNorm
    const legacyY = topY
    const dx = (legacyX - hx) * widthPx
    const dy = (legacyY - hy) * heightPx
    expect(dx * dx + dy * dy).toBeGreaterThan(24 * 24)
    expect(hitTestRotationHandleForFrame([legacyX, legacyY], frame, widthPx, heightPx, 24)).toBe(
      false,
    )
  })

  it('hitTestRotationHandle finds handle above selection', () => {
    const bounds = { x: 0.2, y: 0.3, w: 0.4, h: 0.2 }
    const pivot = selectionPivotFromBounds(bounds)
    const angle = angleFromPivotToPoint(pivot, [pivot[0], bounds.y - 0.05])
    const probe: [number, number] = [
      pivot[0] + Math.cos(angle) * 0.001,
      pivot[1] + Math.sin(angle) * 0.001,
    ]
    void probe
    const hit = hitTestRotationHandle([0.4, 0.24], bounds, 800, 600, 24)
    expect(hit).toBe(true)
  })

  it('normalizeDeg wraps negative angles', () => {
    expect(normalizeDeg(-90)).toBeCloseTo(270, 5)
  })

  it('rotateAnnotationCommands snapshots rotationBounds and sets rotationDeg on pen stroke', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 's1',
        tool: 'pen',
        points: [
          [0.5, 0.5],
          [0.6, 0.5],
        ],
        color: '#000',
      },
    ]
    const next = rotateAnnotationCommands(commands, new Set(['s1']), [0.55, 0.5], Math.PI / 2, {
      widthPx: 800,
      heightPx: 600,
    })
    const stroke = next[0]!
    expect(stroke.kind).toBe('stroke')
    if (stroke.kind === 'stroke') {
      expect(stroke.rotationBounds).toBeDefined()
      expect(stroke.rotationDeg).toBeCloseTo(90, 3)
      expect(stroke.points[1]![0]).toBeCloseTo(0.6, 5)
    }
  })

  it('commitRotatedAnnotationCommands merges live preview onto full stack', () => {
    const stroke: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.5, 0.5],
        [0.6, 0.5],
      ],
      color: '#000',
    }
    const text: AnnotationCommand = {
      kind: 'text',
      id: 't1',
      x: 0.1,
      y: 0.1,
      yAnchor: 'top',
      text: 'hi',
      fontSizeNorm: 0.04,
      color: '#111',
    }
    const commands = [stroke, text]
    const previewBase = [
      {
        ...stroke,
        rotationBounds: { x: 0.48, y: 0.48, w: 0.14, h: 0.06 },
      },
      text,
    ]
    const next = commitRotatedAnnotationCommands(
      commands,
      new Set(['s1']),
      [0.55, 0.5],
      Math.PI / 2,
      { widthPx: 800, heightPx: 600 },
      previewBase,
    )
    const committed = next[0]!
    expect(committed.kind).toBe('stroke')
    if (committed.kind === 'stroke') {
      expect(committed.rotationDeg).toBeCloseTo(90, 3)
      expect(committed.rotationBounds).toBeDefined()
    }
    expect(next[1]).toBe(text)
  })

  it('rotateAnnotationCommand adds rotationDeg on pen stroke without moving points', () => {
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.5, 0.5],
        [0.6, 0.5],
      ],
      color: '#000',
      rotationBounds: { x: 0.48, y: 0.48, w: 0.14, h: 0.06 },
    }
    const next = rotateAnnotationCommand(cmd, [0.5, 0.5], Math.PI / 2)
    expect(next.kind).toBe('stroke')
    if (next.kind === 'stroke') {
      expect(next.rotationDeg).toBeCloseTo(90, 3)
      expect(next.points[1]![0]).toBeCloseTo(0.6, 5)
      expect(next.points[1]![1]).toBeCloseTo(0.5, 5)
    }
  })

  it('rotateAnnotationCommand skips eraser strokes', () => {
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 'e1',
      tool: 'eraser',
      points: [
        [0.2, 0.2],
        [0.3, 0.3],
      ],
    }
    const next = rotateAnnotationCommand(cmd, [0.25, 0.25], Math.PI / 2)
    expect(next).toEqual(cmd)
  })

  it('rotateAnnotationCommands stores shared rotation on grouped strokes without moving points', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 's1',
        tool: 'pen',
        points: [[0.3, 0.4]],
        color: '#000',
      },
      {
        kind: 'stroke',
        id: 's2',
        tool: 'pen',
        points: [[0.7, 0.4]],
        color: '#000',
      },
    ]
    const groupFrame = { rect: { x: 0.28, y: 0.38, w: 0.44, h: 0.06 }, rotationDeg: 0 }
    const next = rotateAnnotationCommands(
      commands,
      new Set(['s1', 's2']),
      [0.5, 0.41],
      Math.PI / 2,
      { widthPx: 800, heightPx: 600 },
      groupFrame,
    )
    const s1 = next.find((c) => c.id === 's1')!
    const s2 = next.find((c) => c.id === 's2')!
    expect(s1.kind).toBe('stroke')
    expect(s2.kind).toBe('stroke')
    if (s1.kind === 'stroke' && s2.kind === 'stroke') {
      expect(s1.points[0]![0]).toBeCloseTo(0.3, 5)
      expect(s2.points[0]![0]).toBeCloseTo(0.7, 5)
      expect(s1.rotationDeg).toBeCloseTo(90, 3)
      expect(s2.rotationDeg).toBeCloseTo(90, 3)
      expect(s1.rotationBounds).toEqual(groupFrame.rect)
      expect(s2.rotationBounds).toEqual(groupFrame.rect)
    }
  })

  it('mergeRotatedCommandOverlay applies baked group rotation points when rotationDeg is zero', () => {
    const base: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.3, 0.5],
        [0.4, 0.5],
      ],
      color: '#000',
    }
    const overlay: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.7, 0.5],
        [0.6, 0.5],
      ],
      color: '#000',
      rotationBounds: { x: 0.58, y: 0.48, w: 0.14, h: 0.06 },
    }
    const merged = mergeRotatedCommandOverlay([base], [overlay])
    expect(merged[0]!.kind).toBe('stroke')
    if (merged[0]!.kind === 'stroke') {
      expect(merged[0]!.points[0]![0]).toBeCloseTo(0.7, 3)
      expect(merged[0]!.rotationBounds?.x).toBeCloseTo(0.58, 3)
    }
    expect(isRotateCommitOverlaySynced([overlay], merged)).toBe(true)
  })

  it('rotateAnnotationCommands rotates grouped pen strokes around a shared pivot', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'left',
        tool: 'pen',
        points: [
          [0.3, 0.5],
          [0.4, 0.5],
        ],
        color: '#000',
        figureGroupId: 'stick',
      },
      {
        kind: 'stroke',
        id: 'right',
        tool: 'pen',
        points: [
          [0.6, 0.5],
          [0.7, 0.5],
        ],
        color: '#000',
        figureGroupId: 'stick',
      },
    ]
    const groupFrame = { rect: { x: 0.28, y: 0.48, w: 0.44, h: 0.06 }, rotationDeg: 0 }
    const next = rotateAnnotationCommands(
      commands,
      new Set(['left', 'right']),
      [0.5, 0.5],
      Math.PI,
      { widthPx: 800, heightPx: 600 },
      groupFrame,
    )
    const left = next.find((c) => c.id === 'left')!
    const right = next.find((c) => c.id === 'right')!
    expect(left.kind).toBe('stroke')
    expect(right.kind).toBe('stroke')
    if (left.kind === 'stroke' && right.kind === 'stroke') {
      expect(left.rotationDeg).toBeCloseTo(180, 3)
      expect(right.rotationDeg).toBeCloseTo(180, 3)
      expect(left.points[0]![0]).toBeCloseTo(0.3, 5)
      expect(right.points[0]![0]).toBeCloseTo(0.6, 5)
      expect(left.rotationBounds).toEqual(groupFrame.rect)
      expect(right.rotationBounds).toEqual(groupFrame.rect)
    }
  })

  it('rotateAnnotationCommands orbits box shapes around group pivot in mixed pen+rect selection', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'stroke1',
        tool: 'pen',
        points: [
          [0.4, 0.5],
          [0.5, 0.5],
        ],
        color: '#000',
      },
      {
        kind: 'rect',
        id: 'rect1',
        x: 0.55,
        y: 0.45,
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
    ]
    const layout = { widthPx: 800, heightPx: 600 }
    const groupFrame = { rect: { x: 0.38, y: 0.43, w: 0.28, h: 0.14 }, rotationDeg: 0 }
    const pivot: [number, number] = [0.52, 0.5]
    const next = rotateAnnotationCommands(
      commands,
      new Set(['stroke1', 'rect1']),
      pivot,
      Math.PI / 2,
      layout,
      groupFrame,
    )
    const stroke = next.find((c) => c.id === 'stroke1')!
    const rect = next.find((c) => c.id === 'rect1')!
    expect(stroke.kind).toBe('stroke')
    expect(rect.kind).toBe('rect')
    if (stroke.kind === 'stroke' && rect.kind === 'rect') {
      expect(stroke.points[0]![0]).toBeCloseTo(0.4, 5)
      expect(stroke.rotationDeg).toBeCloseTo(90, 3)
      const expectedCenter = rotateNormPointInPixelSpace(
        [0.6, 0.5],
        pivot,
        Math.PI / 2,
        layout.widthPx,
        layout.heightPx,
      )
      expect(rect.x + rect.w / 2).toBeCloseTo(expectedCenter[0], 4)
      expect(rect.y + rect.h / 2).toBeCloseTo(expectedCenter[1], 4)
      expect(rect.x).not.toBeCloseTo(0.55, 2)
      expect(rect.rotationDeg).toBeCloseTo(90, 3)
    }
  })

  it('rotateAnnotationCommands orbits lines with pen strokes in mixed group selection', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'stroke1',
        tool: 'pen',
        points: [
          [0.35, 0.5],
          [0.45, 0.5],
        ],
        color: '#000',
      },
      {
        kind: 'line',
        id: 'line1',
        a: [0.55, 0.48],
        b: [0.65, 0.52],
        color: '#000',
      },
    ]
    const layout = { widthPx: 800, heightPx: 600 }
    const groupFrame = { rect: { x: 0.33, y: 0.46, w: 0.34, h: 0.08 }, rotationDeg: 0 }
    const pivot: [number, number] = [0.5, 0.5]
    const next = rotateAnnotationCommands(
      commands,
      new Set(['stroke1', 'line1']),
      pivot,
      Math.PI / 2,
      layout,
      groupFrame,
    )
    const stroke = next.find((c) => c.id === 'stroke1')!
    const line = next.find((c) => c.id === 'line1')!
    expect(stroke.kind).toBe('stroke')
    expect(line.kind).toBe('line')
    if (stroke.kind === 'stroke' && line.kind === 'line') {
      expect(stroke.points[0]![0]).toBeCloseTo(0.35, 5)
      const expectedA = rotateNormPointInPixelSpace(
        [0.55, 0.48],
        pivot,
        Math.PI / 2,
        layout.widthPx,
        layout.heightPx,
      )
      const expectedB = rotateNormPointInPixelSpace(
        [0.65, 0.52],
        pivot,
        Math.PI / 2,
        layout.widthPx,
        layout.heightPx,
      )
      expect(line.a[0]).toBeCloseTo(expectedA[0], 4)
      expect(line.a[1]).toBeCloseTo(expectedA[1], 4)
      expect(line.b[0]).toBeCloseTo(expectedB[0], 4)
      expect(line.b[1]).toBeCloseTo(expectedB[1], 4)
    }
  })

  it('mergeRotatedCommandOverlay patches rotation only and follows live moves', () => {
    const stroke: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.5, 0.5],
        [0.6, 0.5],
      ],
      color: '#000',
    }
    const committed = commitRotatedAnnotationCommands(
      [stroke],
      new Set(['s1']),
      [0.55, 0.5],
      Math.PI / 2,
      { widthPx: 800, heightPx: 600 },
      [
        {
          ...stroke,
          rotationBounds: { x: 0.48, y: 0.48, w: 0.14, h: 0.06 },
        },
      ],
    )
    const overlay = committed.filter((c) => c.id === 's1')
    const movedLive: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.55, 0.55],
        [0.65, 0.55],
      ],
      color: '#000',
      rotationBounds: { x: 0.53, y: 0.53, w: 0.14, h: 0.06 },
    }
    const merged = mergeRotatedCommandOverlay([movedLive], overlay)
    expect(merged[0]!.kind).toBe('stroke')
    if (merged[0]!.kind === 'stroke') {
      expect(merged[0]!.rotationDeg).toBeCloseTo(90, 3)
      expect(merged[0]!.points[0]![0]).toBeCloseTo(0.55, 3)
      expect(merged[0]!.rotationBounds?.x).toBeCloseTo(0.53, 3)
    }
    expect(isRotateCommitOverlaySynced(overlay, [stroke])).toBe(false)
    expect(isRotateCommitOverlaySynced(overlay, committed)).toBe(true)
  })
})
