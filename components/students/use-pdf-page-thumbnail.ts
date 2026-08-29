'use client'

import { useEffect, useRef, useState } from 'react'
import { getThumbnailDataUrl, peekCachedThumbnailDataUrl } from '@/lib/books/pdf-thumbnail-cache'

export type PdfPageThumbnailPhase = 'idle' | 'loading' | 'ready' | 'error'

export interface UsePdfPageThumbnailArgs {
  fileUrl: string
  unitId: string
  pageNumber: number
  width: number
  pdfReady: boolean
  scrollRoot?: HTMLElement | null
  /** When true, fetch immediately without waiting for intersection. */
  eager?: boolean
}

export function usePdfPageThumbnail({
  fileUrl,
  unitId,
  pageNumber,
  width,
  pdfReady,
  scrollRoot = null,
  eager = false,
}: UsePdfPageThumbnailArgs) {
  const [phase, setPhase] = useState<PdfPageThumbnailPhase>('idle')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const genRef = useRef(0)

  useEffect(() => {
    if (!pdfReady) return

    const gen = ++genRef.current
    const cached = peekCachedThumbnailDataUrl(unitId, pageNumber, width)
    if (cached) {
      setDataUrl(cached)
      setPhase('ready')
      return
    }

    // Clear immediately so a turn never looks "stuck" on the previous page.
    setDataUrl(null)
    setPhase('loading')

    const loadThumbnail = () => {
      void getThumbnailDataUrl(fileUrl, unitId, pageNumber, width)
        .then((url) => {
          if (gen !== genRef.current) return
          setDataUrl(url)
          setPhase('ready')
        })
        .catch(() => {
          if (gen !== genRef.current) return
          setDataUrl(null)
          setPhase('error')
        })
    }

    if (eager) {
      loadThumbnail()
      return
    }

    const el = containerRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        if (!hit) return
        loadThumbnail()
      },
      { root: scrollRoot, rootMargin: '200px 0px', threshold: 0 },
    )
    obs.observe(el)
    return () => {
      obs.disconnect()
    }
  }, [eager, fileUrl, pageNumber, pdfReady, scrollRoot, unitId, width])

  return { containerRef, phase, dataUrl }
}
