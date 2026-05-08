import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { loadBookLibrary } from '@/lib/books/server'
import { resolveVocabPartPdfWindow } from '@/lib/books/vocab-context-two-pages'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'
import { slicePdfToTwoPageBytes } from '@/lib/context/slice-pdf-two-pages'
import { resolveGeminiApiKey } from '@/lib/gemini'
import type { PartContextVocabularyWord } from '@/lib/context/types'
import {
  CONTEXT_CARDS_VOCAB_SYSTEM_INSTRUCTION,
  buildContextCardsVocabUserMessage,
} from '@/lib/prompts/context-cards-vocab-extraction'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

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

function examplesFromRow(w: Record<string, unknown>): string[] {
  if (Array.isArray(w.examples)) {
    return w.examples.map((x) => String(x).trim()).filter(Boolean)
  }
  for (const key of ['example', 'sentence', 'contextSentence', 'context']) {
    const v = w[key]
    if (typeof v === 'string' && v.trim()) return [v.trim()]
  }
  return []
}

/** Books often show word + context sentence only; fill definition from example when the model omits it. */
function definitionFromExampleFallback(word: string, firstExample: string): string {
  const ex = firstExample.trim()
  if (!ex) return `Vocabulary: ${word}`
  if (ex.length <= 220) return ex
  return `${ex.slice(0, 217).trimEnd()}…`
}

function sanitizeWords(parsed: unknown): PartContextVocabularyWord[] {
  if (!parsed || typeof parsed !== 'object') return []
  const words = (parsed as { words?: unknown }).words
  if (!Array.isArray(words)) return []
  const out: PartContextVocabularyWord[] = []
  let auto = 0
  for (const row of words) {
    if (!row || typeof row !== 'object') continue
    const w = row as Record<string, unknown>
    const word = String(w.word ?? '').trim()
    if (!word) continue
    const examples = examplesFromRow(w)
    let definition = String(w.definition ?? w.meaning ?? w.gloss ?? '').trim()
    if (!definition && examples.length > 0) {
      definition = definitionFromExampleFallback(word, examples[0]!)
    }
    if (!definition) continue
    const idRaw = String(w.id ?? '').trim()
    const id = idRaw || `cc-${++auto}`
    out.push({ id, word, definition, examples })
  }
  return out
}

async function callGeminiWithPdf(
  userText: string,
  pdfBytes: Uint8Array,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = await resolveGeminiApiKey()
  if (!key) return { ok: false, error: 'Gemini API key is not configured.' }
  const base64 = Buffer.from(pdfBytes).toString('base64')
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: CONTEXT_CARDS_VOCAB_SYSTEM_INSTRUCTION }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: userText },
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.15,
              responseMimeType: 'application/json',
              maxOutputTokens: 8192,
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
  return { ok: false, error: 'Gemini could not read this PDF. Try again or edit the list manually.' }
}

export async function extractContextCardsVocabularyFromPdf(params: {
  bookId: string
  unitId: string
  lessonId: string
  partId: string
  partTitle?: string
  sectionPath: string
  startPageHint?: number | null
  endPageHint?: number | null
}): Promise<
  | { ok: true; words: PartContextVocabularyWord[]; pdfWindow: { start: number; end: number } }
  | { ok: false; error: string }
> {
  const abs = await resolveUnitPdfAbsolutePath(params.bookId, params.unitId)
  if (!abs) return { ok: false, error: 'Book unit PDF could not be resolved.' }

  const bytes = await readFile(abs)
  const srcMeta = await PDFDocument.load(bytes)
  const totalPdfPages = srcMeta.getPageCount()

  const lib = await loadBookLibrary()
  const book = lib.books.find((b) => b.id === params.bookId) ?? null
  const unit = book?.units.find((u) => u.id === params.unitId) ?? null

  const { start, end } = resolveVocabPartPdfWindow(
    params.startPageHint,
    params.endPageHint,
    book,
    unit,
    totalPdfPages,
    'mapped',
  )
  const pdfBytes = await slicePdfToTwoPageBytes(abs, start, end)
  if (!pdfBytes?.length) return { ok: false, error: 'PDF has no pages in that range.' }

  const pageRangeLabel = `PDF pages ${start}–${end} (1-based, inclusive). The attachment contains ONLY these pages.`
  const userText =
    buildContextCardsVocabUserMessage({
      sectionPath: params.sectionPath,
      pageRangeLabel,
      teacherNotes: params.partTitle ? `Part title: ${params.partTitle}` : undefined,
    }) +
    '\n\nThe attached PDF is exactly this two-page window. Read the spread and extract numbered Context Cards and TARGET VOCABULARY as instructed.'

  const gem = await callGeminiWithPdf(userText, pdfBytes)
  if (!gem.ok) return { ok: false, error: gem.error }
  try {
    const parsed = parseJsonFromModelText(gem.text)
    const words = sanitizeWords(parsed)
    if (!words.length) return { ok: false, error: 'No vocabulary rows were found on these pages.' }
    return { ok: true, words, pdfWindow: { start, end } }
  } catch {
    return { ok: false, error: 'Could not parse model response. Try again.' }
  }
}
