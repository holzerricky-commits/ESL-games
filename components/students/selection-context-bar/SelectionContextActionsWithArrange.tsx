'use client'

import type { ReactNode } from 'react'
import type { HorizontalAlignAxis } from '@/lib/books/annotation-align'
import { SelectionContextActionButtons } from '@/components/students/selection-context-bar/SelectionContextActionButtons'
import { SelectionContextArrangeButtons } from '@/components/students/selection-context-bar/SelectionContextArrangeButtons'
import { SelectionContextBarDivider } from '@/components/students/selection-context-bar/SelectionContextBarDivider'
import { SelectionContextBarGroup } from '@/components/students/selection-context-bar/SelectionContextBarGroup'

export type SelectionContextObjectArrangeProps = {
  showObjectArrange: boolean
  onArrange?: (axis: HorizontalAlignAxis) => void
  showObjectDistribute?: boolean
  onDistributeVertical?: () => void
  visible?: boolean
}

/** Place after a leading divider (except on mixed-only bars). Inserts arrange group when 2+ selected. */
export function SelectionContextActionsWithArrange({
  showObjectArrange,
  onArrange,
  showObjectDistribute = false,
  onDistributeVertical,
  onDuplicate,
  onDelete,
  duplicateLabel,
  deleteLabel,
  actionsAriaLabel,
  actionsPrefix,
  arrangeIdPrefix,
}: {
  showObjectArrange: boolean
  onArrange?: (axis: HorizontalAlignAxis) => void
  showObjectDistribute?: boolean
  onDistributeVertical?: () => void
  onDuplicate: () => void
  onDelete: () => void
  duplicateLabel: string
  deleteLabel: string
  actionsAriaLabel: string
  actionsPrefix?: ReactNode
  arrangeIdPrefix?: string
}) {
  const arrangeVisible = showObjectArrange && onArrange != null

  return (
    <>
      {arrangeVisible ? (
        <>
          <SelectionContextBarGroup aria-label="Arrange objects">
            <SelectionContextArrangeButtons
              onArrange={onArrange}
              showDistributeVertical={showObjectDistribute}
              onDistributeVertical={onDistributeVertical}
              idPrefix={arrangeIdPrefix}
            />
          </SelectionContextBarGroup>
          <SelectionContextBarDivider />
        </>
      ) : null}
      <SelectionContextBarGroup variant="actions" aria-label={actionsAriaLabel}>
        {actionsPrefix}
        <SelectionContextActionButtons
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          duplicateLabel={duplicateLabel}
          deleteLabel={deleteLabel}
        />
      </SelectionContextBarGroup>
    </>
  )
}
