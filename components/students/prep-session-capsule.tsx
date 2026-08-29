'use client'

import { Check, ListChecks, Loader2, MoreHorizontal, X } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import {
  BOOK_OVERLAY_GLASS_CHROME,
  CLASS_LAUNCH_CHROME,
} from '@/components/students/fullscreen-book-overlay/constants'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type TimerTone = 'default' | 'warning' | 'over' | 'muted'

interface PrepSessionCapsulePrepProps {
  mode?: 'prep'
  /** Book overlay open — glass chrome, centered where the story badge sat. */
  bookOpen?: boolean
  /** Class = save/leave this kid. Workshop = close back to Books. */
  variant?: 'class' | 'workshop'
  checksPrepOpen: boolean
  onOpenChecksPrep: () => void
  exitBusy?: 'save' | 'leave' | null
  onSaveAndExit?: () => void
  onExitWithoutSave?: () => void
  onClose?: () => void
  className?: string
}

interface PrepSessionCapsuleLiveProps {
  mode: 'live'
  /** Always glass / centered on the book spread. */
  bookOpen?: boolean
  timerLabel: string
  timerSuffix: string
  timerTone?: TimerTone
  onEnd: () => void
  onMoveInstead: () => void
  onCancelClass: () => void
  actionsDisabled?: boolean
  cancelBusy?: boolean
  className?: string
}

export type PrepSessionCapsuleProps = PrepSessionCapsulePrepProps | PrepSessionCapsuleLiveProps

const PrepChip = forwardRef<
  HTMLButtonElement,
  {
    bookOpen: boolean
    active?: boolean
    disabled?: boolean
    title: string
    pressed?: boolean
    onClick?: () => void
    children: ReactNode
    className?: string
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(function PrepChip(
  { bookOpen, active, disabled, title, pressed, onClick, children, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium tracking-tight',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-1',
        'disabled:pointer-events-none disabled:opacity-40',
        bookOpen
          ? cn(
              'text-white/80 hover:bg-white/15 hover:text-white focus-visible:ring-white/30',
              active && 'bg-white/15 text-white',
            )
          : cn(
              'text-[#5c3d0a]/85 hover:bg-[#5c3d0a]/10 hover:text-[#5c3d0a] focus-visible:ring-[#5c3d0a]/30',
              active && 'bg-[#5c3d0a]/12 text-[#5c3d0a]',
            ),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

function liveTimerToneClass(tone: TimerTone, bookOpen: boolean): string {
  if (bookOpen) {
    if (tone === 'over') return 'bg-red-500/35 text-red-50'
    if (tone === 'warning') return 'motion-safe:animate-pulse bg-amber-500/30 text-amber-50'
    if (tone === 'muted') return 'text-white/55'
    return 'text-white/90'
  }
  if (tone === 'over') return 'bg-red-700/90 text-red-50'
  if (tone === 'warning') return 'motion-safe:animate-pulse bg-[#c47a0a]/90 text-[#fff8e8]'
  if (tone === 'muted') return 'opacity-70'
  return ''
}

function LiveOverflowMenu({
  bookOpen,
  disabled,
  cancelBusy,
  onMoveInstead,
  onCancelClass,
}: {
  bookOpen: boolean
  disabled?: boolean
  cancelBusy?: boolean
  onMoveInstead: () => void
  onCancelClass: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PrepChip bookOpen={bookOpen} title="More class actions" disabled={disabled}>
          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </PrepChip>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="min-w-[10.5rem]">
        <DropdownMenuItem
          disabled={disabled}
          onSelect={() => {
            onMoveInstead()
          }}
        >
          Move instead
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || cancelBusy}
          onSelect={() => {
            onCancelClass()
          }}
        >
          {cancelBusy ? 'Cancelling…' : 'Cancel class'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LiveSessionCapsule({
  bookOpen = true,
  timerLabel,
  timerSuffix,
  timerTone = 'default',
  onEnd,
  onMoveInstead,
  onCancelClass,
  actionsDisabled = false,
  cancelBusy = false,
  className,
}: PrepSessionCapsuleLiveProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute z-[60] flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
        bookOpen
          ? cn(BOOK_OVERLAY_GLASS_CHROME, 'left-1/2 top-3 -translate-x-1/2 text-white')
          : cn(CLASS_LAUNCH_CHROME, 'left-1/2 top-4 -translate-x-1/2'),
        className,
      )}
      role="toolbar"
      aria-label="Live class"
    >
      <span
        className={cn(
          'inline-flex h-7 items-baseline gap-1 rounded-full px-2.5 text-[11px] font-semibold tracking-tight',
          liveTimerToneClass(timerTone, bookOpen),
        )}
      >
        <span className="font-mono text-sm font-bold tabular-nums tracking-tight">{timerLabel}</span>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide',
            bookOpen ? 'text-white/65' : 'opacity-70',
          )}
        >
          {timerSuffix}
        </span>
      </span>
      <PrepChip
        bookOpen={bookOpen}
        title="End class"
        disabled={actionsDisabled}
        onClick={onEnd}
        className={cn(
          bookOpen
            ? 'bg-white/18 font-semibold text-white hover:bg-white/25'
            : 'bg-[#5c3d0a]/15 font-semibold text-[#5c3d0a] hover:bg-[#5c3d0a]/22',
        )}
      >
        End
      </PrepChip>
      <LiveOverflowMenu
        bookOpen={bookOpen}
        disabled={actionsDisabled}
        cancelBusy={cancelBusy}
        onMoveInstead={onMoveInstead}
        onCancelClass={onCancelClass}
      />
    </div>
  )
}

/**
 * Session chrome — floating pill.
 * Prep: Checks / Save / Leave. Live: timer / End / … (Move & Cancel).
 */
export function PrepSessionCapsule(props: PrepSessionCapsuleProps) {
  if (props.mode === 'live') {
    return <LiveSessionCapsule {...props} />
  }

  const {
    bookOpen = false,
    variant = 'class',
    checksPrepOpen,
    onOpenChecksPrep,
    exitBusy = null,
    onSaveAndExit,
    onExitWithoutSave,
    onClose,
    className,
  } = props

  const isWorkshop = variant === 'workshop'
  return (
    <div
      className={cn(
        'pointer-events-auto absolute z-[60] flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
        bookOpen
          ? cn(BOOK_OVERLAY_GLASS_CHROME, 'left-1/2 top-3 -translate-x-1/2 text-white')
          : cn(CLASS_LAUNCH_CHROME, 'left-4 top-4'),
        className,
      )}
      role="toolbar"
      aria-label="Prep"
    >
      <PrepChip
        bookOpen={bookOpen}
        title="Reading checks prep"
        pressed={checksPrepOpen}
        active={checksPrepOpen}
        onClick={onOpenChecksPrep}
      >
        <ListChecks className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        Checks
      </PrepChip>
      {isWorkshop ? (
        <PrepChip bookOpen={bookOpen} title="Close book" onClick={() => onClose?.()}>
          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </PrepChip>
      ) : (
        <>
          <PrepChip
            bookOpen={bookOpen}
            title="Save & exit"
            disabled={exitBusy != null}
            onClick={() => onSaveAndExit?.()}
          >
            {exitBusy === 'save' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            )}
          </PrepChip>
          <PrepChip
            bookOpen={bookOpen}
            title="Leave without saving"
            disabled={exitBusy != null}
            onClick={() => onExitWithoutSave?.()}
          >
            {exitBusy === 'leave' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            )}
          </PrepChip>
        </>
      )}
    </div>
  )
}

/** Soft welcome-mat overflow for Move / Cancel (outside the book capsule). */
export function ClassSessionMoreMenu({
  disabled,
  cancelBusy,
  onMoveInstead,
  onCancelClass,
  triggerClassName,
}: {
  disabled?: boolean
  cancelBusy?: boolean
  onMoveInstead: () => void
  onCancelClass: () => void
  triggerClassName?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="More class actions"
          aria-label="More class actions"
          disabled={disabled}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#5c3d0a]/25 bg-[#fff8e8]/95 text-[#3d2810] shadow-sm transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-40',
            triggerClassName,
          )}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="min-w-[10.5rem]">
        <DropdownMenuItem disabled={disabled} onSelect={() => onMoveInstead()}>
          Move instead
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || cancelBusy}
          onSelect={() => onCancelClass()}
        >
          {cancelBusy ? 'Cancelling…' : 'Cancel class'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
