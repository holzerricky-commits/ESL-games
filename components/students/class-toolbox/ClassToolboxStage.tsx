'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Spectacle layer over the book. Soft dim + eat taps while `blocking`;
 * otherwise pointer-events none so the book stays usable under a settled prop.
 * z-index stays below the toolbox dock so Flip remains clickable.
 */
export function ClassToolboxStage({
  mounted,
  active,
  blocking,
  children,
}: {
  mounted: boolean
  active: boolean
  blocking: boolean
  children: ReactNode
}) {
  if (!mounted || !active) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[705] flex items-center justify-center',
        blocking ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      data-class-toolbox-stage={blocking ? 'blocking' : 'idle'}
      aria-hidden={false}
    >
      <div
        className={cn(
          'absolute inset-0 bg-black/15 transition-opacity duration-700 ease-out',
          blocking ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
      />
      <div className="relative z-10 flex items-center justify-center">{children}</div>
    </div>,
    document.body,
  )
}
