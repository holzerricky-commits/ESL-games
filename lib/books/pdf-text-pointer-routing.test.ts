/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  clearNativePdfTextSelection,
  findPdfTextSpanAt,
  forwardPointerToPdfText,
  isPdfTextSpanElement,
  PDF_TEXT_CONTENT_SELECTOR,
} from '@/lib/books/pdf-text-pointer-routing'

function mountTextLayerFixture(): {
  overlay: HTMLDivElement
  span: HTMLSpanElement
  root: HTMLDivElement
  cleanup: () => void
} {
  const root = document.createElement('div')
  root.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;'

  const textContent = document.createElement('div')
  textContent.className = 'react-pdf__Page__textContent'
  textContent.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:200px;'

  const span = document.createElement('span')
  span.textContent = 'Hello'
  span.style.cssText = 'position:absolute;left:20px;top:20px;width:80px;height:20px;'

  const overlay = document.createElement('div')
  overlay.style.cssText =
    'position:absolute;left:0;top:0;width:200px;height:200px;pointer-events:auto;z-index:10;'

  textContent.appendChild(span)
  root.appendChild(textContent)
  root.appendChild(overlay)
  document.body.appendChild(root)

  return {
    overlay,
    span,
    root,
    cleanup: () => root.remove(),
  }
}

function installElementFromPointMock(fixture: {
  overlay: HTMLDivElement
  span: HTMLSpanElement
}) {
  document.elementFromPoint = ((x: number, y: number) => {
    const overlayPe = fixture.overlay.style.pointerEvents
    if (overlayPe !== 'none' && x >= 0 && x <= 200 && y >= 0 && y <= 200) {
      return fixture.overlay
    }
    if (x >= 20 && x <= 100 && y >= 20 && y <= 40) {
      return fixture.span
    }
    return null
  }) as typeof document.elementFromPoint
}

describe('isPdfTextSpanElement', () => {
  it('returns true for spans inside react-pdf text content', () => {
    const textContent = document.createElement('div')
    textContent.className = 'react-pdf__Page__textContent'
    const span = document.createElement('span')
    textContent.appendChild(span)
    expect(isPdfTextSpanElement(span)).toBe(true)
  })

  it('returns false for unrelated elements', () => {
    expect(isPdfTextSpanElement(document.createElement('div'))).toBe(false)
    expect(isPdfTextSpanElement(null)).toBe(false)
  })
})

describe('findPdfTextSpanAt', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('finds span when overlay is ignored', () => {
    const fixture = mountTextLayerFixture()
    cleanup = fixture.cleanup
    installElementFromPointMock(fixture)
    const hit = findPdfTextSpanAt(40, 30, { ignoreElements: [fixture.overlay] })
    expect(hit).toBe(fixture.span)
  })

  it('returns null when overlay blocks and is not ignored', () => {
    const fixture = mountTextLayerFixture()
    cleanup = fixture.cleanup
    installElementFromPointMock(fixture)
    expect(findPdfTextSpanAt(40, 30)).toBeNull()
  })
})

describe('forwardPointerToPdfText', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('dispatches pointer and mouse events to the span under the overlay', () => {
    const fixture = mountTextLayerFixture()
    cleanup = fixture.cleanup
    installElementFromPointMock(fixture)
    const events: string[] = []
    fixture.span.addEventListener('pointerdown', () => events.push('pointerdown'))
    fixture.span.addEventListener('mousedown', () => events.push('mousedown'))

    const forwarded = forwardPointerToPdfText(
      {
        clientX: 40,
        clientY: 30,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      },
      fixture.overlay,
    )

    expect(forwarded).toBe(true)
    expect(events).toEqual(['pointerdown', 'mousedown'])
    expect(fixture.overlay.style.pointerEvents).toBe('none')
  })

  it('returns false when no text span is under the point', () => {
    const fixture = mountTextLayerFixture()
    cleanup = fixture.cleanup
    installElementFromPointMock(fixture)
    const forwarded = forwardPointerToPdfText(
      {
        clientX: 5,
        clientY: 5,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      },
      fixture.overlay,
    )
    expect(forwarded).toBe(false)
  })
})

describe('PDF_TEXT_CONTENT_SELECTOR', () => {
  it('matches react-pdf text layer class', () => {
    expect(PDF_TEXT_CONTENT_SELECTOR).toBe('.react-pdf__Page__textContent')
  })
})

describe('clearNativePdfTextSelection', () => {
  afterEach(() => {
    document.getSelection()?.removeAllRanges()
  })

  it('clears non-collapsed selection inside PDF text content', () => {
    const textContent = document.createElement('div')
    textContent.className = 'react-pdf__Page__textContent'
    const span = document.createElement('span')
    span.textContent = 'Hello'
    textContent.appendChild(span)
    document.body.appendChild(textContent)

    const sel = document.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(span)
    sel.addRange(range)

    const removeAllRanges = vi.spyOn(sel, 'removeAllRanges')
    clearNativePdfTextSelection()

    expect(removeAllRanges).toHaveBeenCalledOnce()
    textContent.remove()
  })

  it('does not clear selection outside PDF text content', () => {
    const div = document.createElement('div')
    div.textContent = 'Outside'
    document.body.appendChild(div)

    const sel = document.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(div)
    sel.addRange(range)

    const removeAllRanges = vi.spyOn(sel, 'removeAllRanges')
    clearNativePdfTextSelection()

    expect(removeAllRanges).not.toHaveBeenCalled()
    div.remove()
  })

  it('no-ops when selection is collapsed', () => {
    const sel = document.getSelection()!
    sel.removeAllRanges()

    const removeAllRanges = vi.spyOn(sel, 'removeAllRanges')
    clearNativePdfTextSelection()

    expect(removeAllRanges).not.toHaveBeenCalled()
  })
})
