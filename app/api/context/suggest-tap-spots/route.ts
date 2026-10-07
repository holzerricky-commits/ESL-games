import { NextResponse } from 'next/server'
import { openPdfDocument } from '@/lib/books/extract-story-pdf-text'
import { extractPdfPageTextRuns } from '@/lib/books/pdf-page-text-geometry'
import { searchablePdfAbsolutePath } from '@/lib/books/searchable-pdf-path'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'
import { suggestTapSpots } from '@/lib/books/vocab-tap-spot-suggest'
import type { VocabTapSpot } from '@/lib/context/types'
import { stat } from 'node:fs/promises'

export const runtime = 'nodejs'
export const maxDuration = 30

interface RequestBody {
  bookId?: string
  unitId?: string
  words?: { id: string; word: string }[]
  startPdfPage?: number
  endPdfPage?: number
}

async function fileExists(p: string) {
  try { await stat(p); return true } catch { return false }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody
    const bookId = String(body.bookId ?? '').trim()
    const unitId = String(body.unitId ?? '').trim()
    if (!bookId || !unitId) {
      return NextResponse.json({ ok: false, error: 'bookId and unitId are required.' }, { status: 400 })
    }

    const words = Array.isArray(body.words)
      ? body.words
          .filter((w): w is { id: string; word: string } => typeof w?.id === 'string' && typeof w?.word === 'string')
          .map((w) => ({ id: w.id.trim(), word: w.word.trim() }))
          .filter((w) => w.id && w.word)
      : []
    if (words.length === 0) {
      return NextResponse.json({ ok: true, spots: {} })
    }

    const startPage = Math.max(1, Math.floor(Number(body.startPdfPage) || 1))
    const endPage = Math.max(startPage, Math.floor(Number(body.endPdfPage) || startPage))

    const originalPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
    if (!originalPath) {
      return NextResponse.json({ ok: false, error: 'Unit PDF not found.' }, { status: 404 })
    }

    // Prefer searchable sidecar (has invisible text from OCR)
    const sidecar = searchablePdfAbsolutePath(originalPath)
    const pdfPath = (await fileExists(sidecar)) ? sidecar : originalPath

    const doc = await openPdfDocument(pdfPath)
    const pageRuns: { pdfPage: number; runs: Awaited<ReturnType<typeof extractPdfPageTextRuns>> extends infer R ? R extends null ? never : R extends { runs: infer U } ? U : never : never }[] = []

    const lastPage = Math.min(endPage, doc.numPages)
    for (let p = startPage; p <= lastPage; p++) {
      const result = await extractPdfPageTextRuns(doc, p)
      if (result && result.runs.length > 0) {
        pageRuns.push({ pdfPage: p, runs: result.runs })
      }
    }

    const spotMap = suggestTapSpots(pageRuns, words)
    const spots: Record<string, VocabTapSpot> = {}
    for (const [id, spot] of spotMap) {
      spots[id] = spot
    }

    return NextResponse.json({ ok: true, spots })
  } catch (err) {
    console.error('[suggest-tap-spots]', err)
    return NextResponse.json({ ok: false, error: 'Could not suggest tap spots.' }, { status: 500 })
  }
}
