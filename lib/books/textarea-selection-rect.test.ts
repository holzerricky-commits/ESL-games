/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { measureTextareaSelectionRect } from '@/lib/books/textarea-selection-rect'

function makeTextarea(value: string, widthPx = 240): HTMLTextAreaElement {
  const field = document.createElement('textarea')
  field.value = value
  field.setAttribute('data-annotation-id', 'test-field')
  Object.assign(field.style, {
    position: 'absolute',
    left: '40px',
    top: '80px',
    width: `${widthPx}px`,
    height: '48px',
    font: '16px Arial',
    lineHeight: '20px',
    padding: '4px 6px',
    border: '1px solid #ccc',
    whiteSpace: 'pre-wrap',
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    boxSizing: 'border-box',
  })
  document.body.appendChild(field)
  return field
}

describe('textarea-selection-rect', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('returns null for collapsed selection', () => {
    const field = makeTextarea('hello world')
    field.setSelectionRange(3, 3)
    expect(measureTextareaSelectionRect(field, 3, 3)).toBeNull()
  })

  it('places later substring farther right than earlier substring', () => {
    const field = makeTextarea('hello world')
    const hello = measureTextareaSelectionRect(field, 0, 5)
    const world = measureTextareaSelectionRect(field, 6, 11)
    expect(hello).not.toBeNull()
    expect(world).not.toBeNull()
    expect(world!.left).toBeGreaterThan(hello!.left)
  })

  it('selection width is narrower than selecting the full line', () => {
    const field = makeTextarea('hello world')
    const world = measureTextareaSelectionRect(field, 6, 11)
    const all = measureTextareaSelectionRect(field, 0, 11)
    expect(world).not.toBeNull()
    expect(all).not.toBeNull()
    expect(world!.width).toBeGreaterThan(0)
    expect(world!.width).toBeLessThan(all!.width)
  })

  it('returns a non-empty viewport rect for a substring selection', () => {
    const field = makeTextarea('hello world')
    const rect = measureTextareaSelectionRect(field, 6, 11)
    expect(rect).not.toBeNull()
    expect(rect!.width).toBeGreaterThan(0)
    expect(rect!.height).toBeGreaterThan(0)
  })
})
