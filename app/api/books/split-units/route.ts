import { NextResponse } from 'next/server'
import { splitStackedPdfIntoUnits } from '@/lib/books/split-stacked-pdf-server'
import type { StackedPdfCutInput } from '@/lib/books/split-stacked-pdf-ranges'

export const runtime = 'nodejs'

/**
 * Cut a stacked (concatenated) unit PDF into one file per unit on disk.
 * Body: { bookId, sourceFilePath, cuts: [{ title, startPage }] }
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const bookId = typeof record?.bookId === 'string' ? record.bookId.trim() : ''
  const sourceFilePath =
    typeof record?.sourceFilePath === 'string' ? record.sourceFilePath.trim() : ''
  const rawCuts = Array.isArray(record?.cuts) ? record.cuts : null

  if (!bookId) {
    return NextResponse.json({ error: 'bookId is required.' }, { status: 400 })
  }
  if (!sourceFilePath) {
    return NextResponse.json({ error: 'sourceFilePath is required.' }, { status: 400 })
  }
  if (!rawCuts) {
    return NextResponse.json({ error: 'cuts must be an array.' }, { status: 400 })
  }

  const cuts: StackedPdfCutInput[] = []
  for (const entry of rawCuts) {
    if (!entry || typeof entry !== 'object') {
      return NextResponse.json({ error: 'Each cut must be an object.' }, { status: 400 })
    }
    const row = entry as Record<string, unknown>
    const title = typeof row.title === 'string' ? row.title : ''
    const startPage = typeof row.startPage === 'number' ? row.startPage : Number(row.startPage)
    if (!Number.isFinite(startPage)) {
      return NextResponse.json({ error: 'Each cut needs a numeric startPage.' }, { status: 400 })
    }
    cuts.push({ title, startPage })
  }

  try {
    const result = await splitStackedPdfIntoUnits({ bookId, sourceFilePath, cuts })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      library: result.library,
      bookId: result.bookId,
      units: result.units,
      sourceArchivedPath: result.sourceArchivedPath,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Split failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
