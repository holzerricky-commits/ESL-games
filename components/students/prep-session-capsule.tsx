'use client'

import { Check, ListChecks, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BOOK_OVERLAY_GLASS_CHROME,
  CLASS_LAUNCH_CHROME,
} from '@/components/students/fullscreen-book-overlay/constants'
import { cn } from '@/lib/utils'

export interface PrepSessionCapsuleProps {
  /** Book overlay open — glass chrome + offset past the left strip. */
  bookOpen?: boolean
  checksPrepOpen: boolean
  onOpenChecksPrep: () => void
  exitBusy: 'save' | 'leave' | null
  onSaveAndExit: () => void
  onExitWithoutSave: () => void
  className?: string
}

/**
 * Prep session mode chrome — one top-left capsule for checks desk + leave.
 * Same component on the shelf and with the book open (not on the left tool rail).
 */
export function PrepSessionCapsule({
  bookOpen = false,
  checksPrepOpen,
  onOpenChecksPrep,
  exitBusy,
  onSaveAndExit,
  onExitWithoutSave,
  className,
}: PrepSessionCapsuleProps) {
  const iconBtnClass = cn(
    'h-7 w-7 shrink-0',
    bookOpen
      ? 'text-white/75 hover:bg-white/10 hover:text-white'
      : 'text-[#5c3d0a]/80 hover:bg-[#5c3d0a]/10 hover:text-[#5c3d0a]',
  )

  return (
    <div
      className={cn(
        'pointer-events-auto absolute top-4 z-[60] flex items-center gap-0.5 rounded-full px-1.5 py-1',
        bookOpen
          ? cn(BOOK_OVERLAY_GLASS_CHROME, 'left-[calc(var(--fst-width,2.75rem)+0.75rem)] text-white')
          : cn(CLASS_LAUNCH_CHROME, 'left-4'),
        className,
      )}
      role="toolbar"
      aria-label="Prep"
    >
      <span
        className={cn(
          'px-1.5 text-[11px] font-medium',
          bookOpen ? 'text-white/70' : 'text-[#5c3d0a]/70',
        )}
      >
        Prep
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={iconBtnClass}
        title="Reading checks prep"
        aria-label="Reading checks prep"
        aria-pressed={checksPrepOpen}
        onClick={onOpenChecksPrep}
      >
        <ListChecks className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={iconBtnClass}
        title="Save & exit"
        aria-label="Save & exit"
        disabled={exitBusy != null}
        onClick={onSaveAndExit}
      >
        {exitBusy === 'save' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden />
        )}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={iconBtnClass}
        title="Exit without saving"
        aria-label="Exit without saving"
        disabled={exitBusy != null}
        onClick={onExitWithoutSave}
      >
        {exitBusy === 'leave' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <LogOut className="h-3.5 w-3.5" aria-hidden />
        )}
      </Button>
    </div>
  )
}
