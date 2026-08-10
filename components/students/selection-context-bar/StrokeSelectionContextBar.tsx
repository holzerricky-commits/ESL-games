'use client'

import { useMemo } from 'react'
import { getPenSwatch, getPenSwatchIdForColor } from '@/lib/books/annotation-palettes'
import {
  ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS,
  ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS,
} from '@/lib/books/annotation-storage'
import type { AnnotationLineDashStyle } from '@/lib/books/annotation-command-types'
import type { NormRect } from '@/lib/books/annotation-select'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import type { SelectionBarPlacement } from '@/lib/books/selection-context-anchor'
import type { InkStrokeSelectionPatch } from '@/lib/books/patch-selected-commands'
import {
  commonInkStrokeColor,
  commonInkStrokeLineDash,
  commonInkStrokeMarkerDecoratedEdge,
  commonInkStrokeWidthScale,
  inkStrokeToolMix,
} from '@/lib/books/selection-context'
import type { InkStrokeCommand } from '@/lib/books/stroke-selection'
import { inkThicknessPxOptions } from '@/lib/books/ink-thickness-pixel'
import {
  markerThicknessStepToWidthScale,
  markerWidthScaleToThicknessStep,
} from '@/lib/books/marker-stroke-width-steps'
import {
  thicknessStepToWidthScale,
  widthScaleToThicknessStep,
} from '@/lib/books/shape-stroke-width-steps'
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
  TopStripLineStyleChip,
  TopStripMarkerDecoratedEdgeChip,
} from '@/components/students/annotation-top-strip-controls'
import {
  SELECTION_CONTEXT_BAR_ACTION_BTN,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'
import { Group, Ungroup } from 'lucide-react'

export function StrokeSelectionContextBar({
  strokeCommands,
  anchorRect,
  placement,
  positionKey,
  groupToggleLabel,
  onPatch,
  onDelete,
  onDuplicate,
  onToggleGroup,
  showObjectArrange,
  onArrange,
  showObjectDistribute,
  onDistributeVertical,
  visible = true,
}: {
  strokeCommands: readonly InkStrokeCommand[]
  anchorRect: NormRect
  placement: SelectionBarPlacement
  positionKey: string
  groupToggleLabel?: 'group' | 'ungroup'
  onPatch: (patch: InkStrokeSelectionPatch) => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleGroup?: () => void
  visible?: boolean
} & SelectionContextObjectArrangeProps) {
  const toolMix = inkStrokeToolMix(strokeCommands)
  const activeColor = commonInkStrokeColor(strokeCommands)
  const activeDash = commonInkStrokeLineDash(strokeCommands)
  const activeWidth = commonInkStrokeWidthScale(strokeCommands)
  const activeDecoratedEdge = commonInkStrokeMarkerDecoratedEdge(strokeCommands)

  const dashValue: AnnotationLineDashStyle =
    activeDash === 'mixed' || activeDash == null ? 'solid' : activeDash

  const decoratedEdgeValue =
    activeDecoratedEdge === 'mixed' || activeDecoratedEdge == null
      ? false
      : activeDecoratedEdge

  const thicknessStep: AnnotationStrokeThicknessStep = (() => {
    if (activeWidth === 'mixed' || activeWidth == null) return 4
    if (toolMix === 'marker') return markerWidthScaleToThicknessStep(activeWidth)
    return widthScaleToThicknessStep(activeWidth)
  })()

  const colorValue =
    activeColor === 'mixed' || activeColor == null
      ? strokeCommands[0]?.color ?? '#111827'
      : activeColor

  const penSwatchId = getPenSwatchIdForColor(colorValue)

  const penPaletteExtras = useMemo(
    () => ({
      penSwatchId,
      pickPenSwatch: (id: string) => onPatch({ color: getPenSwatch(id).color }),
    }),
    [penSwatchId, onPatch],
  )

  const markerPaletteExtras = useMemo(
    () => ({
      markerColor: colorValue,
      pickMarkerSwatchColor: (hex: string) => onPatch({ color: hex }),
    }),
    [colorValue, onPatch],
  )

  const showPenColors = toolMix === 'pen'
  const showMarkerColors = toolMix === 'marker'
  const showPenDash = toolMix === 'pen'
  const showMarkerDecorated = toolMix === 'marker'

  const thicknessOptions = useMemo(
    () =>
      inkThicknessPxOptions(
        toolMix === 'marker'
          ? ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS
          : ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS,
      ),
    [toolMix],
  )

  const thicknessAriaLabel = toolMix === 'marker' ? 'Highlighter thickness' : 'Pen thickness'

  return (
    <SelectionContextBar
      anchorRect={anchorRect}
      placement={placement}
      positionKey={positionKey}
      visible={visible}
      aria-label="Ink stroke options"
    >
      {showPenColors || showMarkerColors ? (
        <>
          <SelectionContextBarGroup aria-label="Stroke color">
            {showPenColors ? (
              <SelectionContextColorSection
                kind="pen"
                idPrefix="ctx-stroke-pen"
                activeValue={penSwatchId}
                paletteTarget="pen"
                paletteExtras={penPaletteExtras}
                onPick={(id) => onPatch({ color: getPenSwatch(id).color })}
              />
            ) : null}
            {showMarkerColors ? (
              <SelectionContextColorSection
                kind="marker"
                idPrefix="ctx-stroke-marker"
                activeValue={colorValue}
                paletteTarget="marker"
                paletteExtras={markerPaletteExtras}
                onPick={(hex) => onPatch({ color: hex })}
              />
            ) : null}
          </SelectionContextBarGroup>
          <SelectionContextBarDivider />
        </>
      ) : null}

      {(showPenDash || showMarkerDecorated) && (
        <>
          <SelectionContextBarGroup aria-label="Stroke style">
            {showPenDash ? (
              <TopStripLineStyleChip
                value={dashValue}
                onChange={(style) => onPatch({ lineDashStyle: style })}
                idPrefix="ctx-stroke"
              />
            ) : null}
            {showMarkerDecorated ? (
              <TopStripMarkerDecoratedEdgeChip
                active={decoratedEdgeValue}
                onChange={(v) => onPatch({ markerDecoratedEdge: v })}
                idPrefix="ctx-stroke"
              />
            ) : null}
          </SelectionContextBarGroup>
          <SelectionContextBarDivider />
        </>
      )}

      <SelectionContextBarGroup aria-label="Stroke width">
        <SelectionContextSizeStepper
          valueStep={thicknessStep}
          options={thicknessOptions}
          onChange={(step) => {
            const widthScale =
              toolMix === 'marker'
                ? markerThicknessStepToWidthScale(step)
                : thicknessStepToWidthScale(step)
            onPatch({ widthScale })
          }}
          showInkPreview
          ariaLabel={thicknessAriaLabel}
          idPrefix="ctx-stroke"
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
        duplicateLabel="Duplicate selected strokes"
        deleteLabel="Delete selected strokes"
        actionsAriaLabel="Stroke actions"
        arrangeIdPrefix="ctx-stroke-arrange"
        actionsPrefix={
          onToggleGroup && groupToggleLabel ? (
            <button
              type="button"
              className={SELECTION_CONTEXT_BAR_ACTION_BTN}
              aria-label={groupToggleLabel === 'ungroup' ? 'Ungroup strokes' : 'Group strokes'}
              title={groupToggleLabel === 'ungroup' ? 'Ungroup' : 'Group'}
              onClick={onToggleGroup}
            >
              {groupToggleLabel === 'ungroup' ? (
                <Ungroup className="h-4 w-4" strokeWidth={2} aria-hidden />
              ) : (
                <Group className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
            </button>
          ) : null
        }
      />
    </SelectionContextBar>
  )
}
