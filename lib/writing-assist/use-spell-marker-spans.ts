'use client'

import { useMemo } from 'react'
import { findWritingAssistMarkerSpans } from '@/lib/writing-assist/spell-markers'
import { useWritingAssistContext } from '@/lib/writing-assist/writing-assist-context'

export function useSpellMarkerSpans(text: string, enabled = true) {
  const { ready, enabled: assistEnabled, engine, lessonWords, learnedWords } = useWritingAssistContext()

  return useMemo(() => {
    if (!enabled || !assistEnabled || !text.trim()) return []
    return findWritingAssistMarkerSpans(text, ready ? engine : null, { lessonWords, learnedWords })
  }, [enabled, assistEnabled, ready, engine, lessonWords, learnedWords, text])
}
