import { NextResponse } from 'next/server'
import { generateLessonGrammarDraft } from '@/lib/gemini'
import { GRAMMAR_GENERATE_MAX_PAGES } from '@/lib/lesson-grammar/generate'
import { readUnitPagesText } from '@/lib/lesson-grammar/page-text-server'

export const runtime = 'nodejs'
export const maxDuration = 60

function strings(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').slice(0, max)
    : []
}

/**
 * Body: bookId, unitId, pdfPages (unit PDF pages), lessonTitle, grammarNotes?, rule?, existingSentences?.
 * Returns `{ ok, rule, items: [{ sentence, target, distractors }], pages }`.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  const bookId = String(body.bookId ?? '').trim()
  const unitId = String(body.unitId ?? '').trim()
  const pdfPages = Array.isArray(body.pdfPages)
    ? [...new Set(body.pdfPages.map((p) => Math.floor(Number(p))).filter((p) => Number.isFinite(p) && p >= 1))].slice(
        0,
        GRAMMAR_GENERATE_MAX_PAGES,
      )
    : []
  if (!bookId || !unitId || pdfPages.length === 0) {
    return NextResponse.json({ ok: false, error: 'bookId, unitId and pdfPages are required.' }, { status: 400 })
  }

  try {
    const pages = await readUnitPagesText(bookId, unitId, pdfPages)
    if (!pages) return NextResponse.json({ ok: false, error: 'Unit PDF not found.' }, { status: 404 })
    const withText = pages.filter((page) => page.text.trim())
    if (withText.length === 0) {
      return NextResponse.json(
        { ok: false, code: 'no-text', error: 'This page has no readable text.' },
        { status: 422 },
      )
    }

    const result = await generateLessonGrammarDraft({
      lessonTitle: String(body.lessonTitle ?? ''),
      pages: withText,
      grammarNotes: strings(body.grammarNotes, 8),
      rule: typeof body.rule === 'string' ? body.rule : '',
      existingSentences: strings(body.existingSentences, 60),
    })
    if (!result.ok) {
      const error =
        result.reason === 'no-key'
          ? 'AI is not set up. Add GEMINI_API_KEY to .env.local.'
          : result.reason === 'empty'
            ? 'AI did not find grammar practice on this page.'
            : 'AI is busy or unavailable. Try again in a moment.'
      return NextResponse.json(
        { ok: false, code: result.reason, error },
        { status: result.reason === 'no-key' ? 503 : 502 },
      )
    }
    return NextResponse.json({
      ok: true,
      rule: result.draft.rule,
      items: result.draft.items,
      pages: withText.map((page) => page.pdfPage),
    })
  } catch (err) {
    console.error('[lesson-grammar/generate]', err)
    return NextResponse.json({ ok: false, error: 'Could not generate grammar practice.' }, { status: 500 })
  }
}
