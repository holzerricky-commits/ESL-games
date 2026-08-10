import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  applyEraserLivePreviewPunchOut,
  deadKeyFromIndices,
  newlyDeadIndices,
  parseEraserPreviewDeadKey,
} from '@/lib/books/ink-session-eraser-live-preview'

function pen(id: string, y: number): AnnotationCommand {
  return {
    kind: 'stroke',
    id,
    tool: 'pen',
    points: [
      [0.1, y],
      [0.9, y],
    ],
  }
}

describe('ink-session-eraser-live-preview', () => {
  it('parseEraserPreviewDeadKey round-trips sorted indices', () => {
    const dead = new Set([2, 0, 5])
    const key = deadKeyFromIndices(dead)
    expect(key).toBe('0,2,5')
    expect(parseEraserPreviewDeadKey(key)).toEqual(new Set([0, 2, 5]))
  })

  it('newlyDeadIndices returns only indices added since prevDeadKey', () => {
    expect(newlyDeadIndices(new Set([0, 1, 2]), '')).toEqual([0, 1, 2])
    expect(newlyDeadIndices(new Set([0, 1, 2]), '0,1')).toEqual([2])
    expect(newlyDeadIndices(new Set([0, 1, 2]), '0,1,2')).toEqual([])
  })

  it('applyEraserLivePreviewPunchOut returns false when dead set unchanged', () => {
    const commands = [pen('a', 0.5)]
    expect(
      applyEraserLivePreviewPunchOut(commands, new Set([0]), '0', [], [], false, 800, 600),
    ).toBe(false)
  })

  it('applyEraserLivePreviewPunchOut returns false when no canvas refs', () => {
    const commands = [pen('a', 0.5)]
    expect(
      applyEraserLivePreviewPunchOut(commands, new Set([0]), '', [], [], false, 800, 600),
    ).toBe(false)
  })
})
