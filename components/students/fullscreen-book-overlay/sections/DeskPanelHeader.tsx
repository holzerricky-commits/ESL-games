'use client'

import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface DeskPanelHeaderProps {
  title: string
  subtitle?: string | null
  onBack: () => void
  backLabel: string
  /** Right side slot (status chip, overflow menu). */
  trailing?: ReactNode
}

/** Header for desk rail screens: back arrow, title, optional trailing slot. */
export function DeskPanelHeader({ title, subtitle, onBack, backLabel, trailing = null }: DeskPanelHeaderProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onBack}
        aria-label={backLabel}
        title={backLabel}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="truncate text-[12px] text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing}
    </div>
  )
}
