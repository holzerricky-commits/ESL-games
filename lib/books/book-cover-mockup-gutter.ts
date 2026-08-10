/**
 * Left-edge gutter lighting for the standing cover mockup (lesson launcher).
 * Percentage stops scale with --book-mockup-width.
 */

/** Gutter lighting falloff as % of full cover face (spine through crease). */
export const BOOK_COVER_MOCKUP_GUTTER_FALLOFF_PERCENT = 10

/**
 * Spine roll-off + hinge crease (multiply).
 * Stops are % of the full cover — crease sits ~6.5–8% in from the left edge.
 */
export function bookCoverMockupGutterShadowBackground(): string {
  const end = BOOK_COVER_MOCKUP_GUTTER_FALLOFF_PERCENT
  return [
    'linear-gradient(to right,',
    'rgba(0, 0, 0, 0.3) 0%,',
    'rgba(0, 0, 0, 0.14) 2%,',
    'rgba(255, 255, 255, 0.16) 4%,',
    'rgba(0, 0, 0, 0.12) 5%,',
    'rgba(0, 0, 0, 0.5) 6.5%,',
    'rgba(0, 0, 0, 0.58) 7.5%,',
    'rgba(0, 0, 0, 0.32) 8.5%,',
    `rgba(0, 0, 0, 0.1) ${end - 1}%,`,
    `transparent ${end}%,`,
    'transparent 100%',
    ')',
  ].join(' ')
}

/**
 * Cover board edge catching light just right of the crease (screen).
 */
export function bookCoverMockupGutterHighlightBackground(): string {
  const end = BOOK_COVER_MOCKUP_GUTTER_FALLOFF_PERCENT
  return [
    'linear-gradient(to right,',
    'transparent 0%,',
    'transparent 6.5%,',
    'rgba(255, 255, 255, 0.26) 7.5%,',
    'rgba(255, 255, 255, 0.18) 8.5%,',
    `rgba(255, 255, 255, 0.07) ${end - 1}%,`,
    `transparent ${end}%,`,
    'transparent 100%',
    ')',
  ].join(' ')
}
