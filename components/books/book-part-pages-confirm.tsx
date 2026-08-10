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
import { effectivePartStructureTag } from '@/lib/books/part-structure-tag'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import type { ReactNode } from 'react'

/** Large enough to read page content at a glance on the prep desk. */
const CONFIRM_THUMB_WIDTH = 260

interface BookPartPagesConfirmProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  /** Quiet type label shown in the card header (e.g. Main story). */
  partTypeLabel?: string | null
  /** Story / part title shown in the card header. */
  partTitle: string
  pdfReady: boolean
  totalPdfPages: number | null
  onPdfNumPages?: (numPages: number) => void
  /** Status chips / actions under Pages (Text, Checks, …). */
  statusSlot?: ReactNode
}

export function BookPartPagesConfirm({
  book,
  unit,
  lesson,
  part,
  partTypeLabel,
  partTitle,
  pdfReady,
  totalPdfPages,
  onPdfNumPages,
  statusSlot,
}: BookPartPagesConfirmProps) {
  const story = useMemo<ReadingStoryMap>(() => {
    const tag = effectivePartStructureTag(part)
    return {
      id: readingStoryPartKey(book.id, unit.id, lesson.id, part.id),
      bookId: book.id,
      unitId: unit.id,
      lessonId: lesson.id,
      partId: part.id,
      title: part.title?.trim() || 'Story',
      kind: tag === 'paired_story' ? 'paired_story' : tag === 'main_story' ? 'main_story' : undefined,
      lessonTitle: lesson.title,
    }
  }, [book.id, unit.id, lesson.id, lesson.title, part])

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
        if (!quiet) toast.success('Pages saved')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save pages'
        if (!quiet) toast.error(message)
        throw err
      } finally {
        setSaving(false)
      }
    },
    [story, book, unit, totalPdfPages, hydrateDraftFromResolved],
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

  if (loading) {
    return (
      <div className="rounded-[28px] bg-[var(--surface-2)] px-6 py-8 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:px-8 lg:px-10">
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
    return (
      <div className="rounded-[28px] bg-[var(--surface-2)] px-6 py-8 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:px-8 lg:px-10">
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

  return (
    <div className="overflow-hidden rounded-[28px] bg-[var(--surface-2)] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)]">
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
              showCounterLabel={false}
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
          <div className="space-y-1">
            {partTypeLabel ? (
              <p className="text-[13px] font-medium text-muted-foreground">{partTypeLabel}</p>
            ) : null}
            <h3 className="text-[24px] font-semibold leading-snug tracking-tight text-foreground md:text-[28px]">
              {partTitle}
            </h3>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-medium text-muted-foreground">Pages</p>
            {!editing ? (
              <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <p className="text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
                  {rangeLabel}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 rounded-full px-4"
                  disabled={!hasDraftRange}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-sm space-y-4 lg:mx-0">
                <div className="flex flex-wrap items-end justify-center gap-3 lg:justify-start">
                  <div className="space-y-1.5">
                    <Label htmlFor={`part-shell-start-${part.id}`} className="text-[12px] text-muted-foreground">
                      Start
                    </Label>
                    <Input
                      id={`part-shell-start-${part.id}`}
                      className="h-11 w-24 rounded-xl border-0 bg-[var(--surface-3)] text-center text-[16px] font-semibold tabular-nums shadow-none"
                      inputMode="numeric"
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value)}
                    />
                  </div>
                  <span className="pb-2.5 text-[16px] text-muted-foreground" aria-hidden>
                    –
                  </span>
                  <div className="space-y-1.5">
                    <Label htmlFor={`part-shell-end-${part.id}`} className="text-[12px] text-muted-foreground">
                      End
                    </Label>
                    <Input
                      id={`part-shell-end-${part.id}`}
                      className="h-11 w-24 rounded-xl border-0 bg-[var(--surface-3)] text-center text-[16px] font-semibold tabular-nums shadow-none"
                      inputMode="numeric"
                      value={endPage}
                      onChange={(e) => setEndPage(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <Button
                    type="button"
                    className="h-10 rounded-full px-5"
                    disabled={saving || !fileUrl}
                    onClick={() => void saveEdits()}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 rounded-full px-3"
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
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              From the outline — edit if wrong
            </p>
          </div>

          {statusSlot ? <div className="mt-auto pt-4">{statusSlot}</div> : null}
        </div>
      </div>
    </div>
  )
}
