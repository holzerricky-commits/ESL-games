'use client'

import {
  ArrowLeftRight,
  GripHorizontal,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  Minus,
  Trash2,
} from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { WHITEBOARD_HEADER_CHROME } from '../constants'
import type { WhiteboardLayoutMode } from '../hooks/useWhiteboardPlacement'

const CHROME_ICON = 'h-3.5 w-3.5 shrink-0 stroke-[2.25] text-[#374151]'

const CHROME_BTN =
  'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md bg-transparent transition-colors duration-150 ease-out hover:bg-black/[0.05] active:bg-black/[0.08] focus-visible:outline-none focus-visible:bg-black/[0.04] focus-visible:ring-1 focus-visible:ring-[#D1D5DB]'

const CHROME_BTN_DANGER =
  'hover:bg-[var(--brand-red)]/[0.08] hover:text-[var(--brand-red)] focus-visible:ring-[var(--brand-red)]/25'

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
  layoutMode: WhiteboardLayoutMode
  swapSlotSide: () => void
  toggleFullscreen: () => void
  onMinimize: () => void
  onClearBoard?: () => void
  slotDragEnabled: boolean
  onSlotDragPointerDown: (e: React.PointerEvent) => void
  onSlotDragPointerMove: (e: React.PointerEvent) => void
  onSlotDragPointerUp: (e: React.PointerEvent) => void
  onSlotDragPointerCancel: () => void
}

export function WhiteboardHeader({
  suppressChrome,
  layoutMode,
  swapSlotSide,
  toggleFullscreen,
  onMinimize,
  onClearBoard,
  slotDragEnabled,
  onSlotDragPointerDown,
  onSlotDragPointerMove,
  onSlotDragPointerUp,
  onSlotDragPointerCancel,
}: WhiteboardHeaderProps) {
  const showBoardActions = layoutMode === 'slot' || onClearBoard != null

  return (
    <header
      className={cn(
        'relative z-20 flex h-9 shrink-0 items-center px-2.5',
        WHITEBOARD_HEADER_CHROME,
        suppressChrome && 'pointer-events-none invisible',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#EBEEF2] bg-white"
          aria-hidden
        >
          <LayoutTemplate className="h-3.5 w-3.5 stroke-[2.25] text-[#374151]" aria-hidden />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">
        {slotDragEnabled ? (
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
        {showBoardActions ? (
          <>
            {layoutMode === 'slot' ? (
              <ChromeIconButton
                onClick={swapSlotSide}
                aria-label="Move board to other side"
                title="Move to other side"
              >
                <ArrowLeftRight className={CHROME_ICON} aria-hidden />
              </ChromeIconButton>
            ) : null}
            {onClearBoard ? (
              <ChromeIconButton
                onClick={onClearBoard}
                aria-label="Clear board"
                title="Clear board"
                className={CHROME_BTN_DANGER}
              >
                <Trash2 className={cn(CHROME_ICON, 'text-[var(--brand-red)]/70')} aria-hidden />
              </ChromeIconButton>
            ) : null}
            <span className="mx-0.5 h-3.5 w-px shrink-0 bg-[#EBEEF2]" aria-hidden />
          </>
        ) : null}

        <ChromeIconButton
          onClick={toggleFullscreen}
          aria-label={layoutMode === 'fullscreen' ? 'Exit fullscreen board' : 'Fullscreen board'}
          title={layoutMode === 'fullscreen' ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {layoutMode === 'fullscreen' ? (
            <Minimize2 className={CHROME_ICON} aria-hidden />
          ) : (
            <Maximize2 className={CHROME_ICON} aria-hidden />
          )}
        </ChromeIconButton>

        <ChromeIconButton
          onClick={onMinimize}
          aria-label="Minimize lesson board"
          title="Minimize board"
        >
          <Minus className={CHROME_ICON} aria-hidden />
        </ChromeIconButton>
      </div>
    </header>
  )
}

/** @deprecated Use WhiteboardHeader */
export const WhiteboardChrome = WhiteboardHeader
