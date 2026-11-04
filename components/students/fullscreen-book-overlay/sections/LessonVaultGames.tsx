'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Check, RotateCcw, Star, Trophy } from 'lucide-react'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import {
  buildGameRound,
  gameAvailability,
  gameQuestionCards,
  MEANING_MAX_PAIRS,
  MEMORY_MAX_PAIRS,
  type GameQuestion,
  type LessonVaultGameCatalogKind,
  type LessonVaultGameKind,
} from '@/lib/lesson-vault/games'
import {
  cycleReviewStatus,
  proposeReviewStatuses,
  reviewGameCounts,
  type ReviewAttempt,
} from '@/lib/lesson-vault/review-status'
import type { LessonVaultCard, LessonVaultReviewStatus } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { VAULT_PAPER_CARD } from './lesson-vault-card-style'
import {
  CardPicture,
  ConfettiBurst,
  GameCover,
  REVIEW_HEADER_BTN,
  REVIEW_PRIMARY_BTN,
} from './lesson-vault-review-parts'
import { LessonVaultMeaningGame } from './LessonVaultMeaningGame'
import { LessonVaultMemoryGame } from './LessonVaultMemoryGame'
import { LessonVaultSpellIt } from './LessonVaultSpellIt'
import { ReviewRoundResult } from './ReviewRoundResult'

type LessonVaultGamesProps = {
  cards: LessonVaultCard[]
  lessonTitle: string | null
  startKind: LessonVaultGameKind
  /** Questions to ask. Wrong answers still come from the whole lesson. */
  onlyIds?: readonly string[]
  /** Leave the game for the review overview. */
  onBack: () => void
  onClose: () => void
  /** Persist the labels from a finished round. Memory pairs does not call this. */
  onSaveReview?: (updates: readonly { cardId: string; status: LessonVaultReviewStatus }[]) => void
}

type Phase = 'play' | 'done'

const AUTO_NEXT_MS = 1100

export type GameEntry = {
  kind: LessonVaultGameCatalogKind
  title: string
  hint: string
  cover: string
  comingSoon?: boolean
}

const coverFor = (kind: LessonVaultGameCatalogKind) => `/lesson-vault/games/${kind}.jpg`

export const GAMES: GameEntry[] = [
  { kind: 'picture-word', title: 'Picture → word', hint: 'See the picture, pick the word.', cover: coverFor('picture-word') },
  { kind: 'fill-gap', title: 'Fill the gap', hint: 'Pick the word missing from the sentence.', cover: coverFor('fill-gap') },
  { kind: 'memory-pairs', title: 'Memory pairs', hint: 'Turn cards over, find word and picture.', cover: coverFor('memory-pairs') },
  { kind: 'spell-it', title: 'Spell it', hint: 'Put the letters in order.', cover: coverFor('spell-it') },
  { kind: 'word-meaning', title: 'Word ↔ meaning', hint: 'Match each word to what it means.', cover: coverFor('word-meaning') },
]

const PLAYABLE = new Set<LessonVaultGameCatalogKind>(['picture-word', 'fill-gap', 'memory-pairs', 'spell-it', 'word-meaning'])
/** Games that run their own board instead of a question-by-question round. */
const BOARD_GAMES = new Set<LessonVaultGameKind>(['memory-pairs', 'word-meaning'])
const isPlayable = (kind: LessonVaultGameCatalogKind): kind is LessonVaultGameKind => PLAYABLE.has(kind)

function gameEntry(kind: LessonVaultGameKind): GameEntry {
  return GAMES.find((g) => g.kind === kind)!
}

export type GameTileState =
  | { canPlay: true; kind: LessonVaultGameKind; detail: string }
  | { canPlay: false; detail: string | null }

/** Whether a catalog game can start with these cards, and the line shown under its title. */
export function gameTileState(entry: GameEntry, cards: readonly LessonVaultCard[]): GameTileState {
  const k = entry.kind
  if (!isPlayable(k) || entry.comingSoon) return { canPlay: false, detail: entry.comingSoon ? 'Coming soon' : null }
  const availability = gameAvailability(k, cards)
  if (!availability.ok) return { canPlay: false, detail: availability.reason }
  const count = gameQuestionCards(k, cards).length
  const detail =
    k === 'memory-pairs'
      ? `${Math.min(count, MEMORY_MAX_PAIRS)} pairs`
      : k === 'word-meaning'
        ? `${Math.min(count, MEANING_MAX_PAIRS)} words`
        : `${count} ${count === 1 ? 'question' : 'questions'}`
  return { canPlay: true, kind: k, detail }
}

/** Classroom vocab games built from the lesson's vault cards. Teacher clicks; students answer out loud. */
export function LessonVaultGames({
  cards,
  lessonTitle,
  startKind,
  onlyIds,
  onBack,
  onClose,
  onSaveReview,
}: LessonVaultGamesProps) {
  const [phase, setPhase] = useState<Phase>('play')
  const [kind, setKind] = useState<LessonVaultGameKind>(startKind)
  const [round, setRound] = useState<GameQuestion[]>(() =>
    BOARD_GAMES.has(startKind) ? [] : buildGameRound(startKind, cards, { onlyIds }),
  )
  const [index, setIndex] = useState(0)
  const [wrongIds, setWrongIds] = useState<ReadonlySet<string>>(() => new Set())
  const [solved, setSolved] = useState(false)
  const [stars, setStars] = useState(0)
  const [missedIds, setMissedIds] = useState<string[]>([])
  const [roundNo, setRoundNo] = useState(1)
  const [labelRound, setLabelRound] = useState(0)
  const [labels, setLabels] = useState<Record<string, LessonVaultReviewStatus>>({})

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const question = round[index] ?? null

  const start = useCallback(
    (nextKind: LessonVaultGameKind, onlyIds?: readonly string[]) => {
      if (BOARD_GAMES.has(nextKind)) {
        setKind(nextKind)
        setRound([])
        setSolved(false)
        setPhase('play')
        return
      }
      const nextRound = buildGameRound(nextKind, cards, { onlyIds })
      if (nextRound.length === 0) return
      setKind(nextKind)
      setRound(nextRound)
      setIndex(0)
      setWrongIds(new Set())
      setSolved(false)
      setStars(0)
      setMissedIds([])
      setRoundNo((n) => n + 1)
      setPhase('play')
    },
    [cards],
  )

  const next = useCallback(() => {
    if (index >= round.length - 1) {
      setPhase('done')
      return
    }
    setIndex((i) => i + 1)
    setWrongIds(new Set())
    setSolved(false)
  }, [index, round.length])

  const choose = useCallback(
    (choiceId: string) => {
      if (!question || solved || wrongIds.has(choiceId)) return
      if (choiceId === question.card.id) {
        setSolved(true)
        if (wrongIds.size === 0) setStars((s) => s + 1)
        return
      }
      setWrongIds((prev) => new Set(prev).add(choiceId))
      setMissedIds((prev) => (prev.includes(question.card.id) ? prev : [...prev, question.card.id]))
    },
    [question, solved, wrongIds],
  )

  const spelled = useCallback((clean: boolean) => {
    setSolved(true)
    if (clean) setStars((s) => s + 1)
  }, [])

  const spellMissed = useCallback(() => {
    if (!question) return
    const id = question.card.id
    setMissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [question])

  useEffect(() => {
    if (!solved) return
    const t = window.setTimeout(next, AUTO_NEXT_MS)
    return () => window.clearTimeout(t)
  }, [solved, next])

  const reviewResults = useMemo(() => {
    if (phase !== 'done' || !reviewGameCounts(kind)) return []
    const missed = new Set(missedIds)
    return round.map((question) => ({
      cardId: question.card.id,
      result: (missed.has(question.card.id) ? 'miss' : 'hit') as ReviewAttempt,
    }))
  }, [phase, kind, missedIds, round])
  const proposals = useMemo(
    () => (reviewResults.length > 0 ? proposeReviewStatuses(cards, reviewResults) : []),
    [cards, reviewResults],
  )
  if (phase === 'done' && labelRound !== roundNo) {
    setLabelRound(roundNo)
    setLabels({})
  }
  const saveReview = useCallback(() => {
    if (!onSaveReview || proposals.length === 0) return
    onSaveReview(
      proposals.map((proposal) => ({
        cardId: proposal.cardId,
        status: labels[proposal.cardId] ?? proposal.status,
      })),
    )
  }, [onSaveReview, proposals, labels])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isBookOverlayKeyboardTypingTarget()) return
      if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLButtonElement) return
      let handled = true
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        handled = false
      } else if (e.key === 'Escape') {
        onBack()
      } else if (phase === 'play' && question && /^[1-9]$/.test(e.key)) {
        const id = question.choiceIds[Number(e.key) - 1]
        if (id) choose(id)
      } else if (phase === 'play' && solved && (e.key === 'Enter' || e.key === 'ArrowRight')) {
        next()
      } else if (phase === 'done' && e.key === 'Enter') {
        if (onSaveReview && reviewGameCounts(kind)) saveReview()
        else start(kind, onlyIds)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        /* keep the hidden book from turning pages */
      } else handled = false
      if (!handled) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [phase, question, solved, kind, choose, next, start, onBack, onSaveReview, onlyIds, saveReview])

  if (phase === 'play' && kind === 'memory-pairs') {
    const entry = gameEntry(kind)
    return (
      <LessonVaultMemoryGame
        cards={cards}
        lessonTitle={lessonTitle}
        title={entry.title}
        cover={entry.cover}
        onExit={onBack}
        onClose={onClose}
      />
    )
  }

  if (phase === 'play' && kind === 'word-meaning') {
    const entry = gameEntry(kind)
    return (
      <LessonVaultMeaningGame
        cards={cards}
        lessonTitle={lessonTitle}
        title={entry.title}
        cover={entry.cover}
        onExit={onBack}
        onClose={onClose}
        onSaveReview={onSaveReview}
      />
    )
  }

  if (phase === 'done') {
    const perfect = stars === round.length
    return (
      <div className="relative flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <ConfettiBurst />
        <GameCover
          src={gameEntry(kind).cover}
          className="aspect-video w-56 rounded-2xl shadow-[0_0_40px_rgba(56,189,248,0.35)] ring-1 ring-white/10 animate-in zoom-in-90 fade-in duration-500 motion-reduce:animate-none"
        />
        <p className="flex items-center gap-2 text-3xl font-bold tabular-nums">
          <Trophy className="h-8 w-8 text-amber-300" aria-hidden />
          <Star className="h-8 w-8 fill-amber-300 text-amber-300" aria-hidden />
          {stars} / {round.length}
        </p>
        <p className="text-white/55">
          {perfect ? `Perfect round on ${lessonTitle ?? 'this lesson'}!` : 'Stars are for right on the first try.'}
        </p>
        {reviewGameCounts(kind) ? (
          <ReviewRoundResult
            rows={proposals.flatMap((proposal) => {
              const card = byId.get(proposal.cardId)
              if (!card) return []
              return [{ card, result: proposal.result, status: labels[proposal.cardId] ?? proposal.status }]
            })}
            onToggle={(cardId) => {
              const current =
                labels[cardId] ?? proposals.find((proposal) => proposal.cardId === cardId)?.status ?? 'practising'
              setLabels((prev) => ({ ...prev, [cardId]: cycleReviewStatus(current) }))
            }}
            onSave={saveReview}
          />
        ) : null}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button type="button" className={REVIEW_HEADER_BTN} onClick={() => start(kind, onlyIds)}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Play again
          </button>
          <button type="button" className={REVIEW_HEADER_BTN} onClick={onBack}>
            Other activities
          </button>
          <button type="button" className={REVIEW_HEADER_BTN} onClick={onClose}>
            <BookOpen className="h-4 w-4" aria-hidden />
            Back to book
          </button>
        </div>
      </div>
    )
  }

  if (!question) return null
  const target = question.card
  const hasPicture = target.imageUrl.trim() !== ''
  const gapLine = (textClass: string, paper = false) => (
    <p className={cn('text-center leading-relaxed', textClass)}>
      {question.gap?.before}
      {solved ? (
        <span
          className={cn(
            'rounded-md px-2 font-semibold animate-[reading-check-choice-pop_350ms_ease-out] motion-reduce:animate-none',
            paper ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-400/20 text-emerald-200',
          )}
        >
          {question.gap?.gap}
        </span>
      ) : (
        <span
          className={cn('mx-1 inline-block w-36 border-b-4 align-baseline', paper ? 'border-sky-500' : 'border-sky-400/70')}
          aria-label="blank"
        />
      )}
      {question.gap?.after}
    </p>
  )
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6">
      <div className="flex w-[min(44rem,100%)] items-center justify-between gap-4">
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.06] py-1 pl-1 pr-3 text-sm font-semibold text-white/80">
          <GameCover src={gameEntry(kind).cover} className="h-8 w-14 rounded-full" />
          {gameEntry(kind).title}
        </span>
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5"
          aria-label={`Question ${index + 1} of ${round.length}`}
        >
          {round.map((q, i) => (
            <span
              key={q.card.id}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === index ? 'w-6 bg-sky-400' : i < index ? 'w-1.5 bg-sky-400/50' : 'w-1.5 bg-white/20',
              )}
            />
          ))}
        </div>
        <span className="flex items-center gap-1.5 text-lg font-semibold tabular-nums text-amber-200">
          <Star
            key={stars}
            className="h-5 w-5 fill-amber-300 text-amber-300 animate-in zoom-in-50 duration-300 motion-reduce:animate-none"
            aria-hidden
          />
          {stars}
        </span>
      </div>

      <div
        key={`${roundNo}:${target.id}`}
        className="flex w-[min(44rem,100%)] flex-col items-center gap-6 animate-in fade-in slide-in-from-right-8 duration-300 motion-reduce:animate-none"
      >
        {kind === 'picture-word' ? (
          <div className={cn('w-[min(30rem,100%)] rounded-2xl p-5', VAULT_PAPER_CARD)}>
            <CardPicture card={target} className="aspect-[4/3] w-full" plain />
          </div>
        ) : kind === 'spell-it' && hasPicture ? (
          <div className="flex w-full flex-col items-center gap-3">
            <div className={cn('w-[min(22rem,100%)] rounded-2xl p-5', VAULT_PAPER_CARD)}>
              <CardPicture card={target} className="aspect-[4/3] w-full" plain />
            </div>
            {question.gap ? gapLine('text-xl text-white/70') : null}
          </div>
        ) : (
          <div className={cn('w-full rounded-2xl p-8', VAULT_PAPER_CARD)}>
            {gapLine('text-3xl', true)}
          </div>
        )}

        {kind === 'spell-it' ? (
          <LessonVaultSpellIt
            word={target.word}
            letters={question.letters}
            onSolved={spelled}
            onMistake={spellMissed}
          />
        ) : null}

        <div className={cn('grid w-full grid-cols-2 gap-3', kind === 'spell-it' && 'hidden')}>
          {question.choiceIds.map((id, i) => {
            const choice = byId.get(id)
            if (!choice) return null
            const isRight = solved && id === target.id
            const isWrong = wrongIds.has(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                disabled={isWrong || (solved && !isRight)}
                className={cn(
                  'relative flex min-h-16 cursor-pointer items-center justify-center rounded-2xl border px-4 py-3 text-2xl font-semibold transition-colors duration-150 motion-reduce:transition-none',
                  'border-white/10 bg-white/[0.06] hover:bg-white/[0.12]',
                  isRight &&
                    'border-emerald-400/60 bg-emerald-500/25 text-emerald-50 hover:bg-emerald-500/25 animate-[reading-check-choice-pop_350ms_ease-out] motion-reduce:animate-none',
                  isWrong &&
                    'cursor-default border-rose-400/50 bg-rose-500/15 text-rose-200/70 line-through animate-[reading-check-shake_400ms_ease-in-out] motion-reduce:animate-none',
                  solved && !isRight && 'cursor-default opacity-40',
                )}
              >
                <span className="absolute left-3 top-2 text-xs font-medium text-white/30">{i + 1}</span>
                {choice.word}
                {isRight ? <Check className="ml-2 h-6 w-6" aria-hidden /> : null}
              </button>
            )
          })}
        </div>

        <div className="flex h-10 items-center gap-3">
          {solved ? (
            <button type="button" className={REVIEW_PRIMARY_BTN} onClick={next}>
              {index >= round.length - 1 ? 'Finish' : 'Next'}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : wrongIds.size > 0 ? (
            <p className="text-sm text-white/55">Try again!</p>
          ) : kind === 'spell-it' ? (
            <p className="text-sm text-white/35">
              Spell the word · click or type the letters · Backspace undoes · Esc for other activities
            </p>
          ) : (
            <p className="text-sm text-white/35">
              {kind === 'picture-word' ? 'What is this?' : 'Which word is missing?'} · press 1–
              {question.choiceIds.length} · Esc for other activities
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
