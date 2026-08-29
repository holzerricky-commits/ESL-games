import 'server-only'

import {
  parseBookExerciseGeminiDraft,
  parseBookExerciseMcqGeminiDraft,
  type BookExerciseGeminiDraft,
  type BookExerciseMcqGeminiDraft,
} from '@/lib/books/book-exercises'
import { resolveGeminiApiKey } from '@/lib/gemini'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

const WORD_BANK_SYSTEM_INSTRUCTION = `You convert ONE printed workbook exercise into a tap-to-complete word-bank activity.

The image is a crop of a single exercise. Use only what is inside the crop.

The activity type is LOCKED: word_bank. Do not choose another type. Do not invent a different activity.

Return ONLY JSON (no markdown fences) with this shape:
{
  "wordBank": ["word or short phrase", "..."],
  "items": [
    { "stem": "sentence with ___ for each gap", "answers": ["matching bank entry"] }
  ],
  "unusable": false
}

Rules:
- wordBank: every option printed in the bank / box, including extra unused words. One entry per word or short phrase. Keep the printed spelling.
- items: one per numbered question or sentence in the crop. Replace each gap with exactly ___ (three underscores). Keep the rest of the sentence as printed (fix only obvious OCR junk).
- answers: one bank word per gap, in left-to-right order. Each answer must match a wordBank entry.
- If one sentence has two gaps, use two ___ and two answers.
- Do not include instruction lines ("Complete the sentences", "There is one extra word") as items.
- Do not prefix stems with "1." / "2." unless that number is part of the sentence.
- If the crop is not a complete-from-a-word-bank / gap-fill exercise, return {"wordBank":[],"items":[],"unusable":true}.
- Do not invent sentences or bank words that are not in the crop.`

const MCQ_SYSTEM_INSTRUCTION = `You convert ONE printed workbook exercise into a choose-the-correct-answer activity.

The image is a crop of a single exercise. Use only what is inside the crop.

The activity type is LOCKED: multiple_choice. Do not choose another type. Do not invent a different activity.

Return ONLY JSON (no markdown fences) with this shape:
{
  "questions": [
    {
      "prompt": "question text as printed",
      "choices": ["choice A", "choice B"],
      "correctIndex": 0
    }
  ],
  "unusable": false
}

Rules:
- questions: one object per numbered question in the crop (circle the correct answer, multiple choice, choose the answer, etc.).
- prompt: the question stem only — not the instruction line at the top of the exercise block.
- choices: 2–4 answer options exactly as printed. Keep order A/B/C/D as shown.
- correctIndex: zero-based index of the one right choice (0 = first choice). Use the keyed / circled / bold correct answer when visible; otherwise infer only when the crop clearly marks it.
- Do not include instruction-only lines ("Choose the correct answer", "Circle the best answer") as questions.
- Do not prefix prompts with "1." / "2." unless that number is part of the question.
- If the crop is not a multiple-choice / choose-the-answer exercise, return {"questions":[],"unusable":true}.
- Do not invent questions or choices that are not in the crop.`

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed
  const first = withoutFence.indexOf('{')
  const last = withoutFence.lastIndexOf('}')
  const candidate = first >= 0 && last > first ? withoutFence.slice(first, last + 1) : withoutFence
  return JSON.parse(candidate) as unknown
}

type GeminiDraftResult<T> =
  | { ok: true; draft: T }
  | { ok: false; error: string; unusable?: boolean }

async function draftFromCropJpeg<T>(params: {
  jpegBase64: string
  userPrompt: string
  systemInstruction: string
  parseDraft: (raw: unknown) => T | null
  isUnusable: (draft: T) => boolean
  unusableError: string
}): Promise<GeminiDraftResult<T>> {
  const key = await resolveGeminiApiKey()
  if (!key) {
    return {
      ok: false,
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY, or type the exercise by hand.',
    }
  }

  const parts = [
    { text: params.userPrompt },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: params.jpegBase64,
      },
    },
  ]

  const failures: string[] = []
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: params.systemInstruction }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.15,
              responseMimeType: 'application/json',
              maxOutputTokens: 4096,
            },
          }),
        },
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 180)
        if (res.status === 429) failures.push(`${model}: rate limited`)
        else failures.push(`${model}: HTTP ${res.status}${snippet ? ` (${snippet})` : ''}`)
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
        const parsed = params.parseDraft(parseJsonFromModelText(text))
        if (!parsed) {
          failures.push(`${model}: bad JSON shape`)
          continue
        }
        if (params.isUnusable(parsed)) {
          return { ok: false, unusable: true, error: params.unusableError }
        }
        return { ok: true, draft: parsed }
      } catch {
        failures.push(`${model}: bad JSON`)
        continue
      }
    } catch (err) {
      failures.push(`${model}: ${err instanceof Error ? err.message : 'network error'}`)
    }
  }

  const rateLimited = failures.some((item) => /rate limited/i.test(item))
  return {
    ok: false,
    error: rateLimited
      ? 'Gemini is busy right now. Wait a minute and try again, or type the exercise by hand.'
      : `Could not read that box (${failures[0] ?? 'unknown error'}). Try again, or type it by hand.`,
  }
}

export async function draftBookExerciseFromCropJpeg(params: {
  jpegBase64: string
}): Promise<GeminiDraftResult<BookExerciseGeminiDraft>> {
  return draftFromCropJpeg({
    jpegBase64: params.jpegBase64,
    userPrompt: 'Read this crop of one workbook exercise. Return JSON for a word-bank task.',
    systemInstruction: WORD_BANK_SYSTEM_INSTRUCTION,
    parseDraft: parseBookExerciseGeminiDraft,
    isUnusable: (draft) => draft.unusable,
    unusableError:
      'That box does not look like a word-bank task. Recrop one complete-the-gap exercise, or type it by hand.',
  })
}

export async function draftBookExerciseMcqFromCropJpeg(params: {
  jpegBase64: string
}): Promise<GeminiDraftResult<BookExerciseMcqGeminiDraft>> {
  return draftFromCropJpeg({
    jpegBase64: params.jpegBase64,
    userPrompt: 'Read this crop of one workbook exercise. Return JSON for a choose-the-correct-answer task.',
    systemInstruction: MCQ_SYSTEM_INSTRUCTION,
    parseDraft: parseBookExerciseMcqGeminiDraft,
    isUnusable: (draft) => draft.unusable,
    unusableError:
      'That box does not look like a choose-the-answer task. Recrop one multiple-choice exercise, or type it by hand.',
  })
}
