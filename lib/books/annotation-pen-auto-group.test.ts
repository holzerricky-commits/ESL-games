import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { PEN_AUTO_GROUP_IDLE_MS } from '@/lib/books/pen-auto-group-config'
import {
  appendCommandWithPenAutoGroup,
  autoGroupPenStrokeAfterCommit,
  connectedPenStrokeIdsForAutoGroup,
  lockPenFigureAutoJoinOnCommands,
} from '@/lib/books/annotation-pen-auto-group'

const T0 = 1_700_000_000_000

function pen(
  id: string,
  points: [number, number][],
  opts?: { figureGroupId?: string; committedAtMs?: number; figureAutoJoinClosed?: boolean },
): AnnotationCommand {
  return {
    kind: 'stroke',
    id,
    tool: 'pen',
    points,
    ...(opts?.figureGroupId ? { figureGroupId: opts.figureGroupId } : {}),
    ...(opts?.committedAtMs != null ? { committedAtMs: opts.committedAtMs } : {}),
    ...(opts?.figureAutoJoinClosed ? { figureAutoJoinClosed: true } : {}),
  }
}

describe('annotation-pen-auto-group', () => {
  it('connectedPenStrokeIdsForAutoGroup includes grouped pen neighbors within idle window', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ], { committedAtMs: T0, figureGroupId: 'grp1' }),
      pen(
        'b',
        [
          [0.19, 0.1],
          [0.35, 0.1],
        ],
        { committedAtMs: T0 + 1000, figureGroupId: 'grp1' },
      ),
    ]
    const ids = connectedPenStrokeIdsForAutoGroup(commands, 'a', 800, 600)
    expect(ids.sort()).toEqual(['a', 'b'])
  })

  it('autoGroupPenStrokeAfterCommit groups touching ungrouped pens within idle window', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ], { committedAtMs: T0 }),
    ]
    const next = autoGroupPenStrokeAfterCommit(
      [
        ...commands,
        pen('b', [
          [0.19, 0.1],
          [0.35, 0.1],
        ], { committedAtMs: T0 + 2000 }),
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

  it('autoGroupPenStrokeAfterCommit joins existing open group within idle window', () => {
    const commands: AnnotationCommand[] = [
      pen(
        'a',
        [
          [0.1, 0.1],
          [0.2, 0.1],
        ],
        { committedAtMs: T0, figureGroupId: 'existing' },
      ),
    ]
    const next = autoGroupPenStrokeAfterCommit(
      [
        ...commands,
        pen('b', [
          [0.19, 0.1],
          [0.35, 0.1],
        ], { committedAtMs: T0 + 3000 }),
      ],
      'b',
      800,
      600,
    )
    expect((next.find((c) => c.id === 'b') as { figureGroupId?: string }).figureGroupId).toBe(
      'existing',
    )
  })

  it('does not merge when idle gap exceeded', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ], { committedAtMs: T0 }),
    ]
    const next = autoGroupPenStrokeAfterCommit(
      [
        ...commands,
        pen('b', [
          [0.19, 0.1],
          [0.35, 0.1],
        ], { committedAtMs: T0 + PEN_AUTO_GROUP_IDLE_MS + 1 }),
      ],
      'b',
      800,
      600,
    )
    const ga = (next.find((c) => c.id === 'a') as { figureGroupId?: string }).figureGroupId
    const gb = (next.find((c) => c.id === 'b') as { figureGroupId?: string }).figureGroupId
    expect(ga).toBeUndefined()
    expect(gb).toBeTruthy()
    expect(gb).not.toBe(ga)
  })

  it('does not merge into a closed figure group', () => {
    const commands: AnnotationCommand[] = [
      pen(
        'a',
        [
          [0.1, 0.1],
          [0.2, 0.1],
        ],
        { committedAtMs: T0, figureGroupId: 'grp1', figureAutoJoinClosed: true },
      ),
    ]
    const next = autoGroupPenStrokeAfterCommit(
      [
        ...commands,
        pen('b', [
          [0.19, 0.1],
          [0.35, 0.1],
        ], { committedAtMs: T0 + 1000 }),
      ],
      'b',
      800,
      600,
    )
    const gb = (next.find((c) => c.id === 'b') as { figureGroupId?: string }).figureGroupId
    expect(gb).toBeTruthy()
    expect(gb).not.toBe('grp1')
  })

  it('lockPenFigureAutoJoinOnCommands marks grouped pen strokes closed', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [[0.1, 0.1]], { figureGroupId: 'g1', committedAtMs: T0 }),
      pen('b', [[0.2, 0.2]], { committedAtMs: T0 }),
    ]
    const next = lockPenFigureAutoJoinOnCommands(commands)
    expect((next.find((c) => c.id === 'a') as { figureAutoJoinClosed?: boolean }).figureAutoJoinClosed).toBe(
      true,
    )
    expect((next.find((c) => c.id === 'b') as { figureAutoJoinClosed?: boolean }).figureAutoJoinClosed).toBeUndefined()
  })

  it('does not merge strokes in different figure groups without geometry bridge', () => {
    const commands: AnnotationCommand[] = [
      pen(
        'a',
        [
          [0.1, 0.1],
          [0.15, 0.1],
        ],
        { figureGroupId: 'g1', committedAtMs: T0 },
      ),
      pen(
        'b',
        [
          [0.8, 0.8],
          [0.85, 0.8],
        ],
        { figureGroupId: 'g2', committedAtMs: T0 },
      ),
    ]
    const ids = connectedPenStrokeIdsForAutoGroup(commands, 'a', 800, 600)
    expect(ids).toEqual(['a'])
  })

  it('appendCommandWithPenAutoGroup no-ops when preference is off', () => {
    const existing: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ], { committedAtMs: T0 }),
    ]
    const incoming = pen('b', [
      [0.19, 0.1],
      [0.35, 0.1],
    ])
    const next = appendCommandWithPenAutoGroup(existing, incoming, {
      penAutoGroupConnected: false,
      widthPx: 800,
      heightPx: 600,
      nowMs: T0 + 1000,
    })
    expect(next).toHaveLength(2)
    expect((next.find((c) => c.id === 'b') as { committedAtMs?: number }).committedAtMs).toBe(T0 + 1000)
    expect((next.find((c) => c.id === 'a') as { figureGroupId?: string }).figureGroupId).toBeUndefined()
  })

  it('appendCommandWithPenAutoGroup groups touching pens when on', () => {
    const existing: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ], { committedAtMs: T0 }),
    ]
    const incoming = pen('b', [
      [0.19, 0.1],
      [0.35, 0.1],
    ])
    const next = appendCommandWithPenAutoGroup(existing, incoming, {
      penAutoGroupConnected: true,
      widthPx: 800,
      heightPx: 600,
      nowMs: T0 + 1000,
    })
    const ga = (next.find((c) => c.id === 'a') as { figureGroupId?: string }).figureGroupId
    const gb = (next.find((c) => c.id === 'b') as { figureGroupId?: string }).figureGroupId
    expect(ga).toBeTruthy()
    expect(ga).toBe(gb)
  })

  it('ignores marker strokes', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [
        [0.1, 0.1],
        [0.2, 0.1],
      ], { committedAtMs: T0 }),
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
