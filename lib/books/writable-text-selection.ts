import { measureTextareaSelectionRect } from '@/lib/books/textarea-selection-rect'
export const WRITABLE_TEXT_SELECTION_MAX_CHARS = 240

export const WRITABLE_ANNOTATION_TEXTAREA_SELECTOR = 'textarea[data-annotation-id]'

export type WritableTextSelectionSnapshot = {
  text: string
  context: string
  rect: DOMRectReadOnly
  fieldEl: HTMLTextAreaElement
  annotationId: string
  selectionStart: number
  selectionEnd: number
}

export function normalizeWritableSelectionText(raw: string): string {
  return raw.trim().slice(0, WRITABLE_TEXT_SELECTION_MAX_CHARS)
}

export function isMeaningfulWritableSelectionText(text: string): boolean {
  return normalizeWritableSelectionText(text).length > 0
}

/** Context for disambiguation when the lookup is a substring of the field. */
export function writableSelectionContext(fieldValue: string, selectedText: string): string {
  const full = fieldValue.trim()
  if (!full) return ''
  const selected = selectedText.trim()
  if (!selected) return ''
  if (full === selected) return ''
  if (!full.toLowerCase().includes(selected.toLowerCase())) return ''
  return full.slice(0, 360)
}

export function isWritableAnnotationTextarea(
  el: Element | null | undefined,
): el is HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement && el.matches(WRITABLE_ANNOTATION_TEXTAREA_SELECTOR)
}

export function isWritableAnnotationNode(node: Node | null): node is Node {
  if (!node || typeof Element === 'undefined') return false
  const el = node instanceof Element ? node : node.parentElement
  if (!el) return false
  return Boolean(el.closest(WRITABLE_ANNOTATION_TEXTAREA_SELECTOR))
}

export function findWritableAnnotationTextarea(node: Node | null): HTMLTextAreaElement | null {
  if (!node || typeof Element === 'undefined') return null
  const el = node instanceof Element ? node : node.parentElement
  if (!el) return null
  const field = el.closest(WRITABLE_ANNOTATION_TEXTAREA_SELECTOR)
  return field instanceof HTMLTextAreaElement ? field : null
}

/** Substring selected inside a textarea (selectionStart/selectionEnd). */
export function writableTextareaSubstring(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): string | null {
  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)
  if (start === end) return null
  const text = normalizeWritableSelectionText(value.slice(start, end))
  return isMeaningfulWritableSelectionText(text) ? text : null
}

export function readWritableTextareaSelection(
  field: HTMLTextAreaElement,
): WritableTextSelectionSnapshot | null {
  const annotationId = field.dataset.annotationId?.trim()
  if (!annotationId) return null
  const selectionStart = Math.min(field.selectionStart, field.selectionEnd)
  const selectionEnd = Math.max(field.selectionStart, field.selectionEnd)
  const text = writableTextareaSubstring(field.value, selectionStart, selectionEnd)
  if (!text) return null
  const rect = textareaSelectionRect(field) ?? field.getBoundingClientRect()
  const context = writableSelectionContext(field.value, text)
  return {
    text,
    context,
    rect,
    fieldEl: field,
    annotationId,
    selectionStart,
    selectionEnd,
  }
}

/**
 * Textarea internal selections are not exposed reliably via `window.getSelection()`.
 * Prefer the active field, then any annotation textarea with a non-empty range.
 */
export function findWritableTextareaWithSelection(
  root: ParentNode = typeof document !== 'undefined' ? document : (null as unknown as ParentNode),
): HTMLTextAreaElement | null {
  if (!root) return null

  const active = typeof document !== 'undefined' ? document.activeElement : null
  if (isWritableAnnotationTextarea(active) && active.selectionStart !== active.selectionEnd) {
    return active
  }

  const fields = root.querySelectorAll(WRITABLE_ANNOTATION_TEXTAREA_SELECTOR)
  for (const el of fields) {
    if (
      el instanceof HTMLTextAreaElement &&
      el.selectionStart !== el.selectionEnd
    ) {
      return el
    }
  }

  return null
}

/**
 * Best-effort caret/selection box for a textarea. Uses mirror measurement because
 * `window.getSelection()` ranges are empty for native textarea content.
 */
export function textareaSelectionRect(field: HTMLTextAreaElement): DOMRectReadOnly | null {
  if (typeof window === 'undefined') return null

  const measured = measureTextareaSelectionRect(
    field,
    field.selectionStart,
    field.selectionEnd,
  )
  if (measured) return measured

  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const anchorField = findWritableAnnotationTextarea(sel.anchorNode)
    const focusField = findWritableAnnotationTextarea(sel.focusNode)
    if (anchorField === field && focusField === field) {
      const rangeRect = sel.getRangeAt(0).getBoundingClientRect()
      if (rangeRect.width > 0 || rangeRect.height > 0) {
        return rangeRect
      }
    }
  }

  return null
}

function selectionRangeRect(sel: Selection): DOMRectReadOnly | null {
  if (sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (range.collapsed) return null
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return rect
}

/**
 * Read the current selection when it lives inside a writable annotation textarea.
 * Returns null when there is no meaningful substring selection.
 */
export function readWritableTextSelection(
  sel: Selection | null = typeof window !== 'undefined' ? window.getSelection() : null,
): WritableTextSelectionSnapshot | null {
  const textareaField = findWritableTextareaWithSelection()
  if (textareaField) {
    return readWritableTextareaSelection(textareaField)
  }

  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null

  const anchor = sel.anchorNode
  const focus = sel.focusNode
  if (!isWritableAnnotationNode(anchor) || !isWritableAnnotationNode(focus)) return null

  const fieldEl = findWritableAnnotationTextarea(anchor)
  if (!fieldEl || fieldEl !== findWritableAnnotationTextarea(focus)) return null

  const annotationId = fieldEl.dataset.annotationId?.trim()
  if (!annotationId) return null
  const selectionStart = Math.min(fieldEl.selectionStart, fieldEl.selectionEnd)
  const selectionEnd = Math.max(fieldEl.selectionStart, fieldEl.selectionEnd)

  const text = normalizeWritableSelectionText(sel.toString())
  if (!isMeaningfulWritableSelectionText(text)) return null

  const rect = selectionRangeRect(sel) ?? fieldEl.getBoundingClientRect()
  const context = writableSelectionContext(fieldEl.value, text)

  return {
    text,
    context,
    rect,
    fieldEl,
    annotationId,
    selectionStart,
    selectionEnd,
  }
}

export function isWritableTextSelectionEventTarget(target: EventTarget | null): boolean {
  return isWritableAnnotationTextarea(
    target instanceof HTMLTextAreaElement
      ? target
      : target instanceof Element
        ? target.closest(WRITABLE_ANNOTATION_TEXTAREA_SELECTOR)
        : null,
  )
}
