import { NextResponse } from 'next/server'
import { scanBookContextDraft } from '@/lib/context/scan-service'
import type { BookContextScanInput } from '@/lib/context/types'

const REQUEST_COOLDOWN_MS = 1500
const cooldown = new Map<string, number>()

function clientKey(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') ?? ''
  return xf.split(',')[0]?.trim() || 'local'
}

function parseInput(body: unknown): BookContextScanInput | null {
  const src = body as Partial<BookContextScanInput> | undefined
  if (!src || typeof src.bookId !== 'string') return null
  const sourcePageRange = src.sourcePageRange
    ? {
      startPage: Number(src.sourcePageRange.startPage),
      endPage: Number(src.sourcePageRange.endPage),
    }
    : null
  if (sourcePageRange && (!Number.isFinite(sourcePageRange.startPage) || !Number.isFinite(sourcePageRange.endPage))) {
    return null
  }
  return {
    bookId: src.bookId.trim(),
    bookTitle: typeof src.bookTitle === 'string' ? src.bookTitle.trim() : undefined,
    bookDescription: typeof src.bookDescription === 'string' ? src.bookDescription.trim() : undefined,
    gradeHint: typeof src.gradeHint === 'string' ? src.gradeHint.trim() : undefined,
    versionHints: Array.isArray(src.versionHints)
      ? src.versionHints.map((v) => String(v ?? '').trim()).filter(Boolean).slice(0, 8)
      : undefined,
    materialTypes: Array.isArray(src.materialTypes)
      ? src.materialTypes
          .map((v) => String(v ?? '').trim())
          .filter((v) =>
            v === 'pacing-guide' ||
            v === 'scope-sequence' ||
            v === 'teacher-edition' ||
            v === 'assessment' ||
            v === 'intervention' ||
            v === 'grammar-writing' ||
            v === 'vocabulary' ||
            v === 'digital-resource' ||
            v === 'other',
          )
          .slice(0, 9) as BookContextScanInput['materialTypes']
      : undefined,
    searchMode: src.searchMode === 'broad' ? 'broad' : 'official-first',
    downloadableOnly: Boolean(src.downloadableOnly),
    maxResults: Number.isFinite(Number(src.maxResults)) ? Math.max(4, Math.min(20, Math.floor(Number(src.maxResults)))) : undefined,
    queryOverride: typeof src.queryOverride === 'string' ? src.queryOverride.trim() : undefined,
    sourcePageRange,
    scanProfile: src.scanProfile,
  }
}

export async function POST(req: Request) {
  try {
    const key = clientKey(req)
    const now = Date.now()
    const last = cooldown.get(key) ?? 0
    if (now - last < REQUEST_COOLDOWN_MS) {
      return NextResponse.json({ ok: false, error: 'Please wait before scanning again.' }, { status: 429 })
    }
    cooldown.set(key, now)
    const body = await req.json()
    const input = parseInput(body)
    if (!input) return NextResponse.json({ ok: false, error: 'Invalid book scan input.' }, { status: 400 })
    const draft = await scanBookContextDraft(input)
    return NextResponse.json({ ok: true, draft })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan book context.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
