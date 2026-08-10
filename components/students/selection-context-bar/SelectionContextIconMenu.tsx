'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  SELECTION_CONTEXT_CHIP_TRIGGER,
  SELECTION_CONTEXT_POPOVER_CONTENT_CLASS,
  SELECTION_CONTEXT_POPOVER_SECTION_LABEL,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'
import { cn } from '@/lib/utils'

const MENU_ITEM =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white/75 transition-colors hover:bg-white/10'

const ICON_ROW_BTN =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55'

const ICON_ROW_BTN_SELECTED = 'bg-white/20 ring-1 ring-amber-400/45'

const TRIGGER_BTN =
  'inline-flex h-7 shrink-0 items-center justify-center gap-0.5 rounded-lg px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55'

const CHEVRON_CLASS = 'h-3 w-3 shrink-0 text-white/45'

type PopoverLayout = 'list' | 'icons'

function ContextMenuPopover({
  open,
  onOpenChange,
  triggerId,
  triggerLabel,
  triggerTitle,
  triggerIcon,
  menuAriaLabel,
  popoverLayout,
  menuTitle,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerId: string
  triggerLabel: string
  triggerTitle?: string
  triggerIcon: ReactNode
  menuAriaLabel: string
  popoverLayout: PopoverLayout
  menuTitle?: string
  children: ReactNode
}) {
  const iconRow = popoverLayout === 'icons'

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={triggerId}
          className={cn(TRIGGER_BTN, SELECTION_CONTEXT_CHIP_TRIGGER)}
          aria-label={triggerLabel}
          title={triggerTitle ?? triggerLabel}
        >
          {triggerIcon}
          <ChevronDown className={CHEVRON_CLASS} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={10}
        collisionPadding={12}
        className={cn(
          SELECTION_CONTEXT_POPOVER_CONTENT_CLASS,
          iconRow ? 'w-auto p-1' : 'w-[min(14rem,calc(100vw-2rem))] p-1',
        )}
      >
        {menuTitle && !iconRow ? (
          <p className={cn(SELECTION_CONTEXT_POPOVER_SECTION_LABEL, 'px-2 pb-1')}>{menuTitle}</p>
        ) : null}
        <div
          className={cn(iconRow ? 'flex items-center gap-0.5' : 'space-y-0.5')}
          role="menu"
          aria-label={menuAriaLabel}
        >
          {children}
        </div>
      </PopoverContent>
    </Popover>
  )
}

type IconMenuOption<T extends string> = {
  id: T
  label: string
  icon: ReactNode
}

export function SelectionContextValueMenu<T extends string>({
  value,
  onChange,
  options,
  idPrefix,
  ariaLabel,
  menuTitle,
  popoverLayout = 'icons',
}: {
  value: T
  onChange: (next: T) => void
  options: readonly IconMenuOption<T>[]
  idPrefix: string
  ariaLabel: string
  menuTitle?: string
  popoverLayout?: PopoverLayout
}) {
  const [open, setOpen] = useState(false)

  const active = useMemo(
    () => options.find((option) => option.id === value) ?? options[0]!,
    [options, value],
  )

  const iconRow = popoverLayout === 'icons'

  return (
    <ContextMenuPopover
      open={open}
      onOpenChange={setOpen}
      triggerId={`${idPrefix}-value-menu-trigger`}
      triggerLabel={`${ariaLabel}: ${active.label}. Click to choose another.`}
      triggerTitle={active.label}
      triggerIcon={active.icon}
      menuAriaLabel={ariaLabel}
      popoverLayout={popoverLayout}
      menuTitle={menuTitle}
    >
      {options.map((option) => {
        const selected = option.id === value
        if (iconRow) {
          return (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              aria-label={option.label}
              title={option.label}
              className={cn(ICON_ROW_BTN, selected && ICON_ROW_BTN_SELECTED)}
              onClick={() => {
                onChange(option.id)
                setOpen(false)
              }}
            >
              {option.icon}
            </button>
          )
        }
        return (
          <button
            key={option.id}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className={cn(MENU_ITEM, selected && 'bg-white/15 font-semibold text-white')}
            onClick={() => {
              onChange(option.id)
              setOpen(false)
            }}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
              {option.icon}
            </span>
            <span>{option.label}</span>
          </button>
        )
      })}
    </ContextMenuPopover>
  )
}

export function SelectionContextActionMenu({
  triggerIcon,
  triggerLabel,
  items,
  idPrefix,
  menuTitle,
  popoverLayout = 'icons',
}: {
  triggerIcon: ReactNode
  triggerLabel: string
  items: readonly {
    id: string
    label: string
    icon: ReactNode
    onSelect: () => void
  }[]
  idPrefix: string
  menuTitle?: string
  popoverLayout?: PopoverLayout
}) {
  const [open, setOpen] = useState(false)

  const iconRow = popoverLayout === 'icons'

  return (
    <ContextMenuPopover
      open={open}
      onOpenChange={setOpen}
      triggerId={`${idPrefix}-action-menu-trigger`}
      triggerLabel={`${triggerLabel}. Click to choose an action.`}
      triggerTitle={triggerLabel}
      triggerIcon={triggerIcon}
      menuAriaLabel={triggerLabel}
      popoverLayout={popoverLayout}
      menuTitle={menuTitle}
    >
      {items.map((item) => {
        if (iconRow) {
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              aria-label={item.label}
              title={item.label}
              className={ICON_ROW_BTN}
              onClick={() => {
                item.onSelect()
                setOpen(false)
              }}
            >
              {item.icon}
            </button>
          )
        }
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={MENU_ITEM}
            onClick={() => {
              item.onSelect()
              setOpen(false)
            }}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </ContextMenuPopover>
  )
}
