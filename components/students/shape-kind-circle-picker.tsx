'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ShapeKindCircleOption = {
  value: string
  label: string
  subtitle: string
  icon: ReactNode
}

export function ShapeKindCirclePicker({
  value,
  onChange,
  options,
  idPrefix = 'shape-kind',
}: {
  value: string
  onChange: (kind: string) => void
  options: readonly ShapeKindCircleOption[]
  idPrefix?: string
}) {
  return (
    <div
      className="grid grid-cols-5 gap-1.5"
      role="group"
      aria-label="Shape kind"
    >
      {options.map(({ value: kind, label, subtitle, icon }) => {
        const selected = value === kind
        return (
          <button
            key={kind}
            type="button"
            id={`${idPrefix}-${kind}`}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onChange(kind)}
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
              {icon}
            </span>
            <span className="min-w-0 text-center">
              <span
                className={cn(
                  'block truncate text-[10px] font-semibold leading-tight',
                  selected ? 'text-[#f4f4f5]' : 'text-[#d4d4d8]',
                )}
              >
                {label}
              </span>
              <span className="mt-0.5 block truncate text-[9px] leading-tight text-[#71717a]">
                {subtitle}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
