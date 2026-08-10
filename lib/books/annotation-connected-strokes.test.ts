import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { ERASER_LINE_BASE_THRESHOLD } from '@/lib/books/annotation-geometry'
import { strokePadNorm } from '@/lib/books/annotation-select'
import {
  connectedComponentsAmongSelectedPenMarker,
  connectedPenMarkerStrokeIds,
  resolvePenMarkerSelectionIds,
  strokesAreConnected,
} from '@/lib/books/annotation-connected-strokes'

const W = 800
const H = 600

function penStroke(id: string, points: [number, number][], figureGroupId?: string): AnnotationCommand {
  return { kind: 'stroke', id, tool: 'pen', points, ...(figureGroupId ? { figureGroupId } : {}) }
}

function markerStroke(id: string, points: [number, number][]): AnnotationCommand {
  return { kind: 'stroke', id, tool: 'marker', points }
}

describe('annotation-connected-strokes', () => {
  it('groups crossing pen strokes', () => {
    const commands: AnnotationCommand[] = [
      penStroke('h', [
        [0.2, 0.5],
        [0.8, 0.5],
      ]),
      penStroke('v', [
        [0.5, 0.5],
        [0.5, 0.6],
      ]),
    ]
    expect(strokesAreConnected(commands[0] as never, commands[1] as never, W, H)).toBe(true)
    const ids = connectedPenMarkerStrokeIds(commands, 'h', W, H)
    expect(ids.sort()).toEqual(['h', 'v'])
  })

  it('never groups highlighter with pen, even when they touch', () => {
    const commands: AnnotationCommand[] = [
      penStroke('p', [
        [0.3, 0.4],
        [0.5, 0.4],
      ]),
      markerStroke('m', [
        [0.5, 0.4],
        [0.5, 0.55],
      ]),
    ]
    expect(
      strokesAreConnected(commands[0] as never, commands[1] as never, W, H),
    ).toBe(false)
    expect(connectedPenMarkerStrokeIds(commands, 'p', W, H)).toEqual(['p'])
    expect(connectedPenMarkerStrokeIds(commands, 'm', W, H)).toEqual(['m'])
    expect(resolvePenMarkerSelectionIds(commands, 'm', W, H)).toEqual(['m'])
  })

  it('never groups touching highlighter strokes together', () => {
    const commands: AnnotationCommand[] = [
      markerStroke('m1', [
        [0.2, 0.4],
        [0.5, 0.4],
      ]),
      markerStroke('m2', [
        [0.5, 0.4],
        [0.8, 0.4],
      ]),
    ]
    expect(connectedPenMarkerStrokeIds(commands, 'm1', W, H)).toEqual(['m1'])
    expect(resolvePenMarkerSelectionIds(commands, 'm1', W, H)).toEqual(['m1'])
  })

  it('groups chain A–B–C when only B bridges A and C', () => {
    const commands: AnnotationCommand[] = [
      penStroke('a', [
        [0.1, 0.5],
        [0.2, 0.5],
      ]),
      penStroke('b', [
        [0.2, 0.5],
        [0.35, 0.5],
      ]),
      penStroke('c', [
        [0.35, 0.5],
        [0.7, 0.5],
      ]),
    ]
    expect(strokesAreConnected(commands[0] as never, commands[1] as never, W, H)).toBe(true)
    expect(strokesAreConnected(commands[1] as never, commands[2] as never, W, H)).toBe(true)
    expect(strokesAreConnected(commands[0] as never, commands[2] as never, W, H)).toBe(false)
    const ids = connectedPenMarkerStrokeIds(commands, 'a', W, H)
    expect(ids.sort()).toEqual(['a', 'b', 'c'])
  })

  it('groups strokes within pad sum plus bridge gap', () => {
    const a = penStroke('a', [
      [0.2, 0.5],
      [0.3, 0.5],
    ])
    const padA = strokePadNorm(a as never, W, H)
    const padB = strokePadNorm(a as never, W, H)
    const gap = ERASER_LINE_BASE_THRESHOLD * 0.5
    const b = penStroke('b', [
      [0.3 + padA + padB + gap, 0.5],
      [0.5, 0.5],
    ])
    const commands = [a, b]
    expect(strokesAreConnected(commands[0] as never, commands[1] as never, W, H)).toBe(true)
    expect(connectedPenMarkerStrokeIds(commands, 'a', W, H).sort()).toEqual(['a', 'b'])
  })

  it('does not group strokes beyond bridge gap', () => {
    const a = penStroke('a', [
      [0.1, 0.5],
      [0.2, 0.5],
    ])
    const padA = strokePadNorm(a as never, W, H)
    const padB = strokePadNorm(a as never, W, H)
    const gap = ERASER_LINE_BASE_THRESHOLD * 3
    const b = penStroke('b', [
      [0.2 + padA + padB + gap, 0.5],
      [0.9, 0.5],
    ])
    const commands = [a, b]
    expect(strokesAreConnected(commands[0] as never, commands[1] as never, W, H)).toBe(false)
    expect(connectedPenMarkerStrokeIds(commands, 'a', W, H)).toEqual(['a'])
  })

  it('skips eraser strokes and dead indices', () => {
    const commands: AnnotationCommand[] = [
      penStroke('fig1', [
        [0.2, 0.3],
        [0.25, 0.35],
      ]),
      {
        kind: 'stroke',
        id: 'eraser',
        tool: 'eraser',
        points: [
          [0.25, 0.35],
          [0.3, 0.4],
        ],
      },
      penStroke('fig2', [
        [0.7, 0.7],
        [0.75, 0.75],
      ]),
    ]
    const ids = connectedPenMarkerStrokeIds(commands, 'fig1', W, H)
    expect(ids).toEqual(['fig1'])

    const dead = new Set([2])
    expect(connectedPenMarkerStrokeIds(commands, 'fig1', W, H, dead)).toEqual(['fig1'])
  })

  it('strokesAreConnected: same figureGroupId without geometry', () => {
    const a = penStroke('a', [[0.1, 0.1]], 'grp1')
    const b = penStroke('b', [[0.9, 0.9]], 'grp1')
    expect(strokesAreConnected(a as never, b as never, W, H)).toBe(true)
  })

  it('strokesAreConnected: different figureGroupIds are not connected', () => {
    const a = penStroke('a', [[0.5, 0.5]], 'g1')
    const b = penStroke('b', [[0.5, 0.5]], 'g2')
    expect(strokesAreConnected(a as never, b as never, W, H)).toBe(false)
  })

  it('connectedComponentsAmongSelectedPenMarker clusters only within selection', () => {
    const commands: AnnotationCommand[] = [
      penStroke('a', [
        [0.1, 0.5],
        [0.2, 0.5],
      ]),
      penStroke('b', [
        [0.2, 0.5],
        [0.3, 0.5],
      ]),
      penStroke('c', [
        [0.8, 0.5],
        [0.9, 0.5],
      ]),
    ]
    const comps = connectedComponentsAmongSelectedPenMarker(commands, ['a', 'b'], W, H)
    expect(comps).toHaveLength(1)
    expect(comps[0]!.sort()).toEqual(['a', 'b'])
  })

  it('resolvePenMarkerSelectionIds expands ungrouped touching pen strokes for move/select', () => {
    const commands: AnnotationCommand[] = [
      penStroke('head', [
        [0.5, 0.2],
        [0.5, 0.25],
      ]),
      penStroke('body', [
        [0.5, 0.25],
        [0.5, 0.45],
      ]),
      penStroke('leg', [
        [0.5, 0.45],
        [0.5, 0.6],
      ]),
    ]
    expect(resolvePenMarkerSelectionIds(commands, 'body', W, H).sort()).toEqual([
      'body',
      'head',
      'leg',
    ])
  })

  it('selects all figureGroupId members even when not touching', () => {
    const commands: AnnotationCommand[] = [
      penStroke('a', [[0.1, 0.1]], 'fig'),
      penStroke('b', [[0.9, 0.9]], 'fig'),
    ]
    expect(resolvePenMarkerSelectionIds(commands, 'a', W, H).sort()).toEqual(['a', 'b'])
  })

  it('ungrouped BFS does not cross into grouped strokes', () => {
    const commands: AnnotationCommand[] = [
      penStroke('free', [
        [0.5, 0.5],
        [0.52, 0.5],
      ]),
      penStroke('grouped', [
        [0.51, 0.5],
        [0.53, 0.5],
      ], 'grp'),
    ]
    const ids = connectedPenMarkerStrokeIds(commands, 'free', W, H)
    expect(ids).toEqual(['free'])
  })

  it('returns seed id when seed is not pen/marker', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'rect',
        id: 'r1',
        x: 0.1,
        y: 0.1,
        w: 0.2,
        h: 0.2,
        strokeColor: '#000',
      },
    ]
    expect(connectedPenMarkerStrokeIds(commands, 'r1', W, H)).toEqual(['r1'])
  })
})
