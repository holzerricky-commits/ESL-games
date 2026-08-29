'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  ChecksAiGenerateButton,
  ChecksAiGeneratingOverlay,
} from '@/components/books/checks-ai-generate-button'
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
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
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
  /** Outline-linked story — soft warn when frame missing (logic only). */
  lessonLinked?: boolean
  lessonId?: string | null
  /** Lesson frame marked ready (skill / EQ scanned). */
  hasLessonFrameReady?: boolean
  pack: ReadingCheckPack | null
  defaultDisplayPage: number | null
  onPackChange: (pack: ReadingCheckPack) => void
  /** Opens the shared story-text dialog (scan / paste / edit). */
  onOpenStoryText?: () => void
  /** `soft` = Apple part-prep cards; `desk` = Stories desk; `rail` = dark book desk rail. */
  chrome?: 'desk' | 'soft' | 'rail'
  /** Controlled editor dialog (icon launchers). */
  dialogOpen?: boolean
  onDialogOpenChange?: (open: boolean) => void
  /** Hide the collapsed status row — only the editor dialog. */
  hideCollapsedRow?: boolean
  /** Extra classes for DialogContent / overlay (e.g. z-[90] above workshop). */
  dialogClassName?: string
  dialogOverlayClassName?: string
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
  lessonLinked: _lessonLinked = false,
  lessonId = null,
  hasLessonFrameReady: _hasLessonFrameReady = false,
  pack,
  defaultDisplayPage,
  onPackChange,
  onOpenStoryText,
  chrome = 'desk',
  dialogOpen: controlledOpen,
  onDialogOpenChange,
  hideCollapsedRow = false,
  dialogClassName,
  dialogOverlayClassName,
}: StoryCheckPackPanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onDialogOpenChange ?? setUncontrolledOpen
  const [draft, setDraft] = useState<ReadingCheckPack>(
    () => pack ?? createEmptyReadingCheckPack({ storyId, bookId, unitId }),
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [tryoutStopId, setTryoutStopId] = useState<string | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const skipAutosaveRef = useRef(false)

  useEffect(() => {
    const next = pack ?? createEmptyReadingCheckPack({ storyId, bookId, unitId })
    const stops = next.stops.map((s) => ensureReadingCheckStopPlacement(s))
    setDraft({ ...next, stops })
    setActiveIndex((i) => clampIndex(i, stops.length))
  }, [pack, storyId, bookId, unitId])

  useEffect(() => {
    function onDismissUi() {
      onPackChange(draftRef.current)
      setOpen(false)
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
  const statusLabel =
    draft.status === 'approved'
      ? `Approved · ${usable}`
      : usable > 0
        ? `Draft · ${usable}`
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
  const rail = chrome === 'rail'

  async function runGenerate() {
    if (!hasStoryText) {
      toast.error('Scan or paste story text first.')
      return
    }
    setReplaceOpen(false)
    setGenerating(true)
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
            ? `Draft ready — skill frame + ${data.stopCheckCount} stop${data.stopCheckCount === 1 ? '' : 's'}.`
            : 'Draft ready — skewed to this lesson’s skill.'
          : data.stopCheckCount
            ? `Draft ready — ${data.stopCheckCount} Stop and Check pause${data.stopCheckCount === 1 ? '' : 's'}.`
            : 'Draft ready — review each check, then Finish.',
      )
      if (!open) setOpen(true)
    } catch {
      toast.error('Could not generate checks.')
    } finally {
      setGenerating(false)
    }
  }

  async function persist(
    next: ReadingCheckPack,
    action: 'save' | 'approve' | 'unapprove',
    opts?: { quiet?: boolean; keepOpen?: boolean },
  ) {
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
      if (!opts?.quiet) {
        if (action === 'approve') toast.success('Checks ready for class.')
        else if (action === 'unapprove') toast.success('Back to draft — not live in class.')
        else toast.success('Checks saved as draft.')
      }
      if (!opts?.keepOpen && (action === 'save' || action === 'approve')) {
        if (action === 'approve') skipAutosaveRef.current = true
        setOpen(false)
      }
    } catch {
      toast.error('Could not save checks.')
    } finally {
      setSaving(false)
    }
  }

  function openEditor() {
    setActiveIndex((i) => clampIndex(i, draft.stops.length))
    setOpen(true)
  }

  function addStopOfKind(kind: ReadingCheckQuestionKind = 'mcq') {
    setDraft((prev) => {
      const created = ensureReadingCheckStopPlacement(
        createEmptyReadingCheckStop(defaultDisplayPage, kind),
        { resetHotspot: true },
      )
      const stops = [...prev.stops, created]
      setActiveIndex(stops.length - 1)
      return { ...prev, status: 'draft', approvedAt: null, stops }
    })
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

  function onGenerateClick() {
    if (!hasStoryText) {
      toast.error('Scan or paste story text first.')
      return
    }
    if (draft.stops.length > 0) {
      setReplaceOpen(true)
      return
    }
    void runGenerate()
  }

  const generateControl = (
    <Popover modal={false} open={replaceOpen} onOpenChange={setReplaceOpen}>
      <PopoverAnchor asChild>
        <span className="inline-flex">
          <ChecksAiGenerateButton
            busy={generating}
            disabled={saving || !hasStoryText}
            label="Regenerate"
            title={
              hasStoryText
                ? 'Replace with a new AI draft'
                : 'Scan or paste story text first'
            }
            onClick={onGenerateClick}
          />
        </span>
      </PopoverAnchor>
      <PopoverContent
        className="z-[120] w-64 space-y-3 p-3"
        align="end"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-[13px] text-foreground">Replace current checks with a new AI draft?</p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-3"
            onClick={() => setReplaceOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full px-3"
            onClick={() => void runGenerate()}
          >
            Regenerate
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )

  return (
    <>
      {!hideCollapsedRow ? (
        <div
          className={cn(
            soft
              ? 'flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-3)] p-4 sm:p-5'
              : rail
                ? 'flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-black/20 p-3'
                : 'flex flex-wrap items-center justify-between gap-2',
          )}
        >
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
                : rail
                  ? cn(
                      'px-2 py-0.5 text-[10px]',
                      draft.status === 'approved'
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : usable > 0
                          ? 'bg-white/10 text-white/85'
                          : 'bg-white/10 text-white/50',
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
          <div className="flex flex-wrap items-center gap-2">
            {draft.status === 'approved' ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  soft
                    ? 'h-9 rounded-full px-3 text-muted-foreground'
                    : rail
                      ? 'h-7 rounded-md px-2 text-white/70 hover:bg-white/10 hover:text-white'
                      : 'h-8',
                )}
                disabled={saving}
                onClick={() => void persist(draft, 'unapprove')}
              >
                Back to draft
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={soft ? 'secondary' : rail ? 'outline' : 'ghost'}
              className={cn(
                soft
                  ? 'h-9 rounded-full px-4'
                  : rail
                    ? 'h-7 rounded-md border-white/15 bg-white/10 px-2 text-white hover:bg-white/15'
                    : 'h-8',
              )}
              onClick={() => openEditor()}
            >
              {draft.stops.length > 0 ? 'Edit' : 'Open'}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setReplaceOpen(false)
            const current = draftRef.current
            if (
              !skipAutosaveRef.current &&
              current.status === 'draft' &&
              current.stops.length > 0 &&
              !saving &&
              !generating
            ) {
              void persist(current, 'save', { quiet: true, keepOpen: true })
            }
            skipAutosaveRef.current = false
          }
          setOpen(next)
        }}
      >
        <DialogContent
          overlayClassName={dialogOverlayClassName}
          className={cn(
            'flex w-[min(96vw,56rem)] max-w-[56rem] flex-col gap-0 overflow-hidden border-border/60 bg-[var(--surface-2)] p-0 sm:max-w-[56rem]',
            draft.stops.length === 0
              ? 'h-[min(70vh,560px)]'
              : 'h-auto max-h-[min(82vh,640px)]',
            dialogClassName,
          )}
        >
          <DialogHeader className="shrink-0 space-y-0 border-b border-border/50 bg-[var(--surface-2)] px-6 py-3 text-left sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <DialogTitle className="text-[17px] font-semibold tracking-tight text-foreground">
                Reading checks
              </DialogTitle>
              <DialogDescription className="sr-only">
                Edit comprehension checks for this story. Step through each one, then Finish when ready for class.
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenStoryText ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 rounded-full p-0 text-muted-foreground"
                    disabled={saving || generating}
                    title={hasStoryText ? 'View story text' : 'Scan or paste story text'}
                    onClick={() => onOpenStoryText()}
                  >
                    <BookOpen className="size-4" aria-hidden />
                    <span className="sr-only">View story</span>
                  </Button>
                ) : null}
                {draft.stops.length > 0 ? generateControl : null}
                {draft.stops.length > 0 ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium',
                      draft.status === 'approved'
                        ? 'bg-[var(--brand-blue)] text-white'
                        : 'bg-[var(--surface-3)] text-muted-foreground',
                    )}
                  >
                    {draft.status === 'approved' ? (
                      <Check className="size-3 stroke-[3]" aria-hidden />
                    ) : null}
                    {draft.status === 'approved' ? 'Approved' : 'Draft'}
                    {` · ${draft.stops.length}`}
                  </span>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          <div
            className={cn(
              'relative flex min-h-0 flex-col overflow-hidden px-6 py-5 sm:px-8 sm:py-5',
              draft.stops.length === 0 ? 'min-h-0 flex-1 bg-[var(--surface-1)]' : 'bg-[var(--surface-2)]',
            )}
          >
            {generating ? <ChecksAiGeneratingOverlay /> : null}

            {draft.stops.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl bg-[var(--surface-3)] px-6 py-10">
                <ChecksAiGenerateButton
                  size="lg"
                  busy={generating}
                  disabled={!hasStoryText || saving}
                  title={
                    hasStoryText
                      ? 'Draft checks from saved story text'
                      : 'Scan or paste story text first'
                  }
                  onClick={() => void runGenerate()}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 gap-1.5 rounded-full px-3 text-muted-foreground"
                  disabled={generating}
                  onClick={() => addStopOfKind('mcq')}
                >
                  Write a check
                </Button>
              </div>
            ) : activeStop ? (
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
            ) : null}
          </div>

          {draft.stops.length > 0 ? (
            <DialogFooter className="relative shrink-0 border-t border-border/50 bg-[var(--surface-2)] px-6 py-3 sm:px-8 sm:justify-between">
              <div className="flex items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 rounded-full px-2.5 text-[12px] text-muted-foreground"
                  disabled={generating || draft.status === 'approved'}
                  onClick={() => addStopOfKind('mcq')}
                >
                  <Plus className="size-3" aria-hidden />
                  Add
                </Button>
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <div className="pointer-events-auto flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 rounded-full p-0 text-muted-foreground"
                    disabled={safeIndex <= 0 || generating}
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    <span className="sr-only">Previous</span>
                  </Button>
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
                          'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors',
                          active
                            ? 'bg-[var(--brand-blue)] text-white'
                            : incomplete
                              ? 'text-[var(--brand-yellow)]'
                              : 'text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => setActiveIndex(i)}
                      >
                        {i + 1}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                {safeIndex < draft.stops.length - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 rounded-full px-5"
                    disabled={generating}
                    onClick={() =>
                      setActiveIndex((i) => Math.min(draft.stops.length - 1, i + 1))
                    }
                  >
                    Next
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Button>
                ) : draft.status === 'approved' ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 rounded-full px-5"
                    disabled={saving || generating}
                    onClick={() => {
                      skipAutosaveRef.current = true
                      setOpen(false)
                    }}
                  >
                    Done
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 rounded-full px-5"
                    disabled={saving || generating || !readingCheckPackCanApprove(draft)}
                    onClick={() => {
                      const approved = approveReadingCheckPack(draft)
                      if (!approved) {
                        toast.error('Finish each check first.')
                        return
                      }
                      void persist(approved, 'approve')
                    }}
                  >
                    Finish
                  </Button>
                )}
              </div>
            </DialogFooter>
          ) : null}
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
