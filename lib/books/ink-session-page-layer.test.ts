import { describe, expect, it } from 'vitest'
import {
  isInkSessionDelegatedCanvasCommand,
  pageLayerCanvasCommandsWhenSpreadInkDelegated,
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
  w: 0.2,
  h: 0.1,
  text: 'hi',
  color: '#000000',
  fontSizeNorm: 0.02,
}

describe('ink-session-page-layer', () => {
  it('isInkSessionDelegatedCanvasCommand for strokes and shapes', () => {
    expect(isInkSessionDelegatedCanvasCommand(stroke)).toBe(true)
    expect(isInkSessionDelegatedCanvasCommand(text)).toBe(false)
  })

  it('pageLayerCanvasCommandsWhenSpreadInkDelegated filters delegated ink', () => {
    const line: AnnotationCommand = {
      kind: 'line',
      id: 'l1',
      a: [0, 0],
      b: [1, 1],
      color: '#000',
    }
    const all = [stroke, line, text]
    expect(pageLayerCanvasCommandsWhenSpreadInkDelegated(all, false)).toEqual(all)
    expect(pageLayerCanvasCommandsWhenSpreadInkDelegated(all, true)).toEqual([text])
  })
})
