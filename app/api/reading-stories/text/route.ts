import { NextResponse } from 'next/server'
import { extractPdfPageRangeText, getPdfTotalPages } from '@/lib/books/extract-story-pdf-text'
import {
  extractStoryTextChunkWithGemini,
  extractStoryTextWithGemini,
  STORY_TEXT_SCAN_CHUNK_PAGES,
} from '@/lib/books/extract-story-text-gemini'
import {
  mergeStoriesForBook,
  resolveReadingStoryRange,
  type ReadingStoryMap,
  type ReadingStoryPdfRange,
} from '@/lib/books/reading-story-map'
import {
  getReadingStoryOverride,
  getReadingStoryText,
  listReadingStoryOverridesForBook,
  listReadingStoryTextsForBook,
  saveReadingStoryText,
} from '@/lib/books/reading-story-store'
import { loadBookLibrary } from '@/lib/books/server'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'
import {
  buildPlaceholderChunkForPdfPages,
  tagScannedChunkText,
} from '@/lib/books/reading-story-page-markers'

function displayLabelForPdfPage(
  pdfPage: number,
  range: ReadingStoryPdfRange,
): string {
  if (
    typeof range.startDisplayPage === 'number' &&
    typeof range.endDisplayPage === 'number' &&
    range.startPdfPage >= 1
  ) {
    const offset = pdfPage - range.startPdfPage
    const display = range.startDisplayPage + offset
    if (display >= 1) return String(display)
  }
  return String(pdfPage)
}

async function resolveScanContext(body: Record<string, unknown>): Promise<
  | {
      ok: true
      storyId: string
      bookId: string
      unitId: string
      book: BookRecord
      unit: BookUnitRecord
      story: ReadingStoryMap
      absPath: string
      range: ReadingStoryPdfRange
      totalPdfPages: number
    }
  | { ok: false; status: number; error: string }
> {
  const storyId = String(body.storyId ?? '').trim()
  const bookId = String(body.bookId ?? '').trim()
  const unitId = String(body.unitId ?? '').trim()

  if (!storyId || !bookId || !unitId) {
    return { ok: false, status: 400, error: 'storyId, bookId, and unitId are required.' }
  }

  const library = await loadBookLibrary()
  const book = library.books.find((b) => b.id === bookId)
  const unit = book?.units.find((u) => u.id === unitId)
  if (!book || !unit) {
    return { ok: false, status: 404, error: 'Book or unit not found.' }
  }

  const overrides = await listReadingStoryOverridesForBook(bookId)
  const stories = mergeStoriesForBook(bookId, overrides, book)
  const story: ReadingStoryMap =
    stories.find((s) => s.id === storyId) ??
    ({
      id: storyId,
      bookId,
      unitId,
      lessonId: typeof body.lessonId === 'string' ? body.lessonId : null,
      partId: typeof body.partId === 'string' ? body.partId : null,
      title: typeof body.title === 'string' ? body.title : 'Story',
    } satisfies ReadingStoryMap)

  const override = await getReadingStoryOverride(storyId)
  const absPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
  if (!absPath) {
    return { ok: false, status: 404, error: 'Unit PDF not found.' }
  }

  const totalPdfPages =
    typeof body.totalPdfPages === 'number' && Number.isFinite(body.totalPdfPages) && body.totalPdfPages >= 1
      ? Math.floor(body.totalPdfPages)
      : await getPdfTotalPages(absPath)

  const range = resolveReadingStoryRange(story, book, unit, totalPdfPages, override)
  if (range.source === 'none') {
    return { ok: false, status: 400, error: 'Set a page range for this story before scanning.' }
  }

  if (typeof totalPdfPages === 'number' && totalPdfPages >= 1 && range.startPdfPage > totalPdfPages) {
    return {
      ok: false,
      status: 400,
      error: `Page range maps to PDF ${range.startPdfPage}–${range.endPdfPage}, but this file only has ${totalPdfPages} pages. Check the unit PDF and page numbers (printed vs file), or paste the text.`,
    }
  }

  return {
    ok: true,
    storyId,
    bookId,
    unitId,
    book,
    unit,
    story,
    absPath,
    range,
    totalPdfPages,
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const storyId = url.searchParams.get('storyId')?.trim() ?? ''

    if (storyId) {
      const record = await getReadingStoryText(storyId)
      return NextResponse.json({ ok: true, text: record })
    }

    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId or storyId is required.' }, { status: 400 })
    }

    const texts = await listReadingStoryTextsForBook(bookId)
    return NextResponse.json({ ok: true, texts })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load story text.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const storyId = String(body.storyId ?? '').trim()
    const bookId = String(body.bookId ?? '').trim()
    const unitId = String(body.unitId ?? '').trim()
    const action = String(body.action ?? 'save').trim()

    if (!storyId || !bookId || !unitId) {
      return NextResponse.json(
        { ok: false, error: 'storyId, bookId, and unitId are required.' },
        { status: 400 },
      )
    }

    if (action === 'save') {
      const text = typeof body.text === 'string' ? body.text : ''
      const saved = await saveReadingStoryText({
        storyId,
        bookId,
        unitId,
        text,
        source: 'paste',
        startPdfPage: null,
        endPdfPage: null,
        startDisplayPage: typeof body.startDisplayPage === 'number' ? body.startDisplayPage : null,
        endDisplayPage: typeof body.endDisplayPage === 'number' ? body.endDisplayPage : null,
      })
      return NextResponse.json({ ok: true, text: saved })
    }

    if (action === 'scan-plan') {
      const ctx = await resolveScanContext(body)
      if (!ctx.ok) {
        return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
      }

      const start = Math.max(1, ctx.range.startPdfPage)
      const end = Math.max(start, Math.min(ctx.range.endPdfPage, ctx.totalPdfPages || ctx.range.endPdfPage))
      const pages = []
      for (let pdfPage = start; pdfPage <= end; pdfPage += 1) {
        pages.push({
          pdfPage,
          label: displayLabelForPdfPage(pdfPage, ctx.range),
        })
      }

      return NextResponse.json({
        ok: true,
        plan: {
          startPdfPage: start,
          endPdfPage: end,
          startDisplayPage: ctx.range.startDisplayPage,
          endDisplayPage: ctx.range.endDisplayPage,
          pageCount: pages.length,
          chunkPages: STORY_TEXT_SCAN_CHUNK_PAGES,
          pages,
        },
      })
    }

    if (action === 'scan-chunk') {
      const ctx = await resolveScanContext(body)
      if (!ctx.ok) {
        return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
      }

      const chunkStartRaw = Number(body.chunkStartPdfPage)
      const chunkEndRaw = Number(body.chunkEndPdfPage)
      if (!Number.isFinite(chunkStartRaw) || !Number.isFinite(chunkEndRaw)) {
        return NextResponse.json(
          { ok: false, error: 'chunkStartPdfPage and chunkEndPdfPage are required.' },
          { status: 400 },
        )
      }

      const rangeStart = Math.max(1, ctx.range.startPdfPage)
      const rangeEnd = Math.max(rangeStart, Math.min(ctx.range.endPdfPage, ctx.totalPdfPages || ctx.range.endPdfPage))
      const chunkStart = Math.max(rangeStart, Math.floor(chunkStartRaw))
      const chunkEnd = Math.min(rangeEnd, Math.max(chunkStart, Math.floor(chunkEndRaw)))
      const reset = body.reset === true

      let chunkText = ''
      let source: 'pdf' | 'gemini' = 'pdf'

      const pdfExtract = await extractPdfPageRangeText(ctx.absPath, chunkStart, chunkEnd)
      if (pdfExtract.text.trim()) {
        chunkText = pdfExtract.text.trim()
        source = 'pdf'
      } else {
        const gemini = await extractStoryTextChunkWithGemini(ctx.absPath, chunkStart, chunkEnd)
        if (!gemini.ok) {
          return NextResponse.json({ ok: false, error: gemini.error }, { status: 422 })
        }
        chunkText = gemini.text.trim()
        source = 'gemini'
      }

      const existing = reset ? null : await getReadingStoryText(storyId)
      const previousText = existing?.text?.trim() ?? ''
      const rangeArgs = {
        startPdfPage: ctx.range.startPdfPage,
        startDisplayPage: ctx.range.startDisplayPage,
        endDisplayPage: ctx.range.endDisplayPage,
      }
      const taggedChunk = chunkText.trim()
        ? tagScannedChunkText(chunkText, {
            chunkStartPdfPage: chunkStart,
            chunkEndPdfPage: chunkEnd,
            range: rangeArgs,
          })
        : buildPlaceholderChunkForPdfPages(chunkStart, chunkEnd, rangeArgs)
      const merged = [previousText, taggedChunk].filter(Boolean).join('\n\n').trim()

      const mergedSource =
        !reset && existing?.source === 'gemini' && source === 'pdf'
          ? 'gemini'
          : !reset && existing?.source === 'pdf' && source === 'gemini'
            ? 'gemini'
            : source

      const saved = await saveReadingStoryText({
        storyId,
        bookId,
        unitId,
        text: merged,
        source: mergedSource,
        startPdfPage: ctx.range.startPdfPage,
        endPdfPage: ctx.range.endPdfPage,
        startDisplayPage: ctx.range.startDisplayPage,
        endDisplayPage: ctx.range.endDisplayPage,
      })

      return NextResponse.json({
        ok: true,
        text: saved,
        emptyChunk: !chunkText,
        chunkStartPdfPage: chunkStart,
        chunkEndPdfPage: chunkEnd,
        source,
      })
    }

    if (action !== 'scan') {
      return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
    }

    const ctx = await resolveScanContext(body)
    if (!ctx.ok) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }

    const extracted = await extractPdfPageRangeText(
      ctx.absPath,
      ctx.range.startPdfPage,
      ctx.range.endPdfPage,
    )
    let text = extracted.text.trim()
    let source: 'pdf' | 'gemini' = 'pdf'
    let extractedPages = extracted.extractedPages
    let pageCount = extracted.pageCount

    if (!text) {
      const gemini = await extractStoryTextWithGemini(
        ctx.absPath,
        ctx.range.startPdfPage,
        ctx.range.endPdfPage,
      )
      if (!gemini.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: gemini.error,
            empty: true,
          },
          { status: 422 },
        )
      }
      text = gemini.text
      source = 'gemini'
      extractedPages = gemini.extractedPages
      pageCount = gemini.pageCount
    }

    text = tagScannedChunkText(text, {
      chunkStartPdfPage: ctx.range.startPdfPage,
      chunkEndPdfPage: ctx.range.endPdfPage,
      range: {
        startPdfPage: ctx.range.startPdfPage,
        startDisplayPage: ctx.range.startDisplayPage,
        endDisplayPage: ctx.range.endDisplayPage,
      },
    })

    const saved = await saveReadingStoryText({
      storyId,
      bookId,
      unitId,
      text,
      source,
      startPdfPage: ctx.range.startPdfPage,
      endPdfPage: ctx.range.endPdfPage,
      startDisplayPage: ctx.range.startDisplayPage,
      endDisplayPage: ctx.range.endDisplayPage,
    })

    return NextResponse.json({
      ok: true,
      text: saved,
      extractedPages,
      pageCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save story text.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
