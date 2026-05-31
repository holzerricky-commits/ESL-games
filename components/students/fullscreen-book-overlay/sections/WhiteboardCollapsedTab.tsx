'use client'

import { LayoutTemplate } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WhiteboardSlotSide } from '../hooks/useWhiteboardPlacement'

interface WhiteboardCollapsedTabProps {
  slotSide: WhiteboardSlotSide
  onExpand: () => void
  suppressChrome?: boolean
}

/** Edge pill when the lesson board is minimized — does not consume a spread page slot. */
export function WhiteboardCollapsedTab({
  slotSide,
  onExpand,
  suppressChrome = false,
}: WhiteboardCollapsedTabProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      title="Open lesson board (W)"
      aria-label="Open lesson board"
      className={cn(
        'pointer-events-auto absolute top-1/2 z-[25] flex -translate-y-1/2 flex-col items-center justify-center gap-0.5 border border-[#4a3421]/20 bg-[#f8f7f4]/92 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.1)] transition-colors hover:bg-[#f0ebe3]',
        slotSide === 'left' && 'left-0 rounded-r-md border-l-0 pl-1 pr-1.5',
        slotSide === 'right' && 'right-0 rounded-l-md border-r-0 pl-1.5 pr-1',
        suppressChrome && 'pointer-events-none invisible opacity-0',
      )}
      style={{ width: 28, minHeight: 64 }}
      data-whiteboard-collapsed-tab={slotSide}
    >
      <LayoutTemplate className="h-3.5 w-3.5 text-[#5c4030]/80" aria-hidden />
      <span className="text-[8px] font-semibold uppercase tracking-wide text-[#5c4030]/70 [writing-mode:vertical-rl] rotate-180">
        Board
      </span>
    </button>
  )
}
