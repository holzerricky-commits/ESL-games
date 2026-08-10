type VoiceLike = { lang: string; name: string; localService?: boolean }

const ENGLISH_LOCALE_BONUS: Record<string, number> = {
  'en-us': 40,
  'en-gb': 30,
  en: 20,
}

const CHINESE_LOCALE_BONUS: Record<string, number> = {
  'zh-cn': 40,
  'zh-hans': 35,
  'cmn-cn': 40,
  cmn: 35,
  'zh-tw': 25,
  'zh-hk': 20,
  'zh-yue': 15,
  zh: 20,
}

/** ms to wait for preferred voice onstart before falling back to reliable. */
const PREFERRED_START_TIMEOUT_MS = 350

/** Plain-English hint when no Chinese voice is available to the browser. */
export const CHINESE_SPEECH_INSTALL_HINT =
  'No Chinese voice in this browser. If Windows already has Chinese speech, restart Chrome/Edge or try Edge. Otherwise: Settings → Time & language → Language → Chinese → Speech.'

/** One-line hint for the translate dock (full text in toast if they tap). */
export const CHINESE_SPEECH_INSTALL_HINT_SHORT =
  'No Chinese voice in this browser — restart Chrome/Edge, or try Edge.'

function localeBonus(lang: string, table: Record<string, number>): number {
  const normalized = lang.toLowerCase().replace('_', '-')
  if (table[normalized] != null) return table[normalized]!
  for (const [prefix, bonus] of Object.entries(table)) {
    if (prefix !== 'en' && prefix !== 'zh' && prefix !== 'cmn' && normalized.startsWith(prefix)) {
      return bonus
    }
  }
  return 10
}

/** Score for “sounds good” first attempt (Google / Natural over robotic Desktop). */
function niceBonus(v: VoiceLike): number {
  let s = 0
  const name = v.name.toLowerCase()
  if (name.includes('natural') || name.includes('neural') || name.includes('enhanced')) s += 40
  if (name.includes('google')) s += 30
  if (name.includes('microsoft')) s += 8
  if (
    name.includes('desktop') ||
    name.includes('zira') ||
    name.includes('david') ||
    name.includes('mark') ||
    name.includes('huihui') ||
    name.includes('yaoyao') ||
    name.includes('kangkang')
  ) {
    s += 4
  }
  if (v.localService) s += 2
  return s
}

/** Score for reliable fallback (local / Microsoft Desktop). */
function reliableBonus(v: VoiceLike, langPrefix: 'en' | 'zh'): number {
  let s = 0
  const name = v.name.toLowerCase()

  if (langPrefix === 'en') {
    if (v.localService) s += 50
    if (name.includes('natural') || name.includes('neural') || name.includes('enhanced')) s += 12
    if (name.includes('microsoft')) s += 10
    if (name.includes('google')) s += 4
    if (
      name.includes('desktop') ||
      name.includes('zira') ||
      name.includes('david') ||
      name.includes('mark')
    ) {
      s += 8
    }
    return s
  }

  if (v.localService) s += 40
  if (name.includes('natural') || name.includes('neural') || name.includes('enhanced')) s += 12
  if (name.includes('microsoft')) s += 10
  if (name.includes('google')) s += 2
  if (
    name.includes('huihui') ||
    name.includes('yaoyao') ||
    name.includes('kangkang') ||
    name.includes('xiaoxiao') ||
    name.includes('hanhan')
  ) {
    s += 8
  }
  return s
}

/** Match zh-*, cmn-*, and common Chinese voice name tags (Windows/Chrome vary). */
export function isChineseVoiceLike(v: VoiceLike): boolean {
  const lang = v.lang.toLowerCase().replace('_', '-')
  const name = v.name.toLowerCase()
  if (/^(zh|cmn)([-_]|$)/i.test(lang)) return true
  if (lang.includes('chinese')) return true
  if (
    /中文|普通话|國語|国语|粤语|粵語|cantonese|mandarin|huihui|yaoyao|kangkang|xiaoxiao|hanhan/.test(
      name,
    )
  ) {
    return true
  }
  return false
}

/**
 * Chrome often marks Windows English TTS as non-local.
 * Prefer Microsoft / Desktop voices; treat pure Google cloud as last resort only.
 */
export function isReliableEnglishVoice(v: VoiceLike): boolean {
  if (!/^en([-_]|$)/i.test(v.lang)) return false
  if (v.localService) return true
  const name = v.name.toLowerCase()
  if (name.includes('google')) return false
  if (name.includes('microsoft')) return true
  if (
    name.includes('desktop') ||
    name.includes('zira') ||
    name.includes('david') ||
    name.includes('mark') ||
    name.includes('hazel') ||
    name.includes('susan')
  ) {
    return true
  }
  return false
}

/**
 * Chrome often marks Windows Chinese TTS as non-local even when the pack is installed.
 * Accept Microsoft / known desktop Chinese voices; still skip pure Google cloud Mandarin.
 */
export function isReliableChineseVoice(v: VoiceLike): boolean {
  if (!isChineseVoiceLike(v)) return false
  if (v.localService) return true
  const name = v.name.toLowerCase()
  if (name.includes('google')) return false
  if (name.includes('microsoft')) return true
  if (
    name.includes('huihui') ||
    name.includes('yaoyao') ||
    name.includes('kangkang') ||
    name.includes('xiaoxiao') ||
    name.includes('hanhan') ||
    name.includes('desktop')
  ) {
    return true
  }
  return false
}

function voicesForLang(voices: ReadonlyArray<VoiceLike>, langPrefix: 'en' | 'zh'): VoiceLike[] {
  if (langPrefix === 'zh') return voices.filter(isChineseVoiceLike)
  const prefixRe = /^en([-_]|$)/i
  return voices.filter((v) => prefixRe.test(v.lang))
}

function scoreNice(v: VoiceLike, langPrefix: 'en' | 'zh'): number {
  const table = langPrefix === 'en' ? ENGLISH_LOCALE_BONUS : CHINESE_LOCALE_BONUS
  return localeBonus(v.lang, table) + niceBonus(v)
}

function scoreReliable(v: VoiceLike, langPrefix: 'en' | 'zh'): number {
  const table = langPrefix === 'en' ? ENGLISH_LOCALE_BONUS : CHINESE_LOCALE_BONUS
  return localeBonus(v.lang, table) + reliableBonus(v, langPrefix)
}

function sameVoice(a: VoiceLike | null, b: VoiceLike | null): boolean {
  if (!a || !b) return false
  return a.name === b.name && a.lang === b.lang
}

/** Nicest voice for first attempt (Natural / Google ranked above Desktop). */
export function pickPreferredVoice(
  voices: ReadonlyArray<VoiceLike>,
  langPrefix: 'en' | 'zh',
): VoiceLike | null {
  const matches = voicesForLang(voices, langPrefix)
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => scoreNice(b, langPrefix) - scoreNice(a, langPrefix))[0] ?? null
}

/** Microsoft / local voice used when the preferred voice fails to start. */
export function pickReliableVoice(
  voices: ReadonlyArray<VoiceLike>,
  langPrefix: 'en' | 'zh',
): VoiceLike | null {
  const matches = voicesForLang(voices, langPrefix)
  if (matches.length === 0) return null

  const reliable =
    langPrefix === 'zh'
      ? matches.filter(isReliableChineseVoice)
      : matches.filter(isReliableEnglishVoice)

  if (reliable.length === 0) return null
  return (
    [...reliable].sort((a, b) => scoreReliable(b, langPrefix) - scoreReliable(a, langPrefix))[0] ??
    null
  )
}

/**
 * Any usable voice for the language: preferred (nice) first, else reliable.
 * Used for button visibility — true when either role exists.
 */
export function pickVoiceForLang(
  voices: ReadonlyArray<VoiceLike>,
  langPrefix: 'en' | 'zh',
): VoiceLike | null {
  return pickPreferredVoice(voices, langPrefix) ?? pickReliableVoice(voices, langPrefix)
}

export type SpeakVoicePair = {
  primary: VoiceLike | null
  fallback: VoiceLike | null
}

/**
 * Which voices to use on a speak click.
 * - English: nice first, Microsoft/local as timed fallback (unless sticky / same voice).
 * - Chinese: Microsoft/local first when present; Google only if no reliable voice (no timer fallback).
 */
export function resolveSpeakVoices(
  voices: ReadonlyArray<VoiceLike>,
  langPrefix: 'en' | 'zh',
  options?: { stickyReliableOnly?: boolean },
): SpeakVoicePair {
  const preferred = pickPreferredVoice(voices, langPrefix)
  const reliable = pickReliableVoice(voices, langPrefix)

  if (langPrefix === 'zh') {
    if (reliable) return { primary: reliable, fallback: null }
    return { primary: preferred, fallback: null }
  }

  const sticky = options?.stickyReliableOnly === true
  const useReliableOnly = sticky || !preferred || (reliable != null && sameVoice(preferred, reliable))

  if (useReliableOnly) {
    return { primary: reliable ?? preferred, fallback: null }
  }

  return {
    primary: preferred,
    fallback: reliable && !sameVoice(preferred, reliable) ? reliable : null,
  }
}

/** @deprecated Prefer pickVoiceForLang(voices, 'en') */
export function pickEnglishVoice(voices: ReadonlyArray<VoiceLike>): VoiceLike | null {
  return pickVoiceForLang(voices, 'en')
}

let lastSpokenKey: string | null = null

/** After preferred fails once for English, stick to reliable for this page session. */
const stickyReliableOnly: Record<'en' | 'zh', boolean> = { en: false, zh: false }

function findSpeechVoice(
  voices: ReadonlyArray<SpeechSynthesisVoice>,
  picked: VoiceLike | null,
): SpeechSynthesisVoice | null {
  if (!picked) return null
  return voices.find((v) => v.name === picked.name && v.lang === picked.lang) ?? null
}

function buildUtterance(
  text: string,
  fallbackLang: string,
  voice?: SpeechSynthesisVoice | null,
): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = fallbackLang
  utterance.rate = 0.92
  utterance.volume = 1
  utterance.pitch = 1

  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  }

  return utterance
}

function unstickSynth(synth: SpeechSynthesis): void {
  try {
    if (synth.paused) synth.resume()
  } catch {
    /* ignore */
  }
}

function enqueueUtterance(utterance: SpeechSynthesisUtterance): void {
  const synth = window.speechSynthesis
  unstickSynth(synth)
  synth.speak(utterance)
  unstickSynth(synth)
}

function clearSpeakKey(speakKey: string): void {
  if (lastSpokenKey === speakKey) lastSpokenKey = null
}

/**
 * Speak text with the browser voice for `en` or `zh`.
 *
 * English: nice first (Google / Natural); Microsoft fallback if nice fails to start.
 * Chinese: Microsoft/local first when present; Google only if that is the only option.
 * Preferred English speak() stays on the click handler (Chrome drops delayed first speaks).
 */
function speakWithLang(text: string, langPrefix: 'en' | 'zh', fallbackLang: string): boolean {
  if (typeof window === 'undefined') return false
  const trimmed = text.trim()
  if (!trimmed) return false
  if (!isSpeechApiAvailable()) return false
  if (!hasVoiceForLang(langPrefix)) return false

  const synth = window.speechSynthesis
  const allVoices = synth.getVoices()
  const pair = resolveSpeakVoices(allVoices, langPrefix, {
    stickyReliableOnly: stickyReliableOnly[langPrefix],
  })
  const primary = findSpeechVoice(allVoices, pair.primary)
  const fallback = findSpeechVoice(allVoices, pair.fallback)

  if (!primary) return false

  const speakKey = `${langPrefix}::${trimmed.toLowerCase()}`

  if (synth.speaking || synth.pending) {
    try {
      synth.cancel()
    } catch {
      /* ignore */
    }
    unstickSynth(synth)
  }

  const utterance = buildUtterance(trimmed, fallbackLang, primary)
  lastSpokenKey = speakKey

  let settled = false
  let startTimer: ReturnType<typeof setTimeout> | null = null

  const finishOk = () => {
    if (settled) return
    settled = true
    if (startTimer != null) clearTimeout(startTimer)
  }

  const speakFallback = () => {
    if (settled || !fallback) return
    settled = true
    if (startTimer != null) clearTimeout(startTimer)
    stickyReliableOnly[langPrefix] = true
    try {
      synth.cancel()
    } catch {
      /* ignore */
    }
    unstickSynth(synth)
    const fb = buildUtterance(trimmed, fallbackLang, fallback)
    fb.onend = () => clearSpeakKey(speakKey)
    fb.onerror = () => clearSpeakKey(speakKey)
    enqueueUtterance(fb)
  }

  utterance.onstart = () => {
    finishOk()
  }
  utterance.onend = () => {
    finishOk()
    clearSpeakKey(speakKey)
  }
  utterance.onerror = () => {
    if (fallback) {
      speakFallback()
    } else {
      finishOk()
      clearSpeakKey(speakKey)
    }
  }

  if (fallback) {
    startTimer = setTimeout(() => {
      if (settled) return
      // No onstart yet — preferred likely silent; switch to reliable.
      speakFallback()
    }, PREFERRED_START_TIMEOUT_MS)
  }

  enqueueUtterance(utterance)
  return true
}

/**
 * Speak English text with the browser’s built-in voice.
 * Returns false if speech is unavailable, no English voice is loaded, or text is empty.
 */
export function speakEnglish(text: string): boolean {
  return speakWithLang(text, 'en', 'en-US')
}

/**
 * Speak Chinese text with a reliable browser voice when available.
 * Returns false if no Chinese voice is available, or text is empty.
 */
export function speakChinese(text: string): boolean {
  return speakWithLang(text, 'zh', 'zh-CN')
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined') return
  if (!('speechSynthesis' in window)) return
  lastSpokenKey = null
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}

export function isSpeechApiAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

/**
 * True when a usable voice exists (preferred nice and/or reliable fallback).
 */
export function hasVoiceForLang(langPrefix: 'en' | 'zh'): boolean {
  if (!isSpeechApiAvailable()) return false
  return pickVoiceForLang(window.speechSynthesis.getVoices(), langPrefix) != null
}

export type SpeechVoicesListener = (voices: SpeechSynthesisVoice[]) => void

/**
 * Kick voice loading and notify whenever the list updates.
 * Returns an unsubscribe function.
 */
export function subscribeSpeechVoices(listener: SpeechVoicesListener): () => void {
  if (!isSpeechApiAvailable()) {
    listener([])
    return () => {}
  }

  const synth = window.speechSynthesis
  const notify = () => {
    listener(synth.getVoices())
  }

  notify()
  synth.addEventListener('voiceschanged', notify)
  try {
    synth.getVoices()
  } catch {
    /* ignore */
  }

  return () => {
    synth.removeEventListener('voiceschanged', notify)
  }
}

/** Nudge Chrome/Edge to load the voice list early so speak buttons can become ready. */
export function warmSpeechVoices(): void {
  subscribeSpeechVoices(() => {})
}
