'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookmarkPlus, ChevronRight, Image as ImageIcon, Languages, Loader2, Volume2, X } from 'lucide-react'
import { CHINESE_SPEECH_INSTALL_HINT, CHINESE_SPEECH_INSTALL_HINT_SHORT, speakChinese, speakEnglish, warmSpeechVoices } from '@/lib/audio/speak-text'
import { useSpeechVoiceReady } from '@/lib/audio/use-speech-voice-ready'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSavedWords } from '@/components/students/fullscreen-book-overlay/hooks/useSavedWords'
import {
  contextFromWindowSelection,
  fetchTranslation,
  type TranslationResult,
} from '@/lib/translate/translate-client'
import { toast } from 'sonner'

import { ANNOTATION_CHROME_SURFACE_PILL } from '@/components/students/annotation-chrome-styles'
import {
  BOOK_PAGE_LIST_RAIL_WIDTH_PX,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH_PX,
} from '@/components/students/fullscreen-book-overlay/constants'

/** Solid charcoal chrome — same family as the annotation toolbars and page list. */
const DOCK_SURFACE = cn(ANNOTATION_CHROME_SURFACE_PILL, 'text-[#d4d4d8]')

const DOCK_BOTTOM_INSET_PX = 56
/** Gap between the left rail's translate button and the dock when it flies out. */
const ANCHOR_GAP_PX = 10
const DOCK_SIDE_INSET_PX = BOOK_WORKSPACE_LEFT_BAR_WIDTH_PX + ANCHOR_GAP_PX
const PAGE_LIST_LEFT_INSET_PX = BOOK_WORKSPACE_LEFT_BAR_WIDTH_PX + BOOK_PAGE_LIST_RAIL_WIDTH_PX

/** Compact icon on the search row and result actions. */
const RESULT_ICON_BTN =
  'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#a1a1aa] transition-colors hover:bg-[#3f3f46] hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a] disabled:pointer-events-none disabled:opacity-40'

/** Matches search input height — English hear on the query row. */
const SEARCH_ROW_ICON_BTN = cn(RESULT_ICON_BTN, 'h-10 w-10')

/** Clickable Chinese result — press pulse confirms copy + pick-up. */
const CHINESE_PICK_BTN =
  '-mx-1 origin-left cursor-pointer rounded-lg px-1 text-left font-semibold leading-tight text-[#f4f4f5] transition-[transform,background-color] duration-150 hover:bg-[#3f3f46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]'

const CHINESE_PICK_PULSE = 'scale-90 bg-[#52525b]'

const PICK_PULSE_MS = 240

/** Slim charcoal scrollbar for the result area — matches the panel chrome. */
const RESULT_SCROLLBAR = cn(
  '[scrollbar-width:thin] [scrollbar-color:#52525b_transparent]',
  '[&::-webkit-scrollbar]:w-2',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#52525b]',
  '[&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-[#2a2a2e]',
  'hover:[&::-webkit-scrollbar-thumb]:bg-[#71717a]',
)

/**
 * Anchored from the parent's bottom edge so a growing result expands upward
 * (the dock lives near the bottom rail button; growing down would run off-screen).
 */
type DockPosition = { x: number; bottom: number }

interface TranslateDockProps {
  studentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  suppressChrome: boolean
  pageListOpen: boolean
  /** When set, clicking a Chinese result copies it and starts tap-to-place on the spread. */
  onPlaceText?: (text: string) => void
}

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, button, textarea, a, select, [role="button"], [data-translate-no-drag]'))
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function TranslateDock({
  studentId,
  open,
  onOpenChange,
  suppressChrome,
  pageListOpen,
  onPlaceText,
}: TranslateDockProps) {
  const dockRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originBottom: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [resultImageUrl, setResultImageUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [savingWord, setSavingWord] = useState(false)
  /** "Other meanings" starts collapsed on every new lookup. */
  const [altsOpen, setAltsOpen] = useState(false)
  /** Chinese string currently flashing its press pulse. */
  const [pickPulse, setPickPulse] = useState<string | null>(null)
  const pickPulseTimerRef = useRef<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<DockPosition | null>(null)
  const [dragging, setDragging] = useState(false)
  const clientCacheRef = useRef<Map<string, TranslationResult>>(new Map())
  const { saveWord } = useSavedWords({
    studentId,
    onPersistenceError: (message) => toast.error(message),
  })
  const enReady = useSpeechVoiceReady('en')
  const zhReady = useSpeechVoiceReady('zh')

  const defaultLeftInset = pageListOpen ? PAGE_LIST_LEFT_INSET_PX : DOCK_SIDE_INSET_PX

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    warmSpeechVoices()
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) {
      setPosition(null)
      setDragging(false)
      dragRef.current = null
    }
  }, [open])

  /** Fly out beside the rail button that opened the dock (bottom edges aligned, viewport coords). */
  const placeAtDefault = useCallback(() => {
    const el = dockRef.current
    if (!el) return

    const maxX = Math.max(0, window.innerWidth - el.offsetWidth)
    const maxBottom = Math.max(0, window.innerHeight - el.offsetHeight)
    let x = defaultLeftInset
    let bottom = DOCK_BOTTOM_INSET_PX

    const anchor = document.querySelector('[data-book-translate-anchor]')
    if (anchor instanceof HTMLElement) {
      const anchorRect = anchor.getBoundingClientRect()
      x = Math.max(defaultLeftInset, anchorRect.right + ANCHOR_GAP_PX)
      bottom = window.innerHeight - anchorRect.bottom
    }

    setPosition({ x: clamp(x, 0, maxX), bottom: clamp(bottom, 0, maxBottom) })
  }, [defaultLeftInset])

  useLayoutEffect(() => {
    if (!open || position) return
    placeAtDefault()
  }, [open, position, placeAtDefault])

  useLayoutEffect(() => {
    if (!open || dragging) return
    setPosition((prev) => {
      if (!prev) return prev
      const el = dockRef.current
      if (!el) return prev
      const x = clamp(prev.x, 0, Math.max(0, window.innerWidth - el.offsetWidth))
      const bottom = clamp(prev.bottom, 0, Math.max(0, window.innerHeight - el.offsetHeight))
      if (x === prev.x && bottom === prev.bottom) return prev
      return { x, bottom }
    })
  }, [open, pageListOpen, dragging, position])

  const runTranslate = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text) return
    const context = contextFromWindowSelection(text)

    setLoading(true)
    try {
      const outcome = await fetchTranslation(text, context, { cache: clientCacheRef.current })
      if (!outcome.ok) {
        toast.error(outcome.error)
        return
      }
      setResult(outcome.result)
      setResultImageUrl('')
      setAltsOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runTranslate(draft)
  }

  const requestResultImage = useCallback(async () => {
    const word = result?.source?.trim()
    if (!word) return
    setImageLoading(true)
    try {
      const variant = Date.now().toString(36)
      const imageUrl = `/api/quiz-image?q=${encodeURIComponent(word)}&type=static&v=${encodeURIComponent(variant)}`
      setResultImageUrl(imageUrl)
    } finally {
      setImageLoading(false)
    }
  }, [result?.source])

  /** Copy the Chinese and hand it off for tap-to-place on the book page. */
  const pickChineseForPlacement = useCallback(
    (chinese: string) => {
      const text = chinese.trim()
      if (!text || !onPlaceText) return
      void navigator.clipboard.writeText(text).catch(() => {})
      setPickPulse(text)
      if (pickPulseTimerRef.current != null) window.clearTimeout(pickPulseTimerRef.current)
      pickPulseTimerRef.current = window.setTimeout(() => {
        pickPulseTimerRef.current = null
        setPickPulse(null)
      }, PICK_PULSE_MS)
      onPlaceText(text)
    },
    [onPlaceText],
  )

  useEffect(() => {
    return () => {
      if (pickPulseTimerRef.current != null) window.clearTimeout(pickPulseTimerRef.current)
    }
  }, [])

  const saveCurrentWord = useCallback(() => {
    if (!result) return
    setSavingWord(true)
    try {
      const mode = saveWord({
        source: result.source,
        chinese: result.chinese,
        pinyin: result.pinyin,
        exampleEn: result.exampleEn,
        exampleZh: result.exampleZh,
        imageUrl: resultImageUrl,
      })
      toast.success(mode === 'updated' ? 'Word updated in saved words.' : 'Word saved.')
    } finally {
      setSavingWord(false)
    }
  }, [result, resultImageUrl, saveWord])

  const onDockPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isInteractiveDragTarget(e.target)) return

    const el = dockRef.current
    if (!el) return

    e.preventDefault()

    const rect = el.getBoundingClientRect()
    const originX = position?.x ?? rect.left
    const originBottom = position?.bottom ?? window.innerHeight - rect.bottom

    if (!position) setPosition({ x: originX, bottom: originBottom })

    dragRef.current = { startX: e.clientX, startY: e.clientY, originX, originBottom }
    setDragging(true)
    el.setPointerCapture(e.pointerId)
  }

  const onDockPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const el = dockRef.current
    if (!drag || !el) return

    setPosition({
      x: clamp(
        drag.originX + e.clientX - drag.startX,
        0,
        Math.max(0, window.innerWidth - el.offsetWidth),
      ),
      bottom: clamp(
        drag.originBottom - (e.clientY - drag.startY),
        0,
        Math.max(0, window.innerHeight - el.offsetHeight),
      ),
    })
  }

  const endDockDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  if (suppressChrome || !open || !mounted) return null

  return createPortal(
    <div
      ref={dockRef}
      className={cn(
        DOCK_SURFACE,
        'pointer-events-auto fixed z-[90] flex max-h-[min(75vh,40rem)] w-[min(100vw,29rem)] flex-col gap-2 p-3 select-none',
        dragging ? 'cursor-grabbing touch-none' : 'cursor-grab',
      )}
      style={
        position
          ? { left: position.x, bottom: position.bottom }
          : { left: defaultLeftInset, bottom: DOCK_BOTTOM_INSET_PX }
      }
      role="dialog"
      aria-label="Translate to Chinese"
      onPointerDown={onDockPointerDown}
      onPointerMove={onDockPointerMove}
      onPointerUp={endDockDrag}
      onPointerCancel={endDockDrag}
    >
      <div className={cn('flex items-center justify-between gap-2', dragging ? 'cursor-grabbing' : 'cursor-grab')}>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[#f4f4f5]">
          <Languages className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Translate
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 cursor-pointer rounded-full text-[#a1a1aa] hover:bg-[#3f3f46] hover:text-[#f4f4f5]"
          onClick={() => onOpenChange(false)}
          aria-label="Close translate dock"
          data-translate-no-drag
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={onSubmit} className="flex cursor-auto gap-1.5 select-text" data-translate-no-drag>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="English word or phrase…"
          disabled={loading}
          className="h-10 min-w-0 flex-1 cursor-text border-[#3f3f46] bg-[#353539] text-base text-[#f4f4f5] placeholder:text-[#71717a] focus-visible:ring-[#71717a] md:text-base"
          autoComplete="off"
          spellCheck={false}
        />
        {result && enReady ? (
          <button
            type="button"
            className={SEARCH_ROW_ICON_BTN}
            aria-label="Hear English"
            title="Hear English"
            onClick={() => {
              const text = result.source.trim() || draft.trim()
              if (!text) return
              if (!speakEnglish(text)) {
                toast.error('Speech is not available in this browser.')
              }
            }}
          >
            <Volume2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={loading || !draft.trim()}
          className="h-10 shrink-0 cursor-pointer bg-[#3f3f46] px-3 text-base text-[#f4f4f5] hover:bg-[#52525b]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Go'}
        </Button>
      </form>

      {result ? (
        <div
          className={cn(
            'min-h-0 cursor-auto space-y-2 overflow-y-auto border-t border-[#3f3f46] pt-2.5 pr-1 select-text',
            RESULT_SCROLLBAR,
          )}
          data-translate-no-drag
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-start gap-1">
                {onPlaceText ? (
                  <button
                    type="button"
                    className={cn(
                      CHINESE_PICK_BTN,
                      'text-4xl',
                      pickPulse === result.chinese.trim() && CHINESE_PICK_PULSE,
                    )}
                    title="Copy and place on the page"
                    onClick={() => pickChineseForPlacement(result.chinese)}
                  >
                    {result.chinese}
                  </button>
                ) : (
                  <p className="text-4xl font-semibold leading-tight text-[#f4f4f5]">{result.chinese}</p>
                )}
                {zhReady ? (
                  <button
                    type="button"
                    className={cn(RESULT_ICON_BTN, 'mt-1')}
                    aria-label="Hear Chinese"
                    title="Hear Chinese"
                    onClick={() => {
                      if (!speakChinese(result.chinese)) {
                        toast.error(CHINESE_SPEECH_INSTALL_HINT)
                      }
                    }}
                  >
                    <Volume2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              {result.pinyin ? <p className="pt-1 text-lg text-[#d4d4d8]">{result.pinyin}</p> : null}
              {result && !zhReady ? (
                <p className="pt-1 text-[11px] leading-snug text-[#71717a]">{CHINESE_SPEECH_INSTALL_HINT_SHORT}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
              <button
                type="button"
                className={RESULT_ICON_BTN}
                aria-label={resultImageUrl ? 'Change image' : 'Show image'}
                title={resultImageUrl ? 'Change image' : 'Show image'}
                onClick={() => void requestResultImage()}
                disabled={imageLoading}
              >
                {imageLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImageIcon className="h-4 w-4" aria-hidden />}
              </button>
              <button
                type="button"
                className={RESULT_ICON_BTN}
                aria-label="Save word"
                title="Save word"
                onClick={saveCurrentWord}
                disabled={savingWord}
              >
                {savingWord ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <BookmarkPlus className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>
          {resultImageUrl ? (
            <div className="overflow-hidden rounded-lg border border-[#3f3f46] bg-black/25">
              <img
                src={resultImageUrl}
                alt={`Visual for ${result.source}`}
                className="block h-36 w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </div>
          ) : null}
          {result.exampleEn && result.exampleZh ? (
            <div className="space-y-1.5 border-l-2 border-[#3f3f46] pl-3 leading-relaxed">
              <p className="text-lg text-[#e4e4e7]">{result.exampleEn}</p>
              <p className="text-2xl text-[#f4f4f5]">{result.exampleZh}</p>
            </div>
          ) : null}
          {result.alternatives.length > 0 ? (
            <div className="border-t border-[#3f3f46] pt-1.5">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-1 rounded-lg px-1 py-1.5 text-xs font-medium uppercase tracking-wide text-[#71717a] transition-colors hover:bg-[#3f3f46] hover:text-[#a1a1aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]"
                aria-expanded={altsOpen}
                onClick={() => setAltsOpen((v) => !v)}
              >
                <ChevronRight
                  className={cn('h-4 w-4 shrink-0 transition-transform', altsOpen && 'rotate-90')}
                  aria-hidden
                />
                Other meanings ({result.alternatives.length})
              </button>
              {altsOpen ? (
                <ul className="space-y-3 pt-2">
                  {result.alternatives.map((alt, idx) => (
                    <li
                      key={`${alt.chinese}-${alt.pinyin}-${idx}`}
                      className="space-y-1.5 border-b border-[#3f3f46] pb-3 leading-tight text-[#d4d4d8] last:border-b-0 last:pb-0"
                    >
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {onPlaceText ? (
                          <button
                            type="button"
                            className={cn(
                              CHINESE_PICK_BTN,
                              'text-2xl',
                              pickPulse === alt.chinese.trim() && CHINESE_PICK_PULSE,
                            )}
                            title="Copy and place on the page"
                            onClick={() => pickChineseForPlacement(alt.chinese)}
                          >
                            {alt.chinese}
                          </button>
                        ) : (
                          <span className="text-2xl font-semibold leading-tight text-[#f4f4f5]">{alt.chinese}</span>
                        )}
                        {alt.pinyin ? <span className="text-sm text-[#a1a1aa]">{alt.pinyin}</span> : null}
                        {alt.partOfSpeech ? (
                          <span className="ml-0.5 self-center rounded bg-[#3f3f46] px-1 py-[1px] text-[10px] uppercase tracking-wide text-[#a1a1aa]">
                            {alt.partOfSpeech}
                          </span>
                        ) : null}
                      </p>
                      {alt.exampleEn && alt.exampleZh ? (
                        <div className="space-y-1.5 border-l-2 border-[#3f3f46] pl-3 leading-relaxed">
                          <p className="text-lg text-[#e4e4e7]">{alt.exampleEn}</p>
                          <p className="text-2xl text-[#f4f4f5]">{alt.exampleZh}</p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
