'use client'

import { useEffect, useRef, useState } from 'react'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import {
  peekCachedBookImageUrl,
  tryLoadSavedBookImage,
} from '@/lib/books/local-image-cache'
import { persistPageThumbFromDataUrl } from '@/lib/books/persist-page-thumb-client'
import { bookPageThumbUrl, normalizeLibraryRelativePath } from '@/lib/books/persisted-page-thumb-path'
import {
  getThumbnailDataUrl,
  PDF_HERO_THUMB_WIDTH,
  peekCachedThumbnailDataUrl,
} from '@/lib/books/pdf-thumbnail-cache'
import { cn } from '@/lib/utils'

export type PersistedPageThumbPhase = 'idle' | 'loading' | 'ready' | 'error'

export interface PersistedPageThumbnailProps {
  filePath: string
  pageNumber: number
  width?: number
  fitHeight?: boolean
  objectFit?: 'cover' | 'contain'
  scrollRoot?: HTMLElement | null
  label: string
  className?: string
  eager?: boolean
}

function thumbUnitId(filePath: string): string {
  return `persist:${normalizeLibraryRelativePath(filePath)}`
}

export function PersistedPageThumbnail({
  filePath,
  pageNumber,
  width,
  fitHeight = false,
  objectFit = 'cover',
  scrollRoot,
  label,
  className,
  eager = false,
}: PersistedPageThumbnailProps) {
  const savedSrc = bookPageThumbUrl(filePath, pageNumber)
  const renderWidth = width ?? PDF_HERO_THUMB_WIDTH
  const unitId = thumbUnitId(filePath)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(eager)
  const enabled = Boolean(filePath) && (eager || visible)
  const [phase, setPhase] = useState<PersistedPageThumbPhase>(() =>
    enabled && peekCachedBookImageUrl(savedSrc) ? 'ready' : 'idle',
  )
  const [displaySrc, setDisplaySrc] = useState<string | null>(() =>
    enabled ? peekCachedBookImageUrl(savedSrc) ?? null : null,
  )
  const imgFit = fitHeight ? objectFit : 'contain'

  useEffect(() => {
    if (eager) return
    const el = containerRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
      },
      { root: scrollRoot, rootMargin: '200px 0px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [eager, scrollRoot])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const genMemory = peekCachedBookImageUrl(savedSrc)
    if (genMemory) {
      setDisplaySrc(genMemory)
      setPhase('ready')
      return
    }
    const pdfCached = peekCachedThumbnailDataUrl(unitId, pageNumber, renderWidth)
    if (pdfCached) {
      setDisplaySrc(pdfCached)
      setPhase('ready')
      void persistPageThumbFromDataUrl(filePath, pageNumber, pdfCached).catch(() => {})
      return
    }

    setPhase('loading')

    void (async () => {
      try {
        const saved = await tryLoadSavedBookImage(savedSrc)
        if (cancelled) return
        if (saved) {
          setDisplaySrc(saved)
          setPhase('ready')
          return
        }

        await ensureReactPdfWorker()
        if (cancelled) return
        const dataUrl = await getThumbnailDataUrl(
          makeUnitFileUrl(filePath),
          unitId,
          pageNumber,
          renderWidth,
        )
        if (cancelled) return
        setDisplaySrc(dataUrl)
        setPhase('ready')
        void persistPageThumbFromDataUrl(filePath, pageNumber, dataUrl).catch(() => {})
      } catch {
        if (cancelled) return
        setPhase('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, filePath, pageNumber, renderWidth, savedSrc, unitId])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex overflow-hidden rounded-md border border-[#4a3421]/14 bg-[#fcf9f4]',
        fitHeight ? 'h-full w-full min-w-0 shrink' : 'shrink-0',
        className,
      )}
      style={fitHeight || width == null ? undefined : { width, aspectRatio: '1 / 1.414' }}
    >
      {phase === 'loading' ? (
        <div className="absolute inset-0 z-[1] animate-pulse bg-[#c4a574]/22" aria-hidden />
      ) : null}
      {displaySrc && (phase === 'ready' || phase === 'loading') ? (
        // eslint-disable-next-line @next/next/no-img-element -- saved jpeg or pdf.js data URL
        <img
          src={displaySrc}
          alt=""
          className={cn('h-full w-full', imgFit === 'contain' ? 'object-contain' : 'object-cover')}
          draggable={false}
        />
      ) : null}
      {phase === 'error' ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1 text-center">
          <span className="text-[10px] font-medium leading-tight text-[#5c4030]/85">{label}</span>
        </div>
      ) : null}
    </div>
  )
}
