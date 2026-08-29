import { NextResponse } from 'next/server'
import { getPdfTotalPages } from '@/lib/books/extract-story-pdf-text'
import {
  mergeStoriesForBook,
  resolveReadingStoryRange,
  type ReadingStoryMap,
} from '@/lib/books/reading-story-map'
import { getReadingStoryOverride, listReadingStoryOverridesForBook } from '@/lib/books/reading-story-store'
import { loadBookLibrary } from '@/lib/books/server'
import {
  planSearchablePdfPages,
  stampSearchablePdfPage,
} from '@/lib/books/searchable-pdf-build'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'

export const runtime = 'nodejs'
export const maxDuration = 120

async function resolveUnitPdf(body: Record<string, unknown>) {
  const bookId = String(body.bookId ?? '').trim()
  const unitId = String(body.unitId ?? '').trim()
  if (!bookId || !unitId) {
    return { ok: false as const, status: 400, error: 'bookId and unitId are required.' }
  }

  const library = await loadBookLibrary()
  const book = library.books.find((b) => b.id === bookId)
  const unit = book?.units.find((u) => u.id === unitId)
  if (!book || !unit) {
    return { ok: false as const, status: 404, error: 'Book or unit not found.' }
  }

  const absPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
  if (!absPath) {
    return { ok: false as const, status: 404, error: 'Unit PDF not found.' }
  }

  return {
    ok: true as const,
    bookId,
    unitId,
    book,
    unit,
    absPath,
    filePath: unit.filePath,
  }
}

async function resolveStoryRange(
  body: Record<string, unknown>,
  ctx: Extract<Awaited<ReturnType<typeof resolveUnitPdf>>, { ok: true }>,
) {
  const storyId = String(body.storyId ?? '').trim()
  if (!storyId) {
    return { ok: false as const, status: 400, error: 'storyId is required to plan from a story.' }
  }

  const totalPdfPages =
    typeof body.totalPdfPages === 'number' && Number.isFinite(body.totalPdfPages) && body.totalPdfPages >= 1
      ? Math.floor(body.totalPdfPages)
      : await getPdfTotalPages(ctx.absPath)

  const overrides = await listReadingStoryOverridesForBook(ctx.bookId)
  const stories = mergeStoriesForBook(ctx.bookId, overrides, ctx.book)
  const story: ReadingStoryMap =
    stories.find((s) => s.id === storyId) ??
    ({
      id: storyId,
      bookId: ctx.bookId,
      unitId: ctx.unitId,
      lessonId: typeof body.lessonId === 'string' ? body.lessonId : null,
      partId: typeof body.partId === 'string' ? body.partId : null,
      title: typeof body.title === 'string' ? body.title : 'Story',
    } satisfies ReadingStoryMap)

  const override = await getReadingStoryOverride(storyId)
  const range = resolveReadingStoryRange(story, ctx.book, ctx.unit, totalPdfPages, override)
  if (range.source === 'none') {
    return { ok: false as const, status: 400, error: 'Set a page range for this story first.' }
  }

  return {
    ok: true as const,
    startPdfPage: range.startPdfPage,
    endPdfPage: range.endPdfPage,
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? '').trim()
    const ctx = await resolveUnitPdf(body)
    if (!ctx.ok) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    if (action === 'plan') {
      let startPdfPage = Math.floor(Number(body.startPdfPage))
      let endPdfPage = Math.floor(Number(body.endPdfPage))
      if (!Number.isFinite(startPdfPage) || !Number.isFinite(endPdfPage)) {
        const range = await resolveStoryRange(body, ctx)
        if (!range.ok) {
          return NextResponse.json({ ok: false, error: range.error }, { status: range.status })
        }
        startPdfPage = range.startPdfPage
        endPdfPage = range.endPdfPage
      }
      if (startPdfPage < 1 || endPdfPage < startPdfPage) {
        return NextResponse.json({ ok: false, error: 'Invalid page range.' }, { status: 400 })
      }
      const pages = await planSearchablePdfPages(ctx.absPath, startPdfPage, endPdfPage)
      return NextResponse.json({
        ok: true,
        filePath: ctx.filePath,
        startPdfPage,
        endPdfPage,
        pages,
        needsOcr: pages.filter((p) => p.action === 'ocr').length,
      })
    }

    if (action === 'page') {
      const pdfPage = Math.floor(Number(body.pdfPage))
      if (!Number.isFinite(pdfPage) || pdfPage < 1) {
        return NextResponse.json({ ok: false, error: 'pdfPage is required.' }, { status: 400 })
      }
      const result = await stampSearchablePdfPage(ctx.absPath, pdfPage)
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error, pdfPage: result.pdfPage }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        filePath: ctx.filePath,
        ...result,
      })
    }

    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    const detail = err instanceof Error ? err.message : ''
    console.error('[searchable-text]', err)
    return NextResponse.json(
      {
        ok: false,
        error: detail.includes('InvalidArg') || detail.includes('Path2D')
          ? 'Could not read this page picture.'
          : 'Could not make these pages selectable.',
      },
      { status: 500 },
    )
  }
}
