'use client'

import { useEffect, useState } from 'react'
import {
  hasVoiceForLang,
  subscribeSpeechVoices,
} from '@/lib/audio/speak-text'

/**
 * True once the browser has a usable voice for this language.
 * Hear buttons render only when this is true.
 */
export function useSpeechVoiceReady(lang: 'en' | 'zh'): boolean {
  const [ready, setReady] = useState(() => hasVoiceForLang(lang))

  useEffect(() => {
    setReady(hasVoiceForLang(lang))
    return subscribeSpeechVoices(() => {
      setReady(hasVoiceForLang(lang))
    })
  }, [lang])

  return ready
}
