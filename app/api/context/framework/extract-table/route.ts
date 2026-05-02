import { NextResponse } from 'next/server'
import { resolveGeminiApiKey } from '@/lib/gemini'

export const runtime = 'nodejs'

interface ExtractTableRequest {
  focusAreas?: unknown
  rows?: unknown
  imageDataUrl?: unknown
}

interface InputRow {
  lessonId: string
  lessonTitle: string
  unitTitle: string
  unitLessonIndex: number
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
                  'Extract multi-row curriculum table values from a screenshot. Return strict JSON only.',
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
              maxOutputTokens: 4096,
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
    const body = (await req.json()) as ExtractTableRequest
    const focusAreas = Array.isArray(body.focusAreas)
      ? body.focusAreas.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 20)
      : []
    const imageDataUrl = String(body.imageDataUrl ?? '').trim()
    const rows = Array.isArray(body.rows)
      ? body.rows
          .map((item) => {
            if (!item || typeof item !== 'object') return null
            const src = item as Partial<InputRow>
            const lessonId = String(src.lessonId ?? '').trim()
            const lessonTitle = String(src.lessonTitle ?? '').trim()
            const unitTitle = String(src.unitTitle ?? '').trim()
            const unitLessonIndexRaw = Number(src.unitLessonIndex ?? 0)
            const unitLessonIndex = Number.isFinite(unitLessonIndexRaw) ? Math.max(0, Math.floor(unitLessonIndexRaw)) : 0
            if (!lessonId || !lessonTitle) return null
            return { lessonId, lessonTitle, unitTitle, unitLessonIndex }
          })
          .filter((item): item is InputRow => !!item)
          .slice(0, 400)
      : []
    if (!imageDataUrl) return NextResponse.json({ ok: false, error: 'imageDataUrl is required.' }, { status: 400 })
    if (!focusAreas.length) return NextResponse.json({ ok: false, error: 'focusAreas are required.' }, { status: 400 })
    if (!rows.length) return NextResponse.json({ ok: false, error: 'rows are required.' }, { status: 400 })
    const parsedImage = parseDataUrl(imageDataUrl)
    if (!parsedImage) return NextResponse.json({ ok: false, error: 'Invalid imageDataUrl format.' }, { status: 400 })
    if (!parsedImage.mimeType.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Only image screenshots are supported.' }, { status: 400 })
    }
    const key = await resolveGeminiApiKey()
    if (!key) return NextResponse.json({ ok: false, error: 'Gemini API key is missing.' }, { status: 500 })
    const rowsReference = rows.map((row) => ({
      lessonId: row.lessonId,
      lessonTitle: row.lessonTitle,
      unitTitle: row.unitTitle,
      lessonNumberHint: row.unitLessonIndex + 1,
    }))
    const prompt = [
      'Extract values for a full lesson-by-focus table screenshot.',
      `Focus areas: ${focusAreas.join(', ')}`,
      'Use these lesson references to align rows:',
      JSON.stringify(rowsReference),
      'Return strict JSON in this format:',
      '{"rows":[{"lessonId":"...","lessonNumber":1,"lessonTitle":"...","values":{"Focus Area 1":"...","Focus Area 2":"..."}}]}',
      'Rules:',
      '- Use lessonId from reference whenever possible.',
      '- If uncertain, still return lessonTitle and lessonNumber.',
      '- Keys in values must exactly match provided focus areas.',
      '- If a cell is not visible, use empty string.',
      '- Keep concise snippets.',
    ].join('\n')
    const ai = await callGeminiExtract(key, prompt, parsedImage)
    if (!ai.ok) return NextResponse.json({ ok: false, error: ai.error }, { status: 502 })
    let parsed: unknown
    try {
      parsed = parseJsonFromModelText(ai.text)
    } catch {
      return NextResponse.json({ ok: false, error: 'Failed to parse Gemini JSON response.' }, { status: 502 })
    }
    const rawRows = (parsed as { rows?: unknown })?.rows
    const outputRows: Array<{
      lessonId?: string
      lessonTitle?: string
      lessonNumber?: number
      values: Record<string, string>
    }> = []
    if (Array.isArray(rawRows)) {
      for (const row of rawRows.slice(0, 500)) {
        if (!row || typeof row !== 'object') continue
        const src = row as Record<string, unknown>
        const valuesSrc = src.values && typeof src.values === 'object' ? (src.values as Record<string, unknown>) : {}
        const values: Record<string, string> = {}
        for (const area of focusAreas) {
          values[area] = typeof valuesSrc[area] === 'string' ? String(valuesSrc[area]).trim() : ''
        }
        const lessonId = typeof src.lessonId === 'string' ? src.lessonId.trim() : undefined
        const lessonTitle = typeof src.lessonTitle === 'string' ? src.lessonTitle.trim() : undefined
        const lessonNumberRaw = Number(src.lessonNumber ?? NaN)
        const lessonNumber = Number.isFinite(lessonNumberRaw) && lessonNumberRaw > 0 ? Math.floor(lessonNumberRaw) : undefined
        outputRows.push({ lessonId, lessonTitle, lessonNumber, values })
      }
    }
    return NextResponse.json({ ok: true, rows: outputRows })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to extract table from screenshot.' }, { status: 500 })
  }
}

