import { NextResponse } from 'next/server'
import { translateEnglishToChinese } from '@/lib/gemini'

const REQUEST_COOLDOWN_MS = 400
const CACHE_MAX = 128
const requestCooldown = new Map<string, number>()
type TranslatePayload = {
  chinese: string
  pinyin: string
  exampleEn: string
  exampleZh: string
  alternatives: Array<{
    chinese: string
    pinyin: string
    partOfSpeech: string
    exampleEn: string
    exampleZh: string
  }>
}

const translationCache = new Map<string, TranslatePayload>()

function clientKey(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') || ''
  return xf.split(',')[0]?.trim() || 'local'
}

function cacheKey(text: string, context = ''): string {
  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ')
  const normalizedContext = context.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalizedContext ? `${normalizedText}::ctx:${normalizedContext}` : normalizedText
}

function isLikelySingleWordLookup(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false
  if (/\s/.test(normalized)) return false
  return /^[A-Za-z][A-Za-z'-]*$/.test(normalized)
}

function pruneCache() {
  while (translationCache.size > CACHE_MAX) {
    const first = translationCache.keys().next().value
    if (first === undefined) break
    translationCache.delete(first)
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: unknown; context?: unknown }
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 240) : ''
    const context = typeof body.context === 'string' ? body.context.trim().slice(0, 360) : ''
    if (!text) {
      return NextResponse.json({ ok: false, error: 'Enter a word or phrase to translate.' }, { status: 400 })
    }

    const key = cacheKey(text, context)
    const cached = translationCache.get(key)
    if (cached) {
      return NextResponse.json({ ok: true, ...cached, fromCache: true })
    }

    const ck = clientKey(req)
    const now = Date.now()
    const last = requestCooldown.get(ck) ?? 0
    if (now - last < REQUEST_COOLDOWN_MS) {
      return NextResponse.json(
        { ok: false, error: 'Please wait a moment before translating again.' },
        { status: 429 },
      )
    }
    requestCooldown.set(ck, now)

    const result = await translateEnglishToChinese(text, context)
    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Translation unavailable. Check that GEMINI_API_KEY is set in .env.local, then try again.',
        },
        { status: 503 },
      )
    }

    const includeAlternatives = isLikelySingleWordLookup(text)
    const payload: TranslatePayload = {
      chinese: result.chinese,
      pinyin: result.pinyin,
      exampleEn: result.exampleEn,
      exampleZh: result.exampleZh,
      alternatives: includeAlternatives ? result.alternatives : [],
    }

    translationCache.set(key, payload)
    pruneCache()
    return NextResponse.json({
      ok: true,
      chinese: payload.chinese,
      pinyin: payload.pinyin,
      exampleEn: payload.exampleEn,
      exampleZh: payload.exampleZh,
      alternatives: payload.alternatives,
    })
  } catch (e) {
    console.warn('[translate]', e)
    return NextResponse.json({ ok: false, error: 'Translation failed. Please try again.' }, { status: 500 })
  }
}
