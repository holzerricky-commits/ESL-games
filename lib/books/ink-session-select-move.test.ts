import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { resolveSelectMoveIdsForDrag } from '@/lib/books/ink-session-select-move'

const penStroke = (id: string): AnnotationCommand => ({
  kind: 'stroke',
  id,
  tool: 'pen',
  points: [
    [0.1, 0.1],
    [0.2, 0.2],
  ],
})

describe('resolveSelectMoveIdsForDrag', () => {
  it('perStroke: click unselected stroke B moves only B', () => {
    expect(resolveSelectMoveIdsForDrag(penStroke('b'), ['b'], 'perStroke')).toEqual(['b'])
  })

  it('union: click unselected stroke B moves the new selection', () => {
    expect(resolveSelectMoveIdsForDrag(penStroke('b'), ['b'], 'union')).toEqual(['b'])
  })

  it('perStroke: click already-selected stroke B moves only B', () => {
    expect(resolveSelectMoveIdsForDrag(penStroke('b'), ['a', 'b', 'c'], 'perStroke')).toEqual(['b'])
  })

  it('union: multi-select moves the full selection set', () => {
    expect(resolveSelectMoveIdsForDrag(penStroke('b'), ['a', 'b'], 'union')).toEqual(['a', 'b'])
  })
})
