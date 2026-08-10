'use client'

import type { NormRect } from '@/lib/books/annotation-select'
import type { SelectionBarPlacement } from '@/lib/books/selection-context-anchor'
import { SelectionContextActionButtons } from '@/components/students/selection-context-bar/SelectionContextActionButtons'
import { SelectionContextArrangeButtons } from '@/components/students/selection-context-bar/SelectionContextArrangeButtons'
import { SelectionContextBar } from '@/components/students/selection-context-bar/SelectionContextBar'
import type { SelectionContextObjectArrangeProps } from '@/components/students/selection-context-bar/SelectionContextActionsWithArrange'
import { SelectionContextBarGroup } from '@/components/students/selection-context-bar/SelectionContextBarGroup'
import { SelectionContextBarDivider } from '@/components/students/selection-context-bar/SelectionContextBarDivider'

export function MixedSelectionContextBar({
  anchorRect,
  placement,
  positionKey,
  onDelete,
  onDuplicate,
  showObjectArrange,
  onArrange,
  showObjectDistribute,
  onDistributeVertical,
  visible = true,
}: {
  anchorRect: NormRect
  placement: SelectionBarPlacement
  positionKey: string
  onDelete: () => void
  onDuplicate: () => void
  visible?: boolean
} & SelectionContextObjectArrangeProps) {
  const arrangeVisible = showObjectArrange && onArrange != null

  return (
    <SelectionContextBar
      anchorRect={anchorRect}
      placement={placement}
      positionKey={positionKey}
      visible={visible}
      aria-label="Mixed selection options"
    >
      {arrangeVisible ? (
        <>
          <SelectionContextBarGroup aria-label="Arrange objects">
            <SelectionContextArrangeButtons
              onArrange={onArrange}
              showDistributeVertical={showObjectDistribute}
              onDistributeVertical={onDistributeVertical}
              idPrefix="ctx-mixed-arrange"
            />
          </SelectionContextBarGroup>
          <SelectionContextBarDivider />
        </>
      ) : null}
      <SelectionContextBarGroup variant="actions" aria-label="Selection actions">
        <SelectionContextActionButtons
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          duplicateLabel="Duplicate selected items"
          deleteLabel="Delete selected items"
        />
      </SelectionContextBarGroup>
    </SelectionContextBar>
  )
}
