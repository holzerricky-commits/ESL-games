import { NextRequest, NextResponse } from 'next/server'
import { generateImageSearchPhrases } from '@/lib/gemini'
import { getCuratedImageSearchOverride } from '@/lib/quiz-image-queries'

function normalizeWord(w: unknown): string {
  if (typeof w !== 'string') return ''
  return w
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 60)
}

/**
 * POST { words: string[] } → { phrases: Record<string, string> }
 * Skips Gemini for lemmas that already have a curated image override (client can omit storing those).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { words?: unknown }
    const raw = Array.isArray(body.words) ? body.words : []
    const words = [...new Set(raw.map(normalizeWord).filter(Boolean))].slice(0, 36)
    if (words.length === 0) {
      return NextResponse.json({ phrases: {} })
    }

    const needsLlm = words.filter((w) => !getCuratedImageSearchOverride(w))
    const fromModel = needsLlm.length > 0 ? await generateImageSearchPhrases(needsLlm) : {}

    return NextResponse.json({ phrases: fromModel })
  } catch (e) {
    console.warn('[image-search-phrase]', e)
    return NextResponse.json({ phrases: {} }, { status: 200 })
  }
}
