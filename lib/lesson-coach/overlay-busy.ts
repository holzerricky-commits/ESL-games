/** Refcounts for pausing coach session poll/ping during annotation gestures. */

let textFieldFocusCount = 0
let annotationGestureCount = 0
let annotationGestureListener: (() => void) | null = null

export function registerCoachAnnotationGestureListener(listener: (() => void) | null): void {
  annotationGestureListener = listener
}

export function setCoachTextFieldFocused(active: boolean): void {
  textFieldFocusCount = Math.max(0, textFieldFocusCount + (active ? 1 : -1))
}

export function setCoachAnnotationGestureActive(active: boolean): void {
  annotationGestureCount = Math.max(0, annotationGestureCount + (active ? 1 : -1))
  annotationGestureListener?.()
}

export function isCoachAnnotationGestureActive(): boolean {
  return annotationGestureCount > 0
}

export function isCoachOverlayPollingPaused(): boolean {
  return textFieldFocusCount > 0 || annotationGestureCount > 0
}
