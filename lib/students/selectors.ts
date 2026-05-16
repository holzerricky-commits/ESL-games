import { buildChallengeCatalogForQuizIds } from '@/lib/challenges'
import { buildPageAlignmentRuntime, resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { getFileAlignment } from '@/lib/books/page-range'
import { getReaderProgressMap } from '@/lib/books/progress'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import { DEFAULT_PLAY_TIER } from '@/lib/quiz-difficulty'
import {
  getKnownStudentSummaries,
  getQuizzes,
  getStudentProgressMap,
  getStudents,
  saveStudent,
  saveStudentProgressMap,
  saveStudents,
} from '@/lib/storage'
import { createInitialProgressRecord, reconcileProgressWithCatalog } from '@/lib/students/progression'
import { generateStudentId, normalizeStudentKey } from '@/lib/students/identity'
import {
  sanitizeMapPathSegments,
  syncAllSegmentEndpoints,
  clampMapPathStartPoint,
  computeCanvasMetrics,
  nodeIndexToCanvasPoint,
  resolveMapPathStartSegment,
  sanitizeMapPathStartSegmentForSave,
  type MapPathPoint,
  type MapPathSegments,
} from '@/lib/students/challenge-map-layout'
import { buildSectionPathLabel, getPartPrimaryLabel } from '@/lib/books/part-section-display'
import { isBookLessonPartTag, resolvePartStructureTag } from '@/lib/books/part-structure-tag'
import type { BookLibraryPayload, BookRecord, BookUnitRecord } from '@/lib/books/types'
import type { StudentListItemView, StudentProfileTab, StudentProfileView } from '@/lib/students/types'
import type { BookContextRecord } from '@/lib/context/types'
import type {
  ChallengeDefinition,
  BookSectionType,
  ClassSessionBookmarkAtEnd,
  DifficultyTier,
  LessonNotebookEntry,
  LessonNotebookSection,
  LessonNotebookSession,
  StudentBookSectionRef,
  StudentClassSession,
  StudentClassStatus,
  StudentProgressRecord,
  StudentRecord,
  TeacherWeeklyScheduleConfig,
  WeeklySlotAssignment,
} from '@/lib/types'

const NEXT_CLASS_LIST_PLACEHOLDER = 'No class scheduled.'
const WEEKLY_SCHEDULE_CONFIG_KEY = 'esl_weekly_schedule_config'
const WEEKLY_SLOT_ASSIGNMENTS_KEY = 'esl_weekly_slot_assignments'
const SLOT_MINUTES = 30 as const

const PROFILE_TABS: StudentProfileTab[] = ['challenges', 'curriculum', 'classes', 'map', 'avatar', 'info']
export type StudentMapNodeLayout = Record<string, { xPct: number; yPct: number }>
export type StudentMapPathSegments = MapPathSegments
export interface StudentCurriculumSessionInput {
  bookId: string
  unitId: string
  page: number
  openedAt?: string
  closedAt?: string
}

export interface StudentClassSessionInput {
  title: string
  scheduledFor: string
  durationMin: number
  status?: StudentClassStatus
  goals?: string[]
  activities?: string[]
  plannedVocabulary?: string[]
}

export interface StudentClassOutcomeInput {
  introducedWords?: string[]
  practicedWords?: string[]
  reviewedWords?: string[]
  learnedWords?: string[]
  teacherNotes?: string
}

export interface StudentClassPrepContext {
  studentName: string
  classTitle: string
  scheduledFor: string
  classDurationMin: number
  plannedVocabulary: string[]
  goals: string[]
  activities: string[]
  selectedSection?: StudentBookSectionRef
  sectionContext?: {
    title: string
    type: BookSectionType
    pathLabel: string
    startPageHint?: number
    endPageHint?: number
    sectionVocabulary: string[]
    checkpointIdeas: string[]
    contentSummary: string
  }
  bookContext?: {
    summary: string
    goals: string[]
    pacing: string[]
    instructionalPriorities: string[]
    focusAreas: string[]
    materials: Array<{
      type: BookContextRecord['materials'][number]['type']
      title: string
      url: string
      notes: string
      confidence: BookContextRecord['materials'][number]['confidence']
    }>
  }
  studentSnapshot: {
    levelLabel: string
    motivation: 'low' | 'medium' | 'high'
    firstOrEarlyClasses: boolean
  }
  recentHistory: Array<{
    title: string
    status: StudentClassStatus
    scheduledFor: string
    selectedSectionTitle?: string
    introducedWords: string[]
    practicedWords: string[]
    reviewedWords: string[]
    learnedWords: string[]
    notes?: string
  }>
}

export interface WeeklySlotAssignmentInput {
  dayOfWeek: number
  startMinute: number
  durationMinutes: 30 | 60
  studentId: string
}

export interface StudentSectionOption extends StudentBookSectionRef {
  pathLabel: string
  startPageHint?: number
  endPageHint?: number
}

function challengeIdToQuizId(challengeId: string): string {
  return challengeId.startsWith('challenge-') ? challengeId.slice('challenge-'.length) : challengeId
}

/** Persist explicit `assignedQuizIds` for registry rows that predate the field. */
export function ensureStudentAssignmentsMigrated(): void {
  if (typeof window === 'undefined') return
  const students = getStudents()
  const progressMap = getStudentProgressMap()
  let changed = false
  const next = students.map((s) => {
    if (Array.isArray(s.assignedQuizIds)) return s
    changed = true
    const key = normalizeStudentKey(s.name)
    const progress = progressMap[key]
    const ids =
      progress?.challenges?.length &&
      progress.challenges.every((c) => c.challengeId.startsWith('challenge-'))
        ? progress.challenges.map((c) => challengeIdToQuizId(c.challengeId))
        : []
    return { ...s, assignedQuizIds: ids, updatedAt: new Date().toISOString() }
  })
  if (changed) saveStudents(next)
}

function catalogForStudentRecord(record: StudentRecord | undefined, quizzes: ReturnType<typeof getQuizzes>) {
  const ids = Array.isArray(record?.assignedQuizIds) ? record!.assignedQuizIds! : []
  return buildChallengeCatalogForQuizIds(ids, quizzes)
}

function progressMatchesCatalog(progress: StudentProgressRecord, catalog: ChallengeDefinition[]): boolean {
  if (catalog.length !== progress.challenges.length) return false
  const expected = new Set(catalog.map((c) => c.id))
  return progress.challenges.every((row) => expected.has(row.challengeId))
}

function estimateLevel(totalAttempts: number): string {
  if (totalAttempts >= 20) return 'Level 4'
  if (totalAttempts >= 10) return 'Level 3'
  if (totalAttempts >= 5) return 'Level 2'
  return 'Level 1'
}

function estimateProgress(totalAttempts: number): string {
  const pct = Math.min(100, totalAttempts * 8)
  return `${pct}% progress`
}

function formatLastActive(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No recent activity'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dedupeTrimmed(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const v = raw.trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function sanitizeVocabularyFeedback(raw: unknown): StudentClassSession['vocabularyFeedback'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Partial<NonNullable<StudentClassSession['vocabularyFeedback']>>
  return {
    tooEasy: Number.isFinite(Number(src.tooEasy)) ? Math.max(0, Math.floor(Number(src.tooEasy))) : 0,
    offTheme: Number.isFinite(Number(src.offTheme)) ? Math.max(0, Math.floor(Number(src.offTheme))) : 0,
    wrongSkillSupport: Number.isFinite(Number(src.wrongSkillSupport))
      ? Math.max(0, Math.floor(Number(src.wrongSkillSupport)))
      : 0,
    editedMeaning: Number.isFinite(Number(src.editedMeaning)) ? Math.max(0, Math.floor(Number(src.editedMeaning))) : 0,
    removedWords: dedupeTrimmed(Array.isArray(src.removedWords) ? src.removedWords.map(String) : []).slice(0, 20),
  }
}

function sanitizeVocabularyReviewPlan(raw: unknown): NonNullable<StudentClassSession['vocabularyReviewPlan']> {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: NonNullable<StudentClassSession['vocabularyReviewPlan']> = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const src = row as Partial<NonNullable<StudentClassSession['vocabularyReviewPlan']>[number]>
    const word = typeof src.word === 'string' ? src.word.trim() : ''
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const lastSeenAt = typeof src.lastSeenAt === 'string' && src.lastSeenAt.trim() ? src.lastSeenAt : new Date().toISOString()
    const intervalDays = Number.isFinite(Number(src.intervalDays)) ? Math.max(1, Math.min(30, Math.floor(Number(src.intervalDays)))) : 3
    const nextReviewAt =
      typeof src.nextReviewAt === 'string' && src.nextReviewAt.trim()
        ? src.nextReviewAt
        : new Date(new Date(lastSeenAt).getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString()
    out.push({ word, lastSeenAt, intervalDays, nextReviewAt })
  }
  return out
}

function sanitizePracticeItems(raw: unknown): NonNullable<StudentClassSession['practiceItems']> {
  if (!Array.isArray(raw)) return []
  const out: NonNullable<StudentClassSession['practiceItems']> = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const src = row as Partial<NonNullable<StudentClassSession['practiceItems']>[number]>
    const id = typeof src.id === 'string' ? src.id.trim() : ''
    const word = typeof src.word === 'string' ? src.word.trim() : ''
    const prompt = typeof src.prompt === 'string' ? src.prompt.trim() : ''
    const choices = Array.isArray(src.choices) ? src.choices.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 4) : []
    const correctChoiceIndex = Number.isFinite(Number(src.correctChoiceIndex)) ? Number(src.correctChoiceIndex) : -1
    if (!id || !word || !prompt || choices.length < 2 || correctChoiceIndex < 0 || correctChoiceIndex >= choices.length) continue
    out.push({
      id,
      type: 'meaning_match',
      word,
      prompt,
      choices,
      correctChoiceIndex,
      createdAt: typeof src.createdAt === 'string' && src.createdAt.trim() ? src.createdAt : new Date().toISOString(),
    })
    if (out.length >= 24) break
  }
  return out
}

function sanitizeLessonRangeOverrides(raw: unknown): NonNullable<StudentRecord['lessonRangeOverrides']> {
  if (!raw || typeof raw !== 'object') return {}
  const out: NonNullable<StudentRecord['lessonRangeOverrides']> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || !value || typeof value !== 'object') continue
    const src = value as { startPage?: unknown; endPage?: unknown; updatedAt?: unknown }
    const start = Number(src.startPage)
    const end = Number(src.endPage)
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    const startPage = Math.max(1, Math.floor(start))
    const endPage = Math.max(startPage, Math.floor(end))
    out[key] = {
      startPage,
      endPage,
      updatedAt: typeof src.updatedAt === 'string' && src.updatedAt.trim() ? src.updatedAt : new Date().toISOString(),
    }
  }
  return out
}

function intervalForWord(
  word: string,
  outcome: StudentClassOutcomeInput,
  existingIntervalDays?: number,
): number {
  const lower = word.toLowerCase()
  const inList = (list?: string[]) => (list ?? []).some((item) => item.trim().toLowerCase() === lower)
  const learned = inList(outcome.learnedWords)
  const reviewed = inList(outcome.reviewedWords)
  const practiced = inList(outcome.practicedWords)
  let base = learned ? 14 : reviewed ? 7 : practiced ? 3 : 2
  if (typeof existingIntervalDays === 'number' && Number.isFinite(existingIntervalDays)) {
    base = Math.max(base, Math.min(30, existingIntervalDays + (learned ? 4 : reviewed ? 2 : 0)))
  }
  return base
}

function buildUpdatedReviewPlan(
  previous: NonNullable<StudentClassSession['vocabularyReviewPlan']>,
  outcome: StudentClassOutcomeInput,
  sessionIso: string,
): NonNullable<StudentClassSession['vocabularyReviewPlan']> {
  const map = new Map(previous.map((item) => [item.word.toLowerCase(), item]))
  const touched = dedupeTrimmed([
    ...(outcome.introducedWords ?? []),
    ...(outcome.practicedWords ?? []),
    ...(outcome.reviewedWords ?? []),
    ...(outcome.learnedWords ?? []),
  ])
  for (const word of touched) {
    const key = word.toLowerCase()
    const prior = map.get(key)
    const intervalDays = intervalForWord(word, outcome, prior?.intervalDays)
    const lastSeenAt = sessionIso
    const nextReviewAt = new Date(new Date(lastSeenAt).getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString()
    map.set(key, { word, intervalDays, lastSeenAt, nextReviewAt })
  }
  return Array.from(map.values()).sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime())
}

function normalizeClassStatus(status: unknown): StudentClassStatus {
  if (status === 'prepared' || status === 'completed' || status === 'cancelled' || status === 'in_progress') {
    return status
  }
  return 'planned'
}

function optionalIsoString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (!t) return undefined
  return Number.isFinite(Date.parse(t)) ? t : undefined
}

function sanitizeClassEndNote(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (!t) return undefined
  return t.length > 8000 ? t.slice(0, 8000) : t
}

/** Session log (longer than recap); same trim rules, slightly higher cap. */
function sanitizeSessionNote(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (!t) return undefined
  return t.length > 12000 ? t.slice(0, 12000) : t
}

function sanitizeBookmarkAtEnd(raw: unknown): ClassSessionBookmarkAtEnd | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const bookId = typeof o.bookId === 'string' ? o.bookId.trim() : ''
  const n = Number(o.pdfPage)
  if (!bookId || !Number.isFinite(n)) return undefined
  const pdfPage = Math.max(1, Math.floor(n))
  const unitId = typeof o.unitId === 'string' && o.unitId.trim() ? o.unitId.trim() : undefined
  return { bookId, pdfPage, unitId }
}

function sanitizeSelectedSection(raw: unknown): StudentBookSectionRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Partial<StudentBookSectionRef>
  const id = typeof source.id === 'string' ? source.id.trim() : ''
  const title = typeof source.title === 'string' ? source.title.trim() : ''
  const bookId = typeof source.bookId === 'string' ? source.bookId.trim() : ''
  const bookTitle = typeof source.bookTitle === 'string' ? source.bookTitle.trim() : ''
  const unitId = typeof source.unitId === 'string' ? source.unitId.trim() : ''
  const unitTitle = typeof source.unitTitle === 'string' ? source.unitTitle.trim() : ''
  const type: BookSectionType =
    source.type === 'part' || source.type === 'lesson' || source.type === 'unit' ? source.type : 'unit'
  if (!id || !title || !bookId || !bookTitle || !unitId || !unitTitle) return undefined
  const partStructureTag = isBookLessonPartTag(source.partStructureTag) ? source.partStructureTag : undefined
  return {
    id,
    type,
    bookId,
    bookTitle,
    unitId,
    unitTitle,
    lessonId: typeof source.lessonId === 'string' && source.lessonId.trim() ? source.lessonId.trim() : undefined,
    lessonTitle:
      typeof source.lessonTitle === 'string' && source.lessonTitle.trim() ? source.lessonTitle.trim() : undefined,
    partId: typeof source.partId === 'string' && source.partId.trim() ? source.partId.trim() : undefined,
    partTitle: typeof source.partTitle === 'string' && source.partTitle.trim() ? source.partTitle.trim() : undefined,
    title,
    startPageHint:
      typeof source.startPageHint === 'number' && Number.isFinite(source.startPageHint) && source.startPageHint >= 1
        ? Math.floor(source.startPageHint)
        : undefined,
    endPageHint:
      typeof source.endPageHint === 'number' && Number.isFinite(source.endPageHint) && source.endPageHint >= 1
        ? Math.floor(source.endPageHint)
        : undefined,
    ...(partStructureTag ? { partStructureTag } : {}),
  }
}

function makeNotebookId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeNotebookEntry(raw: unknown): LessonNotebookEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<LessonNotebookEntry>
  const entryId = typeof src.entryId === 'string' ? src.entryId.trim() : ''
  const sectionId = typeof src.sectionId === 'string' ? src.sectionId.trim() : ''
  if (!entryId || !sectionId) return null
  const nowIso = new Date().toISOString()
  return {
    entryId,
    sectionId,
    layer: src.layer === 'overlay' ? 'overlay' : 'doc',
    payload: src.payload && typeof src.payload === 'object' ? src.payload : {},
    createdAt: typeof src.createdAt === 'string' && src.createdAt.trim() ? src.createdAt : nowIso,
    updatedAt: typeof src.updatedAt === 'string' && src.updatedAt.trim() ? src.updatedAt : nowIso,
  }
}

function sanitizeNotebookSection(raw: unknown, fallbackSessionId: string): LessonNotebookSection | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<LessonNotebookSection>
  const sectionId = typeof src.sectionId === 'string' ? src.sectionId.trim() : ''
  const anchorKey = typeof src.anchorKey === 'string' ? src.anchorKey.trim() : ''
  const title = typeof src.title === 'string' ? src.title.trim() : ''
  if (!sectionId || !anchorKey || !title) return null
  const entriesRaw = Array.isArray(src.entries) ? src.entries : []
  const entries = entriesRaw
    .map((item) => sanitizeNotebookEntry(item))
    .filter((item): item is LessonNotebookEntry => !!item)
  return {
    sectionId,
    sessionId:
      typeof src.sessionId === 'string' && src.sessionId.trim()
        ? src.sessionId.trim()
        : fallbackSessionId,
    anchorType: src.anchorType === 'toc_part' ? 'toc_part' : 'page_span',
    anchorKey,
    title,
    order: Number.isFinite(Number(src.order)) ? Math.max(0, Math.floor(Number(src.order))) : 0,
    entries,
  }
}

function sanitizeLessonNotebookSession(
  raw: unknown,
  classSessionId: string,
  studentId: string,
): LessonNotebookSession | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Partial<LessonNotebookSession>
  const notebookSessionId = typeof src.sessionId === 'string' ? src.sessionId.trim() : ''
  const bookId = typeof src.bookId === 'string' ? src.bookId.trim() : ''
  if (!notebookSessionId || !bookId) return undefined
  const sectionsRaw = Array.isArray(src.sections) ? src.sections : []
  const sections = sectionsRaw
    .map((item) => sanitizeNotebookSection(item, notebookSessionId))
    .filter((item): item is LessonNotebookSection => !!item)
    .sort((a, b) => a.order - b.order)
  const startedAt = optionalIsoString(src.startedAt) ?? new Date().toISOString()
  return {
    sessionId: notebookSessionId,
    studentId:
      typeof src.studentId === 'string' && src.studentId.trim() ? src.studentId.trim() : studentId,
    classSessionId:
      typeof src.classSessionId === 'string' && src.classSessionId.trim()
        ? src.classSessionId.trim()
        : classSessionId,
    bookId,
    unitId: typeof src.unitId === 'string' && src.unitId.trim() ? src.unitId.trim() : undefined,
    startedAt,
    endedAt: optionalIsoString(src.endedAt),
    sections,
  }
}

function formatNotebookPageSpan(startPageHint?: number, endPageHint?: number): string {
  const start =
    typeof startPageHint === 'number' && Number.isFinite(startPageHint) && startPageHint >= 1
      ? Math.floor(startPageHint)
      : 1
  const end =
    typeof endPageHint === 'number' && Number.isFinite(endPageHint) && endPageHint >= start
      ? Math.floor(endPageHint)
      : start
  return end > start ? `p${start}-${end}` : `p${start}`
}

export function buildNotebookPageSpanKey(startPage: number, endPage?: number | null): string {
  const start = Number.isFinite(Number(startPage)) ? Math.max(1, Math.floor(Number(startPage))) : 1
  const rawEnd = Number.isFinite(Number(endPage)) ? Math.max(start, Math.floor(Number(endPage))) : start
  return rawEnd > start ? `p${start}-${rawEnd}` : `p${start}`
}

function createInitialLessonNotebookSession(student: StudentRecord, session: StudentClassSession): LessonNotebookSession {
  const nowIso = new Date().toISOString()
  const section = session.selectedSection
  const pageSpan = formatNotebookPageSpan(section?.startPageHint, section?.endPageHint)
  const bookId = section?.bookId?.trim() || student.assignedBookIds?.[0]?.trim() || 'unknown-book'
  const unitId = section?.unitId?.trim() || student.assignedUnitRefs?.find((row) => row.bookId === bookId)?.unitId?.trim()
  const notebookSessionId = makeNotebookId('lesson-notebook')
  const notebookSectionId = makeNotebookId('lesson-notebook-section')
  const dateLabel = new Date(session.scheduledFor).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const lessonPartLabel = (section?.partTitle ?? section?.lessonTitle ?? section?.title ?? '').trim()
  const pageLabel = pageSpan.startsWith('p') ? pageSpan.slice(1) : pageSpan
  const headerEntry: LessonNotebookEntry = {
    entryId: makeNotebookId('lesson-notebook-entry'),
    sectionId: notebookSectionId,
    layer: 'doc',
    payload: {
      kind: 'header_block',
      title: lessonPartLabel || section?.title?.trim() || session.title,
      dateLabel,
      lessonPartLabel,
      pageLabel,
      pageSpan,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  }
  return {
    sessionId: notebookSessionId,
    studentId: student.id,
    classSessionId: session.id,
    bookId,
    unitId,
    startedAt: session.classStartedAt ?? nowIso,
    sections: [
      {
        sectionId: notebookSectionId,
        sessionId: notebookSessionId,
        anchorType: 'page_span',
        anchorKey: pageSpan,
        title: pageSpan,
        order: 0,
        entries: [headerEntry],
      },
    ],
  }
}

function flattenUnitSections(book: BookRecord, unit: BookUnitRecord): StudentSectionOption[] {
  const out: StudentSectionOption[] = []
  const unitBase = {
    bookId: book.id,
    bookTitle: book.title,
    unitId: unit.id,
    unitTitle: unit.title,
  }
  const lessons = unit.lessons ?? []
  if (!lessons.length) {
    out.push({
      id: `unit:${book.id}:${unit.id}`,
      type: 'unit',
      ...unitBase,
      title: unit.title,
      pathLabel: `${book.title} / ${unit.title}`,
      startPageHint: unit.startPageHint,
      endPageHint: unit.endPageHint,
    })
    return out
  }
  for (let li = 0; li < lessons.length; li++) {
    const lesson = lessons[li]!
    const lessonRange = pageRangeForIndex(lessons, li)
    if (lesson.parts?.length) {
      const parts = lesson.parts
      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi]!
        const tag = resolvePartStructureTag(part, pi)
        const displayTitle = getPartPrimaryLabel(tag, part.title)
        const partRange = pageRangeForIndex(parts, pi, lessonRange.start, lessonRange.end)
        out.push({
          id: `part:${book.id}:${unit.id}:${lesson.id}:${part.id}`,
          type: 'part',
          ...unitBase,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          partId: part.id,
          partTitle: displayTitle,
          title: displayTitle,
          partStructureTag: tag,
          pathLabel: buildSectionPathLabel(book.title, unit.title, lesson.title, displayTitle),
          startPageHint: part.startPageHint ?? lesson.startPageHint ?? unit.startPageHint,
          endPageHint:
            part.endPageHint ??
            lesson.endPageHint ??
            unit.endPageHint ??
            (partRange.end ?? undefined),
        })
      }
      continue
    }
    out.push({
      id: `lesson:${book.id}:${unit.id}:${lesson.id}`,
      type: 'lesson',
      ...unitBase,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      title: lesson.title,
      pathLabel: `${book.title} / ${unit.title} / ${lesson.title}`,
      startPageHint: lesson.startPageHint ?? unit.startPageHint,
      endPageHint: lesson.endPageHint ?? unit.endPageHint ?? (lessonRange.end ?? undefined),
    })
  }
  return out
}

function sanitizeClassSession(raw: Partial<StudentClassSession> | null | undefined): StudentClassSession | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.scheduledFor !== 'string')
    return null
  const id = raw.id.trim()
  const title = raw.title.trim()
  const scheduledFor = raw.scheduledFor.trim()
  if (!id || !title || !scheduledFor) return null
  const now = new Date().toISOString()
  return {
    id,
    sourceSlotId: typeof raw.sourceSlotId === 'string' && raw.sourceSlotId.trim() ? raw.sourceSlotId.trim() : undefined,
    title,
    scheduledFor,
    durationMin:
      typeof raw.durationMin === 'number' && Number.isFinite(raw.durationMin)
        ? Math.max(15, Math.min(240, Math.floor(raw.durationMin)))
        : 45,
    status: normalizeClassStatus(raw.status),
    goals: dedupeTrimmed(Array.isArray(raw.goals) ? raw.goals : []),
    activities: dedupeTrimmed(Array.isArray(raw.activities) ? raw.activities : []),
    plannedVocabulary: dedupeTrimmed(Array.isArray(raw.plannedVocabulary) ? raw.plannedVocabulary : []),
    vocabularySetId:
      typeof raw.vocabularySetId === 'string' && raw.vocabularySetId.trim() ? raw.vocabularySetId.trim() : undefined,
    vocabularySetStatus:
      raw.vocabularySetStatus === 'draft' || raw.vocabularySetStatus === 'approved' || raw.vocabularySetStatus === 'published'
        ? raw.vocabularySetStatus
        : undefined,
    unitContextId:
      typeof raw.unitContextId === 'string' && raw.unitContextId.trim() ? raw.unitContextId.trim() : undefined,
    lessonContextId:
      typeof raw.lessonContextId === 'string' && raw.lessonContextId.trim() ? raw.lessonContextId.trim() : undefined,
    selectedSection: sanitizeSelectedSection(raw.selectedSection),
    introducedWords: dedupeTrimmed(Array.isArray(raw.introducedWords) ? raw.introducedWords : []),
    practicedWords: dedupeTrimmed(Array.isArray(raw.practicedWords) ? raw.practicedWords : []),
    reviewedWords: dedupeTrimmed(Array.isArray(raw.reviewedWords) ? raw.reviewedWords : []),
    learnedWords: dedupeTrimmed(Array.isArray(raw.learnedWords) ? raw.learnedWords : []),
    vocabularyFeedback: sanitizeVocabularyFeedback(raw.vocabularyFeedback),
    vocabularyReviewPlan: sanitizeVocabularyReviewPlan(raw.vocabularyReviewPlan),
    practiceItems: sanitizePracticeItems(raw.practiceItems),
    teacherNotes: typeof raw.teacherNotes === 'string' && raw.teacherNotes.trim() ? raw.teacherNotes.trim() : undefined,
    aiPrepSummary:
      typeof raw.aiPrepSummary === 'string' && raw.aiPrepSummary.trim() ? raw.aiPrepSummary.trim() : undefined,
    classStartedAt: optionalIsoString(raw.classStartedAt),
    classEndedAt: optionalIsoString(raw.classEndedAt),
    classEndNote: sanitizeClassEndNote(raw.classEndNote),
    sessionNote: sanitizeSessionNote(raw.sessionNote),
    postClassRecapPromptDismissed: raw.postClassRecapPromptDismissed === true ? true : undefined,
    bookmarkAtEnd: sanitizeBookmarkAtEnd(raw.bookmarkAtEnd),
    lessonNotebookSession: sanitizeLessonNotebookSession(raw.lessonNotebookSession, id, ''),
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : now,
  }
}

function sanitizeWeeklyScheduleConfig(
  raw: Partial<TeacherWeeklyScheduleConfig> | null | undefined,
): TeacherWeeklyScheduleConfig {
  const rawDays = Array.isArray(raw?.workingDays) ? raw.workingDays : [1, 2, 3, 4, 5]
  const workingDays = Array.from(
    new Set(
      rawDays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ).sort((a, b) => a - b)
  const startMinute = Number.isFinite(raw?.startMinute) ? Number(raw?.startMinute) : 9 * 60
  const endMinute = Number.isFinite(raw?.endMinute) ? Number(raw?.endMinute) : 17 * 60
  const normalizedStart = Math.max(0, Math.min(23 * 60 + 30, Math.floor(startMinute / SLOT_MINUTES) * SLOT_MINUTES))
  const normalizedEnd = Math.max(
    normalizedStart + SLOT_MINUTES,
    Math.min(24 * 60, Math.floor(endMinute / SLOT_MINUTES) * SLOT_MINUTES),
  )
  return {
    workingDays: workingDays.length > 0 ? workingDays : [1, 2, 3, 4, 5],
    startMinute: normalizedStart,
    endMinute: normalizedEnd,
    slotMinutes: SLOT_MINUTES,
  }
}

function sanitizeWeeklySlotAssignment(raw: Partial<WeeklySlotAssignment> | null | undefined): WeeklySlotAssignment | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.studentId !== 'string') return null
  const id = raw.id.trim()
  const studentId = raw.studentId.trim()
  if (!id || !studentId) return null
  const dayOfWeek = Number(raw.dayOfWeek)
  const startMinute = Number(raw.startMinute)
  const durationMinutes = Number(raw.durationMinutes) === 60 ? 60 : 30
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null
  if (!Number.isFinite(startMinute)) return null
  const nowIso = new Date().toISOString()
  return {
    id,
    dayOfWeek,
    startMinute: Math.max(0, Math.min(23 * 60 + 30, Math.floor(startMinute / SLOT_MINUTES) * SLOT_MINUTES)),
    durationMinutes,
    studentId,
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : nowIso,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : nowIso,
  }
}

function overlapsSlot(a: WeeklySlotAssignment, b: WeeklySlotAssignment): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false
  const aStart = a.startMinute
  const aEnd = a.startMinute + a.durationMinutes
  const bStart = b.startMinute
  const bEnd = b.startMinute + b.durationMinutes
  return aStart < bEnd && bStart < aEnd
}

function isoForSlotDate(date: Date, startMinute: number): string {
  const out = new Date(date)
  out.setHours(0, 0, 0, 0)
  out.setMinutes(startMinute)
  return out.toISOString()
}

function sortClassesByDate(sessions: StudentClassSession[]): StudentClassSession[] {
  return [...sessions].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
}

function computeNextClass(sessions: StudentClassSession[]): StudentClassSession | null {
  const now = Date.now()
  const upcoming = sessions
    .filter((session) => {
      if (session.status === 'completed' || session.status === 'cancelled' || session.status === 'in_progress')
        return false
      const ms = new Date(session.scheduledFor).getTime()
      return Number.isFinite(ms) && ms >= now
    })
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
  return upcoming[0] ?? null
}

function formatNextClassLabel(nextClass: StudentClassSession | null): string {
  if (!nextClass) return NEXT_CLASS_LIST_PLACEHOLDER
  const date = new Date(nextClass.scheduledFor)
  if (Number.isNaN(date.getTime())) return nextClass.title
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${nextClass.title}`
}

export function getStudentsListView(library?: BookLibraryPayload | null): StudentListItemView[] {
  ensureStudentAssignmentsMigrated()
  generateScheduledClassesWindow(30)
  const knownStudents = getKnownStudentSummaries()
  const storedStudents = getStudents()
  const studentsByKey = new Map(storedStudents.map((student) => [normalizeStudentKey(student.name), student]))
  const quizzes = getQuizzes()
  const progressMap = getStudentProgressMap()
  let dirty = false

  for (const known of knownStudents) {
    const key = normalizeStudentKey(known.name)
    if (studentsByKey.has(key)) continue
    const now = new Date().toISOString()
    const created: StudentRecord = {
      id: generateStudentId(),
      name: known.name,
      createdAt: now,
      updatedAt: now,
      assignedQuizIds: [],
    }
    saveStudent(created)
    studentsByKey.set(key, created)
  }

  const knownByKey = new Map(knownStudents.map((student) => [normalizeStudentKey(student.name), student]))
  const allStudents = [...studentsByKey.values()].sort((a, b) => a.name.localeCompare(b.name))

  const students = allStudents.map((student) => {
    const studentKey = normalizeStudentKey(student.name)
    const known = knownByKey.get(studentKey)
    const catalog = catalogForStudentRecord(student, quizzes)
    let progress = progressMap[studentKey]
    if (!progress) {
      progress = createInitialProgressRecord(studentKey, catalog)
      progressMap[studentKey] = progress
      dirty = true
    } else if (!progressMatchesCatalog(progress, catalog)) {
      progress = reconcileProgressWithCatalog(progress, catalog)
      progressMap[studentKey] = progress
      dirty = true
    }

    const completedCount = progress.challenges.filter((challenge) => challenge.status === 'completed').length
    const unlockedChallenge = progress.challenges.find((challenge) => challenge.status === 'unlocked')
    const unlockedOrder = unlockedChallenge
      ? (catalog.find((challenge) => challenge.id === unlockedChallenge.challengeId)?.order ?? 0)
      : 0
    const currentChallengeLabel =
      catalog.length === 0
        ? 'No challenges assigned yet'
        : unlockedOrder > 0
          ? `Current challenge: ${unlockedOrder}`
          : completedCount >= catalog.length && catalog.length > 0
            ? 'All assigned challenges completed'
            : 'No challenges assigned yet'

    const progressLabel =
      catalog.length > 0
        ? `${Math.round((completedCount / catalog.length) * 100)}% progress`
        : estimateProgress(known?.totalQuizzes ?? 0)

    const curriculum = resolveCurriculumForStudentCard(student, library)
    const scheduledClasses = sortClassesByDate(
      (student.scheduledClasses ?? [])
        .map((session) => sanitizeClassSession(session))
        .filter((session): session is StudentClassSession => !!session),
    )
    const nextClass = computeNextClass(scheduledClasses)

    return {
      id: student.id,
      studentKey,
      name: student.name,
      levelLabel: estimateLevel(known?.totalQuizzes ?? 0),
      progressLabel,
      coinsLabel: `Coins: ${progress.totalCoins}`,
      currentChallengeLabel,
      totalAttempts: known?.totalQuizzes ?? 0,
      lastActiveLabel: known ? formatLastActive(known.lastDate) : 'No activity yet',
      nextClassLabel: formatNextClassLabel(nextClass),
      curriculumBookLabel: curriculum.book,
      curriculumUnitLabel: curriculum.unit,
      curriculumPageLabel: curriculum.page,
      curriculumThumbFilePath: curriculum.thumbFilePath,
      curriculumThumbUnitId: curriculum.thumbUnitId,
      curriculumThumbPage: curriculum.thumbPage,
    }
  })

  if (dirty) saveStudentProgressMap(progressMap)
  return students
}

export function getStudentProfileView(studentId: string): StudentProfileView | null {
  generateScheduledClassesWindow(30)
  const students = getStudentsListView()
  const student =
    students.find((item) => item.id === studentId) ??
    students.find((item) =>
      item.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === studentId,
    )
  if (!student) return null
  const registryRecord = getStudents().find((s) => s.id === student.id)
  const scheduledClasses = sortClassesByDate(
    (registryRecord?.scheduledClasses ?? [])
      .map((session) => sanitizeClassSession(session))
      .filter((session): session is StudentClassSession => !!session),
  )
  const progress = getStudentProgressMap()[student.studentKey]
  const challengeItems = getChallengeItemsForStudent(student.studentKey)
  const challengeTitleById = new Map(challengeItems.map((item) => [item.id, item.title]))
  const rawTxs = [...(progress?.coinTransactions ?? [])]
  const chronological = [...rawTxs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  let running = 0
  const balanceAfterById = new Map<string, number>()
  for (const tx of chronological) {
    running += tx.amount
    balanceAfterById.set(tx.id, running)
  }
  const coinTransactions = [...rawTxs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      createdAt: tx.createdAt,
      reasonLabel: 'Challenge completion',
      challengeTitle: challengeTitleById.get(tx.challengeId),
      balanceAfter: balanceAfterById.get(tx.id) ?? 0,
    }))

  return {
    ...student,
    completedChallengesLabel: `${student.progressLabel.replace(' progress', '')} complete`,
    nextChallengeLabel: student.currentChallengeLabel,
    recentActivity: [
      `Last active ${student.lastActiveLabel}`,
      `${student.totalAttempts} total attempts recorded`,
      student.currentChallengeLabel,
    ],
    practiceSummary: 'Practice assignments will appear here.',
    challengeSummary:
      'Assign quizzes below in order; the student unlocks the path one step at a time. Empty until you assign.',
    totalCoins: progress?.totalCoins ?? 0,
    coinTransactions,
    challengeItems,
    avatarSummary: 'Avatar unlocks and cosmetics will plug in here.',
    infoSummary: 'Your teacher manages your path and settings from the plan screen.',
    defaultDifficultyTier: registryRecord?.defaultDifficultyTier ?? DEFAULT_PLAY_TIER,
    assignedBookIds: dedupeStrings(registryRecord?.assignedBookIds ?? []),
    assignedUnitRefs: dedupeUnitRefs(registryRecord?.assignedUnitRefs ?? []),
    curriculumAnchorSectionId: registryRecord?.curriculumAnchorSectionId?.trim() || undefined,
    curriculumHistory: [...(registryRecord?.curriculumHistory ?? [])].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    ),
    scheduledClasses,
  }
}

function getChallengeItemsForStudent(studentKey: string) {
  ensureStudentAssignmentsMigrated()
  const quizzes = getQuizzes()
  const record = getStudents().find((s) => normalizeStudentKey(s.name) === studentKey)
  const catalog = catalogForStudentRecord(record, quizzes)
  const map = getStudentProgressMap()
  const progress = map[studentKey] ?? createInitialProgressRecord(studentKey, catalog)
  const byId = new Map(progress.challenges.map((challenge) => [challenge.challengeId, challenge]))
  return catalog.map((challenge) => {
    const saved = byId.get(challenge.id)
    return {
      id: challenge.id,
      quizId: challenge.quizId,
      title: challenge.title,
      description: challenge.description,
      status: saved?.status ?? 'locked',
      bestScorePct: saved?.bestScorePct ?? 0,
      attemptCount: saved?.attemptCount ?? 0,
      coinReward: challenge.coinReward,
    }
  })
}

export function isValidStudentProfileTab(tab: string | null | undefined): tab is StudentProfileTab {
  return !!tab && PROFILE_TABS.includes(tab as StudentProfileTab)
}

function dedupeQuizIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function dedupeStrings(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

function dedupeUnitRefs(
  refs: Array<{ bookId: string; unitId: string }>,
): Array<{ bookId: string; unitId: string }> {
  const seen = new Set<string>()
  const out: Array<{ bookId: string; unitId: string }> = []
  for (const ref of refs) {
    const bookId = ref.bookId.trim()
    const unitId = ref.unitId.trim()
    if (!bookId || !unitId) continue
    const key = `${bookId}::${unitId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ bookId, unitId })
  }
  return out
}

function resolveCurriculumForStudentCard(
  record: StudentRecord,
  library: BookLibraryPayload | null | undefined,
  numberingMode: PageNumberingMode = 'mapped',
): {
  book: string
  unit: string
  page: string
  thumbFilePath: string | null
  thumbUnitId: string | null
  thumbPage: number | null
} {
  const books = library?.books ?? []
  const bookMap = new Map(books.map((b) => [b.id, b]))
  const resolveBook = (bookId: string) => {
    const t = bookMap.get(bookId)?.title?.trim()
    return t || bookId || '—'
  }
  const resolveUnit = (bookId: string, unitId: string) => {
    const unit = bookMap.get(bookId)?.units.find((u) => u.id === unitId)
    const t = unit?.title?.trim()
    return t || unitId || '—'
  }
  const unitFilePath = (bookId: string, unitId: string): string | null => {
    const fp = bookMap.get(bookId)?.units.find((u) => u.id === unitId)?.filePath?.trim()
    return fp || null
  }

  const history = [...(record.curriculumHistory ?? [])].sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  )
  if (history.length > 0) {
    const h = history[0]
    const pageNum = Number.isFinite(h.page) ? Math.max(1, Math.floor(h.page)) : 1
    const histBook = bookMap.get(h.bookId)
    const histUnit = histBook?.units.find((u) => u.id === h.unitId)
    const displayPage = mapPdfPageToDisplayLabel(pageNum, histBook, histUnit, null, numberingMode)
    const fp = unitFilePath(h.bookId, h.unitId)
    return {
      book: resolveBook(h.bookId),
      unit: resolveUnit(h.bookId, h.unitId),
      page: displayPage,
      thumbFilePath: fp,
      thumbUnitId: fp ? h.unitId : null,
      thumbPage: fp ? pageNum : null,
    }
  }

  const refs = dedupeUnitRefs(record.assignedUnitRefs ?? [])
  if (refs.length > 0) {
    const r = refs[0]
    const fp = unitFilePath(r.bookId, r.unitId)
    return {
      book: resolveBook(r.bookId),
      unit: resolveUnit(r.bookId, r.unitId),
      page: '—',
      thumbFilePath: fp,
      thumbUnitId: fp ? r.unitId : null,
      thumbPage: fp ? 1 : null,
    }
  }

  const bookIds = record.assignedBookIds ?? []
  if (bookIds.length > 0) {
    const bid = bookIds[0]
    return {
      book: resolveBook(bid),
      unit: '—',
      page: '—',
      thumbFilePath: null,
      thumbUnitId: null,
      thumbPage: null,
    }
  }

  return {
    book: 'Not assigned',
    unit: '—',
    page: '—',
    thumbFilePath: null,
    thumbUnitId: null,
    thumbPage: null,
  }
}

/** Ordered challenge path for a student; used by the teacher Challenges tab. */
export function getStudentAssignedQuizIds(studentId: string): string[] | null {
  ensureStudentAssignmentsMigrated()
  const student = getStudents().find((s) => s.id === studentId)
  if (!student) return null
  return Array.isArray(student.assignedQuizIds) ? [...student.assignedQuizIds] : []
}

export function getTeacherWeeklyScheduleConfig(): TeacherWeeklyScheduleConfig {
  if (typeof window === 'undefined') return sanitizeWeeklyScheduleConfig(null)
  try {
    const raw = localStorage.getItem(WEEKLY_SCHEDULE_CONFIG_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<TeacherWeeklyScheduleConfig>) : null
    return sanitizeWeeklyScheduleConfig(parsed)
  } catch {
    return sanitizeWeeklyScheduleConfig(null)
  }
}

export function saveTeacherWeeklyScheduleConfig(input: Partial<TeacherWeeklyScheduleConfig>): { ok: true } {
  if (typeof window !== 'undefined') {
    const next = sanitizeWeeklyScheduleConfig(input)
    localStorage.setItem(WEEKLY_SCHEDULE_CONFIG_KEY, JSON.stringify(next))
  }
  generateScheduledClassesWindow(30)
  return { ok: true }
}

export function getWeeklySlotAssignments(): WeeklySlotAssignment[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(WEEKLY_SLOT_ASSIGNMENTS_KEY)
    const parsed = raw ? (JSON.parse(raw) as Array<Partial<WeeklySlotAssignment>>) : []
    return parsed
      .map((item) => sanitizeWeeklySlotAssignment(item))
      .filter((item): item is WeeklySlotAssignment => !!item)
      .sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.startMinute - b.startMinute))
  } catch {
    return []
  }
}

function saveWeeklySlotAssignments(next: WeeklySlotAssignment[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(WEEKLY_SLOT_ASSIGNMENTS_KEY, JSON.stringify(next))
}

export function upsertWeeklySlotAssignment(
  input: WeeklySlotAssignmentInput,
): { ok: true; assignment: WeeklySlotAssignment } | { ok: false; error: string } {
  const students = getStudents()
  if (!students.some((student) => student.id === input.studentId)) {
    return { ok: false, error: 'Student not found.' }
  }
  const dayOfWeek = Number(input.dayOfWeek)
  const startMinute = Number(input.startMinute)
  const durationMinutes = input.durationMinutes === 60 ? 60 : 30
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { ok: false, error: 'Invalid day of week.' }
  }
  if (!Number.isFinite(startMinute) || startMinute < 0 || startMinute > 23 * 60 + 30) {
    return { ok: false, error: 'Invalid start time.' }
  }
  const assignment: WeeklySlotAssignment = {
    id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dayOfWeek,
    startMinute: Math.floor(startMinute / SLOT_MINUTES) * SLOT_MINUTES,
    durationMinutes,
    studentId: input.studentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const config = getTeacherWeeklyScheduleConfig()
  const assignmentEnd = assignment.startMinute + assignment.durationMinutes
  if (assignment.startMinute < config.startMinute || assignmentEnd > config.endMinute) {
    return { ok: false, error: 'Slot is outside your configured teaching time range.' }
  }
  const assignments = getWeeklySlotAssignments()
  const collision = assignments.find((existing) => overlapsSlot(existing, assignment))
  if (collision) {
    return { ok: false, error: 'This slot overlaps with another scheduled class.' }
  }
  const next = [...assignments, assignment].sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.startMinute - b.startMinute))
  saveWeeklySlotAssignments(next)
  generateScheduledClassesWindow(30)
  return { ok: true, assignment }
}

export function removeWeeklySlotAssignment(slotId: string): { ok: true } | { ok: false; error: string } {
  const assignments = getWeeklySlotAssignments()
  const next = assignments.filter((assignment) => assignment.id !== slotId)
  if (next.length === assignments.length) return { ok: false, error: 'Slot assignment not found.' }
  saveWeeklySlotAssignments(next)
  generateScheduledClassesWindow(30)
  return { ok: true }
}

export function getStudentScheduledClasses(studentId: string): StudentClassSession[] {
  generateScheduledClassesWindow(30)
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return []
  return sortClassesByDate(
    (student.scheduledClasses ?? [])
      .map((session) => sanitizeClassSession(session))
      .filter((session): session is StudentClassSession => !!session),
  )
}

export interface TodaysClassSessionRow {
  studentId: string
  studentName: string
  session: StudentClassSession
}

/** Local calendar day bounds for the given date (default: today in the browser when called client-side). */
export function getLocalDayBoundsMs(day: Date = new Date()): { startMs: number; endMs: number } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0)
  return { startMs: start.getTime(), endMs: end.getTime() }
}

/** All students’ class sessions scheduled for today (local), not completed/cancelled. */
export function getTodaysClassSessionsForTeacher(day: Date = new Date()): TodaysClassSessionRow[] {
  generateScheduledClassesWindow(30)
  const { startMs, endMs } = getLocalDayBoundsMs(day)
  const out: TodaysClassSessionRow[] = []
  for (const row of getStudents()) {
    const sessions = sortClassesByDate(
      (row.scheduledClasses ?? [])
        .map((session) => sanitizeClassSession(session))
        .filter((session): session is StudentClassSession => !!session),
    )
    for (const session of sessions) {
      if (session.status === 'completed' || session.status === 'cancelled') continue
      const t = new Date(session.scheduledFor).getTime()
      if (!Number.isFinite(t) || t < startMs || t >= endMs) continue
      out.push({ studentId: row.id, studentName: row.name.trim() || 'Student', session })
    }
  }
  out.sort((a, b) => new Date(a.session.scheduledFor).getTime() - new Date(b.session.scheduledFor).getTime())
  return out
}

export function updateStudentClassEndNote(
  studentId: string,
  classId: string,
  note: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = sanitizeClassEndNote(note)
  if (!trimmed) return { ok: false, error: 'Add a short note or use “Not now” to skip.' }
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    if (session.status !== 'completed') return session
    found = true
    return {
      ...session,
      classEndNote: trimmed,
      postClassRecapPromptDismissed: true,
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Completed class not found.' }
  const sanitized = sortClassesByDate(
    nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
  )
  saveStudent({ ...student, scheduledClasses: sanitized, updatedAt: nowIso })
  return { ok: true }
}

/** Save or clear the longer session log on a completed class (`note` empty clears). */
export function updateStudentClassSessionNote(
  studentId: string,
  classId: string,
  note: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = sanitizeSessionNote(note)
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    if (session.status !== 'completed') return session
    found = true
    return {
      ...session,
      sessionNote: trimmed,
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Completed class not found.' }
  const sanitized = sortClassesByDate(
    nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
  )
  saveStudent({ ...student, scheduledClasses: sanitized, updatedAt: nowIso })
  return { ok: true }
}

export function dismissPostClassRecapPrompt(
  studentId: string,
  classId: string,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    if (session.status !== 'completed') return session
    found = true
    return {
      ...session,
      postClassRecapPromptDismissed: true,
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Completed class not found.' }
  const sanitized = sortClassesByDate(
    nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
  )
  saveStudent({ ...student, scheduledClasses: sanitized, updatedAt: nowIso })
  return { ok: true }
}

export function getLessonRangeOverride(
  studentId: string,
  key: string,
): { startPage: number; endPage: number; updatedAt: string } | null {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return null
  const overrides = sanitizeLessonRangeOverrides(student.lessonRangeOverrides)
  return overrides[key] ?? null
}

export function upsertLessonRangeOverride(
  studentId: string,
  key: string,
  range: { startPage: number; endPage: number },
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nextStart = Math.max(1, Math.floor(range.startPage))
  const nextEnd = Math.max(nextStart, Math.floor(range.endPage))
  const next = sanitizeLessonRangeOverrides(student.lessonRangeOverrides)
  next[key] = {
    startPage: nextStart,
    endPage: nextEnd,
    updatedAt: new Date().toISOString(),
  }
  saveStudent({
    ...student,
    lessonRangeOverrides: next,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export function clearLessonRangeOverride(studentId: string, key: string): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const next = sanitizeLessonRangeOverrides(student.lessonRangeOverrides)
  delete next[key]
  saveStudent({
    ...student,
    lessonRangeOverrides: next,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

/** Section options for a student row as if it were saved (used before persist when validating anchors). */
function getStudentSectionOptionsForRecord(
  student: StudentRecord,
  library: BookLibraryPayload | null,
): StudentSectionOption[] {
  if (!library?.books?.length) return []
  const assignedUnitRefs = dedupeUnitRefs(student.assignedUnitRefs ?? [])
  const out: StudentSectionOption[] = []
  const pushUnitSections = (bookId: string, unitId: string) => {
    const book = library.books.find((item) => item.id === bookId)
    const unit = book?.units.find((item) => item.id === unitId)
    if (!book || !unit) return
    out.push(...flattenUnitSections(book, unit))
  }
  if (assignedUnitRefs.length) {
    for (const ref of assignedUnitRefs) pushUnitSections(ref.bookId, ref.unitId)
  } else {
    for (const bookId of dedupeStrings(student.assignedBookIds ?? [])) {
      const book = library.books.find((item) => item.id === bookId)
      if (!book) continue
      for (const unit of book.units) out.push(...flattenUnitSections(book, unit))
    }
  }
  return out
}

export function getStudentSectionOptions(studentId: string, library: BookLibraryPayload | null): StudentSectionOption[] {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return []
  return getStudentSectionOptionsForRecord(student, library)
}

export function resolveNextSectionForClass(
  studentId: string,
  classId: string,
  library: BookLibraryPayload | null,
): StudentSectionOption | null {
  const options = getStudentSectionOptions(studentId, library)
  if (!options.length) return null
  const sessions = getStudentScheduledClasses(studentId)
  const current = sessions.find((session) => session.id === classId)
  if (!current) return options[0] ?? null
  const completed = sessions
    .filter(
      (session) =>
        session.id !== classId &&
        session.status === 'completed' &&
        !!session.selectedSection &&
        new Date(session.scheduledFor).getTime() <= new Date(current.scheduledFor).getTime(),
    )
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())
  const lastCompletedId = completed[0]?.selectedSection?.id
  if (!lastCompletedId) {
    const studentRec = getStudents().find((s) => s.id === studentId)
    const anchorId = studentRec?.curriculumAnchorSectionId?.trim()
    if (anchorId) {
      const anchorHit = options.find((o) => o.id === anchorId)
      if (anchorHit) return anchorHit
    }
    return options[0] ?? null
  }
  const index = options.findIndex((option) => option.id === lastCompletedId)
  if (index < 0) return options[0] ?? null
  return options[index + 1] ?? options[index] ?? options[0] ?? null
}

function pageInSectionOptionRange(
  option: StudentSectionOption,
  pdfPage: number,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
): boolean {
  const start = option.startPageHint ?? 1
  const endHint = option.endPageHint ?? option.startPageHint
  const end = endHint != null && Number.isFinite(endHint) ? Math.max(start, Math.floor(endHint)) : null

  const useAlignment =
    book &&
    unit &&
    (typeof option.startPageHint === 'number' || typeof option.endPageHint === 'number')
  if (useAlignment) {
    const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
    const runtime = buildPageAlignmentRuntime(totalPdfPages, hiddenPdfPages, notCountedPdfPages)
    const toPdf = (n: number) => resolveEffectiveAnchorToPdfPage(Math.round(n), runtime) ?? n
    const loPdf = toPdf(start)
    const hiPdf = end != null ? toPdf(end) : loPdf
    const lo = Math.min(loPdf, hiPdf)
    const hi = Math.max(loPdf, hiPdf)
    return pdfPage >= lo && pdfPage <= hi
  }

  if (end == null || !Number.isFinite(end)) return pdfPage >= start
  return pdfPage >= start && pdfPage <= end
}

function displaySectionTitleForHeadline(option: StudentSectionOption): string {
  const raw = (option.partTitle ?? option.lessonTitle ?? option.title ?? '').trim()
  return raw || 'this section'
}

function looksLikeVocabularySection(option: StudentSectionOption): boolean {
  if (option.partStructureTag === 'vocabulary_in_context' || option.partStructureTag === 'vocabulary_background') {
    return true
  }
  const blob = [option.partTitle, option.lessonTitle, option.title, option.pathLabel].filter(Boolean).join(' ')
  return /vocab|vocabulary|word study|words to know/i.test(blob)
}

/**
 * Friendly line for the Next/Live class card when the last finished class left a bookmark
 * still inside a book piece’s page range (optional vocabulary-style title stub).
 */
export function getNextClassResumeHeadline(
  studentId: string,
  spotlightClassId: string,
  library: BookLibraryPayload | null,
): { headline: string } | null {
  if (!library) return null
  const sessions = getStudentScheduledClasses(studentId)
  const spotlight = sessions.find((s) => s.id === spotlightClassId)
  if (!spotlight) return null
  const spotlightMs = new Date(spotlight.scheduledFor).getTime()
  if (!Number.isFinite(spotlightMs)) return null

  const prior = sessions
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.id !== spotlightClassId &&
        Number.isFinite(new Date(s.scheduledFor).getTime()) &&
        new Date(s.scheduledFor).getTime() < spotlightMs,
    )
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())[0]

  const bookmark = prior?.bookmarkAtEnd
  if (!bookmark?.bookId?.trim()) return null
  const page = bookmark.pdfPage
  if (!Number.isFinite(page) || page < 1) return null

  const options = getStudentSectionOptions(studentId, library)
  if (!options.length) return null

  const bookId = bookmark.bookId.trim()
  const unitFilter = bookmark.unitId?.trim()

  let chosen: StudentSectionOption | null = null
  for (let i = options.length - 1; i >= 0; i--) {
    const o = options[i]
    if (o.bookId !== bookId) continue
    if (unitFilter && o.unitId !== unitFilter) continue
    const book = library.books.find((b) => b.id === o.bookId)
    const unit = book?.units.find((u) => u.id === o.unitId)
    if (pageInSectionOptionRange(o, page, book, unit, null)) {
      chosen = o
      break
    }
  }
  if (!chosen) return null

  if (looksLikeVocabularySection(chosen)) {
    return { headline: 'Next class: Vocabulary check' }
  }
  return { headline: `Keep reading: ${displaySectionTitleForHeadline(chosen)}` }
}

/**
 * Best PDF page to open for this student on this book+unit: most recent signal wins
 * (end-of-class bookmark vs reader session history). Returns null to fall back to generic saved page.
 */
export function getStudentResumePdfPageForBookUnit(studentId: string, bookId: string, unitId: string): number | null {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student || !bookId.trim() || !unitId.trim()) return null
  const bid = bookId.trim()
  const uid = unitId.trim()
  let bestPage: number | null = null
  let bestTime = Number.NEGATIVE_INFINITY
  const consider = (page: number, timeIso: string | undefined) => {
    if (!Number.isFinite(page) || page < 1) return
    const t = timeIso?.trim() ? Date.parse(timeIso) : NaN
    if (!Number.isFinite(t)) return
    const p = Math.max(1, Math.floor(page))
    if (bestPage === null || t >= bestTime) {
      bestPage = p
      bestTime = t
    }
  }
  for (const s of student.scheduledClasses ?? []) {
    if (s.status !== 'completed') continue
    const bm = s.bookmarkAtEnd
    if (!bm?.bookId?.trim() || bm.bookId.trim() !== bid) continue
    const u = bm.unitId?.trim()
    if (!u || u !== uid) continue
    consider(bm.pdfPage, s.classEndedAt ?? s.updatedAt ?? s.scheduledFor)
  }
  for (const h of student.curriculumHistory ?? []) {
    if (h.bookId !== bid || h.unitId !== uid) continue
    consider(h.page, h.closedAt ?? h.openedAt)
  }
  return bestPage
}

/**
 * Default book + unit for `/books` deep links when `book` / `unit` are omitted but a student is selected.
 * Uses first valid assigned unit ref in the library, else the first assigned book’s first unit.
 */
export function getStudentDefaultBookUnitForReader(
  studentId: string,
  library: BookLibraryPayload | null | undefined,
): { bookId: string; unitId: string } | null {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student || !library?.books?.length) return null
  const bookMap = new Map(library.books.map((b) => [b.id, b]))
  for (const ref of dedupeUnitRefs(student.assignedUnitRefs ?? [])) {
    const book = bookMap.get(ref.bookId)
    const unit = book?.units.find((u) => u.id === ref.unitId)
    if (book && unit) return { bookId: ref.bookId, unitId: ref.unitId }
  }
  for (const bid of student.assignedBookIds ?? []) {
    const book = bookMap.get(bid)
    const first = book?.units?.[0]
    if (book && first) return { bookId: bid, unitId: first.id }
  }
  return null
}

/**
 * Short “last time we stopped…” line for the next/live class card (same book+unit as today’s section).
 */
export function getLastStoppedCarryLine(
  studentId: string,
  spotlightClassId: string,
  library: BookLibraryPayload | null,
  bookId: string,
  unitId: string,
): string | null {
  if (!library?.books?.length) return null
  const sessions = getStudentScheduledClasses(studentId)
  const spotlight = sessions.find((s) => s.id === spotlightClassId)
  if (!spotlight) return null
  const spotlightMs = new Date(spotlight.scheduledFor).getTime()
  if (!Number.isFinite(spotlightMs)) return null

  const prior = sessions
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.id !== spotlightClassId &&
        Number.isFinite(new Date(s.scheduledFor).getTime()) &&
        new Date(s.scheduledFor).getTime() < spotlightMs,
    )
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())[0]

  const bookmark = prior?.bookmarkAtEnd
  const bid = bookId.trim()
  const uid = unitId.trim()
  const histBook = library.books.find((b) => b.id === bid)
  const histUnit = histBook?.units.find((u) => u.id === uid)

  if (bookmark?.bookId?.trim() === bid) {
    const bu = bookmark.unitId?.trim()
    if (!bu || bu === uid) {
      const page = bookmark.pdfPage
      if (Number.isFinite(page) && page >= 1) {
        const options = getStudentSectionOptions(studentId, library)
        let piece: StudentSectionOption | null = null
        const unitFilter = bookmark.unitId?.trim()
        for (let i = options.length - 1; i >= 0; i--) {
          const o = options[i]
          if (o.bookId !== bid) continue
          if (unitFilter && o.unitId !== unitFilter) continue
          const b = library.books.find((bk) => bk.id === o.bookId)
          const u = b?.units.find((un) => un.id === o.unitId)
          if (pageInSectionOptionRange(o, page, b, u, null)) {
            piece = o
            break
          }
        }
        const pageLabel = mapPdfPageToDisplayLabel(Math.floor(page), histBook, histUnit, null, 'mapped')
        const pieceTitle = piece ? displaySectionTitleForHeadline(piece) : null
        return pieceTitle
          ? `Last time: Page ${pageLabel} (${pieceTitle})`
          : `Last time: Page ${pageLabel}`
      }
    }
  }

  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return null
  const rows = [...(student.curriculumHistory ?? [])]
    .filter((h) => h.bookId === bid && h.unitId === uid)
    .sort((a, b) => {
      const tb = Date.parse(b.closedAt ?? b.openedAt)
      const ta = Date.parse(a.closedAt ?? a.openedAt)
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
  const last = rows[rows.length - 1]
  if (!last) return null
  const pageLabel = mapPdfPageToDisplayLabel(last.page, histBook, histUnit, null, 'mapped')
  return `Last time: Page ${pageLabel} (last reader session)`
}

export function generateScheduledClassesWindow(daysAhead: number = 30): { ok: true } {
  if (typeof window === 'undefined') return { ok: true }
  const windowDays = Math.max(1, Math.min(90, Math.floor(daysAhead || 30)))
  const assignments = getWeeklySlotAssignments()
  if (assignments.length === 0) return { ok: true }

  const students = getStudents()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + windowDays)
  const dayCursor = new Date(today)

  const generatedByStudent = new Map<string, StudentClassSession[]>()
  while (dayCursor < horizon) {
    const day = dayCursor.getDay()
    const dayAssignments = assignments.filter((slot) => slot.dayOfWeek === day)
    for (const slot of dayAssignments) {
      const student = students.find((row) => row.id === slot.studentId)
      if (!student) continue
      const scheduledFor = isoForSlotDate(dayCursor, slot.startMinute)
      const existing = (student.scheduledClasses ?? []).find(
        (session) => session.sourceSlotId === slot.id && new Date(session.scheduledFor).toISOString() === new Date(scheduledFor).toISOString(),
      )
      if (existing) continue
      const nowIso = new Date().toISOString()
      const generated: StudentClassSession = {
        id: `class-${slot.id}-${scheduledFor.slice(0, 10)}`,
        sourceSlotId: slot.id,
        title: `${student.name} class`,
        scheduledFor,
        durationMin: slot.durationMinutes,
        status: 'planned',
        goals: [],
        activities: [],
        plannedVocabulary: [],
        introducedWords: [],
        practicedWords: [],
        reviewedWords: [],
        learnedWords: [],
        vocabularyReviewPlan: [],
        practiceItems: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      generatedByStudent.set(slot.studentId, [...(generatedByStudent.get(slot.studentId) ?? []), generated])
    }
    dayCursor.setDate(dayCursor.getDate() + 1)
  }

  if (generatedByStudent.size === 0) return { ok: true }
  for (const [studentId, generated] of generatedByStudent.entries()) {
    const idx = students.findIndex((row) => row.id === studentId)
    if (idx < 0) continue
    const current = students[idx]
    const merged = sortClassesByDate(
      [...(current.scheduledClasses ?? []), ...generated]
        .map((session) => sanitizeClassSession(session))
        .filter((session): session is StudentClassSession => !!session),
    )
    saveStudent({
      ...current,
      scheduledClasses: merged,
      updatedAt: new Date().toISOString(),
    })
  }
  return { ok: true }
}

export function buildStudentClassPrepContext(
  studentId: string,
  classId: string,
  library?: BookLibraryPayload | null,
  bookContext?: BookContextRecord | null,
): StudentClassPrepContext | { error: string } {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return { error: 'Student not found.' }
  const sessions = getStudentScheduledClasses(studentId)
  const target = sessions.find((session) => session.id === classId)
  if (!target) return { error: 'Class session not found.' }
  const sectionOptions = getStudentSectionOptions(studentId, library ?? null)
  const resolvedSection =
    target.selectedSection ??
    resolveNextSectionForClass(studentId, classId, library ?? null) ??
    sectionOptions[0] ??
    undefined
  const resolvedOption = resolvedSection ? sectionOptions.find((option) => option.id === resolvedSection.id) : undefined
  const sectionVocabulary = dedupeTrimmed([
    ...target.plannedVocabulary,
    ...target.goals.flatMap((goal) => goal.split(/\s+/)),
    ...target.activities.flatMap((activity) => activity.split(/\s+/)),
  ]).filter((token) => token.length >= 4)
  const checkpointIdeas: string[] =
    resolvedOption?.type === 'part' && /vocab|word/i.test(resolvedOption.title)
      ? ['Tap each target word and explain meaning in context.', 'Finish with a quick 4-item retrieval check.']
      : ['Pause halfway for a comprehension check question.', 'End with a short recap and one transfer question.']
  const recentHistory = sessions
    .filter((session) => session.id !== classId)
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())
    .slice(0, 3)
    .map((session) => ({
      title: session.title,
      status: session.status,
      scheduledFor: session.scheduledFor,
      selectedSectionTitle: session.selectedSection?.title,
      introducedWords: session.introducedWords,
      practicedWords: session.practicedWords,
      reviewedWords: session.reviewedWords,
      learnedWords: session.learnedWords,
      notes: session.teacherNotes,
    }))
  return {
    studentName: student.name,
    classTitle: target.title,
    scheduledFor: target.scheduledFor,
    classDurationMin: target.durationMin,
    plannedVocabulary: target.plannedVocabulary,
    goals: target.goals,
    activities: target.activities,
    selectedSection: resolvedSection,
    sectionContext: resolvedSection
      ? {
          title: resolvedSection.title,
          type: resolvedSection.type,
          pathLabel: resolvedOption?.pathLabel ?? resolvedSection.title,
          startPageHint: resolvedOption?.startPageHint,
          endPageHint: resolvedOption?.endPageHint,
          sectionVocabulary: sectionVocabulary.slice(0, 12),
          checkpointIdeas,
          contentSummary:
            resolvedOption?.type === 'part'
              ? `Focus on ${resolvedSection.title} as a sub-section in ${resolvedSection.lessonTitle ?? resolvedSection.unitTitle}.`
              : `Focus on ${resolvedSection.title} in ${resolvedSection.unitTitle}.`,
        }
      : undefined,
    bookContext: bookContext
      ? {
          summary: bookContext.summary,
          goals: [...bookContext.goals],
          pacing: [...bookContext.pacing],
          instructionalPriorities: [...bookContext.instructionalPriorities],
          focusAreas: [...bookContext.focusAreas],
          materials: bookContext.materials.map((item) => ({
            type: item.type,
            title: item.title,
            url: item.url,
            notes: item.notes,
            confidence: item.confidence,
          })),
        }
      : undefined,
    studentSnapshot: {
      levelLabel: estimateLevel(getKnownStudentSummaries().find((row) => normalizeStudentKey(row.name) === normalizeStudentKey(student.name))?.totalQuizzes ?? 0),
      motivation: recentHistory.length === 0 ? 'medium' : 'high',
      firstOrEarlyClasses:
        recentHistory.filter((entry) => entry.status === 'completed').length < 3,
    },
    recentHistory,
  }
}

export function updateStudentCurriculumAssignments(
  studentId: string,
  next: {
    assignedBookIds: string[]
    assignedUnitRefs: Array<{ bookId: string; unitId: string }>
  },
  library: BookLibraryPayload | null = null,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const prev = students[idx]
  const bookIds = dedupeStrings(next.assignedBookIds)
  const refs = dedupeUnitRefs(next.assignedUnitRefs)
  let curriculumAnchorSectionId = prev.curriculumAnchorSectionId?.trim() || undefined
  if (bookIds.length === 0) {
    curriculumAnchorSectionId = undefined
  } else if (library) {
    const merged: StudentRecord = { ...prev, assignedBookIds: bookIds, assignedUnitRefs: refs }
    const optsWithNext = getStudentSectionOptionsForRecord(merged, library)
    const anchorOk = curriculumAnchorSectionId && optsWithNext.some((o) => o.id === curriculumAnchorSectionId)
    if (!anchorOk) curriculumAnchorSectionId = undefined
  }
  saveStudent({
    ...prev,
    assignedBookIds: bookIds,
    assignedUnitRefs: refs,
    curriculumAnchorSectionId,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export function updateStudentCurriculumReadingAnchor(
  studentId: string,
  sectionId: string | null,
  library: BookLibraryPayload | null,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const prev = students[idx]
  const trimmed = sectionId?.trim() ?? ''
  if (!trimmed) {
    saveStudent({
      ...prev,
      curriculumAnchorSectionId: undefined,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true }
  }
  if (!library?.books?.length) {
    return { ok: false, error: 'Load the book library before setting a reading anchor.' }
  }
  const options = getStudentSectionOptions(studentId, library)
  if (!options.some((o) => o.id === trimmed)) {
    return { ok: false, error: 'That lesson piece is not available for this student’s current assignments.' }
  }
  saveStudent({
    ...prev,
    curriculumAnchorSectionId: trimmed,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export function appendStudentCurriculumSession(
  studentId: string,
  session: StudentCurriculumSessionInput,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const prev = students[idx]
  const nowIso = new Date().toISOString()
  const item = {
    id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookId: session.bookId.trim(),
    unitId: session.unitId.trim(),
    page: Math.max(1, Math.floor(session.page || 1)),
    openedAt: session.openedAt ?? nowIso,
    closedAt: session.closedAt,
  }
  if (!item.bookId || !item.unitId) return { ok: false, error: 'Invalid curriculum session.' }
  const history = [item, ...(prev.curriculumHistory ?? [])].slice(0, 500)
  saveStudent({
    ...prev,
    curriculumHistory: history,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function upsertStudentClassSession(
  studentId: string,
  input: StudentClassSessionInput,
): { ok: true; session: StudentClassSession } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const title = input.title.trim()
  if (!title) return { ok: false, error: 'Class title is required.' }
  const whenIso = input.scheduledFor.trim()
  if (!whenIso) return { ok: false, error: 'Class date/time is required.' }
  const nowIso = new Date().toISOString()
  const sessionId = `class-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const session: StudentClassSession = {
    id: sessionId,
    title,
    scheduledFor: whenIso,
    durationMin: Math.max(15, Math.min(240, Math.floor(input.durationMin || 45))),
    status: normalizeClassStatus(input.status),
    goals: dedupeTrimmed(input.goals ?? []),
    activities: dedupeTrimmed(input.activities ?? []),
    plannedVocabulary: dedupeTrimmed(input.plannedVocabulary ?? []),
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    vocabularyReviewPlan: [],
    practiceItems: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  }
  const nextSessions = sortClassesByDate([...(student.scheduledClasses ?? []), session])
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true, session }
}

/** Marks a class as live teaching: `in_progress` + `classStartedAt`. Blocks if another class is already in progress. */
export function startStudentClassSession(
  studentId: string,
  classId: string,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const sessions = student.scheduledClasses ?? []
  const target = sessions.find((s) => s.id === classId)
  if (!target) return { ok: false, error: 'Class session not found.' }
  if (target.status === 'completed' || target.status === 'cancelled') {
    return { ok: false, error: 'This class cannot be started.' }
  }
  if (target.status === 'in_progress') {
    return { ok: true }
  }
  const otherInProgress = sessions.some((s) => s.id !== classId && s.status === 'in_progress')
  if (otherInProgress) {
    return { ok: false, error: 'Another class is already in progress. End that class first.' }
  }
  const nowIso = new Date().toISOString()
  const nextSessions = sessions.map((session) =>
    session.id === classId
      ? {
          ...session,
          status: 'in_progress' as const,
          classStartedAt: nowIso,
          lessonNotebookSession: session.lessonNotebookSession ?? createInitialLessonNotebookSession(student, session),
          updatedAt: nowIso,
        }
      : session,
  )
  const sanitized = nextSessions
    .map((session) => sanitizeClassSession(session))
    .filter((session): session is StudentClassSession => !!session)
  saveStudent({
    ...student,
    scheduledClasses: sortClassesByDate(sanitized),
    updatedAt: nowIso,
  })
  return { ok: true }
}

export type EndStudentClassSessionInput = {
  classEndNote?: string
  /** Longer log: what you did this call, pages, plan for next time (optional). */
  sessionNote?: string
  bookmarkAtEnd?: { bookId: string; pdfPage: number; unitId?: string }
}

/** Prefer bookmark unit; else first assigned unit ref for that book (reader needs a unit id). */
function resolveCurriculumUnitIdForBookmark(
  student: StudentRecord,
  bookmark: { bookId: string; unitId?: string },
): string | null {
  const fromBookmark = bookmark.unitId?.trim()
  if (fromBookmark) return fromBookmark
  const match = student.assignedUnitRefs?.find((r) => r.bookId === bookmark.bookId)
  return match?.unitId?.trim() ?? null
}

function resolveBookmarkAtEndForSave(
  student: StudentRecord,
  session: StudentClassSession,
  bookmark: ClassSessionBookmarkAtEnd,
): ClassSessionBookmarkAtEnd {
  const unitId = resolveCurriculumUnitIdForBookmark(student, bookmark)
  if (!unitId) return bookmark

  const progress = getReaderProgressMap()[bookmark.bookId]?.[unitId]
  const progressPage = Number(progress?.page)
  const progressMs = progress?.updatedAt ? Date.parse(progress.updatedAt) : NaN
  const classStartedMs = session.classStartedAt ? Date.parse(session.classStartedAt) : NaN
  const useReaderProgress =
    Number.isFinite(progressPage) &&
    progressPage >= 1 &&
    Number.isFinite(progressMs) &&
    Number.isFinite(classStartedMs) &&
    progressMs >= classStartedMs

  return {
    bookId: bookmark.bookId,
    unitId,
    pdfPage: useReaderProgress ? Math.max(1, Math.floor(progressPage)) : bookmark.pdfPage,
  }
}

/** Ends live teaching: `completed` + `classEndedAt`, optional recap note and bookmark. */
export function endStudentClassSession(
  studentId: string,
  classId: string,
  input?: EndStudentClassSessionInput,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const sessions = student.scheduledClasses ?? []
  const target = sessions.find((s) => s.id === classId)
  if (!target) return { ok: false, error: 'Class session not found.' }
  if (target.status !== 'in_progress') {
    return { ok: false, error: 'This class is not in progress.' }
  }
  const nowIso = new Date().toISOString()
  const classEndNote = sanitizeClassEndNote(input?.classEndNote)
  const sessionNote = sanitizeSessionNote(input?.sessionNote)
  const bookmarkSanitized =
    input?.bookmarkAtEnd !== undefined && input.bookmarkAtEnd !== null
      ? sanitizeBookmarkAtEnd(input.bookmarkAtEnd)
      : undefined
  const bookmarkForSave = bookmarkSanitized
    ? resolveBookmarkAtEndForSave(student, target, bookmarkSanitized)
    : undefined

  const nextSessions = sessions.map((session) => {
    if (session.id !== classId) return session
    return {
      ...session,
      status: 'completed' as const,
      classEndedAt: nowIso,
      classEndNote,
      sessionNote,
      lessonNotebookSession: session.lessonNotebookSession
        ? { ...session.lessonNotebookSession, endedAt: nowIso }
        : session.lessonNotebookSession,
      ...(bookmarkForSave ? { bookmarkAtEnd: bookmarkForSave } : {}),
      updatedAt: nowIso,
    }
  })
  const sanitized = nextSessions
    .map((row) => sanitizeClassSession(row))
    .filter((row): row is StudentClassSession => !!row)

  let nextCurriculumHistory = [...(student.curriculumHistory ?? [])]
  if (bookmarkForSave) {
    const unitId = resolveCurriculumUnitIdForBookmark(student, bookmarkForSave)
    if (unitId) {
      const entry = {
        id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        bookId: bookmarkForSave.bookId,
        unitId,
        page: Math.max(1, Math.floor(bookmarkForSave.pdfPage)),
        openedAt: nowIso,
        closedAt: nowIso,
      }
      nextCurriculumHistory = [entry, ...nextCurriculumHistory].slice(0, 500)
    }
  }

  saveStudent({
    ...student,
    scheduledClasses: sortClassesByDate(sanitized),
    curriculumHistory: nextCurriculumHistory,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function transitionStudentClassStatus(
  studentId: string,
  classId: string,
  status: StudentClassStatus,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions: StudentClassSession[] = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    return { ...session, status: normalizeClassStatus(status), updatedAt: nowIso }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function recordStudentClassOutcome(
  studentId: string,
  classId: string,
  outcome: StudentClassOutcomeInput,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions: StudentClassSession[] = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    return {
      ...session,
      status: session.status === 'cancelled' ? session.status : 'completed',
      introducedWords: dedupeTrimmed(outcome.introducedWords ?? []),
      practicedWords: dedupeTrimmed(outcome.practicedWords ?? []),
      reviewedWords: dedupeTrimmed(outcome.reviewedWords ?? []),
      learnedWords: dedupeTrimmed(outcome.learnedWords ?? []),
      vocabularyReviewPlan: buildUpdatedReviewPlan(
        sanitizeVocabularyReviewPlan(session.vocabularyReviewPlan),
        outcome,
        session.scheduledFor,
      ),
      teacherNotes: outcome.teacherNotes?.trim() || undefined,
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function updateStudentClassSelectedSection(
  studentId: string,
  classId: string,
  selectedSection: StudentBookSectionRef | null,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    return {
      ...session,
      selectedSection: selectedSection ?? undefined,
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function updateStudentClassPrepSummary(
  studentId: string,
  classId: string,
  aiPrepSummary: string,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    return {
      ...session,
      status: session.status === 'planned' ? 'prepared' : session.status,
      aiPrepSummary: aiPrepSummary.trim() || undefined,
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function getStudentClassSessionById(studentId: string, classId: string): StudentClassSession | null {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return null
  const raw = (student.scheduledClasses ?? []).find((session) => session.id === classId)
  if (!raw) return null
  return sanitizeClassSession(raw)
}

export function upsertStudentClassLessonNotebookDoc(
  studentId: string,
  classId: string,
  input: {
    sectionId?: string
    html: string
    clientDocUpdatedAt?: string
  },
):
  | { ok: true; docUpdatedAt: string }
  | { ok: false; error: string; conflict?: true; latestHtml?: string; latestUpdatedAt?: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  let updated = false
  const conflictSnapshots: { latestHtml: string; latestUpdatedAt: string }[] = []
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    const notebook = session.lessonNotebookSession
    if (!notebook || !Array.isArray(notebook.sections) || notebook.sections.length === 0) return session
    const targetSectionId = input.sectionId?.trim() || notebook.sections[0]?.sectionId
    if (!targetSectionId) return session
    const sections = notebook.sections.map((section) => {
      if (section.sectionId !== targetSectionId) return section
      const nextHtml = input.html.trim()
      const existingDocIndex = section.entries.findIndex(
        (entry) => entry.layer === 'doc' && entry.payload?.kind === 'doc_richtext',
      )
      if (existingDocIndex >= 0) {
        const existing = section.entries[existingDocIndex]
        const existingHtml = typeof existing.payload?.html === 'string' ? existing.payload.html : ''
        const existingUpdatedAt = existing.updatedAt
        const hasConflict =
          typeof input.clientDocUpdatedAt === 'string' &&
          input.clientDocUpdatedAt.trim() &&
          input.clientDocUpdatedAt !== existingUpdatedAt &&
          nextHtml !== existingHtml
        if (hasConflict) {
          const mergeNoteEntry: LessonNotebookEntry = {
            entryId: makeNotebookId('lesson-notebook-entry'),
            sectionId: section.sectionId,
            layer: 'doc',
            payload: {
              kind: 'merge_note',
              message: 'Save conflict: newer content exists. Review and merge manually.',
              latestHtml: existingHtml,
              incomingHtml: nextHtml,
            },
            createdAt: nowIso,
            updatedAt: nowIso,
          }
          conflictSnapshots.push({ latestHtml: existingHtml, latestUpdatedAt: existingUpdatedAt })
          updated = true
          return { ...section, entries: [...section.entries, mergeNoteEntry] }
        }
        const nextEntries = [...section.entries]
        if (nextHtml !== existingHtml && existingHtml.trim()) {
          const historyIndex = nextEntries.findIndex(
            (entry) => entry.layer === 'doc' && entry.payload?.kind === 'doc_history',
          )
          const snapshot = {
            id: makeNotebookId('lesson-notebook-snapshot'),
            html: existingHtml,
            savedAt: existingUpdatedAt,
          }
          if (historyIndex >= 0) {
            const historyEntry = nextEntries[historyIndex]
            const existingSnapshots = Array.isArray(historyEntry.payload?.snapshots)
              ? historyEntry.payload.snapshots
              : []
            nextEntries[historyIndex] = {
              ...historyEntry,
              payload: {
                ...historyEntry.payload,
                kind: 'doc_history',
                snapshots: [snapshot, ...existingSnapshots].slice(0, 20),
              },
              updatedAt: nowIso,
            }
          } else {
            nextEntries.push({
              entryId: makeNotebookId('lesson-notebook-entry'),
              sectionId: section.sectionId,
              layer: 'doc',
              payload: {
                kind: 'doc_history',
                snapshots: [snapshot],
              },
              createdAt: nowIso,
              updatedAt: nowIso,
            })
          }
        }
        nextEntries[existingDocIndex] = {
          ...existing,
          payload: {
            ...existing.payload,
            kind: 'doc_richtext',
            html: nextHtml,
          },
          updatedAt: nowIso,
        }
        updated = true
        return { ...section, entries: nextEntries }
      }
      const nextEntry: LessonNotebookEntry = {
        entryId: makeNotebookId('lesson-notebook-entry'),
        sectionId: section.sectionId,
        layer: 'doc',
        payload: {
          kind: 'doc_richtext',
          html: nextHtml,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      updated = true
      return { ...section, entries: [...section.entries, nextEntry] }
    })
    return {
      ...session,
      lessonNotebookSession: {
        ...notebook,
        sections,
      },
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  if (!updated) return { ok: false, error: 'Lesson notebook is not ready yet for this class.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  const conflictResult = conflictSnapshots.at(-1)
  if (conflictResult) {
    return {
      ok: false,
      error: 'Save conflict detected. Latest version kept with merge note.',
      conflict: true,
      latestHtml: conflictResult.latestHtml,
      latestUpdatedAt: conflictResult.latestUpdatedAt,
    }
  }
  return { ok: true, docUpdatedAt: nowIso }
}

export function upsertStudentClassLessonNotebookOverlayImages(
  studentId: string,
  classId: string,
  input: {
    sectionId?: string
    images: Array<{
      id: string
      src: string
      xNorm: number
      yNorm: number
      widthNorm: number
    }>
  },
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  let updated = false
  const sanitizeNorm = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n))
  const sanitizedImages = input.images
    .filter((row) => typeof row.id === 'string' && row.id.trim() && typeof row.src === 'string' && row.src.trim())
    .slice(0, 40)
    .map((row) => ({
      id: row.id.trim(),
      src: row.src.trim(),
      xNorm: sanitizeNorm(Number(row.xNorm), 0, 0.95),
      yNorm: sanitizeNorm(Number(row.yNorm), 0, 0.98),
      widthNorm: sanitizeNorm(Number(row.widthNorm), 0.08, 0.9),
    }))
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    const notebook = session.lessonNotebookSession
    if (!notebook || !Array.isArray(notebook.sections) || notebook.sections.length === 0) return session
    const targetSectionId = input.sectionId?.trim() || notebook.sections[0]?.sectionId
    if (!targetSectionId) return session
    const sections = notebook.sections.map((section) => {
      if (section.sectionId !== targetSectionId) return section
      const existingOverlayIndex = section.entries.findIndex(
        (entry) => entry.layer === 'overlay' && entry.payload?.kind === 'overlay_images',
      )
      if (existingOverlayIndex >= 0) {
        const existing = section.entries[existingOverlayIndex]
        const nextEntries = [...section.entries]
        nextEntries[existingOverlayIndex] = {
          ...existing,
          payload: {
            ...existing.payload,
            kind: 'overlay_images',
            images: sanitizedImages,
          },
          updatedAt: nowIso,
        }
        updated = true
        return { ...section, entries: nextEntries }
      }
      const nextOverlayEntry: LessonNotebookEntry = {
        entryId: makeNotebookId('lesson-notebook-entry'),
        sectionId: section.sectionId,
        layer: 'overlay',
        payload: {
          kind: 'overlay_images',
          images: sanitizedImages,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      updated = true
      return { ...section, entries: [...section.entries, nextOverlayEntry] }
    })
    return {
      ...session,
      lessonNotebookSession: {
        ...notebook,
        sections,
      },
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  if (!updated) return { ok: false, error: 'Lesson notebook is not ready yet for this class.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function ensureStudentClassLessonNotebookPageSpanSection(
  studentId: string,
  classId: string,
  input: {
    pageSpanKey: string
    title?: string
    tocPartKey?: string
    breadcrumb?: string
    lessonPartLabel?: string
  },
): { ok: true; sectionId: string } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  const pageSpanKey = input.pageSpanKey.trim()
  if (!/^p\d+(?:-\d+)?$/i.test(pageSpanKey)) {
    return { ok: false, error: 'Invalid page span key.' }
  }
  let foundClass = false
  let resolvedSectionId: string | null = null
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    foundClass = true
    const notebook = session.lessonNotebookSession
    if (!notebook) return session
    const existing = notebook.sections.find(
      (section) => section.anchorType === 'page_span' && section.anchorKey === pageSpanKey,
    )
    if (existing) {
      resolvedSectionId = existing.sectionId
      return session
    }
    const sectionId = makeNotebookId('lesson-notebook-section')
    resolvedSectionId = sectionId
    const title = input.title?.trim() || pageSpanKey
    const pageLabel = pageSpanKey.replace(/^p/i, '')
    const headerEntry: LessonNotebookEntry = {
      entryId: makeNotebookId('lesson-notebook-entry'),
      sectionId,
      layer: 'doc',
      payload: {
        kind: 'header_block',
        title,
        dateLabel: new Date(session.scheduledFor).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        lessonPartLabel: input.lessonPartLabel?.trim() || title,
        pageLabel,
        pageSpan: pageSpanKey,
        tocPartKey: input.tocPartKey?.trim() || undefined,
        breadcrumb: input.breadcrumb?.trim() || undefined,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    const nextOrder = notebook.sections.length
    return {
      ...session,
      lessonNotebookSession: {
        ...notebook,
        sections: [
          ...notebook.sections,
          {
            sectionId,
            sessionId: notebook.sessionId,
            anchorType: 'page_span' as const,
            anchorKey: pageSpanKey,
            title,
            order: nextOrder,
            entries: [headerEntry],
          },
        ],
      },
      updatedAt: nowIso,
    }
  })
  if (!foundClass) return { ok: false, error: 'Class session not found.' }
  if (!resolvedSectionId) return { ok: false, error: 'Lesson notebook is not ready yet for this class.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true, sectionId: resolvedSectionId }
}

export function upsertStudentClassLessonNotebookSectionTocAnchor(
  studentId: string,
  classId: string,
  sectionId: string,
  input: {
    tocPartKey?: string
    breadcrumb?: string
    lessonPartLabel?: string
    title?: string
  },
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let foundClass = false
  let foundSection = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    foundClass = true
    const notebook = session.lessonNotebookSession
    if (!notebook) return session
    const sections = notebook.sections.map((section) => {
      if (section.sectionId !== sectionId) return section
      foundSection = true
      const headerIndex = section.entries.findIndex(
        (entry) => entry.layer === 'doc' && entry.payload?.kind === 'header_block',
      )
      if (headerIndex < 0) return section
      const header = section.entries[headerIndex]
      const nextEntries = [...section.entries]
      nextEntries[headerIndex] = {
        ...header,
        payload: {
          ...header.payload,
          ...(input.tocPartKey !== undefined ? { tocPartKey: input.tocPartKey.trim() || undefined } : {}),
          ...(input.breadcrumb !== undefined ? { breadcrumb: input.breadcrumb.trim() || undefined } : {}),
          ...(input.lessonPartLabel !== undefined ? { lessonPartLabel: input.lessonPartLabel.trim() || undefined } : {}),
          ...(input.title !== undefined ? { title: input.title.trim() || undefined } : {}),
        },
        updatedAt: nowIso,
      }
      return {
        ...section,
        title: input.title?.trim() || section.title,
        entries: nextEntries,
      }
    })
    return {
      ...session,
      lessonNotebookSession: {
        ...notebook,
        sections,
      },
      updatedAt: nowIso,
    }
  })
  if (!foundClass) return { ok: false, error: 'Class session not found.' }
  if (!foundSection) return { ok: false, error: 'Notebook section not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function updateStudentClassPublishedVocabulary(
  studentId: string,
  classId: string,
  payload: { setId: string; status: 'draft' | 'approved' | 'published'; words: string[] },
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    return {
      ...session,
      plannedVocabulary: dedupeTrimmed(payload.words),
      vocabularySetId: payload.setId,
      vocabularySetStatus: payload.status,
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function updateStudentClassContextRefs(
  studentId: string,
  classId: string,
  refs: { unitContextId?: string; lessonContextId?: string },
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    return {
      ...session,
      unitContextId: refs.unitContextId?.trim() || undefined,
      lessonContextId: refs.lessonContextId?.trim() || undefined,
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function updateStudentClassVocabularyFeedback(
  studentId: string,
  classId: string,
  update: {
    tooEasy?: number
    offTheme?: number
    wrongSkillSupport?: number
    editedMeaning?: number
    removedWord?: string
  },
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    const current = session.vocabularyFeedback ?? {
      tooEasy: 0,
      offTheme: 0,
      wrongSkillSupport: 0,
      editedMeaning: 0,
      removedWords: [],
    }
    return {
      ...session,
      vocabularyFeedback: {
        tooEasy: Math.max(0, current.tooEasy + (update.tooEasy ?? 0)),
        offTheme: Math.max(0, current.offTheme + (update.offTheme ?? 0)),
        wrongSkillSupport: Math.max(0, current.wrongSkillSupport + (update.wrongSkillSupport ?? 0)),
        editedMeaning: Math.max(0, current.editedMeaning + (update.editedMeaning ?? 0)),
        removedWords: dedupeTrimmed(
          update.removedWord?.trim() ? [...current.removedWords, update.removedWord] : current.removedWords,
        ).slice(0, 20),
      },
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function updateStudentClassPracticeItems(
  studentId: string,
  classId: string,
  items: NonNullable<StudentClassSession['practiceItems']>,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  let found = false
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.id !== classId) return session
    found = true
    return {
      ...session,
      practiceItems: sanitizePracticeItems(items),
      updatedAt: nowIso,
    }
  })
  if (!found) return { ok: false, error: 'Class session not found.' }
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function updateStudentChallengeAssignments(
  studentId: string,
  orderedQuizIds: string[],
): { ok: true } | { ok: false; error: string } {
  ensureStudentAssignmentsMigrated()
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }

  const quizzes = getQuizzes()
  const validIds = new Set(quizzes.map((q) => q.id))
  const nextIds = dedupeQuizIds(orderedQuizIds).filter((id) => validIds.has(id))

  const record = students[idx]
  const outgoing = new Set<string>()
  for (let i = 0; i < nextIds.length - 1; i += 1) outgoing.add(nextIds[i])

  const updated: StudentRecord = {
    ...record,
    assignedQuizIds: nextIds,
    mapNodeLayout: Object.fromEntries(
      Object.entries(record.mapNodeLayout ?? {}).filter(([quizId]) => nextIds.includes(quizId)),
    ),
    mapPathSegments: Object.fromEntries(
      Object.entries(record.mapPathSegments ?? {}).filter(([fromQuizId]) => outgoing.has(fromQuizId)),
    ),
    updatedAt: new Date().toISOString(),
  }
  if (nextIds.length === 0) {
    delete updated.mapPathStartPoint
    delete updated.mapPathStartSegment
  }
  saveStudent(updated)

  const studentKey = normalizeStudentKey(record.name)
  const catalog = buildChallengeCatalogForQuizIds(nextIds, quizzes)
  const progressMap = getStudentProgressMap()
  const progress = progressMap[studentKey] ?? createInitialProgressRecord(studentKey, [])
  progressMap[studentKey] = reconcileProgressWithCatalog(progress, catalog)
  saveStudentProgressMap(progressMap)

  return { ok: true }
}

export function getStudentMapNodeLayout(studentId: string): StudentMapNodeLayout {
  const student = getStudents().find((s) => s.id === studentId)
  if (!student?.mapNodeLayout) return {}
  const out: StudentMapNodeLayout = {}
  for (const [quizId, pos] of Object.entries(student.mapNodeLayout)) {
    if (!pos || typeof pos.xPct !== 'number' || typeof pos.yPct !== 'number') continue
    out[quizId] = {
      xPct: Math.max(0, Math.min(100, pos.xPct)),
      yPct: Math.max(0, Math.min(100, pos.yPct)),
    }
  }
  return out
}

export function updateStudentMapNodeLayout(
  studentId: string,
  nextLayout: StudentMapNodeLayout,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const allowedQuizIds = new Set(student.assignedQuizIds ?? [])
  const sanitized: StudentMapNodeLayout = {}
  for (const [quizId, pos] of Object.entries(nextLayout)) {
    if (!allowedQuizIds.has(quizId)) continue
    if (!pos || typeof pos.xPct !== 'number' || typeof pos.yPct !== 'number') continue
    sanitized[quizId] = {
      xPct: Math.max(0, Math.min(100, pos.xPct)),
      yPct: Math.max(0, Math.min(100, pos.yPct)),
    }
  }
  saveStudent({
    ...student,
    mapNodeLayout: sanitized,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

/** Legacy single-point entry (used when no `mapPathStartSegment`). */
export function getStudentMapPathStartPoint(studentId: string): MapPathPoint | null {
  const student = getStudents().find((s) => s.id === studentId)
  const p = student?.mapPathStartPoint
  if (!p || typeof p.xPct !== 'number' || typeof p.yCanvasPct !== 'number') return null
  return clampMapPathStartPoint(p)
}

export function getStudentMapPathStartSegmentRaw(studentId: string): { points: MapPathPoint[] } | null {
  const student = getStudents().find((s) => s.id === studentId)
  const seg = student?.mapPathStartSegment
  if (!seg?.points || !Array.isArray(seg.points) || seg.points.length < 2) return null
  const points = seg.points
    .filter((p) => p && typeof p.xPct === 'number' && typeof p.yCanvasPct === 'number')
    .map((p) => ({
      xPct: Math.max(0, Math.min(100, p.xPct)),
      yCanvasPct: Math.max(0, Math.min(100, p.yCanvasPct)),
    }))
  return points.length >= 2 ? { points } : null
}

export function updateStudentMapPathStartPoint(
  studentId: string,
  next: MapPathPoint | null,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const ids = student.assignedQuizIds ?? []
  if (ids.length === 0) {
    saveStudent({
      ...student,
      mapPathStartPoint: undefined,
      mapPathStartSegment: undefined,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true }
  }
  if (next === null) {
    saveStudent({
      ...student,
      mapPathStartPoint: undefined,
      mapPathStartSegment: undefined,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true }
  }
  saveStudent({
    ...student,
    mapPathStartPoint: clampMapPathStartPoint(next),
    mapPathStartSegment: undefined,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export function updateStudentMapPathStartSegment(
  studentId: string,
  nextPoints: MapPathPoint[] | null,
  containerWidth: number,
  compact: boolean,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const ids = student.assignedQuizIds ?? []
  if (ids.length === 0) {
    saveStudent({
      ...student,
      mapPathStartPoint: undefined,
      mapPathStartSegment: undefined,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true }
  }
  if (nextPoints === null) {
    saveStudent({
      ...student,
      mapPathStartPoint: undefined,
      mapPathStartSegment: undefined,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true }
  }
  const w = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 800
  const layout = getStudentMapNodeLayout(studentId)
  const metrics = computeCanvasMetrics(w, ids.length, compact)
  const firstNode = nodeIndexToCanvasPoint(0, ids.length, ids[0], layout, 'zigzag', metrics)
  const sanitized = sanitizeMapPathStartSegmentForSave(nextPoints, firstNode)
  saveStudent({
    ...student,
    mapPathStartSegment: { points: sanitized },
    mapPathStartPoint: undefined,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

/** Re-sync intro segment endpoints after node layout changes (quest 1 moves). */
export function syncStudentMapPathStartSegment(
  studentId: string,
  containerWidth: number,
  compact: boolean,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const ids = student.assignedQuizIds ?? []
  if (ids.length < 1) return { ok: true }
  const raw = getStudentMapPathStartSegmentRaw(studentId)
  const legacy = getStudentMapPathStartPoint(studentId)
  if (!raw && !legacy) return { ok: true }
  const w = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 800
  const layout = getStudentMapNodeLayout(studentId)
  const metrics = computeCanvasMetrics(w, ids.length, compact)
  const firstNode = nodeIndexToCanvasPoint(0, ids.length, ids[0], layout, 'zigzag', metrics)
  const merged = resolveMapPathStartSegment(raw ?? undefined, legacy, firstNode)
  saveStudent({
    ...student,
    mapPathStartSegment: { points: merged },
    mapPathStartPoint: undefined,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export function getStudentMapPathSegments(studentId: string): StudentMapPathSegments {
  const student = getStudents().find((s) => s.id === studentId)
  if (!student?.mapPathSegments) return {}
  const out: StudentMapPathSegments = {}
  const ids = student.assignedQuizIds ?? []
  const allowed = new Set<string>()
  for (let i = 0; i < ids.length - 1; i += 1) allowed.add(ids[i])

  for (const [fromId, seg] of Object.entries(student.mapPathSegments)) {
    if (!allowed.has(fromId)) continue
    if (!seg?.points || !Array.isArray(seg.points) || seg.points.length < 2) continue
    out[fromId] = {
      points: seg.points.map((p) => ({
        xPct: Math.max(0, Math.min(100, typeof p.xPct === 'number' ? p.xPct : 0)),
        yCanvasPct: Math.max(0, Math.min(100, typeof p.yCanvasPct === 'number' ? p.yCanvasPct : 0)),
      })),
    }
  }
  return out
}

export function updateStudentMapPathSegments(
  studentId: string,
  next: StudentMapPathSegments,
  containerWidth: number,
  compact: boolean,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const ids = student.assignedQuizIds ?? []
  const w = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 800
  const sanitized = sanitizeMapPathSegments(next, ids, getStudentMapNodeLayout(studentId), 'zigzag', w, compact)
  saveStudent({
    ...student,
    mapPathSegments: sanitized,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

/**
 * Re-sync path segment endpoints to current node positions after layout edits.
 * Call with the map container width used for `computeCanvasMetrics` (e.g. editor clientWidth).
 */
export function syncStudentMapPathEndpoints(
  studentId: string,
  containerWidth: number,
  compact: boolean,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const ids = student.assignedQuizIds ?? []
  if (ids.length < 2) return { ok: true }
  const layout = getStudentMapNodeLayout(studentId)
  const merged = syncAllSegmentEndpoints(student.mapPathSegments ?? {}, ids, layout, 'zigzag', containerWidth, compact)
  saveStudent({
    ...student,
    mapPathSegments: merged,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

/** Challenge path used when applying challenge-mode attempts (player identified by name). */
export function getChallengeCatalogForStudentKey(studentKey: string): ChallengeDefinition[] {
  ensureStudentAssignmentsMigrated()
  const record = getStudents().find((s) => normalizeStudentKey(s.name) === studentKey)
  const ids = Array.isArray(record?.assignedQuizIds) ? record.assignedQuizIds : []
  return buildChallengeCatalogForQuizIds(ids, getQuizzes())
}

export function getStudentDefaultDifficultyTier(studentId: string): DifficultyTier {
  const s = getStudents().find((x) => x.id === studentId)
  return s?.defaultDifficultyTier ?? DEFAULT_PLAY_TIER
}

export function updateStudentDefaultDifficultyTier(
  studentId: string,
  tier: DifficultyTier,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const prev = students[idx]
  saveStudent({
    ...prev,
    defaultDifficultyTier: tier,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export function addStudentRecord(input: {
  name: string
  note?: string
  className?: string
  defaultDifficultyTier?: DifficultyTier
}): { ok: true } | { ok: false; error: string } {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Name is required.' }

  const students = getStudents()
  const alreadyExists = students.some(
    (student) => normalizeStudentKey(student.name) === normalizeStudentKey(name),
  )
  if (alreadyExists) return { ok: false, error: 'Student already exists.' }

  const now = new Date().toISOString()
  saveStudent({
    id: generateStudentId(),
    name,
    note: input.note?.trim() || undefined,
    className: input.className?.trim() || undefined,
    defaultDifficultyTier: input.defaultDifficultyTier ?? DEFAULT_PLAY_TIER,
    createdAt: now,
    updatedAt: now,
    assignedQuizIds: [],
  })

  return { ok: true }
}

export type StudentMapQaScenario = 'no-assigned' | 'first-unlocked' | 'mid-path' | 'all-completed' | 'long-path'

export function setStudentMapQaScenario(
  studentId: string,
  scenario: StudentMapQaScenario,
): { ok: true } | { ok: false; error: string } {
  ensureStudentAssignmentsMigrated()
  const students = getStudents()
  const student = students.find((s) => s.id === studentId)
  if (!student) return { ok: false, error: 'Student not found.' }

  const quizzes = getQuizzes()
  if (quizzes.length === 0) return { ok: false, error: 'No quizzes available for scenario seeding.' }

  const desiredCount = scenario === 'long-path' ? Math.min(24, quizzes.length) : Math.min(6, quizzes.length)
  const orderedQuizIds = scenario === 'no-assigned' ? [] : quizzes.slice(0, desiredCount).map((q) => q.id)
  const assignmentResult = updateStudentChallengeAssignments(studentId, orderedQuizIds)
  if (!assignmentResult.ok) return assignmentResult

  if (orderedQuizIds.length === 0) return { ok: true }

  const studentKey = normalizeStudentKey(student.name)
  const catalog = buildChallengeCatalogForQuizIds(orderedQuizIds, quizzes)
  const progressMap = getStudentProgressMap()
  let progress: StudentProgressRecord = progressMap[studentKey] ?? createInitialProgressRecord(studentKey, catalog)
  progress = reconcileProgressWithCatalog(progress, catalog)

  const targetIndex =
    scenario === 'first-unlocked'
      ? 0
      : scenario === 'mid-path'
        ? Math.min(progress.challenges.length - 1, Math.max(1, Math.floor(progress.challenges.length / 2)))
        : scenario === 'all-completed'
          ? progress.challenges.length
          : 0

  const nextChallenges = progress.challenges.map((row, index) => {
    if (index < targetIndex) {
      return {
        ...row,
        status: 'completed' as const,
        bestScorePct: Math.max(row.bestScorePct, 85),
        attemptCount: Math.max(row.attemptCount, 1),
      }
    }
    if (index === targetIndex && targetIndex < progress.challenges.length) {
      return {
        ...row,
        status: 'unlocked' as const,
      }
    }
    return {
      ...row,
      status: 'locked' as const,
    }
  })

  const currentChallengeOrder =
    targetIndex < catalog.length
      ? (catalog[targetIndex]?.order ?? 0)
      : 0

  progressMap[studentKey] = {
    ...progress,
    challenges: nextChallenges,
    currentChallengeOrder,
    updatedAt: new Date().toISOString(),
  }
  saveStudentProgressMap(progressMap)
  return { ok: true }
}
