import { NextResponse } from 'next/server'
import { getPdfTotalPages } from '@/lib/books/extract-story-pdf-text'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'

export const runtime = 'nodejs'

/** PDF page count for a unit, for callers that can't load the PDF in the browser. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const unitId = url.searchParams.get('unitId')?.trim() ?? ''
    if (!bookId || !unitId) {
      return NextResponse.json({ ok: false, error: 'bookId and unitId are required.' }, { status: 400 })
    }
    const absPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
    if (!absPath) {
      return NextResponse.json({ ok: false, error: 'Unit PDF not found.' }, { status: 404 })
    }
    const totalPdfPages = await getPdfTotalPages(absPath)
    return NextResponse.json({ ok: true, totalPdfPages })
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read the PDF.' }, { status: 500 })
  }
}
