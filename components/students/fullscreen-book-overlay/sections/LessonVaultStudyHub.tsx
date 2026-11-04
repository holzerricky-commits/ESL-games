'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { Gamepad2, Lock, PanelRightClose } from 'lucide-react'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { useFlipLayout } from '../hooks/useFlipLayout'
import { VAULT_CARD_FRONT, VAULT_CARD_HOVER } from './lesson-vault-card-style'
import { GameCover } from './lesson-vault-review-parts'
import { VaultFlashcard } from './vault-flashcard'

/** Each game keeps its own colour. */
const ACCENT_TEXT = {
  amber: 'text-amber-200',
  emerald: 'text-emerald-200',
  violet: 'text-violet-200',
  rose: 'text-rose-200',
  cyan: 'text-cyan-200',
} as const

export type GameAccent = keyof typeof ACCENT_TEXT

export type GameRowItem = {
  id: string
  title: string
  /** Count line, or why the game is locked. */
  detail: string | null
  cover: string
  accent: GameAccent
  disabled?: boolean
  onClick: () => void
}

const GAMES_PANEL_KEY = 'lessonVault.reviewGamesPanel'
/** Matches Tailwind's `lg`: below it the panel overlays the words instead of sitting beside them. */
const WIDE_QUERY = '(min-width: 1024px)'

/** Thin rounded scrollbar for dark review panels. */
export const PANEL_SCROLL = [
  '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]',
  '[&::-webkit-scrollbar]:w-1.5',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20',
  '[&::-webkit-scrollbar-thumb]:hover:bg-white/35',
].join(' ')

function readGamesPanelOpen(): boolean {
  try {
    if (!window.matchMedia(WIDE_QUERY).matches) return false
    return window.localStorage.getItem(GAMES_PANEL_KEY) === '1'
  } catch {
    return false
  }
}

function writeGamesPanelOpen(open: boolean) {
  try {
    window.localStorage.setItem(GAMES_PANEL_KEY, open ? '1' : '0')
  } catch {
    /* private mode: setting just isn't remembered */
  }
}

/** Collapsed by default; stays open on wide screens only if the teacher opened it last time. */
export function useGamesPanelOpen() {
  const [open, setOpen] = useState(readGamesPanelOpen)
  const toggle = useCallback(() => {
    writeGamesPanelOpen(!open)
    setOpen(!open)
  }, [open])
  return [open, toggle] as const
}

function GameRow({ row }: { row: GameRowItem }) {
  return (
    <li>
      <button
        type="button"
        disabled={row.disabled}
        onClick={row.onClick}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2 pr-3 text-left disabled:cursor-default',
          VAULT_CARD_FRONT,
          !row.disabled && VAULT_CARD_HOVER,
        )}
      >
        <span
          className={cn(
            'relative block h-14 w-20 shrink-0 overflow-hidden rounded-lg',
            row.disabled && 'opacity-40 grayscale',
          )}
        >
          <GameCover
            src={row.cover}
            className="absolute inset-0 h-full w-full transition-transform duration-300 group-enabled:group-hover:scale-110 motion-reduce:transition-none"
          />
        </span>
        <span className={cn('flex min-w-0 flex-1 flex-col gap-0.5', row.disabled && 'opacity-60')}>
          <span className="text-base font-semibold leading-tight">{row.title}</span>
          {row.detail ? (
            row.disabled ? (
              <span className="flex items-start gap-1 text-xs font-medium text-amber-200/90">
                <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden />
                {row.detail}
              </span>
            ) : (
              <span className={cn('text-xs font-bold uppercase tracking-wide', ACCENT_TEXT[row.accent])}>{row.detail}</span>
            )
          ) : null}
        </span>
      </button>
    </li>
  )
}

/** Games for the lesson's words, beside the word wall. Collapses to a slim strip on the right edge. */
export function GamesPanel({
  rows,
  open,
  onToggle,
}: {
  rows: readonly GameRowItem[]
  open: boolean
  onToggle: () => void
}) {
  const playable = rows.filter((r) => !r.disabled).length
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        aria-label={`Show games (${playable} ready)`}
        className="absolute inset-y-0 right-0 z-10 flex w-12 cursor-pointer flex-col items-center gap-3 border-l border-white/10 bg-[#1d1e24]/95 py-4 text-white/70 backdrop-blur-sm hover:bg-[#24252c] hover:text-white"
      >
        <Gamepad2 className="h-5 w-5" aria-hidden />
        <span className="rotate-180 text-sm font-semibold tracking-wide [writing-mode:vertical-rl]">Games</span>
        <span className="rounded-full bg-sky-500/25 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-sky-100">
          {playable}
        </span>
      </button>
    )
  }
  return (
    <aside
      aria-label="Games"
      className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-[#1d1e24] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-10 max-lg:shadow-[-16px_0_40px_rgba(0,0,0,0.5)]"
    >
      <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-2">
        <Gamepad2 className="h-4 w-4 text-white/60" aria-hidden />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Games</h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded
          aria-label="Hide games"
          title="Hide games"
          className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
        >
          <PanelRightClose className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 pb-3',
          PANEL_SCROLL,
        )}
      >
        {rows.map((row) => (
          <GameRow key={row.id} row={row} />
        ))}
      </ul>
      <p className="shrink-0 border-t border-white/10 px-4 py-3 text-xs text-white/40">
        Students answer out loud, you click.
      </p>
    </aside>
  )
}

export function SectionHeading({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55">{title}</h3>
      {count !== undefined ? (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-white/70">{count}</span>
      ) : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  )
}

/** The lesson's words as a picture wall; a card opens the full-screen flashcards at that word. */
export function WordWall({
  cards,
  onOpen,
  selectedId,
  showMeaning = true,
}: {
  cards: readonly LessonVaultCard[]
  onOpen: (cardId: string) => void
  selectedId?: string | null
  showMeaning?: boolean
}) {
  const orderKey = cards.map((card) => card.id).join(',')
  const listRef = useFlipLayout<HTMLUListElement>(orderKey)

  return (
    <ul
      ref={listRef}
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5 [&>[data-flip-id]]:origin-top-left"
    >
      {cards.map((card) => (
        <li key={card.id} data-flip-id={card.id}>
          <VaultFlashcard
            card={card}
            size="grid"
            label={`Open ${card.word}`}
            onActivate={() => onOpen(card.id)}
            selected={selectedId === card.id}
            showMeaning={showMeaning}
          />
        </li>
      ))}
    </ul>
  )
}

/** The full-screen word card; turns over to its sentence. */
export function WordFlipCard({
  card,
  flipped,
  onFlip,
  index,
  total,
  showMeaning = true,
}: {
  card: LessonVaultCard
  flipped: boolean
  onFlip: () => void
  index?: number
  total?: number
  showMeaning?: boolean
}) {
  return (
    <div
      key={card.id}
      className="animate-in fade-in slide-in-from-right-8 duration-300 motion-reduce:animate-none"
    >
      <VaultFlashcard
        card={card}
        size="large"
        flipped={flipped}
        index={index}
        total={total}
        label={`${card.word}. Space to turn over.`}
        onActivate={onFlip}
        showMeaning={showMeaning}
      />
    </div>
  )
}
