import { describe, expect, it, vi } from 'vitest'
import { buildImageCommandFromEncoded } from '@/lib/books/board-image-commit'
import {
  isBoardImageDragEvent,
  preventBoardImageDragDefaults,
} from '@/lib/books/board-image-drop'

describe('board image drop', () => {
  it('recognizes local image file drags', () => {
    const file = new File([], 'moving.gif', { type: 'image/gif' })
    const event = {
      dataTransfer: { types: ['Files'], files: [file] },
    } as unknown as DragEvent
    expect(isBoardImageDragEvent(event)).toBe(true)
  })

  it('recognizes file drags before file metadata is available', () => {
    const file = new File([], 'notes.txt', { type: 'text/plain' })
    const event = {
      dataTransfer: { types: ['Files'], files: [file] },
    } as unknown as DragEvent
    expect(isBoardImageDragEvent(event)).toBe(true)
  })

  it('prevents browser navigation and marks the drop as copy', () => {
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const dataTransfer = { dropEffect: 'none' } as DataTransfer
    preventBoardImageDragDefaults({ dataTransfer, preventDefault, stopPropagation })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(dataTransfer.dropEffect).toBe('copy')
  })

  it('centers the image command at the drop anchor', () => {
    const cmd = buildImageCommandFromEncoded(
      { dataUrl: 'data:image/png;base64,abc', naturalWidth: 800, naturalHeight: 600 },
      {
        widthPx: 1000,
        heightPx: 800,
        viewportHeightPx: 800,
        scrollTopPx: 0,
        anchorNorm: { x: 0.7, y: 0.6 },
      },
    )
    expect(cmd.x + cmd.w / 2).toBeCloseTo(0.7)
    expect(cmd.y + cmd.h / 2).toBeCloseTo(0.6)
  })
})
