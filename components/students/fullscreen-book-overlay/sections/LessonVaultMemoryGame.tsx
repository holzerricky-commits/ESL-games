'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, EyeOff, RotateCcw, Star, Trophy } from 'lucide-react'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { buildMemoryDeck, isMemoryMatch, memoryStars, type MemoryTile } from '@/lib/lesson-vault/games'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { VAULT_PAPER_CARD } from './lesson-vault-card-style'
import { CardPicture, ConfettiBurst, GameCover, REVIEW_HEADER_BTN, REVIEW_PRIMARY_BTN } from './lesson-vault-review-parts'

const MISMATCH_MS = 1200
const FINISH_MS = 900
const LOOK_MS = 5_000
const WAVE_STEP_MS = 60
const FLIP_MS = 500
const SKIP_LOOK_KEY = 'esl_vault_memory_skip_look'

/** `look`: all tiles face up to remember; `wave`: they turn over one by one; `play`: the game. */
type Stage = 'look' | 'wave' | 'play'

function readSkipLook(): boolean {
  try {
    return window.localStorage.getItem(SKIP_LOOK_KEY) === '1'
  } catch {
    return false
  }
}

function writeSkipLook(skip: boolean) {
  try {
    window.localStorage.setItem(SKIP_LOOK_KEY, skip ? '1' : '0')
  } catch {
    /* private mode: setting just isn't remembered */
  }
}

type LessonVaultMemoryGameProps = {
  cards: LessonVaultCard[]
  lessonTitle: string | null
  title: string
  cover: string
  /** Back to the game picker. */
  onExit: () => void
  /** Back to the book. */
  onClose: () => void
}

function gridCols(tiles: number): string {
  if (tiles <= 6) return 'grid-cols-3'
  if (tiles === 10) return 'grid-cols-5'
  return 'grid-cols-4'
}

/**
 * Memory pairs: tiles face down; turn two — a picture and its word stay up, others turn back.
 * Tiles are numbered so students can call out which ones to turn.
 */
export function LessonVaultMemoryGame({ cards, lessonTitle, title, cover, onExit, onClose }: LessonVaultMemoryGameProps) {
  const [deck, setDeck] = useState<MemoryTile[]>(() => buildMemoryDeck(cards))
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const [matchedIds, setMatchedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [lastMatchId, setLastMatchId] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState(false)
  const [turns, setTurns] = useState(0)
  const [done, setDone] = useState(false)
  const [skipLook, setSkipLook] = useState(readSkipLook)
  const [stage, setStage] = useState<Stage>(() => (readSkipLook() ? 'play' : 'look'))
  const [lookBarGone, setLookBarGone] = useState(false)
  const timerRef = useRef<number | null>(null)

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const pairs = deck.length / 2

  const clearTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
  useEffect(() => clearTimer, [])

  const hideCards = useCallback(() => {
    setStage((s) => (s === 'look' ? 'wave' : s))
  }, [])

  useEffect(() => {
    if (stage === 'look') {
      setLookBarGone(false)
      const raf = window.requestAnimationFrame(() => setLookBarGone(true))
      const t = window.setTimeout(hideCards, LOOK_MS)
      return () => {
        window.cancelAnimationFrame(raf)
        window.clearTimeout(t)
      }
    }
    if (stage === 'wave') {
      const t = window.setTimeout(() => setStage('play'), deck.length * WAVE_STEP_MS + FLIP_MS)
      return () => window.clearTimeout(t)
    }
  }, [stage, deck.length, hideCards])

  const restart = useCallback(() => {
    clearTimer()
    setDeck(buildMemoryDeck(cards))
    setOpenKeys([])
    setMatchedIds(new Set())
    setLastMatchId(null)
    setMismatch(false)
    setTurns(0)
    setDone(false)
    setStage(readSkipLook() ? 'play' : 'look')
  }, [cards])

  function changeSkipLook(skip: boolean) {
    setSkipLook(skip)
    writeSkipLook(skip)
  }

  function turn(tile: MemoryTile) {
    if (done || stage !== 'play' || matchedIds.has(tile.cardId) || openKeys.includes(tile.key)) return
    // A third tile while two wrong ones are still showing: turn those back at once.
    const open = openKeys.length >= 2 ? [] : openKeys
    if (openKeys.length >= 2) {
      clearTimer()
      setMismatch(false)
    }
    const nextOpen = [...open, tile.key]
    setOpenKeys(nextOpen)
    if (nextOpen.length < 2) return

    setTurns((t) => t + 1)
    const [a, b] = nextOpen.map((key) => deck.find((t) => t.key === key)!)
    if (isMemoryMatch(a!, b!)) {
      const matched = new Set(matchedIds).add(tile.cardId)
      setMatchedIds(matched)
      setLastMatchId(tile.cardId)
      setOpenKeys([])
      if (matched.size === pairs) timerRef.current = window.setTimeout(() => setDone(true), FINISH_MS)
      return
    }
    setMismatch(true)
    timerRef.current = window.setTimeout(() => {
      setOpenKeys([])
      setMismatch(false)
    }, MISMATCH_MS)
  }

  useEffect(() => {
    if (!done && stage !== 'look') return
    function onKeyDown(e: KeyboardEvent) {
      if (isBookOverlayKeyboardTypingTarget() || e.target instanceof HTMLButtonElement) return
      if (e.target instanceof HTMLInputElement) return
      if (done && e.key === 'Enter') {
        e.preventDefault()
        restart()
      } else if (!done && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        hideCards()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [done, stage, restart, hideCards])

  if (done) {
    const stars = memoryStars(pairs, turns)
    return (
      <div className="relative flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <ConfettiBurst />
        <GameCover
          src={cover}
          className="aspect-video w-56 rounded-2xl shadow-[0_0_40px_rgba(56,189,248,0.35)] ring-1 ring-white/10 animate-in zoom-in-90 fade-in duration-500 motion-reduce:animate-none"
        />
        <p className="flex items-center gap-2 text-3xl font-bold">
          <Trophy className="h-8 w-8 text-amber-300" aria-hidden />
          {[1, 2, 3].map((n) => (
            <Star
              key={n}
              className={cn(
                'h-8 w-8 animate-in zoom-in-50 fill-mode-backwards duration-300 motion-reduce:animate-none',
                n <= stars ? 'fill-amber-300 text-amber-300' : 'text-white/25',
              )}
              style={{ animationDelay: `${200 + n * 150}ms` }}
              aria-hidden
            />
          ))}
          <span className="sr-only">{stars} of 3 stars</span>
        </p>
        <p className="text-white/55">
          {pairs} pairs in {turns} turns{stars === 3 ? ` — great memory on ${lessonTitle ?? 'this lesson'}!` : '.'}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button type="button" className={REVIEW_PRIMARY_BTN} onClick={restart}>
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
        <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-white/50">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-sky-400"
            checked={!skipLook}
            onChange={(e) => changeSkipLook(!e.target.checked)}
          />
          Show all cards first
        </label>
      </div>
    )
  }

  const looking = stage === 'look'

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5">
      <div className="flex w-[min(60rem,100%)] items-center justify-between gap-4">
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.06] py-1 pl-1 pr-3 text-sm font-semibold text-white/80">
          <GameCover src={cover} className="h-8 w-14 rounded-full" />
          {title}
        </span>
        <span className="text-sm text-white/40">
          {looking ? 'Say each word together · Enter hides the cards' : 'Find each picture and its word · Esc for other activities'}
        </span>
        <span className="flex items-center gap-4 text-lg font-semibold tabular-nums">
          <span className="text-emerald-200">
            {matchedIds.size} / {pairs} <span className="text-sm font-medium text-white/45">pairs</span>
          </span>
          <span className="text-white/80">
            {turns} <span className="text-sm font-medium text-white/45">turns</span>
          </span>
        </span>
      </div>

      {looking ? (
        <div className="flex w-[min(60rem,100%)] flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-sky-500/10 px-4 py-3 ring-1 ring-sky-400/25">
            <p className="text-xl font-semibold text-sky-50">Look closely and remember!</p>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/50">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-sky-400"
                  checked={skipLook}
                  onChange={(e) => changeSkipLook(e.target.checked)}
                />
                Skip next time
              </label>
              <button type="button" className={REVIEW_PRIMARY_BTN} onClick={hideCards}>
                <EyeOff className="h-4 w-4" aria-hidden />
                Hide cards
              </button>
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400/80 ease-linear motion-reduce:hidden"
              style={{
                width: lookBarGone ? '0%' : '100%',
                transitionProperty: 'width',
                transitionDuration: lookBarGone ? `${LOOK_MS}ms` : '0ms',
              }}
            />
          </div>
        </div>
      ) : null}

      <ul className={cn('grid w-[min(60rem,100%)] gap-3', gridCols(deck.length))}>
        {deck.map((tile, i) => {
          const card = byId.get(tile.cardId)
          if (!card) return null
          const matched = matchedIds.has(tile.cardId)
          const open = looking || matched || openKeys.includes(tile.key)
          const wrong = mismatch && openKeys.includes(tile.key)
          const popped = matched && lastMatchId === tile.cardId
          return (
            <li key={tile.key} className="[perspective:1200px]">
              <button
                type="button"
                onClick={() => turn(tile)}
                disabled={matched || stage !== 'play'}
                aria-label={open ? (tile.face === 'word' ? card.word : `Picture of ${card.word}`) : `Card ${i + 1}`}
                className={cn(
                  'relative block aspect-[4/3] w-full cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:cursor-default',
                  wrong && 'animate-[reading-check-shake_400ms_ease-in-out] motion-reduce:animate-none',
                  popped && 'animate-[reading-check-choice-pop_350ms_ease-out] motion-reduce:animate-none',
                )}
              >
                <span
                  className={cn(
                    'grid h-full w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none',
                    open && '[transform:rotateY(180deg)]',
                  )}
                  style={stage === 'wave' ? { transitionDelay: `${i * WAVE_STEP_MS}ms` } : undefined}
                >
                  <span
                    className="flex items-center justify-center rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-500/35 via-indigo-500/25 to-violet-600/30 shadow-[0_8px_22px_rgba(0,0,0,0.38)] [grid-area:1/1] [backface-visibility:hidden] hover:brightness-110"
                    aria-hidden={open}
                  >
                    <span className="text-4xl font-bold text-white/70 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">{i + 1}</span>
                  </span>
                  <span
                    className={cn(
                      'relative flex items-center justify-center overflow-hidden rounded-2xl border p-2 [grid-area:1/1] [backface-visibility:hidden] [transform:rotateY(180deg)]',
                      VAULT_PAPER_CARD,
                      matched && 'border-emerald-400/60 ring-2 ring-emerald-400/50',
                      wrong && 'border-rose-400/60 ring-2 ring-rose-400/40',
                    )}
                    aria-hidden={!open}
                  >
                    {tile.face === 'picture' ? (
                      <CardPicture card={card} className="h-full w-full rounded-[8px]" letterClassName="text-6xl" plain />
                    ) : (
                      <span
                        className={cn(
                          'break-words px-2 text-center font-semibold tracking-tight text-balance text-stone-900',
                          'text-3xl leading-[1.25]',
                        )}
                      >
                        {card.word}
                      </span>
                    )}
                    {matched ? (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-4 w-4" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
