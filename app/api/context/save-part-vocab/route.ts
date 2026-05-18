import { NextResponse } from 'next/server'
import { getContextStore } from '@/lib/context/file-store'
import type { ContextPageRange, PartContextRecord, PartContextVocabularyWord } from '@/lib/context/types'
import { clampPageRange, CONTEXT_VERSION, stableId } from '@/lib/context/utils'

interface SavePartVocabBody {
  bookId?: string
  unitId?: string
  lessonId?: string
  partId?: string
  partTitle?: string
  words?: unknown
  sourcePageRange?: unknown
}

function sanitizeWords(input: unknown): PartContextVocabularyWord[] {
  if (!Array.isArray(input)) return []
  const out: PartContextVocabularyWord[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const id = String(o.id ?? '').trim().slice(0, 80)
    const word = String(o.word ?? '').trim().slice(0, 120)
    const definition = String(o.definition ?? '').trim().slice(0, 2000)
    const examplesRaw = o.examples
    const examples = Array.isArray(examplesRaw)
      ? examplesRaw
          .map((e) => String(e ?? '').trim())
          .filter(Boolean)
          .slice(0, 12)
          .map((e) => e.slice(0, 2000))
      : []
    if (!word) continue
    out.push({
      id: id || word.toLowerCase().replace(/\s+/g, '-').slice(0, 80),
      word,
      definition,
      examples,
    })
    if (out.length >= 40) break
  }
  return out
}

function parsePageRange(input: unknown): ContextPageRange | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  const start = Math.max(1, Math.floor(Number(o.startPage)))
  const end = Math.max(1, Math.floor(Number(o.endPage)))
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return clampPageRange({ startPage: start, endPage: end })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SavePartVocabBody
    const bookId = String(body.bookId ?? '').trim()
    const unitId = String(body.unitId ?? '').trim()
    const lessonId = String(body.lessonId ?? '').trim()
    const partId = String(body.partId ?? '').trim()
    if (!bookId || !unitId || !lessonId || !partId) {
      return NextResponse.json({ ok: false, error: 'bookId, unitId, lessonId, and partId are required.' }, { status: 400 })
    }
    if (!Array.isArray(body.words)) {
      return NextResponse.json({ ok: false, error: 'words must be an array.' }, { status: 400 })
    }
    const words = sanitizeWords(body.words)
    const partTitleRaw = String(body.partTitle ?? '').trim().slice(0, 500)
    const incomingRange = parsePageRange(body.sourcePageRange)
    const fallbackRange = clampPageRange({ startPage: 1, endPage: 1 })
    const store = getContextStore()
    const existing = await store.getPartContext(bookId, unitId, lessonId, partId)
    const now = new Date().toISOString()
    const id = stableId(`part:${bookId}:${unitId}:${lessonId}:${partId}`)
    const partTitle = partTitleRaw || existing?.partTitle
    const sourcePageRange = incomingRange ?? existing?.sourcePageRange ?? fallbackRange
    const record: PartContextRecord = {
      id,
      kind: 'part',
      bookId,
      unitId,
      lessonId,
      partId,
      ...(partTitle ? { partTitle } : {}),
      partGoals: existing?.partGoals ?? [],
      activityNotes: existing?.activityNotes ?? [],
      languageFocus: existing?.languageFocus ?? { grammarNotes: [], writingNotes: [] },
      sourcePageRange,
      scanProfile: existing?.scanProfile ?? 'balanced',
      contextVersion: CONTEXT_VERSION,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      interactiveVocabulary: words,
    }
    const saved = await store.savePartContext(record)
    return NextResponse.json({ ok: true, context: saved })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to save vocabulary.' }, { status: 500 })
  }
}
