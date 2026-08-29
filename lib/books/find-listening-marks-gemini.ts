import 'server-only'

import { resolveGeminiApiKey } from '@/lib/gemini'
import {
  parseListeningMarkHits,
  type ListeningMarkHit,
} from '@/lib/books/listening-mark-hits'

export type { ListeningMarkHit } from '@/lib/books/listening-mark-hits'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

const SYSTEM_INSTRUCTION = `You find listening / audio icons on ESL textbook page images.

You receive:
1) A REFERENCE CROP of the listening mark (headphones / CD / speaker icon style used in this book).
2) One or two FULL PAGE images from the same book.

Find every instance of that same mark on the page images. For each hit, read the printed track number on or next to the mark (e.g. "1.12", "3.4", "Track 12", "001").

Return JSON only:
{
  "hits": [
    { "pdfPage": <number>, "label": "<printed number>", "x": <0-1>, "y": <0-1> }
  ]
}

Rules:
- Only report marks that match the reference crop (same icon family).
- pdfPage should be one of the PDF page numbers listed in the user message.
- If you are unsure of the PDF page number, use 1 for the first full-page image after the crop and 2 for the second.
- x,y are the center of the mark on that page (0 = left/top, 1 = right/bottom).
- If a page has no matching marks, omit it (empty hits is fine).
- Do not invent marks or numbers. If the number is unreadable, skip that mark.
- Return ONLY JSON (no markdown fences).`

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed
  const first = withoutFence.indexOf('{')
  const last = withoutFence.lastIndexOf('}')
  const candidate = first >= 0 && last > first ? withoutFence.slice(first, last + 1) : withoutFence
  return JSON.parse(candidate)
}

export async function findListeningMarksWithGemini(params: {
  markJpegBase64: string
  markMimeType?: string
  pages: Array<{ pdfPage: number; jpegBase64: string; mimeType?: string }>
}): Promise<{ ok: true; hits: ListeningMarkHit[] } | { ok: false; error: string; rateLimited?: boolean }> {
  const key = await resolveGeminiApiKey()
  if (!key) {
    return {
      ok: false,
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY to auto-place speakers.',
    }
  }

  if (!params.pages.length) {
    return { ok: true, hits: [] }
  }

  const pageNums = params.pages.map((p) => p.pdfPage)
  const pageList =
    pageNums.length === 1
      ? `PDF page ${pageNums[0]} (the first full-page image after the crop). Prefer pdfPage=${pageNums[0]}; if unsure use 1 for this image.`
      : `PDF pages ${pageNums.join(', ')} in order (full-page images after the crop). Prefer those PDF numbers; if unsure use 1 for the first full-page image and 2 for the second.`

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `${pageList}\n\nFind every listening mark matching the reference crop. Return JSON with hits.`,
    },
    {
      inlineData: {
        mimeType: params.markMimeType || 'image/jpeg',
        data: params.markJpegBase64,
      },
    },
  ]
  for (const page of params.pages) {
    parts.push({
      text: `Full page image for PDF page ${page.pdfPage}:`,
    })
    parts.push({
      inlineData: {
        mimeType: page.mimeType || 'image/jpeg',
        data: page.jpegBase64,
      },
    })
  }

  const failures: string[] = []
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              maxOutputTokens: 4096,
            },
          }),
        },
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 180)
        if (res.status === 429) {
          failures.push(`${model}: rate limited`)
        } else {
          failures.push(`${model}: HTTP ${res.status}${snippet ? ` (${snippet})` : ''}`)
        }
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
      try {
        const parsed = parseJsonFromModelText(text)
        return { ok: true, hits: parseListeningMarkHits(parsed, pageNums) }
      } catch {
        failures.push(`${model}: bad JSON`)
        continue
      }
    } catch (err) {
      failures.push(`${model}: ${err instanceof Error ? err.message : 'network error'}`)
    }
  }

  const rateLimited = failures.some((f) => /rate limited/i.test(f))
  return {
    ok: false,
    rateLimited,
    error: rateLimited
      ? 'Gemini is rate-limiting right now. Wait a few minutes, then continue — finished pages were kept.'
      : `Could not find listening marks (${failures[0] ?? 'unknown error'}).`,
  }
}
