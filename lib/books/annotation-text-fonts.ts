import type { CSSProperties } from 'react'

export type AnnotationTextFontId =
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

export type AnnotationTextFontOption = {
  id: AnnotationTextFontId
  label: string
  cssFamily: string
  /** Average glyph width ÷ font size — used when canvas/DOM measure is unavailable. */
  avgCharWidthRatio: number
  /** When false, omit from the teacher text-font picker. Default true. */
  showInPicker?: boolean
}

export const DEFAULT_ANNOTATION_TEXT_FONT_ID: AnnotationTextFontId = 'sweetkiss-light'

export const ANNOTATION_TEXT_FONTS: readonly AnnotationTextFontOption[] = [
  {
    id: 'sweetkiss-light',
    label: 'SweetKiss Light',
    cssFamily: '"DS SweetKiss Light", cursive',
    avgCharWidthRatio: 0.48,
  },
  {
    id: 'chococookie-light',
    label: 'ChocoCookie Light',
    cssFamily: '"Cre ChocoCookie Light", cursive',
    avgCharWidthRatio: 0.5,
  },
  {
    id: 'chococookie-medium',
    label: 'ChocoCookie Medium',
    cssFamily: '"Cre ChocoCookie Medium", cursive',
    avgCharWidthRatio: 0.52,
  },
  {
    id: 'chococookie-mm',
    label: 'ChocoCookie MM',
    cssFamily: '"Cre ChocoCookie MM", cursive',
    avgCharWidthRatio: 0.5,
  },
  {
    id: 'chococookie-c',
    label: 'ChocoCookie C',
    cssFamily: '"Cre ChocoCookie C", cursive',
    avgCharWidthRatio: 0.5,
  },
  {
    id: 'minako-regular',
    label: 'Minako Regular',
    cssFamily: '"Minako Regular", cursive',
    avgCharWidthRatio: 0.46,
  },
  {
    id: 'happy-friday',
    label: 'Happy Friday',
    cssFamily: '"Happy Friday", cursive',
    avgCharWidthRatio: 0.5,
  },
  {
    id: 'mix-string-cheese',
    label: 'Mix String Cheese',
    cssFamily: '"Mix String Cheese", cursive',
    avgCharWidthRatio: 0.48,
  },
  {
    id: 'casino-hand',
    label: 'Casino Hand',
    cssFamily: '"Casino Hand", cursive',
    avgCharWidthRatio: 0.5,
  },
  {
    id: 'grimnotes',
    label: 'Grimnotes',
    cssFamily: '"Grimnotes Demo", cursive',
    avgCharWidthRatio: 0.47,
  },
  {
    id: 'grimnotes-alternate',
    label: 'Grimnotes Alternate',
    cssFamily: '"Grimnotes Alternate Demo", cursive',
    avgCharWidthRatio: 0.47,
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

/** Handwriting fonts shown in the text tool picker (excludes system chip font). */
export const ANNOTATION_TEXT_FONTS_FOR_PICKER: readonly AnnotationTextFontOption[] =
  ANNOTATION_TEXT_FONTS.filter((font) => font.showInPicker !== false)

export function isAnnotationTextFontId(value: unknown): value is AnnotationTextFontId {
  return typeof value === 'string' && FONT_BY_ID.has(value as AnnotationTextFontId)
}

export function getAnnotationTextFont(id?: AnnotationTextFontId | string | null): AnnotationTextFontOption {
  if (isAnnotationTextFontId(id)) return FONT_BY_ID.get(id)!
  return FONT_BY_ID.get(DEFAULT_ANNOTATION_TEXT_FONT_ID)!
}

export function annotationTextFontFamily(id?: AnnotationTextFontId | string | null): string {
  return getAnnotationTextFont(id).cssFamily
}

/** Semibold for translation chips; handwriting fonts stay at normal weight. */
export function annotationTextFontWeight(
  id?: AnnotationTextFontId | string | null,
): CSSProperties['fontWeight'] {
  return id === 'ui-sans' ? 600 : undefined
}
