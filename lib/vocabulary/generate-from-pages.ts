import { resolveGeminiApiKey } from '@/lib/gemini'
import type { VocabularyEntry, VocabularyGenerationInput, VocabularySet } from '@/lib/vocabulary/types'
import { createStableId, normalizeWord } from '@/lib/vocabulary/utils'

const GENERATION_VERSION = 'v1'
const DEFAULT_WORD_COUNT = 12
const MAX_WORD_COUNT = 24

interface ModelWordPayload {
  words?: Array<{
    word?: string
    lemma?: string
    definition?: string
    examples?: string[]
    synonyms?: string[]
    antonyms?: string[]
    sourcePage?: number | null
  }>
}

const VOCAB_SYSTEM_PROMPT = `You generate ESL vocabulary cards for kids age 8-14.
Return JSON only with shape:
{
  "words": [
    {
      "word": "...",
      "lemma": "...",
      "definition": "...",
      "examples": ["...", "..."],
      "synonyms": ["..."],
      "antonyms": ["..."],
      "sourcePage": 1
    }
  ]
}

Rules:
- Keep definitions short and simple.
- Provide 2 examples per word.
- Prefer concrete, teachable words.
- sourcePage must be between selected start and end page.
- Output plain ASCII text.
`

const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

function parseModelPayload(text: string): ModelWordPayload | null {
  const trimmed = text.trim()
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed
  try {
    const parsed = JSON.parse(jsonText) as ModelWordPayload
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function sanitizeEntries(input: ModelWordPayload['words'], minPage: number, maxPage: number, requestedCount: number): VocabularyEntry[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const entries: VocabularyEntry[] = []
  for (const raw of input) {
    const word = normalizeWord(String(raw?.word ?? ''))
    const lemma = normalizeWord(String(raw?.lemma ?? word))
    const definition = String(raw?.definition ?? '').trim()
    if (!word || !lemma || !definition) continue
    if (seen.has(lemma)) continue
    seen.add(lemma)
    const examples = Array.isArray(raw?.examples) ? raw.examples.map((line) => String(line).trim()).filter(Boolean).slice(0, 3) : []
    const synonyms = Array.isArray(raw?.synonyms) ? raw.synonyms.map((line) => normalizeWord(String(line))).filter(Boolean).slice(0, 8) : []
    const antonyms = Array.isArray(raw?.antonyms) ? raw.antonyms.map((line) => normalizeWord(String(line))).filter(Boolean).slice(0, 8) : []
    const pageValue = Number(raw?.sourcePage)
    const sourcePage = Number.isFinite(pageValue) ? Math.max(minPage, Math.min(maxPage, Math.floor(pageValue))) : null
    const now = new Date().toISOString()
    entries.push({
      id: createStableId(`${lemma}:${minPage}:${maxPage}`),
      word,
      lemma,
      definition,
      examples,
      synonyms,
      antonyms,
      sourcePage,
      approved: false,
      updatedAt: now,
    })
    if (entries.length >= requestedCount) break
  }
  return entries
}

async function runGeminiPrompt(prompt: string): Promise<string | null> {
  const apiKey = await resolveGeminiApiKey()
  if (!apiKey) return null
  for (const model of MODEL_CANDIDATES) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VOCAB_SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            responseMimeType: 'application/json',
            maxOutputTokens: 4096,
          },
        }),
      },
    )
    if (!res.ok) continue
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text === 'string' && text.trim()) return text.trim()
  }
  return null
}

function buildFallbackEntries(input: VocabularyGenerationInput, count: number): VocabularyEntry[] {
  const words = Array.from(new Set((input.seedWords ?? []).map((item) => normalizeWord(item)).filter(Boolean)))
  const now = new Date().toISOString()
  const out: VocabularyEntry[] = []
  for (const word of words) {
    out.push({
      id: createStableId(`${word}:${input.context.classId}`),
      word,
      lemma: word,
      definition: `A useful word from ${input.context.classTitle}.`,
      examples: [`I can use "${word}" in this lesson.`],
      synonyms: [],
      antonyms: [],
      sourcePage: input.context.pageRange.startPage,
      approved: false,
      updatedAt: now,
    })
    if (out.length >= count) break
  }
  return out
}

export async function generateVocabularySet(input: VocabularyGenerationInput): Promise<VocabularySet> {
  const requestedCount = Math.max(4, Math.min(MAX_WORD_COUNT, Math.floor(input.requestedCount ?? DEFAULT_WORD_COUNT)))
  const minPage = Math.max(1, input.context.pageRange.startPage)
  const maxPage = Math.max(minPage, input.context.pageRange.endPage)
  const prompt = [
    `Class title: ${input.context.classTitle}`,
    `Book: ${input.context.bookId}`,
    `Unit: ${input.context.unitId}`,
    `Section: ${input.context.sectionTitle ?? 'selected pages'}`,
    `Pages: ${minPage}-${maxPage}`,
    `Need ${requestedCount} words.`,
    `Candidate words: ${(input.seedWords ?? []).join(', ') || 'none provided'}`,
  ].join('\n')

  let entries: VocabularyEntry[] = []
  const text = await runGeminiPrompt(prompt)
  if (text) {
    const parsed = parseModelPayload(text)
    entries = sanitizeEntries(parsed?.words, minPage, maxPage, requestedCount)
  }
  if (entries.length === 0) {
    entries = buildFallbackEntries(input, requestedCount)
  }

  const now = new Date().toISOString()
  const setId = createStableId(
    `${input.context.studentId}:${input.context.classId}:${input.context.bookId}:${input.context.unitId}:${minPage}:${maxPage}:${Date.now()}`,
  )

  return {
    id: setId,
    status: 'draft',
    context: {
      ...input.context,
      pageRange: { startPage: minPage, endPage: maxPage },
    },
    entries,
    generationVersion: GENERATION_VERSION,
    createdAt: now,
    updatedAt: now,
  }
}
