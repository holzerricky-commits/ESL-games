'use client'

import { Paintbrush, Pencil, Sparkles, type LucideIcon } from 'lucide-react'
import {
  PEN_STROKE_PROFILE_LABEL,
  PEN_STROKE_PROFILES,
  type ActivePenStrokeProfile,
  type PenStrokeProfile,
} from '@/lib/books/pen-stroke-profile'
import { cn } from '@/lib/utils'

const PROFILE_SUBTITLE: Record<ActivePenStrokeProfile, string> = {
  pen: 'Solid ink',
  brush: 'Soft, wider strokes',
  effects: 'Pattern ink',
}

const PROFILE_ICON: Record<ActivePenStrokeProfile, LucideIcon> = {
  pen: Pencil,
  brush: Paintbrush,
  effects: Sparkles,
}

export function PenProfileCirclePicker({
  value,
  onChange,
  idPrefix = 'pen-profile',
}: {
  value: PenStrokeProfile
  onChange: (profile: ActivePenStrokeProfile) => void
  idPrefix?: string
}) {
  const active = (PEN_STROKE_PROFILES as readonly string[]).includes(value)
    ? (value as ActivePenStrokeProfile)
    : 'pen'

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pen type">
      {PEN_STROKE_PROFILES.map((profile) => {
        const selected = active === profile
        const Icon = PROFILE_ICON[profile]
        return (
          <button
            key={profile}
            type="button"
            id={`${idPrefix}-${profile}`}
            aria-label={PEN_STROKE_PROFILE_LABEL[profile]}
            aria-pressed={selected}
            onClick={() => onChange(profile)}
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
              <Icon
                className={cn('h-6 w-6', selected ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]')}
                strokeWidth={1.75}
                aria-hidden
              />
            </span>
            <span className="min-w-0 text-center">
              <span
                className={cn(
                  'block truncate text-xs font-semibold leading-tight',
                  selected ? 'text-[#f4f4f5]' : 'text-[#d4d4d8]',
                )}
              >
                {PEN_STROKE_PROFILE_LABEL[profile]}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-[#71717a]">
                {PROFILE_SUBTITLE[profile]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
