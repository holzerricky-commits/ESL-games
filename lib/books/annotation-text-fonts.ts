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

export type AnnotationTextFontOption = {
  id: AnnotationTextFontId
  label: string
  cssFamily: string
}

export const DEFAULT_ANNOTATION_TEXT_FONT_ID: AnnotationTextFontId = 'sweetkiss-light'

export const ANNOTATION_TEXT_FONTS: readonly AnnotationTextFontOption[] = [
  {
    id: 'sweetkiss-light',
    label: 'SweetKiss Light',
    cssFamily: '"DS SweetKiss Light", cursive',
  },
  {
    id: 'chococookie-light',
    label: 'ChocoCookie Light',
    cssFamily: '"Cre ChocoCookie Light", cursive',
  },
  {
    id: 'chococookie-medium',
    label: 'ChocoCookie Medium',
    cssFamily: '"Cre ChocoCookie Medium", cursive',
  },
  {
    id: 'chococookie-mm',
    label: 'ChocoCookie MM',
    cssFamily: '"Cre ChocoCookie MM", cursive',
  },
  {
    id: 'chococookie-c',
    label: 'ChocoCookie C',
    cssFamily: '"Cre ChocoCookie C", cursive',
  },
  {
    id: 'minako-regular',
    label: 'Minako Regular',
    cssFamily: '"Minako Regular", cursive',
  },
  {
    id: 'happy-friday',
    label: 'Happy Friday',
    cssFamily: '"Happy Friday", cursive',
  },
  {
    id: 'mix-string-cheese',
    label: 'Mix String Cheese',
    cssFamily: '"Mix String Cheese", cursive',
  },
  {
    id: 'casino-hand',
    label: 'Casino Hand',
    cssFamily: '"Casino Hand", cursive',
  },
  {
    id: 'grimnotes',
    label: 'Grimnotes',
    cssFamily: '"Grimnotes Demo", cursive',
  },
  {
    id: 'grimnotes-alternate',
    label: 'Grimnotes Alternate',
    cssFamily: '"Grimnotes Alternate Demo", cursive',
  },
] as const

const FONT_BY_ID = new Map(ANNOTATION_TEXT_FONTS.map((font) => [font.id, font]))

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
