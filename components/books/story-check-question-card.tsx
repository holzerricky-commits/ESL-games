'use client'

import { useState } from 'react'
import { Check, Copy, Ellipsis, MapPin, Play, Quote, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReadingCheckGamePopup } from '@/components/books/reading-check-game-popup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  dismissReadingCheckPlacementUi,
  requestReadingCheckHotspotPlacement,
} from '@/lib/books/reading-check-hotspot-placement-events'
import {
  primaryQuestionOfStop,
  splitEvidenceSnippetForHighlight,
  type ReadingCheckQuestion,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import { ensureReadingCheckStopPlacement } from '@/lib/books/reading-check-placement'
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
  const [tryoutOpen, setTryoutOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [storyOpen, setStoryOpen] = useState(false)
  const q = primaryQuestionOfStop(stop)
  const canTry = Boolean(q?.prompt.trim())

  if (!q) return null
  const question = q

  const evidenceSnippet = question.evidenceSnippet?.trim() || null
  const evidenceParts = evidenceSnippet
    ? splitEvidenceSnippetForHighlight(evidenceSnippet, question.evidenceHighlight)
    : null
  const tryTitle = stop.label.trim() || `Check ${index + 1}`

  function patchQuestion(patch: Partial<ReadingCheckQuestion>) {
    onChange({
      ...stop,
      questions: [{ ...question, ...patch } as ReadingCheckQuestion],
    })
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
    <div className="grid w-full grid-cols-1 gap-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-blue)_12%,var(--surface-3))] text-[12px] font-semibold tabular-nums text-[var(--brand-blue)]">
            {index + 1}
          </span>
          <span className="text-[12px] font-medium text-muted-foreground">
            {q.kind === 'true_false' ? 'True / false' : 'Multiple choice'}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-full p-0 text-muted-foreground"
            onClick={onDuplicate}
          >
            <Copy className="size-3.5" aria-hidden />
            <span className="sr-only">Duplicate</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-full p-0 text-muted-foreground"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" aria-hidden />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>

      {/* One shared column: question + answers same edge-to-edge width */}
      <div className="grid w-full grid-cols-1 gap-y-4">
        <Textarea
          id={`check-stem-${stop.id}`}
          value={q.prompt}
          placeholder="Question"
          rows={2}
          className="col-span-full max-h-[5.5rem] min-h-0 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[34px] font-bold leading-[1.15] tracking-tight text-foreground shadow-none placeholder:font-semibold placeholder:text-muted-foreground/40 focus-visible:ring-0 sm:max-h-[6.5rem] sm:text-[40px] md:text-[40px]"
          onChange={(e) => patchQuestion({ prompt: e.target.value })}
        />

        {q.kind === 'true_false' ? (
          <div className="grid w-full grid-cols-2 gap-3">
            {([true, false] as const).map((value) => {
              const selected = q.correctTrue === value
              return (
                <button
                  key={String(value)}
                  type="button"
                  className={cn(
                    'flex min-w-0 items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-center text-[15px] font-medium transition-colors sm:text-base',
                    selected
                      ? 'border-[color-mix(in_srgb,var(--brand-green)_45%,var(--border))] bg-[color-mix(in_srgb,var(--brand-green)_10%,white)] text-foreground'
                      : 'border-border/70 bg-[var(--surface-2)] text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                  onClick={() => patchQuestion({ correctTrue: value })}
                >
                  <span>{value ? 'True' : 'False'}</span>
                  {selected ? (
                    <Check className="size-4 text-[var(--brand-green)]" aria-hidden />
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : (
          <ul className="grid w-full grid-cols-1 gap-2">
            {q.choices.map((choice, ci) => {
              const selected = q.correctIndex === ci
              const letter = String.fromCharCode(65 + ci)
              return (
                <li key={ci} className="min-w-0">
                  <div
                    className={cn(
                      'grid w-full grid-cols-[2.75rem_minmax(0,1fr)] overflow-hidden rounded-2xl border transition-colors',
                      selected
                        ? 'border-[color-mix(in_srgb,var(--brand-green)_45%,var(--border))] bg-[color-mix(in_srgb,var(--brand-green)_10%,white)]'
                        : 'border-border/70 bg-[var(--surface-2)]',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Mark option ${letter} correct`}
                      aria-pressed={selected}
                      className={cn(
                        'flex items-center justify-center border-r text-[12px] font-semibold',
                        selected
                          ? 'border-[color-mix(in_srgb,var(--brand-green)_25%,var(--border))] text-[var(--brand-green)]'
                          : 'border-border/60 text-muted-foreground hover:bg-[var(--surface-3)] hover:text-foreground',
                      )}
                      onClick={() => patchQuestion({ correctIndex: ci })}
                    >
                      {selected ? <Check className="size-3.5" aria-hidden /> : letter}
                    </button>
                    <Input
                      value={choice}
                      placeholder={`Option ${letter}`}
                      className="h-11 min-w-0 rounded-none border-0 bg-transparent px-3.5 text-[15px] text-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
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

      <div className="flex flex-wrap items-center gap-1 border-t border-border/40 pt-3">
        <Input
          id={`check-page-${stop.id}`}
          className="h-8 w-12 border-0 bg-transparent px-1 text-center text-[13px] tabular-nums text-muted-foreground shadow-none focus-visible:ring-0"
          inputMode="numeric"
          title="Page"
          placeholder="pg"
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

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 rounded-full p-0 text-muted-foreground"
          onClick={startPlaceOnBook}
          disabled={stop.displayPage == null && !stop.hotspot}
          title={stop.hotspot ? 'Move pin' : 'Place pin'}
        >
          <MapPin className="size-3.5" aria-hidden />
          <span className="sr-only">{stop.hotspot ? 'Move pin' : 'Pin'}</span>
        </Button>

        {stop.hotspot ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-2 text-[12px] text-muted-foreground"
            onClick={() => onChange({ ...stop, hotspot: null })}
          >
            Unpin
          </Button>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 rounded-full p-0 text-muted-foreground"
          disabled={!canTry}
          title={canTry ? 'Try this check' : 'Write a question first'}
          onClick={() => setTryoutOpen(true)}
        >
          <Play className="size-3.5" aria-hidden />
          <span className="sr-only">Try</span>
        </Button>

        {evidenceSnippet ? (
          <Popover modal={false} open={storyOpen} onOpenChange={setStoryOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 rounded-full px-2.5 text-[12px] text-muted-foreground"
              >
                <Quote className="size-3.5" aria-hidden />
                In the story
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="z-[120] w-96 max-w-[min(24rem,90vw)] p-4"
              align="start"
              side="top"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Quote className="size-3" aria-hidden />
                In the story
              </p>
              <p className="text-[14px] leading-relaxed text-foreground">
                {evidenceParts ? (
                  <>
                    {evidenceParts.before}
                    <mark className="rounded-sm bg-amber-200/90 px-0.5 text-foreground">
                      {evidenceParts.mark}
                    </mark>
                    {evidenceParts.after}
                  </>
                ) : (
                  evidenceSnippet
                )}
              </p>
            </PopoverContent>
          </Popover>
        ) : null}

        <Popover modal={false} open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 rounded-full p-0 text-muted-foreground"
              title="Beat label & note"
            >
              <Ellipsis className="size-3.5" aria-hidden />
              <span className="sr-only">More</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="z-[120] w-72 space-y-3 p-3"
            align="end"
            side="top"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="space-y-1">
              <label htmlFor={`check-label-${stop.id}`} className="text-[11px] text-muted-foreground">
                Beat label
              </label>
              <Input
                id={`check-label-${stop.id}`}
                className="h-9"
                value={stop.label}
                placeholder="e.g. After the market"
                onChange={(e) => onChange({ ...stop, label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`check-note-${stop.id}`} className="text-[11px] text-muted-foreground">
                Mid-page note
              </label>
              <Input
                id={`check-note-${stop.id}`}
                className="h-9"
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
          </PopoverContent>
        </Popover>
      </div>

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
