'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shared stroke icons for the annotation toolbar (Lucide). */
export const TOOLBAR_ICON_CLASS = 'h-[18px] w-[18px] shrink-0 text-[#f0ebe3]'

export function ToolbarIcon({
  icon: Icon,
  colorDot,
  className,
  iconClassName,
}: {
  icon: LucideIcon
  /** When set, shows a small swatch dot at the bottom-right. */
  colorDot?: string
  className?: string
  iconClassName?: string
}) {
  return (
    <span
      className={cn('relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center', className)}
    >
      <Icon className={cn(TOOLBAR_ICON_CLASS, iconClassName)} strokeWidth={1.75} aria-hidden />
      {colorDot ? (
        <span
          className="pointer-events-none absolute -bottom-px -right-px h-2 w-2 rounded-full shadow-sm"
          style={{ backgroundColor: colorDot }}
          aria-hidden
        />
      ) : null}
    </span>
  )
}
