import 'server-only'

import { resolveGeminiApiKey } from '@/lib/gemini'
import {
  parseCloudOcrWordsFromModelText,
  type ScoredOcrWord,
} from '@/lib/books/searchable-pdf-ocr-fallback'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

/** One cloud read must not hold the page queue longer than this. */
const CLOUD_OCR_TIMEOUT_MS = 30_000

const SYSTEM_INSTRUCTION = `You read one scanned textbook page and return word boxes for invisible text placement.

Return JSON only:
{
  "words": [
    { "text": "Once", "x0": 0.08, "y0": 0.12, "x1": 0.14, "y1": 0.16 }
  ]
}

Rules:
- One entry per printed word, in reading order (left to right, top to bottom).
- x0,y0,x1,y1 are fractions of the image width and height. Origin is the top-left. y increases downward. 0 is the left or top edge, 1 is the right or bottom edge.
- Include story body, titles, and captions. Skip page furniture only when it is a bare page number.
- Copy the printed spelling. Do not invent words. If a word is unreadable, omit it.
- Return ONLY JSON (no markdown fences).`

function generationConfigFor(model: string) {
  return {
    temperature: 0.1,
    responseMimeType: 'application/json',
    maxOutputTokens: 16384,
    // 2.5 models think by default; word boxes do not need it and it adds tens of seconds.
    ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
  }
}

/**
 * Ask Gemini for word boxes when local OCR is too unsure to stamp.
 * Returns null when the key is missing, the call fails or times out, or no words come back.
 */
export async function recognizePageWordsWithCloudOcr(args: {
  imageBuffer: Buffer
  mimeType: 'image/jpeg' | 'image/png'
  imageWidth: number
  imageHeight: number
}): Promise<ScoredOcrWord[] | null> {
  if (args.imageWidth <= 0 || args.imageHeight <= 0 || args.imageBuffer.length === 0) return null

  const key = await resolveGeminiApiKey()
  if (!key) {
    console.warn('[searchable-pdf] cloud OCR skipped — Gemini API key is not configured')
    return null
  }

  const base64 = args.imageBuffer.toString('base64')
  const userText = `This page image is ${args.imageWidth} by ${args.imageHeight} pixels. Return every printed word with a box.`
  const failures: string[] = []

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLOUD_OCR_TIMEOUT_MS)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: userText },
                  { inlineData: { mimeType: args.mimeType, data: base64 } },
                ],
              },
            ],
            generationConfig: generationConfigFor(model),
          }),
        },
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 180)
        failures.push(
          res.status === 429
            ? `${model}: rate limited`
            : `${model}: HTTP ${res.status}${snippet ? ` (${snippet})` : ''}`,
        )
        continue
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
      if (!text) {
        failures.push(`${model}: empty`)
        continue
      }
      const words = parseCloudOcrWordsFromModelText(text, args.imageWidth, args.imageHeight)
      if (words.length > 0) return words
      failures.push(`${model}: no word boxes`)
    } catch (err) {
      if (controller.signal.aborted) {
        failures.push(`${model}: timed out after ${CLOUD_OCR_TIMEOUT_MS / 1000}s`)
        break
      }
      failures.push(`${model}: ${err instanceof Error ? err.message : 'network error'}`)
    } finally {
      clearTimeout(timeout)
    }
  }

  console.warn(`[searchable-pdf] cloud OCR failed (${failures.join('; ') || 'unknown error'})`)
  return null
}
