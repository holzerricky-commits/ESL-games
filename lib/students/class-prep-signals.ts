import type { StudentClassSession, StudentRecord } from '@/lib/types'

export type ClassPrepReadingSource =
  | 'last_class_bookmark'
  | 'reader_history'
  | 'section_start_hint'
  | 'none'

export type ClassPrepContextMode = 'clean_start' | 'returning' | 'mixed'

export interface ClassPrepReadingPosition {
  bookId: string
  unitId?: string
  pdfPage?: number
  sectionPageRange?: { start?: number; end?: number }
  source: ClassPrepReadingSource
  label: string
}

export interface ClassPrepVocabSignals {
  strongWords: string[]
  needsPracticeWords: string[]
  savedNotebookWords: string[]
}

export interface ClassPrepNamedIssue {
  label: string
  description: string
  example?: string
}

export interface ClassPrepContextFlags {
  completedClassCount: number
  hasReadingPosition: boolean
  hasVocabSignals: boolean
  hasCurriculumAnchor: boolean
  hasSelectedSection: boolean
}

export interface ClassPrepSignals {
  readingPosition?: ClassPrepReadingPosition
  vocabSignals: ClassPrepVocabSignals
  namedRecurringIssues: ClassPrepNamedIssue[]
  prepContextMode: ClassPrepContextMode
  prepContextFlags: ClassPrepContextFlags
}

export interface ClassPrepSectionOptionLike {
  bookId: string
  unitId: string
  startPageHint?: number
  endPageHint?: number
}

type SavedWordStatus = 'new' | 'learning' | 'mastered'

interface ParsedSavedWord {
  word: string
  status: SavedWordStatus
}

const WORD_CAP = 12

function dedupeWords(words: string[], cap = WORD_CAP): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of words) {
    const word = raw.trim()
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(word)
    if (out.length >= cap) break
  }
  return out
}

function parseSavedWordEntries(entries: unknown[] | undefined): ParsedSavedWord[] {
  if (!entries?.length) return []
  const out: ParsedSavedWord[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>
    const word = typeof raw.source === 'string' ? raw.source.trim() : ''
    if (!word) continue
    const status: SavedWordStatus =
      raw.status === 'learning' || raw.status === 'mastered' ? raw.status : 'new'
    out.push({ word, status })
  }
  return out
}

function countCompletedClasses(sessions: StudentClassSession[]): number {
  return sessions.filter((session) => session.status === 'completed').length
}

function resolveReadingPosition(
  student: Pick<StudentRecord, 'scheduledClasses' | 'curriculumHistory'>,
  bookId: string,
  unitId: string,
  sectionOption?: ClassPrepSectionOptionLike,
): ClassPrepReadingPosition | undefined {
  const bid = bookId.trim()
  const uid = unitId.trim()
  if (!bid || !uid) return undefined

  let bestBookmarkPage: number | null = null
  let bestBookmarkTime = Number.NEGATIVE_INFINITY
  let bestHistoryPage: number | null = null
  let bestHistoryTime = Number.NEGATIVE_INFINITY

  const consider = (
    page: number,
    timeIso: string | undefined,
    target: 'bookmark' | 'history',
  ) => {
    if (!Number.isFinite(page) || page < 1) return
    const t = timeIso?.trim() ? Date.parse(timeIso) : NaN
    if (!Number.isFinite(t)) return
    const p = Math.max(1, Math.floor(page))
    if (target === 'bookmark') {
      if (bestBookmarkPage === null || t >= bestBookmarkTime) {
        bestBookmarkPage = p
        bestBookmarkTime = t
      }
      return
    }
    if (bestHistoryPage === null || t >= bestHistoryTime) {
      bestHistoryPage = p
      bestHistoryTime = t
    }
  }

  for (const session of student.scheduledClasses ?? []) {
    if (session.status !== 'completed') continue
    const bm = session.bookmarkAtEnd
    if (!bm?.bookId?.trim() || bm.bookId.trim() !== bid) continue
    const u = bm.unitId?.trim()
    if (u && u !== uid) continue
    consider(bm.pdfPage, session.classEndedAt ?? session.updatedAt ?? session.scheduledFor, 'bookmark')
  }

  for (const entry of student.curriculumHistory ?? []) {
    if (entry.bookId !== bid || entry.unitId !== uid) continue
    consider(entry.page, entry.closedAt ?? entry.openedAt, 'history')
  }

  const sectionPageRange =
    sectionOption?.startPageHint !== undefined || sectionOption?.endPageHint !== undefined
      ? { start: sectionOption?.startPageHint, end: sectionOption?.endPageHint }
      : undefined

  if (bestBookmarkPage !== null || bestHistoryPage !== null) {
    const useBookmark =
      bestBookmarkPage !== null &&
      (bestHistoryPage === null || bestBookmarkTime >= bestHistoryTime)
    const pdfPage = useBookmark ? bestBookmarkPage! : bestHistoryPage!
    const source: ClassPrepReadingSource = useBookmark ? 'last_class_bookmark' : 'reader_history'
    return {
      bookId: bid,
      unitId: uid,
      pdfPage,
      sectionPageRange,
      source,
      label: `Resume PDF page ${pdfPage}`,
    }
  }

  if (sectionOption?.startPageHint !== undefined && sectionOption.startPageHint >= 1) {
    const page = Math.floor(sectionOption.startPageHint)
    return {
      bookId: bid,
      unitId: uid,
      pdfPage: page,
      sectionPageRange,
      source: 'section_start_hint',
      label: `Start near section page ${page}`,
    }
  }

  return {
    bookId: bid,
    unitId: uid,
    sectionPageRange,
    source: 'none',
    label: 'No saved reading position yet',
  }
}

function hasRealReadingPosition(position: ClassPrepReadingPosition | undefined): boolean {
  if (!position) return false
  return position.source === 'last_class_bookmark' || position.source === 'reader_history'
}

function collectStrongWords(
  completedSessions: StudentClassSession[],
  savedWords: ParsedSavedWord[],
): string[] {
  const words: string[] = []
  for (const session of completedSessions) {
    words.push(...(session.learnedWords ?? []))
  }
  for (const entry of savedWords) {
    if (entry.status === 'mastered') words.push(entry.word)
  }
  return dedupeWords(words)
}

function collectNeedsPracticeWords(
  completedSessions: StudentClassSession[],
  savedWords: ParsedSavedWord[],
  nowMs: number,
): string[] {
  const words: string[] = []
  const learned = new Set<string>()

  for (const session of completedSessions) {
    for (const word of session.learnedWords ?? []) {
      learned.add(word.toLowerCase())
    }
    for (const row of session.vocabularyReviewPlan ?? []) {
      const dueAt = Date.parse(row.nextReviewAt)
      if (Number.isFinite(dueAt) && dueAt <= nowMs) {
        words.push(row.word)
      }
    }
  }

  const recentCompleted = [...completedSessions]
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())
    .slice(0, 3)

  for (const session of recentCompleted) {
    for (const word of [...(session.introducedWords ?? []), ...(session.practicedWords ?? [])]) {
      if (!learned.has(word.toLowerCase())) words.push(word)
    }
  }

  for (const entry of savedWords) {
    if (entry.status === 'new' || entry.status === 'learning') words.push(entry.word)
  }

  return dedupeWords(words)
}

function collectSavedNotebookWords(savedWords: ParsedSavedWord[]): string[] {
  return dedupeWords(savedWords.map((entry) => entry.word))
}

function resolvePrepContextMode(input: {
  completedClassCount: number
  vocabSignals: ClassPrepVocabSignals
  hasRealReadingPosition: boolean
}): ClassPrepContextMode {
  const hasClassVocab =
    input.vocabSignals.strongWords.length > 0 || input.vocabSignals.needsPracticeWords.length > 0
  const hasNotebookOnly =
    !hasClassVocab && input.vocabSignals.savedNotebookWords.length > 0

  if (input.completedClassCount > 0 || input.hasRealReadingPosition) return 'returning'
  if (hasNotebookOnly || hasClassVocab) return 'mixed'
  return 'clean_start'
}

export function dueReviewWordsForSession(
  session: StudentClassSession,
  asOfMs: number = Date.now(),
): string[] {
  const words: string[] = []
  for (const row of session.vocabularyReviewPlan ?? []) {
    const dueAt = Date.parse(row.nextReviewAt)
    if (Number.isFinite(dueAt) && dueAt <= asOfMs) words.push(row.word)
  }
  return dedupeWords(words, 8)
}

export function sessionNoteForHistory(session: StudentClassSession): string | undefined {
  const sessionNote = session.sessionNote?.trim()
  if (sessionNote) return sessionNote
  const classEndNote = session.classEndNote?.trim()
  if (classEndNote) return classEndNote
  return session.teacherNotes?.trim() || undefined
}

export interface CollectClassPrepSignalsInput {
  student: Pick<
    StudentRecord,
    'scheduledClasses' | 'curriculumHistory' | 'curriculumAnchorSectionId' | 'curriculumBookStarts'
  >
  resolvedSection?: { bookId: string; unitId: string }
  sectionOption?: ClassPrepSectionOptionLike
  savedWordEntries?: unknown[]
  namedRecurringIssues?: ClassPrepNamedIssue[]
  nowMs?: number
}

export function collectClassPrepSignals(input: CollectClassPrepSignalsInput): ClassPrepSignals {
  const nowMs = input.nowMs ?? Date.now()
  const sessions = input.student.scheduledClasses ?? []
  const completedSessions = sessions.filter((session) => session.status === 'completed')
  const completedClassCount = completedSessions.length
  const savedWords = parseSavedWordEntries(input.savedWordEntries)

  const readingPosition =
    input.resolvedSection && input.sectionOption
      ? resolveReadingPosition(
          input.student,
          input.resolvedSection.bookId,
          input.resolvedSection.unitId,
          input.sectionOption,
        )
      : input.resolvedSection
        ? resolveReadingPosition(
            input.student,
            input.resolvedSection.bookId,
            input.resolvedSection.unitId,
          )
        : undefined

  const vocabSignals: ClassPrepVocabSignals = {
    strongWords: collectStrongWords(completedSessions, savedWords),
    needsPracticeWords: collectNeedsPracticeWords(completedSessions, savedWords, nowMs),
    savedNotebookWords: collectSavedNotebookWords(savedWords),
  }

  const hasVocabSignals =
    vocabSignals.strongWords.length > 0 ||
    vocabSignals.needsPracticeWords.length > 0 ||
    vocabSignals.savedNotebookWords.length > 0

  const realReading = hasRealReadingPosition(readingPosition)
  const prepContextFlags: ClassPrepContextFlags = {
    completedClassCount,
    hasReadingPosition: realReading,
    hasVocabSignals,
    hasCurriculumAnchor: Boolean(
      input.student.curriculumAnchorSectionId?.trim() ||
        Object.keys(input.student.curriculumBookStarts ?? {}).length > 0,
    ),
    hasSelectedSection: Boolean(input.resolvedSection),
  }

  const prepContextMode = resolvePrepContextMode({
    completedClassCount,
    vocabSignals,
    hasRealReadingPosition: realReading,
  })

  return {
    readingPosition,
    vocabSignals,
    namedRecurringIssues: input.namedRecurringIssues ?? [],
    prepContextMode,
    prepContextFlags,
  }
}

export function formatPrepContextLine(signals: ClassPrepSignals): string {
  const { prepContextMode, prepContextFlags, readingPosition, vocabSignals } = signals
  const reinforceCount = vocabSignals.needsPracticeWords.length

  if (prepContextMode === 'clean_start') {
    if (prepContextFlags.hasSelectedSection) return 'First class — plan from book section'
    return 'First class — pick a book section for a tighter plan'
  }

  if (prepContextMode === 'mixed') {
    const savedCount = vocabSignals.savedNotebookWords.length
    if (savedCount > 0) {
      return `No past classes yet · ${savedCount} saved word${savedCount === 1 ? '' : 's'} included`
    }
    return 'No past classes yet · using notebook and section vocabulary'
  }

  if (prepContextMode === 'returning') {
    const realResume = hasRealReadingPosition(readingPosition)
    if (realResume && readingPosition?.pdfPage) {
      const pagePart = `Resuming page ${readingPosition.pdfPage}`
      if (reinforceCount > 0) {
        return `${pagePart} · ${reinforceCount} word${reinforceCount === 1 ? '' : 's'} to reinforce`
      }
      return pagePart
    }

    if (reinforceCount > 0) {
      return `${prepContextFlags.completedClassCount} past class${prepContextFlags.completedClassCount === 1 ? '' : 'es'} · ${reinforceCount} word${reinforceCount === 1 ? '' : 's'} to reinforce`
    }

    return `${prepContextFlags.completedClassCount} past class${prepContextFlags.completedClassCount === 1 ? '' : 'es'} on file`
  }

  return 'Prep context ready'
}
