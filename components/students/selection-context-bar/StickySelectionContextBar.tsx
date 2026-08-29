'use client'

import { useMemo } from 'react'
import { DEFAULT_STICKY_FILL_COLOR } from '@/lib/books/annotation-palettes'
import type { StickyAnnotationCommand } from '@/lib/books/annotation-command-types'
import type { AnnotationTextFontId, AnnotationTextFontWeight } from '@/lib/books/annotation-text-fonts'
import { DEFAULT_ANNOTATION_TEXT_FONT_ID, DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT } from '@/lib/books/annotation-text-fonts'
import type { NormRect } from '@/lib/books/annotation-select'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import type { SelectionBarPlacement } from '@/lib/books/selection-context-anchor'
import {
  commonStickyFillColor,
  commonStickyFontId,
  commonStickyFontWeight,
  commonStickyFontSizeNorm,
} from '@/lib/books/selection-context'
import {
  textFontSizeNormToStep,
  textFontSizePxOptions,
} from '@/lib/books/text-font-size-pixel'
import { textThicknessStepToFontSizeNorm } from '@/lib/books/text-font-size-steps'
import { SelectionContextBar } from '@/components/students/selection-context-bar/SelectionContextBar'
import {
  SelectionContextActionsWithArrange,
  type SelectionContextObjectArrangeProps,
} from '@/components/students/selection-context-bar/SelectionContextActionsWithArrange'
import { SelectionContextBarDivider } from '@/components/students/selection-context-bar/SelectionContextBarDivider'
import { SelectionContextBarGroup } from '@/components/students/selection-context-bar/SelectionContextBarGroup'
import { SelectionContextColorSection } from '@/components/students/selection-context-bar/SelectionContextColorSection'
import { SelectionContextSizeStepper } from '@/components/students/selection-context-bar/SelectionContextSizeStepper'
import { TopStripTextFontChip, TopStripTextWeightChip } from '@/components/students/annotation-top-strip-controls'

export function StickySelectionContextBar({
  stickyCommands,
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
  stickyCommands: readonly StickyAnnotationCommand[]
  anchorRect: NormRect
  placement: SelectionBarPlacement
  positionKey: string
  heightPx: number
  onPatch: (partial: Partial<StickyAnnotationCommand>) => void
  onDelete: () => void
  onDuplicate: () => void
  visible?: boolean
} & SelectionContextObjectArrangeProps) {
  const activeFill = commonStickyFillColor(stickyCommands)
  const activeFont = commonStickyFontId(stickyCommands)
  const activeWeight = commonStickyFontWeight(stickyCommands)
  const activeSizeNorm = commonStickyFontSizeNorm(stickyCommands)

  const fontChipValue: AnnotationTextFontId =
    activeFont === 'mixed' || activeFont == null
      ? DEFAULT_ANNOTATION_TEXT_FONT_ID
      : (activeFont ?? DEFAULT_ANNOTATION_TEXT_FONT_ID)

  const weightChipValue: AnnotationTextFontWeight =
    activeWeight === 'mixed' || activeWeight == null
      ? DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT
      : activeWeight

  const sizeStep: AnnotationStrokeThicknessStep =
    activeSizeNorm === 'mixed' || activeSizeNorm == null
      ? 4
      : textFontSizeNormToStep(activeSizeNorm)

  const textSizeOptions = useMemo(() => textFontSizePxOptions(heightPx), [heightPx])

  const fillColorValue =
    activeFill === 'mixed' || activeFill == null
      ? stickyCommands[0]?.fillColor ?? DEFAULT_STICKY_FILL_COLOR
      : activeFill

  const paletteExtras = useMemo(
    () => ({
      stickyFillColor: fillColorValue,
      pickStickyFillColor: (hex: string) => onPatch({ fillColor: hex }),
    }),
    [fillColorValue, onPatch],
  )

  return (
    <SelectionContextBar
      anchorRect={anchorRect}
      placement={placement}
      positionKey={positionKey}
      visible={visible}
      aria-label="Sticky note options"
    >
      <SelectionContextBarGroup aria-label="Note color">
        <SelectionContextColorSection
          kind="sticky"
          idPrefix="ctx-sticky"
          activeValue={fillColorValue}
          paletteTarget="sticky"
          paletteExtras={paletteExtras}
          onPick={(hex) => onPatch({ fillColor: hex })}
        />
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Note font">
        <TopStripTextFontChip
          value={fontChipValue}
          onChange={(id) => onPatch({ fontId: id })}
          idPrefix="ctx-sticky"
          compact
        />
        <TopStripTextWeightChip
          value={weightChipValue}
          onChange={(weight) => onPatch({ fontWeight: weight })}
          idPrefix="ctx-sticky"
        />
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Note text size">
        <SelectionContextSizeStepper
          valueStep={sizeStep}
          options={textSizeOptions}
          onChange={(step) => onPatch({ fontSizeNorm: textThicknessStepToFontSizeNorm(step) })}
          ariaLabel="Note text size"
          idPrefix="ctx-sticky"
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
        duplicateLabel="Duplicate selected note"
        deleteLabel="Delete selected note"
        actionsAriaLabel="Note actions"
        arrangeIdPrefix="ctx-sticky-arrange"
      />
    </SelectionContextBar>
  )
}
