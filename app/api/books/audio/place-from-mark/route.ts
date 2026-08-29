import { NextResponse } from 'next/server'
import {
  LISTENING_MARK_SCAN_CHUNK_PAGES,
  hasAudioPinOnPage,
  matchTrackByListeningLabel,
  type ListeningMarkScanChunkPlan,
  type ListeningMarkScanPlan,
} from '@/lib/books/book-audio'
import {
  createBookAudioPinsBatch,
  listBookAudioPins,
  listBookAudioTracks,
  readListeningMarkBytes,
} from '@/lib/books/book-audio-server'
import { findListeningMarksWithGemini } from '@/lib/books/find-listening-marks-gemini'
import type { ListeningMarkHitSample } from '@/lib/books/listening-mark-hits'
import { renderPdfPageToJpegBuffer } from '@/lib/books/generate-book-cover-server'
import { getPdfTotalPages } from '@/lib/books/extract-story-pdf-text'
import { loadBookLibrary } from '@/lib/books/server'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'

export const runtime = 'nodejs'
/** Long books + Gemini; allow generous time for a chunk. */
export const maxDuration = 120

/** Page render width for mark detection (sharper than cover thumbs). */
const SCAN_PAGE_JPEG_WIDTH = 1024
const SCAN_PAGE_JPEG_QUALITY = 0.85

async function buildPlan(
  bookId: string,
  unitIdFilter: string | null,
  skipPagesWithPins: boolean,
): Promise<
  | { ok: true; plan: ListeningMarkScanPlan }
  | { ok: false; status: number; error: string }
> {
  const library = await loadBookLibrary()
  const book = library.books.find((b) => b.id === bookId)
  if (!book) return { ok: false, status: 404, error: 'Book not found.' }

  const units = unitIdFilter
    ? book.units.filter((u) => u.id === unitIdFilter)
    : book.units.filter((u) => Boolean(u.filePath?.trim()))

  if (!units.length) {
    return {
      ok: false,
      status: 400,
      error: unitIdFilter ? 'That unit was not found.' : 'This book has no PDF units to scan.',
    }
  }

  const mark = await readListeningMarkBytes(bookId)
  if (mark && 'error' in mark) {
    return { ok: false, status: mark.status, error: mark.error }
  }
  if (!mark) {
    return {
      ok: false,
      status: 400,
      error: 'Upload a crop of the listening mark first.',
    }
  }

  const tracks = await listBookAudioTracks(bookId)
  if (!tracks?.length) {
    return {
      ok: false,
      status: 400,
      error: 'Upload listening tracks first so numbers can match files.',
    }
  }

  const pinnedPages = new Set<string>()
  if (skipPagesWithPins) {
    const pins = (await listBookAudioPins(bookId, unitIdFilter)) ?? []
    for (const pin of pins) {
      pinnedPages.add(`${pin.unitId}::${pin.pdfPage}`)
    }
  }

  const chunks: ListeningMarkScanChunkPlan[] = []
  let totalPages = 0
  let skippedPages = 0
  const chunkSize = LISTENING_MARK_SCAN_CHUNK_PAGES

  for (const unit of units) {
    const absPath = await resolveUnitPdfAbsolutePath(bookId, unit.id)
    if (!absPath) continue
    let pageCount = 0
    try {
      pageCount = await getPdfTotalPages(absPath)
    } catch {
      continue
    }
    if (pageCount < 1) continue
    totalPages += pageCount

    const pagesToScan: number[] = []
    for (let p = 1; p <= pageCount; p += 1) {
      if (skipPagesWithPins && pinnedPages.has(`${unit.id}::${p}`)) {
        skippedPages += 1
        continue
      }
      pagesToScan.push(p)
    }

    for (let i = 0; i < pagesToScan.length; ) {
      const start = pagesToScan[i]!
      const next = pagesToScan[i + 1]
      if (chunkSize >= 2 && next === start + 1) {
        chunks.push({
          chunkIndex: chunks.length,
          unitId: unit.id,
          unitTitle: unit.title || unit.id,
          pdfPageStart: start,
          pdfPageEnd: next,
        })
        i += 2
      } else {
        chunks.push({
          chunkIndex: chunks.length,
          unitId: unit.id,
          unitTitle: unit.title || unit.id,
          pdfPageStart: start,
          pdfPageEnd: start,
        })
        i += 1
      }
    }
  }

  if (!chunks.length) {
    if (skipPagesWithPins && skippedPages > 0) {
      return {
        ok: false,
        status: 400,
        error:
          'Every page in this range already has a speaker. Turn off “Skip pages with speakers” to re-check them, or clear and redo.',
      }
    }
    return { ok: false, status: 400, error: 'Could not open any unit PDFs to scan.' }
  }

  return {
    ok: true,
    plan: {
      bookId,
      chunkPages: chunkSize,
      totalPages,
      skippedPages,
      chunks,
    },
  }
}

async function runChunk(params: {
  bookId: string
  unitId: string
  pdfPageStart: number
  pdfPageEnd: number
}): Promise<
  | {
      ok: true
      placed: number
      unmatched: number
      ambiguous: number
      skippedDuplicate: number
      marksFound: number
      pageLabel: string
      hitsSample: ListeningMarkHitSample[]
    }
  | { ok: false; status: number; error: string; rateLimited?: boolean }
> {
  const { bookId, unitId } = params
  const start = Math.max(1, Math.floor(params.pdfPageStart))
  const end = Math.max(start, Math.floor(params.pdfPageEnd))

  const mark = await readListeningMarkBytes(bookId)
  if (mark && 'error' in mark) {
    return { ok: false, status: mark.status, error: mark.error }
  }
  if (!mark) {
    return { ok: false, status: 400, error: 'Upload a crop of the listening mark first.' }
  }

  const tracks = await listBookAudioTracks(bookId)
  if (!tracks?.length) {
    return { ok: false, status: 400, error: 'No audio tracks uploaded.' }
  }

  const absPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
  if (!absPath) {
    return { ok: false, status: 404, error: 'Unit PDF not found.' }
  }

  let pageCount = 0
  try {
    pageCount = await getPdfTotalPages(absPath)
  } catch {
    return { ok: false, status: 500, error: 'Could not open this unit’s PDF.' }
  }
  if (start > pageCount) {
    return {
      ok: false,
      status: 400,
      error: `Pages ${start}–${end} are outside this PDF (${pageCount} pages).`,
    }
  }
  const chunkEnd = Math.min(end, pageCount)
  const pageLabel = start === chunkEnd ? String(start) : `${start}–${chunkEnd}`

  const pageImages: Array<{ pdfPage: number; jpegBase64: string }> = []
  for (let p = start; p <= chunkEnd; p += 1) {
    try {
      const buf = await renderPdfPageToJpegBuffer(
        absPath,
        p,
        SCAN_PAGE_JPEG_WIDTH,
        SCAN_PAGE_JPEG_QUALITY,
      )
      pageImages.push({ pdfPage: p, jpegBase64: buf.toString('base64') })
    } catch {
      // Skip unreadable page; continue other pages in chunk.
    }
  }

  if (!pageImages.length) {
    return {
      ok: true,
      placed: 0,
      unmatched: 0,
      ambiguous: 0,
      skippedDuplicate: 0,
      marksFound: 0,
      pageLabel,
      hitsSample: [],
    }
  }

  const gem = await findListeningMarksWithGemini({
    markJpegBase64: mark.bytes.toString('base64'),
    markMimeType: mark.contentType,
    pages: pageImages,
  })
  if (!gem.ok) {
    return {
      ok: false,
      status: gem.rateLimited ? 429 : 502,
      error: gem.error,
      rateLimited: gem.rateLimited,
    }
  }

  const existingPins = (await listBookAudioPins(bookId)) ?? []
  let unmatched = 0
  let ambiguous = 0
  let skippedDuplicate = 0
  const toCreate: Array<{
    trackId: string
    unitId: string
    pdfPage: number
    center: [number, number]
  }> = []
  const hitsSample: ListeningMarkHitSample[] = []

  for (const hit of gem.hits) {
    const matched = matchTrackByListeningLabel(hit.label, tracks)
    if (!matched.ok) {
      const reason = matched.reason === 'ambiguous' ? 'ambiguous' : 'unmatched'
      if (reason === 'ambiguous') ambiguous += 1
      else unmatched += 1
      if (hitsSample.length < 8) {
        hitsSample.push({
          pdfPage: hit.pdfPage,
          label: hit.label,
          matchedFileName: null,
          reason,
        })
      }
      continue
    }
    if (hasAudioPinOnPage(existingPins, matched.track.id, unitId, hit.pdfPage)) {
      skippedDuplicate += 1
      if (hitsSample.length < 8) {
        hitsSample.push({
          pdfPage: hit.pdfPage,
          label: hit.label,
          matchedFileName: matched.track.fileName,
          reason: 'duplicate',
        })
      }
      continue
    }
    if (
      toCreate.some(
        (row) => row.trackId === matched.track.id && row.pdfPage === hit.pdfPage,
      )
    ) {
      skippedDuplicate += 1
      if (hitsSample.length < 8) {
        hitsSample.push({
          pdfPage: hit.pdfPage,
          label: hit.label,
          matchedFileName: matched.track.fileName,
          reason: 'queued_duplicate',
        })
      }
      continue
    }
    toCreate.push({
      trackId: matched.track.id,
      unitId,
      pdfPage: hit.pdfPage,
      center: [hit.x, hit.y],
    })
    if (hitsSample.length < 8) {
      hitsSample.push({
        pdfPage: hit.pdfPage,
        label: hit.label,
        matchedFileName: matched.track.fileName,
        reason: 'placed',
      })
    }
  }

  let placed = 0
  if (toCreate.length) {
    const batch = await createBookAudioPinsBatch({ bookId, pins: toCreate })
    if ('error' in batch) {
      return { ok: false, status: batch.status, error: batch.error }
    }
    placed = batch.created.length
    skippedDuplicate += batch.skippedDuplicate
  }

  return {
    ok: true,
    placed,
    unmatched,
    ambiguous,
    skippedDuplicate,
    marksFound: gem.hits.length,
    pageLabel,
    hitsSample,
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
    }

    const bookId = String(body.bookId ?? '').trim()
    const action = String(body.action ?? '').trim()
    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    }

    if (action === 'plan') {
      const unitId = String(body.unitId ?? '').trim() || null
      const skipPagesWithPins = Boolean(body.skipPagesWithPins)
      const planned = await buildPlan(bookId, unitId, skipPagesWithPins)
      if (!planned.ok) {
        return NextResponse.json({ ok: false, error: planned.error }, { status: planned.status })
      }
      return NextResponse.json({ ok: true, plan: planned.plan })
    }

    if (action === 'chunk') {
      const unitId = String(body.unitId ?? '').trim()
      const pdfPageStart = Number(body.pdfPageStart)
      const pdfPageEnd = Number(body.pdfPageEnd)
      if (!unitId || !Number.isFinite(pdfPageStart) || !Number.isFinite(pdfPageEnd)) {
        return NextResponse.json(
          { ok: false, error: 'unitId, pdfPageStart, and pdfPageEnd are required.' },
          { status: 400 },
        )
      }
      const result = await runChunk({ bookId, unitId, pdfPageStart, pdfPageEnd })
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error, rateLimited: result.rateLimited },
          { status: result.status },
        )
      }
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { ok: false, error: 'action must be "plan" or "chunk".' },
      { status: 400 },
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to place speakers from mark.' }, { status: 500 })
  }
}
