'use client'

import { useEffect, useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import {
  StoryTextFuelPanel,
  type StoryTextFuelBusy,
} from '@/components/books/story-text-fuel-panel'
import {
  readingStoryPartKey,
  resolveReadingStoryRange,
  type ReadingStoryMap,
  type ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import { storyTextScanCanContinue } from '@/lib/books/reading-story-page-markers'
import {
  readingStoryTextStatus,
  type ReadingStoryTextRecord,
} from '@/lib/books/reading-story-text'
import { effectivePartStructureTag } from '@/lib/books/part-structure-tag'
import {
  startStoryTextScan,
  stopStoryTextScan,
  subscribeStoryTextScan,
} from '@/lib/books/story-text-scan-manager'
import type { StoryScanProgress, StoryTextScanMode } from '@/lib/books/story-text-scan-client'
import { useSearchablePdfJob } from '@/lib/books/use-searchable-pdf-job'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

interface BookPartStoryTextPrepProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  totalPdfPages: number | null
  /** Notify parent when text readiness changes (for header chips). */
  onTextReadyChange?: (ready: boolean) => void
}

export function BookPartStoryTextPrep({
  book,
  unit,
  lesson,
  part,
  totalPdfPages,
  onTextReadyChange,
}: BookPartStoryTextPrepProps) {
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

  const { selectableRunning, selectableProgress, startSelectable, stopSelectable } =
    useSearchablePdfJob(story.id)

  const [override, setOverride] = useState<ReadingStoryRangeOverride | null>(null)
  const [textRecord, setTextRecord] = useState<ReadingStoryTextRecord | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Exclude<StoryTextFuelBusy, 'scan'> | null>(null)
  const [scanProgress, setScanProgress] = useState<StoryScanProgress | null>(null)
  const [scanRunning, setScanRunning] = useState(false)
  const [textDialogOpen, setTextDialogOpen] = useState(false)

  const resolved = useMemo(
    () => resolveReadingStoryRange(story, book, unit, totalPdfPages, override),
    [story, book, unit, totalPdfPages, override],
  )

  const pagesReady = resolved.source !== 'none'
  const pageRangeLabel =
    pagesReady ? `p${resolved.startDisplayPage}–${resolved.endDisplayPage}` : null
  const hasStoryText = readingStoryTextStatus(textRecord?.text ?? textDraft) === 'ready'
  const canContinueScan = storyTextScanCanContinue({
    text: textDraft,
    startPdfPage: textRecord?.startPdfPage,
    endPdfPage: textRecord?.endPdfPage,
  })

  useEffect(() => {
    onTextReadyChange?.(hasStoryText)
  }, [hasStoryText, onTextReadyChange])

  useEffect(() => {
    return subscribeStoryTextScan(story.id, (snap) => {
      setScanRunning(snap.running)
      setScanProgress(snap.progress)
      if (snap.lastText) {
        setTextRecord(snap.lastText)
        setTextDraft(snap.lastText.text)
      }
    })
  }, [story.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const [storiesRes, textRes] = await Promise.all([
          fetch(
            `/api/reading-stories?bookId=${encodeURIComponent(book.id)}&unitId=${encodeURIComponent(unit.id)}`,
          ),
          fetch(`/api/reading-stories/text?storyId=${encodeURIComponent(story.id)}`),
        ])
        const storiesData = (await storiesRes.json()) as {
          ok?: boolean
          error?: string
          overrides?: ReadingStoryRangeOverride[]
        }
        const textData = (await textRes.json()) as {
          ok?: boolean
          error?: string
          text?: ReadingStoryTextRecord | null
        }
        if (!storiesRes.ok || !storiesData.ok) {
          throw new Error(storiesData.error || 'Could not load page range')
        }
        if (!textRes.ok || !textData.ok) {
          throw new Error(textData.error || 'Could not load story text')
        }
        if (cancelled) return
        const match =
          storiesData.overrides?.find(
            (row) =>
              row.storyId === story.id ||
              (row.partId != null && row.partId === part.id && row.lessonId === lesson.id),
          ) ?? null
        setOverride(match)
        const record = textData.text ?? null
        setTextRecord(record)
        setTextDraft(record?.text ?? '')
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load story text')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [book.id, unit.id, story.id, part.id, lesson.id])

  function scanText(opts?: { mode?: StoryTextScanMode }) {
    if (!pagesReady) {
      toast.error('Set pages for this story first.')
      return
    }
    const mode = opts?.mode ?? 'full'
    const existing =
      mode === 'continue' && textRecord
        ? { ...textRecord, text: textDraft || textRecord.text }
        : null
    startStoryTextScan({
      storyId: story.id,
      bookId: story.bookId,
      unitId: story.unitId,
      lessonId: story.lessonId,
      partId: story.partId,
      title: story.title,
      totalPdfPages,
      mode,
      existingText: existing,
    })
  }

  function stopScan() {
    stopStoryTextScan(story.id)
  }

  async function saveTextPaste(): Promise<boolean> {
    setBusy('saveText')
    try {
      const res = await fetch('/api/reading-stories/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          storyId: story.id,
          bookId: story.bookId,
          unitId: story.unitId,
          text: textDraft,
          startDisplayPage: pagesReady ? resolved.startDisplayPage : undefined,
          endDisplayPage: pagesReady ? resolved.endDisplayPage : undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        text?: ReadingStoryTextRecord
        error?: string
      }
      if (!data.ok || !data.text) {
        toast.error(data.error ?? 'Could not save text.')
        return false
      }
      setTextRecord(data.text)
      setTextDraft(data.text.text)
      toast.success('Story text saved.')
      return true
    } catch {
      toast.error('Could not save text.')
      return false
    } finally {
      setBusy(null)
    }
  }

  const fuelBusy: StoryTextFuelBusy =
    busy === 'saveText' ? 'saveText' : scanRunning ? 'scan' : null

  return (
    <div
      id="part-prep-story-text"
      className="scroll-mt-6 overflow-hidden rounded-[28px] bg-[var(--surface-2)] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)]"
    >
      <div className="space-y-4 px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start gap-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--brand-blue)_72%,white),var(--brand-blue))] text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)]"
            aria-hidden
          >
            <ScrollText className="h-5 w-5 stroke-[1.75]" />
          </span>
          <div className="min-w-0 space-y-0.5 pt-0.5">
            <p className="text-[17px] font-semibold tracking-tight text-foreground">Story text</p>
            <p className="text-[14px] text-muted-foreground">Scan from the PDF or paste</p>
          </div>
        </div>

        {loading ? (
          <p className="text-[14px] text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <p className="text-[14px] text-destructive">{loadError}</p>
        ) : (
          <StoryTextFuelPanel
            storyTitle={story.title}
            pageRangeLabel={pageRangeLabel}
            textDraft={textDraft}
            onTextDraftChange={setTextDraft}
            hasStoryText={hasStoryText}
            busy={fuelBusy}
            scanProgress={scanProgress}
            onScan={(opts) => scanText(opts)}
            onStopScan={stopScan}
            onSave={() => saveTextPaste()}
            scanDisabled={!pagesReady}
            canContinueScan={canContinueScan}
            onMakeSelectable={() => {
              if (!pagesReady) {
                toast.error('Set pages for this story first.')
                return
              }
              startSelectable({
                bookId: story.bookId,
                unitId: story.unitId,
                lessonId: story.lessonId,
                partId: story.partId,
                title: story.title,
                totalPdfPages,
              })
            }}
            onStopMakeSelectable={stopSelectable}
            selectableProgress={selectableProgress}
            selectableRunning={selectableRunning}
            dialogOpen={textDialogOpen}
            onDialogOpenChange={setTextDialogOpen}
            hideRowLabel
            chrome="soft"
          />
        )}
      </div>
    </div>
  )
}
