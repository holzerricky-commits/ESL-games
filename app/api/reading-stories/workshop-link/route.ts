import { NextResponse } from 'next/server'
import {
  deleteReadingStoryWorkshopLink,
  getReadingStoryWorkshopLink,
  listReadingStoryWorkshopLinksForBook,
  saveReadingStoryWorkshopLink,
} from '@/lib/books/reading-story-store'
import type { ReadingStoryWorkshopLink } from '@/lib/books/reading-story-workshop-link'
import { loadBookLibrary } from '@/lib/books/server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const storyId = url.searchParams.get('storyId')?.trim() ?? ''
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''

    if (storyId) {
      const link = await getReadingStoryWorkshopLink(storyId)
      return NextResponse.json({ ok: true, link })
    }

    if (bookId) {
      const links = await listReadingStoryWorkshopLinksForBook(bookId)
      return NextResponse.json({ ok: true, links })
    }

    return NextResponse.json(
      { ok: false, error: 'storyId or bookId is required.' },
      { status: 400 },
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load workshop link.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? 'save').trim()
    const storyId = String(body.storyId ?? '').trim()

    if (!storyId) {
      return NextResponse.json({ ok: false, error: 'storyId is required.' }, { status: 400 })
    }

    if (action === 'clear') {
      await deleteReadingStoryWorkshopLink(storyId)
      return NextResponse.json({ ok: true, link: null })
    }

    if (action !== 'save') {
      return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
    }

    const workshopBookId = String(body.workshopBookId ?? '').trim()
    const workshopUnitId = String(body.workshopUnitId ?? '').trim()
    const workshopLessonId = String(body.workshopLessonId ?? '').trim()
    if (!workshopBookId || !workshopUnitId || !workshopLessonId) {
      return NextResponse.json(
        { ok: false, error: 'workshopBookId, workshopUnitId, and workshopLessonId are required.' },
        { status: 400 },
      )
    }

    const library = await loadBookLibrary()
    const workshopBook = library.books.find((b) => b.id === workshopBookId)
    const workshopUnit = workshopBook?.units.find((u) => u.id === workshopUnitId)
    const workshopLesson = (workshopUnit?.lessons ?? []).find((l) => l.id === workshopLessonId)
    if (!workshopBook || !workshopUnit || !workshopLesson) {
      return NextResponse.json(
        { ok: false, error: 'Workshop book, unit, or lesson not found.' },
        { status: 404 },
      )
    }

    const saved = await saveReadingStoryWorkshopLink({
      ...(body as Partial<ReadingStoryWorkshopLink>),
      storyId,
      workshopBookId,
      workshopUnitId,
      workshopLessonId,
      workshopLessonTitle:
        typeof body.workshopLessonTitle === 'string'
          ? body.workshopLessonTitle
          : workshopLesson.title,
    })
    return NextResponse.json({ ok: true, link: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save workshop link.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
