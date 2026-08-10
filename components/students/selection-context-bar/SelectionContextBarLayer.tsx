'use client'

import { useMemo } from 'react'
import type {
  AnnotationCommand,
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { resolveSelectionContext } from '@/lib/books/selection-context'
import type { ShapeSelectionPatch, InkStrokeSelectionPatch, ImageSelectionPatch } from '@/lib/books/patch-selected-commands'
import { MixedSelectionContextBar } from '@/components/students/selection-context-bar/MixedSelectionContextBar'
import { StickySelectionContextBar } from '@/components/students/selection-context-bar/StickySelectionContextBar'
import { ShapeSelectionContextBar } from '@/components/students/selection-context-bar/ShapeSelectionContextBar'
import { ImageSelectionContextBar } from '@/components/students/selection-context-bar/ImageSelectionContextBar'
import { StrokeSelectionContextBar } from '@/components/students/selection-context-bar/StrokeSelectionContextBar'
import { TextSelectionContextBar } from '@/components/students/selection-context-bar/TextSelectionContextBar'

export type SelectionContextBarLayerProps = {
  commands: readonly AnnotationCommand[]
  selectedIds: readonly string[]
  widthPx: number
  heightPx: number
  editingId?: string | null
  deadIndices?: ReadonlySet<number>
  /** Select tool active */
  selectEnabled?: boolean
  /** Text tool active — may show bar for selected labels without select mode */
  textToolActive?: boolean
  /** Sticky / writable sticker tool active */
  stickyToolActive?: boolean
  onPatchSelectedText?: (partial: Partial<TextAnnotationCommand>) => void
  onPatchSelectedSticky?: (partial: Partial<StickyAnnotationCommand>) => void
  onPatchSelectedShape?: (patch: ShapeSelectionPatch) => void
  onPatchSelectedImage?: (patch: ImageSelectionPatch) => void
  onPatchSelectedStroke?: (patch: InkStrokeSelectionPatch) => void
  onMoveSelectedForward?: () => void
  onMoveSelectedBackward?: () => void
  onToggleGroupSelected?: () => void
  strokeGroupToggleLabel?: 'group' | 'ungroup'
  onDeleteSelected?: () => void
  onDuplicateSelected?: () => void
  onArrangeSelected?: (axis: import('@/lib/books/annotation-align').HorizontalAlignAxis) => void
  onDistributeVerticalSelected?: () => void
  /** Hide while the user is dragging the selection (bar reappears on release). */
  hidden?: boolean
}

export function SelectionContextBarLayer({
  commands,
  selectedIds,
  widthPx,
  heightPx,
  editingId,
  deadIndices,
  selectEnabled = false,
  textToolActive = false,
  stickyToolActive = false,
  onPatchSelectedText,
  onPatchSelectedSticky,
  onPatchSelectedShape,
  onPatchSelectedImage,
  onPatchSelectedStroke,
  onMoveSelectedForward,
  onMoveSelectedBackward,
  onToggleGroupSelected,
  strokeGroupToggleLabel,
  onDeleteSelected,
  onDuplicateSelected,
  onArrangeSelected,
  onDistributeVerticalSelected,
  hidden = false,
}: SelectionContextBarLayerProps) {
  const context = useMemo(
    () =>
      resolveSelectionContext({
        commands,
        selectedIds,
        widthPx,
        heightPx,
        editingId,
        deadIndices,
      }),
    [commands, selectedIds, widthPx, heightPx, editingId, deadIndices],
  )

  const barEnabled = selectEnabled || textToolActive || stickyToolActive
  if (!barEnabled || !context?.visible) return null
  if (!onDeleteSelected || !onDuplicateSelected) return null

  const barVisible = !hidden
  const showObjectArrange = selectedIds.length >= 2 && onArrangeSelected != null
  const positionKey = [...context.commandIds].sort().join('\0')
  const sharedBarProps = {
    positionKey,
    showObjectArrange,
    onArrange: onArrangeSelected,
    showObjectDistribute: selectedIds.length >= 3 && onDistributeVerticalSelected != null,
    onDistributeVertical: onDistributeVerticalSelected,
    visible: barVisible,
  }

  if (context.kind === 'text' && onPatchSelectedText && context.textCommands.length > 0) {
    return (
      <TextSelectionContextBar
        textCommands={context.textCommands}
        anchorRect={context.anchorRect}
        placement={context.placement}
        heightPx={heightPx}
        onPatch={onPatchSelectedText}
        onDelete={onDeleteSelected}
        onDuplicate={onDuplicateSelected}
        {...sharedBarProps}
      />
    )
  }

  if (context.kind === 'sticky' && onPatchSelectedSticky && context.stickyCommands.length > 0) {
    return (
      <StickySelectionContextBar
        stickyCommands={context.stickyCommands}
        anchorRect={context.anchorRect}
        placement={context.placement}
        heightPx={heightPx}
        onPatch={onPatchSelectedSticky}
        onDelete={onDeleteSelected}
        onDuplicate={onDuplicateSelected}
        {...sharedBarProps}
      />
    )
  }

  if (context.kind === 'shape' && onPatchSelectedShape && context.shapeCommands.length > 0) {
    return (
      <ShapeSelectionContextBar
        shapeCommands={context.shapeCommands}
        anchorRect={context.anchorRect}
        placement={context.placement}
        onPatch={onPatchSelectedShape}
        onDelete={onDeleteSelected}
        onDuplicate={onDuplicateSelected}
        {...sharedBarProps}
      />
    )
  }

  if (
    context.kind === 'image' &&
    onPatchSelectedImage &&
    onMoveSelectedForward &&
    onMoveSelectedBackward &&
    context.imageCommands.length > 0
  ) {
    return (
      <ImageSelectionContextBar
        imageCommands={context.imageCommands}
        anchorRect={context.anchorRect}
        placement={context.placement}
        onPatch={onPatchSelectedImage}
        onMoveForward={onMoveSelectedForward}
        onMoveBackward={onMoveSelectedBackward}
        onDelete={onDeleteSelected}
        onDuplicate={onDuplicateSelected}
        {...sharedBarProps}
      />
    )
  }

  if (context.kind === 'stroke' && onPatchSelectedStroke && context.strokeCommands.length > 0) {
    return (
      <StrokeSelectionContextBar
        strokeCommands={context.strokeCommands}
        anchorRect={context.anchorRect}
        placement={context.placement}
        groupToggleLabel={strokeGroupToggleLabel}
        onPatch={onPatchSelectedStroke}
        onDelete={onDeleteSelected}
        onDuplicate={onDuplicateSelected}
        onToggleGroup={onToggleGroupSelected}
        {...sharedBarProps}
      />
    )
  }

  if (context.kind === 'mixed') {
    return (
      <MixedSelectionContextBar
        anchorRect={context.anchorRect}
        placement={context.placement}
        onDelete={onDeleteSelected}
        onDuplicate={onDuplicateSelected}
        {...sharedBarProps}
      />
    )
  }

  return null
}
