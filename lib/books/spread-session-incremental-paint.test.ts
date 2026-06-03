import { describe, expect, it } from 'vitest'
import { canIncrementallyAppendSpreadSessionCommands } from '@/lib/books/spread-session-incremental-paint'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

const a: AnnotationCommand = {
  kind: 'stroke',
  id: 'a',
  tool: 'pen',
  points: [
    [0, 0],
    [0.1, 0.1],
  ],
}

const b: AnnotationCommand = {
  kind: 'stroke',
  id: 'b',
  tool: 'pen',
  points: [
    [0.2, 0.2],
    [0.3, 0.3],
  ],
}

describe('canIncrementallyAppendSpreadSessionCommands', () => {
  it('returns true for one appended command', () => {
    expect(canIncrementallyAppendSpreadSessionCommands([a], [a, b])).toBe(true)
  })

  it('returns false when middle command changes', () => {
    const a2 = { ...a, id: 'a2' }
    expect(canIncrementallyAppendSpreadSessionCommands([a], [a2, b])).toBe(false)
  })

  it('returns false when length unchanged', () => {
    expect(canIncrementallyAppendSpreadSessionCommands([a], [a])).toBe(false)
  })
})
