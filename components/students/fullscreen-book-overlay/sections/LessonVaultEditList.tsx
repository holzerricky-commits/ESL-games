'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  LessonVaultCardDetails,
  type LessonVaultPictureAction,
} from '@/components/students/fullscreen-book-overlay/sections/LessonVaultFlipCard'
import { LessonVaultRow } from '@/components/students/fullscreen-book-overlay/sections/LessonVaultRow'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import {
  readImageFileFromDataTransfer,
  resolvePastedBoardImageFromNavigatorClipboard,
} from '@/lib/books/clipboard-image'
import { isLessonVaultPasteZoneActive, LESSON_VAULT_PASTE_ZONE_ATTR } from '@/lib/lesson-vault/paste-zone'
import { cardsMissingPicture, type LessonVaultCard, type LessonVaultCardTextPatch } from '@/lib/lesson-vault/types'
import { LESSON_VAULT_DROP_ATTR } from '@/lib/lesson-vault/vault-drag'
import { cn } from '@/lib/utils'

const NO_CLIPBOARD_PICTURE = 'Copy a picture first (Win+Shift+S for a snip).'

type LessonVaultEditListProps = {
  cards: readonly LessonVaultCard[]
  /** Other lessons of this unit the card can move to. */
  moveTargets: { id: string; title: string }[]
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
  className?: string
}

/** Accordion editor for vault cards — used in Review “Edit cards”. */
export function LessonVaultEditList({
  cards,
  moveTargets,
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
  className,
}: LessonVaultEditListProps) {
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const [textBusyIds, setTextBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const pasteTargetIdRef = useRef<string | null>(null)

  const newestFirst = useMemo(
    () => [...cards].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    [cards],
  )
  const missingPictures = useMemo(
    () => cardsMissingPicture(cards).filter((c) => !findingIds.has(c.id)),
    [cards, findingIds],
  )

  const storePictureFile = useCallback(
    async (card: LessonVaultCard, file: Blob) => {
      setBusyIds((prev) => new Set(prev).add(card.id))
      try {
        await onPictureFile(card, file)
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev)
          next.delete(card.id)
          return next
        })
      }
    },
    [onPictureFile],
  )

  const pasteFromClipboardButton = useCallback(
    async (card: LessonVaultCard) => {
      const resolved = await resolvePastedBoardImageFromNavigatorClipboard()
      if (!resolved) {
        toast.error(NO_CLIPBOARD_PICTURE)
        return
      }
      await storePictureFile(card, resolved.file)
    },
    [storePictureFile],
  )

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData || !isLessonVaultPasteZoneActive()) return
      if (isBookOverlayKeyboardTypingTarget()) return
      const file = readImageFileFromDataTransfer(e.clipboardData)
      if (!file) return
      const focusedId =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLElement>('[data-vault-card-id]')?.dataset.vaultCardId
          : undefined
      const targetId = focusedId ?? pasteTargetIdRef.current
      const card = cards.find((c) => c.id === targetId)
      e.preventDefault()
      if (!card) {
        toast.message('Point at a card, then paste.')
        return
      }
      void storePictureFile(card, file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [cards, storePictureFile])

  function runPictureAction(card: LessonVaultCard, action: LessonVaultPictureAction) {
    if (action === 'search') onSearchPicture(card)
    else if (action === 'cut') onCutPicture(card)
    else void pasteFromClipboardButton(card)
  }

  if (cards.length === 0) {
    return (
      <p className={cn('text-sm text-white/55', className)}>
        No words yet. In Select mode, click a word on the page and choose Save to vault.
      </p>
    )
  }

  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      {...{ [LESSON_VAULT_PASTE_ZONE_ATTR]: '', [LESSON_VAULT_DROP_ATTR]: '' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-white/45">
          Fix pictures, sentences, and meanings. Open a word to edit it.
        </p>
        {missingPictures.length > 0 ? (
          <button
            type="button"
            className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-xs font-medium text-sky-200 hover:bg-sky-400/15"
            onClick={() => onFindMissingPictures(missingPictures)}
            title="Find cartoon pictures for words without one"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Find pictures ({missingPictures.length})
          </button>
        ) : null}
      </div>
      <ul className="mx-auto flex w-full max-w-xl flex-col gap-1.5">
        {newestFirst.map((card) => {
          const setPasteTarget = () => {
            pasteTargetIdRef.current = card.id
          }
          return (
            <li key={card.id}>
              {openCardId === card.id ? (
                <LessonVaultCardDetails
                  card={card}
                  onCollapse={() => setOpenCardId(null)}
                  onSaveText={(patch) => onUpdateCardText(card.id, patch)}
                  onGenerateText={async (fields) => {
                    setTextBusyIds((prev) => new Set(prev).add(card.id))
                    try {
                      return await onGenerateCardText(card.id, fields)
                    } finally {
                      setTextBusyIds((prev) => {
                        if (!prev.has(card.id)) return prev
                        const next = new Set(prev)
                        next.delete(card.id)
                        return next
                      })
                    }
                  }}
                  textBusy={textBusyIds.has(card.id)}
                  onPictureAction={(action) => runPictureAction(card, action)}
                  onPictureFile={(file) => void storePictureFile(card, file)}
                  onPasteTarget={setPasteTarget}
                  pictureBusy={busyIds.has(card.id)}
                  finding={findingIds.has(card.id)}
                  onChooseChoice={(index) => onChooseCardPicture(card.id, index)}
                  onRetryAuto={() => onRetryAutoPicture(card)}
                  onDelete={() => {
                    if (onDeleteCard(card.id)) setOpenCardId(null)
                  }}
                  moveTargets={moveTargets}
                  onMove={(lessonId) => {
                    if (onMoveCard(card.id, lessonId)) setOpenCardId(null)
                  }}
                />
              ) : (
                <LessonVaultRow
                  card={card}
                  onOpen={() => setOpenCardId(card.id)}
                  onPictureFile={(file) => void storePictureFile(card, file)}
                  onPasteTarget={setPasteTarget}
                  pictureBusy={busyIds.has(card.id)}
                  finding={findingIds.has(card.id)}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
