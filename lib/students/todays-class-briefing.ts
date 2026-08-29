import { buildBooksPageHref } from '@/lib/books/book-setup-copy'
import type { BookLessonPartTag } from '@/lib/books/types'

export type TodaysClassBriefingKind = 'vocabulary' | 'story' | 'grammar' | 'writing' | 'other'

export interface TodaysClassBriefingWord {
  word: string
  definition: string
}

export interface TodaysClassPartBriefing {
  kind: TodaysClassBriefingKind
  words: TodaysClassBriefingWord[]
  lines: string[]
  storyTitle: string | null
  storyExcerpt: string | null
  storyId: string | null
  checksLabel: string | null
  empty: boolean
  emptyLabel: string
  workshopHref: string
}

export function todaysClassBriefingKind(tag: BookLessonPartTag | null | undefined): TodaysClassBriefingKind {
  if (tag === 'vocabulary_in_context' || tag === 'vocabulary_background' || tag === 'vocabulary_strategy') {
    return 'vocabulary'
  }
  if (tag === 'main_story' || tag === 'paired_story') return 'story'
  if (tag === 'grammar') return 'grammar'
  if (tag === 'writing_narrate') return 'writing'
  return 'other'
}

export function todaysClassBriefingEmptyLabel(kind: TodaysClassBriefingKind): string {
  if (kind === 'vocabulary') return 'No word list saved for this part yet.'
  if (kind === 'story') return 'No story text saved for this part yet.'
  if (kind === 'grammar') return 'No grammar notes saved for this part yet.'
  if (kind === 'writing') return 'No writing notes saved for this part yet.'
  return 'Nothing saved for this part yet.'
}

export function excerptStoryText(text: string, maxChars = 900): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!normalized) return ''
  if (normalized.length <= maxChars) return normalized
  const cut = normalized.slice(0, maxChars)
  const lastBreak = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('. '), cut.lastIndexOf(' '))
  return `${(lastBreak > 200 ? cut.slice(0, lastBreak) : cut).trim()}…`
}

export function mergeBriefingWords(
  ...lists: Array<Array<{ word?: string; definition?: string }> | string[] | null | undefined>
): TodaysClassBriefingWord[] {
  const seen = new Set<string>()
  const out: TodaysClassBriefingWord[] = []
  for (const list of lists) {
    if (!list) continue
    for (const row of list) {
      const word = (typeof row === 'string' ? row : row.word ?? '').trim()
      if (!word) continue
      const key = word.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const definition = typeof row === 'string' ? '' : (row.definition ?? '').trim()
      out.push({ word, definition })
    }
  }
  return out
}

/** Add or remove a value, case-insensitive, keeping the original spelling when adding. */
export function toggleTrimmedItem(list: string[], value: string): string[] {
  const next = value.trim()
  if (!next) return list.filter((row) => row.trim())
  const key = next.toLowerCase()
  const exists = list.some((row) => row.trim().toLowerCase() === key)
  if (exists) return list.filter((row) => row.trim().toLowerCase() !== key)
  return [...list.filter((row) => row.trim()), next]
}

export function todaysClassWorkshopHref(input: {
  bookId: string
  unitId: string
  lessonId?: string | null
  partId?: string | null
  storyId?: string | null
  kind: TodaysClassBriefingKind
  studentId?: string | null
}): string {
  const book = input.bookId.trim()
  const unit = input.unitId.trim()
  if (!book) return '/books'
  const story = input.storyId?.trim() || null
  const lesson = input.lessonId?.trim() || null
  const part = input.partId?.trim() || null
  if (input.kind === 'story') {
    return buildBooksPageHref({
      book,
      unit,
      tab: 'stories',
      story,
      lesson,
      part,
      student: input.studentId,
    })
  }
  return buildBooksPageHref({
    book,
    unit,
    lesson,
    part,
    student: input.studentId,
  })
}

function trimLines(values: Array<string | null | undefined>, max = 8): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const line = value?.trim() ?? ''
    if (!line) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= max) break
  }
  return out
}

export function assembleTodaysClassPartBriefing(input: {
  tag?: BookLessonPartTag | null
  bookId: string
  unitId: string
  lessonId?: string | null
  partId?: string | null
  studentId?: string | null
  partWords?: Array<{ word?: string; definition?: string }> | null
  demoWords?: Array<{ word?: string; definition?: string }> | null
  frameWords?: string[] | null
  grammarNotes?: string[] | null
  writingNotes?: string[] | null
  partGoals?: string[] | null
  activityNotes?: string[] | null
  frameSkill?: string | null
  frameStrategy?: string | null
  frameQuestion?: string | null
  frameTeachingNotes?: string | null
  story?: { id?: string; title?: string; text?: string } | null
  checksLabel?: string | null
}): TodaysClassPartBriefing {
  const kind = todaysClassBriefingKind(input.tag)
  const words =
    kind === 'vocabulary'
      ? mergeBriefingWords(input.partWords, input.demoWords, input.frameWords)
      : mergeBriefingWords(input.partWords, input.demoWords)
  const storyText = input.story?.text?.trim() ?? ''
  const storyExcerpt = excerptStoryText(storyText)
  const storyId = input.story?.id?.trim() || null
  const storyTitle = input.story?.title?.trim() || null
  const checksLabel = input.checksLabel?.trim() || null

  const useLessonFrame = kind === 'story' || kind === 'other'
  const lines = trimLines([
    ...(input.grammarNotes ?? []),
    ...(input.writingNotes ?? []),
    ...(input.partGoals ?? []),
    ...(input.activityNotes ?? []),
    useLessonFrame ? input.frameSkill : null,
    useLessonFrame ? input.frameStrategy : null,
    useLessonFrame ? input.frameQuestion : null,
    useLessonFrame && input.frameTeachingNotes
      ? excerptStoryText(input.frameTeachingNotes, 280)
      : null,
  ])

  const empty = words.length === 0 && lines.length === 0 && !storyExcerpt && !checksLabel

  return {
    kind,
    words,
    lines,
    storyTitle: storyExcerpt ? storyTitle : null,
    storyExcerpt: storyExcerpt || null,
    storyId,
    checksLabel,
    empty,
    emptyLabel: todaysClassBriefingEmptyLabel(kind),
    workshopHref: todaysClassWorkshopHref({
      bookId: input.bookId,
      unitId: input.unitId,
      lessonId: input.lessonId,
      partId: input.partId,
      storyId,
      kind,
      studentId: input.studentId,
    }),
  }
}
