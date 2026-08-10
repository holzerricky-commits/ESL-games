'use client'

import type { ReactNode } from 'react'
import type { StickerKind } from '@/lib/books/sticker-tool'
import { cn } from '@/lib/utils'

const KIND_OPTIONS: {
  value: StickerKind
  label: string
  subtitle: string
}[] = [
  { value: 'quick', label: 'Quick', subtitle: 'Tap symbol' },
  { value: 'writable', label: 'Writable', subtitle: 'Text box' },
]

export function StickerKindCirclePicker({
  value,
  onChange,
  quickIcon,
  writableIcon,
  idPrefix = 'sticker-kind',
}: {
  value: StickerKind
  onChange: (kind: StickerKind) => void
  quickIcon: ReactNode
  writableIcon: ReactNode
  idPrefix?: string
}) {
  const icons: Record<StickerKind, ReactNode> = {
    quick: quickIcon,
    writable: writableIcon,
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Sticker kind">
      {KIND_OPTIONS.map(({ value: kind, label, subtitle }) => {
        const selected = value === kind
        return (
          <button
            key={kind}
            type="button"
            id={`${idPrefix}-${kind}`}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onChange(kind)}
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
              {icons[kind]}
            </span>
            <span className="min-w-0 text-center">
              <span
                className={cn(
                  'block truncate text-xs font-semibold leading-tight',
                  selected ? 'text-[#f4f4f5]' : 'text-[#d4d4d8]',
                )}
              >
                {label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-[#71717a]">{subtitle}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
