import {
  DEFAULT_PEN_SWATCH_ID,
  getPenSwatch,
  getPenSwatchIdForColor,
} from '@/lib/books/annotation-palettes'

/** Map stored shape stroke hex to pen swatch id for the color cluster. */
export function shapeStrokeColorToSwatchId(strokeColor: string | null | undefined): string {
  if (!strokeColor) return DEFAULT_PEN_SWATCH_ID
  return getPenSwatchIdForColor(strokeColor)
}

export function penSwatchIdToStrokeColor(swatchId: string): string {
  return getPenSwatch(swatchId).color
}
