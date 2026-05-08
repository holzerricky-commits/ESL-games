import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { NextResponse } from 'next/server'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'
import { slicePdfToTwoPageBytes } from '@/lib/context/slice-pdf-two-pages'
import { resolveVocabPartPdfWindow } from '@/lib/books/vocab-context-two-pages'
import { loadBookLibrary } from '@/lib/books/server'

export const runtime = 'nodejs'

function parseOptionalPageHint(raw: string | null): number | undefined {
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Returns the same two-page PDF slice used by POST /api/context/extract-context-cards-vocab,
 * for teacher preview in the class prep dialog (iframe-friendly).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const bookId = String(searchParams.get('bookId') ?? '').trim()
    const unitId = String(searchParams.get('unitId') ?? '').trim()
    const startPageHint = parseOptionalPageHint(searchParams.get('startPageHint'))
    const endPageHint = parseOptionalPageHint(searchParams.get('endPageHint'))

    if (!bookId || !unitId) {
      return NextResponse.json({ ok: false, error: 'Missing bookId or unitId.' }, { status: 400 })
    }

    const abs = await resolveUnitPdfAbsolutePath(bookId, unitId)
    if (!abs) {
      return NextResponse.json({ ok: false, error: 'Book unit PDF could not be resolved.' }, { status: 404 })
    }

    const bytes = await readFile(abs)
    const srcMeta = await PDFDocument.load(bytes)
    const totalPdfPages = srcMeta.getPageCount()

    const lib = await loadBookLibrary()
    const book = lib.books.find((b) => b.id === bookId) ?? null
    const unit = book?.units.find((u) => u.id === unitId) ?? null

    const { start, end } = resolveVocabPartPdfWindow(
      startPageHint ?? null,
      endPageHint ?? null,
      book,
      unit,
      totalPdfPages,
      'mapped',
    )
    const pdfBytes = await slicePdfToTwoPageBytes(abs, start, end)
    if (!pdfBytes?.length) {
      return NextResponse.json({ ok: false, error: 'PDF has no pages in that range.' }, { status: 404 })
    }

    const buf = Buffer.from(pdfBytes)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="vocab-two-page-window.pdf"',
        'Cache-Control': 'private, max-age=120',
        'X-Vocab-Pdf-Window-Start': String(start),
        'X-Vocab-Pdf-Window-End': String(end),
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Preview failed.' }, { status: 500 })
  }
}
