'use client'

import {
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import type { LastCorrection } from '@/lib/writing-assist/autocorrect'
import { shouldClearLastCorrection, triggerCharFromKeyboardKey } from '@/lib/writing-assist/autocorrect'
import {
  getContentEditableCaretOffset,
  getContentEditablePlainText,
  getTextareaCaretState,
  handleContentEditableBackspaceUndo,
  handleContentEditableTriggerAutocorrect,
  handleTextareaBackspaceUndo,
  handleTextareaTriggerAutocorrect,
  setTextareaValueAndCaret,
} from '@/lib/writing-assist/caret-text'
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
  const {
    ready,
    enabled,
    engine,
    registerSessionTokens,
    rememberWord,
    activeGhost,
    ghostPartial,
    ghostCandidates,
    ghostIndex,
    updateGhostFromText,
    flushGhostFromText,
    cycleGhost,
    clearGhost,
  } = useWritingAssistContext()
  const lastCorrectionRef = useRef<LastCorrection | null>(null)

  useEffect(() => {
    setWritingAssistGhostTabActive(Boolean(activeGhost?.suffix))
    return () => setWritingAssistGhostTabActive(false)
  }, [activeGhost])

  const suggest = useCallback(
    (word: string) => {
      if (!enabled || !ready || !engine) return null
      return engine.suggestCorrection(word)
    },
    [enabled, ready, engine],
  )

  const acceptGhostTextarea = useCallback(
    (
      el: HTMLTextAreaElement,
      setValue: (next: string) => void,
      onAfterChange?: () => void,
    ) => {
      if (!activeGhost?.suffix) return false
      const caret = el.selectionStart
      const current = el.value
      const insert = activeGhost.suffix
      const next = current.slice(0, caret) + insert + current.slice(caret)
      const newCaret = caret + insert.length
      setValue(next)
      registerSessionTokens(insert)
      lastCorrectionRef.current = null
      clearGhost()
      queueMicrotask(() => {
        setTextareaValueAndCaret(el, next, newCaret)
        onAfterChange?.()
        updateGhostFromText(next, newCaret)
      })
      return true
    },
    [activeGhost, registerSessionTokens, clearGhost, updateGhostFromText],
  )

  const refreshGhostAfterWordBoundary = useCallback(
    (text: string, caret: number) => {
      flushGhostFromText(text, caret)
    },
    [flushGhostFromText],
  )

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

        if (e.key === 'Tab' && activeGhost?.suffix) {
          e.preventDefault()
          e.stopPropagation()
          acceptGhostTextarea(el, setValue, onAfterChange)
          return
        }

        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && ghostCandidates.length > 1) {
          e.preventDefault()
          cycleGhost(e.key === 'ArrowUp' ? -1 : 1)
          return
        }

        if (e.key === 'Escape') {
          if (activeGhost) {
            e.preventDefault()
            clearGhost()
            return
          }
        }

        if (enabled && ready) {
          const trigger = triggerCharFromKeyboardKey(e.key)
          if (trigger) {
            e.preventDefault()
            const state = getTextareaCaretState(el)
            const result = handleTextareaTriggerAutocorrect(state, suggest, trigger)
            if (result) {
              setValue(result.state.value)
              lastCorrectionRef.current = result.last
              registerSessionTokens(result.state.value)
              queueMicrotask(() => {
                setTextareaValueAndCaret(el, result.state.value, result.state.selectionStart)
                onAfterChange?.()
                refreshGhostAfterWordBoundary(result.state.value, result.state.selectionStart)
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
              if (lastCorrectionRef.current?.original) {
                rememberWord(lastCorrectionRef.current.original)
              }
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
    [
      activeGhost,
      ghostCandidates.length,
      enabled,
      ready,
      suggest,
      registerSessionTokens,
      updateGhostFromText,
      flushGhostFromText,
      refreshGhostAfterWordBoundary,
      clearGhost,
      cycleGhost,
      acceptGhostTextarea,
      rememberWord,
    ],
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

        if (e.key === 'Tab' && activeGhost?.suffix) {
          e.preventDefault()
          e.stopPropagation()
          const insert = activeGhost.suffix
          document.execCommand('insertText', false, insert)
          registerSessionTokens(insert)
          lastCorrectionRef.current = null
          clearGhost()
          onSync()
          queueMicrotask(() => {
            const text = getContentEditablePlainText(root)
            const caret = getContentEditableCaretOffset(root)
            updateGhostFromText(text, caret)
          })
          return
        }

        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && ghostCandidates.length > 1) {
          e.preventDefault()
          cycleGhost(e.key === 'ArrowUp' ? -1 : 1)
          return
        }

        if (e.key === 'Escape' && activeGhost) {
          e.preventDefault()
          clearGhost()
          return
        }

        if (enabled && ready) {
          const trigger = triggerCharFromKeyboardKey(e.key)
          if (trigger) {
            e.preventDefault()
            const { last } = handleContentEditableTriggerAutocorrect(root, suggest, trigger)
            lastCorrectionRef.current = last
            onSync()
            registerSessionTokens(getContentEditablePlainText(root))
            const text = getContentEditablePlainText(root)
            const caret = getContentEditableCaretOffset(root)
            refreshGhostAfterWordBoundary(text, caret)
            userKeyDown?.(e)
            return
          }

          if (e.key === 'Backspace') {
            const undone = handleContentEditableBackspaceUndo(root, lastCorrectionRef.current)
            if (undone) {
              e.preventDefault()
              if (lastCorrectionRef.current?.original) {
                rememberWord(lastCorrectionRef.current.original)
              }
              lastCorrectionRef.current = null
              onSync()
              updateGhostFromText(getContentEditablePlainText(root), getContentEditableCaretOffset(root))
              userKeyDown?.(e)
              return
            }
          }

          if (shouldClearLastCorrection(e.key, getContentEditableCaretOffset(root), lastCorrectionRef.current)) {
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
    [
      activeGhost,
      ghostCandidates.length,
      enabled,
      ready,
      suggest,
      registerSessionTokens,
      updateGhostFromText,
      flushGhostFromText,
      refreshGhostAfterWordBoundary,
      clearGhost,
      cycleGhost,
      rememberWord,
    ],
  )

  return {
    ready,
    enabled,
    engine,
    ghost: activeGhost,
    ghostPartial,
    ghostCandidates,
    ghostIndex,
    bindTextarea,
    bindContentEditable,
    clearGhost,
    updateGhostFromText,
  }
}
