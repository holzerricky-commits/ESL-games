'use client'

import { useMemo } from 'react'
import { Bold } from 'lucide-react'
import { DEFAULT_STICKY_FILL_COLOR } from '@/lib/books/annotation-palettes'
import type { StickyAnnotationCommand } from '@/lib/books/annotation-command-types'
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import {
  annotationTextFontSupportsBold,
  DEFAULT_ANNOTATION_TEXT_FONT_ID,
  DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT,
} from '@/lib/books/annotation-text-fonts'
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
import { cn } from '@/lib/utils'
import { SelectionContextBar } from '@/components/students/selection-context-bar/SelectionContextBar'
import {
  SelectionContextActionsWithArrange,
  type SelectionContextObjectArrangeProps,
} from '@/components/students/selection-context-bar/SelectionContextActionsWithArrange'
import { SelectionContextBarDivider } from '@/components/students/selection-context-bar/SelectionContextBarDivider'
import { SelectionContextBarGroup } from '@/components/students/selection-context-bar/SelectionContextBarGroup'
import {
  CONTEXT_STICKY_FILL_COLORS,
  SelectionContextHexColorControl,
} from '@/components/students/selection-context-bar/SelectionContextColorButton'
import { SelectionContextSizeStepper } from '@/components/students/selection-context-bar/SelectionContextSizeStepper'
import { TopStripTextFontChip } from '@/components/students/annotation-top-strip-controls'
import {
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
  SELECTION_CONTEXT_ICON_CLASS,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'

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

  const boldOn = activeWeight === 'bold'
  const boldSupported = annotationTextFontSupportsBold(fontChipValue)

  const sizeStep: AnnotationStrokeThicknessStep =
    activeSizeNorm === 'mixed' || activeSizeNorm == null
      ? 4
      : textFontSizeNormToStep(activeSizeNorm)

  const textSizeOptions = useMemo(() => textFontSizePxOptions(heightPx), [heightPx])

  const fillColorValue =
    activeFill === 'mixed' || activeFill == null
      ? stickyCommands[0]?.fillColor ?? DEFAULT_STICKY_FILL_COLOR
      : activeFill

  return (
    <SelectionContextBar
      anchorRect={anchorRect}
      placement={placement}
      positionKey={positionKey}
      visible={visible}
      aria-label="Sticky note options"
    >
      <SelectionContextBarGroup aria-label="Note color">
        <SelectionContextHexColorControl
          role="fill"
          color={fillColorValue}
          colors={CONTEXT_STICKY_FILL_COLORS}
          recentKind="sticky"
          ariaLabel="Note color"
          idPrefix="ctx-sticky"
          label="Note color"
          onPick={(hex) => onPatch({ fillColor: hex })}
        />
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Note typography">
        <TopStripTextFontChip
          value={fontChipValue}
          onChange={(id) => onPatch({ fontId: id })}
          idPrefix="ctx-sticky"
          compact
        />
        <button
          type="button"
          id="ctx-sticky-bold"
          className={cn(
            SELECTION_CONTEXT_BAR_ACTION_BTN,
            boldOn && SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
            !boldSupported && 'opacity-35',
          )}
          aria-label={boldOn ? 'Bold on' : 'Bold'}
          aria-pressed={boldOn}
          title="Bold"
          disabled={!boldSupported}
          onClick={() =>
            onPatch({
              fontWeight: boldOn ? DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT : 'bold',
            })
          }
        >
          <Bold className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={2} aria-hidden />
        </button>
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
