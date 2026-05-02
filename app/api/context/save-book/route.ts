import { NextResponse } from 'next/server'
import { getContextStore } from '@/lib/context/file-store'
import { DEFAULT_BOOK_FOCUS_AREAS } from '@/lib/context/types'
import type {
  BookContextDraftRecord,
  BookContextEvidenceRecord,
  BookContextMaterialRecord,
  BookContextRecord,
} from '@/lib/context/types'
import { clampPageRange, CONTEXT_VERSION, stableId, trimList } from '@/lib/context/utils'

const BOOK_FOCUS_AREAS_DEFAULT: string[] = [...DEFAULT_BOOK_FOCUS_AREAS]

interface SaveBookInput {
  draft: BookContextDraftRecord
}

function sanitizeFocusNotesByLesson(input: unknown): Record<string, Record<string, string>> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, Record<string, string>> = {}
  for (const [lessonIdRaw, areaMapRaw] of Object.entries(input as Record<string, unknown>)) {
    const lessonId = String(lessonIdRaw ?? '').trim()
    if (!lessonId || !areaMapRaw || typeof areaMapRaw !== 'object') continue
    const areaMap: Record<string, string> = {}
    for (const [areaRaw, valueRaw] of Object.entries(areaMapRaw as Record<string, unknown>)) {
      const area = String(areaRaw ?? '').trim()
      const value = String(valueRaw ?? '').trim()
      if (!area) continue
      areaMap[area.slice(0, 80)] = value.slice(0, 2000)
    }
    if (Object.keys(areaMap).length > 0) {
      out[lessonId.slice(0, 120)] = areaMap
    }
  }
  return out
}

function parseInput(body: unknown): SaveBookInput | null {
  const src = body as Partial<SaveBookInput> | undefined
  if (!src || typeof src !== 'object') return null
  const draft = src.draft as BookContextDraftRecord | undefined
  if (!draft || typeof draft.bookId !== 'string') return null
  return { draft }
}

function sanitizeEvidence(input: unknown): BookContextEvidenceRecord[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      const src = item as Partial<BookContextEvidenceRecord> | undefined
      const field = String(src?.field ?? '').trim()
      if (
        field !== 'summary' &&
        field !== 'goals' &&
        field !== 'pacing' &&
        field !== 'instructionalPriorities'
      ) return null
      const sourceUrl = String(src?.sourceUrl ?? '').trim()
      if (!sourceUrl) return null
      const snippet = String(src?.snippet ?? '').trim()
      const confidenceRaw = String(src?.confidence ?? '').trim()
      const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium' ? confidenceRaw : 'low'
      return { field, sourceUrl, snippet, confidence } as BookContextEvidenceRecord
    })
    .filter((item): item is BookContextEvidenceRecord => !!item)
}

function sanitizeMaterials(input: unknown): BookContextMaterialRecord[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      const src = item as Partial<BookContextMaterialRecord> | undefined
      const typeRaw = String(src?.type ?? '').trim()
      const type = (
        typeRaw === 'pacing-guide' ||
        typeRaw === 'scope-sequence' ||
        typeRaw === 'teacher-edition' ||
        typeRaw === 'assessment' ||
        typeRaw === 'intervention' ||
        typeRaw === 'grammar-writing' ||
        typeRaw === 'vocabulary' ||
        typeRaw === 'digital-resource' ||
        typeRaw === 'other'
      ) ? typeRaw : 'other'
      const title = String(src?.title ?? '').trim()
      const url = String(src?.url ?? '').trim()
      if (!title || !url) return null
      const notes = String(src?.notes ?? '').trim()
      const confidenceRaw = String(src?.confidence ?? '').trim()
      const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium' ? confidenceRaw : 'low'
      return { type, title, url, notes, confidence } as BookContextMaterialRecord
    })
    .filter((item): item is BookContextMaterialRecord => !!item)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = parseInput(body)
    if (!parsed) return NextResponse.json({ ok: false, error: 'Invalid book context save payload.' }, { status: 400 })
    const now = new Date().toISOString()
    const draft = parsed.draft
    const record: BookContextRecord = {
      id: stableId(`book:${draft.bookId}`),
      kind: 'book',
      bookId: draft.bookId.trim(),
      summary: String(draft.summary ?? '').trim(),
      goals: trimList(draft.goals, 10),
      pacing: trimList(draft.pacing, 10),
      instructionalPriorities: trimList(draft.instructionalPriorities, 10),
      focusAreas: trimList(draft.focusAreas, 20).length ? trimList(draft.focusAreas, 20) : BOOK_FOCUS_AREAS_DEFAULT,
      focusNotesByLesson: sanitizeFocusNotesByLesson(draft.focusNotesByLesson),
      sourcePageRange: draft.sourcePageRange ? clampPageRange(draft.sourcePageRange) : null,
      materials: sanitizeMaterials(draft.materials),
      evidence: sanitizeEvidence(draft.evidence),
      contextVersion: CONTEXT_VERSION,
      createdAt: now,
      updatedAt: now,
    }
    const store = getContextStore()
    const existing = await store.getBookContext(record.bookId)
    if (existing) {
      record.createdAt = existing.createdAt
    }
    const saved = await store.saveBookContext(record)
    return NextResponse.json({ ok: true, context: saved })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to save book context.' }, { status: 500 })
  }
}
