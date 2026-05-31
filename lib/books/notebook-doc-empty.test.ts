import { describe, expect, it } from 'vitest'
import { isNotebookDocEmpty } from './notebook-doc-empty'
import { parseNotebookPageSpanKeyToPdfPage } from './notebook-source-page'

describe('isNotebookDocEmpty', () => {
  it('treats blank doc as empty', () => {
    expect(isNotebookDocEmpty('<p><br></p>')).toBe(true)
    expect(isNotebookDocEmpty('')).toBe(true)
  })

  it('treats captures and markers as non-empty', () => {
    expect(isNotebookDocEmpty('<figure data-notebook-entry="whiteboard_capture"></figure>')).toBe(false)
    expect(isNotebookDocEmpty('<div data-notebook-marker="x"></div>')).toBe(false)
  })
})

describe('parseNotebookPageSpanKeyToPdfPage', () => {
  it('parses single and range spans', () => {
    expect(parseNotebookPageSpanKeyToPdfPage('p12')).toBe(12)
    expect(parseNotebookPageSpanKeyToPdfPage('p12-14')).toBe(12)
  })
})
