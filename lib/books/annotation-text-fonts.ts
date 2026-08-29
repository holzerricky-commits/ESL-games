import type { CSSProperties } from 'react'

export type AnnotationTextFontId =
  | 'lexend'
  | 'nunito'
  | 'fredoka'
  | 'comic-neue'
  | 'kalam'
  | 'caveat'
  | 'sweetkiss-light'
  | 'chococookie-light'
  | 'chococookie-medium'
  | 'chococookie-mm'
  | 'chococookie-c'
  | 'minako-regular'
  | 'happy-friday'
  | 'mix-string-cheese'
  | 'casino-hand'
  | 'grimnotes'
  | 'grimnotes-alternate'
  /** Clean system sans — used by translate-dock place chips; hidden from the handwriting picker. */
  | 'ui-sans'

export type AnnotationTextFontWeight = 'regular' | 'bold'

export type AnnotationTextFontOption = {
  id: AnnotationTextFontId
  label: string
  cssFamily: string
  /** Average glyph width ÷ font size — used when canvas/DOM measure is unavailable. */
  avgCharWidthRatio: number
  /** When false, omit from the teacher text-font picker. Default true. */
  showInPicker?: boolean
  /** When false, Bold is ignored (single-weight leftover faces). Default true. */
  supportsBold?: boolean
}

export const DEFAULT_ANNOTATION_TEXT_FONT_ID: AnnotationTextFontId = 'lexend'
export const DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT: AnnotationTextFontWeight = 'regular'

export const ANNOTATION_TEXT_FONTS: readonly AnnotationTextFontOption[] = [
  {
    id: 'lexend',
    label: 'Lexend',
    cssFamily: 'var(--font-lexend), ui-sans-serif, sans-serif',
    avgCharWidthRatio: 0.54,
  },
  {
    id: 'nunito',
    label: 'Nunito',
    cssFamily: 'var(--font-nunito), ui-sans-serif, sans-serif',
    avgCharWidthRatio: 0.52,
  },
  {
    id: 'fredoka',
    label: 'Fredoka',
    cssFamily: 'var(--font-fredoka), ui-sans-serif, sans-serif',
    avgCharWidthRatio: 0.54,
  },
  {
    id: 'comic-neue',
    label: 'Comic Neue',
    cssFamily: 'var(--font-comic-neue), ui-sans-serif, sans-serif',
    avgCharWidthRatio: 0.52,
  },
  {
    id: 'kalam',
    label: 'Kalam',
    cssFamily: 'var(--font-kalam), cursive',
    avgCharWidthRatio: 0.5,
  },
  {
    id: 'caveat',
    label: 'Caveat',
    cssFamily: 'var(--font-caveat), cursive',
    avgCharWidthRatio: 0.46,
  },
  {
    id: 'sweetkiss-light',
    label: 'SweetKiss Light',
    cssFamily: '"DS SweetKiss Light", cursive',
    avgCharWidthRatio: 0.48,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'chococookie-light',
    label: 'ChocoCookie Light',
    cssFamily: '"Cre ChocoCookie Light", cursive',
    avgCharWidthRatio: 0.5,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'chococookie-medium',
    label: 'ChocoCookie Medium',
    cssFamily: '"Cre ChocoCookie Medium", cursive',
    avgCharWidthRatio: 0.52,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'chococookie-mm',
    label: 'ChocoCookie MM',
    cssFamily: '"Cre ChocoCookie MM", cursive',
    avgCharWidthRatio: 0.5,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'chococookie-c',
    label: 'ChocoCookie C',
    cssFamily: '"Cre ChocoCookie C", cursive',
    avgCharWidthRatio: 0.5,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'minako-regular',
    label: 'Minako Regular',
    cssFamily: '"Minako Regular", cursive',
    avgCharWidthRatio: 0.46,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'happy-friday',
    label: 'Happy Friday',
    cssFamily: '"Happy Friday", cursive',
    avgCharWidthRatio: 0.5,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'mix-string-cheese',
    label: 'Mix String Cheese',
    cssFamily: '"Mix String Cheese", cursive',
    avgCharWidthRatio: 0.48,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'casino-hand',
    label: 'Casino Hand',
    cssFamily: '"Casino Hand", cursive',
    avgCharWidthRatio: 0.5,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'grimnotes',
    label: 'Grimnotes',
    cssFamily: '"Grimnotes Demo", cursive',
    avgCharWidthRatio: 0.47,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'grimnotes-alternate',
    label: 'Grimnotes Alternate',
    cssFamily: '"Grimnotes Alternate Demo", cursive',
    avgCharWidthRatio: 0.47,
    showInPicker: false,
    supportsBold: false,
  },
  {
    id: 'ui-sans',
    label: 'Clean Sans',
    cssFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    avgCharWidthRatio: 0.55,
    showInPicker: false,
  },
] as const

const FONT_BY_ID = new Map(ANNOTATION_TEXT_FONTS.map((font) => [font.id, font]))

/** Fonts shown in the text tool picker (excludes system chip font and leftover handwriting). */
export const ANNOTATION_TEXT_FONTS_FOR_PICKER: readonly AnnotationTextFontOption[] =
  ANNOTATION_TEXT_FONTS.filter((font) => font.showInPicker !== false)

export function isAnnotationTextFontId(value: unknown): value is AnnotationTextFontId {
  return typeof value === 'string' && FONT_BY_ID.has(value as AnnotationTextFontId)
}

export function isAnnotationTextFontWeight(value: unknown): value is AnnotationTextFontWeight {
  return value === 'regular' || value === 'bold'
}

export function getAnnotationTextFont(id?: AnnotationTextFontId | string | null): AnnotationTextFontOption {
  if (isAnnotationTextFontId(id)) return FONT_BY_ID.get(id)!
  return FONT_BY_ID.get(DEFAULT_ANNOTATION_TEXT_FONT_ID)!
}

export function annotationTextFontFamily(id?: AnnotationTextFontId | string | null): string {
  return getAnnotationTextFont(id).cssFamily
}

export function annotationTextFontSupportsBold(id?: AnnotationTextFontId | string | null): boolean {
  return getAnnotationTextFont(id).supportsBold !== false
}

/** Picker-visible font, otherwise the current default (old handwriting prefs). */
export function resolvePickerAnnotationTextFontId(
  id?: AnnotationTextFontId | string | null,
): AnnotationTextFontId {
  if (!isAnnotationTextFontId(id)) return DEFAULT_ANNOTATION_TEXT_FONT_ID
  return getAnnotationTextFont(id).showInPicker === false
    ? DEFAULT_ANNOTATION_TEXT_FONT_ID
    : id
}

/**
 * CSS weight for on-page notes.
 * Translation chips stay semibold. Leftover handwriting has no real bold file.
 */
export function annotationTextCssWeight(
  id?: AnnotationTextFontId | string | null,
  weight?: AnnotationTextFontWeight | null,
): CSSProperties['fontWeight'] {
  if (id === 'ui-sans') return 600
  if (weight === 'bold' && annotationTextFontSupportsBold(id)) return 700
  return 400
}

/** Semibold for translation chips; handwriting fonts stay at normal weight unless Bold is on. */
export function annotationTextFontWeight(
  id?: AnnotationTextFontId | string | null,
  weight?: AnnotationTextFontWeight | null,
): CSSProperties['fontWeight'] {
  return annotationTextCssWeight(id, weight)
}

export function annotationTextFontWeightField(
  weight?: AnnotationTextFontWeight | null,
): { fontWeight?: AnnotationTextFontWeight } {
  return isAnnotationTextFontWeight(weight) ? { fontWeight: weight } : {}
}
