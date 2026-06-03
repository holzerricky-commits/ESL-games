/** No-op state update when the active annotation page is unchanged (avoids extra React renders). */
export function annotationTargetPageIfChanged(prev: number, next: number): number {
  return prev === next ? prev : next
}
