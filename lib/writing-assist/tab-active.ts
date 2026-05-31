/** Module-level flag for overlay Tab guard when ghost suggestion is visible. */
let ghostTabActive = false

export function setWritingAssistGhostTabActive(active: boolean): void {
  ghostTabActive = active
}

export function isWritingAssistTabActive(): boolean {
  return ghostTabActive
}
