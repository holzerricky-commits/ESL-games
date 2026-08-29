'use client'

import { Bold, Type } from 'lucide-react'
import { PopoverIconSegmentRow } from '@/components/students/annotation-popover-controls'
import { TOOLBAR_ICON_CLASS } from '@/components/students/annotation-toolbar-icon'
import type { AnnotationTextFontWeight } from '@/lib/books/annotation-text-fonts'

export function TextFontWeightPicker({
  value,
  onChange,
  idPrefix,
  surface = 'default',
}: {
  value: AnnotationTextFontWeight
  onChange: (weight: AnnotationTextFontWeight) => void
  idPrefix: string
  surface?: 'rail' | 'default'
}) {
  const iconCls = TOOLBAR_ICON_CLASS
  return (
    <PopoverIconSegmentRow
      label="Weight"
      labelHidden={surface === 'rail'}
      surface={surface}
      value={value}
      onChange={(next) => {
        if (next === 'regular' || next === 'bold') onChange(next)
      }}
      idPrefix={`${idPrefix}-text-weight`}
      options={[
        {
          value: 'regular',
          ariaLabel: 'Regular',
          icon: <Type className={iconCls} strokeWidth={1.75} aria-hidden />,
        },
        {
          value: 'bold',
          ariaLabel: 'Bold',
          icon: <Bold className={iconCls} strokeWidth={1.75} aria-hidden />,
        },
      ]}
    />
  )
}
