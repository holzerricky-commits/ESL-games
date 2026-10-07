'use client'

import { useEffect, useMemo, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { StoryCheckPackPanel } from '@/components/books/story-check-pack-panel'
import {
  readingStoryPartKey,
  resolveReadingStoryRange,
  type ReadingStoryMap,
  type ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import type { ReadingCheckPack, ReadingCheckStop } from '@/lib/books/reading-check-pack'
import { readingStoryTextStatus } from '@/lib/books/reading-story-text'
import { resolvePartStoryKind } from '@/lib/books/part-structure-tag'
import { resolveTocExtractProfileForBook } from '@/lib/books/toc-extract-profile'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

interface BookPartChecksPrepProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  partIndex?: number
  totalPdfPages: number | null
  /** Optional: parent already knows text readiness (avoids a second fetch race). */
  textReady?: boolean
  /** Notify parent when checks are approved (for header badge). */
  onChecksReadyChange?: (ready: boolean) => void
  /** Flush into workbench rail (no nested card). */
  rail?: boolean
  onOpenStoryText?: () => void
  className?: string
  onDraftChange?: (pack: ReadingCheckPack | null) => void
  onActiveStopChange?: (stop: ReadingCheckStop | null) => void
  requestedStopId?: string | null
}

export function BookPartChecksPrep({
  book,
  unit,
  lesson,
  part,
  partIndex = 0,
  totalPdfPages,
  textReady: textReadyProp,
  onChecksReadyChange,
  rail = false,
  onOpenStoryText,
  className,
  onDraftChange,
  onActiveStopChange,
  requestedStopId = null,
}: BookPartChecksPrepProps) {
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

  const [override, setOverride] = useState<ReadingStoryRangeOverride | null>(null)
  const [pack, setPack] = useState<ReadingCheckPack | null>(null)
  const [textReadyLocal, setTextReadyLocal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const hasStoryText = textReadyProp ?? textReadyLocal
  const resolved = useMemo(
    () => resolveReadingStoryRange(story, book, unit, totalPdfPages, override),
    [story, book, unit, totalPdfPages, override],
  )
  const defaultDisplayPage = resolved.source !== 'none' ? resolved.startDisplayPage : null
  const checksReady = pack?.status === 'approved'

  useEffect(() => {
    onChecksReadyChange?.(Boolean(checksReady))
  }, [checksReady, onChecksReadyChange])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const [storiesRes, textRes, packRes] = await Promise.all([
          fetch(
            `/api/reading-stories?bookId=${encodeURIComponent(book.id)}&unitId=${encodeURIComponent(unit.id)}`,
          ),
          fetch(`/api/reading-stories/text?storyId=${encodeURIComponent(story.id)}`),
          fetch(`/api/reading-stories/checks?storyId=${encodeURIComponent(story.id)}`),
        ])
        const storiesData = (await storiesRes.json()) as {
          ok?: boolean
          error?: string
          overrides?: ReadingStoryRangeOverride[]
        }
        const textData = (await textRes.json()) as {
          ok?: boolean
          error?: string
          text?: { text?: string } | null
        }
        const packData = (await packRes.json()) as {
          ok?: boolean
          error?: string
          pack?: ReadingCheckPack | null
        }
        if (!storiesRes.ok || !storiesData.ok) {
          throw new Error(storiesData.error || 'Could not load page range')
        }
        if (!textRes.ok || !textData.ok) {
          throw new Error(textData.error || 'Could not load story text status')
        }
        if (!packRes.ok || !packData.ok) {
          throw new Error(packData.error || 'Could not load reading checks')
        }
        if (cancelled) return
        const match =
          storiesData.overrides?.find(
            (row) =>
              row.storyId === story.id ||
              (row.partId != null && row.partId === part.id && row.lessonId === lesson.id),
          ) ?? null
        setOverride(match)
        setTextReadyLocal(readingStoryTextStatus(textData.text?.text) === 'ready')
        setPack(packData.pack ?? null)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load reading checks')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [book.id, unit.id, story.id, part.id, lesson.id])

  function openStoryText() {
    if (onOpenStoryText) {
      onOpenStoryText()
      return
    }
    const el = document.getElementById('part-prep-story-text')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      id="part-prep-checks"
      className={cn(
        'scroll-mt-4',
        rail
          ? 'flex h-full min-h-0 flex-col space-y-3'
          : 'scroll-mt-6 overflow-hidden rounded-[28px] bg-[var(--surface-2)] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)]',
        className,
      )}
    >
      <div className={cn(rail ? 'flex min-h-0 flex-1 flex-col space-y-3' : 'space-y-4 px-6 py-5 sm:px-8 sm:py-6')}>
        {rail ? (
          <div className="space-y-0.5">
            <p className="text-[13px] font-semibold tracking-tight text-foreground">Reading checks</p>
            <p className="text-[12px] text-muted-foreground">Questions for this story</p>
          </div>
        ) : (
          <div className="flex items-start gap-3.5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--brand-blue)_72%,white),var(--brand-blue))] text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)]"
              aria-hidden
            >
              <ListChecks className="h-5 w-5 stroke-[1.75]" />
            </span>
            <div className="min-w-0 space-y-0.5 pt-0.5">
              <p className="text-[17px] font-semibold tracking-tight text-foreground">Reading checks</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <p className="text-[13px] text-destructive">{loadError}</p>
        ) : (
          <div className={rail ? 'flex h-full min-h-0 flex-1 flex-col' : undefined}>
          <StoryCheckPackPanel
            storyId={story.id}
            bookId={story.bookId}
            unitId={story.unitId}
            storyTitle={story.title}
            hasStoryText={hasStoryText}
            lessonLinked
            lessonId={lesson.id}
            pack={pack}
            defaultDisplayPage={defaultDisplayPage}
            onPackChange={(next) => {
              setPack(next)
              onDraftChange?.(next)
            }}
            onOpenStoryText={openStoryText}
            chrome="soft"
            embed={rail}
            keepBookVisible={rail}
            hideCollapsedRow={rail}
            onDraftChange={onDraftChange}
            onActiveStopChange={onActiveStopChange}
            requestedStopId={requestedStopId}
          />
          </div>
        )}
      </div>
    </div>
  )
}
