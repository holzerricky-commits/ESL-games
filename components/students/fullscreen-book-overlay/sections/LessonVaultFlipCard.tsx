'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ChevronUp,
  ClipboardPaste,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LessonVaultCard, LessonVaultCardTextPatch } from '@/lib/lesson-vault/types'
import { cn } from '@/lib/utils'
import { VAULT_CARD_FRONT, VAULT_PART_PILL } from './lesson-vault-card-style'
import { LessonVaultFittedImage } from './LessonVaultFittedImage'
import { useVaultImageDrop } from './LessonVaultRow'
import { LessonVaultWordTile } from './LessonVaultWordTile'

export type LessonVaultPictureAction = 'search' | 'paste' | 'cut'

type LessonVaultCardDetailsProps = {
  card: LessonVaultCard
  onCollapse: () => void
  onSaveText: (patch: LessonVaultCardTextPatch) => boolean
  /** Generate or regenerate sentence and/or meaning; returns the saved patch. */
  onGenerateText: (fields: 'sentence' | 'meaning' | 'both') => Promise<LessonVaultCardTextPatch | null>
  textBusy: boolean
  onPictureAction: (action: LessonVaultPictureAction) => void
  /** Image file dropped on the card. */
  onPictureFile: (file: File) => void
  /** Pointer or focus is on this card, so Ctrl+V goes here. */
  onPasteTarget: () => void
  pictureBusy: boolean
  /** Automatic picture search (or a swap) is running. */
  finding: boolean
  /** Swap to another automatic picture. */
  onChooseChoice: (index: number) => void
  /** Run the automatic search again for a blank card. */
  onRetryAuto: () => void
  onDelete: () => void
  /** Other lessons of this unit the card can move to. */
  moveTargets: { id: string; title: string }[]
  onMove: (lessonId: string) => void
}

/** Primary picture paths — Cut stays in More. */
const PRIMARY_PICTURE_ACTIONS: { action: Exclude<LessonVaultPictureAction, 'cut'>; label: string; icon: typeof Search }[] =
  [
    { action: 'search', label: 'Search', icon: Search },
    { action: 'paste', label: 'Paste', icon: ClipboardPaste },
  ]

const FIELD =
  'w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[#f4f4f5] placeholder:text-white/30 focus:border-sky-400/60 focus:outline-none'

const ICON_BTN =
  'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#a1a1aa] hover:bg-white/5 hover:text-[#f4f4f5]'

/** Opened vault word: picture + text repair. Teaching lives in Review. */
export function LessonVaultCardDetails({
  card,
  onCollapse,
  onSaveText,
  onGenerateText,
  textBusy,
  onPictureAction,
  onPictureFile,
  onPasteTarget,
  pictureBusy,
  finding,
  onChooseChoice,
  onRetryAuto,
  onDelete,
  moveTargets,
  onMove,
}: LessonVaultCardDetailsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [editing, setEditing] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const [draftWord, setDraftWord] = useState('')
  const [draftSentence, setDraftSentence] = useState('')
  const [draftMeaning, setDraftMeaning] = useState('')
  const { dropActive, dropHandlers } = useVaultImageDrop(onPictureFile)
  const showImage = Boolean(card.imageUrl) && failedImageUrl !== card.imageUrl
  const hasSentence = Boolean(card.sentence.trim())
  const hasMeaning = Boolean(card.meaning.trim())
  const needsText = !hasSentence || !hasMeaning

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  function runPictureAction(action: LessonVaultPictureAction) {
    onPasteTarget()
    onPictureAction(action)
  }

  function startEdit() {
    setDraftWord(card.word)
    setDraftSentence(card.sentence)
    setDraftMeaning(card.meaning)
    setEditing(true)
  }

  function saveEdit() {
    if (onSaveText({ word: draftWord, sentence: draftSentence, meaning: draftMeaning })) setEditing(false)
  }

  async function runGenerate(fields: 'sentence' | 'meaning' | 'both') {
    if (textBusy) return
    if (editing) {
      // Save drafts first so the model can use what the teacher already typed.
      onSaveText({ word: draftWord, sentence: draftSentence, meaning: draftMeaning })
    }
    const patch = await onGenerateText(fields)
    if (!patch) return
    if (editing) {
      setDraftWord(patch.word ?? card.word)
      setDraftSentence(patch.sentence)
      setDraftMeaning(patch.meaning)
    }
  }

  function onFieldKeyDown(e: KeyboardEvent<HTMLElement>) {
    e.stopPropagation()
    if (e.key === 'Escape') setEditing(false)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit()
  }

  function onRootKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && !editing) {
      e.stopPropagation()
      onCollapse()
    }
  }

  const textActionBtn =
    'flex h-7 cursor-pointer items-center gap-1 rounded-md bg-white/[0.06] px-2 text-[11px] font-medium text-white/60 hover:bg-sky-400/15 hover:text-sky-200 disabled:cursor-default disabled:opacity-50'

  const pictureActionButtons = (variant: 'bar' | 'box') =>
    PRIMARY_PICTURE_ACTIONS.map(({ action, label, icon: Icon }) => (
      <button
        key={action}
        type="button"
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded-md text-[11px] font-medium',
          variant === 'bar'
            ? 'h-7 bg-black/60 px-2 text-white/85 hover:bg-black/75 hover:text-white'
            : 'h-7 bg-white/[0.06] px-2 text-white/60 hover:bg-sky-400/15 hover:text-sky-200',
        )}
        aria-label={`${label} — picture for ${card.word}`}
        disabled={pictureBusy}
        onClick={() => runPictureAction(action)}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>
    ))

  return (
    <div
      ref={rootRef}
      data-vault-card-id={card.id}
      className={cn(
        'relative flex flex-col gap-2.5 rounded-xl border p-3 animate-in fade-in zoom-in-[0.98] duration-200 motion-reduce:animate-none',
        VAULT_CARD_FRONT,
        dropActive && 'ring-2 ring-sky-400/70',
      )}
      onPointerEnter={onPasteTarget}
      onFocus={onPasteTarget}
      onKeyDown={onRootKeyDown}
      {...dropHandlers}
    >
      <div className="flex items-start gap-1">
        {!showImage ? (
          <LessonVaultWordTile word={card.word} className="mr-2 h-12 w-12 shrink-0 rounded-lg" letterClassName="text-2xl" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="break-words text-xl font-semibold text-[#f4f4f5]">{card.word}</p>
          {card.partTitle ? <span className={cn('mt-1 inline-block', VAULT_PART_PILL)}>{card.partTitle}</span> : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={ICON_BTN} aria-label={`More for ${card.word}`} title="More">
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            <DropdownMenuItem disabled={pictureBusy} onSelect={() => runPictureAction('cut')}>
              <Scissors className="h-3.5 w-3.5" aria-hidden />
              Cut from page
            </DropdownMenuItem>
            {moveTargets.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Move to lesson</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[10rem]">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      This unit
                    </DropdownMenuLabel>
                    {moveTargets.map((lesson) => (
                      <DropdownMenuItem key={lesson.id} onSelect={() => onMove(lesson.id)}>
                        {lesson.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          className={cn(ICON_BTN, 'hover:bg-rose-500/15 hover:text-rose-300')}
          aria-label={`Delete ${card.word}`}
          title="Delete card"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button type="button" className={cn(ICON_BTN, '-mr-1')} aria-label={`Close ${card.word}`} title="Close" onClick={onCollapse}>
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="relative rounded-md">
        {showImage ? (
          <div className="group/picture relative overflow-hidden rounded-md bg-black/30">
            <LessonVaultFittedImage
              src={card.imageUrl}
              alt={card.word}
              className="aspect-[4/3] w-full"
              onError={() => setFailedImageUrl(card.imageUrl)}
            />
            <div className="absolute inset-x-1.5 bottom-1.5 flex flex-wrap justify-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/picture:opacity-100">
              {pictureActionButtons('bar')}
            </div>
          </div>
        ) : finding ? (
          <div className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-sky-400/10 text-xs font-medium text-sky-100/80 animate-pulse motion-reduce:animate-none">
            <Sparkles className="h-4 w-4" aria-hidden />
            Finding picture…
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-white/12 px-2 py-1.5">
            <span className="flex items-center gap-1.5 text-[11px] text-white/45">
              <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="font-medium text-white/60">Add a picture</span>
              {card.imageUrl ? (
                <span className="truncate">· the old one is unavailable</span>
              ) : card.autoPicture === 'abstract' ? (
                <span className="truncate">· hard to picture</span>
              ) : card.autoPicture === 'not-found' ? (
                <span className="truncate">· none found automatically</span>
              ) : null}
            </span>
            <div className="flex flex-wrap gap-1">
              {pictureActionButtons('box')}
              {card.autoPicture === 'not-found' || card.autoPicture === 'abstract' ? (
                <button
                  type="button"
                  className="flex h-7 cursor-pointer items-center gap-1 rounded-md bg-white/[0.06] px-2 text-[11px] font-medium text-white/60 hover:bg-sky-400/15 hover:text-sky-200"
                  onClick={onRetryAuto}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        )}
        {pictureBusy || (finding && showImage) ? (
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-md bg-black/60 text-xs font-medium text-white/85">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {pictureBusy ? 'Saving picture…' : 'Changing picture…'}
          </div>
        ) : null}
      </div>

      {card.pictureChoices.length > 1 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-white/40">Other pictures</span>
          <div className="flex gap-1.5">
            {card.pictureChoices.map((choice, i) => {
              const current = card.pictureSource === 'auto' && card.pictureChoiceIndex === i
              return (
                <button
                  key={choice.full}
                  type="button"
                  disabled={current || finding || pictureBusy}
                  aria-label={`Use picture ${i + 1} for ${card.word}`}
                  aria-pressed={current}
                  className={cn(
                    'aspect-[4/3] min-w-0 flex-1 cursor-pointer overflow-hidden rounded-md bg-black/30 ring-1 ring-white/10 transition hover:ring-sky-400/70 disabled:cursor-default',
                    current && 'ring-2 ring-sky-400',
                    !current && (finding || pictureBusy) && 'opacity-50',
                  )}
                  onClick={() => onChooseChoice(i)}
                >
                  <LessonVaultFittedImage src={choice.thumb} alt="" className="h-full w-full" />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            className={cn(FIELD, 'font-semibold')}
            value={draftWord}
            placeholder="Word"
            aria-label="Word"
            onChange={(e) => setDraftWord(e.target.value)}
            onKeyDown={onFieldKeyDown}
          />
          <textarea
            className={cn(FIELD, 'min-h-[4.5rem] resize-none leading-relaxed')}
            value={draftSentence}
            placeholder="Example sentence"
            aria-label="Example sentence"
            autoFocus
            onChange={(e) => setDraftSentence(e.target.value)}
            onKeyDown={onFieldKeyDown}
          />
          <input
            className={FIELD}
            value={draftMeaning}
            placeholder="Short meaning (optional)"
            aria-label="Short meaning"
            onChange={(e) => setDraftMeaning(e.target.value)}
            onKeyDown={onFieldKeyDown}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={textActionBtn}
              disabled={textBusy}
              onClick={() => void runGenerate('sentence')}
            >
              {textBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
              {draftSentence.trim() ? 'Regenerate sentence' : 'Generate sentence'}
            </button>
            <button
              type="button"
              className={textActionBtn}
              disabled={textBusy}
              onClick={() => void runGenerate('meaning')}
            >
              {textBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
              {draftMeaning.trim() ? 'Regenerate meaning' : 'Generate meaning'}
            </button>
            <div className="ml-auto flex gap-1.5">
              <button
                type="button"
                className="h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium text-[#a1a1aa] hover:bg-white/5 hover:text-[#f4f4f5]"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-7 cursor-pointer rounded-md bg-sky-500 px-2.5 text-xs font-semibold text-white hover:bg-sky-400"
                onClick={saveEdit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md bg-sky-400/[0.06] px-2.5 py-2">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {hasSentence ? (
                <p className="text-sm leading-relaxed text-[#f4f4f5]">{card.sentence}</p>
              ) : (
                <p className="text-sm italic text-white/40">No sentence yet.</p>
              )}
              {hasMeaning ? <p className="text-xs text-white/55">{card.meaning}</p> : null}
            </div>
            <button
              type="button"
              className={cn(ICON_BTN, '-mr-1')}
              aria-label={`Edit ${card.word}`}
              title="Edit word, sentence and meaning"
              onClick={startEdit}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {needsText ? (
            <div className="flex flex-wrap gap-1">
              {!hasSentence && !hasMeaning ? (
                <button
                  type="button"
                  className={textActionBtn}
                  disabled={textBusy}
                  onClick={() => void runGenerate('both')}
                >
                  {textBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Generate sentence & meaning
                </button>
              ) : !hasSentence ? (
                <button
                  type="button"
                  className={textActionBtn}
                  disabled={textBusy}
                  onClick={() => void runGenerate('sentence')}
                >
                  {textBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Generate sentence
                </button>
              ) : (
                <button
                  type="button"
                  className={textActionBtn}
                  disabled={textBusy}
                  onClick={() => void runGenerate('meaning')}
                >
                  {textBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Generate meaning
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
