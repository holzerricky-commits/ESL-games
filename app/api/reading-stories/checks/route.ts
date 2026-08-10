import { NextResponse } from 'next/server'
import { draftReadingCheckPackWithGemini } from '@/lib/books/draft-reading-check-pack-gemini'
import { getLessonFrame } from '@/lib/books/lesson-frame-store'
import { isLessonFrameReady } from '@/lib/books/lesson-frame'
import {
  approveReadingCheckPack,
  demoteReadingCheckPackToDraft,
  readingCheckPackCanApprove,
  sanitizeReadingCheckPack,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import { ensureReadingCheckPackPlacements } from '@/lib/books/reading-check-placement'
import { lessonIdFromReadingStoryId } from '@/lib/books/reading-story-map'
import {
  getReadingCheckPack,
  getReadingStoryOverride,
  getReadingStoryText,
  getReadingStoryWorkshopLink,
  listReadingCheckPacksForBook,
  saveReadingCheckPack,
} from '@/lib/books/reading-story-store'
import { readingStoryTextStatus } from '@/lib/books/reading-story-text'
import { loadBookLibrary } from '@/lib/books/server'
import { getPdfTotalPages } from '@/lib/books/extract-story-pdf-text'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const storyId = url.searchParams.get('storyId')?.trim() ?? ''

    if (storyId) {
      const pack = await getReadingCheckPack(storyId)
      return NextResponse.json({ ok: true, pack })
    }

    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId or storyId is required.' }, { status: 400 })
    }

    const packs = await listReadingCheckPacksForBook(bookId)
    return NextResponse.json({ ok: true, packs })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load check packs.' }, { status: 500 })
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

    if (action === 'generate') {
      const textRecord = await getReadingStoryText(storyId)
      if (!textRecord || readingStoryTextStatus(textRecord.text) !== 'ready') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Scan or paste story text first, then generate checks.',
            needsText: true,
          },
          { status: 400 },
        )
      }

      const library = await loadBookLibrary()
      const book = library.books.find((b) => b.id === bookId) ?? null
      const unit = book?.units.find((u) => u.id === unitId) ?? null
      let totalPdfPages: number | null = null
      if (unit) {
        const absPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
        if (absPath) {
          try {
            totalPdfPages = await getPdfTotalPages(absPath)
          } catch {
            totalPdfPages = null
          }
        }
      }

      const bodyLessonId =
        typeof body.lessonId === 'string' && body.lessonId.trim() ? body.lessonId.trim() : null
      const override = await getReadingStoryOverride(storyId)
      const lessonId =
        bodyLessonId ??
        (typeof override?.lessonId === 'string' && override.lessonId.trim()
          ? override.lessonId.trim()
          : null) ??
        lessonIdFromReadingStoryId(storyId)

      let lessonFrame = null
      const workshopLink = await getReadingStoryWorkshopLink(storyId)
      if (workshopLink) {
        const frame = await getLessonFrame(
          workshopLink.workshopBookId,
          workshopLink.workshopUnitId,
          workshopLink.workshopLessonId,
        )
        if (isLessonFrameReady(frame)) lessonFrame = frame
      } else if (lessonId) {
        const frame = await getLessonFrame(bookId, unitId, lessonId)
        if (isLessonFrameReady(frame)) lessonFrame = frame
      }

      const drafted = await draftReadingCheckPackWithGemini({
        storyId,
        bookId,
        unitId,
        storyTitle: typeof body.title === 'string' ? body.title : undefined,
        storyText: textRecord.text,
        startDisplayPage: textRecord.startDisplayPage,
        endDisplayPage: textRecord.endDisplayPage,
        book,
        unit,
        totalPdfPages,
        lessonFrame,
      })
      if (!drafted.ok) {
        return NextResponse.json({ ok: false, error: drafted.error }, { status: 422 })
      }

      const withPins: ReadingCheckPack = {
        ...drafted.pack,
        stops: ensureReadingCheckPackPlacements(drafted.pack.stops, {
          book,
          unit,
          totalPdfPages,
        }),
      }

      const saved = await saveReadingCheckPack(withPins)
      return NextResponse.json({
        ok: true,
        pack: saved,
        generated: true,
        usedLessonFrame: drafted.usedLessonFrame,
        stopCheckCount: drafted.stopCheckCount,
      })
    }

    if (action === 'approve') {
      const existing = await getReadingCheckPack(storyId)
      const base =
        existing ??
        sanitizeReadingCheckPack({
          storyId,
          bookId,
          unitId,
          status: 'draft',
          stops: [],
        })
      if (!base) {
        return NextResponse.json({ ok: false, error: 'Invalid check pack.' }, { status: 400 })
      }
      const withBody =
        Array.isArray(body.stops)
          ? sanitizeReadingCheckPack({
              ...base,
              ...body,
              storyId,
              bookId,
              unitId,
              status: 'draft',
            })
          : base
      if (!withBody || !readingCheckPackCanApprove(withBody)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Add at least one check with a question before approving.',
          },
          { status: 400 },
        )
      }
      const approved = approveReadingCheckPack(withBody)
      if (!approved) {
        return NextResponse.json({ ok: false, error: 'Could not approve pack.' }, { status: 400 })
      }
      const saved = await saveReadingCheckPack(approved)
      return NextResponse.json({ ok: true, pack: saved })
    }

    if (action === 'unapprove') {
      const existing = await getReadingCheckPack(storyId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'No check pack to edit.' }, { status: 404 })
      }
      const draft = demoteReadingCheckPackToDraft(existing)
      const saved = await saveReadingCheckPack(draft)
      return NextResponse.json({ ok: true, pack: saved })
    }

    if (action !== 'save') {
      return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
    }

    const sanitized = sanitizeReadingCheckPack({
      ...(body as Partial<ReadingCheckPack>),
      storyId,
      bookId,
      unitId,
      status: 'draft',
      approvedAt: null,
    })
    if (!sanitized) {
      return NextResponse.json({ ok: false, error: 'Invalid check pack.' }, { status: 400 })
    }
    const saved = await saveReadingCheckPack(sanitized)
    return NextResponse.json({ ok: true, pack: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save check pack.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
