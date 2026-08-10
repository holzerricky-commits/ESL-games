'use client'

import { useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useLessonCoachSyncActions } from '@/lib/lesson-coach/lesson-coach-sync-context'
import {
  useWritingAssist,
  type WritingAssistTextareaBind,
} from '@/lib/writing-assist/use-writing-assist'

type CoachTextField = 'label' | 'lesson-board' | 'whiteboard'

type UseCoachTextFieldAssistArgs = {
  value: string
  setValue: (next: string) => void
  onAfterChange?: () => void
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  /** Where this field lives — used when syncing text to the coach session. */
  coachField?: CoachTextField
  /** Inline ghost + Tab word complete (spell/autocorrect unchanged). */
  ghostEnabled?: boolean
}

export function useCoachTextFieldAssist({
  value,
  setValue,
  onAfterChange,
  onChange: userOnChange,
  onKeyDown: userKeyDown,
  coachField = 'label',
  ghostEnabled = true,
}: UseCoachTextFieldAssistArgs): {
  assist: WritingAssistTextareaBind
  onFieldFocus: (el: HTMLTextAreaElement) => void
  onFieldBlur: () => void
  ghost: ReturnType<typeof useWritingAssist>['ghost']
  ghostPartial: string
  ghostCandidates: ReturnType<typeof useWritingAssist>['ghostCandidates']
  ghostIndex: number
  spellMirrorEnabled: boolean
} {
  const {
    dictationMode,
    syncSharedText,
    sessionId,
    registerActiveTextSink,
    setTextFieldFocused,
  } = useLessonCoachSyncActions()
  const {
    bindTextarea,
    ghost,
    ghostPartial,
    ghostCandidates,
    ghostIndex,
    clearGhost,
    flushGhostFromText,
  } = useWritingAssist()
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (dictationMode || !ghostEnabled) clearGhost()
  }, [dictationMode, ghostEnabled, clearGhost])

  useEffect(() => {
    if (dictationMode || !ghostEnabled) return
    if (value.length === 0) clearGhost()
  }, [value, dictationMode, ghostEnabled, clearGhost])

  const assist = bindTextarea({
    value,
    setValue,
    onAfterChange,
    onChange: userOnChange,
    onKeyDown: userKeyDown,
    dictationMode,
    ghostEnabled,
  })

  const onInput = (e: FormEvent<HTMLTextAreaElement>) => {
    assist.onInput?.(e as FormEvent<HTMLTextAreaElement>)
    syncSharedText(e.currentTarget.value, coachField)
  }

  const onFocus = (el: HTMLTextAreaElement) => {
    setTextFieldFocused(true)
    registerActiveTextSink({
      getValue: () => valueRef.current,
      setValue: (next) => {
        valueRef.current = next
        setValue(next)
      },
      field: coachField ?? 'label',
    })
    if (dictationMode || !ghostEnabled) {
      clearGhost()
      return
    }
    if (el.value.length === 0) {
      clearGhost()
      return
    }
    flushGhostFromText(el.value, el.selectionStart)
  }

  const onBlur = () => {
    setTextFieldFocused(false)
    registerActiveTextSink(null)
    clearGhost()
  }

  return {
    assist: {
      ...assist,
      onInput,
    },
    onFieldFocus: onFocus,
    onFieldBlur: onBlur,
    ghost: dictationMode || !ghostEnabled ? null : ghost,
    ghostPartial: dictationMode || !ghostEnabled ? '' : ghostPartial,
    ghostCandidates: dictationMode || !ghostEnabled ? [] : ghostCandidates,
    ghostIndex: dictationMode || !ghostEnabled ? 0 : ghostIndex,
    spellMirrorEnabled: !dictationMode,
  }
}
