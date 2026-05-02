import { NextResponse } from 'next/server'
import { resolveGeminiApiKey } from '@/lib/gemini'

export const runtime = 'nodejs'

interface ExtractRowRequest {
  lessonTitle?: unknown
  unitTitle?: unknown
  focusAreas?: unknown
  imageDataUrl?: unknown
}

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match?.[1] || !match[2]) return null
  return {
    mimeType: match[1].trim().toLowerCase(),
    data: match[2].trim(),
  }
}

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

async function callGeminiExtract(
  key: string,
  prompt: string,
  image: { mimeType: string; data: string },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text:
                  'Extract row-level curriculum fields from a screenshot table. Return strict JSON only.',
              }],
            },
            contents: [{
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType: image.mimeType, data: image.data } },
              ],
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              maxOutputTokens: 1024,
            },
          }),
        },
      )
      if (!res.ok) continue
      const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (text) return { ok: true, text }
    } catch {
      continue
    }
  }
  return { ok: false, error: 'Gemini extraction request failed for all model candidates.' }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExtractRowRequest
    const lessonTitle = String(body.lessonTitle ?? '').trim()
    const unitTitle = String(body.unitTitle ?? '').trim()
    const focusAreas = Array.isArray(body.focusAreas)
      ? body.focusAreas.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 20)
      : []
    const imageDataUrl = String(body.imageDataUrl ?? '').trim()
    if (!imageDataUrl) return NextResponse.json({ ok: false, error: 'imageDataUrl is required.' }, { status: 400 })
    if (!focusAreas.length) return NextResponse.json({ ok: false, error: 'focusAreas are required.' }, { status: 400 })
    const parsedImage = parseDataUrl(imageDataUrl)
    if (!parsedImage) return NextResponse.json({ ok: false, error: 'Invalid imageDataUrl format.' }, { status: 400 })
    if (!parsedImage.mimeType.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Only image screenshots are supported.' }, { status: 400 })
    }
    const key = await resolveGeminiApiKey()
    if (!key) return NextResponse.json({ ok: false, error: 'Gemini API key is missing.' }, { status: 500 })
    const prompt = [
      'Extract values for this single lesson row screenshot.',
      `Unit: ${unitTitle || '(unknown)'}`,
      `Lesson: ${lessonTitle || '(unknown)'}`,
      `Focus areas to extract: ${focusAreas.join(', ')}`,
      'Read only the row content visible in this screenshot.',
      'Return strict JSON in this exact format:',
      '{"values":{"Focus Area 1":"extracted text","Focus Area 2":"extracted text"}}',
      'Rules:',
      '- Keep keys exactly as provided in focus areas.',
      '- If a value is not visible, use empty string.',
      '- Keep concise text snippets, not long paragraphs.',
    ].join('\n')
    const ai = await callGeminiExtract(key, prompt, parsedImage)
    if (!ai.ok) return NextResponse.json({ ok: false, error: ai.error }, { status: 502 })
    let parsed: unknown
    try {
      parsed = parseJsonFromModelText(ai.text)
    } catch {
      return NextResponse.json({ ok: false, error: 'Failed to parse Gemini JSON response.' }, { status: 502 })
    }
    const valuesRaw = (parsed as { values?: unknown })?.values
    const values: Record<string, string> = {}
    if (valuesRaw && typeof valuesRaw === 'object') {
      for (const area of focusAreas) {
        const candidate = (valuesRaw as Record<string, unknown>)[area]
        values[area] = typeof candidate === 'string' ? candidate.trim() : ''
      }
    } else {
      for (const area of focusAreas) values[area] = ''
    }
    return NextResponse.json({ ok: true, values })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to extract lesson row from screenshot.' }, { status: 500 })
  }
}

