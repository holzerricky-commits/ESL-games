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
