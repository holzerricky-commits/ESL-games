/** When false, page/legacy ink flushes are no-ops (used while restoring a class-start baseline). */
let pageFlushEnabled = true

export function isInkSessionPageFlushEnabled(): boolean {
  return pageFlushEnabled
}

export function setInkSessionPageFlushEnabled(enabled: boolean): void {
  pageFlushEnabled = enabled
}
