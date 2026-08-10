'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ListChecks,
  Plus,
  Sparkles,
  ToggleLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { CHECKS_DIALOG_STYLE } from '@/components/books/checks-editor-theme'
import { ReadingCheckGamePopup } from '@/components/books/reading-check-game-popup'
import { StoryCheckQuestionCard } from '@/components/books/story-check-question-card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  READING_CHECK_HOTSPOT_PLACE_RESULT_EVENT,
  READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT,
  READING_CHECK_HOTSPOT_TRY_EVENT,
  type ReadingCheckHotspotPlaceResultDetail,
  type ReadingCheckHotspotTryDetail,
} from '@/lib/books/reading-check-hotspot-placement-events'
import {
  approveReadingCheckPack,
  countUsableReadingCheckStops,
  createEmptyReadingCheckPack,
  createEmptyReadingCheckStop,
  createReadingCheckHotspotPlacement,
  duplicateReadingCheckStop,
  isReadingCheckStopIncomplete,
  primaryQuestionOfStop,
  readingCheckPackCanApprove,
  type ReadingCheckPack,
  type ReadingCheckQuestionKind,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import { ensureReadingCheckStopPlacement } from '@/lib/books/reading-check-placement'
import { cn } from '@/lib/utils'

interface StoryCheckPackPanelProps {
  storyId: string
  bookId: string
  unitId: string
  storyTitle: string
  hasStoryText: boolean
  /** Outline-linked story — show soft Generate warn when frame missing. */
  lessonLinked?: boolean
  lessonId?: string | null
  /** Lesson frame marked ready (skill / EQ scanned). */
  hasLessonFrameReady?: boolean
  pack: ReadingCheckPack | null
  defaultDisplayPage: number | null
  onPackChange: (pack: ReadingCheckPack) => void
  /** Opens the shared story-text dialog (scan / paste / edit). */
  onOpenStoryText?: () => void
  /** `soft` = Apple part-prep cards; default desk row chrome. */
  chrome?: 'desk' | 'soft'
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

export function StoryCheckPackPanel({
  storyId,
  bookId,
  unitId,
  storyTitle,
  hasStoryText,
  lessonLinked = false,
  lessonId = null,
  hasLessonFrameReady = false,
  pack,
  defaultDisplayPage,
  onPackChange,
  onOpenStoryText,
  chrome = 'desk',
}: StoryCheckPackPanelProps) {
  const [open, setOpen] = useState(false)
  const [pickingType, setPickingType] = useState(false)
  const [draft, setDraft] = useState<ReadingCheckPack>(
    () => pack ?? createEmptyReadingCheckPack({ storyId, bookId, unitId }),
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tryoutStopId, setTryoutStopId] = useState<string | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    const next = pack ?? createEmptyReadingCheckPack({ storyId, bookId, unitId })
    const stops = next.stops.map((s) => ensureReadingCheckStopPlacement(s))
    setDraft({ ...next, stops })
    setActiveIndex((i) => clampIndex(i, stops.length))
  }, [pack, storyId, bookId, unitId])

  useEffect(() => {
    function onDismissUi() {
      // Keep unsaved editor work when prep sheet unmounts during placement.
      onPackChange(draftRef.current)
      setOpen(false)
      setPickingType(false)
    }
    window.addEventListener(READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT, onDismissUi)
    return () => window.removeEventListener(READING_CHECK_HOTSPOT_PLACE_UI_DISMISS_EVENT, onDismissUi)
  }, [onPackChange])

  useEffect(() => {
    function onResult(event: Event) {
      const detail = (event as CustomEvent<ReadingCheckHotspotPlaceResultDetail>).detail
      if (!detail) return
      if (detail.storyId !== storyId || detail.bookId !== bookId || detail.unitId !== unitId) return
      setDraft((prev) => ({
        ...prev,
        status: 'draft',
        approvedAt: null,
        stops: prev.stops.map((s) => {
          if (s.id !== detail.stopId) return s
          return {
            ...s,
            displayPage: detail.displayPage ?? s.displayPage,
            hotspot: createReadingCheckHotspotPlacement({
              pdfPage: detail.pdfPage,
              pageSide: detail.pageSide,
              x: detail.x,
              y: detail.y,
            }),
          }
        }),
      }))
    }

    function onTry(event: Event) {
      const detail = (event as CustomEvent<ReadingCheckHotspotTryDetail>).detail
      if (!detail || detail.storyId !== storyId) return
      setTryoutStopId(detail.stopId)
    }

    window.addEventListener(READING_CHECK_HOTSPOT_PLACE_RESULT_EVENT, onResult)
    window.addEventListener(READING_CHECK_HOTSPOT_TRY_EVENT, onTry)
    return () => {
      window.removeEventListener(READING_CHECK_HOTSPOT_PLACE_RESULT_EVENT, onResult)
      window.removeEventListener(READING_CHECK_HOTSPOT_TRY_EVENT, onTry)
    }
  }, [bookId, storyId, unitId])

  const usable = countUsableReadingCheckStops(draft)
  const incompleteCount = draft.stops.filter((s) => isReadingCheckStopIncomplete(s)).length
  const statusLabel =
    draft.status === 'approved'
      ? `Approved · ${usable} check${usable === 1 ? '' : 's'}`
      : usable > 0
        ? `Draft · ${usable} check${usable === 1 ? '' : 's'}`
        : 'None yet'

  const safeIndex = clampIndex(activeIndex, draft.stops.length)
  const activeStop = draft.stops[safeIndex] ?? null
  const tryoutStop = tryoutStopId ? draft.stops.find((s) => s.id === tryoutStopId) ?? null : null
  const tryoutQuestion = tryoutStop ? primaryQuestionOfStop(tryoutStop) : null
  const tryoutIndex = tryoutStop ? draft.stops.findIndex((s) => s.id === tryoutStop.id) : -1
  const tryoutTitle =
    tryoutStop?.label.trim() ||
    (tryoutIndex >= 0 ? `Check ${tryoutIndex + 1}` : 'Check')
  const canTryout = Boolean(tryoutQuestion?.prompt.trim())
  const soft = chrome === 'soft'

  async function generateDraft() {
    if (!hasStoryText) {
      toast.error('Scan or paste story text first, then generate.')
      return
    }
    if (lessonLinked && !hasLessonFrameReady) {
      const ok = window.confirm(
        'This story’s lesson frame isn’t ready yet (skill / essential question). Generate checks from story text only? You can scan the frame later for smarter questions.',
      )
      if (!ok) return
    }
    if (draft.stops.length > 0) {
      const ok = window.confirm(
        'Replace your current checks with an AI draft? You can still edit before Approve.',
      )
      if (!ok) return
    }
    setGenerating(true)
    setPickingType(false)
    try {
      const res = await fetch('/api/reading-stories/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          storyId,
          bookId,
          unitId,
          title: storyTitle,
          lessonId: lessonId ?? undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        pack?: ReadingCheckPack
        error?: string
        usedLessonFrame?: boolean
        stopCheckCount?: number
      }
      if (!data.ok || !data.pack) {
        toast.error(data.error ?? 'Could not generate checks.')
        return
      }
      setDraft(data.pack)
      setActiveIndex(0)
      onPackChange(data.pack)
      toast.success(
        data.usedLessonFrame
          ? data.stopCheckCount
            ? `AI draft ready — skill frame + ${data.stopCheckCount} Stop and Check anchor${data.stopCheckCount === 1 ? '' : 's'}. Edit, then Approve.`
            : 'AI draft ready — skewed to this lesson’s skill. Edit, then Approve.'
          : data.stopCheckCount
            ? `AI draft ready — covered ${data.stopCheckCount} Stop and Check pause${data.stopCheckCount === 1 ? '' : 's'}. Edit, then Approve.`
            : 'AI draft ready — edit, then Approve when it looks good.',
      )
    } catch {
      toast.error('Could not generate checks.')
    } finally {
      setGenerating(false)
    }
  }

  async function persist(next: ReadingCheckPack, action: 'save' | 'approve' | 'unapprove') {
    setSaving(true)
    try {
      const res = await fetch('/api/reading-stories/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          storyId,
          bookId,
          unitId,
          stops: next.stops,
          status: next.status,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; pack?: ReadingCheckPack; error?: string }
      if (!data.ok || !data.pack) {
        toast.error(data.error ?? 'Could not save checks.')
        return
      }
      setDraft(data.pack)
      setActiveIndex((i) => clampIndex(i, data.pack!.stops.length))
      onPackChange(data.pack)
      if (action === 'approve') toast.success('Checks approved for class.')
      else if (action === 'unapprove') toast.success('Back to draft — not live in class.')
      else toast.success('Checks saved as draft.')
      if (action === 'save' || action === 'approve') {
        setOpen(false)
        setPickingType(false)
      }
    } catch {
      toast.error('Could not save checks.')
    } finally {
      setSaving(false)
    }
  }

  function openEditor(ensureStop: boolean) {
    setPickingType(false)
    if (ensureStop && draft.stops.length === 0) setPickingType(true)
    setActiveIndex((i) => clampIndex(i, draft.stops.length))
    setOpen(true)
  }

  function addStopOfKind(kind: ReadingCheckQuestionKind) {
    setDraft((prev) => {
      const created = ensureReadingCheckStopPlacement(
        createEmptyReadingCheckStop(defaultDisplayPage, kind),
        { resetHotspot: true },
      )
      const stops = [...prev.stops, created]
      setActiveIndex(stops.length - 1)
      return { ...prev, status: 'draft', approvedAt: null, stops }
    })
    setPickingType(false)
  }

  function updateStop(stopId: string, next: ReadingCheckStop) {
    setDraft((prev) => ({
      ...prev,
      status: 'draft',
      approvedAt: null,
      stops: prev.stops.map((s) => (s.id === stopId ? next : s)),
    }))
  }

  function duplicateActive() {
    if (!activeStop) return
    const idx = safeIndex
    setDraft((prev) => {
      const stops = [
        ...prev.stops.slice(0, idx + 1),
        duplicateReadingCheckStop(activeStop),
        ...prev.stops.slice(idx + 1),
      ]
      setActiveIndex(idx + 1)
      return { ...prev, status: 'draft', approvedAt: null, stops }
    })
  }

  function deleteActive() {
    if (!activeStop) return
    const idx = safeIndex
    setDraft((prev) => {
      const stops = prev.stops.filter((s) => s.id !== activeStop.id)
      setActiveIndex(clampIndex(idx, stops.length))
      return { ...prev, status: 'draft', approvedAt: null, stops }
    })
  }

  return (
    <>
      <div
        className={cn(
          soft
            ? 'flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-3)] p-4 sm:p-5'
            : 'flex flex-wrap items-center justify-between gap-2',
        )}
      >
        <div className={cn(soft && 'min-w-0 space-y-1')}>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-medium',
              soft
                ? cn(
                    'px-2.5 py-1 text-[12px]',
                    draft.status === 'approved'
                      ? 'bg-[var(--brand-blue)] text-white'
                      : usable > 0
                        ? 'bg-[var(--surface-2)] text-foreground shadow-[inset_0_0_0_1px_var(--border)]'
                        : 'bg-[var(--surface-2)] text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]',
                  )
                : cn(
                    'px-2 py-0.5 text-[10px]',
                    draft.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                      : usable > 0
                        ? 'bg-[var(--surface-3)] text-foreground'
                        : 'bg-[var(--surface-3)] text-muted-foreground',
                  ),
            )}
          >
            {soft && draft.status === 'approved' ? (
              <Check className="size-3 stroke-[3]" aria-hidden />
            ) : null}
            {statusLabel}
          </span>
          {soft ? (
            <p className="text-[14px] text-muted-foreground">
              {draft.status === 'approved'
                ? 'Ready for class'
                : usable > 0
                  ? 'Edit and approve when ready'
                  : 'Generate or add checks by hand'}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {draft.status === 'approved' ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(soft ? 'h-9 rounded-full px-3 text-muted-foreground' : 'h-8')}
              disabled={saving}
              onClick={() => void persist(draft, 'unapprove')}
            >
              Back to draft
            </Button>
          ) : soft && usable === 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 gap-1.5 rounded-full px-4"
              disabled={saving || generating || !hasStoryText}
              onClick={() => void generateDraft()}
            >
              <Sparkles className="size-3.5" aria-hidden />
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={soft ? 'secondary' : 'ghost'}
            className={cn(soft ? 'h-9 rounded-full px-4' : 'h-8')}
            onClick={() => openEditor(usable === 0 && draft.stops.length === 0)}
          >
            {usable > 0 || draft.stops.length > 0 ? 'Edit' : 'Add checks'}
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setPickingType(false)
        }}
      >
        <DialogContent
          className={cn(
            'flex h-[min(88vh,820px)] w-[min(96vw,56rem)] max-w-[56rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[56rem]',
            soft ? 'border-border/60 bg-[var(--surface-1)]' : 'border-[var(--checks-border)]',
          )}
          style={soft ? undefined : CHECKS_DIALOG_STYLE}
        >
          <DialogHeader
            className={cn(
              'shrink-0 space-y-2 border-b px-5 py-3 text-left',
              soft
                ? 'border-border/60 bg-[var(--surface-2)]'
                : 'border-[var(--checks-border)] bg-white',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="space-y-0.5">
                <DialogTitle
                  className={cn(
                    soft ? 'text-[17px] font-semibold tracking-tight text-foreground' : 'text-base text-[var(--checks-ink)]',
                  )}
                >
                  Reading checks
                </DialogTitle>
                <DialogDescription
                  className={cn(soft ? 'text-[13px] text-muted-foreground' : 'text-[var(--checks-muted)]')}
                >
                  Generate or add by hand · one check at a time · Approve when ready
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenStoryText ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      'gap-1.5',
                      soft ? 'h-9 rounded-full px-3 text-muted-foreground' : 'text-[var(--checks-muted)]',
                    )}
                    disabled={saving || generating}
                    title={
                      hasStoryText
                        ? 'View or edit story text'
                        : 'Scan or paste story text'
                    }
                    onClick={() => onOpenStoryText()}
                  >
                    <BookOpen className="size-3.5" aria-hidden />
                    View story
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={cn('gap-1.5', soft && 'h-9 rounded-full px-4')}
                  disabled={saving || generating || !hasStoryText}
                  title={
                    hasStoryText
                      ? 'Draft checks from saved story text'
                      : 'Scan or paste story text first'
                  }
                  onClick={() => void generateDraft()}
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  {generating ? 'Generating…' : 'Generate draft'}
                </Button>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full font-medium',
                    soft
                      ? cn(
                          'px-2.5 py-1 text-[12px]',
                          draft.status === 'approved'
                            ? 'bg-[var(--brand-blue)] text-white'
                            : 'bg-[var(--surface-3)] text-muted-foreground',
                        )
                      : cn(
                          'px-2.5 py-1 text-[11px]',
                          draft.status === 'approved'
                            ? 'bg-[var(--checks-ok-soft)] text-[var(--checks-ok)]'
                            : 'bg-[var(--checks-bg)] text-[var(--checks-muted)]',
                        ),
                  )}
                >
                  {soft && draft.status === 'approved' ? (
                    <Check className="size-3 stroke-[3]" aria-hidden />
                  ) : null}
                  {draft.status === 'approved' ? 'Approved' : 'Draft'}
                  {draft.stops.length > 0 ? ` · ${draft.stops.length}` : ''}
                </span>
              </div>
            </div>
            {!hasStoryText ? (
              <p
                className={cn(
                  soft
                    ? 'rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[12px] text-muted-foreground'
                    : 'rounded-md bg-[var(--checks-warn-soft)] px-3 py-1.5 text-[11px] text-[var(--checks-ink)]',
                )}
              >
                Generate needs story text
                {onOpenStoryText ? (
                  <>
                    {' '}
                    —{' '}
                    <button
                      type="button"
                      className="font-medium underline underline-offset-2"
                      onClick={() => onOpenStoryText()}
                    >
                      Scan or paste
                    </button>
                    {' '}
                    first.
                  </>
                ) : (
                  ' — use Scan / paste on the story card first.'
                )}
              </p>
            ) : lessonLinked && !hasLessonFrameReady ? (
              <p
                className={cn(
                  soft
                    ? 'rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[12px] text-muted-foreground'
                    : 'rounded-md bg-[var(--checks-warn-soft)] px-3 py-1.5 text-[11px] text-[var(--checks-ink)]',
                )}
              >
                Tip: scan the lesson <span className="font-medium">Frame</span> (skill / EQ) on the story
                card for smarter questions. Generate still works without it.
              </p>
            ) : lessonLinked && hasLessonFrameReady ? (
              <p
                className={cn(
                  soft
                    ? 'rounded-xl bg-[color-mix(in_srgb,var(--brand-blue)_12%,var(--surface-3))] px-3 py-2 text-[12px] text-foreground'
                    : 'rounded-md bg-[var(--checks-ok-soft)] px-3 py-1.5 text-[11px] text-[var(--checks-ok)]',
                )}
              >
                Lesson frame ready — Generate will practice this week’s skill and essential question.
              </p>
            ) : null}
          </DialogHeader>

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-3',
              soft ? 'bg-[var(--surface-1)]' : 'bg-[var(--checks-bg)]',
            )}
          >
            {generating ? (
              <p className="rounded-lg border border-[var(--checks-border)] bg-white px-3 py-2 text-sm text-[var(--checks-muted)]">
                Reading the story and drafting checks…
              </p>
            ) : null}

            {pickingType ? (
              <div className="space-y-3 rounded-xl border border-[var(--checks-border)] bg-white p-4">
                <p className="text-sm font-medium text-[var(--checks-ink)]">What kind of check?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="flex gap-3 rounded-lg border border-[var(--checks-border)] bg-[var(--checks-bg)] px-3.5 py-3 text-left text-sm hover:border-[var(--checks-accent)]/40"
                    onClick={() => addStopOfKind('mcq')}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--checks-accent-soft)] text-[var(--checks-accent)]">
                      <ListChecks className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="font-medium text-[var(--checks-ink)]">Multiple choice</span>
                      <span className="mt-0.5 block text-xs text-[var(--checks-muted)]">
                        Several options · mark one correct
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex gap-3 rounded-lg border border-[var(--checks-border)] bg-[var(--checks-bg)] px-3.5 py-3 text-left text-sm hover:border-[var(--checks-accent)]/40"
                    onClick={() => addStopOfKind('true_false')}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--checks-accent-soft)] text-[var(--checks-accent)]">
                      <ToggleLeft className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="font-medium text-[var(--checks-ink)]">True / false</span>
                      <span className="mt-0.5 block text-xs text-[var(--checks-muted)]">
                        Quick comprehension check
                      </span>
                    </span>
                  </button>
                </div>
                {draft.stops.length > 0 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPickingType(false)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : null}

            {draft.stops.length === 0 && !pickingType ? (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-[var(--checks-border)] bg-white p-5">
                <div className="flex items-start gap-2 text-sm text-[var(--checks-muted)]">
                  <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>
                    {hasStoryText
                      ? 'No checks yet. Generate a draft, or add one by hand.'
                      : 'No checks yet. Scan or paste story text to unlock Generate, or add by hand.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={!hasStoryText || generating}
                    onClick={() => void generateDraft()}
                  >
                    <Sparkles className="size-3.5" aria-hidden />
                    {generating ? 'Generating…' : 'Generate draft'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={generating}
                    onClick={() => setPickingType(true)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add by hand
                  </Button>
                </div>
              </div>
            ) : null}

            {activeStop && !pickingType ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <StoryCheckQuestionCard
                  key={activeStop.id}
                  stop={activeStop}
                  index={safeIndex}
                  storyId={storyId}
                  bookId={bookId}
                  unitId={unitId}
                  onChange={(next) => updateStop(activeStop.id, next)}
                  onDuplicate={duplicateActive}
                  onDelete={deleteActive}
                />

                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1"
                      disabled={safeIndex <= 0 || generating}
                      onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                      Prev
                    </Button>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 px-1">
                      {draft.stops.map((stop, i) => {
                        const incomplete = isReadingCheckStopIncomplete(stop)
                        const active = i === safeIndex
                        return (
                          <button
                            key={stop.id}
                            type="button"
                            aria-label={`Go to check ${i + 1}`}
                            aria-current={active ? 'step' : undefined}
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors',
                              active
                                ? 'bg-[var(--checks-accent)] text-white'
                                : incomplete
                                  ? 'border border-[var(--checks-warn)]/60 bg-[var(--checks-warn-soft)] text-[var(--checks-ink)]'
                                  : 'border border-[var(--checks-border)] bg-white text-[var(--checks-muted)] hover:border-[var(--checks-accent)]/40',
                            )}
                            onClick={() => setActiveIndex(i)}
                          >
                            {i + 1}
                          </button>
                        )
                      })}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1"
                      disabled={safeIndex >= draft.stops.length - 1 || generating}
                      onClick={() =>
                        setActiveIndex((i) => Math.min(draft.stops.length - 1, i + 1))
                      }
                    >
                      Next
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-[var(--checks-muted)]"
                    disabled={generating}
                    onClick={() => setPickingType(true)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add check
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter
            className={cn(
              'shrink-0 gap-2 border-t px-5 py-2.5 sm:justify-between',
              soft
                ? 'border-border/60 bg-[var(--surface-2)]'
                : 'border-[var(--checks-border)] bg-white',
            )}
          >
            <p
              className={cn(
                'self-center',
                soft ? 'text-[13px] text-muted-foreground' : 'text-xs text-[var(--checks-muted)]',
              )}
            >
              {draft.stops.length > 0
                ? `Check ${safeIndex + 1} of ${draft.stops.length}`
                : 'Add at least one complete check to approve'}
              {draft.stops.length > 0 && incompleteCount > 0
                ? ` · ${incompleteCount} incomplete`
                : ''}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(soft && 'h-9 rounded-full px-3')}
                disabled={saving || generating}
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(soft && 'h-9 rounded-full px-4')}
                disabled={saving || generating}
                onClick={() => void persist(draft, 'save')}
              >
                {saving ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn(soft && 'h-9 rounded-full px-5')}
                disabled={saving || generating || !readingCheckPackCanApprove(draft)}
                onClick={() => {
                  const approved = approveReadingCheckPack(draft)
                  if (!approved) {
                    toast.error('Add at least one complete check first.')
                    return
                  }
                  void persist(approved, 'approve')
                }}
              >
                Approve
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canTryout && tryoutStop && tryoutQuestion ? (
        <ReadingCheckGamePopup
          open={tryoutStopId != null}
          onOpenChange={(next) => {
            if (!next) setTryoutStopId(null)
          }}
          stop={tryoutStop}
          question={tryoutQuestion}
          title={tryoutTitle}
          mode="preview"
        />
      ) : null}
    </>
  )
}
