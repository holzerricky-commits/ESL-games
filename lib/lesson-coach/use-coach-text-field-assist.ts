'use client'

import { useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useLessonCoachSyncActions } from '@/lib/lesson-coach/lesson-coach-sync-context'
import {
  useWritingAssist,
  type WritingAssistTextareaBind,
} from '@/lib/writing-assist/use-writing-assist'

type CoachTextField = 'label' | 'lesson-paper' | 'whiteboard'

type UseCoachTextFieldAssistArgs = {
  value: string
  setValue: (next: string) => void
  onAfterChange?: () => void
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  /** Where this field lives — used when syncing text to the coach session. */
  coachField?: CoachTextField
}

export function useCoachTextFieldAssist({
  value,
  setValue,
  onAfterChange,
  onChange: userOnChange,
  onKeyDown: userKeyDown,
  coachField = 'label',
}: UseCoachTextFieldAssistArgs): {
  assist: WritingAssistTextareaBind
  onFieldFocus: () => void
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
  const { bindTextarea, ghost, ghostPartial, ghostCandidates, ghostIndex, clearGhost } = useWritingAssist()
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (dictationMode) clearGhost()
  }, [dictationMode, clearGhost])

  const assist = bindTextarea({
    value,
    setValue,
    onAfterChange,
    onChange: userOnChange,
    onKeyDown: userKeyDown,
    dictationMode,
  })

  const onInput = (e: FormEvent<HTMLTextAreaElement>) => {
    assist.onInput?.(e as FormEvent<HTMLTextAreaElement>)
    syncSharedText(e.currentTarget.value, coachField)
  }

  const onFocus = () => {
    setTextFieldFocused(true)
    registerActiveTextSink({
      getValue: () => valueRef.current,
      setValue: (next) => {
        valueRef.current = next
        setValue(next)
      },
      field: coachField ?? 'label',
    })
  }

  const onBlur = () => {
    setTextFieldFocused(false)
    registerActiveTextSink(null)
  }

  return {
    assist: {
      ...assist,
      onInput,
    },
    onFieldFocus: onFocus,
    onFieldBlur: onBlur,
    ghost: dictationMode ? null : ghost,
    ghostPartial: dictationMode ? '' : ghostPartial,
    ghostCandidates: dictationMode ? [] : ghostCandidates,
    ghostIndex: dictationMode ? 0 : ghostIndex,
    spellMirrorEnabled: !dictationMode,
  }
}
