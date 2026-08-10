'use client'

import { useState } from 'react'
import { BookMarked, Check, Copy, MapPin, Quote, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReadingCheckGamePopup } from '@/components/books/reading-check-game-popup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  dismissReadingCheckPlacementUi,
  requestReadingCheckHotspotPlacement,
} from '@/lib/books/reading-check-hotspot-placement-events'
import {
  createEmptyReadingCheckQuestion,
  isReadingCheckStopIncomplete,
  primaryQuestionOfStop,
  splitEvidenceSnippetForHighlight,
  stopHasReadingCheckHotspot,
  type ReadingCheckQuestion,
  type ReadingCheckQuestionKind,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import {
  ensureReadingCheckStopPlacement,
  isDefaultReadingCheckHotspotCoords,
} from '@/lib/books/reading-check-placement'
import { cn } from '@/lib/utils'

interface StoryCheckQuestionCardProps {
  stop: ReadingCheckStop
  index: number
  storyId: string
  bookId: string
  unitId: string
  onChange: (next: ReadingCheckStop) => void
  onDuplicate: () => void
  onDelete: () => void
}

export function StoryCheckQuestionCard({
  stop,
  index,
  storyId,
  bookId,
  unitId,
  onChange,
  onDuplicate,
  onDelete,
}: StoryCheckQuestionCardProps) {
  const [storyOpen, setStoryOpen] = useState(false)
  const [tryoutOpen, setTryoutOpen] = useState(false)
  const q = primaryQuestionOfStop(stop)
  const incomplete = isReadingCheckStopIncomplete(stop)
  const whereSummary = [
    stop.displayPage != null ? `p${stop.displayPage}` : null,
    stop.label.trim() || null,
    stopHasReadingCheckHotspot(stop) ? 'pinned' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const canTry = Boolean(q?.prompt.trim())

  if (!q) return null
  const question = q

  const evidenceSnippet = question.evidenceSnippet?.trim() || null
  const evidenceParts = evidenceSnippet
    ? splitEvidenceSnippetForHighlight(evidenceSnippet, question.evidenceHighlight)
    : null
  const tryTitle = stop.label.trim() || `Check ${index + 1}`
  const pinStatus = !stop.hotspot
    ? null
    : stop.displayPage != null
      ? isDefaultReadingCheckHotspotCoords(stop.hotspot)
        ? `Page ${stop.displayPage} · pin at bottom (auto)`
        : `Pinned on page ${stop.displayPage}`
      : stop.hotspot.pdfPage != null
        ? `Pinned on book page ${stop.hotspot.pdfPage}`
        : 'Pinned on the book'

  function patchQuestion(patch: Partial<ReadingCheckQuestion>) {
    onChange({
      ...stop,
      questions: [{ ...question, ...patch } as ReadingCheckQuestion],
    })
  }

  function setKind(kind: ReadingCheckQuestionKind) {
    if (kind === question.kind) return
    const fresh = createEmptyReadingCheckQuestion(kind)
    onChange({
      ...stop,
      questions: [
        {
          ...fresh,
          prompt: question.prompt,
          evidenceSnippet: question.evidenceSnippet,
          evidenceHighlight: question.evidenceHighlight,
        },
      ],
    })
  }

  function openTryout() {
    if (!canTry) return
    setTryoutOpen(true)
  }

  function startPlaceOnBook() {
    const started = requestReadingCheckHotspotPlacement({
      stopId: stop.id,
      storyId,
      bookId,
      unitId,
    })
    if (!started) {
      toast.error('Open the student’s book first, then place the pin on the page.')
      return
    }
    dismissReadingCheckPlacementUi()
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-[var(--checks-card)]',
        incomplete ? 'border-[var(--checks-warn)]/50' : 'border-[var(--checks-border)]',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--checks-border)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--checks-accent-soft)] text-sm font-semibold tabular-nums text-[var(--checks-accent)]">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--checks-ink)]">Check {index + 1}</p>
            <p className="truncate text-[11px] text-[var(--checks-muted)]">
              {incomplete
                ? 'Needs a question and correct answer'
                : whereSummary || (q.kind === 'mcq' ? 'Multiple choice' : 'True / false')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-[var(--checks-muted)]"
            onClick={onDuplicate}
          >
            <Copy className="size-3.5" aria-hidden />
            <span className="sr-only">Duplicate</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-[var(--checks-muted)]"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" aria-hidden />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-[var(--checks-muted)]">Type</p>
              <div className="inline-flex rounded-md border border-[var(--checks-border)] bg-[var(--checks-bg)] p-0.5">
                <button
                  type="button"
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                    q.kind === 'mcq'
                      ? 'bg-white text-[var(--checks-ink)] shadow-sm'
                      : 'text-[var(--checks-muted)] hover:text-[var(--checks-ink)]',
                  )}
                  onClick={() => setKind('mcq')}
                >
                  Multiple choice
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                    q.kind === 'true_false'
                      ? 'bg-white text-[var(--checks-ink)] shadow-sm'
                      : 'text-[var(--checks-muted)] hover:text-[var(--checks-ink)]',
                  )}
                  onClick={() => setKind('true_false')}
                >
                  True / false
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <Label
                htmlFor={`check-stem-${stop.id}`}
                className="text-[11px] font-medium text-[var(--checks-muted)]"
              >
                Question
              </Label>
              <Textarea
                id={`check-stem-${stop.id}`}
                value={q.prompt}
                placeholder="What should the student answer?"
                className="min-h-[72px] flex-1 resize-none border-[var(--checks-border)] bg-white text-sm text-[var(--checks-ink)]"
                onChange={(e) => patchQuestion({ prompt: e.target.value })}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-[var(--checks-muted)]">Answers</p>
              <p className="text-[11px] text-[var(--checks-muted)]">
                {q.kind === 'mcq' ? 'Click letter = correct' : 'Click correct answer'}
              </p>
            </div>

            {q.kind === 'true_false' ? (
              <div className="grid grid-cols-2 gap-2 content-start">
                {([true, false] as const).map((value) => {
                  const selected = q.correctTrue === value
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      className={cn(
                        'relative rounded-lg border px-3 py-4 text-sm font-medium transition-colors',
                        selected
                          ? 'border-[var(--checks-ok)] bg-[var(--checks-ok-soft)] text-[var(--checks-ink)]'
                          : 'border-[var(--checks-border)] bg-white text-[var(--checks-muted)] hover:border-[var(--checks-accent)]/40',
                      )}
                      onClick={() => patchQuestion({ correctTrue: value })}
                    >
                      {selected ? (
                        <Check className="absolute right-2 top-2 size-3.5 text-[var(--checks-ok)]" aria-hidden />
                      ) : null}
                      {value ? 'True' : 'False'}
                    </button>
                  )
                })}
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {q.choices.map((choice, ci) => {
                  const selected = q.correctIndex === ci
                  const letter = String.fromCharCode(65 + ci)
                  return (
                    <li key={ci}>
                      <div
                        className={cn(
                          'flex items-stretch overflow-hidden rounded-lg border transition-colors',
                          selected
                            ? 'border-[var(--checks-ok)] bg-[var(--checks-ok-soft)]'
                            : 'border-[var(--checks-border)] bg-white',
                        )}
                      >
                        <button
                          type="button"
                          aria-label={`Mark option ${letter} correct`}
                          aria-pressed={selected}
                          className={cn(
                            'flex w-10 shrink-0 items-center justify-center border-r text-xs font-semibold',
                            selected
                              ? 'border-[var(--checks-ok)]/30 bg-[var(--checks-ok)] text-white'
                              : 'border-[var(--checks-border)] text-[var(--checks-muted)] hover:bg-[var(--checks-bg)]',
                          )}
                          onClick={() => patchQuestion({ correctIndex: ci })}
                        >
                          {letter}
                        </button>
                        <Input
                          value={choice}
                          placeholder={`Option ${letter}`}
                          className="h-10 flex-1 rounded-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
                          onChange={(e) => {
                            const next = [...q.choices]
                            next[ci] = e.target.value
                            patchQuestion({ choices: next })
                          }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <section className="rounded-xl border border-[var(--checks-border)] bg-[var(--checks-bg)]/70 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <BookMarked className="mt-0.5 size-4 shrink-0 text-[var(--checks-accent)]" aria-hidden />
              <div>
                <p className="text-sm font-medium text-[var(--checks-ink)]">On the book</p>
                <p className="text-[11px] text-[var(--checks-muted)]">
                  Page and pin are filled from the story when possible — review, then Move only if
                  needed. Practice answers are not saved.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {stop.hotspot ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-[var(--checks-muted)]"
                  onClick={() => onChange({ ...stop, hotspot: null })}
                >
                  Remove pin
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                onClick={startPlaceOnBook}
                disabled={stop.displayPage == null && !stop.hotspot}
                title={
                  stop.displayPage == null && !stop.hotspot
                    ? 'Set a page first, or generate checks from story text'
                    : undefined
                }
              >
                <MapPin className="size-3.5" aria-hidden />
                {stop.hotspot ? 'Move pin' : 'Place on the book'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8"
                disabled={!canTry}
                title={canTry ? 'Open the class-style popup (not saved)' : 'Write a question first'}
                onClick={openTryout}
              >
                Try this check
              </Button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`check-page-${stop.id}`} className="text-[var(--checks-muted)]">
                Page
              </Label>
              <Input
                id={`check-page-${stop.id}`}
                className="h-9 w-20 border-[var(--checks-border)] bg-white"
                inputMode="numeric"
                value={stop.displayPage ?? ''}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value))
                  const displayPage = Number.isFinite(n) && n >= 1 ? n : null
                  const next = { ...stop, displayPage }
                  onChange(
                    displayPage != null
                      ? ensureReadingCheckStopPlacement(next, { resetHotspot: true })
                      : { ...next, hotspot: null },
                  )
                }}
              />
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label htmlFor={`check-label-${stop.id}`} className="text-[var(--checks-muted)]">
                Beat label
              </Label>
              <Input
                id={`check-label-${stop.id}`}
                className="h-9 border-[var(--checks-border)] bg-white"
                value={stop.label}
                placeholder="e.g. After the market scene"
                onChange={(e) => onChange({ ...stop, label: e.target.value })}
              />
            </div>
            <div className="min-w-[8rem] flex-1 space-y-1">
              <Label htmlFor={`check-note-${stop.id}`} className="text-[var(--checks-muted)]">
                Mid-page note
              </Label>
              <Input
                id={`check-note-${stop.id}`}
                className="h-9 border-[var(--checks-border)] bg-white"
                value={stop.midPageNote ?? ''}
                placeholder="Optional"
                onChange={(e) =>
                  onChange({
                    ...stop,
                    midPageNote: e.target.value.trim() ? e.target.value : null,
                  })
                }
              />
            </div>
          </div>

          {pinStatus ? (
            <p className="rounded-lg border border-[var(--checks-border)] bg-white px-3 py-2.5 text-[12px] text-[var(--checks-ink)]">
              {pinStatus}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--checks-border)] bg-white px-3 py-3 text-[12px] text-[var(--checks-muted)]">
              {stop.displayPage == null
                ? 'No page yet — generate from story text, or type a page to drop the pin at the bottom.'
                : 'No pin yet. Set or confirm the page to place an automatic bottom pin, or Move on the open book.'}
            </p>
          )}
        </section>
      </div>

      {evidenceSnippet ? (
        <div className="shrink-0 border-t border-[var(--checks-border)] bg-[var(--checks-bg)]">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-[var(--checks-muted)] hover:text-[var(--checks-ink)]"
            onClick={() => setStoryOpen((v) => !v)}
            aria-expanded={storyOpen}
          >
            <Quote className="size-3.5 shrink-0" aria-hidden />
            <span className="flex-1 font-medium">
              {storyOpen ? 'In the story' : 'In the story — expand to verify'}
            </span>
          </button>
          {storyOpen ? (
            <div className="border-t border-[var(--checks-border)] bg-white px-4 py-3">
              <p className="text-sm leading-relaxed text-[var(--checks-ink)]">
                {evidenceParts ? (
                  <>
                    {evidenceParts.before}
                    <mark className="rounded-sm bg-amber-200/90 px-0.5 text-[var(--checks-ink)]">
                      {evidenceParts.mark}
                    </mark>
                    {evidenceParts.after}
                  </>
                ) : (
                  evidenceSnippet
                )}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {canTry ? (
        <ReadingCheckGamePopup
          open={tryoutOpen}
          onOpenChange={setTryoutOpen}
          stop={stop}
          question={q}
          title={tryTitle}
          mode="preview"
        />
      ) : null}
    </div>
  )
}
