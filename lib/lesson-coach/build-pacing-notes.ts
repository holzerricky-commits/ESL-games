import type {
  BookContextRecord,
  LessonContextRecord,
  PartContextRecord,
  UnitContextRecord,
} from '@/lib/context/types'

export type LessonPacingContext = {
  bookTitle?: string
  unitTitle?: string
  partTitle?: string
  lessonTitle?: string
  book?: Pick<
    BookContextRecord,
    'summary' | 'goals' | 'pacing' | 'instructionalPriorities'
  > | null
  unit?: Pick<UnitContextRecord, 'theme' | 'bigIdeas' | 'targetLanguageDomains'> | null
  lesson?: Pick<
    LessonContextRecord,
    'lessonGoals' | 'essentialQuestions' | 'comprehensionSkill' | 'strategy' | 'languageFocus'
  > | null
  part?: Pick<
    PartContextRecord,
    'partGoals' | 'activityNotes' | 'languageFocus' | 'partTitle'
  > | null
}

function bulletLines(items: string[], max = 8): string[] {
  return items.map((s) => s.trim()).filter(Boolean).slice(0, max)
}

function section(title: string, lines: string[]): string | null {
  const bullets = bulletLines(lines)
  if (!bullets.length) return null
  return `## ${title}\n${bullets.map((l) => `- ${l}`).join('\n')}`
}

function languageFocusLines(
  focus: { grammarNotes: string[]; writingNotes: string[] } | undefined,
): string[] {
  if (!focus) return []
  return [...bulletLines(focus.grammarNotes, 4), ...bulletLines(focus.writingNotes, 4)]
}

/** Plain-text pacing guide for the coach phone (Phase 6). */
export function buildPacingNotes(ctx: LessonPacingContext): string {
  const partLabel =
    ctx.partTitle?.trim() ||
    ctx.part?.partTitle?.trim() ||
    (ctx.partTitle === undefined ? '' : 'This part')

  const sections: string[] = []

  const header = [
    ctx.bookTitle ? `Book: ${ctx.bookTitle}` : null,
    ctx.unitTitle ? `Unit: ${ctx.unitTitle}` : null,
    ctx.lessonTitle ? `Lesson: ${ctx.lessonTitle}` : null,
    partLabel ? `Part: ${partLabel}` : null,
  ].filter(Boolean)

  if (header.length) {
    sections.push(header.join('\n'))
  }

  const partSec = section('This part', [
    ...(ctx.part?.partGoals ?? []),
    ...(ctx.part?.activityNotes ?? []),
    ...languageFocusLines(ctx.part?.languageFocus),
  ])
  if (partSec) sections.push(partSec)

  const lessonSec = section('Lesson focus', [
    ...(ctx.lesson?.lessonGoals ?? []),
    ...(ctx.lesson?.essentialQuestions ?? []),
    ctx.lesson?.comprehensionSkill ? `Comprehension: ${ctx.lesson.comprehensionSkill}` : '',
    ctx.lesson?.strategy ? `Strategy: ${ctx.lesson.strategy}` : '',
    ...languageFocusLines(ctx.lesson?.languageFocus),
  ])
  if (lessonSec) sections.push(lessonSec)

  const unitSec = section('Unit', [
    ctx.unit?.theme ? `Theme: ${ctx.unit.theme}` : '',
    ...(ctx.unit?.bigIdeas ?? []),
    ...(ctx.unit?.targetLanguageDomains ?? []),
  ])
  if (unitSec) sections.push(unitSec)

  const bookSec = section('Book pacing', [
    ctx.book?.summary?.trim() ? ctx.book.summary.trim() : '',
    ...(ctx.book?.pacing ?? []),
    ...(ctx.book?.goals ?? []),
    ...(ctx.book?.instructionalPriorities ?? []),
  ])
  if (bookSec) sections.push(bookSec)

  const body = sections.join('\n\n').trim()
  if (!body) {
    return 'Add your pacing notes for this part — book context not saved yet.'
  }
  return body.slice(0, 20_000)
}
