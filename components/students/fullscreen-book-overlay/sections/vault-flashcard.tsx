'use client'

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { RefreshCw, Volume2 } from 'lucide-react'
import { speakEnglish } from '@/lib/audio/speak-text'
import { stripLessonPartTypePrefix } from '@/lib/books/part-section-display'
import { cardReviewStatus } from '@/lib/lesson-vault/review-status'
import type { LessonVaultCard, LessonVaultReviewStatus } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { VAULT_PAPER_CARD } from './lesson-vault-card-style'
import { CardPicture } from './lesson-vault-review-parts'

export type VaultFlashcardSize = 'grid' | 'small' | 'large'

/** Story / part name on the card — type prefixes like “Shared Read” are omitted. */
export function vaultCardLabel(card: LessonVaultCard): string {
  const part = stripLessonPartTypePrefix(card.partTitle)
  const lesson = stripLessonPartTypePrefix(card.lessonTitle)
  const label = (part || lesson || card.partTitle || card.lessonTitle).replace(/[.\s]+$/, '')
  return label
}

const SIZE = {
  grid: {
    /** Overview / review wall — fills the WordWall grid cell. */
    width: 'h-auto w-full aspect-[2/3]',
    radius: 'rounded-[18px]',
    pad: 'p-5',
    label: 'text-[12px] font-semibold leading-tight tracking-[0.02em]',
    meaning: 'text-[15px] font-medium leading-tight',
    wordFront: 'text-[28px] font-extrabold tracking-[-0.8px]',
    wordBack: 'text-[28px] font-extrabold tracking-[-0.8px]',
    sentence: 'text-[20px] font-medium leading-[1.3]',
    speaker: 'size-[16px]',
    flipIcon: 'size-[17px]',
    letter: 'text-8xl',
    hover: true,
    blobRound: true,
  },
  small: {
    width: 'h-auto w-[220px] shrink-0 self-start aspect-[2/3]',
    radius: 'rounded-[16px]',
    pad: 'p-[18px]',
    label: 'text-[11px] font-semibold leading-tight tracking-[0.02em]',
    meaning: 'text-[14px] font-medium leading-tight',
    wordFront: 'text-[23px] font-extrabold tracking-[-0.8px]',
    wordBack: 'text-[27px] font-extrabold tracking-[-0.8px]',
    sentence: 'text-[20px] font-medium leading-[1.3]',
    speaker: 'size-[14px]',
    flipIcon: 'size-[17px]',
    letter: 'text-7xl',
    hover: true,
    blobRound: false,
  },
  large: {
    // Avoid percentage width inside shrink-wrapped flex (cyclic % → 0 width).
    width: 'h-auto w-[min(440px,calc((100dvh-6rem)*2/3))] shrink-0 self-start aspect-[2/3]',
    radius: 'rounded-[24px]',
    pad: 'p-7',
    label: 'text-[14px] font-semibold leading-tight tracking-[0.02em]',
    meaning: 'text-[23px] font-medium leading-tight',
    wordFront: 'text-[48px] font-extrabold tracking-[-0.8px]',
    wordBack: 'text-[38px] font-extrabold tracking-[-0.8px]',
    sentence: 'text-[34px] font-semibold leading-[1.3]',
    speaker: 'size-[20px]',
    flipIcon: 'size-[20px]',
    letter: 'text-9xl',
    hover: false,
    blobRound: false,
  },
} as const

const CARD_SHADOW = 'shadow-[0_4px_18px_rgba(0,0,0,0.18)]'
const CARD_SHADOW_HOVER =
  'transition-[box-shadow,filter] duration-300 ease-out hover:shadow-[0_6px_20px_rgba(0,0,0,0.22)] hover:brightness-[1.015] motion-reduce:transition-none motion-reduce:hover:brightness-100'
const CARD_SELECTED = 'shadow-[0_8px_22px_rgba(0,0,0,0.32)] ring-1 ring-black/5'

function SpeakButton({
  text,
  iconClass,
  circled,
  className,
}: {
  text: string
  iconClass: string
  circled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={`Listen to ${text}`}
      className={cn(
        'z-20 flex cursor-pointer items-center justify-center text-[#77766F] transition-colors hover:text-[#45443F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70',
        circled ? 'size-9 rounded-full bg-[#EDE9E0]/80' : 'rounded-md p-0.5',
        className,
      )}
      onClick={(e: MouseEvent) => {
        e.stopPropagation()
        speakEnglish(text)
      }}
    >
      <Volume2 className={iconClass} strokeWidth={1.6} aria-hidden />
    </button>
  )
}

/** Full border follows the card radius — gray / amber / sky / emerald. */
function reviewStatusBorder(status: LessonVaultReviewStatus): string {
  if (status === 'practising') return 'border-[5px] border-amber-400'
  if (status === 'learned') return 'border-[5px] border-sky-400'
  if (status === 'mastered') return 'border-[5px] border-emerald-500'
  return 'border-[5px] border-[#9B968A]'
}

function FaceShell({
  size,
  fill,
  selected,
  reviewStatus = 'unchecked',
  children,
}: {
  size: VaultFlashcardSize
  /** When true, fill the parent flip face instead of setting width/aspect. */
  fill?: boolean
  selected?: boolean
  reviewStatus?: LessonVaultReviewStatus
  children: ReactNode
}) {
  const s = SIZE[size]
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden font-sans',
        VAULT_PAPER_CARD,
        s.radius,
        CARD_SHADOW,
        fill ? 'h-full w-full' : s.width,
        s.hover && !selected && CARD_SHADOW_HOVER,
        selected && CARD_SELECTED,
        reviewStatusBorder(reviewStatus),
      )}
    >
      {children}
    </div>
  )
}

export function VaultCardFront({
  card,
  size,
  index,
  total,
  label,
  onActivate,
  selected,
  fill,
  showMeaning = true,
}: {
  card: LessonVaultCard
  size: VaultFlashcardSize
  index?: number
  total?: number
  label: string
  onActivate: () => void
  selected?: boolean
  fill?: boolean
  /** When true, show card.chinese (Simplified Chinese) above the English word. */
  showMeaning?: boolean
}) {
  const s = SIZE[size]
  const counter =
    size === 'large' && index != null && total != null && total > 0
      ? `${index + 1} / ${total}`
      : null
  const gloss = card.chinese.trim()
  const showGloss = showMeaning && gloss.length > 0
  const status = cardReviewStatus(card)
  const statusNote =
    status === 'practising'
      ? ', practising'
      : status === 'learned'
        ? ', learned'
        : status === 'mastered'
          ? ', mastered'
          : ''

  return (
    <FaceShell size={size} selected={selected} fill={fill} reviewStatus={status}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}${statusNote}`}
        className={cn(
          'absolute inset-0 flex cursor-pointer flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/70',
          s.pad,
        )}
        onClick={onActivate}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          onActivate()
        }}
      >
        <div className="flex shrink-0 items-start justify-between gap-2">
          <span className={cn('min-w-0 line-clamp-2 font-condensed text-[#88867E]', s.label)}>
            {vaultCardLabel(card)}
          </span>
          {counter ? (
            <span className={cn('shrink-0 font-condensed tabular-nums text-[#88867E]', s.label)}>
              {counter}
            </span>
          ) : null}
        </div>

        {/* Spacer pushes the picture slightly lower on the card. */}
        <div
          className={cn('shrink-0', size === 'large' ? 'h-5' : 'h-3')}
          aria-hidden
        />

        <CardPicture
          card={card}
          className="h-[58%] w-full shrink-0"
          letterClassName={s.letter}
          plain
          blobRound={s.blobRound}
        />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-end gap-1.5 pb-0.5">
          {showGloss ? (
            <p className={cn('max-w-full truncate text-center text-[#88867E]', s.meaning)} lang="zh">
              {gloss}
            </p>
          ) : null}
          <h3 className={cn('max-w-full truncate text-center leading-none text-[#292B27]', s.wordFront)}>
            {card.word}
          </h3>
          <SpeakButton text={card.word} iconClass={s.speaker} circled={size === 'large'} />
        </div>
      </div>
    </FaceShell>
  )
}

export function VaultCardBack({
  card,
  size,
  onActivate,
  onFlip,
  fill,
}: {
  card: LessonVaultCard
  size: 'small' | 'large'
  onActivate: () => void
  onFlip?: () => void
  fill?: boolean
}) {
  const s = SIZE[size]
  const spoken = card.sentence || card.word
  const flip = onFlip ?? onActivate
  const status = cardReviewStatus(card)

  return (
    <FaceShell size={size} fill={fill} reviewStatus={status}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${card.word} — showing sentence`}
        aria-pressed
        className={cn(
          'absolute inset-0 flex cursor-pointer flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/70',
          s.pad,
        )}
        onClick={onActivate}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          onActivate()
        }}
      >
        <div className="flex shrink-0 items-start justify-between gap-2">
          <span className={cn('font-medium uppercase text-[#88867E]', s.label)}>Example sentence</span>
          <button
            type="button"
            aria-label="Turn card over"
            className="z-20 -mr-1 -mt-0.5 flex cursor-pointer items-center justify-center rounded-md p-0.5 text-[#5C5B55] transition-colors hover:text-[#292B27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              flip()
            }}
          >
            <RefreshCw className={s.flipIcon} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {size === 'large' ? (
          <span aria-hidden className="mt-3 mb-4 block h-[3px] w-10 shrink-0 rounded-full bg-[#C4846C]" />
        ) : (
          <span className="mt-2 shrink-0" aria-hidden />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-1">
          <h3 className={cn('mb-2 break-words leading-[1.2] text-[#292B27]', s.wordBack)}>{card.word}</h3>
          <p className={cn(card.sentence ? 'text-[#45443F]' : 'italic text-[#88867E]', s.sentence)}>
            {card.sentence ? `“${card.sentence}”` : 'No sentence yet.'}
          </p>
        </div>

        <div className="mt-auto flex shrink-0 items-center justify-between gap-2 pt-3">
          <SpeakButton text={spoken} iconClass={s.speaker} />
          {size === 'large' ? (
            <span className="text-[11px] font-normal text-[#88867E]">Listen & repeat</span>
          ) : null}
        </div>
      </div>
    </FaceShell>
  )
}

/**
 * Flippable study card (small / large) or a simple grid preview.
 * Front and back share one 2:3 box; the speaker never triggers the flip.
 */
export function VaultFlashcard({
  card,
  size,
  flipped = false,
  label,
  onActivate,
  index,
  total,
  selected,
  showMeaning = true,
}: {
  card: LessonVaultCard
  size: VaultFlashcardSize
  flipped?: boolean
  label: string
  onActivate: () => void
  index?: number
  total?: number
  selected?: boolean
  showMeaning?: boolean
}) {
  if (size === 'grid') {
    return (
      <VaultCardFront
        card={card}
        size="grid"
        label={label}
        onActivate={onActivate}
        selected={selected}
        showMeaning={showMeaning}
      />
    )
  }

  const s = SIZE[size]

  return (
    <div className={cn('relative [perspective:1200px]', s.width)}>
      <div
        className={cn(
          'absolute inset-0 transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none',
          flipped && '[transform:rotateY(180deg)]',
        )}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <VaultCardFront
            card={card}
            size={size}
            index={index}
            total={total}
            label={label}
            onActivate={onActivate}
            fill
            showMeaning={showMeaning}
          />
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <VaultCardBack card={card} size={size} onActivate={onActivate} onFlip={onActivate} fill />
        </div>
      </div>
    </div>
  )
}
