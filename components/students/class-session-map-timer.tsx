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
import { computeClassTimerState } from '@/lib/students/class-session-timer'
import { endStudentClassSession } from '@/lib/students/selectors'
import type { StudentClassSessionView } from '@/lib/students/types'

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
  session: StudentClassSessionView
  assignedBookIds: string[]
}

function multiplierFromHandleOffsetPx(offsetPx: number): number {
  const n = Math.max(-1, Math.min(1, offsetPx / MAX_HANDLE_OFFSET_PX))
  if (n <= 0) {
    return 1 + (-n) * (TIME_WARP_MAX_MULTIPLIER - 1)
  }
  return 1 - n * (1 - TIME_WARP_MIN_MULTIPLIER)
}

export function ClassSessionMapTimer({ studentId, session, assignedBookIds }: ClassSessionMapTimerProps) {
  const router = useRouter()
  const { title, classStartedAt, durationMin } = session

  const skewRef = useRef(0)
  const handleOffsetRef = useRef(0)
  const [handleOffsetPx, setHandleOffsetPx] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const [endOpen, setEndOpen] = useState(false)
  const [endBusy, setEndBusy] = useState(false)
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

  const { label, suffix, variant } = useMemo(
    () => computeClassTimerState(classStartedAt, durationMin, nowMs),
    [classStartedAt, durationMin, nowMs],
  )
  const notebookHeaderPreview = useMemo(() => {
    const firstSection = session.lessonNotebookSession?.sections?.[0]
    if (!firstSection) return null
    const firstDocEntry = firstSection.entries.find((entry) => entry.layer === 'doc' && entry.payload?.kind === 'header_block')
    const title = typeof firstDocEntry?.payload?.title === 'string' ? firstDocEntry.payload.title : 'Lesson Notes'
    return {
      sectionTitle: firstSection.title,
      title,
    }
  }, [session.lessonNotebookSession])

  const shell =
    variant === 'over'
      ? 'border-red-500/45 bg-red-500/12 text-red-950 dark:text-red-50'
      : variant === 'warning'
        ? 'motion-safe:animate-pulse border-amber-500/50 bg-amber-500/20 text-amber-950 dark:text-amber-50'
        : variant === 'muted'
          ? 'border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground'
          : 'border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-50'

  const warpMult = ENABLE_TIME_WARP_FOR_TESTING ? multiplierFromHandleOffsetPx(handleOffsetPx) : 1

  function handleEndOpenChange(open: boolean) {
    setEndOpen(open)
    if (!open) {
      setEndError(null)
      setEndRecapDraft('')
      setEndSessionNoteDraft('')
    }
  }

  function confirmEndClass() {
    setEndError(null)
    const bookmark = buildAutoBookmarkAtEnd(session, assignedBookIds)
    if (!bookmark) {
      setEndError('Assign a book or choose a section in Prep so we can save the lesson bookmark.')
      return
    }
    setEndBusy(true)
    const recap = endRecapDraft.trim()
    const sessionLog = endSessionNoteDraft.trim()
    const result = endStudentClassSession(studentId, session.id, {
      bookmarkAtEnd: bookmark,
      ...(recap ? { classEndNote: recap } : {}),
      ...(sessionLog ? { sessionNote: sessionLog } : {}),
    })
    setEndBusy(false)
    if (!result.ok) {
      setEndError(result.error)
      return
    }
    setEndOpen(false)
    router.replace('/students')
    router.refresh()
  }

  return (
    <>
      <div
        className={`pointer-events-auto absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm ${shell}`}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-bold tabular-nums tracking-tight">{label}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{suffix}</span>
        </div>
        <button
          type="button"
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-85 ring-1 ring-black/10 transition-colors hover:opacity-100 dark:ring-white/15"
          onClick={() => handleEndOpenChange(true)}
        >
          End
        </button>
      </div>

      <Dialog open={endOpen} onOpenChange={handleEndOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End class?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>Are you sure you want to end this class now?</p>
                <div>
                  <p className="font-medium text-foreground">Saved automatically</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                    <li>Class finished + end time</li>
                    <li>Lesson bookmark + reader curriculum page (when a unit can be matched)</li>
                    <li>Reader annotations (already stored as you mark the book)</li>
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground/90">Later: words or phrases flagged for review.</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="end-class-recap" className="text-sm font-medium text-foreground">
              Quick recap (optional)
            </Label>
            <Textarea
              id="end-class-recap"
              rows={3}
              className="resize-none text-sm"
              placeholder="One line for next time, e.g. what to repeat or skip…"
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
              placeholder="Longer notes for this call: pages you covered, what worked, homework, plan for next time…"
              value={endSessionNoteDraft}
              onChange={(e) => setEndSessionNoteDraft(e.target.value)}
              disabled={endBusy}
            />
          </div>
          {endError ? <p className="text-sm text-destructive">{endError}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleEndOpenChange(false)} disabled={endBusy}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmEndClass} disabled={endBusy}>
              {endBusy ? 'Saving…' : 'End class'}
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
