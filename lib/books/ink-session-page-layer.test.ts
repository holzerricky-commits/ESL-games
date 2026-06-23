import { describe, expect, it } from 'vitest'
import {
  isInkSessionDelegatedCanvasCommand,
  isSpreadSessionOwnedCommand,
  pageLayerCommandsWhenSpreadDelegated,
} from '@/lib/books/ink-session-page-layer'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

const stroke: AnnotationCommand = {
  kind: 'stroke',
  id: 's1',
  tool: 'pen',
  points: [
    [0.1, 0.1],
    [0.2, 0.2],
  ],
}

const text: AnnotationCommand = {
  kind: 'text',
  id: 't1',
  x: 0.1,
  y: 0.1,
  text: 'hi',
  color: '#000000',
  fontSizeNorm: 0.02,
}

const stamp: AnnotationCommand = {
  kind: 'stamp',
  id: 'st1',
  variant: 'check',
  center: [0.5, 0.5],
  color: '#22c55e',
}

const sticky: AnnotationCommand = {
  kind: 'sticky',
  id: 'n1',
  x: 0.1,
  y: 0.2,
  w: 0.22,
  h: 0.11,
  text: 'note',
  fontSizeNorm: 0.02,
  fillColor: '#fef3c7',
}

describe('ink-session-page-layer', () => {
  it('isInkSessionDelegatedCanvasCommand for strokes, shapes, and stamps', () => {
    expect(isInkSessionDelegatedCanvasCommand(stroke)).toBe(true)
    expect(isInkSessionDelegatedCanvasCommand(stamp)).toBe(true)
    expect(isInkSessionDelegatedCanvasCommand(text)).toBe(false)
  })

  it('isSpreadSessionOwnedCommand includes text and sticky', () => {
    expect(isSpreadSessionOwnedCommand(stroke)).toBe(true)
    expect(isSpreadSessionOwnedCommand(stamp)).toBe(true)
    expect(isSpreadSessionOwnedCommand(text)).toBe(true)
    expect(isSpreadSessionOwnedCommand(sticky)).toBe(true)
  })

  it('pageLayerCommandsWhenSpreadDelegated filters all spread-owned commands', () => {
    const line: AnnotationCommand = {
      kind: 'line',
      id: 'l1',
      a: [0, 0],
      b: [1, 1],
      color: '#000',
    }
    const all = [stroke, line, stamp, text, sticky]
    expect(pageLayerCommandsWhenSpreadDelegated(all, false)).toEqual(all)
    expect(pageLayerCommandsWhenSpreadDelegated(all, true)).toEqual([])
  })
})
