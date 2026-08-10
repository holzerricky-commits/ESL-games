import type { TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import { measureTextLabelBounds, type NormRect } from '@/lib/books/text-label-measure'
/** Which chrome surface is asking for bounds — same measure rules, different empty-text policy. */
export type TextLabelChromeMode = 'hover' | 'edit' | 'select'

export type TextLabelChromeBoundsOpts = {
  mode?: TextLabelChromeMode
  /** Live draft while the text tool is editing (spread/page DOM layer). */
  liveText?: string | null
  /** Match focused-field editing layout (explicit newlines, unwrapped width). */
  growOnly?: boolean
  latchedMaxWidth?: boolean
}

/**
 * Single entry for text-label selection rings (hover dashed, edit solid, select-tool solid).
 * Always uses `measureTextLabelBounds` in tight mode with layout tokens from `text-label-layout`.
 */
export function textLabelChromeBounds(
  cmd: TextAnnotationCommand,
  widthPx: number,
  heightPx: number,
  opts?: TextLabelChromeBoundsOpts,
): NormRect | null {
  const mode = opts?.mode ?? 'select'
  const liveText = opts?.liveText

  if (mode === 'edit') {
    const textCmd =
      liveText != null ? ({ ...cmd, text: liveText } as TextAnnotationCommand) : cmd
    const raw = liveText ?? textCmd.text
    // Caret-sized when empty — no placeholder inflates the edit box.
    const measureText = raw
    const rect = measureTextLabelBounds(textCmd, widthPx, heightPx, {
      mode: 'tight',
      textOverride: measureText,
      growOnly: opts?.growOnly ?? true,
      latchedMaxWidth: opts?.latchedMaxWidth,
    })
    if (rect.w <= 0 || rect.h <= 0) return null
    return rect
  }

  if (!cmd.text.trim()) return null

  const rect = measureTextLabelBounds(cmd, widthPx, heightPx, { mode: 'tight' })
  return rect.w > 0 && rect.h > 0 ? rect : null
}
