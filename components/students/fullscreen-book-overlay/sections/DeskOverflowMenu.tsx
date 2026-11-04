'use client'

import type { LucideIcon } from 'lucide-react'
import { MoreHorizontal } from 'lucide-react'
import { BOOK_CLASS_CHROME_THEME_VARS } from '@/components/students/fullscreen-book-overlay/constants'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface DeskOverflowMenuItem {
  id: string
  label: string
  icon?: LucideIcon
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
}

export interface DeskOverflowMenuProps {
  label: string
  items: readonly DeskOverflowMenuItem[]
}

/** "⋯" menu for less common desk actions. Portals above the fullscreen desk (z-80). */
export function DeskOverflowMenu({ label, items }: DeskOverflowMenuProps) {
  if (items.length === 0) return null
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={label}
          title={label}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="dark z-[200] min-w-[11rem] border-[var(--border)] text-foreground"
        style={BOOK_CLASS_CHROME_THEME_VARS}
      >
        {items.map(({ id, label: itemLabel, icon: Icon, onSelect, disabled, destructive }) => (
          <DropdownMenuItem
            key={id}
            disabled={disabled}
            variant={destructive ? 'destructive' : 'default'}
            className="gap-2 text-[13px]"
            onSelect={onSelect}
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
            {itemLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
