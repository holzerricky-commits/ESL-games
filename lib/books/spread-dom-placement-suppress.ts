/** Outside-overlay dismiss must not eat the next empty-spread placement tap. */
export function suppressNextPlacementAfterOutsideDismiss(): boolean {
  return false
}

/** Empty-canvas click-away while editing: commit + select, not a new label on the same tap. */
export function suppressNextPlacementAfterCanvasClickAwayDismiss(): boolean {
  return true
}

/** Entering text/sticky tool clears a stale suppress flag from a prior outside dismiss. */
export function shouldResetSuppressNextPlacementOnDomToolEntry(enteringDomTool: boolean): boolean {
  return enteringDomTool
}
