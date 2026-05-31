import { describe, expect, it } from 'vitest'
import {
  annotationIdsInMarquee,
  getAnnotationBounds,
  hitTestAnnotationIndex,
  hitTestSelectedAnnotationIndex,
  isFullFigureGroupSelected,
  marqueeSelectModeFromDrag,
  resolveMarqueeSelectMode,
  selectionOutlineRects,
  translateAnnotationCommand,
  unionNormRects,
} from '@/lib/books/annotation-select'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

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
})
