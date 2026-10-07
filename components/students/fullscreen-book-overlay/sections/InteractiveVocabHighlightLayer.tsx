'use client'

import type { RefObject } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  collectInteractiveVocabTextHits,
  type InteractiveVocabMatchWord,
  type InteractiveVocabTextHit,
} from '@/lib/books/interactive-vocab-text-hits'
import { PDF_TEXT_CONTENT_SELECTOR } from '@/lib/books/pdf-text-selectors'
import { cn } from '@/lib/utils'

type PageHits = {
  pdfPage: number
  hits: InteractiveVocabTextHit[]
}

type InteractiveVocabHighlightLayerProps = {
  words: readonly InteractiveVocabMatchWord[]
  enabled: boolean
  pageNumber: number
  spreadRightPage: number | null
  showSpreadRightPage: boolean
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  pageCanvasHeightPx: number
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  interactive?: boolean
  onVocabHit?: (wordId: string) => void
  /** Pre-computed tap spots from saved vocab data — bypass DOM scanning when present. */
  savedTapSpots?: readonly { wordId: string; word: string; pdfPage: number; x: number; y: number; w: number; h: number }[]
}

function scanPage(
  pageRoot: HTMLDivElement | null,
  pdfPage: number,
  words: readonly InteractiveVocabMatchWord[],
): PageHits | null {
  if (!pageRoot || words.length === 0) return null
  const hits = collectInteractiveVocabTextHits(pageRoot, words)
  if (hits.length === 0) return { pdfPage, hits: [] }
  return { pdfPage, hits }
}

function PageVocabHighlights({
  hits,
  pageWidthPx,
  pageHeightPx,
  interactive,
  onVocabHit,
}: {
  hits: InteractiveVocabTextHit[]
  pageWidthPx: number
  pageHeightPx: number
  interactive: boolean
  onVocabHit?: (wordId: string) => void
}) {
  if (hits.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[42]"
      style={{ width: pageWidthPx, height: pageHeightPx }}
    >
      {hits.map((hit, i) => (
        <button
          key={`${hit.wordId}-${i}-${hit.x.toFixed(3)}-${hit.y.toFixed(3)}`}
          type="button"
          aria-label={`Open vocabulary: ${hit.word}`}
          title={hit.word}
          className={cn(
            'absolute rounded-sm border-b-2 border-sky-500/80 bg-sky-400/25 transition',
            interactive
              ? 'pointer-events-auto cursor-pointer hover:bg-sky-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60'
              : 'pointer-events-none',
          )}
          style={{
            left: `${hit.x * 100}%`,
            top: `${hit.y * 100}%`,
            width: `${hit.w * 100}%`,
            height: `${Math.max(hit.h, 0.012) * 100}%`,
          }}
          onClick={(event) => {
            if (!interactive || !onVocabHit) return
            event.preventDefault()
            event.stopPropagation()
            onVocabHit(hit.wordId)
          }}
          onPointerDown={(event) => {
            if (!interactive) return
            event.preventDefault()
            event.stopPropagation()
          }}
        />
      ))}
    </div>
  )
}

/**
 * Soft on-page highlights for interactive vocab headwords matched against the PDF text layer.
 */
export function InteractiveVocabHighlightLayer({
  words,
  enabled,
  pageNumber,
  spreadRightPage,
  showSpreadRightPage,
  spreadOverlayWidthPx,
  spreadPageWidthPx,
  pageCanvasHeightPx,
  leftPageCaptureRef,
  rightPageCaptureRef,
  interactive = true,
  onVocabHit,
  savedTapSpots,
}: InteractiveVocabHighlightLayerProps) {
  const [leftHits, setLeftHits] = useState<InteractiveVocabTextHit[]>([])
  const [rightHits, setRightHits] = useState<InteractiveVocabTextHit[]>([])

  // Derive hits from saved tap spots when available
  const hasSavedSpots = savedTapSpots != null && savedTapSpots.length > 0

  const rescan = useCallback(() => {
    if (!enabled || words.length === 0) {
      setLeftHits([])
      setRightHits([])
      return
    }
    if (hasSavedSpots && savedTapSpots) {
      // Use pre-computed positions — no DOM scanning needed
      setLeftHits(
        savedTapSpots
          .filter((s) => s.pdfPage === pageNumber)
          .map((s) => ({ wordId: s.wordId, word: s.word, x: s.x, y: s.y, w: s.w, h: s.h })),
      )
      if (showSpreadRightPage && spreadRightPage != null) {
        setRightHits(
          savedTapSpots
            .filter((s) => s.pdfPage === spreadRightPage)
            .map((s) => ({ wordId: s.wordId, word: s.word, x: s.x, y: s.y, w: s.w, h: s.h })),
        )
      } else {
        setRightHits([])
      }
      return
    }
    // Fallback: DOM text layer scanning
    const left = scanPage(leftPageCaptureRef.current, pageNumber, words)
    setLeftHits(left?.hits ?? [])
    if (showSpreadRightPage && spreadRightPage != null) {
      const right = scanPage(rightPageCaptureRef.current, spreadRightPage, words)
      setRightHits(right?.hits ?? [])
    } else {
      setRightHits([])
    }
  }, [
    enabled,
    words,
    pageNumber,
    spreadRightPage,
    showSpreadRightPage,
    leftPageCaptureRef,
    rightPageCaptureRef,
    hasSavedSpots,
    savedTapSpots,
  ])

  useEffect(() => {
    if (!enabled) {
      setLeftHits([])
      setRightHits([])
      return
    }

    let cancelled = false
    let raf = 0
    let debounce = 0
    const schedule = () => {
      clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => {
          if (!cancelled) rescan()
        })
      }, 120)
    }

    schedule()
    // Text layer often appears after first paint.
    const retryTimers = [50, 150, 400, 900].map((ms) => window.setTimeout(schedule, ms))

    const observers: MutationObserver[] = []
    const resizeObservers: ResizeObserver[] = []

    const observeRoot = (root: HTMLDivElement | null) => {
      if (!root) return
      const textLayer = root.querySelector(PDF_TEXT_CONTENT_SELECTOR)
      if (textLayer instanceof Element) {
        const mo = new MutationObserver(schedule)
        mo.observe(textLayer, { childList: true })
        observers.push(mo)
        const ro = new ResizeObserver(schedule)
        ro.observe(textLayer)
        resizeObservers.push(ro)
      }
      const ro = new ResizeObserver(schedule)
      ro.observe(root)
      resizeObservers.push(ro)
    }

    observeRoot(leftPageCaptureRef.current)
    if (showSpreadRightPage) observeRoot(rightPageCaptureRef.current)

    window.addEventListener('resize', schedule)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(debounce)
      for (const t of retryTimers) window.clearTimeout(t)
      for (const o of observers) o.disconnect()
      for (const o of resizeObservers) o.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [
    enabled,
    rescan,
    leftPageCaptureRef,
    rightPageCaptureRef,
    showSpreadRightPage,
    pageNumber,
    spreadRightPage,
    words,
  ])

  if (!enabled) return null
  if (leftHits.length === 0 && rightHits.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[42]"
      style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
      aria-hidden={false}
    >
      <div className="absolute left-0 top-0" style={{ width: spreadPageWidthPx, height: pageCanvasHeightPx }}>
        <PageVocabHighlights
          hits={leftHits}
          pageWidthPx={spreadPageWidthPx}
          pageHeightPx={pageCanvasHeightPx}
          interactive={interactive}
          onVocabHit={onVocabHit}
        />
      </div>
      {showSpreadRightPage && spreadRightPage != null ? (
        <div
          className="absolute top-0"
          style={{ left: spreadPageWidthPx, width: spreadPageWidthPx, height: pageCanvasHeightPx }}
        >
          <PageVocabHighlights
            hits={rightHits}
            pageWidthPx={spreadPageWidthPx}
            pageHeightPx={pageCanvasHeightPx}
            interactive={interactive}
            onVocabHit={onVocabHit}
          />
        </div>
      ) : null}
    </div>
  )
}
