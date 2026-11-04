'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Languages,
  LayoutGrid,
  PartyPopper,
  Pencil,
  Play,
  Puzzle,
  RotateCcw,
  Shuffle,
  WholeWord,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import type { LessonGrammarItem, LessonGrammarItemPatch } from '@/lib/lesson-grammar/types'
import type { LessonVaultGameKind } from '@/lib/lesson-vault/games'
import {
  cardReviewStatus,
  recommendedReviewRound,
} from '@/lib/lesson-vault/review-status'
import type { BookLessonRecord } from '@/lib/books/types'
import { readLessonVaultShowChinese, writeLessonVaultShowChinese } from '@/lib/lesson-vault/show-chinese'
import type { StoryScope } from '@/lib/lesson-vault/story-scope'
import type { LessonVaultCard, LessonVaultCardTextPatch, LessonVaultReviewStatus } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { useReviewDeck } from '../hooks/useReviewDeck'
import { ConfettiBurst, REVIEW_HEADER_BTN, REVIEW_PRIMARY_BTN } from './lesson-vault-review-parts'
import {
  buildGrammarReviewCards,
  GRAMMAR_RULE_CARD_ID,
  GrammarCardGrid,
  GrammarDeckCard,
} from './LessonGrammarCards'
import { GenerateGrammarButton, LessonGrammarReviewSection } from './LessonGrammarReviewSection'
import { LessonVaultEditList } from './LessonVaultEditList'
import { GAMES, gameTileState, LessonVaultGames } from './LessonVaultGames'
import {
  GamesPanel,
  PANEL_SCROLL,
  SectionHeading,
  useGamesPanelOpen,
  WordFlipCard,
  WordWall,
  type GameAccent,
  type GameRowItem,
} from './LessonVaultStudyHub'
import { StoryScopeChips } from './StoryScopeChips'

export type ReviewSection = 'words' | 'grammar'

type LessonVaultReviewStageProps = {
  lessonId: string | null
  lessonTitle: string | null
  section: ReviewSection
  onSectionChange: (section: ReviewSection) => void
  cards: LessonVaultCard[]
  /** Unfiltered lesson cards (All chip count). */
  lessonAllCards: LessonVaultCard[]
  storyScopes: readonly StoryScope[]
  selectedPartId: string | null
  onStoryChange: (partId: string | null) => void
  grammarItems: LessonGrammarItem[]
  grammarRule: string
  grammarHints: string[]
  onSetGrammarRule: (text: string) => void
  onUpdateGrammarItem: (itemId: string, patch: LessonGrammarItemPatch) => boolean
  onDeleteGrammarItem: (itemId: string) => boolean
  onGenerateGrammar: () => void
  generatingGrammar: boolean
  hasPreviousLesson: boolean
  hasNextLesson: boolean
  onPreviousLesson: () => void
  onNextLesson: () => void
  onClose: () => void
  onSaveReview: (
    updates: readonly { cardId: string; status: LessonVaultReviewStatus }[],
    options?: { quiet?: boolean },
  ) => boolean
  /** Bumped when the Review strip shortcut is clicked while review is already open — return to the overview. */
  homeTick?: number
  /** Lessons of this unit, for “Move to” in Edit cards. */
  lessons: readonly BookLessonRecord[]
  onUpdateCardText: (cardId: string, patch: LessonVaultCardTextPatch) => boolean
  onGenerateCardText: (
    cardId: string,
    fields: 'sentence' | 'meaning' | 'both',
  ) => Promise<LessonVaultCardTextPatch | null>
  onSearchPicture: (card: LessonVaultCard) => void
  onCutPicture: (card: LessonVaultCard) => void
  onPictureFile: (card: LessonVaultCard, file: Blob) => Promise<boolean>
  onDeleteCard: (cardId: string) => boolean
  onMoveCard: (cardId: string, lessonId: string) => boolean
  findingIds: ReadonlySet<string>
  onFindMissingPictures: (cards: LessonVaultCard[]) => void
  onRetryAutoPicture: (card: LessonVaultCard) => void
  onChooseCardPicture: (cardId: string, index: number) => void
}

type ActiveGame = { kind: LessonVaultGameKind; onlyIds?: readonly string[] }

type GrammarTab = 'cards' | 'edit'
type WordsTab = 'cards' | 'edit'

const HEADER_BTN = REVIEW_HEADER_BTN
const PRIMARY_BTN = REVIEW_PRIMARY_BTN

const SECTION_TAB =
  "relative inline-flex h-11 cursor-pointer items-center gap-2 px-1 text-base font-semibold text-white/50 hover:text-white/80 aria-selected:text-white after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:content-[''] aria-selected:after:bg-sky-400"

const SECTION_COUNT = 'rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-white/70'

const GAME_ACCENTS: readonly GameAccent[] = ['amber', 'emerald', 'violet', 'rose', 'cyan']

const REVIEW_MARKS: readonly {
  status: LessonVaultReviewStatus
  label: string
  active: string
}[] = [
  {
    status: 'practising',
    label: 'Practising',
    active: 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/40',
  },
  {
    status: 'learned',
    label: 'Learned',
    active: 'bg-sky-400/20 text-sky-100 ring-1 ring-sky-300/40',
  },
  {
    status: 'mastered',
    label: 'Mastered',
    active: 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/40',
  },
]

type StatusFilter = LessonVaultReviewStatus | 'all'

const STATUS_FILTERS: readonly {
  id: StatusFilter
  label: string
  swatch: string
}[] = [
  { id: 'all', label: 'All', swatch: 'bg-white/50' },
  { id: 'unchecked', label: 'Not checked', swatch: 'bg-[#9B968A]' },
  { id: 'practising', label: 'Practising', swatch: 'bg-amber-400' },
  { id: 'learned', label: 'Learned', swatch: 'bg-sky-400' },
  { id: 'mastered', label: 'Mastered', swatch: 'bg-emerald-500' },
]

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Mark the open flashcard with the same labels as the review overview. */
function FlashcardReviewMarks({
  card,
  onMark,
}: {
  card: LessonVaultCard
  onMark: (status: LessonVaultReviewStatus) => void
}) {
  const current = cardReviewStatus(card)
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2"
      role="group"
      aria-label={`Mark ${card.word}`}
    >
      {REVIEW_MARKS.map((mark) => {
        const selected = current === mark.status
        return (
          <button
            key={mark.status}
            type="button"
            aria-pressed={selected}
            className={cn(
              'cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
              selected ? mark.active : 'bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/75',
            )}
            onClick={(e) => {
              onMark(mark.status)
              e.currentTarget.blur()
            }}
          >
            {mark.label}
          </button>
        )
      })}
    </div>
  )
}


/** End-of-lesson review: an overview per section (cards, plus a games panel for words), full-screen cards and games. */
export function LessonVaultReviewStage({
  lessonId,
  lessonTitle,
  section,
  onSectionChange,
  cards,
  lessonAllCards,
  storyScopes,
  selectedPartId,
  onStoryChange,
  grammarItems,
  grammarRule,
  grammarHints,
  onSetGrammarRule,
  onUpdateGrammarItem,
  onDeleteGrammarItem,
  onGenerateGrammar,
  generatingGrammar,
  hasPreviousLesson,
  hasNextLesson,
  onPreviousLesson,
  onNextLesson,
  onClose,
  onSaveReview,
  homeTick = 0,
  lessons,
  onUpdateCardText,
  onGenerateCardText,
  onSearchPicture,
  onCutPicture,
  onPictureFile,
  onDeleteCard,
  onMoveCard,
  findingIds,
  onFindMissingPictures,
  onRetryAutoPicture,
  onChooseCardPicture,
}: LessonVaultReviewStageProps) {
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [gamesPanelOpen, toggleGamesPanel] = useGamesPanelOpen()
  const [grammarTab, setGrammarTab] = useState<GrammarTab>(() => (grammarItems.length > 0 ? 'cards' : 'edit'))
  const [wordsTab, setWordsTab] = useState<WordsTab>('cards')
  const [showChinese, setShowChinese] = useState(readLessonVaultShowChinese)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const wordsResetKey = `${lessonId ?? ''}:${selectedPartId ?? ''}`
  const [tabsResetKey, setTabsResetKey] = useState(wordsResetKey)
  if (tabsResetKey !== wordsResetKey) {
    setTabsResetKey(wordsResetKey)
    setGame(null)
    setStatusFilter('all')
    setWordsTab('cards')
    setGrammarTab(grammarItems.length > 0 ? 'cards' : 'edit')
  }

  const moveTargets = useMemo(
    () => lessons.filter((l) => l.id !== lessonId).map((l) => ({ id: l.id, title: l.title })),
    [lessons, lessonId],
  )

  function toggleShowChinese() {
    setShowChinese((prev) => {
      const next = !prev
      writeLessonVaultShowChinese(next)
      return next
    })
  }

  const storyLabel =
    selectedPartId != null
      ? storyScopes.find((scope) => scope.partId === selectedPartId)?.label ?? null
      : null

  const grammarCards = useMemo(() => buildGrammarReviewCards(grammarRule, grammarItems), [grammarRule, grammarItems])
  const words = useReviewDeck(cards, wordsResetKey)
  const grammar = useReviewDeck(grammarCards, lessonId, GRAMMAR_RULE_CARD_ID)
  const statusCounts = useMemo(() => {
    const counts: Record<LessonVaultReviewStatus, number> = {
      unchecked: 0,
      practising: 0,
      learned: 0,
      mastered: 0,
    }
    for (const card of cards) counts[cardReviewStatus(card)] += 1
    return counts
  }, [cards])
  const filteredCards = useMemo(
    () => (statusFilter === 'all' ? cards : cards.filter((card) => cardReviewStatus(card) === statusFilter)),
    [cards, statusFilter],
  )

  const isGrammar = section === 'grammar'
  const wordsEditing = !isGrammar && wordsTab === 'edit'
  const gameActive = !isGrammar && !wordsEditing && game !== null && cards.length > 0
  const reviewRound = recommendedReviewRound(cards)
  const deckActive = isGrammar
    ? grammarTab === 'cards' && grammarItems.length > 0
    : !gameActive && !wordsEditing && cards.length > 0
  const { mode, setMode, start, goNext, goPrevious, toggleFlipped } = isGrammar ? grammar : words
  const inFlashcards = deckActive && mode !== 'grid'

  useEffect(() => {
    if (homeTick < 1) return
    setGame(null)
    setWordsTab('cards')
    if (section === 'grammar' && grammarItems.length > 0) setGrammarTab('cards')
    setMode('grid')
    // Only when the Review strip shortcut requests home — not on section / deck identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- homeTick is the intentional trigger
  }, [homeTick])

  useEffect(() => {
    if (gameActive) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isBookOverlayKeyboardTypingTarget()) return
      // Real <button>s (speak, chevrons, shuffle) keep their own Space/Enter click.
      const onNativeButton =
        (e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLButtonElement
      if (onNativeButton) return
      const arrowSideways = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
      let handled = true
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        handled = false
      } else if (wordsEditing) {
        if (e.key === 'Escape') setWordsTab('cards')
        else if (!arrowSideways) handled = false
      } else if (!deckActive || mode === 'grid') {
        if (e.key === 'Enter' && deckActive) start()
        else if (e.key === 'Escape') onClose()
        else if (!arrowSideways) handled = false
        /* sideways arrows: keep the hidden book from turning pages */
      } else if (mode === 'deck') {
        if (e.key === 'ArrowRight') goNext()
        else if (e.key === 'ArrowLeft') goPrevious()
        else if (e.key === ' ' || e.key === 'Enter') toggleFlipped()
        else if (e.key === 'Escape') setMode('grid')
        else handled = false
      } else {
        if (e.key === 'Enter') start()
        else if (e.key === 'Escape') setMode('grid')
        else if (!arrowSideways) handled = false
      }
      if (!handled) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [
    gameActive,
    wordsEditing,
    deckActive,
    mode,
    setMode,
    start,
    goNext,
    goPrevious,
    toggleFlipped,
    onClose,
  ])

  const deckProgress = (deck: readonly { id: string }[], index: number) => (
    <div className="flex items-center gap-1.5" aria-label={`Card ${index + 1} of ${deck.length}`}>
      {deck.map((c, i) => (
        <span
          key={c.id}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === index ? 'w-6 bg-sky-400' : i < index ? 'w-1.5 bg-sky-400/50' : 'w-1.5 bg-white/20',
          )}
        />
      ))}
    </div>
  )

  const deckNav = (index: number, total: number, canTurn: boolean) => (
    <>
      <div className="flex items-center gap-2">
        <button type="button" className={HEADER_BTN} onClick={goPrevious} disabled={index === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
        <button type="button" className={HEADER_BTN} onClick={toggleFlipped} disabled={!canTurn}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Turn over
        </button>
        <button type="button" className={PRIMARY_BTN} onClick={goNext}>
          {index >= total - 1 ? 'Finish' : 'Next'}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="text-xs text-white/35">Space turns the card · ← → move · Esc goes back to the overview</p>
    </>
  )

  const doneScreen = (reviewed: string) => (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-4 text-center">
      <ConfettiBurst />
      <PartyPopper className="h-14 w-14 text-amber-300 animate-in zoom-in-50 spin-in-12 duration-500 motion-reduce:animate-none" aria-hidden />
      <p className="text-3xl font-bold">{reviewed} reviewed!</p>
      <p className="text-white/55">
        Great work on {storyLabel ?? lessonTitle ?? 'this lesson'}.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button type="button" className={PRIMARY_BTN} onClick={() => start()}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Again
        </button>
        <button type="button" className={HEADER_BTN} onClick={() => start({ shuffle: true })}>
          <Shuffle className="h-4 w-4" aria-hidden />
          Shuffle
        </button>
        <button type="button" className={HEADER_BTN} onClick={() => setMode('grid')}>
          <LayoutGrid className="h-4 w-4" aria-hidden />
          Overview
        </button>
        <button type="button" className={HEADER_BTN} onClick={onClose}>
          <BookOpen className="h-4 w-4" aria-hidden />
          Back to book
        </button>
      </div>
    </div>
  )

  const emptyState = (title: string, hint: ReactNode) => (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-white/55">
      <p className="text-lg font-medium text-white/75">{title}</p>
      <div className="text-sm">{hint}</div>
    </div>
  )

  const startRow = (hint: string, extra?: ReactNode) => (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={PRIMARY_BTN} onClick={() => start()}>
        <Play className="h-4 w-4" aria-hidden />
        Start flashcards
      </button>
      <button type="button" className={HEADER_BTN} onClick={() => start({ shuffle: true })}>
        <Shuffle className="h-4 w-4" aria-hidden />
        Shuffle
      </button>
      <p className="ml-1 text-sm text-white/45">{hint}</p>
      {extra ? <div className="ml-auto">{extra}</div> : null}
    </div>
  )

  let body: ReactNode
  let gamesPanel: ReactNode = null
  if (isGrammar) {
    if (grammarTab === 'edit') {
      body = (
        <LessonGrammarReviewSection
          key={lessonId ?? 'none'}
          items={grammarItems}
          rule={grammarRule}
          hints={grammarHints}
          onSetRule={onSetGrammarRule}
          onUpdateItem={onUpdateGrammarItem}
          onDeleteItem={onDeleteGrammarItem}
          onGenerate={onGenerateGrammar}
          generating={generatingGrammar}
        />
      )
    } else if (grammarItems.length === 0) {
      body = emptyState(
        'No grammar sentences yet',
        <div className="flex flex-col items-center gap-3">
          <p>
            Let AI draft sentences from the open page, or in Select mode select the word to practise and choose Save
            to grammar.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <GenerateGrammarButton
              onGenerate={() => {
                setGrammarTab('edit')
                onGenerateGrammar()
              }}
              generating={generatingGrammar}
              primary
            />
            <button type="button" className={HEADER_BTN} onClick={() => setGrammarTab('edit')}>
              <Pencil className="h-4 w-4" aria-hidden />
              Set the grammar point
            </button>
          </div>
        </div>,
      )
    } else if (grammar.mode === 'grid') {
      body = (
        <div className="flex flex-col gap-6">
          {startRow(
            'Click a sentence to start from it · Enter starts',
            <button type="button" className={HEADER_BTN} onClick={() => setGrammarTab('edit')}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit sentences
            </button>,
          )}
          <section className="flex flex-col gap-3">
            <SectionHeading title="Sentences in this lesson" count={grammarItems.length} />
            <GrammarCardGrid cards={grammarCards} onOpen={(id) => grammar.start({ atId: id })} />
          </section>
        </div>
      )
    } else if (grammar.mode === 'deck' && grammar.current) {
      const current = grammar.current
      body = (
        <div className="flex min-h-full flex-col items-center justify-center gap-5">
          {deckProgress(grammar.deck, grammar.index)}
          <GrammarDeckCard
            key={current.id}
            card={current}
            rule={grammarRule}
            flipped={grammar.flipped}
            onFlip={grammar.toggleFlipped}
          />
          {deckNav(grammar.index, grammar.deck.length, current.kind === 'item')}
        </div>
      )
    } else {
      const reviewed = grammar.deck.filter((c) => c.kind === 'item').length
      body = doneScreen(plural(reviewed, 'sentence', 'sentences'))
    }
  } else if (wordsEditing) {
    body = (
      <LessonVaultEditList
        cards={cards}
        moveTargets={moveTargets}
        onUpdateCardText={onUpdateCardText}
        onGenerateCardText={onGenerateCardText}
        onSearchPicture={onSearchPicture}
        onCutPicture={onCutPicture}
        onPictureFile={onPictureFile}
        onDeleteCard={onDeleteCard}
        onMoveCard={onMoveCard}
        findingIds={findingIds}
        onFindMissingPictures={onFindMissingPictures}
        onRetryAutoPicture={onRetryAutoPicture}
        onChooseCardPicture={onChooseCardPicture}
      />
    )
  } else if (cards.length === 0) {
    body = emptyState('No words yet', <p>In Select mode, click a word on the page and choose Save to vault.</p>)
  } else if (game) {
    body = (
      <LessonVaultGames
        key={`${lessonId ?? 'none'}:${game.kind}:${game.onlyIds?.join(',') ?? 'all'}`}
        cards={cards}
        lessonTitle={lessonTitle}
        startKind={game.kind}
        onlyIds={game.onlyIds}
        onBack={() => setGame(null)}
        onClose={onClose}
        onSaveReview={(updates) => {
          if (onSaveReview(updates)) setGame(null)
        }}
      />
    )
  } else if (words.mode === 'grid') {
    const rows = GAMES.map((entry, i): GameRowItem => {
      const state = gameTileState(entry, cards)
      return {
        id: entry.kind,
        title: entry.title,
        detail: state.detail,
        cover: entry.cover,
        accent: GAME_ACCENTS[i % GAME_ACCENTS.length]!,
        disabled: !state.canPlay,
        onClick: () => {
          if (state.canPlay) setGame({ kind: state.kind })
        },
      }
    })
    gamesPanel = <GamesPanel rows={rows} open={gamesPanelOpen} onToggle={toggleGamesPanel} />
    const roundReady = reviewRound.mode === 'check' || reviewRound.mode === 'practice' ? reviewRound : null
    const roundGame = roundReady ? GAMES.find((entry) => entry.kind === roundReady.kind) : null
    const activeStatusFilter = STATUS_FILTERS.find((filter) => filter.id === statusFilter) ?? STATUS_FILTERS[0]!
    const activeStatusCount = statusFilter === 'all' ? cards.length : statusCounts[statusFilter]
    body = (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {roundReady ? (
            <button
              type="button"
              className={PRIMARY_BTN}
              onClick={() => setGame({ kind: roundReady.kind, onlyIds: roundReady.cardIds })}
            >
              <Play className="h-4 w-4" aria-hidden />
              {roundReady.title}
            </button>
          ) : reviewRound.mode === 'done' ? (
            <p className="text-sm font-semibold text-emerald-200">
              Reviewed · {plural(reviewRound.mastered, 'word ready', 'words ready')}
            </p>
          ) : (
            <p className="text-sm font-medium text-amber-200/90">{reviewRound.reason}</p>
          )}
          <button type="button" className={HEADER_BTN} onClick={() => start()}>
            <Play className="h-4 w-4" aria-hidden />
            Flashcards
          </button>
          <button type="button" className={HEADER_BTN} onClick={() => start({ shuffle: true })}>
            <Shuffle className="h-4 w-4" aria-hidden />
            Shuffle
          </button>
          <button type="button" className={HEADER_BTN} onClick={() => setWordsTab('edit')}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit cards
          </button>
          <p className="ml-1 text-sm text-white/45">
            {roundGame ? roundGame.title : 'Click a word to open it · Enter starts the flashcards'}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={HEADER_BTN}
                  aria-label={`Filter by status: ${activeStatusFilter.label}`}
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', activeStatusFilter.swatch)} aria-hidden />
                  {activeStatusFilter.label}
                  <span className="tabular-nums text-white/45">{activeStatusCount}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="dark z-[200] min-w-[12rem] border-white/10 bg-[#1c1c21] text-[#f4f4f5]"
              >
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  {STATUS_FILTERS.map((filter) => {
                    const count = filter.id === 'all' ? cards.length : statusCounts[filter.id]
                    return (
                      <DropdownMenuRadioItem
                        key={filter.id}
                        value={filter.id}
                        className="gap-2 focus:bg-white/10 focus:text-white"
                      >
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', filter.swatch)} aria-hidden />
                        <span className="flex-1">{filter.label}</span>
                        <span className="tabular-nums text-white/45">{count}</span>
                      </DropdownMenuRadioItem>
                    )
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {filteredCards.length > 0 ? (
            <WordWall
              cards={filteredCards}
              onOpen={(id) => words.start({ atId: id })}
              showMeaning={showChinese}
            />
          ) : (
            <p className="py-8 text-center text-sm text-white/45">No words with this status</p>
          )}
        </div>
      </div>
    )
  } else if (words.mode === 'deck' && words.current) {
    const studyCard = words.current
    body = (
      <div className="flex min-h-full items-center justify-center gap-3 px-2 py-2 sm:gap-5">
        <button
          type="button"
          className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent"
          onClick={(e) => {
            words.goPrevious()
            e.currentTarget.blur()
          }}
          disabled={words.index === 0}
          aria-label="Previous card"
        >
          <ChevronLeft className="h-8 w-8" strokeWidth={1.75} aria-hidden />
        </button>
        <div className="flex flex-col items-center gap-5">
          <WordFlipCard
            card={studyCard}
            flipped={words.flipped}
            onFlip={words.toggleFlipped}
            index={words.index}
            total={words.deck.length}
            showMeaning={showChinese}
          />
          <FlashcardReviewMarks
            card={studyCard}
            onMark={(status) => onSaveReview([{ cardId: studyCard.id, status }], { quiet: true })}
          />
        </div>
        <button
          type="button"
          className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          onClick={(e) => {
            words.goNext()
            e.currentTarget.blur()
          }}
          aria-label={words.index >= words.deck.length - 1 ? 'Finish' : 'Next card'}
        >
          <ChevronRight className="h-8 w-8" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    )
  } else {
    body = doneScreen(plural(words.deck.length, 'word', 'words'))
  }

  const showOverviewButton =
    inFlashcards ||
    gameActive ||
    wordsEditing ||
    (isGrammar && grammarTab === 'edit' && grammarItems.length > 0)
  const backToOverview = () => {
    if (gameActive) setGame(null)
    else if (wordsEditing) setWordsTab('cards')
    else if (isGrammar && grammarTab === 'edit') setGrammarTab('cards')
    else setMode('grid')
  }

  /** Flashcards / games: hide browse chrome so the card or game owns the screen. */
  const focusMode = inFlashcards || gameActive
  const studyDeckActive = inFlashcards && mode === 'deck'

  return (
    <div
      className={cn(
        'absolute inset-0 z-[46] flex flex-col text-[#f4f4f5]',
        studyDeckActive || (inFlashcards && mode === 'done')
          ? 'bg-[#171918]'
          : 'bg-[radial-gradient(ellipse_at_top,#2b2f3d_0%,#1c1c21_60%)]',
      )}
      role="region"
      aria-label="Lesson review"
    >
      <header
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-2 px-5',
          focusMode ? 'pt-3 pb-2' : 'pt-4 pb-3',
        )}
      >
        {focusMode ? (
          <>
            <button
              type="button"
              className={cn(HEADER_BTN, 'h-9 w-9 shrink-0 justify-center px-0')}
              onClick={backToOverview}
              aria-label="Back to overview"
              title="Overview"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <h2 className="min-w-0 truncate text-sm font-medium text-white/55">
              {gameActive ? 'Game' : isGrammar ? 'Grammar cards' : 'Flashcards'}
              {lessonTitle ? ` · ${lessonTitle}` : ''}
            </h2>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              {!isGrammar && !gameActive ? (
                <button
                  type="button"
                  className={cn(HEADER_BTN, 'h-9 w-9 justify-center px-0', !showChinese && 'text-white/40')}
                  onClick={toggleShowChinese}
                  aria-pressed={showChinese}
                  aria-label={showChinese ? 'Hide Chinese' : 'Show Chinese'}
                  title={showChinese ? 'Hide Chinese' : 'Show Chinese'}
                >
                  <Languages className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
              {studyDeckActive ? (
                <button type="button" className={HEADER_BTN} onClick={() => start({ shuffle: true })}>
                  <Shuffle className="h-4 w-4" aria-hidden />
                  Shuffle
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className={HEADER_BTN}
              onClick={onPreviousLesson}
              disabled={!hasPreviousLesson}
              aria-label="Previous lesson"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-sky-300/80">Review</p>
              <h2 className="truncate text-xl font-semibold">{lessonTitle ?? 'No lesson'}</h2>
              {storyLabel ? (
                <p className="truncate text-sm text-white/55">{storyLabel}</p>
              ) : null}
            </div>
            <button
              type="button"
              className={HEADER_BTN}
              onClick={onNextLesson}
              disabled={!hasNextLesson}
              aria-label="Next lesson"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              {!isGrammar && !wordsEditing ? (
                <button
                  type="button"
                  className={cn(HEADER_BTN, 'h-9 w-9 justify-center px-0', !showChinese && 'text-white/40')}
                  onClick={toggleShowChinese}
                  aria-pressed={showChinese}
                  aria-label={showChinese ? 'Hide Chinese' : 'Show Chinese'}
                  title={showChinese ? 'Hide Chinese' : 'Show Chinese'}
                >
                  <Languages className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
              {showOverviewButton ? (
                <button
                  type="button"
                  className={
                    (isGrammar && grammarTab === 'edit') || wordsEditing ? PRIMARY_BTN : HEADER_BTN
                  }
                  onClick={backToOverview}
                >
                  {(isGrammar && grammarTab === 'edit') || wordsEditing ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden />
                      Done editing
                    </>
                  ) : (
                    <>
                      <LayoutGrid className="h-4 w-4" aria-hidden />
                      Overview
                    </>
                  )}
                </button>
              ) : null}
              <button type="button" className={HEADER_BTN} onClick={onClose}>
                <BookOpen className="h-4 w-4" aria-hidden />
                Back to book
              </button>
            </div>
          </>
        )}
      </header>

      {!focusMode ? (
        <>
          <StoryScopeChips
            scopes={storyScopes}
            selectedPartId={selectedPartId}
            onSelect={onStoryChange}
            allCount={lessonAllCards.length}
            className="mx-5 shrink-0 pb-2"
          />

          <div role="tablist" aria-label="Review section" className="mx-5 flex shrink-0 gap-6 border-b border-white/10">
            <button
              type="button"
              role="tab"
              aria-selected={!isGrammar}
              className={SECTION_TAB}
              onClick={() => onSectionChange('words')}
            >
              <WholeWord className="h-4 w-4" aria-hidden />
              Words
              <span className={SECTION_COUNT}>{cards.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isGrammar}
              className={SECTION_TAB}
              onClick={() => onSectionChange('grammar')}
            >
              <Puzzle className="h-4 w-4" aria-hidden />
              Grammar
              <span className={SECTION_COUNT}>{grammarItems.length}</span>
            </button>
          </div>
        </>
      ) : null}

      {gamesPanel ? (
        <div className="relative flex min-h-0 flex-1">
          <div
            className={cn(
              'min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-6',
              PANEL_SCROLL,
              !gamesPanelOpen && 'pr-16',
            )}
          >
            {body}
          </div>
          {gamesPanel}
        </div>
      ) : (
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6',
            PANEL_SCROLL,
            focusMode ? 'pt-3' : 'pt-5',
          )}
        >
          {body}
        </div>
      )}
    </div>
  )
}
