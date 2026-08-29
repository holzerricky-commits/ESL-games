/** Visual tokens for grab-and-place Chinese from the translate dock (drag preview + dropped label). */

export const TRANSLATION_CHIP_FILL = '#2a2a2e'
export const TRANSLATION_CHIP_TEXT = '#f4f4f5'
/** Matches Tailwind `text-2xl` used by the cursor-follow preview. */
export const TRANSLATION_CHIP_FONT_SIZE_PX = 24
export const TRANSLATION_CHIP_FONT_ID = 'ui-sans' as const
/** Matches Tailwind `leading-tight`. */
export const TRANSLATION_CHIP_LINE_HEIGHT = 1.25
/** Matches Tailwind `px-2` / `py-1`. */
export const TRANSLATION_CHIP_PAD_X_PX = 8
export const TRANSLATION_CHIP_PAD_Y_PX = 4
/** Same nudge as the floating drag ghost (`left: cursor.x + 3`). */
export const TRANSLATION_CHIP_CURSOR_NUDGE_X_PX = 3

/** Same classes as the floating drag preview — keep preview and paste in sync. */
export const TRANSLATION_CHIP_PREVIEW_CLASS =
  'inline-block rounded-lg bg-[#2a2a2e]/85 px-2 py-1 text-2xl font-semibold leading-tight text-[#f4f4f5] shadow-[0_4px_16px_rgba(0,0,0,0.35)]'

export function translationChipFontSizeNorm(spreadHeightPx: number): number {
  const h = Number.isFinite(spreadHeightPx) && spreadHeightPx > 0 ? spreadHeightPx : 600
  return Math.max(0.012, TRANSLATION_CHIP_FONT_SIZE_PX / h)
}

/** Outer chip height in CSS px — font line box + vertical padding (matches the preview span). */
export function translationChipHeightPx(): number {
  return (
    Math.ceil(TRANSLATION_CHIP_FONT_SIZE_PX * TRANSLATION_CHIP_LINE_HEIGHT) +
    TRANSLATION_CHIP_PAD_Y_PX * 2
  )
}

/**
 * Place the chip so its on-page position matches the floating drag ghost at click time
 * (left edge at cursor+nudge, vertically centered on the cursor). No text-tool caret inset.
 */
export function translationChipPlacementNorm(opts: {
  clientX: number
  clientY: number
  spreadLeftPx: number
  spreadTopPx: number
  spreadWidthPx: number
  spreadHeightPx: number
}): { x: number; y: number; yAnchor: 'top' } {
  const { spreadWidthPx, spreadHeightPx } = opts
  if (!(spreadWidthPx > 0) || !(spreadHeightPx > 0)) {
    return { x: 0, y: 0, yAnchor: 'top' }
  }
  const chipH = translationChipHeightPx()
  const leftPx = opts.clientX + TRANSLATION_CHIP_CURSOR_NUDGE_X_PX - opts.spreadLeftPx
  const topPx = opts.clientY - chipH / 2 - opts.spreadTopPx
  const x = Math.max(0, Math.min(1, leftPx / spreadWidthPx))
  const y = Math.max(0, Math.min(1, topPx / spreadHeightPx))
  return { x, y, yAnchor: 'top' }
}

export function isTranslationChipText(cmd: {
  visualStyle?: string
  fontId?: string
  fillColor?: string
}): boolean {
  if (cmd.visualStyle !== 'filled') return false
  if (cmd.fontId !== TRANSLATION_CHIP_FONT_ID) return false
  const fill = typeof cmd.fillColor === 'string' ? cmd.fillColor.trim().toLowerCase() : ''
  return fill === TRANSLATION_CHIP_FILL
}

/**
 * Chips saved before charcoal was allowlisted were remapped to white on load.
 * Detect that signature and restore the dark fill so they look the same next class.
 */
export function restoreTranslationChipFill(cmd: {
  visualStyle?: string
  fontId?: string
  color?: string
  fillColor?: string
}): string | undefined {
  if (cmd.visualStyle !== 'filled') return undefined
  if (cmd.fontId !== TRANSLATION_CHIP_FONT_ID) return undefined
  const ink = typeof cmd.color === 'string' ? cmd.color.trim().toLowerCase() : ''
  if (ink !== TRANSLATION_CHIP_TEXT) return undefined
  const fill = typeof cmd.fillColor === 'string' ? cmd.fillColor.trim().toLowerCase() : ''
  if (fill === TRANSLATION_CHIP_FILL) return TRANSLATION_CHIP_FILL
  // Default / white after migrateTextFillColor ate the charcoal
  if (fill === '#ffffff' || fill === '') return TRANSLATION_CHIP_FILL
  return undefined
}
