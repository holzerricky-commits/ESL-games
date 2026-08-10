import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { moveCommandsInStack } from '@/lib/books/annotation-layer-order'

function cmd(id: string): AnnotationCommand {
  return { kind: 'text', id, x: 0.1, y: 0.1, text: id, color: '#000', fontSizeNorm: 0.02 }
}

describe('moveCommandsInStack', () => {
  const stack = [cmd('a'), cmd('b'), cmd('c'), cmd('d')]

  it('brings one command forward', () => {
    const next = moveCommandsInStack(stack, ['b'], 1)
    expect(next.map((c) => c.id)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('sends one command backward', () => {
    const next = moveCommandsInStack(stack, ['c'], -1)
    expect(next.map((c) => c.id)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('moves a multi-select block forward preserving order', () => {
    const next = moveCommandsInStack(stack, ['b', 'c'], 1)
    expect(next.map((c) => c.id)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('no-ops when already on top', () => {
    const next = moveCommandsInStack(stack, ['d'], 1)
    expect(next.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('no-ops when already on bottom', () => {
    const next = moveCommandsInStack(stack, ['a'], -1)
    expect(next.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
