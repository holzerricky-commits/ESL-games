'use client'

import { createPortal } from 'react-dom'
import { Coins, Dice5, Timer, Watch } from 'lucide-react'
import {
  CLASS_TOOLBOX_TOOLS,
  type ClassToolboxToolId,
} from '@/lib/class-toolbox/types'
import { cn } from '@/lib/utils'

const TOOL_ICON: Record<ClassToolboxToolId, typeof Coins> = {
  coin: Coins,
  dice: Dice5,
  countdown: Timer,
  stopwatch: Watch,
}

/**
 * Compact tool picker from the book left strip.
 * Portaled so it is not clipped by the workspace rail.
 */
export function ClassToolboxMenu({
  open,
  onClose,
  onSelectTool,
  mounted,
}: {
  open: boolean
  onClose: () => void
  onSelectTool: (id: ClassToolboxToolId) => void
  mounted: boolean
}) {
  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[700]" data-class-toolbox-menu="open">
      <div aria-hidden className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Toolbox"
        className={cn(
          'absolute left-14 top-[min(70%,calc(100%-12rem))] z-10 w-[min(18rem,calc(100vw-4.5rem))]',
          '-translate-y-1/2 rounded-2xl border border-white/15 bg-[#1c1c20] p-3 text-white shadow-2xl',
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 px-0.5">
          <p className="text-sm font-semibold tracking-wide">Toolbox</p>
          <p className="mt-0.5 text-[11px] text-white/55">Quick helpers for this lesson</p>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {CLASS_TOOLBOX_TOOLS.map((tool) => {
            const Icon = TOOL_ICON[tool.id]
            return (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => onSelectTool(tool.id)}
                  className={cn(
                    'flex w-full flex-col items-start gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left',
                    'transition-colors hover:border-white/25 hover:bg-white/10',
                  )}
                >
                  <Icon className="h-4 w-4 text-white/80" aria-hidden />
                  <span className="text-xs font-semibold text-white">{tool.label}</span>
                  <span className="text-[10px] leading-snug text-white/50">{tool.blurb}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
