/** PDF.js / react-pdf text layer selectors for hit-testing and event routing. */
export const PDF_TEXT_CONTENT_SELECTOR = '.react-pdf__Page__textContent'
export const PDF_TEXT_SPAN_SELECTOR = `${PDF_TEXT_CONTENT_SELECTOR} span`

export function isPdfTextSpanElement(el: Element | null | undefined): boolean {
  if (!el || !(el instanceof Element)) return false
  return el.closest(PDF_TEXT_SPAN_SELECTOR) != null
}

function isNodeInPdfTextContent(node: Node | null): boolean {
  if (!node) return false
  const el = node instanceof Element ? node : node.parentElement
  return el?.closest(PDF_TEXT_CONTENT_SELECTOR) != null
}

/** Clears browser text selection when it lives inside the react-pdf text layer. */
export function clearNativePdfTextSelection(): void {
  if (typeof document === 'undefined') return
  const sel = document.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
  if (!isNodeInPdfTextContent(sel.anchorNode)) return
  sel.removeAllRanges()
}

export type FindPdfTextSpanAtOptions = {
  /** Elements to ignore when probing (e.g. select overlay). */
  ignoreElements?: readonly Element[]
}

function isIgnoredElement(el: Element, ignoreElements: readonly Element[]): boolean {
  for (const ignored of ignoreElements) {
    if (el === ignored || ignored.contains(el)) return true
  }
  return false
}

/**
 * Returns the PDF text span under screen coordinates, optionally ignoring overlay nodes.
 */
export function findPdfTextSpanAt(
  clientX: number,
  clientY: number,
  opts?: FindPdfTextSpanAtOptions,
): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const ignoreElements = opts?.ignoreElements ?? []
  const saved: { el: Element; pe: string }[] = []

  for (const ignored of ignoreElements) {
    if (!(ignored instanceof HTMLElement)) continue
    saved.push({ el: ignored, pe: ignored.style.pointerEvents })
    ignored.style.pointerEvents = 'none'
  }

  let hit: Element | null = null
  try {
    hit = document.elementFromPoint(clientX, clientY)
  } finally {
    for (const { el, pe } of saved) {
      if (el instanceof HTMLElement) el.style.pointerEvents = pe
    }
  }

  if (!hit || isIgnoredElement(hit, ignoreElements)) return null
  const span = hit.closest(PDF_TEXT_SPAN_SELECTOR)
  return span instanceof HTMLElement ? span : null
}

export type ForwardPointerToPdfTextOptions = {
  ignoreElements?: readonly Element[]
}

type PointerLikeEvent = Pick<
  PointerEvent,
  'clientX' | 'clientY' | 'pointerId' | 'pointerType' | 'button' | 'buttons' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'
>

/**
 * Forwards a pointer gesture to the PDF text span beneath an overlay so native text selection works.
 * Returns true when a text span received the forwarded events.
 */
export function forwardPointerToPdfText(
  event: PointerLikeEvent,
  overlayEl: HTMLElement | null,
  opts?: ForwardPointerToPdfTextOptions,
): boolean {
  if (typeof document === 'undefined' || !overlayEl) return false
  if (event.button !== 0) return false

  const ignoreElements = opts?.ignoreElements ?? [overlayEl]
  const span = findPdfTextSpanAt(event.clientX, event.clientY, { ignoreElements })
  if (!span) return false

  const savedPe = overlayEl.style.pointerEvents
  overlayEl.style.pointerEvents = 'none'

  const pointerInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: event.clientX,
    clientY: event.clientY,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    buttons: event.buttons,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  }

  const mouseInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: event.clientX,
    clientY: event.clientY,
    button: event.button,
    buttons: event.buttons,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  }

  span.dispatchEvent(new PointerEvent('pointerdown', pointerInit))
  span.dispatchEvent(new MouseEvent('mousedown', mouseInit))

  const restore = () => {
    overlayEl.style.pointerEvents = savedPe
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('pointercancel', onPointerCancel, true)
    window.removeEventListener('mouseup', onMouseUp, true)
  }

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return
    span.dispatchEvent(
      new PointerEvent('pointerup', {
        ...pointerInit,
        buttons: e.buttons,
      }),
    )
    restore()
  }

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return
    span.dispatchEvent(
      new PointerEvent('pointermove', {
        ...pointerInit,
        clientX: e.clientX,
        clientY: e.clientY,
        buttons: e.buttons,
      }),
    )
    span.dispatchEvent(
      new MouseEvent('mousemove', {
        ...mouseInit,
        clientX: e.clientX,
        clientY: e.clientY,
        buttons: e.buttons,
      }),
    )
  }

  const onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return
    span.dispatchEvent(
      new PointerEvent('pointercancel', {
        ...pointerInit,
        buttons: e.buttons,
      }),
    )
    restore()
  }

  const onMouseUp = (e: MouseEvent) => {
    if (e.button !== event.button) return
    span.dispatchEvent(
      new MouseEvent('mouseup', {
        ...mouseInit,
        buttons: e.buttons,
      }),
    )
  }

  window.addEventListener('pointermove', onPointerMove, true)
  window.addEventListener('pointerup', onPointerUp, true)
  window.addEventListener('pointercancel', onPointerCancel, true)
  window.addEventListener('mouseup', onMouseUp, true)

  return true
}

/** Probe whether the pointer is over selectable PDF text (for cursor styling). */
export function isPointerOverPdfTextSpan(
  clientX: number,
  clientY: number,
  ignoreElements?: readonly Element[],
): boolean {
  return findPdfTextSpanAt(clientX, clientY, { ignoreElements }) != null
}
