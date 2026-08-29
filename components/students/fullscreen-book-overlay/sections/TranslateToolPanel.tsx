'use client'

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { BookmarkPlus, Image as ImageIcon, Languages, Loader2, Volume2 } from 'lucide-react'
import {
  CHINESE_SPEECH_INSTALL_HINT,
  CHINESE_SPEECH_INSTALL_HINT_SHORT,
  speakChinese,
  speakEnglish,
  warmSpeechVoices,
} from '@/lib/audio/speak-text'
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
import { focusBookOverlayCanvasSink } from '@/lib/books/book-overlay-keyboard-guards'
import { ClassToolDrawerShell } from '@/components/students/fullscreen-book-overlay/sections/ClassToolDrawerShell'
import { getReliableImageUrl } from '@/lib/helpers'
import {
  buildTranslateImageSearchHint,
  getCuratedImageSearchOverride,
} from '@/lib/quiz-image-queries'

const ICON_BTN =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#71717a] transition-colors hover:bg-white/5 hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a] disabled:pointer-events-none disabled:opacity-40'

const TEXT_ACTION =
  'inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-[#a1a1aa] transition-colors hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a] disabled:pointer-events-none disabled:opacity-40'

const PLACE_ACTION =
  'inline-flex cursor-pointer items-center text-[13px] font-semibold text-[#f4f4f5] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a] disabled:pointer-events-none disabled:opacity-40'

const ALT_CHINESE =
  'cursor-pointer text-left text-[1.35rem] font-semibold leading-snug text-[#e4e4e7] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]'

const PICK_PULSE = 'opacity-60'
const PICK_PULSE_MS = 240

const SCROLLBAR = cn(
  '[scrollbar-width:thin] [scrollbar-color:#52525b_transparent]',
  '[&::-webkit-scrollbar]:w-1.5',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#52525b]',
)

type TranslateToolPanelProps = {
  studentId: string
  open: boolean
  onClose: () => void
  /** When set, Place copies Chinese and starts tap-to-place on the spread. */
  onPlaceText?: (text: string) => void
  /** When set, clicking the picture starts tap-to-place on the book or board. */
  onPlaceImage?: (url: string, alt: string) => void
}

export function TranslateToolPanel({
  studentId,
  open,
  onClose,
  onPlaceText,
  onPlaceImage,
}: TranslateToolPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const keepSearchFocusRef = useRef(true)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [resultImageUrl, setResultImageUrl] = useState('')
  const [resolvedImageUrl, setResolvedImageUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [savingWord, setSavingWord] = useState(false)
  const [pickPulse, setPickPulse] = useState<string | null>(null)
  const pickPulseTimerRef = useRef<number | null>(null)
  const clientCacheRef = useRef<Map<string, TranslationResult>>(new Map())
  const imagePhraseCacheRef = useRef<Map<string, string>>(new Map())
  const imageVariantRef = useRef(0)
  const { saveWord } = useSavedWords({
    studentId,
    onPersistenceError: (message) => toast.error(message),
  })
  const enReady = useSpeechVoiceReady('en')
  const zhReady = useSpeechVoiceReady('zh')

  useEffect(() => {
    if (!open) return
    keepSearchFocusRef.current = true
    warmSpeechVoices()
    let cancelled = false
    const focusSearch = () => {
      if (cancelled || !keepSearchFocusRef.current) return
      inputRef.current?.focus({ preventScroll: true })
    }
    focusSearch()
    const raf = window.requestAnimationFrame(() => {
      focusSearch()
      window.requestAnimationFrame(focusSearch)
    })
    const t0 = window.setTimeout(focusSearch, 0)
    const t1 = window.setTimeout(focusSearch, 120)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t0)
      window.clearTimeout(t1)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      const input = inputRef.current
      if (!input) return
      const target = e.target
      if (!(target instanceof Node)) return
      const drawer = input.closest('[data-class-tool-drawer]')
      if (drawer?.contains(target)) return

      keepSearchFocusRef.current = false
      if (document.activeElement !== input) return
      input.blur()
      const typingField =
        target instanceof Element
          ? target.closest('input, textarea, select, [contenteditable="true"]')
          : null
      if (!typingField) focusBookOverlayCanvasSink()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

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
      setResolvedImageUrl('')
      imageVariantRef.current = 0
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runTranslate(draft)
  }

  const requestResultImage = useCallback(async () => {
    if (!result) return
    const word = result.source.trim()
    if (!word) return
    const changing = Boolean(resultImageUrl)
    setImageLoading(true)
    try {
      if (changing) imageVariantRef.current += 1
      else imageVariantRef.current = 0

      const cacheKey = `${word.toLowerCase()}::${(result.exampleEn ?? '').trim().toLowerCase().slice(0, 80)}`
      let searchQuery = imagePhraseCacheRef.current.get(cacheKey)
      if (searchQuery == null) {
        searchQuery = buildTranslateImageSearchHint(word, result.exampleEn) ?? ''
        if (!searchQuery && !getCuratedImageSearchOverride(word)) {
          try {
            const res = await fetch('/api/image-search-phrase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ words: [word] }),
            })
            if (res.ok) {
              const data = (await res.json()) as { phrases?: Record<string, string> }
              searchQuery = data.phrases?.[word.toLowerCase().trim()]?.trim() ?? ''
            }
          } catch {
            /* fall back to the default stock query */
          }
        }
        imagePhraseCacheRef.current.set(cacheKey, searchQuery)
      }

      const imageUrl = getReliableImageUrl(
        word,
        `translate-${imageVariantRef.current}`,
        'static',
        searchQuery || undefined,
        'Photo',
        changing ? resolvedImageUrl || undefined : undefined,
      )
      setResultImageUrl(imageUrl)
    } catch {
      setImageLoading(false)
    }
  }, [result, resultImageUrl, resolvedImageUrl])

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

  const pickImageForPlacement = useCallback(() => {
    if (!result || !onPlaceImage) return
    const live = imageRef.current?.currentSrc?.trim()
    const url = (live || resolvedImageUrl || resultImageUrl).trim()
    if (!url) return
    setPickPulse(url)
    if (pickPulseTimerRef.current != null) window.clearTimeout(pickPulseTimerRef.current)
    pickPulseTimerRef.current = window.setTimeout(() => {
      pickPulseTimerRef.current = null
      setPickPulse(null)
    }, PICK_PULSE_MS)
    onPlaceImage(url, result.source)
  }, [onPlaceImage, resolvedImageUrl, result, resultImageUrl])

  const onResultImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const src = e.currentTarget.currentSrc || e.currentTarget.src
    try {
      const path = new URL(src, window.location.href).pathname
      if (path !== '/api/quiz-image') setResolvedImageUrl(src)
    } catch {
      if (src && !src.includes('/api/quiz-image')) setResolvedImageUrl(src)
    }
    setImageLoading(false)
  }

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
        imageUrl: resolvedImageUrl || resultImageUrl,
      })
      toast.success(mode === 'updated' ? 'Word updated in saved words.' : 'Word saved.')
    } finally {
      setSavingWord(false)
    }
  }, [result, resultImageUrl, resolvedImageUrl, saveWord])

  const searchForm = (
    <form onSubmit={onSubmit} className="flex items-center gap-1 select-text">
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="English…"
        disabled={loading}
        data-translate-search=""
        className="h-9 min-w-0 flex-1 cursor-text border-0 bg-transparent px-0 text-[15px] text-[#f4f4f5] shadow-none placeholder:text-[#52525b] focus-visible:ring-0 md:text-[15px]"
        autoComplete="off"
        spellCheck={false}
      />
      {result && enReady ? (
        <button
          type="button"
          className={ICON_BTN}
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
          <Volume2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        disabled={loading || !draft.trim()}
        className="h-8 shrink-0 cursor-pointer px-2 text-[13px] font-semibold text-[#f4f4f5] hover:bg-white/5 hover:text-white"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : 'Go'}
      </Button>
    </form>
  )

  return (
    <ClassToolDrawerShell
      open={open}
      onClose={onClose}
      title="Translate"
      icon={Languages}
      ariaLabel="Translate to Chinese"
      headerExtra={searchForm}
    >
      {!result ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-16 text-center">
          <Languages className="h-10 w-10 text-white/40" aria-hidden />
          <p className="text-[15px] leading-snug text-[#71717a]">
            Type an English word.
          </p>
          <p className="mt-1 max-w-[12rem] text-[13px] leading-relaxed text-[#52525b]">
            Hear it, save it, or place Chinese on the book.
          </p>
        </div>
      ) : (
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-5 select-text', SCROLLBAR)}>
          {/* Hero — click Chinese to place */}
          <div className="flex items-start gap-2">
            {onPlaceText ? (
              <button
                type="button"
                className={cn(
                  'min-w-0 cursor-pointer text-left text-[2.75rem] font-semibold leading-[1.1] tracking-tight text-[#fafafa] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]',
                  pickPulse === result.chinese.trim() && PICK_PULSE,
                )}
                title="Copy and place on the page"
                onClick={() => pickChineseForPlacement(result.chinese)}
              >
                {result.chinese}
              </button>
            ) : (
              <p className="min-w-0 text-[2.75rem] font-semibold leading-[1.1] tracking-tight text-[#fafafa]">
                {result.chinese}
              </p>
            )}
            {zhReady ? (
              <button
                type="button"
                className={cn(ICON_BTN, 'mt-2')}
                aria-label="Hear Chinese"
                title="Hear Chinese"
                onClick={() => {
                  if (!speakChinese(result.chinese)) {
                    toast.error(CHINESE_SPEECH_INSTALL_HINT)
                  }
                }}
              >
                <Volume2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          {result.pinyin ? (
            <p className="mt-2 text-[15px] leading-snug text-[#a1a1aa]">{result.pinyin}</p>
          ) : null}
          {!zhReady ? (
            <p className="mt-2 text-[11px] leading-snug text-[#52525b]">{CHINESE_SPEECH_INSTALL_HINT_SHORT}</p>
          ) : null}

          {/* Actions — text links, not a button bar */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {onPlaceText ? (
              <button
                type="button"
                className={cn(PLACE_ACTION, pickPulse === result.chinese.trim() && PICK_PULSE)}
                onClick={() => pickChineseForPlacement(result.chinese)}
              >
                Place on book
              </button>
            ) : null}
            <button
              type="button"
              className={TEXT_ACTION}
              onClick={saveCurrentWord}
              disabled={savingWord}
            >
              {savingWord ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
              )}
              Save
            </button>
            <button
              type="button"
              className={TEXT_ACTION}
              onClick={() => void requestResultImage()}
              disabled={imageLoading}
            >
              {imageLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              )}
              {resultImageUrl ? 'Change image' : 'Image'}
            </button>
          </div>

          {resultImageUrl ? (
            (() => {
              const picture = (
                <>
                  <img
                    ref={imageRef}
                    src={resultImageUrl}
                    alt={`Visual for ${result.source}`}
                    className="mx-auto block h-auto max-h-[280px] max-w-full rounded-md"
                    loading="eager"
                    draggable={false}
                    onLoad={onResultImageLoad}
                    onError={() => setImageLoading(false)}
                  />
                  {imageLoading ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/35">
                      <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
                    </span>
                  ) : null}
                </>
              )
              const wrapClass = cn('relative mt-6', imageLoading && 'min-h-[120px]')
              if (!onPlaceImage) {
                return <div className={wrapClass}>{picture}</div>
              }
              return (
                <button
                  type="button"
                  className={cn(
                    wrapClass,
                    'mx-auto block max-w-full cursor-grab rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71717a]',
                    pickPulse === (resolvedImageUrl || resultImageUrl) && PICK_PULSE,
                  )}
                  title="Place on the book or board"
                  onClick={pickImageForPlacement}
                  disabled={imageLoading}
                >
                  {picture}
                </button>
              )
            })()
          ) : null}

          {result.exampleEn && result.exampleZh ? (
            <div className="mt-8">
              <p className="text-[11px] font-medium tracking-wide text-[#52525b]">Example</p>
              <p className="mt-3 text-[15px] leading-relaxed text-[#a1a1aa]">{result.exampleEn}</p>
              <p className="mt-1.5 text-[1.25rem] leading-snug text-[#f4f4f5]">{result.exampleZh}</p>
            </div>
          ) : null}

          {result.alternatives.length > 0 ? (
            <div className="mt-10">
              <p className="text-[11px] font-medium tracking-wide text-[#52525b]">
                Other meanings
              </p>
              <ul className="mt-4 space-y-7">
                {result.alternatives.map((alt, idx) => (
                  <li key={`${alt.chinese}-${alt.pinyin}-${idx}`}>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {onPlaceText ? (
                        <button
                          type="button"
                          className={cn(
                            ALT_CHINESE,
                            pickPulse === alt.chinese.trim() && PICK_PULSE,
                          )}
                          title="Copy and place on the page"
                          onClick={() => pickChineseForPlacement(alt.chinese)}
                        >
                          {alt.chinese}
                        </button>
                      ) : (
                        <span className="text-[1.35rem] font-semibold leading-snug text-[#e4e4e7]">
                          {alt.chinese}
                        </span>
                      )}
                      {alt.pinyin ? (
                        <span className="text-[13px] text-[#71717a]">{alt.pinyin}</span>
                      ) : null}
                      {alt.partOfSpeech ? (
                        <span className="text-[11px] uppercase tracking-wide text-[#52525b]">
                          {alt.partOfSpeech}
                        </span>
                      ) : null}
                    </div>
                    {alt.exampleEn && alt.exampleZh ? (
                      <div className="mt-2">
                        <p className="text-[13px] leading-relaxed text-[#71717a]">{alt.exampleEn}</p>
                        <p className="mt-1 text-[15px] leading-snug text-[#d4d4d8]">{alt.exampleZh}</p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </ClassToolDrawerShell>
  )
}
