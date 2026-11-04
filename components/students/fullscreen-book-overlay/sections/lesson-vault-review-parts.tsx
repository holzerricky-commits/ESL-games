'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { wordTileLetter } from '@/lib/lesson-vault/word-tile'
import { paperBlob } from './lesson-vault-card-style'
import { LessonVaultFittedImage } from './LessonVaultFittedImage'
import { LessonVaultWordTile } from './LessonVaultWordTile'

export const REVIEW_HEADER_BTN =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent'

export const REVIEW_PRIMARY_BTN =
  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(14,165,233,0.35)] hover:bg-sky-400'

const CONFETTI_COLORS = ['#38bdf8', '#a78bfa', '#facc15', '#34d399', '#fb7185', '#f97316']

export function GameCover({ src, className }: { src: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- static cover from public/
  return <img src={src} alt="" draggable={false} className={cn('object-cover', className)} />
}

/**
 * The card's picture, or its letter tile when it has none. `letterClassName` sizes the letter.
 * `plain` puts the picture straight on a paper card with no background; `className` sets its box.
 * `blobRound` uses a rounder blob for compact grid cards.
 */
export function CardPicture({
  card,
  className,
  letterClassName = 'text-7xl',
  plain = false,
  blobRound = false,
}: {
  card: LessonVaultCard
  className?: string
  letterClassName?: string
  plain?: boolean
  blobRound?: boolean
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const hasPicture = Boolean(card.imageUrl) && failed !== card.imageUrl
  if (plain) {
    const blob = (
      <span
        aria-hidden
        className={cn(
          'absolute left-1/2 top-1/2 h-[80%] w-[85%] -translate-x-1/2 -translate-y-1/2',
          blobRound
            ? 'rounded-[48%_52%_50%_50%/46%_48%_52%_54%]'
            : 'rounded-[46%_54%_50%_50%/48%_42%_58%_52%]',
          paperBlob(card.word),
        )}
      />
    )
    return (
      <span className={cn('relative block', className)}>
        {hasPicture ? (
          <LessonVaultFittedImage
            src={card.imageUrl}
            alt={card.word}
            plain
            backdrop={blob}
            className="absolute inset-0"
            onError={() => setFailed(card.imageUrl)}
          />
        ) : (
          <span
            aria-hidden
            className={cn(
              'absolute inset-0 flex select-none items-center justify-center font-semibold leading-none text-[#292B27]/35',
              letterClassName,
            )}
          >
            {blob}
            <span className="relative">{wordTileLetter(card.word)}</span>
          </span>
        )}
      </span>
    )
  }
  if (!hasPicture) {
    return <LessonVaultWordTile word={card.word} className={cn('rounded-xl', className)} letterClassName={letterClassName} />
  }
  return (
    <LessonVaultFittedImage
      src={card.imageUrl}
      alt={card.word}
      className={cn('rounded-xl', className)}
      onError={() => setFailed(card.imageUrl)}
    />
  )
}

export function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 36 + Math.random() * 0.4
        const distance = 140 + Math.random() * 220
        return {
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 60,
          delay: Math.random() * 120,
          size: 6 + Math.random() * 6,
        }
      }),
    [],
  )
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/3 motion-reduce:hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-sm"
          style={
            {
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              '--confetti-end-x': `${p.x}px`,
              '--confetti-end-y': `${p.y}px`,
              animation: `confetti 1300ms cubic-bezier(0.2, 0.7, 0.3, 1) ${p.delay}ms forwards`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
