import type { AnnotationLineDashStyle } from '@/lib/books/annotation-command-types'
import type { StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import type { PenSwatch } from '@/lib/books/annotation-palettes'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import {
  penProfileWidthScaleMultiplier,
  resolvePenInkStyleForProfile,
  type PenStrokeProfile,
} from '@/lib/books/pen-stroke-profile'
import { thicknessStepToWidthScale } from '@/lib/books/shape-stroke-width-steps'

/** Stable signature squiggle in normalized 0–1 space (inset so caps are not clipped). */
export const PEN_TOOL_PREVIEW_POINTS: readonly [number, number][] = [
  [0.1, 0.68],
  [0.2, 0.52],
  [0.3, 0.64],
  [0.4, 0.48],
  [0.5, 0.6],
  [0.6, 0.44],
  [0.7, 0.56],
  [0.8, 0.4],
  [0.9, 0.5],
]

export type PenToolPreviewStrokeInput = {
  penStrokeProfile: PenStrokeProfile
  penThicknessStep: AnnotationStrokeThicknessStep
  penLineDashStyle: AnnotationLineDashStyle
  penSwatch: PenSwatch
  penColorSource: AnnotationColorSource
  penCustomHex: string
}

export type PenToolPreviewStrokeCommand = Pick<
  StrokeAnnotationCommand,
  'tool' | 'points' | 'widthScale' | 'color' | 'penInkStyle' | 'penStrokeProfile' | 'lineDashStyle'
>

export function buildPenToolPreviewStrokeCommand(
  input: PenToolPreviewStrokeInput,
): PenToolPreviewStrokeCommand {
  const {
    penStrokeProfile,
    penThicknessStep,
    penLineDashStyle,
    penSwatch,
    penColorSource,
    penCustomHex,
  } = input

  const colorSource = penColorSource === 'custom' ? 'custom' : 'swatch'
  const color = colorSource === 'custom' ? penCustomHex : penSwatch.color
  const penInkStyle = resolvePenInkStyleForProfile(penStrokeProfile, penSwatch, colorSource)
  const widthScale =
    thicknessStepToWidthScale(penThicknessStep) * penProfileWidthScaleMultiplier(penStrokeProfile)

  return {
    tool: 'pen',
    points: [...PEN_TOOL_PREVIEW_POINTS],
    widthScale,
    color,
    penInkStyle,
    penStrokeProfile,
    lineDashStyle: penLineDashStyle,
  }
}
