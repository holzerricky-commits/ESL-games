import { normalizeCustomHex } from '@/lib/books/annotation-custom-color'
import { deriveSmartInkFromBackground } from '@/lib/books/eyedropper-derive'

export type EyedropperVariant = 'sample' | 'smart'

export const EYEDROPPER_VARIANTS: readonly EyedropperVariant[] = ['sample', 'smart']

export const DEFAULT_EYEDROPPER_VARIANT: EyedropperVariant = 'sample'

export const EYEDROPPER_VARIANT_LABEL: Record<EyedropperVariant, string> = {
  sample: 'Sample color',
  smart: 'Smart ink',
}

export function isEyedropperVariant(v: unknown): v is EyedropperVariant {
  return typeof v === 'string' && (EYEDROPPER_VARIANTS as readonly string[]).includes(v)
}

/** Pen ink hex from a sampled background and the active eyedropper mode. */
export function inkFromEyedropperSample(bgHex: string, variant: EyedropperVariant): string {
  const norm = normalizeCustomHex(bgHex)
  return variant === 'smart' ? deriveSmartInkFromBackground(norm) : norm
}
