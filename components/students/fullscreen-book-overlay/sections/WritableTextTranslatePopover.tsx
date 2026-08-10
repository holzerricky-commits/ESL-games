'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { BookmarkPlus, ClipboardCopy, Languages, Loader2, Volume2 } from 'lucide-react'
import { CHINESE_SPEECH_INSTALL_HINT, speakChinese, speakEnglish } from '@/lib/audio/speak-text'
import { useSpeechVoiceReady } from '@/lib/audio/use-speech-voice-ready'
import { useSavedWords } from '@/components/students/fullscreen-book-overlay/hooks/useSavedWords'
import {
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  SELECTION_CONTEXT_BAR_SURFACE,
  SELECTION_CONTEXT_ICON_CLASS,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'
import { fetchTranslation, type TranslationResult } from '@/lib/translate/translate-client'
import type { AppendTextGlossParams } from '@/lib/books/text-gloss'
import { WRITABLE_ANNOTATION_TEXTAREA_SELECTOR } from '@/lib/books/writable-text-selection'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/** Compact pill: even inset, hugs icon buttons, clips to rounded edges. */
const TEXT_SELECTION_BAR_PILL = cn(
  SELECTION_CONTEXT_BAR_SURFACE,
  'flex h-10 w-max max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-hidden px-1.5',
)

const TEXT_SELECTION_DETAIL_PILL = cn(
  SELECTION_CONTEXT_BAR_SURFACE,
  'w-max max-w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden px-3 py-2',
)

const SELECTABLE_RESULT_TEXT =
  'select-text cursor-text selection:bg-[#C6F6D5] selection:text-[#1A202C]'
const VIEWPORT_PAD_PX = 12
const GAP_PX = 8
const POPOVER_Z_INDEX = 120

type PopoverSession = {
  text: string
  context: string
  anchorRect: DOMRectReadOnly
  annotationId: string
  selectionStart: number
  selectionEnd: number
  reviewOnly: boolean
}

export type PinWritableTextGlossInput = Omit<AppendTextGlossParams, 'commandId'> & {
  annotationId: string
}

export type WritableTextTranslatePopoverProps = {
  studentId: string
  enabled: boolean
  visible: boolean
  text: string
  context: string
  anchorRect: DOMRectReadOnly | null
  annotationId: string
  selectionStart: number
  selectionEnd: number
  initialResult: TranslationResult | null
  onDismiss: () => void
  onPinGloss?: (input: PinWritableTextGlossInput) => boolean
}

function barPosition(
  anchorRect: DOMRectReadOnly,
  hasDetailStrip: boolean,
): {
  left: number
  top: number
  transform: string
} {
  const centerX = anchorRect.left + anchorRect.width / 2
  const left = Math.max(
    VIEWPORT_PAD_PX,
    Math.min(centerX, window.innerWidth - VIEWPORT_PAD_PX),
  )

  const minAbove = hasDetailStrip ? 72 : 48
  const spaceAbove = anchorRect.top - VIEWPORT_PAD_PX
  const placeAbove = spaceAbove >= minAbove || spaceAbove > window.innerHeight - anchorRect.bottom

  if (placeAbove) {
    return {
      left,
      top: anchorRect.top - GAP_PX,
      transform: 'translate(-50%, -100%)',
    }
  }

  return {
    left,
    top: anchorRect.bottom + GAP_PX,
    transform: 'translate(-50%, 0)',
  }
}

function clearWritableFieldSelection(annotationId: string) {
  const field = document.querySelector(`textarea[data-annotation-id="${annotationId}"]`)
  if (!(field instanceof HTMLTextAreaElement)) return
  const caret = field.selectionStart
  field.setSelectionRange(caret, caret)
}

function preventFocusSteal(e: PointerEvent) {
  e.preventDefault()
}

export function WritableTextTranslatePopover({
  studentId,
  enabled,
  visible,
  text,
  context,
  anchorRect,
  annotationId,
  selectionStart,
  selectionEnd,
  initialResult,
  onDismiss,
  onPinGloss,
}: WritableTextTranslatePopoverProps) {
  const [mounted, setMounted] = useState(false)
  const [session, setSession] = useState<PopoverSession | null>(null)
  const sessionRef = useRef<PopoverSession | null>(null)
  /** Keeps review open after gloss tap (selection may already be cleared). */
  const pinnedRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [reviewResult, setReviewResult] = useState<TranslationResult | null>(null)
  const [savingWord, setSavingWord] = useState(false)
  const [copied, setCopied] = useState(false)
  const { saveWord } = useSavedWords({
    studentId,
    onPersistenceError: (message) => toast.error(message),
  })
  const enReady = useSpeechVoiceReady('en')
  const zhReady = useSpeechVoiceReady('zh')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (enabled) return
    pinnedRef.current = false
    sessionRef.current = null
    setSession(null)
    setReviewResult(null)
    setLoading(false)
    setSavingWord(false)
    setCopied(false)
  }, [enabled])

  const dismiss = useCallback(() => {
    pinnedRef.current = false
    sessionRef.current = null
    setSession(null)
    setReviewResult(null)
    setLoading(false)
    setSavingWord(false)
    setCopied(false)
    onDismiss()
  }, [onDismiss])

  const pinTranslation = useCallback(
    (translation: TranslationResult, active: PopoverSession): boolean => {
      if (active.reviewOnly || !onPinGloss || !active.annotationId) return false
      return onPinGloss({
        annotationId: active.annotationId,
        start: active.selectionStart,
        end: active.selectionEnd,
        source: translation.source,
        chinese: translation.chinese,
        pinyin: translation.pinyin,
      })
    },
    [onPinGloss],
  )

  useEffect(() => {
    if (!visible || !text || !anchorRect || !annotationId) {
      if (!pinnedRef.current) {
        sessionRef.current = null
        setSession(null)
        setReviewResult(null)
        setLoading(false)
        setSavingWord(false)
        setCopied(false)
      }
      return
    }

    const reviewOnly = initialResult != null
    const next: PopoverSession = {
      text,
      context,
      anchorRect,
      annotationId,
      selectionStart,
      selectionEnd,
      reviewOnly,
    }
    const prev = sessionRef.current
    const sameSelection =
      prev &&
      prev.text === next.text &&
      prev.context === next.context &&
      prev.annotationId === next.annotationId &&
      prev.selectionStart === next.selectionStart &&
      prev.selectionEnd === next.selectionEnd &&
      prev.reviewOnly === next.reviewOnly

    if (!sameSelection) {
      pinnedRef.current = reviewOnly
      setCopied(false)
    }

    if (sameSelection) {
      sessionRef.current = { ...next, anchorRect: next.anchorRect }
      setSession(sessionRef.current)
      if (reviewOnly && initialResult) {
        setReviewResult(initialResult)
      }
      return
    }
    sessionRef.current = next
    setSession(next)
    setReviewResult(reviewOnly ? initialResult : null)
    setLoading(false)
    setSavingWord(false)
  }, [
    visible,
    text,
    context,
    anchorRect,
    annotationId,
    selectionStart,
    selectionEnd,
    initialResult,
  ])

  useEffect(() => {
    if (!session) return
    const onPointerDown = (event: Event) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const popover = document.querySelector('[data-writable-translate-popover]')
      if (popover?.contains(target)) return
      if (target instanceof Element && target.closest(WRITABLE_ANNOTATION_TEXTAREA_SELECTOR)) return
      if (target instanceof Element && target.closest('[data-text-gloss-id]')) return
      dismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [session, dismiss])

  useEffect(() => {
    if (!session) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session, dismiss])

  const runTranslate = useCallback(async () => {
    const active = sessionRef.current
    if (!active?.text.trim() || active.reviewOnly) return
    pinnedRef.current = true
    setLoading(true)
    try {
      const outcome = await fetchTranslation(active.text, active.context, {
        retryWithoutContext: true,
      })
      if (!outcome.ok) {
        toast.error(outcome.error)
        pinnedRef.current = false
        return
      }
      const pinned = pinTranslation(outcome.result, active)
      clearWritableFieldSelection(active.annotationId)
      if (!pinned) {
        toast.error('Could not pin translation on the note.')
        pinnedRef.current = false
        return
      }
      dismiss()
    } finally {
      setLoading(false)
    }
  }, [dismiss, pinTranslation])

  const copySelection = useCallback(async () => {
    const active = sessionRef.current
    const snippet = active?.text.trim()
    if (!active || !snippet) return
    if (active.reviewOnly) pinnedRef.current = true
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.error('Could not copy text.')
    }
  }, [])

  const saveCurrentWord = useCallback(() => {
    if (!reviewResult) return
    pinnedRef.current = true
    setSavingWord(true)
    try {
      const mode = saveWord({
        source: reviewResult.source,
        chinese: reviewResult.chinese,
        pinyin: reviewResult.pinyin,
        exampleEn: reviewResult.exampleEn,
        exampleZh: reviewResult.exampleZh,
        imageUrl: '',
      })
      toast.success(mode === 'updated' ? 'Word updated in saved words.' : 'Word saved.')
    } finally {
      setSavingWord(false)
    }
  }, [reviewResult, saveWord])

  const isReview = session?.reviewOnly === true
  const pinyin = reviewResult?.pinyin?.trim() ?? ''
  const chinese = reviewResult?.chinese?.trim() ?? ''
  const showReviewDetail = isReview && (pinyin.length > 0 || chinese.length > 0)

  const style = useMemo(() => {
    if (!session?.anchorRect) return null
    const pos = barPosition(session.anchorRect, showReviewDetail)
    return {
      position: 'fixed' as const,
      left: pos.left,
      top: pos.top,
      transform: pos.transform,
      zIndex: POPOVER_Z_INDEX,
    }
  }, [session?.anchorRect, showReviewDetail])

  if (!mounted || !session || !style) return null

  return createPortal(
    <div
      role="toolbar"
      aria-label={isReview ? 'Translation review' : 'Text selection options'}
      className="pointer-events-auto flex flex-col items-center gap-1.5"
      style={style}
      data-writable-translate-popover
      onPointerDown={(e) => {
        if (isReview) pinnedRef.current = true
        e.stopPropagation()
      }}
    >
      <div className={TEXT_SELECTION_BAR_PILL} role="group" aria-label="Selection actions">
        {!isReview ? (
          <button
            type="button"
            className={SELECTION_CONTEXT_BAR_ACTION_BTN}
            aria-label="Translate"
            title="Translate"
            disabled={loading}
            onPointerDown={preventFocusSteal}
            onClick={() => void runTranslate()}
          >
            {loading ? (
              <Loader2 className={cn(SELECTION_CONTEXT_ICON_CLASS, 'animate-spin')} aria-hidden />
            ) : (
              <Languages className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : null}
        <button
          type="button"
          className={SELECTION_CONTEXT_BAR_ACTION_BTN}
          aria-label={copied ? 'Copied' : 'Copy'}
          title={copied ? 'Copied' : 'Copy'}
          onPointerDown={preventFocusSteal}
          onClick={() => void copySelection()}
        >
          <ClipboardCopy className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={2} aria-hidden />
        </button>
        {enReady ? (
          <button
            type="button"
            className={SELECTION_CONTEXT_BAR_ACTION_BTN}
            aria-label="Hear English"
            title="Hear English"
            onPointerDown={preventFocusSteal}
            onClick={() => {
              if (!speakEnglish(session.text)) {
                toast.error('Speech is not available in this browser.')
              }
            }}
          >
            <Volume2 className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {isReview ? (
          <button
            type="button"
            className={SELECTION_CONTEXT_BAR_ACTION_BTN}
            aria-label="Save word"
            title="Save word"
            disabled={savingWord}
            onPointerDown={preventFocusSteal}
            onClick={saveCurrentWord}
          >
            {savingWord ? (
              <Loader2 className={cn(SELECTION_CONTEXT_ICON_CLASS, 'animate-spin')} aria-hidden />
            ) : (
              <BookmarkPlus className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      {showReviewDetail ? (
        <div
          className={cn(
            TEXT_SELECTION_DETAIL_PILL,
            SELECTABLE_RESULT_TEXT,
            'flex items-center gap-1.5',
          )}
        >
          {pinyin ? (
            <p className="min-w-0 flex-1 break-words text-sm leading-snug text-[#d4d4d8]">{pinyin}</p>
          ) : chinese ? (
            <p className="min-w-0 flex-1 break-words text-sm leading-snug text-[#d4d4d8]">{chinese}</p>
          ) : null}
          {chinese && zhReady ? (
            <button
              type="button"
              className={SELECTION_CONTEXT_BAR_ACTION_BTN}
              aria-label="Hear Chinese"
              title="Hear Chinese"
              onPointerDown={preventFocusSteal}
              onClick={() => {
                if (!speakChinese(chinese)) {
                  toast.error(CHINESE_SPEECH_INSTALL_HINT)
                }
              }}
            >
              <Volume2 className={SELECTION_CONTEXT_ICON_CLASS} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
