'use client'

import { useEffect, useState } from 'react'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import { STICKER_QUICK_LABEL } from '@/lib/books/sticker-tool'
import { stampIconForVariant } from '@/components/students/book-annotation-toolbar'
import { cn } from '@/lib/utils'

export function StampVariantIndicator({
  shown,
  stampVariant,
  stampQuestionColor,
}: {
  shown: boolean
  stampVariant: StampVariant
  stampQuestionColor: string
}) {
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (!shown) return
    setPulsing(true)
    const id = window.setTimeout(() => setPulsing(false), 220)
    return () => window.clearTimeout(id)
  }, [shown, stampVariant])

  const label = STICKER_QUICK_LABEL[stampVariant]

  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-10 left-1/2 z-[70] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all duration-300 ease-out motion-reduce:transition-none [&_svg]:!h-9 [&_svg]:!w-9',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        pulsing && shown && 'scale-110',
      )}
      role="status"
      aria-live="polite"
      aria-hidden={!shown}
      aria-label={shown ? `Stamp: ${label}` : undefined}
    >
      {stampIconForVariant(stampVariant, stampQuestionColor)}
    </div>
  )
}
