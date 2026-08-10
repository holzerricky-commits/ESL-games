'use client'

import { MoveHorizontal, Scan, Square } from 'lucide-react'
import type { MarqueeSelectRule } from '@/lib/books/annotation-select'
import { MARQUEE_SELECT_RULE_CYCLE } from '@/lib/books/annotation-select'
import { TOOLBAR_ICON_CLASS } from '@/components/students/annotation-toolbar-icon'
import { cn } from '@/lib/utils'

const iconCls = TOOLBAR_ICON_CLASS

const RULE_LABEL: Record<MarqueeSelectRule, string> = {
  'follow-drag': 'Follow drag',
  crossing: 'Touching',
  window: 'Inside only',
}

const RULE_SUBTITLE: Record<MarqueeSelectRule, string> = {
  'follow-drag': 'Default',
  crossing: 'Touching counts',
  window: 'Fully inside',
}

const RULE_ICON: Record<MarqueeSelectRule, typeof MoveHorizontal> = {
  'follow-drag': MoveHorizontal,
  crossing: Scan,
  window: Square,
}

export function MarqueeRuleCirclePicker({
  value,
  onChange,
  idPrefix = 'select-marquee',
}: {
  value: MarqueeSelectRule
  onChange: (rule: MarqueeSelectRule) => void
  idPrefix?: string
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Marquee selection rule">
      {MARQUEE_SELECT_RULE_CYCLE.map((rule) => {
        const selected = value === rule
        const Icon = RULE_ICON[rule]
        return (
          <button
            key={rule}
            type="button"
            id={`${idPrefix}-${rule}`}
            aria-label={RULE_LABEL[rule]}
            aria-pressed={selected}
            onClick={() => onChange(rule)}
            className="flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]"
          >
            <span
              className={cn(
                'flex size-11 items-center justify-center rounded-full border bg-[#353539] transition-[box-shadow,border-color]',
                selected
                  ? 'border-[#f4f4f5] ring-2 ring-[#f4f4f5]'
                  : 'border-[#3f3f46] hover:border-[#71717a]',
              )}
            >
              <Icon className={cn(iconCls, selected ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]')} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 text-center">
              <span
                className={cn(
                  'block truncate text-[10px] font-semibold leading-tight',
                  selected ? 'text-[#f4f4f5]' : 'text-[#d4d4d8]',
                )}
              >
                {RULE_LABEL[rule]}
              </span>
              <span className="mt-0.5 block truncate text-[9px] leading-tight text-[#71717a]">
                {RULE_SUBTITLE[rule]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
