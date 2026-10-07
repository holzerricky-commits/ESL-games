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
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import {
  annotationTextFontSupportsBold,
  DEFAULT_ANNOTATION_TEXT_FONT_ID,
  DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT,
} from '@/lib/books/annotation-text-fonts'
import { Bold, Italic, Underline } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NormRect } from '@/lib/books/annotation-select'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import type { SelectionBarPlacement } from '@/lib/books/selection-context-anchor'
import {
  commonTextFillColor,
  commonTextFontId,
  commonTextFontWeight,
  commonTextFontSizeNorm,
  commonTextItalic,
  commonTextStrokeColor,
  commonTextUnderline,
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
import {
  CONTEXT_TEXT_FILL_COLORS,
  CONTEXT_TEXT_INK_COLORS,
  SelectionContextHexColorControl,
} from '@/components/students/selection-context-bar/SelectionContextColorButton'
import { SelectionContextSizeStepper } from '@/components/students/selection-context-bar/SelectionContextSizeStepper'
import {
  TopStripTextFontChip,
  TopStripTextStyleChip,
  TopStripTextAlignChip,
} from '@/components/students/annotation-top-strip-controls'
import {
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
  SELECTION_CONTEXT_ICON_CLASS,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'

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
  const activeItalic = commonTextItalic(textCommands)
  const activeUnderline = commonTextUnderline(textCommands)
  const activeStyle = commonTextVisualStyle(textCommands)
  const activeAlign = commonTextAlign(textCommands)
  const activeFill = commonTextFillColor(textCommands)
  const activeSizeNorm = commonTextFontSizeNorm(textCommands)

  const fontChipValue: AnnotationTextFontId =
    activeFont === 'mixed' || activeFont == null
      ? DEFAULT_ANNOTATION_TEXT_FONT_ID
      : (activeFont ?? DEFAULT_ANNOTATION_TEXT_FONT_ID)

  const boldOn = activeWeight === 'bold'
  const boldSupported = annotationTextFontSupportsBold(fontChipValue)
  const italicOn = activeItalic === true
  const underlineOn = activeUnderline === true

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

  const showFillColor = styleChipValue === 'filled'

  const patchFillColor = useCallback(
    (hex: string) => onPatch({ visualStyle: 'filled', fillColor: hex }),
    [onPatch],
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
      <SelectionContextBarGroup aria-label="Text appearance">
        <SelectionContextHexColorControl
          role="ink"
          color={strokeColorValue}
          colors={CONTEXT_TEXT_INK_COLORS}
          recentKind="text"
          ariaLabel="Text color"
          idPrefix="ctx-text-ink"
          label="Text color"
          onPick={(hex) => onPatch({ color: hex })}
        />
        {showFillColor ? (
          <SelectionContextHexColorControl
            role="fill"
            color={fillColorValue}
            colors={CONTEXT_TEXT_FILL_COLORS}
            recentKind="text"
            ariaLabel="Background color"
            idPrefix="ctx-text-fill"
            label="Background"
            onPick={patchFillColor}
          />
        ) : null}
        <TopStripTextStyleChip
          style={styleChipValue}
          onChange={patchStyle}
          idPrefix="ctx-text"
        />
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Text typography">
        <TopStripTextFontChip
          value={fontChipValue}
          onChange={(id) => onPatch({ fontId: id })}
          idPrefix="ctx-text"
          compact
        />
        <button
          type="button"
          id="ctx-text-bold"
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
        <button
          type="button"
          id="ctx-text-italic"
          className={cn(
            SELECTION_CONTEXT_BAR_ACTION_BTN,
            italicOn && SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
          )}
          aria-label={italicOn ? 'Italic on' : 'Italic'}
          aria-pressed={italicOn}
          title="Italic"
          onClick={() => onPatch({ italic: !italicOn })}
        >
          <Italic className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          id="ctx-text-underline"
          className={cn(
            SELECTION_CONTEXT_BAR_ACTION_BTN,
            underlineOn && SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
          )}
          aria-label={underlineOn ? 'Underline on' : 'Underline'}
          aria-pressed={underlineOn}
          title="Underline"
          onClick={() => onPatch({ underline: !underlineOn })}
        >
          <Underline className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={2} aria-hidden />
        </button>
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

      <SelectionContextBarGroup aria-label="Text alignment">
        <TopStripTextAlignChip
          value={alignChipValue}
          onChange={(align) => onPatch({ textAlign: align })}
          idPrefix="ctx-text"
          layout="dropdown"
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
