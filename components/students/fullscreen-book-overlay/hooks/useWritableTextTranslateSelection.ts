'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isWritableTextSelectionEventTarget,
  readWritableTextSelection,
} from '@/lib/books/writable-text-selection'
import type { TranslationResult } from '@/lib/translate/translate-client'

export type WritableTextGlossReviewRequest = {
  annotationId: string
  start: number
  end: number
  source: string
  chinese: string
  pinyin: string
  anchorRect: DOMRectReadOnly
}

export type WritableTextTranslateSelectionState = {
  visible: boolean
  text: string
  context: string
  anchorRect: DOMRectReadOnly | null
  annotationId: string
  selectionStart: number
  selectionEnd: number
  /** When set, popover opens on the saved translation instead of running translate again. */
  initialResult: TranslationResult | null
}

const INITIAL: WritableTextTranslateSelectionState = {
  visible: false,
  text: '',
  context: '',
  anchorRect: null,
  annotationId: '',
  selectionStart: 0,
  selectionEnd: 0,
  initialResult: null,
}

const SELECTION_DEBOUNCE_MS = 50

export function useWritableTextTranslateSelection(enabled: boolean) {
  const [state, setState] = useState<WritableTextTranslateSelectionState>(INITIAL)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    setState(INITIAL)
  }, [])

  const openFromGloss = useCallback((request: WritableTextGlossReviewRequest) => {
    setState({
      visible: true,
      text: request.source,
      context: '',
      anchorRect: request.anchorRect,
      annotationId: request.annotationId,
      selectionStart: request.start,
      selectionEnd: request.end,
      initialResult: {
        source: request.source,
        chinese: request.chinese,
        pinyin: request.pinyin,
        exampleEn: '',
        exampleZh: '',
        alternatives: [],
      },
    })
  }, [])

  const syncFromDocument = useCallback(() => {
    const snapshot = readWritableTextSelection()
    if (!snapshot) {
      setState(INITIAL)
      return
    }
    setState({
      visible: true,
      text: snapshot.text,
      context: snapshot.context,
      anchorRect: snapshot.rect,
      annotationId: snapshot.annotationId,
      selectionStart: snapshot.selectionStart,
      selectionEnd: snapshot.selectionEnd,
      initialResult: null,
    })
  }, [])

  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      syncFromDocument()
    }, SELECTION_DEBOUNCE_MS)
  }, [syncFromDocument])

  useEffect(() => {
    if (!enabled) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      setState(INITIAL)
      return
    }

    const onSelectionChange = () => scheduleSync()

    const onTextFieldInteraction = (event: Event) => {
      if (!isWritableTextSelectionEventTarget(event.target)) return
      scheduleSync()
    }

    const onLayoutChange = () => {
      if (!readWritableTextSelection()) return
      syncFromDocument()
    }

    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('select', onTextFieldInteraction, true)
    document.addEventListener('mouseup', onTextFieldInteraction, true)
    document.addEventListener('keyup', onTextFieldInteraction, true)
    window.addEventListener('scroll', onLayoutChange, true)
    window.addEventListener('resize', onLayoutChange)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('select', onTextFieldInteraction, true)
      document.removeEventListener('mouseup', onTextFieldInteraction, true)
      document.removeEventListener('keyup', onTextFieldInteraction, true)
      window.removeEventListener('scroll', onLayoutChange, true)
      window.removeEventListener('resize', onLayoutChange)
    }
  }, [enabled, scheduleSync, syncFromDocument])

  return { ...state, clear, openFromGloss }
}
