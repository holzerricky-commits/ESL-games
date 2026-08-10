/**
 * Trackpad pinch on Chrome/Edge maps to `wheel` with `ctrlKey: true`, which drives
 * visual-viewport zoom (`visualViewport.scale`) without changing page zoom %.
 * Block that on the book overlay so layered PDF/ink does not flash during teaching.
 */
export function shouldBlockBrowserPinchWheelEvent(e: { ctrlKey: boolean }): boolean {
  return e.ctrlKey
}
