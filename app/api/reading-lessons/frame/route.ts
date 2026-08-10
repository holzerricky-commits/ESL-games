import { NextResponse } from 'next/server'
import { getPdfTotalPages } from '@/lib/books/extract-story-pdf-text'
import {
  extractLessonFrameSectionFromPdf,
  lessonFrameHasContent,
} from '@/lib/books/extract-lesson-frame-gemini'
import {
  mergeLessonFrameSection,
  sanitizeLessonFrameRecord,
  type LessonFrameRecord,
} from '@/lib/books/lesson-frame'
import {
  resolveLessonFramePages,
  resolveLessonFrameSections,
  type LessonFrameSection,
} from '@/lib/books/lesson-frame-pages'
import {
  getLessonFrame,
  listLessonFramesForBook,
  saveLessonFrame,
} from '@/lib/books/lesson-frame-store'
import { loadBookLibrary } from '@/lib/books/server'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'

async function resolveTotalPdfPages(
  absPath: string | null,
  bodyTotal: unknown,
): Promise<number | null> {
  let totalPdfPages: number | null =
    typeof bodyTotal === 'number' && Number.isFinite(bodyTotal) ? Math.floor(bodyTotal) : null
  if (absPath && (totalPdfPages == null || totalPdfPages < 1)) {
    try {
      totalPdfPages = await getPdfTotalPages(absPath)
    } catch {
      totalPdfPages = null
    }
  }
  return totalPdfPages
}

function findSection(
  sections: LessonFrameSection[],
  body: Record<string, unknown>,
): LessonFrameSection | null {
  const partId = typeof body.partId === 'string' ? body.partId.trim() : ''
  if (partId) {
    const byId = sections.find((s) => s.partId === partId)
    if (byId) return byId
  }
  const partIndex = Number(body.partIndex)
  if (Number.isFinite(partIndex)) {
    const byIndex = sections.find((s) => s.partIndex === Math.floor(partIndex))
    if (byIndex) return byIndex
  }
  const sectionIndex = Number(body.sectionIndex)
  if (Number.isFinite(sectionIndex)) {
    const idx = Math.floor(sectionIndex)
    if (idx >= 0 && idx < sections.length) return sections[idx]!
  }
  return null
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const unitId = url.searchParams.get('unitId')?.trim() ?? ''
    const lessonId = url.searchParams.get('lessonId')?.trim() ?? ''

    if (bookId && unitId && lessonId) {
      const frame = await getLessonFrame(bookId, unitId, lessonId)
      return NextResponse.json({ ok: true, frame })
    }

    if (bookId) {
      const frames = await listLessonFramesForBook(bookId)
      return NextResponse.json({ ok: true, frames })
    }

    return NextResponse.json(
      { ok: false, error: 'bookId (and optionally unitId + lessonId) is required.' },
      { status: 400 },
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load lesson frame.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const bookId = String(body.bookId ?? '').trim()
    const unitId = String(body.unitId ?? '').trim()
    const lessonId = String(body.lessonId ?? '').trim()
    const action = String(body.action ?? 'save').trim()

    if (!bookId || !unitId || !lessonId) {
      return NextResponse.json(
        { ok: false, error: 'bookId, unitId, and lessonId are required.' },
        { status: 400 },
      )
    }

    const library = await loadBookLibrary()
    const book = library.books.find((b) => b.id === bookId)
    const unit = book?.units.find((u) => u.id === unitId)
    if (!book || !unit) {
      return NextResponse.json({ ok: false, error: 'Book or unit not found.' }, { status: 404 })
    }

    const lesson = (unit.lessons ?? []).find((l) => l.id === lessonId)
    if (!lesson) {
      return NextResponse.json({ ok: false, error: 'Lesson not found in this unit.' }, { status: 404 })
    }

    if (action === 'plan') {
      const absPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
      const totalPdfPages = await resolveTotalPdfPages(absPath, body.totalPdfPages)
      const sections = resolveLessonFrameSections(book, unit, lessonId, totalPdfPages)
      if (sections.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Could not find lesson pages for a frame. Check the outline has comprehension or vocab parts, or page hints on the lesson.',
          },
          { status: 400 },
        )
      }

      const pages = resolveLessonFramePages(book, unit, lessonId, totalPdfPages)
      return NextResponse.json({
        ok: true,
        sections,
        plan: pages
          ? {
              ...pages,
              lessonTitle: lesson.title,
              pageCount: pages.endPdfPage - pages.startPdfPage + 1,
              sectionCount: sections.length,
            }
          : {
              lessonTitle: lesson.title,
              sectionCount: sections.length,
            },
      })
    }

    if (action === 'scan-section') {
      const absPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
      if (!absPath) {
        return NextResponse.json({ ok: false, error: 'Unit PDF not found.' }, { status: 404 })
      }

      const totalPdfPages = await resolveTotalPdfPages(absPath, body.totalPdfPages)
      const sections = resolveLessonFrameSections(book, unit, lessonId, totalPdfPages)
      if (sections.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Could not find lesson pages for a frame. Check the outline has comprehension or vocab parts.',
          },
          { status: 400 },
        )
      }

      const section = findSection(sections, body)
      if (!section) {
        return NextResponse.json(
          { ok: false, error: 'Section not found. Pass partId, partIndex, or sectionIndex.' },
          { status: 400 },
        )
      }

      const extracted = await extractLessonFrameSectionFromPdf({
        absFilePath: absPath,
        section,
        lessonTitle: lesson.title,
      })
      if (!extracted.ok) {
        return NextResponse.json(
          { ok: false, error: extracted.error, section, softSkip: false },
          { status: 422 },
        )
      }

      const existing = await getLessonFrame(bookId, unitId, lessonId)
      if (extracted.empty) {
        return NextResponse.json({
          ok: true,
          frame: existing,
          section,
          empty: true,
          softSkip: true,
          scanned: true,
        })
      }

      const merged = mergeLessonFrameSection(existing, extracted.patch, {
        bookId,
        unitId,
        lessonId,
        lessonTitle: lesson.title,
        startPdfPage: section.startPdfPage,
        endPdfPage: section.endPdfPage,
        startDisplayPage: section.startDisplayPage,
        endDisplayPage: section.endDisplayPage,
        source: extracted.usedGemini ? 'gemini' : 'pdf',
        sectionTitle: section.title,
        sectionTag: section.tag,
      })
      if (!merged) {
        return NextResponse.json({ ok: false, error: 'Could not merge lesson frame.' }, { status: 400 })
      }

      const frameOut = await saveLessonFrame(merged)
      return NextResponse.json({
        ok: true,
        frame: frameOut,
        section,
        empty: false,
        softSkip: false,
        scanned: true,
      })
    }

    if (action === 'scan') {
      const absPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
      if (!absPath) {
        return NextResponse.json({ ok: false, error: 'Unit PDF not found.' }, { status: 404 })
      }

      const totalPdfPages = await resolveTotalPdfPages(absPath, body.totalPdfPages)
      const sections = resolveLessonFrameSections(book, unit, lessonId, totalPdfPages)
      if (sections.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Could not find lesson pages for a frame. Check the outline has comprehension or vocab parts.',
          },
          { status: 400 },
        )
      }

      let frame: LessonFrameRecord | null = await getLessonFrame(bookId, unitId, lessonId)
      const scanned: Array<{ title: string; empty: boolean }> = []

      for (const section of sections) {
        const extracted = await extractLessonFrameSectionFromPdf({
          absFilePath: absPath,
          section,
          lessonTitle: lesson.title,
        })
        if (!extracted.ok) {
          return NextResponse.json(
            {
              ok: false,
              error: extracted.error,
              frame,
              sections,
              scanned,
              failedSection: section,
            },
            { status: 422 },
          )
        }
        scanned.push({ title: section.title, empty: extracted.empty })
        if (extracted.empty) continue

        const merged = mergeLessonFrameSection(frame, extracted.patch, {
          bookId,
          unitId,
          lessonId,
          lessonTitle: lesson.title,
          startPdfPage: section.startPdfPage,
          endPdfPage: section.endPdfPage,
          startDisplayPage: section.startDisplayPage,
          endDisplayPage: section.endDisplayPage,
          source: extracted.usedGemini ? 'gemini' : 'pdf',
          sectionTitle: section.title,
          sectionTag: section.tag,
        })
        if (!merged) {
          return NextResponse.json({ ok: false, error: 'Could not merge lesson frame.' }, { status: 400 })
        }
        frame = await saveLessonFrame(merged)
      }

      if (!frame || !lessonFrameHasContent(frame)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'AI found little lesson-frame content on those pages. Try a different range, or fill the frame by hand.',
            sections,
            scanned,
          },
          { status: 422 },
        )
      }

      const pages = resolveLessonFramePages(book, unit, lessonId, totalPdfPages)
      return NextResponse.json({
        ok: true,
        frame,
        sections,
        scanned,
        plan: pages,
      })
    }

    if (action === 'mark-ready') {
      const existing = await getLessonFrame(bookId, unitId, lessonId)
      const base =
        existing ??
        sanitizeLessonFrameRecord({
          bookId,
          unitId,
          lessonId,
          lessonTitle: lesson.title,
          status: 'draft',
        })
      if (!base) {
        return NextResponse.json({ ok: false, error: 'Invalid lesson frame.' }, { status: 400 })
      }
      const merged = sanitizeLessonFrameRecord({
        ...base,
        ...(body as Partial<LessonFrameRecord>),
        bookId,
        unitId,
        lessonId,
        status: 'ready',
      })
      if (!merged) {
        return NextResponse.json({ ok: false, error: 'Invalid lesson frame.' }, { status: 400 })
      }
      if (!merged.comprehensionSkill.trim() && !merged.essentialQuestion.trim()) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Add at least a comprehension skill or essential question before marking ready.',
          },
          { status: 400 },
        )
      }
      const saved = await saveLessonFrame(merged)
      return NextResponse.json({ ok: true, frame: saved })
    }

    if (action === 'unready') {
      const existing = await getLessonFrame(bookId, unitId, lessonId)
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'No lesson frame to edit.' }, { status: 404 })
      }
      const saved = await saveLessonFrame({ ...existing, status: 'draft' })
      return NextResponse.json({ ok: true, frame: saved })
    }

    if (action !== 'save') {
      return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
    }

    const sanitized = sanitizeLessonFrameRecord({
      ...(body as Partial<LessonFrameRecord>),
      bookId,
      unitId,
      lessonId,
      lessonTitle:
        typeof body.lessonTitle === 'string' ? body.lessonTitle : lesson.title,
      status: body.status === 'ready' ? 'ready' : 'draft',
    })
    if (!sanitized) {
      return NextResponse.json({ ok: false, error: 'Invalid lesson frame.' }, { status: 400 })
    }
    const saved = await saveLessonFrame(sanitized)
    return NextResponse.json({ ok: true, frame: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save lesson frame.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
