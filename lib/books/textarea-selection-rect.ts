let selectionMirror: HTMLDivElement | null = null

const STYLE_PROPS = [
  'font',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'textAlign',
  'whiteSpace',
  'wordBreak',
  'overflowWrap',
  'boxSizing',
  'padding',
  'border',
  'borderWidth',
  'borderStyle',
  'borderColor',
] as const

function getSelectionMirror(): HTMLDivElement {
  if (!selectionMirror && typeof document !== 'undefined') {
    selectionMirror = document.createElement('div')
    selectionMirror.setAttribute('aria-hidden', 'true')
    selectionMirror.style.position = 'fixed'
    selectionMirror.style.visibility = 'hidden'
    selectionMirror.style.pointerEvents = 'none'
    selectionMirror.style.overflow = 'hidden'
    selectionMirror.style.zIndex = '-1'
    selectionMirror.style.top = '0'
    selectionMirror.style.left = '0'
    selectionMirror.style.margin = '0'
    document.body.appendChild(selectionMirror)
  }
  return selectionMirror!
}

function applyTextareaStyles(
  mirror: HTMLDivElement,
  field: HTMLTextAreaElement,
  cs: CSSStyleDeclaration,
  fieldRect: DOMRect,
): void {
  const style = mirror.style
  for (const prop of STYLE_PROPS) {
    style[prop] = cs[prop]
  }
  style.top = `${fieldRect.top}px`
  style.left = `${fieldRect.left}px`
  style.width = `${field.clientWidth}px`
  style.height = `${field.clientHeight}px`
}

function appendTextNode(parent: Node, text: string): void {
  if (text.length > 0) {
    parent.appendChild(document.createTextNode(text))
  }
}

function canvasFontFromComputed(cs: CSSStyleDeclaration): string {
  if (cs.font && cs.font !== 'normal' && !/^\d+px$/.test(cs.font.trim())) {
    return cs.font
  }
  return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
}

function measureTextWidth(text: string, cs: CSSStyleDeclaration): number {
  if (!text) return 0
  if (typeof document === 'undefined') return 0
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = canvasFontFromComputed(cs)
    return ctx.measureText(text).width
  }
  const fontSize = parseFloat(cs.fontSize) || 16
  return text.length * fontSize * 0.6
}

function contentInset(cs: CSSStyleDeclaration): { left: number; top: number } {
  return {
    left: (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0),
    top: (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0),
  }
}

function rectFromRangeSpan(args: {
  span: HTMLElement
  mirror: HTMLDivElement
  cs: CSSStyleDeclaration
  fieldRect: DOMRect
  beforeText: string
  selectedText: string
  scrollLeft: number
  scrollTop: number
}): DOMRect | null {
  const { span, mirror, cs, fieldRect, beforeText, selectedText, scrollLeft, scrollTop } = args
  const layoutRect = span.getBoundingClientRect()
  if (layoutRect.width > 0 || layoutRect.height > 0) {
    return layoutRect
  }

  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 16
  const inset = contentInset(cs)

  const prefixLeft =
    span.offsetLeft > 0 ? span.offsetLeft : measureTextWidth(beforeText, cs)
  const width =
    span.offsetWidth > 0 ? span.offsetWidth : measureTextWidth(selectedText, cs)
  const height = span.offsetHeight > 0 ? span.offsetHeight : lineHeight

  if (width <= 0 && height <= 0) return null

  const mirrorLeft = mirror.getBoundingClientRect().left
  const mirrorTop = mirror.getBoundingClientRect().top
  const left =
    span.offsetLeft > 0 || span.offsetWidth > 0
      ? mirrorLeft + span.offsetLeft
      : fieldRect.left + inset.left + prefixLeft - scrollLeft
  const top =
    span.offsetTop > 0
      ? mirrorTop + span.offsetTop
      : fieldRect.top + inset.top - scrollTop

  return new DOMRect(left, top, Math.max(width, 1), Math.max(height, lineHeight))
}

/**
 * Measure viewport rect for a substring inside a textarea using a styled mirror div.
 * Browsers do not expose textarea selection geometry via `window.getSelection()`.
 */
export function measureTextareaSelectionRect(
  field: HTMLTextAreaElement,
  selectionStart: number,
  selectionEnd: number,
): DOMRect | null {
  if (typeof document === 'undefined') return null

  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)
  if (start === end) return null
  if (start < 0 || end > field.value.length) return null

  const mirror = getSelectionMirror()
  const cs = getComputedStyle(field)
  const fieldRect = field.getBoundingClientRect()
  applyTextareaStyles(mirror, field, cs, fieldRect)

  mirror.replaceChildren()
  const inner = document.createElement('div')
  inner.style.transform = `translate(${-field.scrollLeft}px, ${-field.scrollTop}px)`
  inner.style.width = '100%'

  const value = field.value
  const beforeText = value.slice(0, start)
  const selectedText = value.slice(start, end)
  appendTextNode(inner, beforeText)

  const rangeSpan = document.createElement('span')
  rangeSpan.setAttribute('data-sel-range', '')
  appendTextNode(rangeSpan, selectedText)
  inner.appendChild(rangeSpan)

  appendTextNode(inner, value.slice(end))
  mirror.appendChild(inner)

  return rectFromRangeSpan({
    span: rangeSpan,
    mirror,
    cs,
    fieldRect,
    beforeText,
    selectedText,
    scrollLeft: field.scrollLeft,
    scrollTop: field.scrollTop,
  })
}
