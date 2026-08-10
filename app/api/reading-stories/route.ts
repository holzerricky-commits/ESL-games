import { NextResponse } from 'next/server'
import { mergeStoriesForBook, READING_STORY_SEEDS } from '@/lib/books/reading-story-map'
import { loadBookLibrary } from '@/lib/books/server'
import {
  deleteReadingStoryRecord,
  getReadingStoryOverride,
  listReadingStoryOverrides,
  listReadingStoryOverridesForBook,
  saveReadingStoryOverride,
} from '@/lib/books/reading-story-store'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const storyId = url.searchParams.get('storyId')?.trim() ?? ''

    if (storyId) {
      const override = await getReadingStoryOverride(storyId)
      return NextResponse.json({ ok: true, override })
    }

    if (bookId) {
      const overrides = await listReadingStoryOverridesForBook(bookId)
      let book = null
      try {
        const library = await loadBookLibrary()
        book = library.books.find((b) => b.id === bookId) ?? null
      } catch {
        book = null
      }
      const stories = mergeStoriesForBook(bookId, overrides, book)
      return NextResponse.json({ ok: true, stories, overrides })
    }

    const overrides = await listReadingStoryOverrides()
    return NextResponse.json({
      ok: true,
      seeds: READING_STORY_SEEDS,
      overrides,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load reading stories.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const storyId = String(body.storyId ?? '').trim()
    if (!storyId) {
      return NextResponse.json({ ok: false, error: 'storyId is required.' }, { status: 400 })
    }

    const action = String(body.action ?? 'save').trim()
    if (action === 'delete') {
      await deleteReadingStoryRecord(storyId)
      return NextResponse.json({ ok: true })
    }

    const saved = await saveReadingStoryOverride({
      storyId,
      startPage: Number(body.startPage),
      endPage: Number(body.endPage),
      rangeConfirmed: body.rangeConfirmed !== false,
      title: typeof body.title === 'string' ? body.title : undefined,
      bookId: typeof body.bookId === 'string' ? body.bookId : undefined,
      unitId: typeof body.unitId === 'string' ? body.unitId : undefined,
      lessonId:
        body.lessonId === null || body.lessonId === undefined
          ? body.lessonId === null
            ? null
            : undefined
          : String(body.lessonId),
      partId:
        body.partId === null || body.partId === undefined
          ? body.partId === null
            ? null
            : undefined
          : String(body.partId),
    })
    return NextResponse.json({ ok: true, override: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save reading story.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
