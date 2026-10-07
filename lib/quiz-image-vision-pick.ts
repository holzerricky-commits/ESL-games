import 'server-only'

import { resolveGeminiApiKey } from '@/lib/gemini'
import { parseVisionPickIndex } from '@/lib/quiz-image-vision-pick-parse'

export { parseVisionPickIndex } from '@/lib/quiz-image-vision-pick-parse'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

const VISION_PICK_SYSTEM = `You pick the best stock photo for a single ESL vocabulary word (ages 8–14).

You receive images labeled Image 0, Image 1, … Image N.
Choose the ONE image whose main subject most clearly matches the target word.

Rules:
- Prefer a clear, literal depiction of the word itself (e.g. "flower" → a flower, not fruit; "apple" → an apple).
- Reject images where the word is only a minor detail, a wrong object, text/meme, or a different sense.
- If several are good, pick the clearest single-subject classroom-friendly photo.
- Return ONLY JSON: {"index":<number>} where index is one of the labeled image numbers.
- If none match, still return the least-wrong index (never omit index).`

export type VisionPickCandidate = {
  /** Stable id for logging */
  id: string
  /** Full-size URL to return to the client */
  fullUrl: string
  /** Smaller URL fetched for Gemini (preview preferred) */
  thumbUrl: string
}

export type VisionPickResult =
  | { ok: true; fullUrl: string; index: number; model: string }
  | { ok: false; reason: string }

async function fetchThumbInline(
  url: string,
  timeoutMs = 8_000,
): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength < 80 || buf.byteLength > 1_200_000) return null
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]?.trim() || 'image/jpeg'
    if (!mime.startsWith('image/')) return null
    return { mimeType: mime, data: buf.toString('base64') }
  } catch {
    return null
  }
}

/**
 * Download candidate thumbs and ask Gemini which best matches `word`.
 * Falls back to caller if Gemini/key/fetch fails.
 */
export async function pickBestImageWithGemini(
  word: string,
  candidates: VisionPickCandidate[],
  options?: { maxCandidates?: number },
): Promise<VisionPickResult> {
  const max = Math.min(12, Math.max(2, options?.maxCandidates ?? 10))
  const slice = candidates.slice(0, max)
  if (slice.length === 0) return { ok: false, reason: 'no-candidates' }
  if (slice.length === 1) {
    return { ok: true, fullUrl: slice[0].fullUrl, index: 0, model: 'single' }
  }

  const key = await resolveGeminiApiKey()
  if (!key) return { ok: false, reason: 'no-api-key' }

  const loaded: Array<VisionPickCandidate & { mimeType: string; data: string }> = []
  for (const c of slice) {
    const inline = await fetchThumbInline(c.thumbUrl || c.fullUrl)
    if (inline) loaded.push({ ...c, ...inline })
  }
  if (loaded.length === 0) return { ok: false, reason: 'thumbs-failed' }
  if (loaded.length === 1) {
    return { ok: true, fullUrl: loaded[0].fullUrl, index: 0, model: 'single' }
  }

  const target = word.trim().toLowerCase().slice(0, 80) || 'object'
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `Target word: "${target}"\nPick the best matching image. Return {"index":n} with n from 0 to ${loaded.length - 1}.`,
    },
  ]
  loaded.forEach((c, i) => {
    parts.push({ text: `Image ${i}:` })
    parts.push({ inlineData: { mimeType: c.mimeType, data: c.data } })
  })

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: VISION_PICK_SYSTEM }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              maxOutputTokens: 64,
            },
          }),
          signal: AbortSignal.timeout(45_000),
        },
      )
      if (!res.ok) {
        if (res.status === 404 || res.status === 429 || res.status >= 500) continue
        return { ok: false, reason: `gemini-${res.status}` }
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (typeof text !== 'string' || !text.trim()) continue
      const index = parseVisionPickIndex(text, loaded.length)
      if (index == null) continue
      return { ok: true, fullUrl: loaded[index].fullUrl, index, model }
    } catch {
      continue
    }
  }

  return { ok: false, reason: 'gemini-failed' }
}
