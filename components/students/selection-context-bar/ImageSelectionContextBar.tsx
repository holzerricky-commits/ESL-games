'use client'

import { useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Layers, Lock, Square } from 'lucide-react'
import { getPenSwatch } from '@/lib/books/annotation-palettes'
import { penSwatchIdToStrokeColor, shapeStrokeColorToSwatchId } from '@/lib/books/selection-context-color'
import { ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS } from '@/lib/books/annotation-storage'
import { inkThicknessPxOptions } from '@/lib/books/ink-thickness-pixel'
import type { ImageAnnotationCommand } from '@/lib/books/annotation-command-types'
import type { NormRect } from '@/lib/books/annotation-select'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import type { SelectionBarPlacement } from '@/lib/books/selection-context-anchor'
import type { ImageSelectionPatch } from '@/lib/books/patch-selected-commands'
import {
  commonImageLocked,
  commonImageStrokeColor,
  commonImageStrokeVisible,
  commonImageWidthScale,
} from '@/lib/books/selection-context'
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
import { SelectionContextActionMenu } from '@/components/students/selection-context-bar/SelectionContextIconMenu'
import {
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  SELECTION_CONTEXT_BAR_ACTION_BTN_ACTIVE,
  SELECTION_CONTEXT_ICON_CLASS,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'

const IMAGE_THICKNESS_OPTIONS = inkThicknessPxOptions(ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS)

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

export function ImageSelectionContextBar({
  imageCommands,
  anchorRect,
  placement,
  positionKey,
  onPatch,
  onMoveForward,
  onMoveBackward,
  onDelete,
  onDuplicate,
  showObjectArrange,
  onArrange,
  showObjectDistribute,
  onDistributeVertical,
  visible = true,
}: {
  imageCommands: readonly ImageAnnotationCommand[]
  anchorRect: NormRect
  placement: SelectionBarPlacement
  positionKey: string
  onPatch: (patch: ImageSelectionPatch) => void
  onMoveForward: () => void
  onMoveBackward: () => void
  onDelete: () => void
  onDuplicate: () => void
  visible?: boolean
} & SelectionContextObjectArrangeProps) {
  const activeStroke = commonImageStrokeColor(imageCommands)
  const activeWidth = commonImageWidthScale(imageCommands)
  const activeStrokeVisible = commonImageStrokeVisible(imageCommands)
  const activeLocked = commonImageLocked(imageCommands)

  const borderOn =
    activeStrokeVisible === 'mixed' || activeStrokeVisible == null
      ? imageCommands[0]?.strokeVisible === true
      : activeStrokeVisible

  const lockedOn =
    activeLocked === 'mixed' || activeLocked == null ? imageCommands[0]?.locked === true : activeLocked

  const thicknessStep: AnnotationStrokeThicknessStep =
    activeWidth === 'mixed' || activeWidth == null ? 4 : widthScaleToThicknessStep(activeWidth)

  const strokeColorValue =
    activeStroke === 'mixed' || activeStroke == null
      ? imageCommands[0]?.strokeColor ?? getPenSwatch(shapeStrokeColorToSwatchId(null)).color
      : activeStroke

  const strokeSwatchId = shapeStrokeColorToSwatchId(strokeColorValue)

  const strokePaletteExtras = useMemo(
    () => ({
      shapeStrokeSwatchId: strokeSwatchId,
      pickShapeStrokeSwatch: (id: string) => onPatch({ strokeColor: penSwatchIdToStrokeColor(id) }),
    }),
    [strokeSwatchId, onPatch],
  )

  return (
    <SelectionContextBar
      anchorRect={anchorRect}
      placement={placement}
      positionKey={positionKey}
      visible={visible}
      aria-label="Image options"
    >
      <SelectionContextBarGroup aria-label="Image border">
        <ContextToggleButton
          active={borderOn}
          label={borderOn ? 'Hide border' : 'Show border'}
          title="Border"
          onClick={() => {
            if (borderOn) {
              onPatch({ strokeVisible: false })
            } else {
              onPatch({
                strokeVisible: true,
                strokeColor: strokeColorValue,
              })
            }
          }}
        >
          <Square className="h-4 w-4" strokeWidth={2} aria-hidden />
        </ContextToggleButton>
        {borderOn ? (
          <SelectionContextColorSection
            kind="shape"
            idPrefix="ctx-image-stroke"
            activeValue={strokeSwatchId}
            paletteTarget="shapes"
            paletteExtras={strokePaletteExtras}
            onPick={(id) => onPatch({ strokeColor: penSwatchIdToStrokeColor(id) })}
          />
        ) : null}
      </SelectionContextBarGroup>

      {borderOn ? (
        <>
          <SelectionContextBarDivider />
          <SelectionContextBarGroup aria-label="Border width">
            <SelectionContextSizeStepper
              valueStep={thicknessStep}
              options={IMAGE_THICKNESS_OPTIONS}
              onChange={(step) => onPatch({ strokeWidthScale: thicknessStepToWidthScale(step) })}
              showInkPreview
              ariaLabel="Border width"
              idPrefix="ctx-image"
            />
          </SelectionContextBarGroup>
        </>
      ) : null}

      <SelectionContextBarDivider />

      <SelectionContextBarGroup aria-label="Image lock and layer">
        <ContextToggleButton
          active={lockedOn}
          label={lockedOn ? 'Unlock image' : 'Lock image'}
          title="Lock"
          onClick={() => onPatch({ locked: !lockedOn })}
        >
          <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
        </ContextToggleButton>
        <SelectionContextActionMenu
          idPrefix="ctx-image-layer"
          triggerLabel="Layer order"
          triggerIcon={<Layers className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={1.75} aria-hidden />}
          items={[
            {
              id: 'bring-forward',
              label: 'Bring forward',
              icon: <ArrowUp className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={1.75} aria-hidden />,
              onSelect: onMoveForward,
            },
            {
              id: 'send-backward',
              label: 'Send backward',
              icon: <ArrowDown className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={1.75} aria-hidden />,
              onSelect: onMoveBackward,
            },
          ]}
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
        duplicateLabel="Duplicate selected images"
        deleteLabel="Delete selected images"
        actionsAriaLabel="Image actions"
        arrangeIdPrefix="ctx-image-arrange"
      />
    </SelectionContextBar>
  )
}
