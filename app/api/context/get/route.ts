import { NextResponse } from 'next/server'
import { getContextStore } from '@/lib/context/file-store'
import type { BookContextRecord, BookContextSummaryRecord, UnitContextRecord } from '@/lib/context/types'

function buildBookSummary(bookId: string, units: UnitContextRecord[], lessonCount: number): BookContextSummaryRecord | null {
  if (!units.length) return null
  const sorted = [...units].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const latest = sorted[0]
  const summary = latest?.theme?.trim() || 'Book context extracted from mapped unit contexts.'
  const ranges = units
    .map((unit) => unit.sourcePageRange)
    .filter((range) => range && Number.isFinite(range.startPage) && Number.isFinite(range.endPage))
  const sourcePageRange = ranges.length
    ? {
      startPage: Math.min(...ranges.map((range) => range.startPage)),
      endPage: Math.max(...ranges.map((range) => range.endPage)),
    }
    : null
  return {
    kind: 'book-summary',
    bookId,
    summary,
    sourcePageRange,
    updatedAt: latest?.updatedAt ?? null,
    unitContextCount: units.length,
    lessonContextCount: lessonCount,
  }
}

function toBookSummary(record: BookContextRecord): BookContextSummaryRecord {
  return {
    kind: 'book-summary',
    bookId: record.bookId,
    summary: record.summary,
    sourcePageRange: record.sourcePageRange,
    updatedAt: record.updatedAt,
    unitContextCount: 0,
    lessonContextCount: 0,
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const unitId = url.searchParams.get('unitId')?.trim() ?? ''
    const lessonId = url.searchParams.get('lessonId')?.trim() ?? ''
    const partId = url.searchParams.get('partId')?.trim() ?? ''
    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    }
    const store = getContextStore()
    if (!unitId) {
      const savedBook = await store.getBookContext(bookId)
      if (savedBook) {
        return NextResponse.json({ ok: true, book: toBookSummary(savedBook), bookRecord: savedBook })
      }
      const payload = await store.listContextsForBook(bookId)
      const book = buildBookSummary(bookId, payload.units, payload.lessons.length)
      return NextResponse.json({ ok: true, book, parts: payload.parts })
    }
    if (lessonId && partId) {
      const part = await store.getPartContext(bookId, unitId, lessonId, partId)
      return NextResponse.json({ ok: true, context: part })
    }
    if (lessonId) {
      const lesson = await store.getLessonContext(bookId, unitId, lessonId)
      return NextResponse.json({ ok: true, context: lesson })
    }
    const payload = await store.listContextsForUnit(bookId, unitId)
    return NextResponse.json({ ok: true, ...payload })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load context.' }, { status: 500 })
  }
}
