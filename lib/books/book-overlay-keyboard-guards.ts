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

export function shouldHandleBookOverlayKeyboard(open: boolean, userPresented: boolean): boolean {
  return open && userPresented
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
