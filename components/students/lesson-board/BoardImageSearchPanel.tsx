'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  Box,
  Camera,
  ChevronLeft,
  Film,
  Image as ImageLucide,
  ImageIcon,
  Loader2,
  Palette,
  Search,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { BoardImageSearchResult, BoardImageSearchFallback } from '@/lib/board-image-search'
import type { ImageStyleKey } from '@/lib/quiz-image-style'
import {
  boardImageSearchEmptyMessage,
  fetchBoardImageSearch,
  readBoardImageSearchMediaType,
  readBoardImageSearchStyle,
  writeBoardImageSearchMediaType,
  writeBoardImageSearchStyle,
  type BoardImageMediaType,
} from '@/lib/board-image-search-client'
import {
  readBoardImageInsertMode,
  readFlashcardSaveToVocab,
  readFlashcardShowPinyin,
  writeBoardImageInsertMode,
  writeFlashcardSaveToVocab,
  writeFlashcardShowPinyin,
  type BoardImageInsertRequest,
} from '@/lib/lesson-board/board-image-insert'
import {
  fetchFlashcardTranslationWithAlternatives,
  flashcardMeaningLabel,
  flashcardMeaningOptions,
  formatFlashcardChineseLine,
  type FlashcardTranslation,
} from '@/lib/lesson-board/flashcard-translate-client'
import { FLASHCARD_PLACEHOLDER_ZH } from '@/lib/lesson-board/lesson-board-flashcard-layout'

export type BoardImageSearchPanelProps = {
  onInsertImage: (request: BoardImageInsertRequest) => Promise<boolean>
  disabled?: boolean
  /** Pre-fill search when opened (e.g. from vocab). */
  initialQuery?: string
  /** Icon-only trigger for narrow (standard) board headers. Popover only. */
  compact?: boolean
  /**
   * `popover` — board header trigger (default).
   * `drawer` — fill parent (class-tool drawer); use controlled `open` / `onOpenChange`.
   */
  variant?: 'popover' | 'drawer'
  /** Controlled open (required for drawer; optional for popover). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * When true, show “Add to board” (and flashcard options).
   * Drawer: only while the lesson board is visible. Popover: always true.
   */
  canAddToBoard?: boolean
  /**
   * Start tap-to-place (book or visible board). Drawer only for plain pictures.
   * Closes search after calling.
   */
  onPlacePicture?: (payload: { fullUrl: string; word: string }) => void
}

const MEDIA_OPTIONS: {
  media: BoardImageMediaType
  icon: typeof ImageLucide
  label: string
}[] = [
  { media: 'static', icon: ImageLucide, label: 'Photo' },
  { media: 'gif', icon: Film, label: 'GIF' },
]

const STYLE_OPTIONS: {
  key: ImageStyleKey
  icon: typeof Camera
  label: string
}[] = [
  { key: 'photo', icon: Camera, label: 'Photo style' },
  { key: 'flat2d', icon: Palette, label: 'Cartoon' },
  { key: 'render3d', icon: Box, label: '3D' },
]

type MeaningPickerState = {
  hit: BoardImageSearchResult
  word: string
  options: FlashcardTranslation[]
}

const DRAWER_SCROLL = cn(
  '[scrollbar-width:thin] [scrollbar-color:#52525b_transparent]',
  '[&::-webkit-scrollbar]:w-1.5',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#52525b]',
)

function IconToggleButton({
  pressed,
  label,
  disabled,
  onClick,
  dark,
  children,
}: {
  pressed: boolean
  label: string
  disabled?: boolean
  onClick: () => void
  dark?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2',
        dark
          ? cn(
              'focus-visible:ring-[#71717a]',
              pressed
                ? 'border-white/30 bg-white/15 text-white'
                : 'border-white/10 bg-white/5 text-[#a1a1aa] hover:border-white/20 hover:text-[#f4f4f5]',
            )
          : cn(
              'focus-visible:ring-[#2563EB]',
              pressed
                ? 'border-[#93C5FD] bg-[#EFF6FF] text-[#1D4ED8]'
                : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB] hover:text-[#374151]',
            ),
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {children}
    </button>
  )
}

export function BoardImageSearchPanel({
  onInsertImage,
  disabled = false,
  initialQuery = '',
  compact = false,
  variant = 'popover',
  open: openProp,
  onOpenChange,
  canAddToBoard = true,
  onPlacePicture,
}: BoardImageSearchPanelProps) {
  const isDrawer = variant === 'drawer'
  const dark = isDrawer
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedHitIndexRef = useRef(0)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange, openProp],
  )
  const [query, setQuery] = useState(initialQuery)
  const [searchHint, setSearchHint] = useState('')
  const [results, setResults] = useState<BoardImageSearchResult[]>([])
  const [fallback, setFallback] = useState<BoardImageSearchFallback | undefined>()
  const [loading, setLoading] = useState(false)
  const [insertingId, setInsertingId] = useState<string | null>(null)
  const [flashcardBusy, setFlashcardBusy] = useState(false)
  const [searchPage, setSearchPage] = useState(0)
  const [searchVariant, setSearchVariant] = useState(0)
  const [selectedHit, setSelectedHit] = useState<BoardImageSearchResult | null>(null)
  const [makeFlashcard, setMakeFlashcard] = useState(() => readBoardImageInsertMode() === 'flashcard')
  const [mediaType, setMediaType] = useState<BoardImageMediaType>(() => readBoardImageSearchMediaType())
  const [styleKey, setStyleKey] = useState<ImageStyleKey>(() => readBoardImageSearchStyle())
  const [showPinyin, setShowPinyin] = useState(() => readFlashcardShowPinyin())
  const [saveToVocab, setSaveToVocab] = useState(() => readFlashcardSaveToVocab())
  const [meaningPicker, setMeaningPicker] = useState<MeaningPickerState | null>(null)

  const setMakeFlashcardPersisted = useCallback((checked: boolean) => {
    setMakeFlashcard(checked)
    writeBoardImageInsertMode(checked ? 'flashcard' : 'picture')
  }, [])

  const setMediaTypePersisted = useCallback((next: BoardImageMediaType) => {
    setMediaType(next)
    writeBoardImageSearchMediaType(next)
  }, [])

  const setStyleKeyPersisted = useCallback((style: ImageStyleKey) => {
    setStyleKey(style)
    writeBoardImageSearchStyle(style)
  }, [])

  const setShowPinyinPersisted = useCallback((next: boolean) => {
    setShowPinyin(next)
    writeFlashcardShowPinyin(next)
  }, [])

  const setSaveToVocabPersisted = useCallback((next: boolean) => {
    setSaveToVocab(next)
    writeFlashcardSaveToVocab(next)
  }, [])

  const trimmedHint = searchHint.trim()
  const pinyinFormat = { showPinyin }
  const confirmViewActive = selectedHit != null && meaningPicker == null
  const searchViewActive = !confirmViewActive && meaningPicker == null
  const flashcardAllowed = canAddToBoard
  const effectiveMakeFlashcard = makeFlashcard && flashcardAllowed
  const canPlace = Boolean(onPlacePicture) && !effectiveMakeFlashcard

  useEffect(() => {
    if (!flashcardAllowed && makeFlashcard) {
      setMakeFlashcard(false)
    }
  }, [flashcardAllowed, makeFlashcard])

  const runSearch = useCallback(
    async (opts?: {
      page?: number
      variant?: number
      q?: string
      style?: ImageStyleKey
      media?: BoardImageMediaType
    }): Promise<BoardImageSearchResult[]> => {
      const q = (opts?.q ?? query).trim()
      if (!q) {
        setResults([])
        setFallback('empty_query')
        return []
      }

      setLoading(true)
      try {
        const page = opts?.page ?? searchPage
        const variantN = opts?.variant ?? searchVariant
        const style = opts?.style ?? styleKey
        const media = opts?.media ?? mediaType
        const body = await fetchBoardImageSearch({
          q,
          limit: 12,
          page,
          variant: String(variantN),
          style,
          searchHint: trimmedHint || undefined,
          mediaType: media,
        })
        setResults(body.results)
        setFallback(body.results.length > 0 ? undefined : body.fallback ?? 'no_results')
        return body.results
      } finally {
        setLoading(false)
      }
    },
    [query, searchPage, searchVariant, styleKey, mediaType, trimmedHint],
  )

  const pickHitFromResults = useCallback(
    (nextResults: BoardImageSearchResult[], preferredIndex: number) => {
      if (nextResults.length === 0) {
        setSelectedHit(null)
        return
      }
      const idx = preferredIndex >= 0 && preferredIndex < nextResults.length ? preferredIndex : 0
      selectedHitIndexRef.current = idx
      setSelectedHit(nextResults[idx]!)
    },
    [],
  )

  const refreshPreviewForFilters = useCallback(
    async (opts: { media?: BoardImageMediaType; style?: ImageStyleKey }) => {
      const nextMedia = opts.media ?? mediaType
      const nextStyle = opts.style ?? styleKey
      if (opts.media) setMediaTypePersisted(opts.media)
      if (opts.style) setStyleKeyPersisted(opts.style)
      const nextResults = await runSearch({
        page: 0,
        media: nextMedia,
        style: nextStyle,
      })
      pickHitFromResults(nextResults, selectedHitIndexRef.current)
    },
    [mediaType, pickHitFromResults, runSearch, setMediaTypePersisted, setStyleKeyPersisted, styleKey],
  )

  const resetPanelState = useCallback(() => {
    setSelectedHit(null)
    setMeaningPicker(null)
    selectedHitIndexRef.current = 0
    setMakeFlashcard(readBoardImageInsertMode() === 'flashcard')
    setMediaType(readBoardImageSearchMediaType())
    setStyleKey(readBoardImageSearchStyle())
    setShowPinyin(readFlashcardShowPinyin())
    setSaveToVocab(readFlashcardSaveToVocab())
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery)
    setSearchHint('')
    setSearchPage(0)
    setSearchVariant(0)
    setResults([])
    setFallback(undefined)
    resetPanelState()
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open, initialQuery, resetPanelState])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetPanelState()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchPage(0)
    setMeaningPicker(null)
    setSelectedHit(null)
    void runSearch({ page: 0, q: query })
  }

  const handleRefresh = () => {
    const nextVariant = searchVariant + 1
    setSearchVariant(nextVariant)
    void runSearch({ variant: nextVariant })
  }

  const handleThumbnailClick = (hit: BoardImageSearchResult, index: number) => {
    if (insertingId || flashcardBusy) return
    selectedHitIndexRef.current = index
    setSelectedHit(hit)
    setMakeFlashcard(readBoardImageInsertMode() === 'flashcard')
    setMeaningPicker(null)
  }

  const handleBackToResults = () => {
    setSelectedHit(null)
    setMeaningPicker(null)
  }

  const insertPicture = useCallback(
    async (hit: BoardImageSearchResult) => {
      setInsertingId(hit.id)
      try {
        const ok = await onInsertImage({
          fullUrl: hit.fullUrl,
          word: query.trim(),
          mode: 'picture',
          contextHint: trimmedHint || undefined,
          mediaType,
        })
        if (ok) {
          setOpen(false)
          resetPanelState()
        }
        return ok
      } finally {
        setInsertingId(null)
      }
    },
    [mediaType, onInsertImage, query, resetPanelState, setOpen, trimmedHint],
  )

  const insertFlashcard = useCallback(
    async (
      hit: BoardImageSearchResult,
      word: string,
      chineseLine: string,
      translation?: FlashcardTranslation,
    ) => {
      setInsertingId(hit.id)
      try {
        const ok = await onInsertImage({
          fullUrl: hit.fullUrl,
          word,
          mode: 'flashcard',
          contextHint: trimmedHint || undefined,
          chineseLine,
          showPinyin,
          mediaType,
          saveToVocab,
          vocabChinese: translation?.chinese,
          vocabPinyin: translation?.pinyin,
        })
        if (ok) {
          setMeaningPicker(null)
          setOpen(false)
          resetPanelState()
        }
        return ok
      } finally {
        setInsertingId(null)
      }
    },
    [mediaType, onInsertImage, resetPanelState, saveToVocab, setOpen, showPinyin, trimmedHint],
  )

  const handleAddToBoard = async () => {
    if (!selectedHit || insertingId || flashcardBusy || !canAddToBoard) return
    const word = query.trim()

    if (!effectiveMakeFlashcard) {
      await insertPicture(selectedHit)
      return
    }

    if (!word) return

    setFlashcardBusy(true)
    try {
      const translation = await fetchFlashcardTranslationWithAlternatives(
        word,
        trimmedHint || undefined,
      )
      if (!translation) {
        await insertFlashcard(selectedHit, word, FLASHCARD_PLACEHOLDER_ZH)
        return
      }

      const options = flashcardMeaningOptions(translation)
      if (options.length > 1) {
        setMeaningPicker({ hit: selectedHit, word, options })
        return
      }

      await insertFlashcard(
        selectedHit,
        word,
        formatFlashcardChineseLine(options[0]!, pinyinFormat),
        options[0],
      )
    } finally {
      setFlashcardBusy(false)
    }
  }

  const handlePlacePicture = () => {
    if (!selectedHit || !onPlacePicture || effectiveMakeFlashcard || addBusy) return
    onPlacePicture({
      fullUrl: selectedHit.fullUrl,
      word: query.trim(),
    })
    setOpen(false)
    resetPanelState()
  }

  const handleMeaningPick = async (option: FlashcardTranslation) => {
    if (!meaningPicker || insertingId) return
    await insertFlashcard(
      meaningPicker.hit,
      meaningPicker.word,
      formatFlashcardChineseLine(option, pinyinFormat),
      option,
    )
  }

  const showFlashcardOverlay =
    flashcardBusy ||
    (insertingId != null && effectiveMakeFlashcard && selectedHit?.id === insertingId)
  const attributionLabel = mediaType === 'gif' ? 'GIFs from GIPHY' : 'Images from Pixabay'
  const addBusy = Boolean(insertingId) || flashcardBusy
  const secondaryBtn = dark
    ? 'rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm font-medium text-[#e4e4e7] hover:bg-white/5 disabled:pointer-events-none disabled:opacity-45'
    : 'rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:pointer-events-none disabled:opacity-45'

  const labelMuted = dark ? 'text-[#71717a]' : 'text-[#6B7280]'
  const labelStrong = dark ? 'text-[#a1a1aa]' : 'text-[#6B7280]'
  const textBody = dark ? 'text-[#a1a1aa]' : 'text-[#374151]'
  const inputClass = dark
    ? cn(
        'rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5',
        'text-sm text-[#f4f4f5] placeholder:text-[#52525b]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]',
      )
    : cn(
        'rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-2.5 py-1.5',
        'text-sm text-[#111827] placeholder:text-[#9CA3AF]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]',
      )
  const primaryBtn = dark
    ? 'rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-[#18181b] hover:bg-white disabled:pointer-events-none disabled:opacity-45'
    : 'rounded-md bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:pointer-events-none disabled:opacity-45'
  const searchSubmitBtn = dark
    ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/90 text-[#18181b] hover:bg-white disabled:pointer-events-none disabled:opacity-45'
    : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:pointer-events-none disabled:opacity-45'
  const linkAccent = dark ? 'text-[#e4e4e7] hover:underline' : 'text-[#2563EB] hover:underline'
  const thumbBorder = dark
    ? 'border-white/10 bg-white/5 hover:border-white/25 hover:ring-2 hover:ring-white/15'
    : 'border-[#E5E7EB] bg-[#F3F4F6] hover:border-[#93C5FD] hover:ring-2 hover:ring-[#BFDBFE]'
  const panelBorder = dark ? 'border-white/10 bg-white/5' : 'border-[#E5E7EB] bg-[#F9FAFB]'
  const checkboxBorder = dark ? 'border-white/25' : 'border-[#D1D5DB]'

  const searchForm = searchViewActive ? (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-2.5', isDrawer && 'px-0')}>
      {!isDrawer ? (
        <label htmlFor={inputId} className={cn('text-[11px] font-semibold uppercase tracking-wide', labelStrong)}>
          Search
        </label>
      ) : null}
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. fly, jump…"
          autoComplete="off"
          className={cn('min-w-0 flex-1', inputClass)}
        />
        <button type="submit" disabled={loading || !query.trim()} aria-label="Search" className={searchSubmitBtn}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Search className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={hintId} className={cn('text-[10px] font-medium', labelMuted)}>
          Hint (optional)
        </label>
        <input
          id={hintId}
          type="text"
          value={searchHint}
          onChange={(e) => setSearchHint(e.target.value)}
          placeholder="e.g. insect, river water…"
          autoComplete="off"
          className={cn(inputClass, 'text-xs')}
        />
      </div>
    </form>
  ) : null

  const resultsBody = (
    <div className={cn('relative', isDrawer ? 'min-h-0 flex-1' : 'mt-3 min-h-[8rem]')}>
      {meaningPicker ? (
        <div className={cn('flex min-h-[8rem] flex-col gap-2 rounded-md border p-2.5', panelBorder)}>
          <p className={cn('text-[11px] font-semibold', textBody)}>Which meaning?</p>
          <div className="flex flex-col gap-1.5">
            {meaningPicker.options.map((option, index) => (
              <button
                key={`${option.chinese}-${index}`}
                type="button"
                disabled={Boolean(insertingId)}
                onClick={() => void handleMeaningPick(option)}
                className={cn(
                  'rounded-md border px-2.5 py-2 text-left text-xs',
                  dark
                    ? 'border-white/10 bg-white/5 text-[#f4f4f5] hover:border-white/25 hover:bg-white/10'
                    : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#93C5FD] hover:bg-[#EFF6FF]',
                  'focus-visible:outline-none focus-visible:ring-2',
                  dark ? 'focus-visible:ring-[#71717a]' : 'focus-visible:ring-[#2563EB]',
                  'disabled:opacity-50',
                )}
              >
                {flashcardMeaningLabel(option, pinyinFormat)}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={Boolean(insertingId)}
            onClick={() => setMeaningPicker(null)}
            className={cn('text-[11px] font-medium', labelMuted, dark ? 'hover:text-[#f4f4f5]' : 'hover:text-[#374151]')}
          >
            Back
          </button>
        </div>
      ) : null}

      {confirmViewActive && selectedHit ? (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={addBusy}
            onClick={handleBackToResults}
            className={cn(
              'flex w-fit items-center gap-0.5 text-[11px] font-medium disabled:opacity-50',
              labelMuted,
              dark ? 'hover:text-[#f4f4f5]' : 'hover:text-[#374151]',
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Back to results
          </button>

          <div className="flex items-stretch gap-1.5">
            <div className="flex flex-col gap-1" role="group" aria-label="Photo or GIF">
              {MEDIA_OPTIONS.map(({ media, icon: Icon, label }) => (
                <IconToggleButton
                  key={media}
                  dark={dark}
                  pressed={mediaType === media}
                  label={label}
                  disabled={addBusy || loading}
                  onClick={() => {
                    if (mediaType === media) return
                    void refreshPreviewForFilters({ media })
                  }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </IconToggleButton>
              ))}
            </div>

            <div
              className={cn(
                'relative min-h-[7.5rem] flex-1 overflow-hidden rounded-md border',
                dark ? 'border-white/10 bg-black/30' : 'border-[#E5E7EB] bg-[#F3F4F6]',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedHit.fullUrl || selectedHit.thumbUrl}
                alt=""
                className="h-full w-full object-contain"
              />
              {loading ? (
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center',
                    dark ? 'bg-black/40' : 'bg-white/55',
                  )}
                >
                  <Loader2
                    className={cn('h-5 w-5 animate-spin', dark ? 'text-white' : 'text-[#2563EB]')}
                    aria-hidden
                  />
                </span>
              ) : null}
            </div>

            {mediaType === 'static' ? (
              <div className="flex flex-col gap-1" role="group" aria-label="Picture style">
                {STYLE_OPTIONS.map(({ key, icon: Icon, label }) => (
                  <IconToggleButton
                    key={key}
                    dark={dark}
                    pressed={styleKey === key}
                    label={label}
                    disabled={addBusy || loading}
                    onClick={() => {
                      if (styleKey === key) return
                      void refreshPreviewForFilters({ style: key })
                    }}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </IconToggleButton>
                ))}
              </div>
            ) : null}
          </div>

          {mediaType === 'gif' ? (
            <p className={cn('text-[10px] leading-snug', labelMuted)}>
              Saved as a still image (no animation after place).
            </p>
          ) : null}

          {flashcardAllowed ? (
            <div className="flex flex-col gap-1.5">
              <label className={cn('flex cursor-pointer items-center gap-2 text-[11px]', textBody)}>
                <input
                  type="checkbox"
                  checked={makeFlashcard}
                  onChange={(e) => setMakeFlashcardPersisted(e.target.checked)}
                  disabled={addBusy}
                  className={cn('h-3.5 w-3.5 rounded', checkboxBorder)}
                />
                Make flashcard
              </label>
              {effectiveMakeFlashcard ? (
                <>
                  <label className={cn('flex cursor-pointer items-center gap-2 text-[11px]', textBody)}>
                    <input
                      type="checkbox"
                      checked={showPinyin}
                      onChange={(e) => setShowPinyinPersisted(e.target.checked)}
                      disabled={addBusy}
                      className={cn('h-3.5 w-3.5 rounded', checkboxBorder)}
                    />
                    Show pinyin on flashcard
                  </label>
                  <label className={cn('flex cursor-pointer items-center gap-2 text-[11px]', textBody)}>
                    <input
                      type="checkbox"
                      checked={saveToVocab}
                      onChange={(e) => setSaveToVocabPersisted(e.target.checked)}
                      disabled={addBusy}
                      className={cn('h-3.5 w-3.5 rounded', checkboxBorder)}
                    />
                    Also save to my word list
                  </label>
                </>
              ) : null}
            </div>
          ) : onPlacePicture ? (
            <p className={cn('text-[10px] leading-snug', labelMuted)}>
              Tap the book to place. Open the lesson board to add flashcards.
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            {canPlace ? (
              <button
                type="button"
                disabled={addBusy || loading || !selectedHit}
                onClick={handlePlacePicture}
                className={cn('w-full', primaryBtn)}
              >
                {canAddToBoard ? 'Place on book or board' : 'Place on book'}
              </button>
            ) : null}
            {canAddToBoard ? (
              <button
                type="button"
                disabled={addBusy || loading || !selectedHit}
                onClick={() => void handleAddToBoard()}
                className={cn('w-full', canPlace ? secondaryBtn : primaryBtn)}
              >
                {addBusy
                  ? 'Adding…'
                  : effectiveMakeFlashcard
                    ? 'Add flashcard to board'
                    : 'Add to board'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showFlashcardOverlay && !meaningPicker ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md',
            dark ? 'bg-[#2a2a2e]/90 text-[#a1a1aa]' : 'bg-white/80 text-[#374151]',
          )}
          aria-live="polite"
        >
          <Loader2
            className={cn('h-6 w-6 animate-spin', dark ? 'text-white' : 'text-[#2563EB]')}
            aria-hidden
          />
          <span className="text-xs font-medium">Adding flashcard…</span>
        </div>
      ) : null}

      {searchViewActive && loading && results.length === 0 ? (
        <div
          className={cn('flex min-h-[8rem] flex-col items-center justify-center gap-2', labelMuted)}
          aria-busy="true"
        >
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span className="text-xs">Searching…</span>
        </div>
      ) : null}

      {searchViewActive && results.length > 0 ? (
        <>
          <div className={cn('grid gap-1.5', isDrawer ? 'grid-cols-2' : 'grid-cols-3')}>
            {results.map((hit, index) => (
              <button
                key={hit.id}
                type="button"
                disabled={addBusy}
                onClick={() => handleThumbnailClick(hit, index)}
                title={hit.attribution ?? 'Choose picture'}
                aria-label="Choose picture"
                className={cn(
                  'relative aspect-square overflow-hidden rounded-md border transition',
                  thumbBorder,
                  'focus-visible:outline-none focus-visible:ring-2',
                  dark ? 'focus-visible:ring-[#71717a]' : 'focus-visible:ring-[#2563EB]',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hit.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className={cn('text-[10px] leading-snug', dark ? 'text-[#52525b]' : 'text-[#9CA3AF]')}>
              {attributionLabel}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={handleRefresh}
              className={cn('text-[11px] font-medium disabled:opacity-45', linkAccent)}
            >
              More
            </button>
          </div>
        </>
      ) : null}

      {searchViewActive && !loading && results.length === 0 ? (
        <p className={cn('px-1 py-6 text-center text-xs leading-relaxed', labelMuted)}>
          {fallback
            ? boardImageSearchEmptyMessage(fallback, mediaType)
            : 'Search for a word to see pictures.'}
        </p>
      ) : null}
    </div>
  )

  if (isDrawer) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {searchForm ? (
          <div className="shrink-0 border-b border-white/[0.08] px-4 pb-3">{searchForm}</div>
        ) : null}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-3', DRAWER_SCROLL)}>{resultsBody}</div>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Find picture"
          title="Find picture"
          className={cn(
            'pointer-events-auto flex h-7 shrink-0 items-center rounded-md',
            'text-[11px] font-medium text-[#374151] transition-colors',
            'hover:bg-black/[0.05] active:bg-black/[0.08]',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D1D5DB]',
            'disabled:pointer-events-none disabled:opacity-35',
            compact ? 'w-7 justify-center' : 'gap-1 px-1.5',
          )}
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0 stroke-[2.25]" aria-hidden />
          {!compact ? <span className="max-w-[5.5rem] truncate">Find picture</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-[min(18.5rem,calc(100vw-1.5rem))] border-[#EBEEF2] bg-white p-3 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {searchForm}
        {resultsBody}
      </PopoverContent>
    </Popover>
  )
}
