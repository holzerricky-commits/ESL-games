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
 * POST { words: string[]; contexts?: Record<string, string> }
 * → { phrases: Record<string, string> }
 * Optional contexts map lemma → English example to pin image sense (Translate).
 * Skips Gemini for lemmas that already have a curated image override.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { words?: unknown; contexts?: unknown }
    const raw = Array.isArray(body.words) ? body.words : []
    const words = [...new Set(raw.map(normalizeWord).filter(Boolean))].slice(0, 36)
    if (words.length === 0) {
      return NextResponse.json({ phrases: {} })
    }

    const contexts: Record<string, string> = {}
    if (body.contexts && typeof body.contexts === 'object' && !Array.isArray(body.contexts)) {
      for (const [k, v] of Object.entries(body.contexts as Record<string, unknown>)) {
        const nk = normalizeWord(k)
        if (!nk || typeof v !== 'string') continue
        const example = v.replace(/\s+/g, ' ').trim().slice(0, 160)
        if (example.length >= 3) contexts[nk] = example
      }
    }

    const needsLlm = words.filter((w) => !getCuratedImageSearchOverride(w))
    const fromModel =
      needsLlm.length > 0
        ? await generateImageSearchPhrases(
            needsLlm,
            Object.keys(contexts).length > 0 ? contexts : undefined,
          )
        : {}

    return NextResponse.json({ phrases: fromModel })
  } catch (e) {
    console.warn('[image-search-phrase]', e)
    return NextResponse.json({ phrases: {} }, { status: 200 })
  }
}
