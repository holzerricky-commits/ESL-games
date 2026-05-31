import { describe, expect, it } from 'vitest'
import { appendWhiteboardCaptureToNotebookHtml } from './lesson-notebook-whiteboard-capture-html'

describe('appendWhiteboardCaptureToNotebookHtml', () => {
  it('appends a figure with whiteboard metadata', () => {
    const html = appendWhiteboardCaptureToNotebookHtml('<p>Notes</p>', {
      imageSrc: 'data:image/png;base64,abc',
      caption: 'Whiteboard · Page 3',
      bookId: 'book-1',
      unitId: 'unit-1',
      pageSpanKey: 'p3',
      whiteboardPage: 3,
      capturedAtIso: '2026-05-27T12:00:00.000Z',
    })
    expect(html).toContain('data-notebook-entry="whiteboard_capture"')
    expect(html).toContain('data:image/png;base64,abc')
    expect(html).toContain('Whiteboard · Page 3')
    expect(html).toContain('<p>Notes</p>')
  })
})
