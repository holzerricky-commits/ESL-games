/** Placeholder while editing an empty writable sticker. */
export const WRITABLE_STICKY_PLACEHOLDER = 'Add a note…'

/** Hint under the annotation rail when the text tool is active. */
export const TEXT_TOOL_RAIL_HINT =
  'Click to place · drag selected text to move · double-click to edit'

/** Ctrl+Enter / Cmd+Enter commits the active book label or sticky field. */
export function isBookAnnotationTextCommitShortcut(e: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): boolean {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey
}

/** Hint under the annotation rail when the writable sticker tool is active. */
export const WRITABLE_TOOL_RAIL_HINT = 'Click to place a note · click existing notes to edit'

/** Max time to keep a hidden textarea mounted while waiting for focus. */
export const BOOK_ANNOTATION_FOCUS_ACQUIRE_MS = 400

/**
 * Mount the live textarea only while the label is focused or briefly acquiring focus.
 * Committed plain text must never keep a textarea (and blinking caret) mounted.
 */
/**
 * Committed plain text stays click-through so the overlay can open edit on single-click.
 * Stickies and active edit sessions (textarea mounted) capture pointer events.
 */
export function shouldBookAnnotationLabelCapturePointer(args: {
  isSticky: boolean
  showTextarea: boolean
  textToolActive: boolean
  selectMode: boolean
}): boolean {
  return args.isSticky || args.showTextarea
}

export function shouldShowBookAnnotationTextarea(args: {
  textInputEnabled: boolean
  isEditing: boolean
  autoFocus: boolean
  isFieldFocused: boolean
  acquiringFocus: boolean
}): boolean {
  if (!args.textInputEnabled) return false
  if (!args.isEditing && !args.autoFocus) return false
  // Keep the textarea mounted for the whole edit session (not only while acquiring focus).
  return true
}
