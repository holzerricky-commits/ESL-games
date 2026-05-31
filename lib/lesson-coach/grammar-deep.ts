import 'server-only'

import { z } from 'zod'
import { resolveGeminiApiKeyFromEnv } from '@/lib/gemini-api-key'
import type { GrammarIssue } from '@/lib/lesson-coach/types'
import { deepDraftsToIssues, type DeepIssueDraft } from '@/lib/lesson-coach/grammar-merge'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

const deepResponseSchema = z.object({
  issues: z
    .array(
      z.object({
        match: z.string().min(1).max(300),
        type: z.string().max(64),
        message: z.string().max(500),
        suggestion: z.string().max(500).optional(),
        explanation: z.string().max(2000).optional(),
      }),
    )
    .max(15),
})

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

function buildPrompt(studentText: string): string {
  return [
    'You are an ESL writing coach reviewing a student sentence typed verbatim by a teacher.',
    'Find grammar, article (a/an/the), word order, and punctuation problems suitable for a "find the mistake" classroom game.',
    'Return JSON only with this shape:',
    '{"issues":[{"match":"exact substring from the student text","type":"article|word-order|punctuation|verb|other","message":"short label for teacher","suggestion":"corrected phrase for that span","explanation":"1-2 simple sentences for the teacher"}]}',
    'Rules:',
    '- "match" MUST be copied exactly from the student text (same spelling and spaces).',
    '- Prefer 1–8 issues, highest teaching value first.',
    '- Do not rewrite the whole sentence; only flag clear mistakes.',
    '- Explanations are for the teacher only (plain English).',
    '',
    'Student text:',
    studentText,
  ].join('\n')
}

async function callGeminiGrammar(key: string, prompt: string): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: 'You analyze ESL student writing and return strict JSON only. Never change the student text.',
                },
              ],
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              maxOutputTokens: 2048,
            },
          }),
        },
      )
      if (!res.ok) continue
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (text) return text
    } catch {
      continue
    }
  }
  return null
}

/** AI grammar pass (Phase 7) — articles, structure, richer errors. Server-only. */
export async function analyzeTextDeep(text: string): Promise<{
  issues: GrammarIssue[]
  error?: string
}> {
  const trimmed = text.trim()
  if (!trimmed) return { issues: [] }
  if (trimmed.length > 8_000) {
    return { issues: [], error: 'Text is too long for deep check (max 8000 characters).' }
  }

  const key = await resolveGeminiApiKeyFromEnv()
  if (!key) {
    return { issues: [], error: 'Gemini API key is not configured. Use quick check or add GEMINI_API_KEY.' }
  }

  const raw = await callGeminiGrammar(key, buildPrompt(trimmed))
  if (!raw) {
    return { issues: [], error: 'Deep grammar check failed. Try again or use quick check.' }
  }

  let parsed: z.infer<typeof deepResponseSchema>
  try {
    parsed = deepResponseSchema.parse(parseJsonFromModelText(raw))
  } catch {
    return { issues: [], error: 'Could not parse grammar results. Try quick check.' }
  }

  const drafts: DeepIssueDraft[] = parsed.issues.map((row) => ({
    match: row.match,
    type: row.type,
    message: row.message,
    suggestion: row.suggestion,
    explanation: row.explanation,
  }))

  return { issues: deepDraftsToIssues(trimmed, drafts) }
}
