'use client'

import { useState, type DragEvent } from 'react'
import { ImagePlus, Loader2, Sparkles } from 'lucide-react'
import { readImageFileFromDataTransfer } from '@/lib/books/clipboard-image'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { VAULT_PAPER_CARD } from './lesson-vault-card-style'
import { LessonVaultFittedImage } from './LessonVaultFittedImage'
import { LessonVaultWordTile } from './LessonVaultWordTile'

/** Image files dropped on a vault row or opened card. */
export function useVaultImageDrop(onFile: (file: File) => void) {
  const [dropActive, setDropActive] = useState(false)
  return {
    dropActive,
    dropHandlers: {
      onDragOver(e: DragEvent<HTMLElement>) {
        if (!Array.from(e.dataTransfer.types).includes('Files')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setDropActive(true)
      },
      onDragLeave() {
        setDropActive(false)
      },
      onDrop(e: DragEvent<HTMLElement>) {
        setDropActive(false)
        const file = readImageFileFromDataTransfer(e.dataTransfer)
        if (!file) return
        e.preventDefault()
        e.stopPropagation()
        onFile(file)
      },
    },
  }
}

type LessonVaultRowProps = {
  card: LessonVaultCard
  onOpen: () => void
  onPictureFile: (file: File) => void
  /** Pointer or focus is on this row, so Ctrl+V goes here. */
  onPasteTarget: () => void
  pictureBusy: boolean
  /** Automatic picture search is running for this card. */
  finding?: boolean
  /** Just saved — plays the arrive animation. */
  fresh?: boolean
  /** Peeking this word in the drawer. */
  selected?: boolean
  /** Show Chinese gloss on the second line when available. */
  showChinese?: boolean
}

/** Why a card has no picture, for tooltips and the opened card. */
export function missingPictureReason(card: LessonVaultCard): string {
  if (card.autoPicture === 'abstract') return 'Hard to picture – add your own'
  if (card.autoPicture === 'not-found') return 'No picture found – add your own'
  return 'No picture yet'
}

function rowSubtitle(
  card: LessonVaultCard,
  showChinese: boolean,
): { text: string; muted: boolean; lang?: string } | null {
  const chinese = card.chinese.trim()
  if (showChinese && chinese) return { text: chinese, muted: true, lang: 'zh' }
  const meaning = card.meaning.trim()
  if (meaning) return { text: meaning, muted: true }
  if (!card.imageUrl.trim()) return { text: 'No picture', muted: false }
  if (!card.sentence.trim()) return { text: 'No sentence', muted: false }
  return null
}

/** One saved word in the vault panel; click to peek the paper card. */
export function LessonVaultRow({
  card,
  onOpen,
  onPictureFile,
  onPasteTarget,
  pictureBusy,
  finding = false,
  fresh = false,
  selected = false,
  showChinese = true,
}: LessonVaultRowProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const { dropActive, dropHandlers } = useVaultImageDrop(onPictureFile)
  const showImage = Boolean(card.imageUrl) && failedImageUrl !== card.imageUrl
  const missingReason = missingPictureReason(card)
  const subtitle = rowSubtitle(card, showChinese)

  return (
    <button
      type="button"
      data-vault-card-id={card.id}
      aria-expanded={selected}
      aria-pressed={selected}
      aria-label={`${card.word}${card.partTitle ? ` — ${card.partTitle}` : ''}. ${selected ? 'Close card peek.' : 'Open card.'}`}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-1.5 py-1.5 pr-3 text-left outline-none transition-colors duration-150 motion-reduce:transition-none',
        'border-white/[0.07] bg-white/[0.035] hover:border-white/14 hover:bg-white/[0.06]',
        'focus-visible:ring-2 focus-visible:ring-sky-400/70',
        selected &&
          'border-[#E8DFC8]/35 bg-[#3a342c]/55 shadow-[inset_0_0_0_1px_rgba(232,223,200,0.12)]',
        dropActive && 'border-sky-400/60 bg-sky-500/10 ring-2 ring-sky-400/50',
        fresh && 'animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-500 motion-reduce:animate-none',
      )}
      onClick={onOpen}
      onPointerEnter={onPasteTarget}
      onFocus={onPasteTarget}
      {...dropHandlers}
    >
      <span
        className={cn(
          'relative flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.28)] ring-1 ring-black/10',
          VAULT_PAPER_CARD,
        )}
      >
        {showImage ? (
          <LessonVaultFittedImage
            src={card.imageUrl}
            alt=""
            className="h-full w-full"
            onError={() => setFailedImageUrl(card.imageUrl)}
          />
        ) : finding ? (
          <span
            className="flex h-full w-full items-center justify-center bg-[#E9D9C2] text-[#5C5B55] animate-pulse motion-reduce:animate-none"
            title="Finding picture…"
          >
            <Sparkles className="h-3.5 w-3.5" aria-label="Finding picture" />
          </span>
        ) : (
          <>
            <LessonVaultWordTile
              word={card.word}
              className="h-full w-full rounded-none from-[#E9D9C2] to-[#D8E3D8] text-[#45443F] ring-0"
              letterClassName="text-base"
            />
            <span
              className="absolute inset-0 flex items-center justify-center bg-[#292B27]/55 text-[#F6F2E9] opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
              title={missingReason}
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            </span>
          </>
        )}
        {pictureBusy || (finding && showImage) ? (
          <span className="absolute inset-0 flex items-center justify-center bg-[#292B27]/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F6F2E9]/90" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block truncate text-[15px] font-semibold tracking-tight text-[#f4f4f5]">{card.word}</span>
        {subtitle ? (
          <span
            lang={subtitle.lang}
            className={cn(
              'mt-0.5 block truncate text-[11px] leading-tight',
              subtitle.muted ? 'text-white/40' : 'text-amber-200/70',
            )}
          >
            {subtitle.text}
          </span>
        ) : null}
      </span>
    </button>
  )
}
