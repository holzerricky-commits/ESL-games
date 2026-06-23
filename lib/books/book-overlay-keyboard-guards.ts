/** True when focus is in a field where letter keys should type, not switch tools. */
export function isBookOverlayKeyboardTypingTarget(): boolean {
  const activeEl = document.activeElement as HTMLElement | null
  if (!activeEl) return false
  return (
    activeEl.tagName === 'INPUT' ||
    activeEl.tagName === 'TEXTAREA' ||
    activeEl.tagName === 'SELECT' ||
    activeEl.isContentEditable
  )
}

/** Bumped whenever annotation fields are blurred — stale focus retries must no-op. */
let bookOverlayAnnotationFocusGeneration = 0

export function getBookOverlayAnnotationFocusGeneration(): number {
  return bookOverlayAnnotationFocusGeneration
}

export function invalidateBookOverlayAnnotationFieldFocus(): void {
  bookOverlayAnnotationFocusGeneration += 1
}

/** Active book-overlay text/sticky edit (even before the textarea receives focus). */
let bookOverlayAnnotationEditSessionId: string | null = null

export function setBookOverlayAnnotationEditSessionId(id: string | null): void {
  bookOverlayAnnotationEditSessionId = id
}

export function getBookOverlayAnnotationEditSessionId(): string | null {
  return bookOverlayAnnotationEditSessionId
}

export function isBookOverlayAnnotationEditSessionActive(): boolean {
  return bookOverlayAnnotationEditSessionId != null
}

/** Tool shortcuts should defer while typing or while a label edit session is open. */
export function shouldDeferBookOverlayToolShortcuts(): boolean {
  return isBookOverlayKeyboardTypingTarget() || isBookOverlayAnnotationEditSessionActive()
}

export function focusBookOverlayAnnotationField(
  annotationId: string,
  focusGeneration = bookOverlayAnnotationFocusGeneration,
): boolean {
  if (focusGeneration !== bookOverlayAnnotationFocusGeneration) return false
  const el = document.querySelector(
    `textarea[data-annotation-id="${CSS.escape(annotationId)}"]`,
  ) as HTMLTextAreaElement | null
  if (!el) return false
  el.focus({ preventScroll: true })
  return document.activeElement === el
}

/** Focus on the next frame; dropped if blur/clear bumped the generation meanwhile. */
export function scheduleBookOverlayAnnotationFieldFocus(annotationId: string): void {
  const focusGeneration = bookOverlayAnnotationFocusGeneration
  requestAnimationFrame(() => {
    focusBookOverlayAnnotationField(annotationId, focusGeneration)
  })
}

export { isWritingAssistTabActive } from '@/lib/writing-assist/tab-active'

/** True when the given annotation text label textarea already has focus. */
export function isAnnotationTextFieldFocused(annotationId: string): boolean {
  const activeEl = document.activeElement as HTMLElement | null
  if (!activeEl || activeEl.tagName !== 'TEXTAREA') return false
  return activeEl.dataset.annotationId === annotationId
}

/** Blur the focused field so `onBlur` handlers commit (annotation text / sticky). */
export function commitBookOverlayTypingTarget(): boolean {
  const activeEl = document.activeElement as HTMLElement | null
  if (!activeEl || !isBookOverlayKeyboardTypingTarget()) return false
  activeEl.blur()
  return true
}

/** Drop focus from every on-page annotation field — no caret when not editing. */
export function blurAllBookOverlayAnnotationFields(): void {
  invalidateBookOverlayAnnotationFieldFocus()
  if (typeof document === 'undefined') return
  for (const el of document.querySelectorAll('textarea[data-annotation-id]')) {
    if (el instanceof HTMLTextAreaElement) {
      el.blur()
    }
  }
}

export const BOOK_OVERLAY_FOCUS_SINK_SELECTOR = '[data-book-overlay-focus-sink]'

/** Move focus to the canvas sink inside `root` (or document) so it does not land on page chrome. */
export function focusBookOverlayCanvasSink(root?: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false
  const scope = root ?? document
  const sink = scope.querySelector(BOOK_OVERLAY_FOCUS_SINK_SELECTOR)
  if (!(sink instanceof HTMLElement)) return false
  sink.focus({ preventScroll: true })
  return document.activeElement === sink
}

/** Blur label fields and park focus on the book canvas sink when edit ends. */
export function endBookOverlayAnnotationEditingFocus(root?: HTMLElement | null): void {
  blurAllBookOverlayAnnotationFields()
  focusBookOverlayCanvasSink(root)
}
