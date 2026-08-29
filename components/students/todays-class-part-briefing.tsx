'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { teacherFocusRingClass, teacherQuietBtnClass } from '@/components/teacher-chrome'
import type { TodaysClassPartBriefing } from '@/lib/students/todays-class-briefing'
import { cn } from '@/lib/utils'

export interface TodaysClassPartBriefingPanelProps {
  studentId: string
  bookId: string
  unitId: string
  lessonId?: string
  partId?: string
  tag?: string | null
  isStart: boolean
  skipped: boolean
  starredWords: string[]
  busy?: boolean
  onSetStartHere: () => void
  onToggleSkip: () => void
  onToggleStar: (word: string) => void
}

function isStarred(starredWords: string[], word: string) {
  const key = word.trim().toLowerCase()
  return starredWords.some((row) => row.trim().toLowerCase() === key)
}

export function TodaysClassPartBriefingPanel({
  studentId,
  bookId,
  unitId,
  lessonId,
  partId,
  tag,
  isStart,
  skipped,
  starredWords,
  busy = false,
  onSetStartHere,
  onToggleSkip,
  onToggleStar,
}: TodaysClassPartBriefingPanelProps) {
  const [briefing, setBriefing] = useState<TodaysClassPartBriefing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ bookId, unitId, studentId })
    if (lessonId) params.set('lessonId', lessonId)
    if (partId) params.set('partId', partId)
    if (tag) params.set('tag', tag)
    setLoading(true)
    setBriefing(null)
    void fetch(`/api/classes/part-briefing?${params.toString()}`)
      .then(async (res) => {
        const payload = (await res.json()) as { ok?: boolean; briefing?: TodaysClassPartBriefing }
        if (!cancelled && res.ok && payload.ok && payload.briefing) {
          setBriefing(payload.briefing)
        }
      })
      .catch(() => {
        if (!cancelled) setBriefing(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId, bookId, unitId, lessonId, partId, tag])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {isStart ? (
          <span className="inline-flex h-9 items-center rounded-full bg-[var(--brand-blue)]/12 px-3 text-[12px] font-semibold tracking-tight text-[var(--brand-blue)]">
            Start here
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onSetStartHere}
            className={cn(teacherQuietBtnClass, teacherFocusRingClass)}
          >
            Start here
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onToggleSkip}
          className={cn(teacherQuietBtnClass, teacherFocusRingClass, skipped && 'text-muted-foreground')}
        >
          {skipped ? 'Skipped this class' : 'Skip this class'}
        </Button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading this part…
        </p>
      ) : briefing == null ? (
        <p className="text-[13px] text-muted-foreground">Couldn’t load this part.</p>
      ) : (
        <div className="space-y-4">
          {briefing.words.length > 0 ? (
            <div className="space-y-2">
              <h3 className="ui-section-title">Words</h3>
              <ul className="flex flex-wrap gap-2">
                {briefing.words.map((row) => {
                  const starred = isStarred(starredWords, row.word)
                  return (
                    <li key={row.word}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onToggleStar(row.word)}
                        title={starred ? 'Remove from this class' : 'Star for this class'}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-left chrome-motion',
                          teacherFocusRingClass,
                          starred
                            ? 'bg-[var(--brand-blue)]/12 text-foreground'
                            : 'bg-[var(--surface-3)] text-foreground hover:bg-[var(--surface-4)]',
                        )}
                      >
                        <Star
                          className={cn('h-3.5 w-3.5 shrink-0', starred && 'fill-current text-[var(--brand-blue)]')}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold tracking-tight">{row.word}</span>
                          {row.definition ? (
                            <span className="block truncate text-[11px] text-muted-foreground">{row.definition}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[12px] text-muted-foreground">Star a word to hit it this hour. Meanings stay on the book.</p>
            </div>
          ) : null}

          {briefing.storyExcerpt ? (
            <div className="space-y-2">
              <h3 className="ui-section-title">{briefing.storyTitle ?? 'Story'}</h3>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed tracking-tight text-foreground">
                {briefing.storyExcerpt}
              </p>
              {briefing.checksLabel ? (
                <p className="text-[12px] text-muted-foreground">{briefing.checksLabel}</p>
              ) : null}
            </div>
          ) : briefing.checksLabel ? (
            <p className="text-[13px] text-muted-foreground">{briefing.checksLabel}</p>
          ) : null}

          {briefing.lines.length > 0 ? (
            <div className="space-y-2">
              <h3 className="ui-section-title">Notes from the book</h3>
              <ul className="space-y-1.5">
                {briefing.lines.map((line) => (
                  <li key={line} className="text-[14px] leading-relaxed tracking-tight text-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {briefing.empty ? (
            <p className="text-[13px] text-muted-foreground">{briefing.emptyLabel}</p>
          ) : null}

          <Link
            href={briefing.workshopHref}
            className={cn(
              'inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold tracking-tight text-muted-foreground hover:bg-[var(--chrome-pill-hover)] hover:text-foreground',
              teacherFocusRingClass,
            )}
          >
            Open in Books
          </Link>
        </div>
      )}
    </div>
  )
}
