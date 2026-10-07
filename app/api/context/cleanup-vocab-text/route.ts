import { NextResponse } from 'next/server'
import { resolveGeminiApiKey } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT = `You fix OCR errors in English vocabulary lists for ESL textbooks (ages 8-14).

Rules:
- Fix obvious OCR typos, broken words, and garbled characters in word and definition fields.
- Keep the original meaning — only fix spelling/grammar errors, not rewrite content.
- If a word or definition looks correct, return it unchanged.
- Preserve the original JSON array structure exactly.
- Return ONLY valid JSON: the same array of objects with "id", "word", "definition" fields.`

interface WordInput {
  id?: string
  word?: string
  definition?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { words?: unknown }
    const words = Array.isArray(body.words)
      ? (body.words as WordInput[])
          .filter((w) => w && typeof w === 'object' && typeof w.word === 'string')
          .slice(0, 40)
          .map((w) => ({
            id: String(w.id ?? '').trim(),
            word: String(w.word ?? '').trim(),
            definition: String(w.definition ?? '').trim(),
          }))
      : []

    if (words.length === 0) {
      return NextResponse.json({ ok: true, words: [] })
    }

    const key = await resolveGeminiApiKey()
    if (!key) {
      return NextResponse.json({ ok: false, error: 'No API key configured.' }, { status: 500 })
    }

    const userText = `Fix any OCR errors in these vocabulary words. Return the same JSON array with corrected text:\n${JSON.stringify(words)}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            maxOutputTokens: 2048,
          },
        }),
      },
    )

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'Gemini request failed.' }, { status: 502 })
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'Empty response from AI.' }, { status: 502 })
    }

    let cleaned = text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    }
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: 'Unexpected response shape.' }, { status: 502 })
    }

    const result = parsed.slice(0, 40).map((item: Record<string, unknown>) => ({
      id: String(item.id ?? '').trim(),
      word: String(item.word ?? '').trim(),
      definition: String(item.definition ?? '').trim(),
    }))

    return NextResponse.json({ ok: true, words: result })
  } catch (err) {
    console.error('[cleanup-vocab-text]', err)
    return NextResponse.json({ ok: false, error: 'Could not clean up text.' }, { status: 500 })
  }
}
