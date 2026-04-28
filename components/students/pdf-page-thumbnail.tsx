'use client'

import { useEffect, useRef, useState } from 'react'
import { getThumbnailDataUrl, PDF_THUMB_WIDTH, peekCachedThumbnailDataUrl } from '@/lib/books/pdf-thumbnail-cache'
import { cn } from '@/lib/utils'

export interface PdfPageThumbnailProps {
  fileUrl: string
  unitId: string
  pageNumber: number
  width?: number
  fitHeight?: boolean
  /** When null or omitted, the observer uses the viewport as root. */
  scrollRoot?: HTMLElement | null
  pdfReady: boolean
  label: string
  className?: string
}

export function PdfPageThumbnail({
  fileUrl,
  unitId,
  pageNumber,
  width = PDF_THUMB_WIDTH,
  fitHeight = false,
  scrollRoot,
  pdfReady,
  label,
  className,
}: PdfPageThumbnailProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const genRef = useRef(0)

  useEffect(() => {
    if (!pdfReady) return
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        if (!hit) return
        const cached = peekCachedThumbnailDataUrl(unitId, pageNumber, width)
        if (cached) {
          setDataUrl(cached)
          setPhase('ready')
          return
        }
        const gen = ++genRef.current
        setPhase('loading')
        void getThumbnailDataUrl(fileUrl, unitId, pageNumber, width)
          .then((url) => {
            if (cancelled || gen !== genRef.current) return
            setDataUrl(url)
            setPhase('ready')
          })
          .catch(() => {
            if (cancelled || gen !== genRef.current) return
            setPhase('error')
          })
      },
      { root: scrollRoot ?? null, rootMargin: '200px 0px', threshold: 0 },
    )
    obs.observe(el)
    return () => {
      cancelled = true
      obs.disconnect()
    }
  }, [fileUrl, unitId, pageNumber, width, scrollRoot, pdfReady])

  useEffect(() => {
    genRef.current += 1
    setPhase('idle')
    setDataUrl(null)
  }, [fileUrl, unitId, pageNumber, width])

  const showErrorFallback = phase === 'error'

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex overflow-hidden rounded-md border border-[#4a3421]/14 bg-[#fcf9f4]',
        fitHeight ? 'h-full w-full min-w-0 shrink' : 'shrink-0',
        className,
      )}
      style={fitHeight ? undefined : { width, aspectRatio: '1 / 1.414' }}
    >
      {phase === 'loading' && pdfReady ? (
        <div className="absolute inset-0 animate-pulse bg-[#c4a574]/22" aria-hidden />
      ) : null}
      {dataUrl && phase === 'ready' ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL from pdf.js canvas
        <img src={dataUrl} alt="" className="h-full w-full object-contain" draggable={false} />
      ) : null}
      {showErrorFallback ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1 text-center">
          <span className="text-[10px] font-medium leading-tight text-[#5c4030]/85">{label}</span>
        </div>
      ) : null}
      {!pdfReady && phase !== 'ready' ? (
        <div className="flex h-full w-full items-center justify-center p-1 text-center">
          <span className="text-[10px] text-[#5c4030]/55">…</span>
        </div>
      ) : null}
    </div>
  )
}
