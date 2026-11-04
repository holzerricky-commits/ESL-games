'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, RotateCcw, Star, Trophy } from 'lucide-react'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { buildMeaningBoard, type MeaningBoard } from '@/lib/lesson-vault/games'
import { cycleReviewStatus, proposeReviewStatuses } from '@/lib/lesson-vault/review-status'
import type { LessonVaultCard, LessonVaultReviewStatus } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { VAULT_CARD_FRONT } from './lesson-vault-card-style'
import { CardPicture, ConfettiBurst, GameCover, REVIEW_HEADER_BTN } from './lesson-vault-review-parts'
import { ReviewRoundResult } from './ReviewRoundResult'

const MISMATCH_MS = 800
const FINISH_MS = 900
const LETTERS = 'ABCDEFGHI'

type LessonVaultMeaningGameProps = {
  cards: LessonVaultCard[]
  lessonTitle: string | null
  title: string
  cover: string
  /** Back to the game picker. */
  onExit: () => void
  /** Back to the book. */
  onClose: () => void
  onSaveReview?: (updates: readonly { cardId: string; status: LessonVaultReviewStatus }[]) => void
}

type Pick = { side: 'word' | 'meaning'; id: string }

/**
 * Word ↔ meaning: numbered words on the left, lettered meanings on the right.
 * Students call a pair ("2 C"); pick one from each side to match them.
 */
export function LessonVaultMeaningGame({
  cards,
  lessonTitle,
  title,
  cover,
  onExit,
  onClose,
  onSaveReview,
}: LessonVaultMeaningGameProps) {
  const [board, setBoard] = useState<MeaningBoard>(() => buildMeaningBoard(cards))
  const [pick, setPick] = useState<Pick | null>(null)
  const [matchedIds, setMatchedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [lastMatchId, setLastMatchId] = useState<string | null>(null)
  const [wrongPair, setWrongPair] = useState<{ wordId: string; meaningId: string } | null>(null)
  const [missedIds, setMissedIds] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [session, setSession] = useState(0)
  const [labelSession, setLabelSession] = useState(-1)
  const [labels, setLabels] = useState<Record<string, LessonVaultReviewStatus>>({})
  const timerRef = useRef<number | null>(null)

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const pairs = board.wordIds.length
  const stars = pairs - missedIds.length

  const clearTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
  useEffect(() => clearTimer, [])

  const restart = useCallback(
    (onlyIds?: readonly string[]) => {
      clearTimer()
      setBoard(buildMeaningBoard(cards, { onlyIds }))
      setPick(null)
      setMatchedIds(new Set())
      setLastMatchId(null)
      setWrongPair(null)
      setMissedIds([])
      setDone(false)
      setSession((n) => n + 1)
    },
    [cards],
  )

  const choose = useCallback(
    (side: Pick['side'], id: string) => {
      if (done || matchedIds.has(id)) return
      if (wrongPair) {
        clearTimer()
        setWrongPair(null)
      }
      if (!pick || pick.side === side) {
        setPick(pick?.side === side && pick.id === id ? null : { side, id })
        return
      }
      const wordId = side === 'word' ? id : pick.id
      const meaningId = side === 'meaning' ? id : pick.id
      setPick(null)
      if (wordId === meaningId) {
        const matched = new Set(matchedIds).add(wordId)
        setMatchedIds(matched)
        setLastMatchId(wordId)
        if (matched.size === pairs) timerRef.current = window.setTimeout(() => setDone(true), FINISH_MS)
        return
      }
      setMissedIds((prev) => (prev.includes(wordId) ? prev : [...prev, wordId]))
      setWrongPair({ wordId, meaningId })
      timerRef.current = window.setTimeout(() => setWrongPair(null), MISMATCH_MS)
    },
    [done, matchedIds, wrongPair, pick, pairs],
  )

  const proposals = useMemo(() => {
    if (!done) return []
    const missed = new Set(missedIds)
    return proposeReviewStatuses(
      cards,
      board.wordIds.map((cardId) => ({ cardId, result: missed.has(cardId) ? 'miss' : 'hit' })),
    )
  }, [done, missedIds, cards, board.wordIds])
  if (done && labelSession !== session) {
    setLabelSession(session)
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
      if (done) {
        if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault()
          if (onSaveReview) saveReview()
          else restart()
        }
        return
      }
      const key = e.key.toUpperCase()
      if (/^[1-9]$/.test(key)) {
        const id = board.wordIds[Number(key) - 1]
        if (id) choose('word', id)
      } else if (key.length === 1 && LETTERS.includes(key)) {
        const id = board.meaningIds[LETTERS.indexOf(key)]
        if (id) choose('meaning', id)
      } else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [done, board, choose, restart, onSaveReview, saveReview])

  if (done) {
    const missed = missedIds.map((id) => byId.get(id)).filter((c): c is LessonVaultCard => c != null)
    return (
      <div className="relative flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <ConfettiBurst />
        <GameCover
          src={cover}
          className="aspect-video w-56 rounded-2xl shadow-[0_0_40px_rgba(56,189,248,0.35)] ring-1 ring-white/10 animate-in zoom-in-90 fade-in duration-500 motion-reduce:animate-none"
        />
        <p className="flex items-center gap-2 text-3xl font-bold tabular-nums">
          <Trophy className="h-8 w-8 text-amber-300" aria-hidden />
          <Star className="h-8 w-8 fill-amber-300 text-amber-300" aria-hidden />
          {stars} / {pairs}
        </p>
        <p className="text-white/55">
          {missed.length === 0
            ? `Every meaning right first time on ${lessonTitle ?? 'this lesson'}!`
            : 'Stars are for words matched on the first try.'}
        </p>
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
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button type="button" className={REVIEW_HEADER_BTN} onClick={() => restart()}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Play again
          </button>
          <button type="button" className={REVIEW_HEADER_BTN} onClick={onExit}>
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

  const rowBase =
    'relative flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:cursor-default motion-reduce:transition-none'
  const rowState = (id: string, side: Pick['side']) => {
    const matched = matchedIds.has(id)
    const picked = pick?.side === side && pick.id === id
    const wrong = wrongPair != null && (side === 'word' ? wrongPair.wordId : wrongPair.meaningId) === id
    return cn(
      VAULT_CARD_FRONT,
      !matched && !picked && !wrong && 'hover:bg-white/[0.08]',
      picked && 'border-sky-400/70 bg-sky-500/20 ring-2 ring-sky-400/50',
      wrong && 'border-rose-400/60 bg-rose-500/15 animate-[reading-check-shake_400ms_ease-in-out] motion-reduce:animate-none',
      matched && 'border-emerald-400/50 bg-emerald-500/15 opacity-80',
      matched &&
        lastMatchId === id &&
        'animate-[reading-check-choice-pop_350ms_ease-out] motion-reduce:animate-none',
    )
  }
  const badge = (label: string, matched: boolean) => (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        matched ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60',
      )}
    >
      {matched ? <Check className="h-4 w-4" aria-hidden /> : label}
    </span>
  )

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5">
      <div className="flex w-[min(64rem,100%)] items-center justify-between gap-4">
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.06] py-1 pl-1 pr-3 text-sm font-semibold text-white/80">
          <GameCover src={cover} className="h-8 w-14 rounded-full" />
          {title}
        </span>
        <span className="text-sm text-white/40">
          {pick
            ? pick.side === 'word'
              ? 'Now pick its meaning'
              : 'Now pick its word'
            : `Match each word to its meaning · press 1–${pairs} and A–${LETTERS[pairs - 1]} · Esc for other activities`}
        </span>
        <span className="flex items-center gap-4 text-lg font-semibold tabular-nums">
          <span className="text-emerald-200">
            {matchedIds.size} / {pairs} <span className="text-sm font-medium text-white/45">matched</span>
          </span>
          <span className="flex items-center gap-1.5 text-amber-200">
            <Star className="h-5 w-5 fill-amber-300 text-amber-300" aria-hidden />
            {matchedIds.size - missedIds.filter((id) => matchedIds.has(id)).length}
          </span>
        </span>
      </div>

      <div className="grid w-[min(64rem,100%)] grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-6 gap-y-3">
        <ul className="flex flex-col gap-3">
          {board.wordIds.map((id, i) => {
            const card = byId.get(id)
            if (!card) return null
            const matched = matchedIds.has(id)
            return (
              <li
                key={id}
                className="animate-in fade-in slide-in-from-left-4 fill-mode-backwards duration-300 motion-reduce:animate-none"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <button
                  type="button"
                  onClick={() => choose('word', id)}
                  disabled={matched}
                  className={cn(rowBase, 'min-h-20 py-2', rowState(id, 'word'))}
                >
                  {badge(String(i + 1), matched)}
                  <CardPicture card={card} className="h-12 w-12 shrink-0 rounded-xl" letterClassName="text-xl" />
                  <span className="min-w-0 break-words text-2xl font-bold tracking-tight">{card.word}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <ul className="flex flex-col gap-3">
          {board.meaningIds.map((id, i) => {
            const card = byId.get(id)
            if (!card) return null
            const matched = matchedIds.has(id)
            return (
              <li
                key={id}
                className="animate-in fade-in slide-in-from-right-4 fill-mode-backwards duration-300 motion-reduce:animate-none"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <button
                  type="button"
                  onClick={() => choose('meaning', id)}
                  disabled={matched}
                  className={cn(rowBase, 'min-h-20 py-3', rowState(id, 'meaning'))}
                >
                  {badge(LETTERS[i]!, matched)}
                  <span className="min-w-0 flex-1 text-lg leading-snug text-white/85">{card.meaning}</span>
                  {matched ? (
                    <span className="shrink-0 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-sm font-semibold text-emerald-100">
                      {card.word}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
