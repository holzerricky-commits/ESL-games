'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type EraserMode = 'rubber' | 'line'

const MODE_OPTIONS: {
  value: EraserMode
  label: string
  subtitle: string
}[] = [
  { value: 'rubber', label: 'Rub', subtitle: 'Erase by touch' },
  { value: 'line', label: 'Stroke', subtitle: 'Line eraser' },
]

export function EraserModeCirclePicker({
  value,
  onChange,
  rubberIcon,
  lineIcon,
  idPrefix = 'eraser-mode',
}: {
  value: EraserMode
  onChange: (mode: EraserMode) => void
  rubberIcon: ReactNode
  lineIcon: ReactNode
  idPrefix?: string
}) {
  const icons: Record<EraserMode, ReactNode> = {
    rubber: rubberIcon,
    line: lineIcon,
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Eraser mode">
      {MODE_OPTIONS.map(({ value: mode, label, subtitle }) => {
        const selected = value === mode
        return (
          <button
            key={mode}
            type="button"
            id={`${idPrefix}-${mode}`}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onChange(mode)}
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
              {icons[mode]}
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
