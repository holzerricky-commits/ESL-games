import { NextResponse } from 'next/server'
import { getVocabularyStore } from '@/lib/vocabulary/file-store'
import { generateVocabularySet } from '@/lib/vocabulary/generate-from-pages'
import type { VocabularySourceContext } from '@/lib/vocabulary/types'

const REQUEST_COOLDOWN_MS = 1500
const requestCooldown = new Map<string, number>()

function getClientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  return forwarded.split(',')[0]?.trim() || 'local'
}

function parseContext(body: unknown): VocabularySourceContext | null {
  const src = body as Partial<VocabularySourceContext> | undefined
  const startPage = Number(src?.pageRange?.startPage)
  const endPage = Number(src?.pageRange?.endPage)
  if (!src) return null
  if (
    typeof src.studentId !== 'string' ||
    typeof src.classId !== 'string' ||
    typeof src.classTitle !== 'string' ||
    typeof src.bookId !== 'string' ||
    typeof src.unitId !== 'string'
  ) {
    return null
  }
  if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) return null
  return {
    studentId: src.studentId.trim(),
    classId: src.classId.trim(),
    classTitle: src.classTitle.trim(),
    bookId: src.bookId.trim(),
    unitId: src.unitId.trim(),
    sectionId: typeof src.sectionId === 'string' ? src.sectionId.trim() : undefined,
    sectionTitle: typeof src.sectionTitle === 'string' ? src.sectionTitle.trim() : undefined,
    pageRange: {
      startPage: Math.max(1, Math.floor(startPage)),
      endPage: Math.max(1, Math.floor(endPage)),
    },
  }
}

export async function POST(req: Request) {
  try {
    const now = Date.now()
    const key = getClientKey(req)
    const last = requestCooldown.get(key) ?? 0
    if (now - last < REQUEST_COOLDOWN_MS) {
      return NextResponse.json({ ok: false, error: 'Please wait a moment before generating again.' }, { status: 429 })
    }
    requestCooldown.set(key, now)

    const body = await req.json()
    const context = parseContext(body?.context)
    if (!context) {
      return NextResponse.json({ ok: false, error: 'Invalid generation context.' }, { status: 400 })
    }
    const requestedCount = Number(body?.requestedCount ?? 12)
    const seedWords = Array.isArray(body?.seedWords) ? body.seedWords.map(String) : []

    const store = getVocabularyStore()
    const generated = await generateVocabularySet({ context, requestedCount, seedWords })
    const saved = await store.saveDraftSet(generated)
    return NextResponse.json({ ok: true, set: saved })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to generate vocabulary set.' }, { status: 500 })
  }
}
