'use client'

import type { ReactNode } from 'react'
import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import { WRITABLE_STICKER_LABEL, WRITABLE_STICKER_VARIANTS } from '@/lib/books/sticker-tool'
import { cn } from '@/lib/utils'

const VARIANT_SUBTITLE: Record<WritableStickerVariant, string> = {
  note: 'Your fill color',
  caption: 'Dark bar, centered',
  speech: 'White bubble',
  thought: 'Cloud bubble',
}

export function WritableStickerCirclePicker({
  value,
  onChange,
  iconForVariant,
  idPrefix = 'writable-sticker',
}: {
  value: WritableStickerVariant
  onChange: (variant: WritableStickerVariant) => void
  iconForVariant: (variant: WritableStickerVariant) => ReactNode
  idPrefix?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Writable sticker type">
      {WRITABLE_STICKER_VARIANTS.map((variant) => {
        const selected = value === variant
        return (
          <button
            key={variant}
            type="button"
            id={`${idPrefix}-${variant}`}
            aria-label={WRITABLE_STICKER_LABEL[variant]}
            aria-pressed={selected}
            onClick={() => onChange(variant)}
            className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg px-0.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]"
          >
            <span
              className={cn(
                'flex size-14 items-center justify-center rounded-full border bg-[#353539] transition-[box-shadow,border-color] [&_svg]:!h-6 [&_svg]:!w-6',
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
                  'block truncate text-xs font-semibold leading-tight',
                  selected ? 'text-[#f4f4f5]' : 'text-[#d4d4d8]',
                )}
              >
                {WRITABLE_STICKER_LABEL[variant]}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-[#71717a]">
                {VARIANT_SUBTITLE[variant]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
