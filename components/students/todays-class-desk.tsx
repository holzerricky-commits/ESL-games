'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, ListChecks, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  teacherFieldClass,
  teacherFocusRingClass,
  teacherGhostBtnClass,
  teacherPrimaryBtnClass,
  teacherQuietBtnClass,
} from '@/components/teacher-chrome'
import { TodaysClassPartBriefingPanel } from '@/components/students/todays-class-part-briefing'
import { resolveStudentAvatarUrl } from '@/lib/students/student-avatar-url'
import { formatClassCountdown } from '@/lib/students/class-schedule-lifecycle'
import { formatTodaysClassWhen, todaysClassPlaceLine } from '@/lib/students/todays-class-desk'
import { cn } from '@/lib/utils'

export interface TodaysClassDeskPartRow {
  id: string
  title: string
  kindLabel: string | null
  isStart: boolean
  skipped: boolean
  bookId: string
  unitId: string
  lessonId?: string
  partId?: string
  tag?: string | null
}

export interface TodaysClassDeskProps {
  studentId: string
  studentName: string
  avatarUrl?: string | null
  scheduledFor?: string | null
  durationMin?: number | null
  bookTitle?: string | null
  unitLabel?: string | null
  lessonLabel?: string | null
  lastStopLabel?: string | null
  parts: TodaysClassDeskPartRow[]
  onSetStartHere: (partId: string) => void
  starredWords: string[]
  onToggleStar: (word: string) => void
  onToggleSkip: (partId: string) => void
  notes: string
  onNotesChange: (value: string) => void
  onNotesBlur: () => void
  canContinue: boolean
  continueBusy: boolean
  onContinue: () => void
  onPreview: () => void
  onOpenChecksPrep: () => void
  onDone: () => void
  doneBusy: boolean
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function TodaysClassDesk({
  studentId,
  studentName,
  avatarUrl = null,
  scheduledFor = null,
  durationMin = null,
  bookTitle = null,
  unitLabel = null,
  lessonLabel = null,
  lastStopLabel = null,
  parts,
  onSetStartHere,
  starredWords,
  onToggleStar,
  onToggleSkip,
  notes,
  onNotesChange,
  onNotesBlur,
  canContinue,
  continueBusy,
  onContinue,
  onPreview,
  onOpenChecksPrep,
  onDone,
  doneBusy,
}: TodaysClassDeskProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [viewedPartId, setViewedPartId] = useState<string | null>(null)
  const avatarSrc = resolveStudentAvatarUrl(studentId, avatarUrl)
  const when = formatTodaysClassWhen(scheduledFor, durationMin)
  const countdown = formatClassCountdown(scheduledFor)
  const place = todaysClassPlaceLine({ bookTitle, unitLabel, lessonLabel })
  const firstName = studentName.trim().split(/\s+/)[0] || studentName
  const busy = continueBusy || doneBusy
  const startId = parts.find((part) => part.isStart)?.id ?? parts[0]?.id ?? null
  const selectedId =
    viewedPartId && parts.some((part) => part.id === viewedPartId) ? viewedPartId : startId
  const selected = parts.find((part) => part.id === selectedId) ?? null

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || busy) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if ((key === 'b' || key === '1') && canContinue) {
        e.preventDefault()
        onContinue()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, canContinue, onContinue])

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-background">
      <header className="chrome-frost absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="text-[13px] font-semibold tracking-tight text-muted-foreground">Today’s class</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onOpenChecksPrep}
            className={cn(teacherQuietBtnClass, teacherFocusRingClass, 'gap-1.5')}
          >
            <ListChecks className="h-4 w-4" aria-hidden />
            Checks
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onPreview}
            className={cn(teacherQuietBtnClass, teacherFocusRingClass)}
          >
            Preview
          </Button>
          <Button
            type="button"
            disabled={!canContinue || busy}
            onClick={onContinue}
            className={cn(teacherPrimaryBtnClass, teacherFocusRingClass, 'gap-1.5')}
          >
            {continueBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <BookOpen className="h-4 w-4" aria-hidden />
            )}
            Continue
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onDone}
            className={cn(teacherGhostBtnClass, teacherFocusRingClass, 'gap-1.5')}
          >
            {doneBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowLeft className="h-4 w-4" aria-hidden />}
            Done
          </Button>
        </div>
      </header>

      <div className="h-full min-h-0 overflow-y-auto px-4 pb-12 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0 space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
                {!imageFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground"
                    aria-hidden
                  >
                    {initialsFromName(studentName)}
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <h1 className="truncate text-[28px] font-semibold tracking-tight text-foreground">{firstName}</h1>
                <p className="truncate text-[13px] text-muted-foreground">
                  {[when, countdown, place.title, place.meta, lastStopLabel?.trim()].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            <section className="space-y-2">
              <h2 className="ui-section-title">This lesson</h2>
              {parts.length > 0 ? (
                <ul className="overflow-hidden rounded-2xl bg-[var(--surface-2)] ring-1 ring-[var(--chrome-frost-border)]">
                  {parts.map((part, index) => (
                    <li key={part.id} className={index > 0 ? 'border-t border-[var(--chrome-frost-border)]' : undefined}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setViewedPartId(part.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left chrome-motion',
                          teacherFocusRingClass,
                          part.id === selectedId ? 'bg-[var(--accent)]' : 'hover:bg-[var(--surface-3)]',
                          part.skipped && 'opacity-60',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold tracking-tight text-foreground">
                            {part.title}
                          </span>
                          {part.kindLabel && part.kindLabel.toLowerCase() !== part.title.toLowerCase() ? (
                            <span className="mt-0.5 block text-[12px] text-muted-foreground">{part.kindLabel}</span>
                          ) : null}
                        </span>
                        {part.isStart ? (
                          <span className="shrink-0 rounded-full bg-[var(--brand-blue)]/12 px-2.5 py-0.5 text-[11px] font-semibold tracking-tight text-[var(--brand-blue)]">
                            Start here
                          </span>
                        ) : null}
                        {part.skipped ? (
                          <span className="shrink-0 text-[11px] font-semibold tracking-tight text-muted-foreground">
                            Skip
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  {place.title
                    ? 'No lesson parts mapped for this book yet. Continue still opens the last page.'
                    : 'No book assigned'}
                </p>
              )}
            </section>
          </div>

          <section className="min-w-0 space-y-2">
            <h2 className="ui-section-title">{selected ? selected.title : 'This part'}</h2>
            {selected ? (
              <TodaysClassPartBriefingPanel
                studentId={studentId}
                bookId={selected.bookId}
                unitId={selected.unitId}
                lessonId={selected.lessonId}
                partId={selected.partId}
                tag={selected.tag}
                isStart={selected.isStart}
                skipped={selected.skipped}
                starredWords={starredWords}
                busy={busy}
                onSetStartHere={() => onSetStartHere(selected.id)}
                onToggleSkip={() => onToggleSkip(selected.id)}
                onToggleStar={onToggleStar}
              />
            ) : (
              <p className="text-[13px] text-muted-foreground">Tap a part to see what’s in it.</p>
            )}
          </section>

          <aside className="space-y-2 lg:sticky lg:top-20">
            <h2 className="ui-section-title">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={onNotesBlur}
              rows={8}
              placeholder="Private notes for this class"
              className={cn(teacherFieldClass, 'min-h-[10rem] resize-none')}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
