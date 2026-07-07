type ClosestCapable = { closest: (selector: string) => unknown | null }

function asClosestCapable(target: unknown): ClosestCapable | null {
  if (target == null || typeof target !== 'object') return null
  const candidate = target as ClosestCapable
  return typeof candidate.closest === 'function' ? candidate : null
}

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Whether a document-level pointerdown should end the active book text/sticky edit.
 * Centralizes click-away rules for spread session + single-page annotation layers.
 */
export function isPointerOnAnnotationTextarea(target: unknown, editingId: string): boolean {
  const el = asClosestCapable(target)
  if (!el) return false
  return Boolean(el.closest(`textarea[data-annotation-id="${escapeAttrValue(editingId)}"]`))
}

export function isPointerOnAnnotationLabelShell(target: unknown, editingId: string): boolean {
  const el = asClosestCapable(target)
  if (!el) return false
  return Boolean(el.closest(`[data-annotation-label="${escapeAttrValue(editingId)}"]`))
}

export function shouldDismissBookOverlayAnnotationEditOnPointerDown(
  target: unknown,
  ctx: {
    /** @deprecated Kept for call-site compat; dismiss is based on protected targets only. */
    overlayRoot?: unknown
    editingId: string
  },
): boolean {
  const el = asClosestCapable(target)
  if (!el) return false

  if (isPointerOnAnnotationTextarea(target, ctx.editingId)) {
    return false
  }

  if (isPointerOnAnnotationLabelShell(target, ctx.editingId)) {
    return false
  }

  /** Portaled color/font pickers opened from the annotation rail while editing. */
  if (el.closest('[data-slot="popover-content"]')) return false

  /** Writing-assist suggestion chips / mirrors portaled beside the field. */
  if (el.closest('[data-writing-assist-ui]')) return false

  return true
}
