import { NextResponse } from 'next/server'
import { extractContextCardsVocabularyFromPdf } from '@/lib/context/extract-context-cards-vocab'

export const runtime = 'nodejs'

const COOLDOWN_MS = 2000
const lastByIp = new Map<string, number>()

function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  return forwarded.split(',')[0]?.trim() || 'local'
}

export async function POST(req: Request) {
  try {
    const now = Date.now()
    const key = clientKey(req)
    const prev = lastByIp.get(key) ?? 0
    if (now - prev < COOLDOWN_MS) {
      return NextResponse.json({ ok: false, error: 'Please wait a moment before extracting again.' }, { status: 429 })
    }
    lastByIp.set(key, now)

    const body = (await req.json()) as Record<string, unknown>
    const bookId = String(body.bookId ?? '').trim()
    const unitId = String(body.unitId ?? '').trim()
    const lessonId = String(body.lessonId ?? '').trim()
    const partId = String(body.partId ?? '').trim()
    const sectionPath = String(body.sectionPath ?? '').trim()
    const partTitle = typeof body.partTitle === 'string' ? body.partTitle.trim() : undefined
    const startPageHint = typeof body.startPageHint === 'number' ? body.startPageHint : undefined
    const endPageHint = typeof body.endPageHint === 'number' ? body.endPageHint : undefined

    if (!bookId || !unitId || !lessonId || !partId || !sectionPath) {
      return NextResponse.json({ ok: false, error: 'Missing bookId, unitId, lessonId, partId, or sectionPath.' }, { status: 400 })
    }

    const result = await extractContextCardsVocabularyFromPdf({
      bookId,
      unitId,
      lessonId,
      partId,
      partTitle,
      sectionPath,
      startPageHint,
      endPageHint,
    })
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 })
    }
    return NextResponse.json({
      ok: true,
      words: result.words,
      pdfWindow: result.pdfWindow,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Extraction failed.' }, { status: 500 })
  }
}
