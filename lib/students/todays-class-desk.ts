import type { BookLessonPartTag } from '@/lib/books/types'

/** When this class is (weekday + time) and how long. Hide if neither is known. */
export function formatTodaysClassWhen(
  scheduledFor: string | null | undefined,
  durationMin: number | null | undefined,
): string | null {
  const date = scheduledFor ? new Date(scheduledFor) : null
  const timeOk = date != null && Number.isFinite(date.getTime())
  const time = timeOk
    ? date.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : null
  const mins =
    typeof durationMin === 'number' && Number.isFinite(durationMin) && durationMin > 0
      ? `${Math.round(durationMin)} min`
      : null
  if (time && mins) return `${time} · ${mins}`
  return time ?? mins
}

export function todaysClassPlaceLine(input: {
  bookTitle?: string | null
  unitLabel?: string | null
  lessonLabel?: string | null
}): { title: string | null; meta: string | null } {
  const title = input.bookTitle?.trim() || null
  const bits = [input.unitLabel, input.lessonLabel]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  return { title, meta: bits.length > 0 ? bits.join(' · ') : null }
}

const PART_KIND_LABEL: Partial<Record<BookLessonPartTag, string>> = {
  vocabulary_in_context: 'Vocabulary',
  vocabulary_background: 'Background',
  comprehension: 'Comprehension',
  main_story: 'Story',
  paired_story: 'Paired story',
  your_turn: 'Your Turn',
  making_connections: 'Connections',
  grammar: 'Grammar',
  writing_narrate: 'Writing',
  genre: 'Genre',
  vocabulary_strategy: 'Vocab strategy',
  literary_element: 'Literary element',
}

export function todaysClassPartKindLabel(tag: BookLessonPartTag | null | undefined): string | null {
  if (!tag || tag === 'unspecified') return null
  return PART_KIND_LABEL[tag] ?? null
}

export interface TodaysClassLessonPartLike {
  id: string
  bookId: string
  unitId: string
  lessonId?: string
}

/** Parts (or the lone lesson/unit row) for the lesson that contains today’s start piece. */
export function listTodaysClassLessonParts<T extends TodaysClassLessonPartLike>(
  options: T[],
  start: Pick<TodaysClassLessonPartLike, 'id' | 'bookId' | 'unitId' | 'lessonId'> | null | undefined,
): T[] {
  if (!start) return []
  const lessonId = start.lessonId?.trim()
  if (lessonId) {
    const rows = options.filter(
      (row) => row.bookId === start.bookId && row.unitId === start.unitId && row.lessonId === lessonId,
    )
    if (rows.length > 0) return rows
  }
  return options.filter((row) => row.id === start.id)
}
