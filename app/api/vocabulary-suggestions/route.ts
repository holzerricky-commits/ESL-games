import { NextResponse } from 'next/server'
import {
  generateVocabularySuggestions,
  regenerateVocabularyBucket,
  topUpVocabularyBucket,
  type SuggestionBucket,
} from '@/lib/gemini'
import { getVocabSuggestions } from '@/lib/helpers'

const REQUEST_TIMEOUT_MS = 5500
const REQUEST_COOLDOWN_MS = 1200
const requestCooldown = new Map<string, number>()
const recentSuccessByClient = new Map<string, { easy: string[]; medium: string[]; hard: string[] }>()

function getClientKey(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') || ''
  const ip = xf.split(',')[0]?.trim() || 'local'
  return ip
}

function buildTimeoutFallback(quizName: string, specialNotes: string, numPerDifficulty: number) {
  const count = Math.max(3, Math.min(12, Math.floor(numPerDifficulty || 6)))
  const topic = getVocabSuggestions(`${quizName} ${specialNotes}`)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
  const unique = Array.from(new Set(topic))
  const easy = unique.filter((w) => w.length <= 6).slice(0, count)
  const medium = unique.filter((w) => w.length >= 5 && w.length <= 10).slice(0, count)
  const hard = unique.filter((w) => w.length >= 8).slice(0, count)
  return { easy, medium, hard }
}

function parseCurrent(body: { currentSuggestions?: unknown }) {
  const cur = body?.currentSuggestions as { easy?: unknown; medium?: unknown; hard?: unknown } | undefined
  return {
    easy: Array.isArray(cur?.easy) ? cur.easy.map(String) : [],
    medium: Array.isArray(cur?.medium) ? cur.medium.map(String) : [],
    hard: Array.isArray(cur?.hard) ? cur.hard.map(String) : [],
  }
}

export async function POST(req: Request) {
  try {
    const clientKey = getClientKey(req)
    const body = await req.json()
    const quizName = typeof body?.quizName === 'string' ? body.quizName : ''
    const specialNotes = typeof body?.specialNotes === 'string' ? body.specialNotes : ''
    const numPerDifficulty = Number(body?.numPerDifficulty ?? 6)

    const exclude = {
      easy: Array.isArray(body?.exclude?.easy) ? body.exclude.easy : [],
      medium: Array.isArray(body?.exclude?.medium) ? body.exclude.medium : [],
      hard: Array.isArray(body?.exclude?.hard) ? body.exclude.hard : [],
    }

    const topUp = body?.topUpBucket as string | undefined
    const isTopUp =
      (topUp === 'easy' || topUp === 'medium' || topUp === 'hard') && Number(body?.needCount) > 0

    const regen = body?.regenerateBucket as string | undefined
    const isBucketRegen =
      !isTopUp && (regen === 'easy' || regen === 'medium' || regen === 'hard')

    const now = Date.now()
    const last = requestCooldown.get(clientKey) ?? 0
    if (now - last < REQUEST_COOLDOWN_MS && !isBucketRegen && !isTopUp) {
      const prev = recentSuccessByClient.get(clientKey)
      return NextResponse.json({
        ok: true,
        suggestions: prev ?? buildTimeoutFallback(quizName, specialNotes, numPerDifficulty),
        throttled: true,
        fromCache: true,
      })
    }
    if (!isBucketRegen && !isTopUp) {
      requestCooldown.set(clientKey, now)
    }

    const timedOutFallback = buildTimeoutFallback(quizName, specialNotes, numPerDifficulty)
    const timeoutPromise = new Promise<typeof timedOutFallback>((resolve) => {
      setTimeout(() => resolve(timedOutFallback), REQUEST_TIMEOUT_MS)
    })

    let suggestions: { easy: string[]; medium: string[]; hard: string[] }
    let timedOut = false
    let fromCache = false

    if (isTopUp) {
      const bucket = topUp as SuggestionBucket
      const needCount = Number(body.needCount)
      const currentSug = parseCurrent(body)
      const mergeTimeout = () => ({
        easy: bucket === 'easy' ? [...timedOutFallback.easy] : [...currentSug.easy],
        medium: bucket === 'medium' ? [...timedOutFallback.medium] : [...currentSug.medium],
        hard: bucket === 'hard' ? [...timedOutFallback.hard] : [...currentSug.hard],
      })
      const raced = await Promise.race([
        topUpVocabularyBucket(
          quizName,
          specialNotes,
          numPerDifficulty,
          bucket,
          needCount,
          currentSug,
          exclude
        ).then((s) => ({ kind: 'ok' as const, s })),
        new Promise<{ kind: 'timeout' }>((resolve) => {
          setTimeout(() => resolve({ kind: 'timeout' }), REQUEST_TIMEOUT_MS)
        }),
      ])
      if (raced.kind === 'timeout') {
        suggestions = mergeTimeout()
        timedOut = true
        fromCache = false
      } else {
        suggestions = raced.s
        timedOut = false
        fromCache = false
      }
    } else if (isBucketRegen) {
      const bucket = regen as SuggestionBucket
      const currentSug = parseCurrent(body)
      const mergeTimeout = () => ({
        easy: bucket === 'easy' ? [...timedOutFallback.easy] : [...currentSug.easy],
        medium: bucket === 'medium' ? [...timedOutFallback.medium] : [...currentSug.medium],
        hard: bucket === 'hard' ? [...timedOutFallback.hard] : [...currentSug.hard],
      })
      const raced = await Promise.race([
        regenerateVocabularyBucket(
          quizName,
          specialNotes,
          numPerDifficulty,
          bucket,
          currentSug,
          exclude
        ).then((s) => ({ kind: 'ok' as const, s })),
        new Promise<{ kind: 'timeout' }>((resolve) => {
          setTimeout(() => resolve({ kind: 'timeout' }), REQUEST_TIMEOUT_MS)
        }),
      ])
      if (raced.kind === 'timeout') {
        suggestions = mergeTimeout()
        timedOut = true
        fromCache = false
      } else {
        suggestions = raced.s
        timedOut = false
        fromCache = false
      }
    } else {
      const raced = await Promise.race([
        generateVocabularySuggestions(quizName, specialNotes, numPerDifficulty, exclude).then((r) => ({
          kind: 'ok' as const,
          r,
        })),
        new Promise<{ kind: 'timeout' }>((resolve) => {
          setTimeout(() => resolve({ kind: 'timeout' }), REQUEST_TIMEOUT_MS)
        }),
      ])
      if (raced.kind === 'timeout') {
        suggestions = timedOutFallback
        timedOut = true
        fromCache = false
      } else {
        suggestions = raced.r.suggestions
        fromCache = raced.r.fromCache
        timedOut = false
      }
    }

    if (
      Array.isArray(suggestions.easy) &&
      Array.isArray(suggestions.medium) &&
      Array.isArray(suggestions.hard) &&
      (suggestions.easy.length > 0 || suggestions.medium.length > 0 || suggestions.hard.length > 0)
    ) {
      recentSuccessByClient.set(clientKey, suggestions)
    }

    return NextResponse.json({
      ok: true,
      suggestions,
      timedOut,
      fromCache,
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Failed to generate vocabulary suggestions.' },
      { status: 500 }
    )
  }
}
