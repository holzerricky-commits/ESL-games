import { NextResponse } from 'next/server'
import { getInteractiveVocabPackForPartKey, interactiveVocabPartKey } from '@/lib/books/interactive-vocab'
import { getLessonFrame } from '@/lib/books/lesson-frame-store'
import {
  pickReadingStoryForPrepareGlance,
  resolveReadingCheckPrepareGlance,
} from '@/lib/books/reading-check-prepare-glance'
import { mergeStoriesForBook } from '@/lib/books/reading-story-map'
import {
  getReadingCheckPack,
  getReadingStoryText,
  listReadingStoryOverridesForBook,
} from '@/lib/books/reading-story-store'
import { loadBookLibrary } from '@/lib/books/server'
import type { BookLessonPartTag } from '@/lib/books/types'
import { getContextStore } from '@/lib/context/file-store'
import { assembleTodaysClassPartBriefing } from '@/lib/students/todays-class-briefing'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const unitId = url.searchParams.get('unitId')?.trim() ?? ''
    const lessonId = url.searchParams.get('lessonId')?.trim() || null
    const partId = url.searchParams.get('partId')?.trim() || null
    const studentId = url.searchParams.get('studentId')?.trim() || null
    const tagRaw = url.searchParams.get('tag')?.trim() || null
    const tag = tagRaw as BookLessonPartTag | null

    if (!bookId || !unitId) {
      return NextResponse.json({ ok: false, error: 'bookId and unitId are required.' }, { status: 400 })
    }

    const store = getContextStore()
    const [part, lesson, frame, library, overrides] = await Promise.all([
      lessonId && partId ? store.getPartContext(bookId, unitId, lessonId, partId) : Promise.resolve(null),
      lessonId ? store.getLessonContext(bookId, unitId, lessonId) : Promise.resolve(null),
      lessonId ? getLessonFrame(bookId, unitId, lessonId) : Promise.resolve(null),
      loadBookLibrary().catch(() => null),
      listReadingStoryOverridesForBook(bookId),
    ])

    const book = library?.books.find((row) => row.id === bookId) ?? null
    const stories = mergeStoriesForBook(bookId, overrides, book)
    const storyMap = pickReadingStoryForPrepareGlance({
      stories,
      bookId,
      unitId,
      lessonId,
      partId,
    })
    const [storyText, checkPack] = storyMap
      ? await Promise.all([getReadingStoryText(storyMap.id), getReadingCheckPack(storyMap.id)])
      : [null, null]
    const checks = resolveReadingCheckPrepareGlance(checkPack)
    const demo =
      lessonId && partId
        ? getInteractiveVocabPackForPartKey(interactiveVocabPartKey(bookId, unitId, lessonId, partId))
        : null

    const briefing = assembleTodaysClassPartBriefing({
      tag,
      bookId,
      unitId,
      lessonId,
      partId,
      studentId,
      partWords: part?.interactiveVocabulary ?? null,
      demoWords: demo?.words ?? null,
      frameWords: frame?.targetVocabulary ?? null,
          grammarNotes: [
            ...(part?.languageFocus?.grammarNotes ?? []),
            ...(lesson?.languageFocus?.grammarNotes ?? []),
          ],
          writingNotes: [
            ...(part?.languageFocus?.writingNotes ?? []),
            ...(lesson?.languageFocus?.writingNotes ?? []),
          ],
      partGoals: part?.partGoals ?? null,
      activityNotes: part?.activityNotes ?? null,
      frameSkill: frame?.comprehensionSkill ?? null,
      frameStrategy: frame?.readingStrategy ?? null,
      frameQuestion: frame?.essentialQuestion ?? null,
      frameTeachingNotes: frame?.teachingNotes ?? null,
      story: storyMap
        ? { id: storyMap.id, title: storyMap.title, text: storyText?.text ?? '' }
        : null,
      checksLabel: checks.kind === 'none' ? null : checks.label,
    })

    return NextResponse.json({ ok: true, briefing })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load this part.' }, { status: 500 })
  }
}
