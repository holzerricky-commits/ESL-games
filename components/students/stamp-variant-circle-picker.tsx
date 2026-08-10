'use client'

import type { ReactNode } from 'react'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import { STICKER_QUICK_LABEL, STICKER_QUICK_VARIANTS } from '@/lib/books/sticker-tool'
import { cn } from '@/lib/utils'

const VARIANT_SUBTITLE: Record<StampVariant, string> = {
  check: 'Correct',
  cross: 'Wrong',
  question: 'Ask',
  star: 'Highlight',
  heart: 'Like',
}

export function StampVariantCirclePicker({
  value,
  onChange,
  iconForVariant,
  idPrefix = 'stamp-variant',
}: {
  value: StampVariant
  onChange: (variant: StampVariant) => void
  iconForVariant: (variant: StampVariant) => ReactNode
  idPrefix?: string
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Quick sticker">
      {STICKER_QUICK_VARIANTS.map((variant) => {
        const selected = value === variant
        return (
          <button
            key={variant}
            type="button"
            id={`${idPrefix}-${variant}`}
            aria-label={STICKER_QUICK_LABEL[variant]}
            aria-pressed={selected}
            onClick={() => onChange(variant)}
            className="flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]"
          >
            <span
              className={cn(
                'flex size-11 items-center justify-center rounded-full border bg-[#353539] transition-[box-shadow,border-color] [&_svg]:!h-5 [&_svg]:!w-5',
                selected
                  ? 'border-[#f4f4f5] ring-2 ring-[#f4f4f5]'
                  : 'border-[#3f3f46] hover:border-[#71717a]',
              )}
            >
              {iconForVariant(variant)}
            </span>
            <span className="min-w-0 text-center">
              <span
                className={cn(
                  'block truncate text-[10px] font-semibold leading-tight',
                  selected ? 'text-[#f4f4f5]' : 'text-[#d4d4d8]',
                )}
              >
                {STICKER_QUICK_LABEL[variant]}
              </span>
              <span className="mt-0.5 block truncate text-[9px] leading-tight text-[#71717a]">
                {VARIANT_SUBTITLE[variant]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
