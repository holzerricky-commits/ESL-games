'use client'

import { Type } from 'lucide-react'
import type { TextAnnotationVisualStyle } from '@/lib/books/annotation-command-types'
import { cn } from '@/lib/utils'

const TEXT_VISUAL_STYLES = ['plain', 'filled'] as const satisfies readonly TextAnnotationVisualStyle[]

const STYLE_LABEL: Record<(typeof TEXT_VISUAL_STYLES)[number], string> = {
  plain: 'Plain',
  filled: 'Background',
}

const STYLE_SUBTITLE: Record<(typeof TEXT_VISUAL_STYLES)[number], string> = {
  plain: 'Text only',
  filled: 'Fill per line',
}

function TextWithBackgroundIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 18 18" aria-hidden className={className}>
      <rect x="2" y="5" width="14" height="9" rx="1" fill="currentColor" opacity="0.4" />
      <text x="9" y="12.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">
        T
      </text>
    </svg>
  )
}

export function TextStyleCirclePicker({
  value,
  onChange,
  idPrefix = 'text-style',
}: {
  value: TextAnnotationVisualStyle
  onChange: (style: TextAnnotationVisualStyle) => void
  idPrefix?: string
}) {
  const active = value === 'filled' ? 'filled' : 'plain'

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Text style">
      {TEXT_VISUAL_STYLES.map((style) => {
        const selected = active === style
        const iconClass = cn('h-6 w-6', selected ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]')
        return (
          <button
            key={style}
            type="button"
            id={`${idPrefix}-${style}`}
            aria-label={STYLE_LABEL[style]}
            aria-pressed={selected}
            onClick={() => onChange(style)}
            className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg px-0.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]"
          >
            <span
              className={cn(
                'flex size-14 items-center justify-center rounded-full border bg-[#353539] transition-[box-shadow,border-color]',
                selected
                  ? 'border-[#f4f4f5] ring-2 ring-[#f4f4f5]'
                  : 'border-[#3f3f46] hover:border-[#71717a]',
              )}
            >
              {style === 'plain' ? (
                <Type className={iconClass} strokeWidth={1.75} aria-hidden />
              ) : (
                <TextWithBackgroundIcon className={iconClass} />
              )}
            </span>
            <span className="min-w-0 text-center">
              <span
                className={cn(
                  'block truncate text-xs font-semibold leading-tight',
                  selected ? 'text-[#f4f4f5]' : 'text-[#d4d4d8]',
                )}
              >
                {STYLE_LABEL[style]}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-[#71717a]">
                {STYLE_SUBTITLE[style]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
