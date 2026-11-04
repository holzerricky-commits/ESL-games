import { NextRequest, NextResponse } from 'next/server'
import { generateVaultCardTextDraft } from '@/lib/gemini'
import { parseVaultCardTextFields } from '@/lib/lesson-vault/generate-card-text'

export const runtime = 'nodejs'

/**
 * POST { word, sentence?, meaning?, fields: 'sentence'|'meaning'|'both', regenerate? }
 * → { sentence, meaning } for the fields requested (others empty).
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const word = typeof body.word === 'string' ? body.word.trim().slice(0, 80) : ''
  if (!word) return NextResponse.json({ error: 'Missing word.' }, { status: 400 })

  const fields = parseVaultCardTextFields(body.fields)
  if (!fields) {
    return NextResponse.json({ error: 'fields must be sentence, meaning, or both.' }, { status: 400 })
  }

  const result = await generateVaultCardTextDraft({
    word,
    sentence: typeof body.sentence === 'string' ? body.sentence.slice(0, 400) : '',
    meaning: typeof body.meaning === 'string' ? body.meaning.slice(0, 200) : '',
    fields,
    regenerate: body.regenerate === true,
  })

  if (!result.ok) {
    if (result.reason === 'no-key') {
      return NextResponse.json({ error: 'Text generation is not configured.' }, { status: 503 })
    }
    if (result.reason === 'empty') {
      return NextResponse.json({ error: 'Could not write usable text for that word.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Text generation failed.' }, { status: 502 })
  }

  return NextResponse.json(result.draft)
}
