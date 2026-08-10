import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  assignFigureGroupId,
  clearFigureGroupId,
  idsInFigureGroup,
  remapFigureGroupIdsForPaste,
  shouldToggleSelectionToUngroup,
} from '@/lib/books/annotation-figure-group'

function pen(id: string, points: [number, number][], figureGroupId?: string): AnnotationCommand {
  return {
    kind: 'stroke',
    id,
    tool: 'pen',
    points,
    ...(figureGroupId ? { figureGroupId } : {}),
  }
}

describe('annotation-figure-group', () => {
  it('assignFigureGroupId tags selected pens only (never highlighter)', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [[0.1, 0.1]]),
      pen('b', [[0.2, 0.2]]),
      {
        kind: 'stroke',
        id: 'm',
        tool: 'marker',
        points: [[0.3, 0.3]],
      },
      {
        kind: 'rect',
        id: 'r',
        x: 0,
        y: 0,
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
    ]
    const { commands: next, affectedIds } = assignFigureGroupId(
      commands,
      new Set(['a', 'b', 'm', 'r']),
      'grp1',
    )
    expect(affectedIds.sort()).toEqual(['a', 'b'])
    expect((next[0] as { figureGroupId?: string }).figureGroupId).toBe('grp1')
    expect((next[1] as { figureGroupId?: string }).figureGroupId).toBe('grp1')
    expect((next[2] as { figureGroupId?: string }).figureGroupId).toBeUndefined()
    expect((next[3] as { figureGroupId?: string }).figureGroupId).toBeUndefined()
  })

  it('clearFigureGroupId removes group from selected strokes', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [[0.1, 0.1]], 'grp1'),
      pen('b', [[0.2, 0.2]], 'grp1'),
    ]
    const { commands: next, affectedIds } = clearFigureGroupId(commands, new Set(['a']))
    expect(affectedIds).toEqual(['a'])
    expect((next[0] as { figureGroupId?: string }).figureGroupId).toBeUndefined()
    expect((next[1] as { figureGroupId?: string }).figureGroupId).toBe('grp1')
  })

  it('shouldToggleSelectionToUngroup when all selected pen strokes are grouped', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [[0.1, 0.1]], 'grp1'),
      pen('b', [[0.2, 0.2]]),
    ]
    expect(shouldToggleSelectionToUngroup(commands, ['a'])).toBe(true)
    expect(shouldToggleSelectionToUngroup(commands, ['b'])).toBe(false)
    expect(shouldToggleSelectionToUngroup(commands, ['a', 'b'])).toBe(false)
  })

  it('idsInFigureGroup returns all members', () => {
    const commands: AnnotationCommand[] = [
      pen('a', [[0.1, 0.1]], 'g1'),
      pen('b', [[0.5, 0.5]], 'g1'),
      pen('c', [[0.9, 0.9]], 'g2'),
    ]
    expect(idsInFigureGroup(commands, 'g1').sort()).toEqual(['a', 'b'])
  })

  it('remapFigureGroupIdsForPaste assigns fresh ids per original group', () => {
    const pasted: AnnotationCommand[] = [
      pen('n1', [[0.1, 0.1]], 'oldA'),
      pen('n2', [[0.2, 0.2]], 'oldA'),
      pen('n3', [[0.3, 0.3]], 'oldB'),
    ]
    const remapped = remapFigureGroupIdsForPaste(pasted)
    const g1 = (remapped[0] as { figureGroupId?: string }).figureGroupId
    const g2 = (remapped[1] as { figureGroupId?: string }).figureGroupId
    const g3 = (remapped[2] as { figureGroupId?: string }).figureGroupId
    expect(g1).toBeTruthy()
    expect(g1).toBe(g2)
    expect(g3).toBeTruthy()
    expect(g3).not.toBe(g1)
  })
})
