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
import type { ReadingCheckPack } from '@/lib/books/reading-check-pack'
import { readingStoryTextStatus } from '@/lib/books/reading-story-text'
import { effectivePartStructureTag } from '@/lib/books/part-structure-tag'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

interface BookPartChecksPrepProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  totalPdfPages: number | null
  /** Optional: parent already knows text readiness (avoids a second fetch race). */
  textReady?: boolean
  /** Notify parent when checks are approved (for header badge). */
  onChecksReadyChange?: (ready: boolean) => void
}

export function BookPartChecksPrep({
  book,
  unit,
  lesson,
  part,
  totalPdfPages,
  textReady: textReadyProp,
  onChecksReadyChange,
}: BookPartChecksPrepProps) {
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
    const el = document.getElementById('part-prep-story-text')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      id="part-prep-checks"
      className="scroll-mt-6 overflow-hidden rounded-[28px] bg-[var(--surface-2)] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)]"
    >
      <div className="space-y-4 px-6 py-5 sm:px-8 sm:py-6">
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

        {loading ? (
          <p className="text-[14px] text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <p className="text-[14px] text-destructive">{loadError}</p>
        ) : (
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
            onPackChange={setPack}
            onOpenStoryText={openStoryText}
            chrome="soft"
          />
        )}
      </div>
    </div>
  )
}
