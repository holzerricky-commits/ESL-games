'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  SELECTION_CONTEXT_BAR_ACTIONS_GROUP,
  SELECTION_CONTEXT_BAR_GROUP,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'

export function SelectionContextBarGroup({
  className,
  children,
  variant = 'default',
  'aria-label': ariaLabel,
}: {
  className?: string
  children: ReactNode
  variant?: 'default' | 'actions'
  'aria-label'?: string
}) {
  return (
    <div
      className={cn(
        variant === 'actions' ? SELECTION_CONTEXT_BAR_ACTIONS_GROUP : SELECTION_CONTEXT_BAR_GROUP,
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )
}
