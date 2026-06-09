'use client'

import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Dock,
  GripHorizontal,
  PictureInPicture2,
  Presentation,
  Minus,
} from 'lucide-react'
import type { WhiteboardLayoutMode } from '../hooks/useWhiteboardPlacement'
import type { LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import { LessonBoardNewPageMenu } from '@/components/students/fullscreen-book-overlay/sections/LessonBoardNewPageMenu'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { WHITEBOARD_HEADER_CHROME } from '../constants'

const CHROME_ICON = 'h-3.5 w-3.5 shrink-0 stroke-[2.25] text-[#374151]'

const CHROME_BTN =
  'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md bg-transparent transition-colors duration-150 ease-out hover:bg-black/[0.05] active:bg-black/[0.08] focus-visible:outline-none focus-visible:bg-black/[0.04] focus-visible:ring-1 focus-visible:ring-[#D1D5DB]'

const HEADER_ACTIONS_REVEAL_MS = 280

function ChromeIconButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={cn(CHROME_BTN, className)} {...props}>
      {children}
    </button>
  )
}

export interface WhiteboardHeaderProps {
  suppressChrome: boolean
  /** While true, toolbar controls stay hidden so the bar can appear at full size first. */
  deferChromeActions?: boolean
  layoutMode?: WhiteboardLayoutMode
  onFloat?: () => void
  onDock?: () => void
  swapSlotSide: () => void
  onMinimize: () => void
  slotDragEnabled: boolean
  floatDragEnabled?: boolean
  onSlotDragPointerDown: (e: React.PointerEvent) => void
  onSlotDragPointerMove: (e: React.PointerEvent) => void
  onSlotDragPointerUp: (e: React.PointerEvent) => void
  onSlotDragPointerCancel: () => void
  onFloatDragPointerDown?: (e: React.PointerEvent) => void
  onFloatDragPointerMove?: (e: React.PointerEvent) => void
  onFloatDragPointerUp?: (e: React.PointerEvent) => void
  onFloatDragPointerCancel?: () => void
  lessonBoardPageIndex?: number
  lessonBoardPageCount?: number
  onNewLessonBoardPage?: (orientation: LessonBoardPageOrientation) => void
  onPrevLessonBoardPage?: () => void
  onNextLessonBoardPage?: () => void
}

export function WhiteboardHeader({
  suppressChrome,
  deferChromeActions = false,
  layoutMode = 'slot',
  onFloat,
  onDock,
  swapSlotSide,
  onMinimize,
  slotDragEnabled,
  floatDragEnabled = false,
  onSlotDragPointerDown,
  onSlotDragPointerMove,
  onSlotDragPointerUp,
  onSlotDragPointerCancel,
  onFloatDragPointerDown,
  onFloatDragPointerMove,
  onFloatDragPointerUp,
  onFloatDragPointerCancel,
  lessonBoardPageIndex = 0,
  lessonBoardPageCount = 1,
  onNewLessonBoardPage,
  onPrevLessonBoardPage,
  onNextLessonBoardPage,
}: WhiteboardHeaderProps) {
  const pageNavEnabled = lessonBoardPageCount > 0 && Boolean(onNewLessonBoardPage)
  const canGoPrev = lessonBoardPageIndex > 0
  const canGoNext = lessonBoardPageIndex < lessonBoardPageCount - 1
  const [chromeActionsVisible, setChromeActionsVisible] = useState(!deferChromeActions)

  useEffect(() => {
    if (deferChromeActions) {
      setChromeActionsVisible(false)
      return
    }
    const id = window.setTimeout(() => setChromeActionsVisible(true), HEADER_ACTIONS_REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [deferChromeActions])

  return (
    <header
      className={cn(
        'relative z-20 flex h-9 shrink-0 items-center px-2.5',
        WHITEBOARD_HEADER_CHROME,
        suppressChrome && 'pointer-events-none invisible',
      )}
    >
      <div
        className={cn(
          'flex w-full min-w-0 items-center transition-opacity duration-200 ease-out',
          chromeActionsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#EBEEF2] bg-white"
          aria-hidden
        >
          <Presentation className="h-3.5 w-3.5 stroke-[2.25] text-[#374151]" aria-hidden />
        </div>
        {pageNavEnabled ? (
          <div className="flex min-w-0 items-center gap-0.5">
            <ChromeIconButton
              onClick={onPrevLessonBoardPage}
              disabled={!canGoPrev}
              aria-label="Previous board page"
              title="Previous page"
              className="disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className={CHROME_ICON} aria-hidden />
            </ChromeIconButton>
            <span
              className="min-w-[4.5rem] select-none text-center text-[11px] font-medium tabular-nums text-[#4B5563]"
              aria-live="polite"
            >
              Page {lessonBoardPageIndex + 1} / {lessonBoardPageCount}
            </span>
            <ChromeIconButton
              onClick={onNextLessonBoardPage}
              disabled={!canGoNext}
              aria-label="Next board page"
              title="Next page"
              className="disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className={CHROME_ICON} aria-hidden />
            </ChromeIconButton>
            {onNewLessonBoardPage ? (
              <LessonBoardNewPageMenu onCreatePage={onNewLessonBoardPage} />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center">
        {layoutMode === 'floating' && floatDragEnabled ? (
          <div
            role="separator"
            aria-label="Drag to move floating board"
            title="Drag to move board"
            className={cn(
              'pointer-events-auto flex h-7 w-11 cursor-grab touch-none items-center justify-center rounded-md',
              'text-[#4B5563] transition-colors hover:bg-black/[0.04] hover:text-[#374151] active:cursor-grabbing',
            )}
            onPointerDown={onFloatDragPointerDown}
            onPointerMove={onFloatDragPointerMove}
            onPointerUp={onFloatDragPointerUp}
            onPointerCancel={onFloatDragPointerCancel}
          >
            <GripHorizontal className="h-4 w-4 stroke-[2.5]" aria-hidden />
          </div>
        ) : slotDragEnabled ? (
          <div
            role="separator"
            aria-label="Drag to move board to the other side"
            title="Drag to move board"
            className={cn(
              'pointer-events-auto flex h-7 w-11 cursor-grab touch-none items-center justify-center rounded-md',
              'text-[#4B5563] transition-colors hover:bg-black/[0.04] hover:text-[#374151] active:cursor-grabbing',
            )}
            onPointerDown={onSlotDragPointerDown}
            onPointerMove={onSlotDragPointerMove}
            onPointerUp={onSlotDragPointerUp}
            onPointerCancel={onSlotDragPointerCancel}
          >
            <GripHorizontal className="h-4 w-4 stroke-[2.5]" aria-hidden />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5">
        {layoutMode === 'floating' && onDock ? (
          <ChromeIconButton onClick={onDock} aria-label="Dock board to book" title="Dock to book">
            <Dock className={CHROME_ICON} aria-hidden />
          </ChromeIconButton>
        ) : onFloat ? (
          <ChromeIconButton
            onClick={onFloat}
            aria-label="Float board above book"
            title="Float board"
          >
            <PictureInPicture2 className={CHROME_ICON} aria-hidden />
          </ChromeIconButton>
        ) : null}
        {layoutMode === 'slot' ? (
          <ChromeIconButton
            onClick={swapSlotSide}
            aria-label="Move board to other side"
            title="Move to other side"
          >
            <ArrowLeftRight className={CHROME_ICON} aria-hidden />
          </ChromeIconButton>
        ) : null}
        <span className="mx-0.5 h-3.5 w-px shrink-0 bg-[#EBEEF2]" aria-hidden />

        <ChromeIconButton
          onClick={onMinimize}
          aria-label="Minimize lesson board"
          title="Minimize board"
        >
          <Minus className={CHROME_ICON} aria-hidden />
        </ChromeIconButton>
      </div>
      </div>
    </header>
  )
}

/** @deprecated Use WhiteboardHeader */
export const WhiteboardChrome = WhiteboardHeader
