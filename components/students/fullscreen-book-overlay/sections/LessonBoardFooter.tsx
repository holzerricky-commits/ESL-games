'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import { LessonBoardNewPageMenu } from '@/components/students/fullscreen-book-overlay/sections/LessonBoardNewPageMenu'
import { cn } from '@/lib/utils'
import { WHITEBOARD_FOOTER_CHROME } from '../constants'

const CHROME_ICON = 'h-3.5 w-3.5 shrink-0 stroke-[2.25] text-[#374151]'

const FLOAT_PILL =
  'pointer-events-auto flex items-center rounded-full border border-[#E5E7EB] bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.08)]'

const FLOAT_BTN =
  'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-transparent transition-colors duration-150 ease-out hover:bg-black/[0.05] active:bg-black/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D1D5DB] disabled:pointer-events-none disabled:opacity-35'

function ChromeIconButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={cn(FLOAT_BTN, className)} {...props}>
      {children}
    </button>
  )
}

export interface LessonBoardFooterProps {
  suppressChrome?: boolean
  deferChromeActions?: boolean
  pageOrientation?: LessonBoardPageOrientation
  lessonBoardPageIndex?: number
  lessonBoardPageCount?: number
  onNewLessonBoardPage?: (orientation: LessonBoardPageOrientation) => void
  onPrevLessonBoardPage?: () => void
  onNextLessonBoardPage?: () => void
}

/**
 * Footer: centered floating page pill + New page floating on the right.
 */
export function LessonBoardFooter({
  suppressChrome = false,
  deferChromeActions = false,
  pageOrientation = 'standard',
  lessonBoardPageIndex = 0,
  lessonBoardPageCount = 1,
  onNewLessonBoardPage,
  onPrevLessonBoardPage,
  onNextLessonBoardPage,
}: LessonBoardFooterProps) {
  const isWide = pageOrientation === 'wide'
  const pageNavEnabled = lessonBoardPageCount > 0 && Boolean(onNewLessonBoardPage)
  const canGoPrev = lessonBoardPageIndex > 0
  const canGoNext = lessonBoardPageIndex < lessonBoardPageCount - 1
  const pageLabel = isWide
    ? `Page ${lessonBoardPageIndex + 1} / ${lessonBoardPageCount}`
    : `${lessonBoardPageIndex + 1}/${lessonBoardPageCount}`
  const pageAriaLabel = `Page ${lessonBoardPageIndex + 1} of ${lessonBoardPageCount}`

  if (suppressChrome) {
    return (
      <footer
        className={cn(
          'relative z-20 flex h-9 shrink-0 items-center px-2.5',
          WHITEBOARD_FOOTER_CHROME,
          'pointer-events-none invisible',
        )}
        aria-hidden
      />
    )
  }

  return (
    <footer
      className={cn(
        'relative z-20 flex h-9 shrink-0 items-center px-2.5',
        WHITEBOARD_FOOTER_CHROME,
        deferChromeActions && 'pointer-events-none opacity-0',
      )}
    >
      {/* Center floating page pill */}
      {pageNavEnabled ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={cn(FLOAT_PILL, 'h-8 gap-0.5 px-1')}>
            <ChromeIconButton
              onClick={onPrevLessonBoardPage}
              disabled={!canGoPrev}
              aria-label="Previous board page"
              title="Previous page"
            >
              <ChevronLeft className={CHROME_ICON} aria-hidden />
            </ChromeIconButton>
            <span
              className={cn(
                'select-none text-center text-[11px] font-medium tabular-nums text-[#4B5563]',
                isWide ? 'min-w-[4.5rem] px-0.5' : 'min-w-[2rem] px-0.5',
              )}
              aria-live="polite"
              aria-label={pageAriaLabel}
            >
              {pageLabel}
            </span>
            <ChromeIconButton
              onClick={onNextLessonBoardPage}
              disabled={!canGoNext}
              aria-label="Next board page"
              title="Next page"
            >
              <ChevronRight className={CHROME_ICON} aria-hidden />
            </ChromeIconButton>
          </div>
        </div>
      ) : null}

      {/* Spacer so absolute center stays correct; New page docks right */}
      <div className="min-w-0 flex-1" aria-hidden />

      {onNewLessonBoardPage ? (
        <div className={cn(FLOAT_PILL, 'relative z-10 h-8 w-8 shrink-0 justify-center')}>
          <LessonBoardNewPageMenu
            onCreatePage={onNewLessonBoardPage}
            triggerClassName="rounded-full"
          />
        </div>
      ) : null}
    </footer>
  )
}
