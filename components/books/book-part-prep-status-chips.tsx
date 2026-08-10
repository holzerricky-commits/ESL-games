'use client'

import { Check, ListChecks, ScrollText, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BookPartPrepChipState = 'ready' | 'todo' | 'soon'

interface BookPartPrepStatusChipsProps {
  textState: BookPartPrepChipState
  checksState: BookPartPrepChipState
  onTextClick: () => void
  onChecksClick: () => void
  className?: string
}

function PrepVisualBadge({
  label,
  state,
  icon: Icon,
  onClick,
}: {
  label: string
  state: BookPartPrepChipState
  icon: LucideIcon
  onClick: () => void
}) {
  const ready = state === 'ready'
  const soon = state === 'soon'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        ready
          ? `${label} ready`
          : soon
            ? `${label} coming soon`
            : `${label} not ready yet`
      }
      className={cn(
        'group flex w-[76px] flex-col items-center gap-2 rounded-2xl p-1 text-center transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-2)]',
        'active:scale-[0.96]',
      )}
    >
      <span className="relative inline-flex">
        <span
          className={cn(
            'flex h-[58px] w-[58px] items-center justify-center rounded-[16px] transition',
            'shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)]',
            ready
              ? 'bg-[linear-gradient(160deg,color-mix(in_srgb,var(--brand-blue)_72%,white),var(--brand-blue))] text-white group-hover:brightness-[1.04]'
              : soon
                ? 'bg-[linear-gradient(160deg,var(--surface-3),color-mix(in_srgb,var(--surface-3)_70%,var(--surface-4)))] text-muted-foreground/55'
                : 'bg-[linear-gradient(160deg,var(--surface-3),color-mix(in_srgb,var(--surface-4)_80%,var(--surface-3)))] text-foreground/55 group-hover:text-foreground/75',
          )}
        >
          <Icon
            className={cn('h-7 w-7', ready ? 'stroke-[1.75]' : 'stroke-[1.5]')}
            aria-hidden
          />
        </span>
        {ready ? (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]"
            aria-hidden
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand-blue)] text-white">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </span>
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'text-[12px] font-medium tracking-tight',
          ready ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </button>
  )
}

/**
 * Visual prep badges (icon tiles) for the part shell header.
 * Ready = blue illustrated tile + check; open = soft gray; soon = muted.
 */
export function BookPartPrepStatusChips({
  textState,
  checksState,
  onTextClick,
  onChecksClick,
  className,
}: BookPartPrepStatusChipsProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-center gap-3 lg:justify-start', className)}>
      <PrepVisualBadge label="Text" state={textState} icon={ScrollText} onClick={onTextClick} />
      <PrepVisualBadge label="Checks" state={checksState} icon={ListChecks} onClick={onChecksClick} />
    </div>
  )
}
