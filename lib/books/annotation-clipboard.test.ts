import { describe, expect, it } from 'vitest'
import {
  duplicateCommandsForPaste,
  getAnnotationClipboard,
  setAnnotationClipboard,
} from '@/lib/books/annotation-clipboard'

describe('annotation-clipboard', () => {
  it('copies and pastes with new ids and offset', () => {
    setAnnotationClipboard([
      {
        kind: 'rect',
        id: 'orig',
        x: 0.1,
        y: 0.1,
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
    ])
    const pasted = duplicateCommandsForPaste(getAnnotationClipboard(), [0.05, 0.05])
    expect(pasted).toHaveLength(1)
    expect(pasted[0]!.id).not.toBe('orig')
    if (pasted[0]!.kind === 'rect') {
      expect(pasted[0].x).toBeCloseTo(0.15)
      expect(pasted[0].y).toBeCloseTo(0.15)
    }
  })
})
