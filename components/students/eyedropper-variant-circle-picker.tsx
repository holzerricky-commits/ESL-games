'use client'

import type { ReactNode } from 'react'
import type { EyedropperVariant } from '@/lib/books/eyedropper-variant'
import { EYEDROPPER_VARIANT_LABEL } from '@/lib/books/eyedropper-variant'
import { cn } from '@/lib/utils'

const VARIANT_OPTIONS: {
  value: EyedropperVariant
  subtitle: string
}[] = [
  { value: 'sample', subtitle: 'Pick a color' },
  { value: 'smart', subtitle: 'Readable ink stroke' },
]

export function EyedropperVariantCirclePicker({
  value,
  onChange,
  sampleIcon,
  smartIcon,
  idPrefix = 'eyedropper-variant',
}: {
  value: EyedropperVariant
  onChange: (variant: EyedropperVariant) => void
  sampleIcon: ReactNode
  smartIcon: ReactNode
  idPrefix?: string
}) {
  const icons: Record<EyedropperVariant, ReactNode> = {
    sample: sampleIcon,
    smart: smartIcon,
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Eyedropper type">
      {VARIANT_OPTIONS.map(({ value: variant, subtitle }) => {
        const selected = value === variant
        const label = EYEDROPPER_VARIANT_LABEL[variant]
        return (
          <button
            key={variant}
            type="button"
            id={`${idPrefix}-${variant}`}
            aria-label={label}
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
              {icons[variant]}
            </span>
            <span className="min-w-0 text-center">
              <span
                className={cn(
                  'block truncate text-xs font-semibold leading-tight',
                  selected ? 'text-[#f4f4f5]' : 'text-[#d4d4d8]',
                )}
              >
                {variant === 'sample' ? 'Sample' : 'Smart ink'}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-[#71717a]">{subtitle}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
