'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { PopoverAnchor } from '@/components/ui/popover'
import { ANNOTATION_CHROME_SECTION_LABEL } from '@/components/students/annotation-chrome-styles'
import { cn } from '@/lib/utils'

export const toolSettingsStackClass = 'min-w-0 space-y-3'

/** Shared PopoverContent props for rail tool settings (vertical middle of viewport). */
export const railPopoverContentProps = {
  side: 'left' as const,
  align: 'center' as const,
  sideOffset: 8,
}

/**
 * Stay open for in-panel picks, nested menus (e.g. font list), and the tool rail itself.
 * True click-away (book / canvas) is handled by `onDismissAway`.
 */
function shouldBlockRailToolSettingsOutsideDismiss(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  return Boolean(
    target.closest('[data-annotation-tool-settings-nested]') ||
      // Nested menus / other portaled menus (font list, etc.)
      target.closest('[data-slot="popover-content"]') ||
      target.closest('.floating-side-toolbar') ||
      target.closest('.annotation-rail-slide-panel') ||
      target.closest('.annotation-rail-handle'),
  )
}

/**
 * Rail tool settings panel props.
 * Radix never auto-closes; only `onDismissAway` (click the book) or explicit close closes it.
 */
export function createRailToolSettingsPopoverContentProps(onDismissAway?: () => void) {
  return {
    ...railPopoverContentProps,
    'data-annotation-tool-settings-popover': '' as const,
    onPointerDownOutside: (e: Event) => {
      e.preventDefault()
      if (!shouldBlockRailToolSettingsOutsideDismiss(e.target)) {
        onDismissAway?.()
      }
    },
    onFocusOutside: (e: Event) => {
      e.preventDefault()
    },
    onInteractOutside: (e: Event) => {
      e.preventDefault()
    },
  }
}

/** @deprecated Prefer createRailToolSettingsPopoverContentProps(onDismissAway). */
export const railToolSettingsPopoverContentProps = createRailToolSettingsPopoverContentProps()

export function toolSettingsPopoverContentProps(
  isRailMode: boolean,
  layout: 'horizontal' | 'vertical',
  onDismissAway?: () => void,
) {
  if (isRailMode) return createRailToolSettingsPopoverContentProps(onDismissAway)
  return {
    side: layout === 'vertical' ? ('left' as const) : ('top' as const),
    align: 'center' as const,
  }
}

/**
 * Zero-size fixed anchor at viewport vertical center, just left of the rail.
 * Decouples panel position from which tool button was clicked.
 */
export function RailSettingsPopoverAnchor() {
  return (
    <PopoverAnchor asChild>
      <span
        aria-hidden
        className="pointer-events-none fixed top-1/2 right-14 z-0 size-0 -translate-y-1/2"
      />
    </PopoverAnchor>
  )
}

export function ToolSettingsSection({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <p className={ANNOTATION_CHROME_SECTION_LABEL}>{label}</p>
      {children}
    </div>
  )
}

/** Live tool preview — sits on the popover surface; spacing matches a framed well without chrome. */
export function ToolSettingsPreviewBox({
  label = 'Preview',
  ariaLabel,
  children,
  className,
}: {
  label?: string
  ariaLabel?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <p className={ANNOTATION_CHROME_SECTION_LABEL}>{label}</p>
      <div
        className="min-h-[4.5rem] overflow-hidden p-2"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  )
}

export function ToolSettingsAdvancedSection({
  children,
  hint,
}: {
  children?: ReactNode
  hint?: ReactNode
}) {
  return (
    <Collapsible defaultOpen={false} className="mt-1 border-t border-[#3f3f46] pt-2">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-left text-xs font-medium text-[#a1a1aa] transition-colors hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]">
        <span>More options</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2.5 pt-2">
        {children}
        {hint ? <p className="text-[11px] leading-snug text-[#71717a]">{hint}</p> : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ToolSettingsCheckboxRow({
  id,
  checked,
  onCheckedChange,
  label,
  description,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description: string
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-lg px-0.5 py-0.5 transition-colors hover:bg-[#353539]/60"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className={cn(
          'mt-0.5 border-[#52525b] bg-transparent shadow-none',
          'data-[state=checked]:border-[#52525b] data-[state=checked]:bg-[#52525b] data-[state=checked]:text-[#f4f4f5]',
          'focus-visible:ring-[#71717a]/40',
        )}
      />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-xs font-medium leading-snug text-[#f4f4f5]">{label}</span>
        <span className="block text-[11px] leading-snug text-[#71717a]">{description}</span>
      </span>
    </label>
  )
}
