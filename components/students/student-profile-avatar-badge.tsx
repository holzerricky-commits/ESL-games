'use client'

import { useState } from 'react'
import { resolveStudentAvatarUrl } from '@/lib/students/student-avatar-url'

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface StudentProfileAvatarBadgeProps {
  studentId: string
  name: string
  avatarUrl?: string | null
  statusLabel?: string
}

export function StudentProfileAvatarBadge({
  studentId,
  name,
  avatarUrl,
  statusLabel = '+XP',
}: StudentProfileAvatarBadgeProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const avatarSrc = resolveStudentAvatarUrl(studentId, avatarUrl)
  const showImage = !imageFailed

  return (
    <div className="relative z-[6] mx-auto -mt-9 flex w-full max-w-[min(100%,12rem)] flex-col items-center gap-2.5 md:-mt-11 lg:-mt-12 lg:max-w-none">
      <div className="relative h-28 w-28 shrink-0 md:h-32 md:w-32 lg:h-36 lg:w-36">
        <div className="h-full w-full rounded-full border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.85),0_0_0_1px_color-mix(in_oklab,var(--brand-yellow)_18%,transparent),0_0_42px_-8px_color-mix(in_oklab,var(--brand-yellow)_45%,transparent)]">
          <div className="h-full w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1">
            <div className="relative h-full w-full overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-3)]">
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={`${name} avatar`}
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black tracking-wide text-foreground md:text-4xl">
                  {getInitials(name)}
                </div>
              )}
            </div>
          </div>
          <div className="absolute -bottom-1 right-0 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-yellow)] shadow-sm">
            {statusLabel}
          </div>
        </div>
      </div>
      <p className="w-full max-w-[16rem] text-center font-mono text-base font-bold leading-snug tracking-wide text-white lg:max-w-[14rem] lg:text-lg">
        {name}
      </p>
    </div>
  )
}
