'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { BookOpen, ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { SpreadPageCluster } from '@/components/books/spread-page-cluster'
import { Button } from '@/components/ui/button'
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { getEffectivePageTotal, mapPdfSpreadToDisplayLabel } from '@/lib/books/page-numbering'
import { clampPdfPageToVisible, getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import { resolveSpreadGutterPullRatio } from '@/lib/books/spread-gutter'
import {
  computeSpreadClusterMetrics,
  computeSpreadFitScale,
  computeSpreadPageWidth,
} from '@/lib/books/spread-viewport-layout'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const
const DEFAULT_PAGE_ASPECT_RATIO = 1 / 1.414

export interface BookBrowseSpreadPreviewProps {
  open: boolean
  onClose: () => void
  fileUrl: string
  pdfReady: boolean
  book: BookRecord
  unit: BookUnitRecord
  units: BookUnitRecord[]
  onSelectUnit: (unitId: string) => void
  pageNumber: number
  totalPdfPages: number | null
  onDocumentLoad: (numPages: number) => void
  onPageChange: (page: number) => void
}

export function BookBrowseSpreadPreview({
  open,
  onClose,
  fileUrl,
  pdfReady,
  book,
  unit,
  units,
  onSelectUnit,
  pageNumber,
  totalPdfPages,
  onDocumentLoad,
  onPageChange,
}: BookBrowseSpreadPreviewProps) {
  const [pageAspectRatio, setPageAspectRatio] = useState(DEFAULT_PAGE_ASPECT_RATIO)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const viewportRoRef = useRef<ResizeObserver | null>(null)

  const attachViewport = useCallback((el: HTMLDivElement | null) => {
    viewportRoRef.current?.disconnect()
    viewportRoRef.current = null
    if (!el) {
      setViewportSize({ w: 0, h: 0 })
      return
    }
    const sync = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!(w > 0) || !(h > 0)) return
      setViewportSize({ w, h })
    }
    sync()
    requestAnimationFrame(sync)
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    viewportRoRef.current = ro
  }, [])

  useEffect(
    () => () => {
      viewportRoRef.current?.disconnect()
      viewportRoRef.current = null
    },
    [],
  )

  useEffect(() => {
    setPageAspectRatio(DEFAULT_PAGE_ASPECT_RATIO)
  }, [fileUrl])

  const bounds = useMemo(
    () => getUnitReaderBounds(unit, totalPdfPages, book),
    [unit, totalPdfPages, book],
  )
  const visiblePages = useMemo(
    () => getVisiblePdfPages(unit, totalPdfPages, book),
    [unit, totalPdfPages, book],
  )

  const leftPage = useMemo(() => {
    if (visiblePages.length) {
      const idx = Math.max(0, visiblePages.indexOf(pageNumber))
      return visiblePages[idx] ?? visiblePages[0]!
    }
    return clampPdfPageToVisible(pageNumber, visiblePages, bounds)
  }, [pageNumber, visiblePages, bounds])

  const rightPage = useMemo(() => {
    if (!visiblePages.length) {
      if (totalPdfPages != null && leftPage < totalPdfPages) return leftPage + 1
      return null
    }
    const idx = Math.max(0, visiblePages.indexOf(leftPage))
    return visiblePages[idx + 1] ?? null
  }, [leftPage, visiblePages, totalPdfPages])

  const atStart = visiblePages.length
    ? visiblePages.indexOf(leftPage) <= 0
    : leftPage <= bounds.min
  const atEnd = visiblePages.length
    ? visiblePages.indexOf(leftPage) >= visiblePages.length - 1
    : totalPdfPages != null
      ? leftPage >= bounds.max
      : false

  const goToSpread = useCallback(
    (direction: -1 | 1) => {
      if (!visiblePages.length) {
        onPageChange(Math.max(bounds.min, leftPage + direction * 2))
        return
      }
      const currentIndex = Math.max(0, visiblePages.indexOf(leftPage))
      const nextIndex = Math.max(0, Math.min(currentIndex + direction * 2, visiblePages.length - 1))
      onPageChange(visiblePages[nextIndex] ?? leftPage)
    },
    [visiblePages, leftPage, bounds.min, onPageChange],
  )

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }
      if (event.key === 'ArrowLeft') {
        if (atStart) return
        event.preventDefault()
        goToSpread(-1)
        return
      }
      if (event.key === 'ArrowRight') {
        if (atEnd) return
        event.preventDefault()
        goToSpread(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, atStart, atEnd, goToSpread])

  const gutterPullRatio = useMemo(
    () => resolveSpreadGutterPullRatio(book, unit.filePath),
    [book, unit.filePath],
  )

  const spreadPageWidth = useMemo(() => {
    const { w, h } = viewportSize
    if (!(w > 0) || !(h > 0)) return 320
    return computeSpreadPageWidth(w, h, pageAspectRatio, 1, false)
  }, [viewportSize, pageAspectRatio])

  const cluster = useMemo(
    () => computeSpreadClusterMetrics(spreadPageWidth, pageAspectRatio, gutterPullRatio),
    [spreadPageWidth, pageAspectRatio, gutterPullRatio],
  )

  const fitScale = useMemo(
    () =>
      computeSpreadFitScale(
        viewportSize.w,
        viewportSize.h,
        cluster.spreadOverlayWidthPx,
        cluster.pageCanvasHeightPx,
        false,
      ),
    [viewportSize, cluster.spreadOverlayWidthPx, cluster.pageCanvasHeightPx],
  )

  const onPageLoadSuccess = useCallback(
    (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
      const ow = page.originalWidth ?? page.width
      const oh = page.originalHeight ?? page.height
      if (!(ow > 0) || !(oh > 0)) return
      const ratio = ow / oh
      if (Number.isFinite(ratio) && ratio > 0) setPageAspectRatio(ratio)
    },
    [],
  )

  const spreadLabel = mapPdfSpreadToDisplayLabel(leftPage, rightPage, book, unit, totalPdfPages)
  const countedTotal = getEffectivePageTotal(book, unit, totalPdfPages)
  const showUnits = units.length > 1

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-[var(--surface-2)]" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-[var(--surface-2)] outline-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">{book.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Two-page book preview. Use the arrows or keyboard to turn pages. Escape to close.
          </DialogPrimitive.Description>

        <div className="relative flex h-10 shrink-0 items-center justify-center gap-2 px-12">
            {showUnits ? (
              <label className="sr-only" htmlFor="book-browse-unit">
                Unit
              </label>
            ) : null}
            {showUnits ? (
              <select
                id="book-browse-unit"
                className="h-7 max-w-[14rem] truncate rounded-full border-0 bg-[var(--surface-3)] px-2.5 text-[12px] text-foreground"
                value={unit.id}
                onChange={(event) => onSelectUnit(event.target.value)}
              >
                {units.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            ) : null}
          <div className="flex items-center justify-center gap-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={atStart}
              onClick={() => goToSpread(-1)}
              aria-label="Previous pages"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[8rem] px-1 text-center text-xs tabular-nums text-muted-foreground">
              {spreadLabel}
              {totalPdfPages != null ? ` / ${countedTotal}` : ''}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={atEnd}
              onClick={() => goToSpread(1)}
              aria-label="Next pages"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-2 top-1 h-8 w-8"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!pdfReady ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading PDF tools…
          </div>
        ) : (
          <PdfDocument
            key={fileUrl}
            file={fileUrl}
            options={PDF_DOCUMENT_OPTIONS}
            loading={<p className="p-4 text-center text-sm text-muted-foreground">Opening book…</p>}
            error={<p className="p-4 text-center text-sm text-[var(--brand-red)]">Could not open this PDF.</p>}
            onLoadSuccess={(meta) => onDocumentLoad(meta.numPages)}
            className="flex min-h-0 w-full flex-1 flex-col"
          >
            <div
              ref={attachViewport}
              className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-3 pb-3"
            >
              <div
                className="relative flex w-max max-w-full items-center justify-center leading-none"
                style={{
                  transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
                  transformOrigin: 'center center',
                }}
              >
                <SpreadPageCluster
                  spreadOverlayWidthPx={cluster.spreadOverlayWidthPx}
                  pageCanvasHeightPx={cluster.pageCanvasHeightPx}
                  spreadPageWidthPx={spreadPageWidth}
                  gutterPullPx={cluster.gutterPullPx}
                  showBookFrame={false}
                  leftPage={
                    <PdfPage
                      pageNumber={leftPage}
                      width={spreadPageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onLoadSuccess={onPageLoadSuccess}
                    />
                  }
                  rightPage={
                    rightPage != null ? (
                      <PdfPage
                        pageNumber={rightPage}
                        width={spreadPageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={onPageLoadSuccess}
                      />
                    ) : null
                  }
                />
              </div>
            </div>
          </PdfDocument>
        )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

/** Frosted corner control — visible on hover (always on touch). */
export function BookBrowseCornerButton({
  onClick,
  label,
  className,
  icon = 'book',
  placement = 'top-right',
  hoverScope = 'group',
}: {
  onClick: () => void
  label: string
  className?: string
  icon?: 'book' | 'fullscreen'
  placement?: 'top-right' | 'bottom-right'
  /** Which ancestor `group/*` triggers hover reveal. */
  hoverScope?: 'group' | 'page'
}) {
  const Icon = icon === 'fullscreen' ? Maximize2 : BookOpen
  const hoverReveal =
    hoverScope === 'page'
      ? 'group-hover/page:opacity-100 group-focus-within/page:opacity-100'
      : 'group-hover:opacity-100 group-focus-within:opacity-100'

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'chrome-icon-btn absolute z-20 h-8 w-8',
        placement === 'bottom-right' ? 'bottom-2 right-2' : 'right-1.5 top-1.5',
        'bg-[var(--chrome-frost)] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md',
        'ring-1 ring-[var(--chrome-frost-border)]',
        'opacity-0 transition-opacity duration-[var(--chrome-duration)] ease-[var(--chrome-ease)]',
        hoverReveal,
        '[@media(hover:none)]:opacity-100',
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
    </button>
  )
}

