'use client'

import { useEffect, useState } from 'react'
import {
  loadCachedBookImage,
  peekCachedBookImageUrl,
} from '@/lib/books/local-image-cache'

export type CachedBookImagePhase = 'idle' | 'loading' | 'ready' | 'error'

export function useCachedBookImage(src: string | null, enabled: boolean) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(() =>
    src && enabled ? peekCachedBookImageUrl(src) ?? null : null,
  )
  const [phase, setPhase] = useState<CachedBookImagePhase>(() =>
    displaySrc ? 'ready' : 'idle',
  )

  useEffect(() => {
    if (!src || !enabled) {
      if (!src) {
        setDisplaySrc(null)
        setPhase('idle')
      }
      return
    }

    let cancelled = false
    const memory = peekCachedBookImageUrl(src)
    if (memory) {
      setDisplaySrc(memory)
      setPhase('ready')
    } else {
      setPhase('loading')
    }

    void loadCachedBookImage(src, (url) => {
      if (cancelled) return
      setDisplaySrc(url)
      setPhase('ready')
    }).catch(() => {
      if (cancelled) return
      if (!peekCachedBookImageUrl(src)) setPhase('error')
    })

    return () => {
      cancelled = true
    }
  }, [enabled, src])

  return { displaySrc, phase }
}
