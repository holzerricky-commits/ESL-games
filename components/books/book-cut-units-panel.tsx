'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Scissors, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import {
  computePageGridLayout,
  PAGE_GRID_THUMB_RENDER_WIDTH,
} from '@/lib/books/page-grid-layout'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import {
  buildStackedPdfUnitRanges,
  type StackedPdfCutInput,
} from '@/lib/books/split-stacked-pdf-ranges'
import type { BookLibraryPayload, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

const DEFAULT_PAGE_ASPECT_RATIO = 1 / 1.414

export type BookCutUnitsWorkspaceProps = {
  bookId: string
  sourceFilePath: string
  bookTitle?: string
  onClose: () => void
  onSplitComplete: (payload: {
    library: BookLibraryPayload
    bookId: string
    units: BookUnitRecord[]
  }) => void
}

type CutRow = StackedPdfCutInput & { key: string }

function makeKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8)
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function clampPage(page: number, total: number | null): number {
  const n = Math.max(1, Math.floor(page))
  if (total == null || total < 1) return n
  return Math.min(n, total)
}

/**
 * Full-viewport Cut into units: left control strip + right page-grid canvas.
 * Not a dialog — uses the whole screen so the grid can breathe.
 */
export function BookCutUnitsWorkspace({
  bookId,
  sourceFilePath,
  bookTitle,
  onClose,
  onSplitComplete,
}: BookCutUnitsWorkspaceProps) {
  const [jumpDraft, setJumpDraft] = useState('1')
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pdfReady, setPdfReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cutting, setCutting] = useState(false)
  const [pageAspectRatio, setPageAspectRatio] = useState(DEFAULT_PAGE_ASPECT_RATIO)
  const [cuts, setCuts] = useState<CutRow[]>(() => [
    { key: makeKey(), title: 'Unit 1', startPage: 1 },
  ])

  const canvasRootRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState(() => computePageGridLayout(1200))
  const [focusPage, setFocusPage] = useState(1)

  const fileUrl = useMemo(() => makeUnitFileUrl(sourceFilePath), [sourceFilePath])
  const thumbUnitId = useMemo(
    () => `cut-grid:${sourceFilePath.replaceAll('\\', '/')}`,
    [sourceFilePath],
  )

  useEffect(() => {
    setJumpDraft('1')
    setNumPages(null)
    setLoadError(null)
    setPdfReady(false)
    setPageAspectRatio(DEFAULT_PAGE_ASPECT_RATIO)
    setFocusPage(1)
    setCuts([{ key: makeKey(), title: 'Unit 1', startPage: 1 }])
  }, [sourceFilePath])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await ensureReactPdfWorker()
        if (cancelled) return
        setPdfReady(true)
        const pdf = await loadCachedPdfDocument(fileUrl)
        if (cancelled) return
        setNumPages(pdf.numPages)
        try {
          const first = await pdf.getPage(1)
          const vp = first.getViewport({ scale: 1 })
          if (vp.width > 0 && vp.height > 0) {
            setPageAspectRatio(vp.width / vp.height)
          }
        } catch {
          // keep default aspect
        }
      } catch {
        if (!cancelled) setLoadError('Could not open this PDF.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fileUrl])

  useLayoutEffect(() => {
    const el = canvasRootRef.current
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
  }, [numPages])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || focusPage < 1) return
    const tile = root.querySelector<HTMLElement>(`[data-cut-page="${focusPage}"]`)
    tile?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [focusPage, numPages, layout.cols])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !cutting) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cutting, onClose])

  const pageNumbers = useMemo(() => {
    if (numPages == null || numPages < 1) return []
    return Array.from({ length: numPages }, (_, i) => i + 1)
  }, [numPages])

  const previewedRanges = useMemo(() => {
    if (numPages == null) return null
    return buildStackedPdfUnitRanges(
      cuts.map(({ title, startPage }) => ({ title, startPage })),
      numPages,
    )
  }, [cuts, numPages])

  const cutStarts = useMemo(() => new Set(cuts.map((c) => c.startPage)), [cuts])
  const cutIndexByPage = useMemo(() => {
    const map = new Map<number, number>()
    cuts.forEach((cut, index) => map.set(cut.startPage, index))
    return map
  }, [cuts])

  const aspect = pageAspectRatio > 0.2 && pageAspectRatio < 4 ? pageAspectRatio : DEFAULT_PAGE_ASPECT_RATIO

  function commitJump() {
    const parsed = Math.floor(Number.parseInt(jumpDraft.trim(), 10))
    if (!Number.isFinite(parsed)) {
      setJumpDraft(String(focusPage))
      return
    }
    const next = clampPage(parsed, numPages)
    setJumpDraft(String(next))
    setFocusPage(next)
  }

  function togglePageCut(pdfPage: number) {
    if (pdfPage <= 1) {
      toast.message('Unit 1 already starts on page 1.')
      setFocusPage(1)
      return
    }
    if (cutStarts.has(pdfPage)) {
      setCuts((prev) => prev.filter((row) => row.startPage !== pdfPage))
      setFocusPage(pdfPage)
      return
    }
    setCuts((prev) => {
      const nextTitle = `Unit ${prev.length + 1}`
      const next = [...prev, { key: makeKey(), title: nextTitle, startPage: pdfPage }]
      next.sort((a, b) => a.startPage - b.startPage)
      return next.map((row, i) =>
        i === 0
          ? { ...row, title: row.title.trim() || 'Unit 1', startPage: 1 }
          : { ...row, title: row.title.trim() || `Unit ${i + 1}` },
      )
    })
    setFocusPage(pdfPage)
  }

  function updateTitle(key: string, title: string) {
    setCuts((prev) => prev.map((row) => (row.key === key ? { ...row, title } : row)))
  }

  function removeCut(key: string) {
    setCuts((prev) => {
      const target = prev.find((row) => row.key === key)
      if (!target || target.startPage === 1) return prev
      return prev.filter((row) => row.key !== key)
    })
  }

  const jumpToCut = useCallback((startPage: number) => {
    setFocusPage(startPage)
    setJumpDraft(String(startPage))
  }, [])

  async function runCut() {
    if (cuts.length < 2) {
      toast.error('Mark where Unit 2 starts (and any later units).')
      return
    }
    if (numPages == null) {
      toast.error('Wait for the PDF to finish loading.')
      return
    }
    const ranged = buildStackedPdfUnitRanges(
      cuts.map(({ title, startPage }) => ({ title, startPage })),
      numPages,
    )
    if (!ranged.ok) {
      toast.error(ranged.error)
      return
    }

    setCutting(true)
    try {
      const res = await fetch('/api/books/split-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          sourceFilePath,
          cuts: cuts.map(({ title, startPage }) => ({ title, startPage })),
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            error?: string
            library?: BookLibraryPayload
            bookId?: string
            units?: BookUnitRecord[]
          }
        | null
      if (!res.ok || !data?.ok || !data.library || !data.bookId || !data.units) {
        throw new Error(data?.error || 'Could not cut this PDF.')
      }
      toast.success(`Split into ${data.units.length} unit files.`)
      onSplitComplete({
        library: data.library,
        bookId: data.bookId,
        units: data.units,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not cut this PDF.'
      toast.error(message)
    } finally {
      setCutting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex bg-[var(--surface-1,#0f1115)] text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Cut into units"
    >
      {/* Left control strip */}
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex shrink-0 items-start gap-2 border-b border-[var(--border)] px-3 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0"
            disabled={cutting}
            onClick={onClose}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight">Cut into units</p>
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground" title={bookTitle}>
              {bookTitle || 'Book'}
            </p>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-b border-[var(--border)] px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Jump to page
          </p>
          <div className="flex items-center gap-2">
            <Input
              className="h-9 w-20 px-2 text-center text-sm tabular-nums"
              value={jumpDraft}
              disabled={cutting || numPages == null}
              onChange={(e) => setJumpDraft(e.target.value)}
              onBlur={() => commitJump()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              aria-label="Jump to PDF page"
            />
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {numPages != null ? `/ ${numPages}` : '…'}
            </span>
          </div>
          <p className="text-[12px] leading-snug text-muted-foreground">
            Tap a page on the right to mark (or unmark) where a unit starts. Unit 1 is always page 1.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <p className="mb-2 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Unit cuts · {cuts.length}
          </p>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
            {cuts.map((cut, index) => {
              const range =
                previewedRanges?.ok === true
                  ? previewedRanges.ranges.find((r) => r.index === index)
                  : null
              return (
                <li
                  key={cut.key}
                  className="flex items-start gap-1.5 rounded-xl bg-[var(--surface-3)] px-2 py-2"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      className="h-8 rounded-lg border-0 bg-[var(--surface-2)] text-[13px]"
                      value={cut.title}
                      disabled={cutting}
                      onChange={(e) => updateTitle(cut.key, e.target.value)}
                      aria-label={`Title for unit starting on page ${cut.startPage}`}
                    />
                    <button
                      type="button"
                      className="px-0.5 text-left text-[11px] tabular-nums text-muted-foreground underline-offset-2 hover:underline"
                      disabled={cutting}
                      onClick={() => jumpToCut(cut.startPage)}
                    >
                      PDF {cut.startPage}
                      {range ? ` · ${range.startPage}–${range.endPage}` : ''}
                    </button>
                  </div>
                  {cut.startPage > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground"
                      disabled={cutting}
                      onClick={() => removeCut(cut.key)}
                      aria-label={`Remove cut at page ${cut.startPage}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[10px] font-medium text-muted-foreground">
                      U1
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {previewedRanges && !previewedRanges.ok ? (
            <p className="mt-2 text-[12px] text-amber-800">{previewedRanges.error}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] px-3 py-3">
          <Button
            type="button"
            className="h-10 w-full gap-1.5 rounded-full"
            disabled={cutting || cuts.length < 2 || numPages == null || previewedRanges?.ok === false}
            onClick={() => void runCut()}
          >
            {cutting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            {cutting ? 'Cutting…' : 'Cut book'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full rounded-full"
            disabled={cutting}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </aside>

      {/* Right page canvas */}
      <main ref={canvasRootRef} className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--surface-1,#0f1115)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)]/70 px-4 py-2.5">
          <p className="text-[13px] font-medium text-foreground">Pages</p>
          <p className="text-[12px] text-muted-foreground">
            {numPages != null
              ? `${layout.cols} per row · ${numPages} pages`
              : pdfReady
                ? 'Loading pages…'
                : 'Opening PDF…'}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {loadError ? (
            <p className="p-6 text-sm text-[var(--brand-red)]">{loadError}</p>
          ) : pageNumbers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Loading pages…</p>
          ) : (
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto overscroll-contain"
              style={{ padding: layout.padPx }}
            >
              <div
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                  gap: layout.gapPx,
                }}
                role="list"
                aria-label="PDF pages — tap to mark unit starts"
              >
                {pageNumbers.map((p) => {
                  const isCut = cutStarts.has(p)
                  const unitIndex = cutIndexByPage.get(p)
                  const isFocused = p === focusPage
                  return (
                    <button
                      key={p}
                      type="button"
                      role="listitem"
                      data-cut-page={p}
                      disabled={cutting}
                      aria-pressed={isCut}
                      aria-label={
                        p === 1
                          ? 'Unit 1 starts on page 1'
                          : isCut
                            ? `Remove unit start on page ${p}`
                            : `Mark page ${p} as unit start`
                      }
                      title={
                        p === 1
                          ? 'Unit 1 starts here'
                          : isCut
                            ? 'Tap to remove this unit start'
                            : 'Tap to mark unit start'
                      }
                      onClick={() => togglePageCut(p)}
                      className={cn(
                        'group flex w-full flex-col gap-1.5 rounded-lg p-1.5 text-left outline-none transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/50',
                        isCut
                          ? 'bg-[var(--brand-blue)]/15 ring-1 ring-[var(--brand-blue)]/50'
                          : isFocused
                            ? 'bg-white/8 ring-1 ring-white/20'
                            : 'hover:bg-white/6',
                      )}
                    >
                      <div
                        className="w-full overflow-hidden rounded-md border border-white/10 bg-[#fcf9f4] shadow-sm"
                        style={{ aspectRatio: aspect }}
                      >
                        <PdfPageThumbnail
                          fileUrl={fileUrl}
                          unitId={thumbUnitId}
                          pageNumber={p}
                          width={PAGE_GRID_THUMB_RENDER_WIDTH}
                          fitHeight
                          objectFit="contain"
                          scrollRoot={scrollRoot}
                          pdfReady={pdfReady}
                          label={`Page ${p}`}
                          className="h-full w-full rounded-md border-0"
                        />
                      </div>
                      <span
                        className={cn(
                          'truncate px-0.5 text-center text-[11px] tabular-nums leading-none',
                          isCut ? 'font-semibold text-white' : 'font-medium text-white/55',
                        )}
                      >
                        {p}
                        {unitIndex != null ? ` · U${unitIndex + 1}` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

/** @deprecated Prefer BookCutUnitsWorkspace full-window UI. */
export const BookCutUnitsPanel = BookCutUnitsWorkspace
