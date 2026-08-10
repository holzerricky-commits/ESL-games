import { describe, expect, it } from 'vitest'
import {
  annotationIdsInMarquee,
  getAnnotationBounds,
  hitTestAnnotationIndex,
  hitTestSelectedAnnotationIndex,
  isFullFigureGroupSelected,
  marqueeSelectModeFromDrag,
  orientedSelectionFrameForCommand,
  resolveMarqueeSelectMode,
  preferLiveRotationChromeFrame,
  resolveSelectionHandleFrame,
  selectionOutlineFramesForChrome,
  selectionOutlineRects,
  selectAllCommandIds,
  sharedRotationFrameFromStrokeMembers,
  translateAnnotationCommand,
  unionNormRects,
} from '@/lib/books/annotation-select'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { commitRotatedAnnotationCommands } from '@/lib/books/annotation-rotation'
import { sanitizeAnnotationCommands } from '@/lib/books/annotation-storage'

describe('annotation-select', () => {
  it('returns no bounds or hit for trim-empty text labels', () => {
    const emptyText: AnnotationCommand = {
      kind: 'text',
      id: 'empty',
      x: 0.2,
      y: 0.2,
      yAnchor: 'top',
      text: '   ',
      fontSizeNorm: 0.04,
      color: '#111',
    }
    expect(getAnnotationBounds(emptyText, 800, 600)).toBeNull()
    expect(hitTestAnnotationIndex([emptyText], 0.2, 0.2, 800, 600)).toBeNull()
    expect(selectionOutlineRects([emptyText], ['empty'], 800, 600, 'union')).toHaveLength(0)
  })

  it('hit-tests strokes and shapes top-to-bottom', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'rect',
        id: 'a',
        x: 0.1,
        y: 0.1,
        w: 0.2,
        h: 0.2,
        strokeColor: '#000',
      },
      {
        kind: 'stroke',
        id: 'b',
        tool: 'pen',
        points: [
          [0.15, 0.15],
          [0.25, 0.25],
        ],
      },
    ]
    const idx = hitTestAnnotationIndex(commands, 0.2, 0.2, 800, 600)
    expect(idx).toBe(1)
  })

  it('hit-tests only selected commands', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'rect',
        id: 'a',
        x: 0.1,
        y: 0.1,
        w: 0.2,
        h: 0.2,
        strokeColor: '#000',
      },
      {
        kind: 'rect',
        id: 'b',
        x: 0.5,
        y: 0.5,
        w: 0.2,
        h: 0.2,
        strokeColor: '#000',
      },
    ]
    expect(hitTestSelectedAnnotationIndex(commands, ['a'], 0.2, 0.2, 800, 600)).toBe(0)
    expect(hitTestSelectedAnnotationIndex(commands, ['a'], 0.6, 0.6, 800, 600)).toBeNull()
  })

  it('crossing marquee (right→left) selects touched stamps', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stamp',
        id: 's1',
        variant: 'check',
        center: [0.2, 0.2],
        color: '#16a34a',
      },
      {
        kind: 'stamp',
        id: 's2',
        variant: 'cross',
        center: [0.8, 0.8],
        color: '#dc2626',
      },
    ]
    const marquee = { x: 0, y: 0, w: 0.5, h: 0.5 }
    expect(marqueeSelectModeFromDrag([0.5, 0.1], [0.1, 0.3])).toBe('crossing')
    const ids = annotationIdsInMarquee(commands, marquee, 800, 600, 'crossing')
    expect(ids).toEqual(['s1'])
  })

  it('resolveMarqueeSelectMode respects rule vs drag', () => {
    const anchor: [number, number] = [0.5, 0.1]
    const right: [number, number] = [0.7, 0.3]
    const left: [number, number] = [0.1, 0.3]
    expect(resolveMarqueeSelectMode(anchor, right, 'follow-drag')).toBe('window')
    expect(resolveMarqueeSelectMode(anchor, left, 'follow-drag')).toBe('crossing')
    expect(resolveMarqueeSelectMode(anchor, right, 'crossing')).toBe('crossing')
    expect(resolveMarqueeSelectMode(anchor, left, 'window')).toBe('window')
  })

  it('window marquee (left→right) requires full enclosure', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'rect',
        id: 'inside',
        x: 0.12,
        y: 0.12,
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
      {
        kind: 'rect',
        id: 'straddle',
        x: 0.05,
        y: 0.05,
        w: 0.2,
        h: 0.2,
        strokeColor: '#000',
      },
    ]
    const marquee = { x: 0.1, y: 0.1, w: 0.15, h: 0.15 }
    expect(marqueeSelectModeFromDrag([0.1, 0.1], [0.25, 0.25])).toBe('window')
    expect(annotationIdsInMarquee(commands, marquee, 800, 600, 'window')).toEqual(['inside'])
    expect(annotationIdsInMarquee(commands, marquee, 800, 600, 'crossing')).toEqual([
      'inside',
      'straddle',
    ])
  })

  it('unions norm rects', () => {
    const u = unionNormRects([
      { x: 0.1, y: 0.2, w: 0.1, h: 0.1 },
      { x: 0.3, y: 0.1, w: 0.05, h: 0.2 },
    ])
    expect(u!.x).toBeCloseTo(0.1)
    expect(u!.y).toBeCloseTo(0.1)
    expect(u!.w).toBeCloseTo(0.25)
    expect(u!.h).toBeCloseTo(0.2)
  })

  const groupedPenCommands = (): AnnotationCommand[] => [
    {
      kind: 'stroke',
      id: 'a',
      tool: 'pen',
      figureGroupId: 'g1',
      points: [
        [0.1, 0.1],
        [0.2, 0.1],
      ],
    },
    {
      kind: 'stroke',
      id: 'b',
      tool: 'pen',
      figureGroupId: 'g1',
      points: [
        [0.5, 0.5],
        [0.6, 0.5],
      ],
    },
    {
      kind: 'stroke',
      id: 'c',
      tool: 'pen',
      points: [
        [0.8, 0.8],
        [0.85, 0.85],
      ],
    },
  ]

  it('isFullFigureGroupSelected when all members are selected', () => {
    const commands = groupedPenCommands()
    expect(isFullFigureGroupSelected(commands, ['a', 'b'], 'g1')).toBe(true)
    expect(isFullFigureGroupSelected(commands, ['a'], 'g1')).toBe(false)
  })

  it('selection outline union mode: one box for connected ungrouped strokes', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'head',
        tool: 'pen',
        points: [
          [0.5, 0.2],
          [0.5, 0.25],
        ],
      },
      {
        kind: 'stroke',
        id: 'body',
        tool: 'pen',
        points: [
          [0.5, 0.25],
          [0.5, 0.45],
        ],
      },
    ]
    expect(selectionOutlineRects(commands, ['head', 'body'], 800, 600, 'union')).toHaveLength(1)
  })

  it('selection outline union mode: one box for full group', () => {
    const commands = groupedPenCommands()
    expect(selectionOutlineRects(commands, ['a', 'b'], 800, 600, 'union')).toHaveLength(1)
  })

  it('selection outline perStroke mode: one box per grouped stroke', () => {
    const commands = groupedPenCommands()
    expect(selectionOutlineRects(commands, ['a', 'b'], 800, 600, 'perStroke')).toHaveLength(2)
  })

  it('selection outline union mode: partial group uses per-stroke boxes', () => {
    const commands = groupedPenCommands()
    expect(selectionOutlineRects(commands, ['a'], 800, 600, 'union')).toHaveLength(1)
  })

  it('selection outline uses one box per figure group plus ungrouped stroke', () => {
    const commands = groupedPenCommands()
    const rects = selectionOutlineRects(commands, ['a', 'b', 'c'], 800, 600, 'union')
    expect(rects).toHaveLength(2)
  })

  it('translates stroke points', () => {
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 'x',
      tool: 'pen',
      points: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    }
    const moved = translateAnnotationCommand(cmd, 0.05, 0.1)
    expect(moved.kind).toBe('stroke')
    if (moved.kind === 'stroke') {
      expect(moved.points[0]![0]).toBeCloseTo(0.15)
      expect(moved.points[0]![1]).toBeCloseTo(0.3)
    }
    const bounds = getAnnotationBounds(moved, 800, 600)
    expect(bounds).not.toBeNull()
  })

  it('stroke bounds extend past top-left when points are off-page', () => {
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 'x',
      tool: 'pen',
      points: [
        [-0.05, -0.04],
        [0.1, 0.08],
      ],
    }
    const bounds = getAnnotationBounds(cmd, 800, 600)
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeLessThan(0)
    expect(bounds!.y).toBeLessThan(0)
  })

  it('translates stroke points past page edges without squashing geometry', () => {
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 'x',
      tool: 'pen',
      points: [
        [0.85, 0.5],
        [0.95, 0.5],
      ],
    }
    const moved = translateAnnotationCommand(cmd, 0.2, 0)
    expect(moved.kind).toBe('stroke')
    if (moved.kind === 'stroke') {
      expect(moved.points[0]![0]).toBeCloseTo(1.05)
      expect(moved.points[1]![0]).toBeCloseTo(1.15)
      expect(moved.points[0]![0]).not.toBe(moved.points[1]![0])
    }
  })

  it('selectionOutlineFramesForChrome applies live rotation to pen stroke outline', () => {
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.4, 0.4],
        [0.6, 0.4],
      ],
      color: '#000',
      rotationBounds: { x: 0.38, y: 0.38, w: 0.24, h: 0.06 },
    }
    const startFrame = { rect: cmd.rotationBounds!, rotationDeg: 0 }
    const frames = selectionOutlineFramesForChrome(
      [cmd],
      ['s1'],
      800,
      600,
      'union',
      undefined,
      Math.PI / 4,
      startFrame,
    )
    expect(frames).toHaveLength(1)
    expect(frames[0]!.rotationDeg).toBeCloseTo(45, 3)
    expect(frames[0]!.rect).toEqual(startFrame.rect)
  })

  it('getAnnotationBounds inflates rect stroke by half line width', () => {
    const cmd: AnnotationCommand = {
      kind: 'rect',
      id: 'r1',
      x: 0.2,
      y: 0.2,
      w: 0.2,
      h: 0.1,
      strokeColor: '#000',
      strokeWidthScale: 2,
    }
    const bounds = getAnnotationBounds(cmd, 800, 600)!
    expect(bounds.x).toBeLessThan(0.2)
    expect(bounds.y).toBeLessThan(0.2)
    expect(bounds.x + bounds.w).toBeGreaterThan(0.4)
    expect(bounds.y + bounds.h).toBeGreaterThan(0.3)
  })

  it('brush pen bounds are at least as large as plain pen bounds', () => {
    const points: [number, number][] = [
      [0.3, 0.3],
      [0.5, 0.35],
    ]
    const plain: AnnotationCommand = {
      kind: 'stroke',
      id: 'p',
      tool: 'pen',
      points,
      color: '#000',
    }
    const brush: AnnotationCommand = {
      kind: 'stroke',
      id: 'b',
      tool: 'pen',
      points,
      color: '#000',
      penStrokeProfile: 'brush',
    }
    const plainBounds = getAnnotationBounds(plain, 800, 600)!
    const brushBounds = getAnnotationBounds(brush, 800, 600)!
    expect(brushBounds.w).toBeGreaterThanOrEqual(plainBounds.w)
    expect(brushBounds.h).toBeGreaterThanOrEqual(plainBounds.h)
  })

  it('selectionOutlineFramesForChrome uses scaled bounds with stale committed rotation frame', () => {
    const preScaleBounds = { x: 0.28, y: 0.48, w: 0.44, h: 0.06 }
    const scaledBounds = { x: 0.26, y: 0.46, w: 0.48, h: 0.08 }
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'a',
        tool: 'pen',
        figureGroupId: 'g1',
        points: [
          [0.3, 0.5],
          [0.4, 0.5],
        ],
        color: '#000',
        rotationBounds: scaledBounds,
        rotationDeg: 45,
      },
      {
        kind: 'stroke',
        id: 'b',
        tool: 'pen',
        figureGroupId: 'g1',
        points: [
          [0.6, 0.5],
          [0.7, 0.5],
        ],
        color: '#000',
        rotationBounds: scaledBounds,
        rotationDeg: 45,
      },
    ]
    const committedFrame = { rect: preScaleBounds, rotationDeg: 45 }
    const frames = selectionOutlineFramesForChrome(
      commands,
      ['a', 'b'],
      800,
      600,
      'union',
      undefined,
      null,
      null,
      committedFrame,
    )
    expect(frames).toHaveLength(1)
    expect(frames[0]!.rect).toEqual(scaledBounds)
    expect(frames[0]!.rotationDeg).toBeCloseTo(45, 3)
  })

  it('resolveSelectionHandleFrame prefers scaled shared bounds over committed snapshot', () => {
    const preScaleBounds = { x: 0.28, y: 0.48, w: 0.44, h: 0.06 }
    const scaledBounds = { x: 0.26, y: 0.46, w: 0.48, h: 0.08 }
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'a',
        tool: 'pen',
        points: [
          [0.3, 0.5],
          [0.4, 0.5],
        ],
        color: '#000',
        rotationBounds: scaledBounds,
        rotationDeg: 45,
      },
      {
        kind: 'stroke',
        id: 'b',
        tool: 'pen',
        points: [
          [0.6, 0.5],
          [0.7, 0.5],
        ],
        color: '#000',
        rotationBounds: scaledBounds,
        rotationDeg: 45,
      },
    ]
    const frame = resolveSelectionHandleFrame(
      commands,
      ['a', 'b'],
      800,
      600,
      { x: 0.26, y: 0.46, w: 0.48, h: 0.08 },
      null,
      null,
      { rect: preScaleBounds, rotationDeg: 45 },
    )
    expect(frame?.rect).toEqual(scaledBounds)
    expect(preferLiveRotationChromeFrame(commands, ['a', 'b'], 800, 600, {
      rect: preScaleBounds,
      rotationDeg: 45,
    }).rect).toEqual(scaledBounds)
  })

  it('selectionOutlineFramesForChrome keeps shared rotation for re-selected figure group', () => {
    const sharedBounds = { x: 0.28, y: 0.48, w: 0.44, h: 0.06 }
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'a',
        tool: 'pen',
        figureGroupId: 'g1',
        points: [
          [0.3, 0.5],
          [0.4, 0.5],
        ],
        color: '#000',
        rotationBounds: sharedBounds,
        rotationDeg: 45,
      },
      {
        kind: 'stroke',
        id: 'b',
        tool: 'pen',
        figureGroupId: 'g1',
        points: [
          [0.6, 0.5],
          [0.7, 0.5],
        ],
        color: '#000',
        rotationBounds: sharedBounds,
        rotationDeg: 45,
      },
    ]
    expect(sharedRotationFrameFromStrokeMembers(commands as never)).toEqual({
      rect: sharedBounds,
      rotationDeg: 45,
    })
    const frames = selectionOutlineFramesForChrome(commands, ['a', 'b'], 800, 600)
    expect(frames).toHaveLength(1)
    expect(frames[0]!.rotationDeg).toBeCloseTo(45, 3)
    expect(frames[0]!.rect).toEqual(sharedBounds)
  })

  it('selectionOutlineFramesForChrome keeps rotationDeg for lone auto-grouped pen stroke', () => {
    const stroke: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      figureGroupId: 'g1',
      points: [
        [0.5, 0.5],
        [0.6, 0.5],
      ],
      color: '#000',
      rotationBounds: { x: 0.48, y: 0.48, w: 0.14, h: 0.06 },
      rotationDeg: 45,
    }
    const frames = selectionOutlineFramesForChrome([stroke], ['s1'], 800, 600)
    expect(frames).toHaveLength(1)
    expect(frames[0]!.rotationDeg).toBeCloseTo(45, 3)
    expect(frames[0]!.rect).toEqual(stroke.rotationBounds)
  })

  it('selectionOutlineFramesForChrome keeps rotationDeg after commit without live delta', () => {
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
    const previewBase = [
      {
        ...stroke,
        rotationBounds: { x: 0.48, y: 0.48, w: 0.14, h: 0.06 },
      },
    ]
    const committed = commitRotatedAnnotationCommands(
      [stroke],
      new Set(['s1']),
      [0.55, 0.5],
      Math.PI / 2,
      { widthPx: 800, heightPx: 600 },
      previewBase,
    )
    const frames = selectionOutlineFramesForChrome(committed, ['s1'], 800, 600)
    expect(frames).toHaveLength(1)
    expect(frames[0]!.rotationDeg).toBeCloseTo(90, 3)
    const frame = orientedSelectionFrameForCommand(committed[0]!, 800, 600)
    expect(frame?.rotationDeg).toBeCloseTo(90, 3)
  })

  it('sanitizeAnnotationCommands keeps pen stroke rotation fields', () => {
    const raw = [
      {
        kind: 'stroke',
        id: 's1',
        tool: 'pen',
        points: [
          [0.4, 0.4],
          [0.6, 0.4],
        ],
        color: '#112233',
        rotationBounds: { x: 0.38, y: 0.38, w: 0.24, h: 0.06 },
        rotationDeg: 45,
      },
    ]
    const clean = sanitizeAnnotationCommands(raw)
    expect(clean).toHaveLength(1)
    const stroke = clean[0]!
    expect(stroke.kind).toBe('stroke')
    if (stroke.kind === 'stroke') {
      expect(stroke.rotationBounds).toEqual({ x: 0.38, y: 0.38, w: 0.24, h: 0.06 })
      expect(stroke.rotationDeg).toBeCloseTo(45, 3)
    }
  })
})

describe('selectAllCommandIds', () => {
  it('skips locked shapes unless includeLocked is true', () => {
    const commands = [
      {
        kind: 'rect' as const,
        id: 'free',
        x: 0.1,
        y: 0.1,
        w: 0.2,
        h: 0.1,
        strokeColor: '#111827',
      },
      {
        kind: 'rect' as const,
        id: 'locked',
        x: 0.4,
        y: 0.1,
        w: 0.2,
        h: 0.1,
        strokeColor: '#111827',
        locked: true,
      },
    ]
    expect(selectAllCommandIds(commands, false)).toEqual(['free'])
    expect(selectAllCommandIds(commands, true)).toEqual(['free', 'locked'])
  })
})

describe('selectAllCommandIds', () => {
  it('skips locked shapes unless includeLocked is true', () => {
    const commands = [
      {
        kind: 'rect' as const,
        id: 'free',
        x: 0.1,
        y: 0.1,
        w: 0.2,
        h: 0.1,
        strokeColor: '#111827',
      },
      {
        kind: 'rect' as const,
        id: 'locked',
        x: 0.4,
        y: 0.1,
        w: 0.2,
        h: 0.1,
        strokeColor: '#111827',
        locked: true,
      },
    ]
    expect(selectAllCommandIds(commands, false)).toEqual(['free'])
    expect(selectAllCommandIds(commands, true)).toEqual(['free', 'locked'])
  })
})
