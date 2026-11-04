'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import {
  computePageGridLayout,
  PAGE_GRID_THUMB_RENDER_WIDTH,
  type PageGridLayoutOptions,
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
  /** Override auto-fit density (e.g. denser start-picker grids). */
  layoutOptions?: PageGridLayoutOptions
  /** PDF render width for tiles; keep stable across resize. */
  thumbRenderWidth?: number
  /** Tighter tile chrome for dense scan grids. */
  compactTiles?: boolean
  /** Student’s current place (PDF page in this unit) — distinct from selection. */
  herePage?: number | null
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
  layoutOptions,
  thumbRenderWidth = PAGE_GRID_THUMB_RENDER_WIDTH,
  compactTiles = false,
  herePage = null,
}: PageGridStageProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState(() => computePageGridLayout(1100, layoutOptions))

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const next = computePageGridLayout(el.clientWidth, layoutOptions)
      setLayout((prev) =>
        prev.cols === next.cols &&
        prev.pageWidthPx === next.pageWidthPx &&
        prev.gapPx === next.gapPx &&
        prev.padPx === next.padPx
          ? prev
          : next,
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layoutOptions])

  useEffect(() => {
    setScrollRoot(scrollRef.current)
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const target =
      root.querySelector<HTMLElement>('[data-page-grid-active="true"]') ??
      root.querySelector<HTMLElement>('[data-page-grid-here="true"]')
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeLeftPage, herePage, pageNumbers])

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
              const isHere = herePage != null && p === herePage
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
                  data-page-grid-here={isHere ? 'true' : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={isHere ? `Page ${label}, current place` : `Open page ${label}`}
                  title={isHere ? `Here · page ${label}` : `Open page ${label}`}
                  onClick={() => onSelectPage(p)}
                  className={cn(
                    'group relative flex w-full flex-col text-left outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1f]',
                    compactTiles ? 'gap-1 rounded-md p-1' : 'gap-1.5 rounded-lg p-1.5',
                    isHere
                      ? 'bg-amber-300 ring-2 ring-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.9)]'
                      : isActive
                        ? 'bg-white/15 ring-1 ring-white/30'
                        : 'hover:bg-white/10',
                  )}
                >
                  {isHere ? (
                    <span className="absolute right-1 top-1 z-[1] rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black shadow-sm">
                      Here
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'w-full overflow-hidden rounded-md',
                      isHere
                        ? 'ring-2 ring-amber-500/80 shadow-[0_4px_16px_rgba(245,158,11,0.45)]'
                        : compactTiles
                          ? 'shadow-[0_4px_12px_rgba(0,0,0,0.28)]'
                          : 'shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
                    )}
                    style={{ aspectRatio: aspect }}
                  >
                    <PdfPageThumbnail
                      fileUrl={fileUrl}
                      unitId={unitId}
                      pageNumber={p}
                      width={thumbRenderWidth}
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
                      'truncate px-0.5 text-center tabular-nums leading-none',
                      compactTiles ? 'text-[10px]' : 'text-[11px]',
                      isHere
                        ? 'font-bold text-amber-950'
                        : isActive
                          ? 'font-semibold text-white'
                          : 'font-medium text-white/55',
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
