'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StoryRangeSpreadPreview } from '@/components/books/story-range-spread-preview'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import {
  readingStoryPartKey,
  resolveReadingStoryRange,
  resolveStoryDisplayRangeToPdfPages,
  type ReadingStoryMap,
  type ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import { resolvePartStoryKind } from '@/lib/books/part-structure-tag'
import { resolveTocExtractProfileForBook } from '@/lib/books/toc-extract-profile'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Large enough to read page content at a glance on the prep desk. */
const CONFIRM_THUMB_WIDTH = 260

export type BookPartPagesConfirmLayout = 'card' | 'controls'

export interface BookPartPagesDisplayRange {
  startDisplay: number
  endDisplay: number
}

interface BookPartPagesConfirmProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  partIndex?: number
  /** Quiet type label shown in the card header (e.g. Main story). */
  partTypeLabel?: string | null
  /** Story / part title shown in the card header. */
  partTitle: string
  pdfReady: boolean
  totalPdfPages: number | null
  onPdfNumPages?: (numPages: number) => void
  /** Status chips / actions under Pages (Text, Checks, …). */
  statusSlot?: ReactNode
  /** Open the workshop reader on these pages. */
  onOpenInBook?: () => void
  /**
   * `card` — thumbs + controls (legacy).
   * `controls` — left desk column only (no inline thumbnails).
   */
  layout?: BookPartPagesConfirmLayout
  /**
   * When layout is controls: sit flush in the workbench rail
   * (no card chrome; shell header already shows the title).
   */
  rail?: boolean
  /** Notify parent when the display page range changes (for live right-panel preview). */
  onDisplayRangeChange?: (range: BookPartPagesDisplayRange | null) => void
  /** Fired after the page range is saved (including the quiet outline auto-confirm). */
  onRangeSaved?: () => void
  /** Rail: printed pages on the reader's open spread, for "Use p. N" shortcuts. */
  spreadDisplayPages?: { left: number | null; right: number | null } | null
  className?: string
}

export function BookPartPagesConfirm({
  book,
  unit,
  lesson,
  part,
  partIndex = 0,
  partTypeLabel,
  partTitle,
  pdfReady,
  totalPdfPages,
  onPdfNumPages,
  statusSlot,
  onOpenInBook,
  layout = 'card',
  rail = false,
  onDisplayRangeChange,
  spreadDisplayPages = null,
  onRangeSaved,
  className,
}: BookPartPagesConfirmProps) {
  const controlsOnly = layout === 'controls'
  const story = useMemo<ReadingStoryMap>(() => {
    const kind = resolvePartStoryKind(part, partIndex, resolveTocExtractProfileForBook(book))
    return {
      id: readingStoryPartKey(book.id, unit.id, lesson.id, part.id),
      bookId: book.id,
      unitId: unit.id,
      lessonId: lesson.id,
      partId: part.id,
      title: part.title?.trim() || 'Story',
      kind,
      lessonTitle: lesson.title,
    }
  }, [book, unit.id, lesson.id, lesson.title, part, partIndex])

  const fileUrl = unit.filePath ? makeUnitFileUrl(unit.filePath) : null
  const [override, setOverride] = useState<ReadingStoryRangeOverride | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [startPage, setStartPage] = useState('')
  const [endPage, setEndPage] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const autoAcceptedRef = useRef<string | null>(null)

  const resolved = useMemo(
    () => resolveReadingStoryRange(story, book, unit, totalPdfPages, override),
    [story, book, unit, totalPdfPages, override],
  )

  const hydrateDraftFromResolved = useCallback((range: typeof resolved) => {
    if (range.source === 'none') {
      setStartPage('')
      setEndPage('')
      return
    }
    setStartPage(String(range.startDisplayPage))
    setEndPage(String(range.endDisplayPage))
  }, [])

  const persistRange = useCallback(
    async (start: number, end: number, options?: { quiet?: boolean }) => {
      const quiet = options?.quiet ?? false
      setSaving(true)
      try {
        const res = await fetch('/api/reading-stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyId: story.id,
            bookId: story.bookId,
            unitId: story.unitId,
            lessonId: story.lessonId,
            partId: story.partId,
            title: story.title,
            startPage: Math.min(start, end),
            endPage: Math.max(start, end),
            rangeConfirmed: true,
          }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          override?: ReadingStoryRangeOverride
        }
        if (!res.ok || !data.ok || !data.override) {
          throw new Error(data.error || 'Could not save pages')
        }
        setOverride(data.override)
        hydrateDraftFromResolved(
          resolveReadingStoryRange(story, book, unit, totalPdfPages, data.override),
        )
        setEditing(false)
        onRangeSaved?.()
        if (!quiet) toast.success('Pages saved')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save pages'
        if (!quiet) toast.error(message)
        throw err
      } finally {
        setSaving(false)
      }
    },
    [story, book, unit, totalPdfPages, hydrateDraftFromResolved, onRangeSaved],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const res = await fetch(
          `/api/reading-stories?bookId=${encodeURIComponent(book.id)}&unitId=${encodeURIComponent(unit.id)}`,
        )
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          overrides?: ReadingStoryRangeOverride[]
        }
        if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load pages')
        if (cancelled) return
        const match =
          data.overrides?.find(
            (row) =>
              row.storyId === story.id ||
              (row.partId != null && row.partId === part.id && row.lessonId === lesson.id),
          ) ?? null
        setOverride(match)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load pages')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [book.id, unit.id, story.id, part.id, lesson.id])

  useEffect(() => {
    if (loading || loadError) return
    hydrateDraftFromResolved(resolved)
  }, [loading, loadError, resolved, hydrateDraftFromResolved])

  useEffect(() => {
    if (loading || loadError || editing || saving) return
    if (resolved.source === 'none') return
    if (override?.rangeConfirmed) return
    const key = `${story.id}:${resolved.startDisplayPage}-${resolved.endDisplayPage}`
    if (autoAcceptedRef.current === key) return
    autoAcceptedRef.current = key
    void persistRange(resolved.startDisplayPage, resolved.endDisplayPage, { quiet: true }).catch(() => {
      autoAcceptedRef.current = null
    })
  }, [
    loading,
    loadError,
    editing,
    saving,
    resolved,
    override?.rangeConfirmed,
    story.id,
    persistRange,
  ])

  const draftStart = Math.floor(Number(startPage))
  const draftEnd = Math.floor(Number(endPage))
  const hasDraftRange =
    Number.isFinite(draftStart) &&
    Number.isFinite(draftEnd) &&
    draftStart >= 1 &&
    draftEnd >= 1

  useEffect(() => {
    if (!onDisplayRangeChange) return
    if (loading || loadError || !hasDraftRange) {
      onDisplayRangeChange(null)
      return
    }
    onDisplayRangeChange({
      startDisplay: Math.min(draftStart, draftEnd),
      endDisplay: Math.max(draftStart, draftEnd),
    })
  }, [
    onDisplayRangeChange,
    loading,
    loadError,
    hasDraftRange,
    draftStart,
    draftEnd,
  ])

  const livePdf = useMemo(() => {
    if (!hasDraftRange) return null
    return resolveStoryDisplayRangeToPdfPages(
      book,
      unit,
      totalPdfPages,
      Math.min(draftStart, draftEnd),
      Math.max(draftStart, draftEnd),
    )
  }, [hasDraftRange, draftStart, draftEnd, book, unit, totalPdfPages])

  async function saveEdits() {
    if (!hasDraftRange) {
      toast.error('Enter start and end pages')
      return
    }
    await persistRange(draftStart, draftEnd)
  }

  const rangeLabel = hasDraftRange
    ? `${Math.min(draftStart, draftEnd)}–${Math.max(draftStart, draftEnd)}`
    : '—'

  const titleBlock = (
    <div className="space-y-1">
      {partTypeLabel ? (
        <p className="text-[13px] font-medium text-muted-foreground">{partTypeLabel}</p>
      ) : null}
      <h3 className="text-[24px] font-semibold leading-snug tracking-tight text-foreground md:text-[28px]">
        {partTitle}
      </h3>
    </div>
  )

  const pagesControls = (
    <div className={cn('space-y-2', rail && 'space-y-1.5')}>
      <p className={cn('font-medium text-muted-foreground', rail ? 'text-[12px]' : 'text-[13px]')}>
        Pages
      </p>
      {!editing ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2',
            !rail && !controlsOnly && 'justify-center gap-3 lg:justify-start',
          )}
        >
          <p
            className={cn(
              'font-semibold tabular-nums tracking-tight text-foreground',
              rail ? 'text-[18px]' : 'text-[22px]',
            )}
          >
            {rangeLabel}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cn('rounded-full px-3', rail ? 'h-8' : 'h-9 px-4')}
            disabled={!hasDraftRange}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          {onOpenInBook ? (
            <Button
              type="button"
              size="sm"
              variant={rail ? 'outline' : 'default'}
              className={cn('rounded-full px-3', rail ? 'h-8' : 'h-9 px-4')}
              disabled={!hasDraftRange || !fileUrl}
              onClick={onOpenInBook}
            >
              Open book
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={cn('w-full space-y-3', !controlsOnly && !rail && 'mx-auto max-w-sm space-y-4 lg:mx-0')}>
          <div
            className={cn(
              'flex flex-wrap items-end gap-2',
              !rail && !controlsOnly && 'justify-center gap-3 lg:justify-start',
            )}
          >
            <div className="space-y-1">
              <Label htmlFor={`part-shell-start-${part.id}`} className="text-[11px] text-muted-foreground">
                Start
              </Label>
              <Input
                id={`part-shell-start-${part.id}`}
                className={cn(
                  'w-20 border-0 bg-[var(--surface-3)] text-center font-semibold tabular-nums shadow-none',
                  rail ? 'h-9 rounded-lg text-[14px]' : 'h-11 w-24 rounded-xl text-[16px]',
                )}
                inputMode="numeric"
                value={startPage}
                onChange={(e) => setStartPage(e.target.value)}
              />
            </div>
            <span className={cn('text-muted-foreground', rail ? 'pb-2 text-[14px]' : 'pb-2.5 text-[16px]')} aria-hidden>
              –
            </span>
            <div className="space-y-1">
              <Label htmlFor={`part-shell-end-${part.id}`} className="text-[11px] text-muted-foreground">
                End
              </Label>
              <Input
                id={`part-shell-end-${part.id}`}
                className={cn(
                  'w-20 border-0 bg-[var(--surface-3)] text-center font-semibold tabular-nums shadow-none',
                  rail ? 'h-9 rounded-lg text-[14px]' : 'h-11 w-24 rounded-xl text-[16px]',
                )}
                inputMode="numeric"
                value={endPage}
                onChange={(e) => setEndPage(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className={cn('rounded-full px-4', rail ? 'h-8' : 'h-10 px-5')}
              disabled={saving || !fileUrl}
              onClick={() => void saveEdits()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn('rounded-full px-3', rail ? 'h-8' : 'h-10')}
              disabled={saving}
              onClick={() => {
                hydrateDraftFromResolved(resolved)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      <p className={cn('leading-relaxed text-muted-foreground', rail ? 'text-[12px]' : 'text-[14px]')}>
        From the outline — edit if wrong
      </p>
    </div>
  )

  if (loading) {
    if (controlsOnly) {
      return (
        <div
          className={cn(
            rail
              ? 'space-y-2'
              : 'rounded-[28px] bg-[var(--surface-2)] p-6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:p-8',
            className,
          )}
        >
          {rail ? null : titleBlock}
          <p className={cn('text-muted-foreground', rail ? 'text-[13px]' : 'mt-4 text-[14px]')}>
            Loading pages…
          </p>
        </div>
      )
    }
    return (
      <div
        className={cn(
          'rounded-[28px] bg-[var(--surface-2)] px-6 py-8 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:px-8 lg:px-10',
          className,
        )}
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <div
            className="mx-auto shrink-0 animate-pulse rounded-2xl bg-[var(--surface-3)] lg:mx-0"
            style={{
              width: CONFIRM_THUMB_WIDTH * 2 + 8 + 44 * 2 + 24,
              height: Math.round(CONFIRM_THUMB_WIDTH * 1.414),
            }}
          />
          <div className="min-w-0 flex-1 space-y-2 text-center lg:pt-1 lg:text-left">
            {partTypeLabel ? (
              <p className="text-[13px] font-medium text-muted-foreground">{partTypeLabel}</p>
            ) : null}
            <h3 className="text-[24px] font-semibold tracking-tight text-foreground md:text-[28px]">{partTitle}</h3>
            <p className="text-[14px] text-muted-foreground">Loading pages…</p>
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    if (controlsOnly) {
      return (
        <div
          className={cn(
            rail
              ? 'space-y-2'
              : 'rounded-[28px] bg-[var(--surface-2)] p-6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:p-8',
            className,
          )}
        >
          {rail ? null : titleBlock}
          <p className={cn('text-destructive', rail ? 'text-[13px]' : 'mt-4 text-[14px]')}>{loadError}</p>
        </div>
      )
    }
    return (
      <div
        className={cn(
          'rounded-[28px] bg-[var(--surface-2)] px-6 py-8 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:px-8 lg:px-10',
          className,
        )}
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <div
            className="mx-auto flex shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-3)] text-[14px] text-muted-foreground lg:mx-0"
            style={{
              width: CONFIRM_THUMB_WIDTH * 2 + 8 + 44 * 2 + 24,
              minHeight: Math.round(CONFIRM_THUMB_WIDTH * 1.414),
            }}
          >
            No preview
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-center lg:pt-1 lg:text-left">
            {partTypeLabel ? (
              <p className="text-[13px] font-medium text-muted-foreground">{partTypeLabel}</p>
            ) : null}
            <h3 className="text-[24px] font-semibold tracking-tight text-foreground md:text-[28px]">{partTitle}</h3>
            <p className="text-[14px] text-destructive">{loadError}</p>
          </div>
        </div>
      </div>
    )
  }

  if (controlsOnly && rail) {
    const savedStart = resolved.source !== 'none' ? resolved.startDisplayPage : null
    const savedEnd = resolved.source !== 'none' ? resolved.endDisplayPage : null
    const dirty = hasDraftRange
      ? Math.min(draftStart, draftEnd) !== savedStart || Math.max(draftStart, draftEnd) !== savedEnd
      : false
    const pageCount = hasDraftRange ? Math.abs(draftEnd - draftStart) + 1 : null
    const spreadLeft = spreadDisplayPages?.left ?? spreadDisplayPages?.right ?? null
    const spreadRight = spreadDisplayPages?.right ?? spreadDisplayPages?.left ?? null

    const field = (args: {
      id: string
      label: string
      value: string
      onChange: (value: string) => void
      spreadPage: number | null
    }) => (
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={args.id} className="text-[11px] font-medium text-muted-foreground">
          {args.label}
        </Label>
        <Input
          id={args.id}
          className="h-9 rounded-lg border-0 bg-[var(--surface-3)] text-center text-[15px] font-semibold tabular-nums shadow-none"
          inputMode="numeric"
          value={args.value}
          onChange={(e) => {
            args.onChange(e.target.value)
            setEditing(true)
          }}
          disabled={saving}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-full rounded-lg px-2 text-[12px] text-muted-foreground hover:text-foreground"
          disabled={saving || args.spreadPage == null}
          onClick={() => {
            if (args.spreadPage == null) return
            args.onChange(String(args.spreadPage))
            setEditing(true)
          }}
        >
          {args.spreadPage != null ? `Use p. ${args.spreadPage}` : 'Use this spread'}
        </Button>
      </div>
    )

    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <div className="space-y-0.5">
          <p className="text-[22px] font-semibold tabular-nums tracking-tight text-foreground">{rangeLabel}</p>
          <p className="text-[12px] text-muted-foreground">
            {pageCount != null ? `${pageCount} printed page${pageCount === 1 ? '' : 's'}` : 'No pages set'}
            {dirty ? ' · unsaved' : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {field({
            id: `part-shell-start-${part.id}`,
            label: 'Start',
            value: startPage,
            onChange: setStartPage,
            spreadPage: spreadLeft,
          })}
          {field({
            id: `part-shell-end-${part.id}`,
            label: 'End',
            value: endPage,
            onChange: setEndPage,
            spreadPage: spreadRight,
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg px-4"
            disabled={!dirty || saving || !fileUrl}
            onClick={() => void saveEdits()}
          >
            {saving ? 'Saving…' : 'Save pages'}
          </Button>
          {dirty ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg px-3"
              disabled={saving}
              onClick={() => {
                hydrateDraftFromResolved(resolved)
                setEditing(false)
              }}
            >
              Reset
            </Button>
          ) : null}
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Turn the book to the story&apos;s first or last page, then use the page buttons above.
        </p>
      </div>
    )
  }

  if (controlsOnly) {
    return (
      <div
        className={cn(
          'flex h-full flex-col gap-6 rounded-[28px] bg-[var(--surface-2)] p-6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:p-8',
          className,
        )}
      >
        {titleBlock}
        {pagesControls}
        {statusSlot ? <div className="mt-auto pt-2">{statusSlot}</div> : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-[28px] bg-[var(--surface-2)] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)]',
        className,
      )}
    >
      <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-stretch lg:gap-10 lg:p-10">
        <div className="mx-auto shrink-0 lg:mx-0">
          {fileUrl && hasDraftRange && livePdf ? (
            <StoryRangeSpreadPreview
              fileUrl={fileUrl}
              unitId={unit.id}
              book={book}
              unit={unit}
              pdfReady={pdfReady}
              totalPdfPages={totalPdfPages}
              startPdfPage={livePdf.startPdfPage}
              endPdfPage={livePdf.endPdfPage}
              rangeStartDisplay={draftStart}
              rangeEndDisplay={draftEnd}
              thumbWidth={CONFIRM_THUMB_WIDTH}
              size="lg"
              showCounterLabel
              onPdfNumPages={onPdfNumPages}
              onRangeChange={(startDisplay, endDisplay) => {
                setStartPage(String(startDisplay))
                setEndPage(String(endDisplay))
                setEditing(true)
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-2xl bg-[var(--surface-3)] text-[14px] text-muted-foreground"
              style={{
                width: CONFIRM_THUMB_WIDTH * 2 + 8 + 44 * 2 + 24,
                minHeight: Math.round(CONFIRM_THUMB_WIDTH * 1.414),
              }}
            >
              No preview
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-6 text-center lg:pt-1 lg:text-left">
          {titleBlock}
          {pagesControls}
          {statusSlot ? <div className="mt-auto pt-4">{statusSlot}</div> : null}
        </div>
      </div>
    </div>
  )
}
