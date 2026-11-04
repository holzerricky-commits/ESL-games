'use client'

import { useEffect, useState } from 'react'
import { ScanSearch, X } from 'lucide-react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pdfPageToPrintedPage } from '@/lib/books/page-alignment'
import type { AlignmentCheckpoint } from '@/lib/books/page-alignment-detect'
import { cn } from '@/lib/utils'

const GRID_BATCH = 36

export function groupConsecutivePages(pages: number[]): Array<{ start: number; end: number }> {
  const sorted = [...new Set(pages)].filter((page) => page >= 2).sort((a, b) => a - b)
  const groups: Array<{ start: number; end: number }> = []
  for (const page of sorted) {
    const last = groups[groups.length - 1]
    if (last && page === last.end + 1) last.end = page
    else groups.push({ start: page, end: page })
  }
  return groups
}

export function formatPdfRange(start: number, end: number): string {
  return start === end ? `PDF ${start}` : `PDF ${start}–${end}`
}

/** Sentence describing where printed page 1 sits after skipped PDF pages. */
export function bookAlignmentSummary(notCountedPdfPages: number[]): string {
  const skipped = groupConsecutivePages(notCountedPdfPages)
  if (skipped.length === 0) return 'Printed page 1 is PDF 2.'
  const onlyPrefix = skipped.length === 1 && skipped[0]!.start === 2
  if (onlyPrefix) {
    const firstBookPdf = skipped[0]!.end + 1
    return `Printed page 1 is PDF ${firstBookPdf}. ${formatPdfRange(2, skipped[0]!.end)} have no printed number.`
  }
  const bits = skipped.map((group) => formatPdfRange(group.start, group.end))
  return `These PDF pages have no printed number: ${bits.join(', ')}.`
}

function bookPageLabel(
  pdfPage: number,
  notCountedPdfPages: number[],
  hiddenPdfPages: number[],
): string {
  if (pdfPage === 1) return 'Cover'
  if (hiddenPdfPages.includes(pdfPage)) return 'Hidden'
  const printed = pdfPageToPrintedPage(pdfPage, notCountedPdfPages)
  if (printed == null) return 'No number'
  return String(printed)
}

export function BookAlignMarking({
  pdfPage,
  notCountedPdfPages,
  hiddenPdfPages,
  checkpoints,
  printedDraft,
  errorMessage,
  onPrintedDraft,
  onMatch,
  onToggleNoNumber,
  onToggleHidden,
  onRemoveNotCounted,
  onRemoveHidden,
  onReset,
  onSelectPdfPage,
}: {
  pdfPage: number
  notCountedPdfPages: number[]
  hiddenPdfPages: number[]
  checkpoints: AlignmentCheckpoint[]
  printedDraft: string
  errorMessage: string | null
  onPrintedDraft: (value: string) => void
  onMatch: () => void
  onToggleNoNumber: () => void
  onToggleHidden: () => void
  onRemoveNotCounted: (start: number, end: number) => void
  onRemoveHidden: (pdfPage: number) => void
  onReset: () => void
  onSelectPdfPage: (pdfPage: number) => void
}) {
  const isCover = pdfPage < 2
  const hasNoNumber = !isCover && pdfPageToPrintedPage(pdfPage, notCountedPdfPages) == null
  const isHidden = pdfPage > 1 && hiddenPdfPages.includes(pdfPage)
  const printed = isCover ? null : pdfPageToPrintedPage(pdfPage, notCountedPdfPages)
  const skipped = groupConsecutivePages(notCountedPdfPages)
  const hiddenChips = hiddenPdfPages.filter((page) => page > 1)

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-[var(--surface-3)] px-3 py-3">
      <div>
        <p className="text-[13px] font-semibold tracking-tight text-foreground">Align</p>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
          Click the PDF page that shows a printed number, then enter that number.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Selected</p>
        <p className="text-[15px] font-semibold tabular-nums text-foreground">PDF {pdfPage}</p>
        <p className="text-[12px] text-muted-foreground">
          {isCover
            ? 'The cover has no book page number.'
            : printed != null
              ? `This page is printed page ${printed}.`
              : 'This page has no printed number.'}
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="structure-align-sync-printed" className="text-[12px] text-muted-foreground">
          Printed number on this page
        </Label>
        <div className="flex gap-1.5">
          <Input
            id="structure-align-sync-printed"
            type="number"
            min={1}
            className="h-8 min-w-0 flex-1 tabular-nums"
            placeholder="1"
            value={printedDraft}
            disabled={isCover}
            onChange={(event) => onPrintedDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onMatch()
              }
            }}
            aria-label="Printed page number on this PDF"
          />
          <Button type="button" size="sm" className="h-8 shrink-0" disabled={isCover} onClick={onMatch}>
            Match
          </Button>
        </div>
        {errorMessage ? <p className="text-[11px] leading-snug text-amber-800">{errorMessage}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 justify-start"
          disabled={isCover}
          onClick={onToggleNoNumber}
        >
          {hasNoNumber ? 'Count this page' : 'No printed number'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 justify-start"
          disabled={isCover}
          onClick={onToggleHidden}
        >
          {isHidden ? 'Show in the reader' : 'Hide from the reader'}
        </Button>
      </div>

      <p className="text-[12px] leading-snug text-foreground">{bookAlignmentSummary(notCountedPdfPages)}</p>

      {checkpoints.length > 0 ? (
        <div className="grid gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Check</p>
          <div className="flex flex-wrap gap-1.5">
            {checkpoints.map((checkpoint) => (
              <Button
                key={checkpoint.id}
                type="button"
                variant={checkpoint.pdfPage === pdfPage ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 rounded-full px-2.5 text-[11px]"
                onClick={() => onSelectPdfPage(checkpoint.pdfPage)}
              >
                {checkpoint.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {skipped.length > 0 || hiddenChips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {skipped.map((group) => (
            <span
              key={`${group.start}-${group.end}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] py-0.5 pl-2 pr-0.5 text-[11px] text-foreground"
            >
              {formatPdfRange(group.start, group.end)} · no number
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--surface-3)] hover:text-foreground"
                aria-label={`Count ${formatPdfRange(group.start, group.end)}`}
                onClick={() => onRemoveNotCounted(group.start, group.end)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {hiddenChips.map((page) => (
            <span
              key={`hidden-${page}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] py-0.5 pl-2 pr-0.5 text-[11px] text-foreground"
            >
              PDF {page} · hidden
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--surface-3)] hover:text-foreground"
                aria-label={`Show PDF ${page} in the reader`}
                onClick={() => onRemoveHidden(page)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {notCountedPdfPages.length > 0 ? (
        <Button type="button" variant="ghost" size="sm" className="h-8 justify-start px-2 text-muted-foreground" onClick={onReset}>
          Reset numbering
        </Button>
      ) : null}
    </div>
  )
}

export function BookContentsMarking({
  from,
  to,
  notCountedPdfPages,
  edge,
  scanning,
  statusMessage,
  statusFailed,
  warning,
  onEdge,
  onScan,
}: {
  from: number | null
  to: number | null
  notCountedPdfPages: number[]
  edge: 'from' | 'to'
  scanning: boolean
  statusMessage: string | null
  statusFailed: boolean
  warning: string | null
  onEdge: (edge: 'from' | 'to') => void
  onScan: () => void
}) {
  const printedFrom = from == null ? null : pdfPageToPrintedPage(from, notCountedPdfPages)
  const printedTo = to == null ? null : pdfPageToPrintedPage(to, notCountedPdfPages)
  const pdfLine =
    from == null || to == null ? 'No contents pages yet.' : from === to ? `PDF ${from}` : `PDF ${from}–${to}`
  const printedLine =
    printedFrom != null && printedTo != null
      ? printedFrom === printedTo
        ? `Printed page ${printedFrom}`
        : `Printed pages ${printedFrom}–${printedTo}`
      : null

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-[var(--surface-3)] px-3 py-3">
      <div>
        <p className="text-[13px] font-semibold tracking-tight text-foreground">Contents</p>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
          Click the first contents page, then the last. Highlighted pages are what Extract will read.
        </p>
      </div>
      <div>
        <p className="text-[15px] font-semibold tabular-nums text-foreground">{pdfLine}</p>
        {printedLine ? <p className="text-[12px] text-muted-foreground">{printedLine}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant={edge === 'from' ? 'default' : 'outline'}
          size="sm"
          className="h-8"
          onClick={() => onEdge('from')}
        >
          First page
        </Button>
        <Button
          type="button"
          variant={edge === 'to' ? 'default' : 'outline'}
          size="sm"
          className="h-8"
          onClick={() => onEdge('to')}
        >
          Last page
        </Button>
      </div>
      <p className="text-[12px] leading-snug text-muted-foreground">
        {edge === 'from' ? 'The next click sets the first page.' : 'The next click sets the last page.'}
      </p>
      <Button type="button" variant="outline" size="sm" className="h-8 justify-start gap-1.5" disabled={scanning} onClick={onScan}>
        <ScanSearch size={14} />
        {scanning ? 'Scanning…' : 'Find contents pages'}
      </Button>
      {statusMessage ? (
        <p className={cn('text-[12px] leading-snug', statusFailed ? 'text-amber-800' : 'text-muted-foreground')}>
          {statusMessage}
        </p>
      ) : null}
      {warning ? <p className="text-[12px] leading-snug text-amber-800">{warning}</p> : null}
    </div>
  )
}

export function BookAlignPageGrid({
  fileUrl,
  unitId,
  pdfReady,
  pageCount,
  selectedPdfPage,
  notCountedPdfPages,
  hiddenPdfPages,
  onSelect,
  rangeFrom = null,
  rangeTo = null,
  caption,
}: {
  fileUrl: string
  unitId: string
  pdfReady: boolean
  pageCount: number
  selectedPdfPage: number
  notCountedPdfPages: number[]
  hiddenPdfPages: number[]
  onSelect: (pdfPage: number) => void
  rangeFrom?: number | null
  rangeTo?: number | null
  caption?: string
}) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [limit, setLimit] = useState(GRID_BATCH)
  const shown = Math.min(pageCount, Math.max(limit, selectedPdfPage, rangeTo ?? 0))
  const pages = Array.from({ length: shown }, (_, index) => index + 1)

  useEffect(() => {
    const node = scrollRoot?.querySelector(`[data-align-pdf="${selectedPdfPage}"]`)
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [scrollRoot, selectedPdfPage, shown])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="shrink-0 px-1 text-[12px] tabular-nums text-muted-foreground">
        {caption ?? `PDF ${selectedPdfPage} · ${bookPageLabel(selectedPdfPage, notCountedPdfPages, hiddenPdfPages)}`}
      </p>
      <div ref={setScrollRoot} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md bg-[var(--surface-2)] p-2">
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2"
          style={{ alignContent: 'start', gridAutoRows: 'min-content' }}
        >
          {pages.map((pdfPage) => {
            const label = bookPageLabel(pdfPage, notCountedPdfPages, hiddenPdfPages)
            const selected = pdfPage === selectedPdfPage
            const inRange =
              rangeFrom != null && rangeTo != null && pdfPage >= rangeFrom && pdfPage <= rangeTo
            const dim = label === 'No number' || label === 'Hidden'
            return (
              <button
                key={pdfPage}
                type="button"
                data-align-pdf={pdfPage}
                onClick={() => onSelect(pdfPage)}
                className={cn(
                  'flex flex-col gap-1 self-start rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                  inRange && 'bg-[var(--brand-blue)]/15',
                  selected ? 'ring-2 ring-[var(--brand-blue)]' : 'hover:bg-background/60',
                )}
                aria-pressed={rangeFrom != null ? inRange : selected}
                aria-label={`PDF ${pdfPage}, ${label}`}
              >
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1 / 1.414' }}>
                  <PdfPageThumbnail
                    fileUrl={fileUrl}
                    unitId={unitId}
                    pageNumber={pdfPage}
                    width={180}
                    fitHeight
                    objectFit="contain"
                    scrollRoot={scrollRoot}
                    pdfReady={pdfReady}
                    eager={pdfPage <= 8}
                    label={`PDF ${pdfPage}`}
                    className={cn('absolute inset-0 h-full w-full', dim && 'opacity-55')}
                  />
                </div>
                <span className="flex items-baseline justify-between gap-1 px-0.5">
                  <span className="text-[10px] tabular-nums text-muted-foreground">PDF {pdfPage}</span>
                  <span className="truncate text-[12px] font-semibold tabular-nums text-foreground">{label}</span>
                </span>
              </button>
            )
          })}
        </div>
        {shown < pageCount ? (
          <div className="flex justify-center py-3">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setLimit((value) => value + GRID_BATCH)}>
              Show more pages
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
