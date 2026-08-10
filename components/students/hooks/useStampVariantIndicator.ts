'use client'

import { useEffect, useState } from 'react'
import type { StampVariant } from '@/lib/books/annotation-command-types'

/** How long the stamp indicator stays visible after activation or variant change. */
export const STAMP_VARIANT_INDICATOR_VISIBLE_MS = 1400

export function useStampVariantIndicator(
  active: boolean,
  stampVariant: StampVariant,
  pulseEpoch = 0,
): boolean {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!active) {
      setShown(false)
      return
    }
    setShown(true)
    const id = window.setTimeout(() => setShown(false), STAMP_VARIANT_INDICATOR_VISIBLE_MS)
    return () => window.clearTimeout(id)
  }, [active, stampVariant, pulseEpoch])

  return shown
}
