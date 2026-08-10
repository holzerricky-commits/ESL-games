'use client'

import { useMemo, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { getPenSwatch } from '@/lib/books/annotation-palettes'
import { penSwatchIdToStrokeColor, shapeStrokeColorToSwatchId } from '@/lib/books/selection-context-color'
import { ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS } from '@/lib/books/annotation-storage'
import { inkThicknessPxOptions } from '@/lib/books/ink-thickness-pixel'
import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import type { NormRect } from '@/lib/books/annotation-select'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import type { SelectionBarPlacement } from '@/lib/books/selection-context-anchor'
import type { ShapeSelectionPatch } from '@/lib/books/patch-selected-commands'
import {
  anySelectedFilledShapes,
  commonShapeFillColor,
  commonShapeFillMode,
  commonShapeLineDashStyle,
  commonShapeLocked,
  commonShapeStrokeColor,
  commonShapeStrokeEnabled,
  commonShapeWidthScale,
} from '@/lib/books/selection-context'
import type { ShapeSelectionCommand } from '@/lib/books/shape-selection'
import {
  thicknessStepToWidthScale,
  widthScaleToThicknessStep,
} from '@/lib/books/shape-stroke-width-steps'
import { cn } from '@/lib/utils'
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
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'
import {
  TopStripFillModeChip,
  TopStripLineStyleChip,
  TopStripShapeLineStyleChip,
} from '@/components/students/annotation-top-strip-controls'

const SHAPE_THICKNESS_OPTIONS = inkThicknessPxOptions(ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS)

function ContextToggleButton({
  active,
  label,
  title,
  onClick,
  children,
}: {
  active: boolean
  label: string
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        SELECTION_CONTEXT_BAR_ACTION_BTN,
        active && SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
      )}
      aria-label={label}
      aria-pressed={active}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function ShapeSelectionContextBar({
  shapeCommands,
  anchorRect,
  placement,
  positionKey,
  onPatch,
  onDelete,
  onDuplicate,
  showObjectArrange,
  onArrange,
  showObjectDistribute,
  onDistributeVertical,
  visible = true,
}: {
  shapeCommands: readonly ShapeSelectionCommand[]
  anchorRect: NormRect
  placement: SelectionBarPlacement
  positionKey: string
  onPatch: (patch: ShapeSelectionPatch) => void
  onDelete: () => void
  onDuplicate: () => void
  visible?: boolean
} & SelectionContextObjectArrangeProps) {
  const activeStroke = commonShapeStrokeColor(shapeCommands)
  const activeDash = commonShapeLineDashStyle(shapeCommands)
  const activeWidth = commonShapeWidthScale(shapeCommands)
  const showFillControls = anySelectedFilledShapes(shapeCommands)
  const activeFillMode = commonShapeFillMode(shapeCommands)
  const activeFillColor = commonShapeFillColor(shapeCommands)
  const activeStrokeEnabled = commonShapeStrokeEnabled(shapeCommands)
  const activeLocked = commonShapeLocked(shapeCommands)

  const dashValue: AnnotationLineDashStyle =
    activeDash === 'mixed' || activeDash == null ? 'solid' : activeDash

  const fillModeValue: ShapeFillMode =
    activeFillMode === 'mixed' || activeFillMode == null ? 'none' : activeFillMode

  const strokeEnabledValue =
    activeStrokeEnabled === 'mixed' || activeStrokeEnabled == null ? true : activeStrokeEnabled

  const lockedOn =
    activeLocked === 'mixed' || activeLocked == null ? shapeCommands[0]?.locked === true : activeLocked

  const thicknessStep: AnnotationStrokeThicknessStep =
    activeWidth === 'mixed' || activeWidth == null ? 4 : widthScaleToThicknessStep(activeWidth)

  const strokeColorValue =
    activeStroke === 'mixed' || activeStroke == null
      ? shapeCommands[0]?.strokeColor ?? getPenSwatch(shapeStrokeColorToSwatchId(null)).color
      : activeStroke

  const fillColorValue =
    activeFillColor === 'mixed' || activeFillColor == null
      ? shapeCommands[0]?.fillColor ?? '#ffff00'
      : activeFillColor

  const strokeSwatchId = shapeStrokeColorToSwatchId(strokeColorValue)

  const strokePaletteExtras = useMemo(
    () => ({
      shapeStrokeSwatchId: strokeSwatchId,
      pickShapeStrokeSwatch: (id: string) => onPatch({ strokeColor: penSwatchIdToStrokeColor(id) }),
      shapeFillColor: fillColorValue,
      shapeFillMode: fillModeValue,
    }),
    [strokeSwatchId, fillColorValue, fillModeValue, onPatch],
  )

  const fillPaletteExtras = useMemo(
    () => ({
      shapeStrokeSwatchId: strokeSwatchId,
      shapeFillColor: fillColorValue,
      pickShapeFillColor: (hex: string) => onPatch({ fillColor: hex }),
      shapeFillMode: fillModeValue,
    }),
    [strokeSwatchId, fillColorValue, fillModeValue, onPatch],
  )

  return (
    <SelectionContextBar
      anchorRect={anchorRect}
      placement={placement}
      positionKey={positionKey}
      visible={visible}
      aria-label="Shape options"
    >
      <SelectionContextBarGroup aria-label="Shape colors">
        <SelectionContextColorSection
          kind="shape"
          idPrefix="ctx-shape-stroke"
          activeValue={strokeSwatchId}
          paletteTarget="shapes"
          paletteExtras={strokePaletteExtras}
          onPick={(id) => onPatch({ strokeColor: penSwatchIdToStrokeColor(id) })}
        />
        {showFillControls ? (
          <SelectionContextColorSection
            kind="marker"
            idPrefix="ctx-shape-fill"
            activeValue={fillColorValue}
            paletteTarget="shape-fill"
            paletteExtras={fillPaletteExtras}
            onPick={(hex) => onPatch({ fillColor: hex })}
          />
        ) : null}
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Shape style">
        {showFillControls ? (
          <>
            <TopStripShapeLineStyleChip
              strokeEnabled={strokeEnabledValue}
              lineDashStyle={dashValue}
              onStrokeEnabledChange={(enabled) => onPatch({ strokeEnabled: enabled })}
              onLineDashStyleChange={(style) => onPatch({ lineDashStyle: style })}
              fillMode={fillModeValue}
              onFillModeChange={(mode) => onPatch({ fillMode: mode })}
              idPrefix="ctx-shape"
            />
            <TopStripFillModeChip
              fillMode={fillModeValue}
              onChange={(mode) => onPatch({ fillMode: mode })}
              idPrefix="ctx-shape"
            />
          </>
        ) : (
          <TopStripLineStyleChip
            value={dashValue}
            onChange={(style) => onPatch({ lineDashStyle: style })}
            idPrefix="ctx-shape"
          />
        )}
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Shape stroke width">
        <SelectionContextSizeStepper
          valueStep={thicknessStep}
          options={SHAPE_THICKNESS_OPTIONS}
          onChange={(step) => onPatch({ strokeWidthScale: thicknessStepToWidthScale(step) })}
          showInkPreview
          ariaLabel="Shape stroke width"
          idPrefix="ctx-shape"
        />
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Shape lock">
        <ContextToggleButton
          active={lockedOn}
          label={lockedOn ? 'Unlock shape' : 'Lock shape'}
          title="Lock"
          onClick={() => onPatch({ locked: !lockedOn })}
        >
          <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
        </ContextToggleButton>
      </SelectionContextBarGroup>

      <SelectionContextBarDivider />

      <SelectionContextActionsWithArrange
        showObjectArrange={showObjectArrange}
        onArrange={onArrange}
        showObjectDistribute={showObjectDistribute}
        onDistributeVertical={onDistributeVertical}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        duplicateLabel="Duplicate selected shapes"
        deleteLabel="Delete selected shapes"
        actionsAriaLabel="Shape actions"
        arrangeIdPrefix="ctx-shape-arrange"
      />
    </SelectionContextBar>
  )
}
