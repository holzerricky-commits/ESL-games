'use client'

import { useCallback, useMemo } from 'react'
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FILL_COLOR,
  TEXT_FILL_BY_STROKE,
} from '@/lib/books/annotation-palettes'
import type {
  TextAnnotationCommand,
  TextAnnotationAlign,
  TextAnnotationVisualStyle,
} from '@/lib/books/annotation-command-types'
import type { AnnotationTextFontId, AnnotationTextFontWeight } from '@/lib/books/annotation-text-fonts'
import { DEFAULT_ANNOTATION_TEXT_FONT_ID, DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT } from '@/lib/books/annotation-text-fonts'
import type { NormRect } from '@/lib/books/annotation-select'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import type { SelectionBarPlacement } from '@/lib/books/selection-context-anchor'
import {
  commonTextFillColor,
  commonTextFontId,
  commonTextFontWeight,
  commonTextFontSizeNorm,
  commonTextStrokeColor,
  commonTextVisualStyle,
  commonTextAlign,
} from '@/lib/books/selection-context'
import {
  textFontSizeNormToStep,
  textFontSizePxOptions,
} from '@/lib/books/text-font-size-pixel'
import {
  textThicknessStepToFontSizeNorm,
} from '@/lib/books/text-font-size-steps'
import { SelectionContextBar } from '@/components/students/selection-context-bar/SelectionContextBar'
import {
  SelectionContextActionsWithArrange,
  type SelectionContextObjectArrangeProps,
} from '@/components/students/selection-context-bar/SelectionContextActionsWithArrange'
import { SelectionContextBarDivider } from '@/components/students/selection-context-bar/SelectionContextBarDivider'
import { SelectionContextBarGroup } from '@/components/students/selection-context-bar/SelectionContextBarGroup'
import { SelectionContextColorSection } from '@/components/students/selection-context-bar/SelectionContextColorSection'
import { SelectionContextSizeStepper } from '@/components/students/selection-context-bar/SelectionContextSizeStepper'
import {
  TopStripTextFontChip,
  TopStripTextWeightChip,
  TopStripTextStyleChip,
  TopStripTextAlignChip,
} from '@/components/students/annotation-top-strip-controls'

export function TextSelectionContextBar({
  textCommands,
  anchorRect,
  placement,
  positionKey,
  heightPx,
  onPatch,
  onDelete,
  onDuplicate,
  showObjectArrange,
  onArrange,
  showObjectDistribute,
  onDistributeVertical,
  visible = true,
}: {
  textCommands: readonly TextAnnotationCommand[]
  anchorRect: NormRect
  placement: SelectionBarPlacement
  positionKey: string
  heightPx: number
  onPatch: (partial: Partial<TextAnnotationCommand>) => void
  onDelete: () => void
  onDuplicate: () => void
  visible?: boolean
} & SelectionContextObjectArrangeProps) {
  const activeColor = commonTextStrokeColor(textCommands)
  const activeFont = commonTextFontId(textCommands)
  const activeWeight = commonTextFontWeight(textCommands)
  const activeStyle = commonTextVisualStyle(textCommands)
  const activeAlign = commonTextAlign(textCommands)
  const activeFill = commonTextFillColor(textCommands)
  const activeSizeNorm = commonTextFontSizeNorm(textCommands)

  const fontChipValue: AnnotationTextFontId =
    activeFont === 'mixed' || activeFont == null
      ? DEFAULT_ANNOTATION_TEXT_FONT_ID
      : (activeFont ?? DEFAULT_ANNOTATION_TEXT_FONT_ID)

  const weightChipValue: AnnotationTextFontWeight =
    activeWeight === 'mixed' || activeWeight == null
      ? DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT
      : activeWeight

  const styleChipValue: TextAnnotationVisualStyle =
    activeStyle === 'mixed' || activeStyle == null ? 'plain' : activeStyle

  const alignChipValue: TextAnnotationAlign =
    activeAlign === 'mixed' || activeAlign == null ? 'left' : activeAlign

  const sizeStep: AnnotationStrokeThicknessStep =
    activeSizeNorm === 'mixed' || activeSizeNorm == null
      ? 4
      : textFontSizeNormToStep(activeSizeNorm)

  const textSizeOptions = useMemo(() => textFontSizePxOptions(heightPx), [heightPx])

  const strokeColorValue =
    activeColor === 'mixed' || activeColor == null
      ? textCommands[0]?.color ?? DEFAULT_TEXT_COLOR
      : activeColor

  const fillColorValue =
    activeFill === 'mixed' || activeFill == null
      ? textCommands[0]?.fillColor ?? DEFAULT_TEXT_FILL_COLOR
      : activeFill

  const strokePaletteExtras = useMemo(
    () => ({
      textColor: strokeColorValue,
      pickTextColor: (hex: string) => onPatch({ color: hex }),
      textVisualStyle: styleChipValue,
      textFillColor: fillColorValue,
    }),
    [strokeColorValue, styleChipValue, fillColorValue, onPatch],
  )

  const patchFillColor = useCallback(
    (hex: string) => onPatch({ visualStyle: 'filled', fillColor: hex }),
    [onPatch],
  )

  const fillPaletteExtras = useMemo(
    () => ({
      textColor: strokeColorValue,
      textVisualStyle: 'filled' as const,
      textFillColor: fillColorValue,
      pickTextFillColor: patchFillColor,
    }),
    [strokeColorValue, fillColorValue, patchFillColor],
  )

  function patchStyle(next: TextAnnotationVisualStyle) {
    if (next === 'filled') {
      const stroke = strokeColorValue.toLowerCase()
      const fill = TEXT_FILL_BY_STROKE[stroke] ?? DEFAULT_TEXT_FILL_COLOR
      onPatch({ visualStyle: 'filled', fillColor: fill })
      return
    }
    onPatch({ visualStyle: 'plain' })
  }

  return (
    <SelectionContextBar
      anchorRect={anchorRect}
      placement={placement}
      positionKey={positionKey}
      visible={visible}
      aria-label="Text label options"
    >
      <SelectionContextBarGroup aria-label="Text colors">
        <SelectionContextColorSection
          kind="text"
          idPrefix="ctx-text-stroke"
          activeValue={strokeColorValue}
          paletteTarget="text"
          paletteExtras={strokePaletteExtras}
          onPick={(hex) => onPatch({ color: hex })}
        />
        <SelectionContextColorSection
          kind="text"
          idPrefix="ctx-text-fill"
          activeValue={fillColorValue}
          paletteTarget="text"
          paletteExtras={fillPaletteExtras}
          onPick={patchFillColor}
        />
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Text style">
        <TopStripTextFontChip
          value={fontChipValue}
          onChange={(id) => onPatch({ fontId: id })}
          idPrefix="ctx-text"
          compact
        />
        <TopStripTextWeightChip
          value={weightChipValue}
          onChange={(weight) => onPatch({ fontWeight: weight })}
          idPrefix="ctx-text"
        />
        <TopStripTextStyleChip
          style={styleChipValue}
          onChange={patchStyle}
          idPrefix="ctx-text"
        />
        <TopStripTextAlignChip
          value={alignChipValue}
          onChange={(align) => onPatch({ textAlign: align })}
          idPrefix="ctx-text"
          layout="dropdown"
        />
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Text size">
        <SelectionContextSizeStepper
          valueStep={sizeStep}
          options={textSizeOptions}
          onChange={(step) => onPatch({ fontSizeNorm: textThicknessStepToFontSizeNorm(step) })}
          ariaLabel="Text size"
          idPrefix="ctx-text"
        />
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextActionsWithArrange
        showObjectArrange={showObjectArrange}
        onArrange={onArrange}
        showObjectDistribute={showObjectDistribute}
        onDistributeVertical={onDistributeVertical}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        duplicateLabel="Duplicate selected text"
        deleteLabel="Delete selected text"
        actionsAriaLabel="Text actions"
        arrangeIdPrefix="ctx-text-object-arrange"
      />
    </SelectionContextBar>
  )
}
