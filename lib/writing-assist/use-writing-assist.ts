'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import type { LastCorrection } from '@/lib/writing-assist/autocorrect'
import { shouldClearLastCorrection } from '@/lib/writing-assist/autocorrect'
import {
  getContentEditableCaretOffset,
  getContentEditablePlainText,
  getTextareaCaretState,
  handleContentEditableBackspaceUndo,
  handleContentEditableSpaceAutocorrect,
  handleTextareaBackspaceUndo,
  handleTextareaSpaceAutocorrect,
  setTextareaValueAndCaret,
} from '@/lib/writing-assist/caret-text'
import {
  getPartialWordAtCaret,
  getPreviousWord,
  suggestNextWord,
  type GhostSuggestion,
} from '@/lib/writing-assist/ghost-complete'
import { setWritingAssistGhostTabActive } from '@/lib/writing-assist/tab-active'
import { useWritingAssistContext } from '@/lib/writing-assist/writing-assist-context'

type WritingAssistAttrs = {
  spellCheck: false
  autoCorrect: 'off'
  autoCapitalize: 'off'
  'data-writing-assist': 'true'
}

export type WritingAssistTextareaBind = WritingAssistAttrs & {
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onInput?: (e: FormEvent<HTMLTextAreaElement>) => void
}

export type WritingAssistContentEditableBind = WritingAssistAttrs & {
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  onInput?: () => void
}

type BindTextareaArgs = {
  value: string
  setValue: (next: string) => void
  onAfterChange?: () => void
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  /** Verbatim student speech — no autocorrect, ghost, or Tab complete. */
  dictationMode?: boolean
}

type BindContentEditableArgs = {
  editorRef: RefObject<HTMLElement | null>
  onSync: () => void
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
  dictationMode?: boolean
}

export function useWritingAssist() {
  const { ready, enabled, engine, lessonWords, sessionBigrams, registerSessionTokens } =
    useWritingAssistContext()
  const lastCorrectionRef = useRef<LastCorrection | null>(null)
  const [ghost, setGhost] = useState<GhostSuggestion | null>(null)
  const [ghostPartial, setGhostPartial] = useState('')

  useEffect(() => {
    setWritingAssistGhostTabActive(Boolean(ghost?.suffix))
    return () => setWritingAssistGhostTabActive(false)
  }, [ghost])

  const suggest = useCallback(
    (word: string) => {
      if (!enabled || !ready || !engine) return null
      return engine.suggestCorrection(word)
    },
    [enabled, ready, engine],
  )

  const updateGhostFromText = useCallback(
    (text: string, caret: number) => {
      if (!enabled) {
        setGhost(null)
        setGhostPartial('')
        return
      }
      const partial = getPartialWordAtCaret(text, caret)
      const prev = getPreviousWord(text, caret)
      setGhostPartial(partial)

      if (!prev && !partial) {
        setGhost(null)
        return
      }

      const next = suggestNextWord(prev, partial, sessionBigrams, lessonWords, ready ? engine : null)
      setGhost(next?.suffix ? next : null)
    },
    [enabled, ready, sessionBigrams, lessonWords, engine],
  )

  const clearGhost = useCallback(() => setGhost(null), [])

  const bindTextarea = useCallback(
    ({
      setValue,
      onAfterChange,
      onChange: userOnChange,
      onKeyDown: userKeyDown,
      dictationMode = false,
    }: BindTextareaArgs): WritingAssistTextareaBind => {
      const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget

        if (dictationMode) {
          userKeyDown?.(e)
          return
        }

        if (e.key === 'Tab' && ghost?.suffix) {
          e.preventDefault()
          e.stopPropagation()
          const caret = el.selectionStart
          const current = el.value
          const insert = ghost.suffix
          const next = current.slice(0, caret) + insert + current.slice(caret)
          const newCaret = caret + insert.length
          setValue(next)
          registerSessionTokens(insert)
          lastCorrectionRef.current = null
          setGhost(null)
          queueMicrotask(() => {
            setTextareaValueAndCaret(el, next, newCaret)
            onAfterChange?.()
          })
          return
        }

        if (e.key === 'Escape') {
          if (ghost) {
            e.preventDefault()
            clearGhost()
            return
          }
        }

        if (enabled && ready) {
          if (e.key === ' ') {
            e.preventDefault()
            const state = getTextareaCaretState(el)
            const result = handleTextareaSpaceAutocorrect(state, suggest)
            if (result) {
              setValue(result.state.value)
              lastCorrectionRef.current = result.last
              registerSessionTokens(result.state.value)
              queueMicrotask(() => {
                setTextareaValueAndCaret(el, result.state.value, result.state.selectionStart)
                onAfterChange?.()
                updateGhostFromText(result.state.value, result.state.selectionStart)
              })
            }
            userKeyDown?.(e)
            return
          }

          if (e.key === 'Backspace') {
            const state = getTextareaCaretState(el)
            const undo = handleTextareaBackspaceUndo(state, lastCorrectionRef.current)
            if (undo) {
              e.preventDefault()
              setValue(undo.state.value)
              lastCorrectionRef.current = undo.last
              queueMicrotask(() => {
                setTextareaValueAndCaret(el, undo.state.value, undo.state.selectionStart)
                onAfterChange?.()
                updateGhostFromText(undo.state.value, undo.state.selectionStart)
              })
              userKeyDown?.(e)
              return
            }
          }

          if (shouldClearLastCorrection(e.key, el.selectionStart, lastCorrectionRef.current)) {
            lastCorrectionRef.current = null
          }
        }

        userKeyDown?.(e)
        queueMicrotask(() => {
          updateGhostFromText(el.value, el.selectionStart)
        })
      }

      const onInput = (e: FormEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget
        userOnChange?.(e as ChangeEvent<HTMLTextAreaElement>)
        if (!dictationMode) {
          queueMicrotask(() => updateGhostFromText(el.value, el.selectionStart))
        }
      }

      return {
        spellCheck: false,
        autoCorrect: 'off',
        autoCapitalize: 'off',
        'data-writing-assist': 'true',
        onKeyDown,
        onInput,
      }
    },
    [ghost, enabled, ready, suggest, registerSessionTokens, updateGhostFromText, clearGhost],
  )

  const bindContentEditable = useCallback(
    ({
      editorRef,
      onSync,
      onKeyDown: userKeyDown,
      dictationMode = false,
    }: BindContentEditableArgs): WritingAssistContentEditableBind => {
      const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const root = editorRef.current
        if (!root) {
          userKeyDown?.(e)
          return
        }

        if (dictationMode) {
          userKeyDown?.(e)
          return
        }

        const full = getContentEditablePlainText(root)
        const caret = getContentEditableCaretOffset(root)

        if (e.key === 'Tab' && ghost?.suffix) {
          e.preventDefault()
          e.stopPropagation()
          const insert = ghost.suffix
          document.execCommand('insertText', false, insert)
          registerSessionTokens(insert)
          lastCorrectionRef.current = null
          setGhost(null)
          onSync()
          return
        }

        if (e.key === 'Escape' && ghost) {
          e.preventDefault()
          clearGhost()
          return
        }

        if (enabled && ready) {
          if (e.key === ' ') {
            e.preventDefault()
            const { last } = handleContentEditableSpaceAutocorrect(root, suggest)
            lastCorrectionRef.current = last
            onSync()
            registerSessionTokens(getContentEditablePlainText(root))
            updateGhostFromText(getContentEditablePlainText(root), getContentEditableCaretOffset(root))
            userKeyDown?.(e)
            return
          }

          if (e.key === 'Backspace') {
            const undone = handleContentEditableBackspaceUndo(root, lastCorrectionRef.current)
            if (undone) {
              e.preventDefault()
              lastCorrectionRef.current = null
              onSync()
              updateGhostFromText(getContentEditablePlainText(root), getContentEditableCaretOffset(root))
              userKeyDown?.(e)
              return
            }
          }

          if (shouldClearLastCorrection(e.key, caret, lastCorrectionRef.current)) {
            lastCorrectionRef.current = null
          }
        }

        userKeyDown?.(e)
        queueMicrotask(() => {
          updateGhostFromText(getContentEditablePlainText(root), getContentEditableCaretOffset(root))
        })
      }

      const onInput = () => {
        const r = editorRef.current
        if (!r) return
        if (!dictationMode) {
          updateGhostFromText(getContentEditablePlainText(r), getContentEditableCaretOffset(r))
        }
      }

      return {
        spellCheck: false,
        autoCorrect: 'off',
        autoCapitalize: 'off',
        'data-writing-assist': 'true',
        onKeyDown,
        onInput: dictationMode ? undefined : onInput,
      }
    },
    [ghost, enabled, ready, suggest, registerSessionTokens, updateGhostFromText, clearGhost],
  )

  return {
    ready,
    enabled,
    ghost,
    ghostPartial,
    bindTextarea,
    bindContentEditable,
    clearGhost,
  }
}
