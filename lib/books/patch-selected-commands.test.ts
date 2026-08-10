import { describe, expect, it } from 'vitest'
import type { StickyAnnotationCommand, TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import type { RectAnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  patchSelectedImageCommands,
  patchSelectedInkStrokeCommands,
  patchSelectedShapeCommands,
  patchSelectedStickyCommands,
  patchSelectedTextCommands,
  patchSelectedTextCommandsChanged,
} from '@/lib/books/patch-selected-commands'

function textCmd(id: string, color: string): TextAnnotationCommand {
  return {
    kind: 'text',
    id,
    x: 0.1,
    y: 0.1,
    text: 'hi',
    color,
    fontSizeNorm: 0.03,
  }
}

describe('patchSelectedTextCommands', () => {
  it('patches every selected text command', () => {
    const commands = [textCmd('a', '#111'), textCmd('b', '#111'), textCmd('c', '#222')]
    const next = patchSelectedTextCommands(commands, ['a', 'b'], { color: '#fff' })
    expect(next[0]).toMatchObject({ id: 'a', color: '#fff' })
    expect(next[1]).toMatchObject({ id: 'b', color: '#fff' })
    expect(next[2]).toMatchObject({ id: 'c', color: '#222' })
  })

  it('reports no change when patch is a no-op', () => {
    const commands = [textCmd('a', '#111')]
    expect(patchSelectedTextCommandsChanged(commands, ['a'], { color: '#111' })).toBe(false)
  })

  it('reports change when color updates', () => {
    const commands = [textCmd('a', '#111')]
    expect(patchSelectedTextCommandsChanged(commands, ['a'], { color: '#fff' })).toBe(true)
  })
})

describe('patchSelectedStickyCommands', () => {
  function stickyCmd(id: string, fill: string): StickyAnnotationCommand {
    return {
      kind: 'sticky',
      id,
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.1,
      text: 'hi',
      fontSizeNorm: 0.03,
      fillColor: fill,
    }
  }

  it('patches every selected sticky command', () => {
    const commands = [stickyCmd('a', '#fef3c7'), stickyCmd('b', '#fef3c7')]
    const next = patchSelectedStickyCommands(commands, ['a', 'b'], { fillColor: '#fde68a' })
    expect(next[0]).toMatchObject({ id: 'a', fillColor: '#fde68a' })
    expect(next[1]).toMatchObject({ id: 'b', fillColor: '#fde68a' })
  })
})

describe('patchSelectedInkStrokeCommands', () => {
  it('patches color and clears effect ink on pen strokes', () => {
    const commands = [
      {
        kind: 'stroke' as const,
        id: 'a',
        tool: 'pen' as const,
        points: [
          [0.1, 0.1],
          [0.2, 0.2],
        ] as [number, number][],
        color: '#111827',
        penInkStyle: 'rainbow' as const,
      },
    ]
    const next = patchSelectedInkStrokeCommands(commands, ['a'], { color: '#ffffff' })
    expect(next[0]).toMatchObject({ id: 'a', color: '#ffffff' })
    expect((next[0] as { penInkStyle?: string }).penInkStyle).toBeUndefined()
  })

  it('patches marker width scale', () => {
    const commands = [
      {
        kind: 'stroke' as const,
        id: 'm1',
        tool: 'marker' as const,
        points: [
          [0, 0],
          [0.2, 0.2],
        ] as [number, number][],
        color: '#ffff00',
        widthScale: 1,
      },
    ]
    const next = patchSelectedInkStrokeCommands(commands, ['m1'], { widthScale: 1.42 })
    expect(next[0]).toMatchObject({ id: 'm1', widthScale: 1.42 })
  })
})

describe('patchSelectedShapeCommands', () => {
  function rect(id: string, stroke: string): RectAnnotationCommand {
    return {
      kind: 'rect',
      id,
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.1,
      strokeColor: stroke,
    }
  }

  it('patches stroke color on rects and color on lines', () => {
    const commands = [
      rect('a', '#111'),
      { kind: 'line' as const, id: 'b', a: [0, 0] as [number, number], b: [1, 1] as [number, number], color: '#111' },
    ]
    const next = patchSelectedShapeCommands(commands, ['a', 'b'], { strokeColor: '#fff' })
    expect(next[0]).toMatchObject({ id: 'a', strokeColor: '#fff' })
    expect(next[1]).toMatchObject({ id: 'b', color: '#fff' })
  })

  it('patches lock on shapes', () => {
    const commands = [
      rect('a', '#111'),
      { kind: 'line' as const, id: 'b', a: [0, 0] as [number, number], b: [1, 1] as [number, number], color: '#111' },
    ]
    const next = patchSelectedShapeCommands(commands, ['a', 'b'], { locked: true })
    expect(next[0]).toMatchObject({ id: 'a', locked: true })
    expect(next[1]).toMatchObject({ id: 'b', locked: true })
  })
})

describe('patchSelectedImageCommands', () => {
  it('patches border and lock on images', () => {
    const commands = [
      {
        kind: 'image' as const,
        id: 'img-1',
        x: 0.1,
        y: 0.1,
        w: 0.2,
        h: 0.2,
        src: 'data:image/png;base64,abc',
      },
    ]
    const next = patchSelectedImageCommands(commands, ['img-1'], {
      strokeVisible: true,
      strokeColor: '#ff0000',
      locked: true,
    })
    expect(next[0]).toMatchObject({
      id: 'img-1',
      strokeVisible: true,
      strokeColor: '#ff0000',
      locked: true,
    })
  })
})
