import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  autoGroupPenStrokeAfterCommit,
  connectedPenStrokeIdsForAutoGroup,
} from '@/lib/books/annotation-pen-auto-group'

function pen(
  id: string,
  points: [number, number][],
  figureGroupId?: string,
): AnnotationCommand {
  return {
    kind: 'stroke',
    id,
    tool: 'pen',
    points,
    ...(figureGroupId ? { figureGroupId } : {}),
  }
}

describe('annotation-pen-auto-group', () => {
  it('connectedPenStrokeIdsForAutoGroup includes grouped pen neighbors', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ]),
      pen(
        'b',
        [
          [0.19, 0.1],
          [0.35, 0.1],
        ],
        'grp1',
      ),
    ]
    const ids = connectedPenStrokeIdsForAutoGroup(commands, 'a', 800, 600)
    expect(ids.sort()).toEqual(['a', 'b'])
  })

  it('autoGroupPenStrokeAfterCommit groups touching ungrouped pens', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ]),
    ]
    const next = autoGroupPenStrokeAfterCommit(
      [
        ...commands,
        pen('b', [
          [0.19, 0.1],
          [0.35, 0.1],
        ]),
      ],
      'b',
      800,
      600,
    )
    const ga = (next.find((c) => c.id === 'a') as { figureGroupId?: string }).figureGroupId
    const gb = (next.find((c) => c.id === 'b') as { figureGroupId?: string }).figureGroupId
    expect(ga).toBeTruthy()
    expect(ga).toBe(gb)
  })

  it('autoGroupPenStrokeAfterCommit joins existing group', () => {
    const commands: AnnotationCommand[] = [
      pen(
        'a',
        [
          [0.1, 0.1],
          [0.2, 0.1],
        ],
        'existing',
      ),
    ]
    const next = autoGroupPenStrokeAfterCommit(
      [
        ...commands,
        pen('b', [
          [0.19, 0.1],
          [0.35, 0.1],
        ]),
      ],
      'b',
      800,
      600,
    )
    expect((next.find((c) => c.id === 'b') as { figureGroupId?: string }).figureGroupId).toBe(
      'existing',
    )
  })

  it('does not merge strokes in different figure groups without geometry bridge', () => {
    const commands: AnnotationCommand[] = [
      pen(
        'a',
        [
          [0.1, 0.1],
          [0.15, 0.1],
        ],
        'g1',
      ),
      pen(
        'b',
        [
          [0.8, 0.8],
          [0.85, 0.8],
        ],
        'g2',
      ),
    ]
    const ids = connectedPenStrokeIdsForAutoGroup(commands, 'a', 800, 600)
    expect(ids).toEqual(['a'])
  })

  it('ignores marker strokes', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ]),
      {
        kind: 'stroke',
        id: 'm',
        tool: 'marker',
        points: [
          [0.19, 0.1],
          [0.35, 0.1],
        ],
      },
    ]
    const ids = connectedPenStrokeIdsForAutoGroup(commands, 'a', 800, 600)
    expect(ids).toEqual(['a'])
  })
})
