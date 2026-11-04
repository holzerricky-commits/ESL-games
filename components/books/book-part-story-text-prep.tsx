'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, RotateCcw, Sparkles, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { StoryScanProgressBar } from '@/components/books/story-scan-progress-bar'
import {
  DeskOverflowMenu,
  type DeskOverflowMenuItem,
} from '@/components/students/fullscreen-book-overlay/sections/DeskOverflowMenu'
import { DeskStatusChip } from '@/components/students/fullscreen-book-overlay/sections/DeskStatusChip'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
import { resolvePartStoryKind } from '@/lib/books/part-structure-tag'
import { resolveTocExtractProfileForBook } from '@/lib/books/toc-extract-profile'
import {
  startStoryTextScan,
  stopStoryTextScan,
  subscribeStoryTextScan,
} from '@/lib/books/story-text-scan-manager'
import type { StoryScanProgress, StoryTextScanMode } from '@/lib/books/story-text-scan-client'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

interface BookPartStoryTextPrepProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  partIndex?: number
  totalPdfPages: number | null
  /** Notify parent when text readiness changes (for the checklist row). */
  onTextReadyChange?: (ready: boolean) => void
  /** Notify parent when a saved scan stopped part way (for the checklist row). */
  onPartialChange?: (partial: boolean) => void
  /** Bump when the story page range is saved so the range is re-read. */
  refreshKey?: number
  className?: string
}

function wordCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

/** Story desk step: scan the story text from the PDF, or paste and save it. */
export function BookPartStoryTextPrep({
  book,
  unit,
  lesson,
  part,
  partIndex = 0,
  totalPdfPages,
  onTextReadyChange,
  onPartialChange,
  refreshKey = 0,
  className,
}: BookPartStoryTextPrepProps) {
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
  const [textRecord, setTextRecord] = useState<ReadingStoryTextRecord | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [scanProgress, setScanProgress] = useState<StoryScanProgress | null>(null)
  const [scanRunning, setScanRunning] = useState(false)

  const resolved = useMemo(
    () => resolveReadingStoryRange(story, book, unit, totalPdfPages, override),
    [story, book, unit, totalPdfPages, override],
  )

  const pagesReady = resolved.source !== 'none'
  const savedText = textRecord?.text ?? ''
  const hasStoryText = readingStoryTextStatus(savedText || textDraft) === 'ready'
  const savedReady = readingStoryTextStatus(savedText) === 'ready'
  const dirty = textDraft !== savedText
  const partial =
    savedReady &&
    storyTextScanCanContinue({
      text: textDraft,
      startPdfPage: textRecord?.startPdfPage,
      endPdfPage: textRecord?.endPdfPage,
    })
  const words = wordCount(textDraft)

  useEffect(() => {
    onTextReadyChange?.(hasStoryText)
  }, [hasStoryText, onTextReadyChange])

  useEffect(() => {
    onPartialChange?.(partial)
  }, [partial, onPartialChange])

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
        const res = await fetch(`/api/reading-stories/text?storyId=${encodeURIComponent(story.id)}`)
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          text?: ReadingStoryTextRecord | null
        }
        if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load story text')
        if (cancelled) return
        const record = data.text ?? null
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
  }, [story.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/reading-stories?bookId=${encodeURIComponent(book.id)}&unitId=${encodeURIComponent(unit.id)}`,
        )
        const data = (await res.json()) as { ok?: boolean; overrides?: ReadingStoryRangeOverride[] }
        if (cancelled || !res.ok || !data.ok) return
        setOverride(
          data.overrides?.find(
            (row) =>
              row.storyId === story.id ||
              (row.partId != null && row.partId === part.id && row.lessonId === lesson.id),
          ) ?? null,
        )
      } catch {
        // Falls back to the outline range.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [book.id, unit.id, story.id, part.id, lesson.id, refreshKey])

  function scanText(mode: StoryTextScanMode) {
    if (!pagesReady) {
      toast.error('Set pages for this story first.')
      return
    }
    const existing =
      mode === 'continue' && textRecord ? { ...textRecord, text: textDraft || textRecord.text } : null
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

  async function saveText() {
    setSaving(true)
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
        return
      }
      setTextRecord(data.text)
      setTextDraft(data.text.text)
      toast.success('Story text saved.')
    } catch {
      toast.error('Could not save text.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className={cn('text-[13px] text-muted-foreground', className)}>Loading…</p>
  }
  if (loadError) {
    return <p className={cn('text-[13px] text-destructive', className)}>{loadError}</p>
  }

  const chip = scanRunning
    ? { status: 'running' as const, label: 'Scanning' }
    : partial
      ? { status: 'attention' as const, label: 'Partial scan' }
      : savedReady
        ? { status: 'done' as const, label: 'Saved' }
        : { status: 'todo' as const, label: 'No text yet' }

  const meta = [
    words > 0 ? `${words.toLocaleString()} word${words === 1 ? '' : 's'}` : null,
    pagesReady ? `pp. ${resolved.startDisplayPage}–${resolved.endDisplayPage}` : null,
    dirty && savedReady ? 'unsaved' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const menuItems: DeskOverflowMenuItem[] = []
  if (savedReady) {
    menuItems.push({
      id: 'rescan',
      label: 'Re-scan from start',
      icon: RotateCcw,
      onSelect: () => scanText('full'),
      disabled: scanRunning || saving || !pagesReady,
    })
  }
  if (dirty && savedReady) {
    menuItems.push({
      id: 'discard',
      label: 'Discard changes',
      icon: Undo2,
      onSelect: () => setTextDraft(savedText),
      disabled: scanRunning || saving,
    })
  }

  let primary: { label: string; onClick: () => void; disabled?: boolean; icon?: 'scan' | 'saved' }
  if (scanRunning) {
    primary = { label: 'Scanning…', onClick: () => {}, disabled: true }
  } else if (dirty) {
    primary = { label: saving ? 'Saving…' : 'Save text', onClick: () => void saveText(), disabled: saving }
  } else if (partial) {
    primary = { label: 'Continue scan', onClick: () => scanText('continue'), disabled: !pagesReady, icon: 'scan' }
  } else if (!savedReady) {
    primary = { label: 'Scan text', onClick: () => scanText('full'), disabled: !pagesReady, icon: 'scan' }
  } else {
    primary = { label: 'Saved', onClick: () => {}, disabled: true, icon: 'saved' }
  }

  const help = !pagesReady
    ? 'Set the story pages first.'
    : partial
      ? 'The scan stopped part way. Continue picks up after the saved pages.'
      : savedReady
        ? 'Reading checks are written from this text. Edit it here if the scan made mistakes.'
        : 'Scan reads the story pages for you, or paste the story text yourself.'

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <DeskStatusChip status={chip.status} label={chip.label} />
          {meta ? <span className="truncate text-[12px] text-muted-foreground">{meta}</span> : null}
        </div>
        <DeskOverflowMenu label="More text actions" items={menuItems} />
      </div>

      {scanProgress ? (
        <StoryScanProgressBar progress={scanProgress} onCancel={() => stopStoryTextScan(story.id)} />
      ) : null}

      <Textarea
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        placeholder="Scan from the PDF, or paste the story here."
        className="min-h-[280px] resize-none rounded-lg border-0 bg-[var(--surface-3)] font-sans text-[13px] leading-relaxed text-foreground shadow-none"
        disabled={scanRunning}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={primary.icon === 'saved' ? 'secondary' : 'default'}
          className="h-8 gap-1.5 rounded-lg px-4"
          disabled={primary.disabled}
          onClick={primary.onClick}
        >
          {scanRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {primary.icon === 'scan' ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : null}
          {primary.icon === 'saved' ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
          {primary.label}
        </Button>
      </div>

      <p className="text-[12px] leading-relaxed text-muted-foreground">{help}</p>
    </div>
  )
}
