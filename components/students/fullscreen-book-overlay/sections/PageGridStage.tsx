'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import {
  computePageGridLayout,
  PAGE_GRID_THUMB_RENDER_WIDTH,
} from '@/lib/books/page-grid-layout'
import {
  mapPdfPageToDisplayLabel,
  type PageNumberingMode,
} from '@/lib/books/page-numbering'
import type { BookLibraryPayload } from '@/lib/books/types'
import { cn } from '@/lib/utils'

export interface PageGridStageProps {
  pageNumbers: number[]
  activeLeftPage: number
  activeRightPage: number | null
  fileUrl: string
  unitId: string
  pdfReady: boolean
  pageAspectRatio: number
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: NonNullable<BookLibraryPayload['books'][number]['units']>[number] | null
  numPages: number | null
  numberingMode: PageNumberingMode
  onSelectPage: (pageNumber: number) => void
  className?: string
}

/**
 * Phase 1 Overview — scrollable multi-page grid for retell. Tap a page to return to the spread.
 */
export function PageGridStage({
  pageNumbers,
  activeLeftPage,
  activeRightPage,
  fileUrl,
  unitId,
  pdfReady,
  pageAspectRatio,
  selectedBook,
  selectedUnit,
  numPages,
  numberingMode,
  onSelectPage,
  className,
}: PageGridStageProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState(() => computePageGridLayout(1100))

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const next = computePageGridLayout(el.clientWidth)
      setLayout((prev) =>
        prev.cols === next.cols && prev.pageWidthPx === next.pageWidthPx ? prev : next,
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setScrollRoot(scrollRef.current)
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const active = root.querySelector<HTMLElement>('[data-page-grid-active="true"]')
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeLeftPage, pageNumbers])

  const aspect = pageAspectRatio > 0.2 && pageAspectRatio < 4 ? pageAspectRatio : 1 / 1.414

  return (
    <div
      ref={rootRef}
      className={cn('absolute inset-0 flex min-h-0 flex-col bg-[#1c1c1f]', className)}
      data-page-grid-stage=""
    >
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ padding: layout.padPx }}
      >
        {pageNumbers.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-white/55">No pages in this unit.</p>
        ) : (
          <div
            className="mx-auto grid w-full"
            style={{
              gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
              gap: layout.gapPx,
              maxWidth: layout.pageWidthPx * layout.cols + layout.gapPx * (layout.cols - 1),
            }}
            role="list"
            aria-label="Book pages overview"
          >
            {pageNumbers.map((p) => {
              const isActive = p === activeLeftPage || p === activeRightPage
              const label = mapPdfPageToDisplayLabel(
                p,
                selectedBook,
                selectedUnit,
                numPages,
                numberingMode,
              )
              return (
                <button
                  key={p}
                  type="button"
                  role="listitem"
                  data-page-grid-active={isActive ? 'true' : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`Open page ${label}`}
                  title={`Open page ${label}`}
                  onClick={() => onSelectPage(p)}
                  className={cn(
                    'group flex w-full flex-col gap-1.5 rounded-lg p-1.5 text-left outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1f]',
                    isActive
                      ? 'bg-white/15 ring-1 ring-white/30'
                      : 'hover:bg-white/10',
                  )}
                >
                  <div
                    className="w-full overflow-hidden rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                    style={{ aspectRatio: aspect }}
                  >
                    <PdfPageThumbnail
                      fileUrl={fileUrl}
                      unitId={unitId}
                      pageNumber={p}
                      width={PAGE_GRID_THUMB_RENDER_WIDTH}
                      fitHeight
                      objectFit="contain"
                      scrollRoot={scrollRoot}
                      pdfReady={pdfReady}
                      label={`Page ${label}`}
                      className="h-full w-full rounded-md border-[#ffffff22] bg-[#fcf9f4]"
                    />
                  </div>
                  <span
                    className={cn(
                      'truncate px-0.5 text-center text-[11px] tabular-nums leading-none',
                      isActive ? 'font-semibold text-white' : 'font-medium text-white/55',
                    )}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
