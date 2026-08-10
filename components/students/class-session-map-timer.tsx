'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BOOK_OVERLAY_GLASS_CHROME, CLASS_LAUNCH_CHROME } from '@/components/students/fullscreen-book-overlay/constants'
import {
  classAnnotationStateChangedSinceBaseline,
  discardClassAnnotationChanges,
  ensureClassAnnotationBaseline,
  flushAnnotationsForClassEnd,
  keepClassAnnotationChanges,
} from '@/lib/books/class-annotation-durability'
import {
  ensureBookAnnotationsHydrated,
  flushBookAnnotationsToDiskAsync,
} from '@/lib/local-data/book-annotations-disk-client'
import { computeClassTimerState } from '@/lib/students/class-session-timer'
import {
  CLASS_EXTEND_CHIP_MINUTES,
  canExtendClassBy,
  computeClassLiveClockPhase,
  findNextStudentSoon,
} from '@/lib/students/class-schedule-lifecycle'
import { cn } from '@/lib/utils'
import {
  cancelClassOccurrence,
  endStudentClassSession,
  extendStudentClassSession,
  getTodaysClassSessionsForTeacher,
  hardAutoEndStudentClassSession,
} from '@/lib/students/selectors'
import type { StudentClassSessionView } from '@/lib/students/types'
import { MoveClassDialog } from '@/components/schedule/move-class-dialog'
import { buildReadingCheckClassWrapSummary } from '@/lib/books/reading-check-class-wrap'
import type { ReadingCheckClassWrapSummary } from '@/lib/books/reading-check-live-marks'
import { toast } from 'sonner'

/**
 * TEST ONLY — class timer “time warp” on the map.
 * Set to `false` (or delete the guarded UI + effects below) before release.
 */
const ENABLE_TIME_WARP_FOR_TESTING = false

/** Half the draggable track in px; pull up (negative) = faster class time. */
const MAX_HANDLE_OFFSET_PX = 40
/** At full pull up, class clock runs this many – real time. */
const TIME_WARP_MAX_MULTIPLIER = 80
/** At full pull down, class clock runs this many – real time (still > 0). */
const TIME_WARP_MIN_MULTIPLIER = 0.08

function buildAutoBookmarkAtEnd(
  session: StudentClassSessionView,
  assignedBookIds: string[],
): { bookId: string; pdfPage: number; unitId?: string } | null {
  const bookId = (session.selectedSection?.bookId ?? assignedBookIds[0] ?? '').trim()
  if (!bookId) return null
  const s = session.selectedSection
  const hint = s?.endPageHint ?? s?.startPageHint
  const pdfPage =
    typeof hint === 'number' && Number.isFinite(hint) && hint >= 1 ? Math.floor(hint) : 1
  const unitId = s?.unitId?.trim() || undefined
  return unitId ? { bookId, pdfPage, unitId } : { bookId, pdfPage }
}

export interface ClassSessionMapTimerProps {
  studentId: string
  studentName: string
  session: StudentClassSessionView
  assignedBookIds: string[]
  /** Raise above map chrome when the book overlay is open. */
  elevated?: boolean
  /**
   * Manual end success — show student wrap instead of leaving immediately.
   * Hard auto-end still navigates to `/students`.
   */
  onClassEnded?: (payload: {
    sessionId: string
    summary: ReadingCheckClassWrapSummary
  }) => void
}

function multiplierFromHandleOffsetPx(offsetPx: number): number {
  const n = Math.max(-1, Math.min(1, offsetPx / MAX_HANDLE_OFFSET_PX))
  if (n <= 0) {
    return 1 + (-n) * (TIME_WARP_MAX_MULTIPLIER - 1)
  }
  return 1 - n * (1 - TIME_WARP_MIN_MULTIPLIER)
}

export function ClassSessionMapTimer({
  studentId,
  studentName,
  session,
  assignedBookIds,
  elevated = false,
  onClassEnded,
}: ClassSessionMapTimerProps) {
  const router = useRouter()
  const { scheduledFor, durationMin, extendedMinutesTotal = 0 } = session
  const [extendBusy, setExtendBusy] = useState(false)
  const [autoEnding, setAutoEnding] = useState(false)
  const autoEndStartedRef = useRef(false)

  const skewRef = useRef(0)
  const handleOffsetRef = useRef(0)
  const [handleOffsetPx, setHandleOffsetPx] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const [endOpen, setEndOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [annotationPromptOpen, setAnnotationPromptOpen] = useState(false)
  const [endBusy, setEndBusy] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)
  const [endRecapDraft, setEndRecapDraft] = useState('')
  const [endSessionNoteDraft, setEndSessionNoteDraft] = useState('')

  const dragRef = useRef<{ pointerId: number; startClientY: number; startOffset: number } | null>(null)

  const setHandleOffsetClamped = useCallback((px: number) => {
    const c = Math.max(-MAX_HANDLE_OFFSET_PX, Math.min(MAX_HANDLE_OFFSET_PX, px))
    handleOffsetRef.current = c
    setHandleOffsetPx(c)
  }, [])

  useEffect(() => {
    if (!ENABLE_TIME_WARP_FOR_TESTING) return
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(t - last, 120)
      last = t
      const m = multiplierFromHandleOffsetPx(handleOffsetRef.current)
      skewRef.current += (m - 1) * dt
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const intervalMs = ENABLE_TIME_WARP_FOR_TESTING ? 100 : 1000
    const id = window.setInterval(() => {
      setNowMs(Date.now() + (ENABLE_TIME_WARP_FOR_TESTING ? skewRef.current : 0))
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await ensureBookAnnotationsHydrated()
      if (cancelled) return
      ensureClassAnnotationBaseline(studentId, session.id)
    })()
    return () => {
      cancelled = true
    }
  }, [studentId, session.id])

  const onPointerDownHandle = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!ENABLE_TIME_WARP_FOR_TESTING) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientY: e.clientY,
      startOffset: handleOffsetRef.current,
    }
  }, [])

  const onPointerMoveHandle = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!ENABLE_TIME_WARP_FOR_TESTING) return
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const delta = e.clientY - d.startClientY
      const next = d.startOffset + delta
      setHandleOffsetClamped(next)
    },
    [setHandleOffsetClamped],
  )

  const onPointerUpHandle = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!ENABLE_TIME_WARP_FOR_TESTING) return
    if (dragRef.current && e.pointerId === dragRef.current.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      dragRef.current = null
    }
  }, [])

  const resetWarp = useCallback(() => {
    skewRef.current = 0
    handleOffsetRef.current = 0
    setHandleOffsetPx(0)
    setNowMs(Date.now())
  }, [])

  const { label, suffix: baseSuffix, variant } = useMemo(
    () => computeClassTimerState(scheduledFor, durationMin, nowMs, extendedMinutesTotal),
    [scheduledFor, durationMin, nowMs, extendedMinutesTotal],
  )

  const phase = useMemo(
    () => computeClassLiveClockPhase(scheduledFor, durationMin, nowMs, extendedMinutesTotal),
    [scheduledFor, durationMin, nowMs, extendedMinutesTotal],
  )

  const suffix =
    phase === 'grace' ? 'grace' : phase === 'must_end' ? 'ending' : baseSuffix

  const showExtendChrome = phase === 'grace' || phase === 'must_end'
  const showExtendChips = phase === 'grace'

  const nextStudentSoon = useMemo(() => {
    if (phase !== 'grace') return null
    return findNextStudentSoon(getTodaysClassSessionsForTeacher(), session.id, nowMs)
  }, [phase, session.id, nowMs])

  useEffect(() => {
    if (phase !== 'must_end') return
    if (autoEndStartedRef.current || autoEnding || endBusy) return
    autoEndStartedRef.current = true
    setAutoEnding(true)
    void (async () => {
      try {
        await flushAnnotationsForClassEnd()
        keepClassAnnotationChanges(session.id)
        let wrapLine: string | undefined
        try {
          const wrap = await buildReadingCheckClassWrapSummary({
            classSessionId: session.id,
            studentId,
          })
          wrapLine = wrap.wrapLine
        } catch {
          wrapLine = undefined
        }
        const result = hardAutoEndStudentClassSession(
          studentId,
          session.id,
          wrapLine ? { readingCheckWrapLine: wrapLine } : undefined,
        )
        if (!result.ok) {
          autoEndStartedRef.current = false
          setAutoEnding(false)
          toast.error(result.error)
          return
        }
        if (!result.alreadyEnded) {
          toast.message(`${result.studentName}'s class ended (time's up)`, {
            description: 'You can add a note later from Past classes.',
          })
        }
        router.replace('/students')
        router.refresh()
      } catch {
        autoEndStartedRef.current = false
        setAutoEnding(false)
        toast.error('Could not end class automatically. Tap End.')
      }
    })()
  }, [phase, autoEnding, endBusy, studentId, session.id, router])

  const shell = (() => {
    if (elevated) {
      if (variant === 'over') {
        return 'border-red-400/45 bg-red-500/25 text-red-50 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px]'
      }
      if (variant === 'warning') {
        return 'motion-safe:animate-pulse border-amber-400/40 bg-amber-500/20 text-amber-50 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px]'
      }
      if (variant === 'muted') {
        return cn(BOOK_OVERLAY_GLASS_CHROME, 'text-white/55')
      }
      return cn(BOOK_OVERLAY_GLASS_CHROME, 'text-white/85')
    }
    if (variant === 'over') {
      return 'border-red-700/45 bg-red-200/85 text-red-950 shadow-sm backdrop-blur-sm'
    }
    if (variant === 'warning') {
      return 'motion-safe:animate-pulse border-[#b48218]/55 bg-[#f0c040]/90 text-[#5c3d0a] shadow-sm backdrop-blur-sm'
    }
    if (variant === 'muted') {
      return cn(CLASS_LAUNCH_CHROME, 'opacity-80')
    }
    return CLASS_LAUNCH_CHROME
  })()

  const warpMult = ENABLE_TIME_WARP_FOR_TESTING ? multiplierFromHandleOffsetPx(handleOffsetPx) : 1

  function handleEndOpenChange(open: boolean) {
    setEndOpen(open)
    if (!open) {
      setEndError(null)
      setEndRecapDraft('')
      setEndSessionNoteDraft('')
      setAnnotationPromptOpen(false)
    }
  }

  function finishClass(
    result: ReturnType<typeof endStudentClassSession>,
    wrap?: { summary: ReadingCheckClassWrapSummary },
  ) {
    setEndBusy(false)
    if (!result.ok) {
      setEndError(result.error)
      setAnnotationPromptOpen(false)
      return
    }
    setAnnotationPromptOpen(false)
    setEndOpen(false)
    if (onClassEnded && wrap) {
      onClassEnded({ sessionId: session.id, summary: wrap.summary })
      return
    }
    router.replace('/students')
    router.refresh()
  }

  async function resolveWrapForEnd(): Promise<{
    summary: ReadingCheckClassWrapSummary
    wrapLine: string | undefined
  }> {
    try {
      return await buildReadingCheckClassWrapSummary({
        classSessionId: session.id,
        studentId,
      })
    } catch {
      return {
        summary: {
          attempted: 0,
          correct: 0,
          incorrect: 0,
          skip: 0,
          storyIds: [],
          totalInPack: null,
        },
        wrapLine: undefined,
      }
    }
  }

  async function confirmEndClassWithSave() {
    setEndError(null)
    const bookmark = buildAutoBookmarkAtEnd(session, assignedBookIds)
    if (!bookmark) {
      setEndError('Assign a book or choose a section in Prep so we can save the lesson bookmark.')
      return
    }
    setEndBusy(true)
    try {
      await flushAnnotationsForClassEnd()
      keepClassAnnotationChanges(session.id)
      const { summary, wrapLine } = await resolveWrapForEnd()
      const recap = endRecapDraft.trim()
      const sessionLog = endSessionNoteDraft.trim()
      const result = endStudentClassSession(studentId, session.id, {
        bookmarkAtEnd: bookmark,
        ...(recap ? { classEndNote: recap } : {}),
        ...(sessionLog ? { sessionNote: sessionLog } : {}),
        ...(wrapLine ? { readingCheckWrapLine: wrapLine } : {}),
      })
      finishClass(result, { summary })
    } catch {
      setEndBusy(false)
      setEndError('Could not save book annotations. Try again.')
    }
  }

  async function beginEndClassWithoutSave() {
    setEndError(null)
    setEndBusy(true)
    try {
      await flushAnnotationsForClassEnd()
      const changed = classAnnotationStateChangedSinceBaseline(studentId, session.id)
      if (changed) {
        setEndBusy(false)
        setAnnotationPromptOpen(true)
        return
      }
      keepClassAnnotationChanges(session.id)
      const { summary, wrapLine } = await resolveWrapForEnd()
      const result = endStudentClassSession(studentId, session.id, {
        ...(wrapLine ? { readingCheckWrapLine: wrapLine } : {}),
      })
      finishClass(result, { summary })
    } catch {
      setEndBusy(false)
      setEndError('Could not save book annotations. Try again.')
    }
  }

  async function confirmEndWithoutSaveKeepAnnotations() {
    setEndError(null)
    setEndBusy(true)
    try {
      await flushAnnotationsForClassEnd()
      keepClassAnnotationChanges(session.id)
      const { summary, wrapLine } = await resolveWrapForEnd()
      const result = endStudentClassSession(studentId, session.id, {
        ...(wrapLine ? { readingCheckWrapLine: wrapLine } : {}),
      })
      finishClass(result, { summary })
    } catch {
      setEndBusy(false)
      setEndError('Could not save book annotations. Try again.')
    }
  }

  async function confirmEndWithoutSaveDiscardAnnotations() {
    setEndError(null)
    setEndBusy(true)
    try {
      // Restore class-start marks first (suppresses live ink flush), then force disk write.
      const restored = discardClassAnnotationChanges(studentId, session.id)
      if (!restored) {
        setEndBusy(false)
        setEndError('Could not restore earlier annotations. Keep them instead, or try again.')
        return
      }
      await flushBookAnnotationsToDiskAsync()
      const { summary, wrapLine } = await resolveWrapForEnd()
      const result = endStudentClassSession(studentId, session.id, {
        ...(wrapLine ? { readingCheckWrapLine: wrapLine } : {}),
      })
      finishClass(result, { summary })
    } catch {
      setEndBusy(false)
      setEndError('Could not update book annotations. Try again.')
    }
  }

  function cancelAnnotationPrompt() {
    setAnnotationPromptOpen(false)
    setEndError(null)
  }

  async function handleCancelLiveClass() {
    if (cancelBusy || endBusy) return
    const ok = window.confirm(
      `Cancel this class for ${studentName}? It won’t happen. Prep and board stay; this slot won’t count as taught.`,
    )
    if (!ok) return
    setCancelBusy(true)
    try {
      await flushAnnotationsForClassEnd()
      keepClassAnnotationChanges(session.id)
      const result = cancelClassOccurrence(studentId, session.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Class cancelled')
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel class.')
    } finally {
      setCancelBusy(false)
    }
  }

  function handleExtend(addMinutes: number) {
    if (extendBusy || !canExtendClassBy(extendedMinutesTotal, addMinutes)) return
    setExtendBusy(true)
    try {
      const result = extendStudentClassSession(studentId, session.id, addMinutes)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Extended +${addMinutes} min`)
    } finally {
      setExtendBusy(false)
    }
  }

  const chipBtn = (elevatedChip: boolean) =>
    cn(
      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-40',
      elevatedChip
        ? 'bg-white/10 text-white/90 ring-1 ring-white/15 hover:bg-white/15'
        : 'bg-[#5c3d0a]/12 text-[#5c3d0a] ring-1 ring-[#5c3d0a]/20 hover:bg-[#5c3d0a]/18',
    )

  return (
    <>
      <div
        className={cn(
          'pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1.5 border px-3 py-1.5 shadow-sm',
          showExtendChrome ? 'rounded-2xl' : 'rounded-full',
          elevated
            ? 'z-[60] max-w-[min(100vw-2rem,28rem)] text-sm'
            : 'z-40 max-w-[min(100vw-2rem,30rem)] text-sm',
          shell,
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'font-mono text-sm font-semibold tabular-nums tracking-tight',
                elevated && 'text-white',
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wide',
                elevated ? 'text-white/70' : 'opacity-80',
              )}
            >
              {suffix}
            </span>
          </div>
          <button type="button" className={chipBtn(elevated)} onClick={() => setMoveOpen(true)} disabled={cancelBusy || endBusy}>
            Move instead
          </button>
          <button
            type="button"
            className={chipBtn(elevated)}
            onClick={() => void handleCancelLiveClass()}
            disabled={cancelBusy || endBusy}
          >
            {cancelBusy ? '…' : 'Cancel'}
          </button>
          <button type="button" className={chipBtn(elevated)} onClick={() => handleEndOpenChange(true)} disabled={cancelBusy || endBusy}>
            End
          </button>
        </div>

        {showExtendChrome ? (
          <div className="flex w-full flex-col items-center gap-1.5 border-t border-black/10 pb-0.5 pt-1.5 dark:border-white/15">
            {phase === 'must_end' || autoEnding ? (
              <p
                className={cn(
                  'text-center text-[10px] font-medium',
                  elevated ? 'text-white/80' : 'text-[#5c3d0a]/90',
                )}
              >
                {autoEnding ? 'Ending class…' : "Time's up — ending class now."}
              </p>
            ) : (
              <p
                className={cn(
                  'text-center text-[10px] font-medium',
                  elevated ? 'text-white/80' : 'text-[#5c3d0a]/90',
                )}
              >
                {nextStudentSoon
                  ? `${nextStudentSoon.studentName} in ${nextStudentSoon.minutesUntilStart} min — End or +2?`
                  : `Overtime grace — End now or add a little time${
                      extendedMinutesTotal > 0 ? ` (+${extendedMinutesTotal} so far)` : ''
                    }.`}
              </p>
            )}
            {showExtendChips ? (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {CLASS_EXTEND_CHIP_MINUTES.map((mins) => {
                  const allowed = canExtendClassBy(extendedMinutesTotal, mins)
                  return (
                    <button
                      key={mins}
                      type="button"
                      disabled={extendBusy || autoEnding || !allowed}
                      className={chipBtn(elevated)}
                      title={
                        allowed
                          ? `Add ${mins} minutes (max +15 total overtime)`
                          : 'Would pass the +15 minute overtime cap'
                      }
                      onClick={() => handleExtend(mins)}
                    >
                      +{mins}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <MoveClassDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        studentId={studentId}
        studentName={studentName}
        session={session}
        onMoved={() => {
          setMoveOpen(false)
          router.replace('/dashboard')
          router.refresh()
        }}
      />

      <Dialog open={endOpen && !annotationPromptOpen} onOpenChange={handleEndOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark finished?</DialogTitle>
            <DialogDescription>
              Counts as taught. Add a short note for next time if you want — then save.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="end-class-recap" className="text-sm font-medium text-foreground">
              Quick note (optional)
            </Label>
            <Textarea
              id="end-class-recap"
              rows={3}
              className="resize-none text-sm"
              placeholder="e.g. parent cut short — finished story; review vocab next time…"
              value={endRecapDraft}
              onChange={(e) => setEndRecapDraft(e.target.value)}
              disabled={endBusy}
            />
            <Label htmlFor="end-class-session-note" className="text-sm font-medium text-foreground">
              Session log (optional)
            </Label>
            <Textarea
              id="end-class-session-note"
              rows={5}
              className="min-h-[100px] text-sm"
              placeholder="Longer notes: pages covered, what worked, homework…"
              value={endSessionNoteDraft}
              onChange={(e) => setEndSessionNoteDraft(e.target.value)}
              disabled={endBusy}
            />
          </div>
          {endError ? <p className="text-sm text-destructive">{endError}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleEndOpenChange(false)} disabled={endBusy}>
              Keep teaching
            </Button>
            <Button type="button" variant="secondary" onClick={() => void beginEndClassWithoutSave()} disabled={endBusy}>
              {endBusy ? 'Ending…' : 'Finish without bookmark'}
            </Button>
            <Button type="button" onClick={() => void confirmEndClassWithSave()} disabled={endBusy}>
              {endBusy ? 'Saving…' : 'Save & finish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={annotationPromptOpen}
        onOpenChange={(open) => {
          if (!open && !endBusy) cancelAnnotationPrompt()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keep book annotations?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>
                  You chose not to save the lesson bookmark and notes. Marks you made in the book this class
                  can still be kept for next time.
                </p>
                <p className="text-xs">
                  Discard only removes marks added during this class. Older marks stay.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {endError ? <p className="text-sm text-destructive">{endError}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={cancelAnnotationPrompt} disabled={endBusy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void confirmEndWithoutSaveDiscardAnnotations()}
              disabled={endBusy}
            >
              {endBusy ? 'Ending…' : 'Discard annotations'}
            </Button>
            <Button
              type="button"
              onClick={() => void confirmEndWithoutSaveKeepAnnotations()}
              disabled={endBusy}
            >
              {endBusy ? 'Saving…' : 'Keep annotations'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ENABLE_TIME_WARP_FOR_TESTING ? (
        <div className="pointer-events-auto absolute right-3 top-3 z-40 flex select-none flex-col items-center gap-1 rounded-lg border border-dashed border-amber-600/50 bg-amber-950/10 px-2 py-2 text-[10px] text-amber-950 shadow-sm backdrop-blur-sm dark:bg-amber-950/30 dark:text-amber-50">
          <span className="font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">Test time</span>
          <div className="relative flex h-[104px] w-9 flex-col items-center justify-between py-0.5">
            <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <div className="relative my-0.5 h-[72px] w-full rounded-full bg-amber-900/15 dark:bg-amber-100/10">
              <div className="absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-amber-700/40 dark:bg-amber-200/30" />
              <button
                type="button"
                title="Drag up = faster class clock, down = slower. For testing only."
                aria-label="Adjust test time speed"
                className="absolute left-1/2 flex h-7 w-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-amber-600 bg-amber-100 shadow-md active:cursor-grabbing dark:border-amber-400 dark:bg-amber-900"
                style={{
                  top: `calc(50% + ${handleOffsetPx}px - 14px)`,
                }}
                onPointerDown={onPointerDownHandle}
                onPointerMove={onPointerMoveHandle}
                onPointerUp={onPointerUpHandle}
                onPointerCancel={onPointerUpHandle}
              >
                <span className="text-[9px] font-bold leading-none text-amber-900 dark:text-amber-100">↕</span>
              </button>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          </div>
          <span className="font-mono text-[10px] tabular-nums opacity-90">{warpMult.toFixed(1)}–</span>
          <button
            type="button"
            className="rounded border border-amber-700/40 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-900 hover:bg-amber-200/40 dark:border-amber-300/40 dark:text-amber-100 dark:hover:bg-amber-800/40"
            onClick={resetWarp}
          >
            Reset
          </button>
        </div>
      ) : null}
    </>
  )
}
