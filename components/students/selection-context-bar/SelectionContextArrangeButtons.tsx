'use client'

import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalSpaceBetween,
} from 'lucide-react'
import type { HorizontalAlignAxis } from '@/lib/books/annotation-align'
import { SELECTION_CONTEXT_ICON_CLASS } from '@/components/students/selection-context-bar/selection-context-bar-styles'
import { SelectionContextActionMenu } from '@/components/students/selection-context-bar/SelectionContextIconMenu'

const iconCls = SELECTION_CONTEXT_ICON_CLASS

const OBJECT_ARRANGE_OPTIONS: {
  id: HorizontalAlignAxis
  label: string
  Icon: typeof AlignHorizontalJustifyStart
}[] = [
  {
    id: 'left',
    label: 'Arrange left edges',
    Icon: AlignHorizontalJustifyStart,
  },
  {
    id: 'center',
    label: 'Arrange centers',
    Icon: AlignHorizontalJustifyCenter,
  },
  {
    id: 'right',
    label: 'Arrange right edges',
    Icon: AlignHorizontalJustifyEnd,
  },
]

export function SelectionContextArrangeButtons({
  onArrange,
  showDistributeVertical = false,
  onDistributeVertical,
  idPrefix = 'ctx-arrange',
}: {
  onArrange: (axis: HorizontalAlignAxis) => void
  showDistributeVertical?: boolean
  onDistributeVertical?: () => void
  idPrefix?: string
}) {
  const distributeVisible = showDistributeVertical && onDistributeVertical != null

  const items = [
    ...OBJECT_ARRANGE_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
      icon: <option.Icon className={iconCls} strokeWidth={1.75} aria-hidden />,
      onSelect: () => onArrange(option.id),
    })),
    ...(distributeVisible
      ? [
          {
            id: 'distribute-vertical',
            label: 'Distribute vertical spacing',
            icon: <AlignVerticalSpaceBetween className={iconCls} strokeWidth={1.75} aria-hidden />,
            onSelect: () => onDistributeVertical(),
          },
        ]
      : []),
  ]

  return (
    <SelectionContextActionMenu
      idPrefix={idPrefix}
      triggerLabel="Arrange objects"
      triggerIcon={
        <AlignHorizontalJustifyCenter className={iconCls} strokeWidth={1.75} aria-hidden />
      }
      items={items}
    />
  )
}
