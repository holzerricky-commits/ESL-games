import { getCachedStudents, isStudentRecordsDiskActive } from '@/lib/local-data/student-records-client'
import {
  flushWeeklyScheduleToDisk,
  getWeeklyScheduleDiskCache,
  isWeeklyScheduleDiskActive,
  setWeeklyScheduleConfigOnDiskCache,
  setWeeklySlotAssignmentsOnDiskCache,
  setWeeklySlotExceptionsOnDiskCache,
  WEEKLY_SCHEDULE_CONFIG_KEY,
  WEEKLY_SLOT_ASSIGNMENTS_KEY,
  WEEKLY_SLOT_EXCEPTIONS_KEY,
} from '@/lib/local-data/weekly-schedule-disk-client'
import { buildChallengeCatalogForQuizIds } from '@/lib/challenges'
import { buildPageAlignmentRuntime, resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { getFileAlignment } from '@/lib/books/page-range'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import { DEFAULT_PLAY_TIER } from '@/lib/quiz-difficulty'
import {
  getKnownStudentSummaries,
  getQuizzes,
  getStudentProgressMap,
  getStudents,
  removeStudentFromBrowserStorage,
  saveStudent,
  saveStudentProgressMap,
  saveStudents,
} from '@/lib/storage'
import { createInitialProgressRecord, reconcileProgressWithCatalog } from '@/lib/students/progression'
import { generateStudentId, normalizeStudentKey } from '@/lib/students/identity'
import { sanitizePrepTimeBlocks, type ClassPrepTimeBlock } from '@/lib/students/class-prep-outline'
import { hasPrepExtras, sanitizeClassPrepExtras, type ClassPrepExtrasPayload } from '@/lib/students/class-prep-extras'
import { sanitizeClassroomHomeGoals, type ClassroomHomeGoals } from '@/lib/students/classroom-home-goals'
import {
  collectClassPrepSignals,
  dueReviewWordsForSession,
  sessionNoteForHistory,
  type ClassPrepContextFlags,
  type ClassPrepContextMode,
  type ClassPrepNamedIssue,
  type ClassPrepReadingPosition,
  type ClassPrepVocabSignals,
} from '@/lib/students/class-prep-signals'
import {
  buildSeedEntriesFromRows,
  buildStudentWordReviewView,
  combineAggregatedWordReviewRows,
  resolveVocabSignalsFromWordReview,
  sanitizeWordReviewEntries,
  sanitizeWordReviewHidden,
  type StudentWordReviewRow,
  type StudentWordReviewView,
} from '@/lib/students/student-word-review'
import { daysAheadToCover } from '@/lib/schedule/month-view-layout'
import { normalizeClassDurationMinutes } from '@/lib/schedule/class-duration'
import {
  formatScheduleConflictError,
  type ScheduleConflict,
} from '@/lib/schedule/schedule-conflict-messages'
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
import { resolveMappedPageToPdfPage } from '@/lib/books/page-numbering'
import {
  getLatestSavedUnitPageForBook,
  peekSavedUnitPage,
  flushPendingUnitPageSave,
} from '@/lib/books/progress'
import type { StudentListItemView, StudentProfileTab, StudentProfileView } from '@/lib/students/types'
import type { BookContextRecord } from '@/lib/context/types'
import type {
  ChallengeDefinition,
  BookSectionType,
  ClassSessionBookmarkAtEnd,
  DifficultyTier,
  StudentBookSectionRef,
  StudentClassSession,
  StudentClassStatus,
  StudentProgressRecord,
  StudentRecord,
  StudentRosterStatus,
  StudentWordReviewStrength,
  TeacherWeeklyScheduleConfig,
  WeeklySlotAssignment,
  WeeklySlotException,
} from '@/lib/types'

import { buildStudentFinishSetupHref, buildStudentOpenPlanHref, resolveStudentSetupStatus, studentHasBookedClass } from '@/lib/students/student-setup-status'
import type { StudentSetupStatus } from '@/lib/students/student-setup-status'
import {
  canExtendClassBy,
  isSessionDueForHardAutoEnd,
  isSessionDueForMissed,
  isSessionEligibleForSoftAutoStart,
  resolveTodayClassTeachingState,
  sanitizeExtendedMinutesTotal,
  type TodayClassTeachingState,
} from '@/lib/students/class-schedule-lifecycle'

const NEXT_CLASS_LIST_PLACEHOLDER = 'No class scheduled.'
export const STUDENT_LOCAL_DATA_CHANGED_EVENT = 'esl-student-data-changed'

export function notifyStudentLocalDataChanged(studentId?: string): void {
  if (typeof window === 'undefined') return
  if (typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new CustomEvent(STUDENT_LOCAL_DATA_CHANGED_EVENT, { detail: { studentId } }))
}

/** Missing / unknown rosterStatus counts as active (legacy records). */
export function resolveStudentRosterStatus(student: Pick<StudentRecord, 'rosterStatus'>): StudentRosterStatus {
  return student.rosterStatus === 'on_break' ? 'on_break' : 'active'
}

export function isStudentOnBreak(student: Pick<StudentRecord, 'rosterStatus'>): boolean {
  return resolveStudentRosterStatus(student) === 'on_break'
}

/** Active students only — used for schedule conflicts, calendar, and the main roster. */
export function getActiveStudents(): StudentRecord[] {
  return getStudents().filter((row) => !isStudentOnBreak(row))
}

function activeStudentIds(): Set<string> {
  return new Set(getActiveStudents().map((row) => row.id))
}

/**
 * Drop weekly slots (and their date exceptions) for students who no longer exist
 * or are on break. Returns how many slots were removed.
 */
export function pruneOrphanWeeklySlots(): number {
  if (typeof window === 'undefined') return 0
  const keepIds = activeStudentIds()
  const assignments = getWeeklySlotAssignments()
  const next = assignments.filter((slot) => keepIds.has(slot.studentId))
  const removedCount = assignments.length - next.length
  if (removedCount === 0) return 0

  const keptSlotIds = new Set(next.map((slot) => slot.id))
  const exceptions = getWeeklySlotExceptions()
  const nextExceptions = exceptions.filter((row) => keptSlotIds.has(row.slotId))
  if (nextExceptions.length !== exceptions.length) {
    saveWeeklySlotExceptions(nextExceptions)
  }
  saveWeeklySlotAssignments(next)
  return removedCount
}

const SLOT_MINUTES = 30 as const

const PROFILE_TABS: StudentProfileTab[] = ['challenges', 'curriculum', 'classes', 'map', 'avatar', 'words', 'info']
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
    sessionNote?: string
    dueReviewWords: string[]
  }>
  readingPosition?: ClassPrepReadingPosition
  vocabSignals: ClassPrepVocabSignals
  namedRecurringIssues: ClassPrepNamedIssue[]
  prepContextMode: ClassPrepContextMode
  prepContextFlags: ClassPrepContextFlags
}

export interface BuildStudentClassPrepContextOptions {
  savedWordEntries?: unknown[]
  /** Part interactive vocabulary from context store — overrides token heuristic when present. */
  partSectionVocabulary?: string[]
}

export interface WeeklySlotAssignmentInput {
  dayOfWeek: number
  startMinute: number
  durationMinutes: number
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
  // Avoid persisting a snapshot taken from stale localStorage before disk hydration
  // (would overwrite on-disk fields such as avatarUrl).
  if (!changed) return
  if (typeof window !== 'undefined' && !isStudentRecordsDiskActive() && getCachedStudents() === null) {
    return
  }
  saveStudents(next)
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
  if (
    status === 'prepared' ||
    status === 'completed' ||
    status === 'cancelled' ||
    status === 'in_progress' ||
    status === 'missed'
  ) {
    return status
  }
  return 'planned'
}

/** Finished / inactive for “next class” and start flows (not live, not upcoming). */
export function isClosedClassSessionStatus(status: string): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'missed'
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

function sanitizeReadingCheckWrapLine(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (!t) return undefined
  return t.length > 240 ? t.slice(0, 240) : t
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

export type StudentCurriculumBookStart = NonNullable<StudentRecord['curriculumBookStarts']>[string]

function sanitizeCurriculumBookStarts(raw: unknown): Record<string, StudentCurriculumBookStart> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, StudentCurriculumBookStart> = {}
  for (const [bookIdRaw, entryRaw] of Object.entries(raw as Record<string, unknown>)) {
    const bookId = bookIdRaw.trim()
    if (!bookId || !entryRaw || typeof entryRaw !== 'object') continue
    const entry = entryRaw as Record<string, unknown>
    const sectionId = typeof entry.sectionId === 'string' ? entry.sectionId.trim() : ''
    const unitId = typeof entry.unitId === 'string' ? entry.unitId.trim() : ''
    const mapped = Number(entry.mappedPage)
    if (!sectionId || !unitId || !Number.isFinite(mapped) || mapped < 1) continue
    const updatedAt =
      typeof entry.updatedAt === 'string' && entry.updatedAt.trim()
        ? entry.updatedAt.trim()
        : new Date(0).toISOString()
    out[bookId] = {
      sectionId,
      unitId,
      mappedPage: Math.max(1, Math.floor(mapped)),
      updatedAt,
    }
  }
  return out
}

/** Merge stored per-book starts with legacy single anchor (display / open helpers). */
export function resolveCurriculumBookStarts(
  record: Pick<StudentRecord, 'curriculumBookStarts' | 'curriculumAnchorSectionId' | 'updatedAt'> | null | undefined,
  library: BookLibraryPayload | null,
  sectionOptions?: StudentSectionOption[],
): Record<string, StudentCurriculumBookStart> {
  const starts = sanitizeCurriculumBookStarts(record?.curriculumBookStarts)
  if (Object.keys(starts).length > 0) return starts
  const legacyId = record?.curriculumAnchorSectionId?.trim()
  if (!legacyId || !library?.books?.length) return starts
  const options = sectionOptions ?? []
  const hit = options.find((o) => o.id === legacyId)
  if (!hit) return starts
  return {
    [hit.bookId]: {
      sectionId: hit.id,
      unitId: hit.unitId,
      mappedPage: typeof hit.startPageHint === 'number' && hit.startPageHint >= 1 ? Math.floor(hit.startPageHint) : 1,
      updatedAt: record?.updatedAt?.trim() || new Date(0).toISOString(),
    },
  }
}

function mostRecentCurriculumBookStart(
  starts: Record<string, StudentCurriculumBookStart>,
  options: StudentSectionOption[],
): StudentSectionOption | null {
  const ranked = Object.values(starts).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.sectionId.localeCompare(a.sectionId),
  )
  for (const start of ranked) {
    const hit = options.find((o) => o.id === start.sectionId)
    if (hit) return hit
  }
  return null
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

export function buildSpreadPageSpanKey(startPage: number, endPage?: number | null): string {
  const start = Number.isFinite(Number(startPage)) ? Math.max(1, Math.floor(Number(startPage))) : 1
  const rawEnd = Number.isFinite(Number(endPage)) ? Math.max(start, Math.floor(Number(endPage))) : start
  return rawEnd > start ? `p${start}-${rawEnd}` : `p${start}`
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
    prepTimeBlocks: sanitizePrepTimeBlocks(raw.prepTimeBlocks),
    prepOutlineSummary:
      typeof raw.prepOutlineSummary === 'string' && raw.prepOutlineSummary.trim()
        ? raw.prepOutlineSummary.trim()
        : undefined,
    prepNotes: typeof raw.prepNotes === 'string' && raw.prepNotes.trim() ? raw.prepNotes.trim() : undefined,
    prepSkippedPartIds: (() => {
      const ids = dedupeTrimmed(Array.isArray(raw.prepSkippedPartIds) ? raw.prepSkippedPartIds : []).slice(0, 40)
      return ids.length ? ids : undefined
    })(),
    ...sanitizeClassPrepExtras({
      prepPriorities: raw.prepPriorities,
      prepSuggestedActivities: raw.prepSuggestedActivities,
      prepCheckpointMoments: raw.prepCheckpointMoments,
      prepWordsToRevisit: raw.prepWordsToRevisit,
      prepDifferentiationTips: raw.prepDifferentiationTips,
      prepCarryOver: raw.prepCarryOver,
    }),
    classroomHomeGoals: sanitizeClassroomHomeGoals(raw.classroomHomeGoals),
    aiPrepSummary:
      typeof raw.aiPrepSummary === 'string' && raw.aiPrepSummary.trim() ? raw.aiPrepSummary.trim() : undefined,
    classStartedAt: optionalIsoString(raw.classStartedAt),
    extendedMinutesTotal: sanitizeExtendedMinutesTotal(raw.extendedMinutesTotal),
    classEndedAt: optionalIsoString(raw.classEndedAt),
    classEndNote: sanitizeClassEndNote(raw.classEndNote),
    sessionNote: sanitizeSessionNote(raw.sessionNote),
    postClassRecapPromptDismissed: raw.postClassRecapPromptDismissed === true ? true : undefined,
    readingCheckWrapLine: sanitizeReadingCheckWrapLine(raw.readingCheckWrapLine),
    bookmarkAtEnd: sanitizeBookmarkAtEnd(raw.bookmarkAtEnd),
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
  const durationMinutes = normalizeClassDurationMinutes(raw.durationMinutes, 30)
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

function sessionMinutesOverlap(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur
}

export function localDateKey(day: Date): string {
  const y = day.getFullYear()
  const m = String(day.getMonth() + 1).padStart(2, '0')
  const d = String(day.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function sanitizeWeeklySlotException(
  raw: Partial<WeeklySlotException> | null | undefined,
): WeeklySlotException | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.slotId !== 'string') return null
  const id = raw.id.trim()
  const slotId = raw.slotId.trim()
  const localDate = typeof raw.localDate === 'string' ? raw.localDate.trim() : ''
  if (!id || !slotId || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null
  const type = raw.type === 'cancelled' ? 'cancelled' : raw.type === 'rescheduled' ? 'rescheduled' : null
  if (!type) return null
  const nowIso = new Date().toISOString()
  return {
    id,
    slotId,
    localDate,
    type,
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : nowIso,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : nowIso,
  }
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
      if (isClosedClassSessionStatus(session.status) || session.status === 'in_progress') return false
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

export function getStudentsListView(
  library?: BookLibraryPayload | null,
  options?: { includeOnBreak?: boolean },
): StudentListItemView[] {
  ensureStudentAssignmentsMigrated()
  pruneOrphanWeeklySlots()
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
      rosterStatus: 'active',
    }
    saveStudent(created)
    studentsByKey.set(key, created)
  }

  const knownByKey = new Map(knownStudents.map((student) => [normalizeStudentKey(student.name), student]))
  const includeOnBreak = options?.includeOnBreak === true
  const allStudents = [...studentsByKey.values()]
    .filter((student) => includeOnBreak || !isStudentOnBreak(student))
    .sort((a, b) => a.name.localeCompare(b.name))
  const allWeeklySlots = getWeeklySlotAssignments()
  const weeklySlotStudentIds = new Set(
    allWeeklySlots
      .map((slot) => slot.studentId)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  )

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
    const setup = resolveStudentSetupStatus({
      studentId: student.id,
      assignedBookIds: student.assignedBookIds,
      nextClass,
      weeklySlotStudentIds,
      weeklySlots: allWeeklySlots,
      nextClassLabel: formatNextClassLabel(nextClass),
      hasBookedClass: studentHasBookedClass(scheduledClasses),
    })
    const onBreak = isStudentOnBreak(student)

    return {
      id: student.id,
      studentKey,
      name: student.name,
      avatarUrl: student.avatarUrl,
      levelLabel: estimateLevel(known?.totalQuizzes ?? 0),
      progressLabel,
      coinsLabel: `Coins: ${progress.totalCoins}`,
      currentChallengeLabel,
      totalAttempts: known?.totalQuizzes ?? 0,
      lastActiveLabel: known ? formatLastActive(known.lastDate) : 'No activity yet',
      nextClassLabel: onBreak ? 'On break' : formatNextClassLabel(nextClass),
      nextClassAt: onBreak || !nextClass ? null : nextClass.scheduledFor,
      curriculumBookLabel: curriculum.book,
      curriculumUnitLabel: curriculum.unit,
      curriculumPageLabel: curriculum.page,
      curriculumThumbFilePath: curriculum.thumbFilePath,
      curriculumThumbUnitId: curriculum.thumbUnitId,
      curriculumThumbPage: curriculum.thumbPage,
      createdAt: student.createdAt,
      needsSetup: onBreak ? false : setup.needsSetup,
      setupHint: onBreak ? 'On break — not on the active roster' : setup.setupHint,
      finishSetupHref: buildStudentFinishSetupHref(student.id, setup),
      openPlanHref: buildStudentOpenPlanHref(student.id),
      isOnBreak: onBreak,
      onBreakAt: typeof student.onBreakAt === 'string' ? student.onBreakAt : undefined,
    }
  })

  if (dirty) saveStudentProgressMap(progressMap)
  return students
}

export function getStudentSetupStatus(studentId: string): StudentSetupStatus {
  ensureStudentAssignmentsMigrated()
  generateScheduledClassesWindow(30)
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) {
    return {
      needsSetup: false,
      setupHint: '',
      hasBook: true,
      hasWeeklySlot: true,
      hasUpcomingClass: true,
      weeklySlotSummary: '',
      nextClassLabel: '',
    }
  }
  const allWeeklySlots = getWeeklySlotAssignments()
  const weeklySlotStudentIds = new Set(
    allWeeklySlots
      .map((slot) => slot.studentId)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  )
  const scheduledClasses = sortClassesByDate(
    (student.scheduledClasses ?? [])
      .map((session) => sanitizeClassSession(session))
      .filter((session): session is StudentClassSession => !!session),
  )
  const nextClass = computeNextClass(scheduledClasses)
  return resolveStudentSetupStatus({
    studentId: student.id,
    assignedBookIds: student.assignedBookIds,
    nextClass,
    weeklySlotStudentIds,
    weeklySlots: allWeeklySlots,
    nextClassLabel: formatNextClassLabel(nextClass),
    hasBookedClass: studentHasBookedClass(scheduledClasses),
  })
}

export function getStudentProfileView(
  studentId: string,
  library?: BookLibraryPayload | null,
): StudentProfileView | null {
  generateScheduledClassesWindow(30)
  const students = getStudentsListView(library, { includeOnBreak: true })
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
    curriculumBookStarts: sanitizeCurriculumBookStarts(registryRecord?.curriculumBookStarts),
    curriculumHistory: [...(registryRecord?.curriculumHistory ?? [])].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    ),
    scheduledClasses,
    showFirstClassWelcome: studentShowsFirstClassWelcome(registryRecord),
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

  const bookStarts = sanitizeCurriculumBookStarts(record.curriculumBookStarts)
  const startEntries = Object.entries(bookStarts).sort(
    (a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime(),
  )
  if (startEntries.length > 0) {
    const [bookId, start] = startEntries[0]!
    const pageNum =
      typeof start.mappedPage === 'number' && Number.isFinite(start.mappedPage) && start.mappedPage >= 1
        ? Math.floor(start.mappedPage)
        : 1
    const startBook = bookMap.get(bookId)
    const startUnit = startBook?.units.find((u) => u.id === start.unitId)
    const displayPage = mapPdfPageToDisplayLabel(pageNum, startBook, startUnit, null, numberingMode)
    const fp = unitFilePath(bookId, start.unitId)
    return {
      book: resolveBook(bookId),
      unit: resolveUnit(bookId, start.unitId),
      page: displayPage,
      thumbFilePath: fp,
      thumbUnitId: fp ? start.unitId : null,
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
  if (isWeeklyScheduleDiskActive()) {
    const disk = getWeeklyScheduleDiskCache()
    return sanitizeWeeklyScheduleConfig(
      (disk?.config ?? null) as Partial<TeacherWeeklyScheduleConfig> | null,
    )
  }
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
    if (isWeeklyScheduleDiskActive()) {
      setWeeklyScheduleConfigOnDiskCache(next as unknown as Record<string, unknown>)
    } else {
      localStorage.setItem(WEEKLY_SCHEDULE_CONFIG_KEY, JSON.stringify(next))
    }
  }
  generateScheduledClassesWindow(30)
  return { ok: true }
}

export function getWeeklySlotAssignments(): WeeklySlotAssignment[] {
  if (typeof window === 'undefined') return []
  try {
    let parsed: Array<Partial<WeeklySlotAssignment>> = []
    if (isWeeklyScheduleDiskActive()) {
      const disk = getWeeklyScheduleDiskCache()
      parsed = Array.isArray(disk?.assignments)
        ? (disk.assignments as Array<Partial<WeeklySlotAssignment>>)
        : []
    } else {
      const raw = localStorage.getItem(WEEKLY_SLOT_ASSIGNMENTS_KEY)
      parsed = raw ? (JSON.parse(raw) as Array<Partial<WeeklySlotAssignment>>) : []
    }
    return parsed
      .map((item) => sanitizeWeeklySlotAssignment(item))
      .filter((item): item is WeeklySlotAssignment => !!item)
      .sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.startMinute - b.startMinute))
  } catch {
    return []
  }
}

function isBrowserStorageQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err && typeof (err as { name?: unknown }).name === 'string' ? (err as { name: string }).name : ''
  const message =
    'message' in err && typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : ''
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /exceeded the quota|quotaexceeded/i.test(message)
  )
}

const BROWSER_STORAGE_FULL_MESSAGE =
  'Browser storage is full. Download a backup in Settings, free some space, then try again.'

/** Drop schedule exceptions older than keepDays (local calendar days). */
function pruneStaleWeeklySlotExceptions(
  rows: WeeklySlotException[],
  keepDays: number = 45,
): WeeklySlotException[] {
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - Math.max(1, Math.floor(keepDays)))
  const cutoffKey = localDateKey(cutoff)
  return rows.filter((row) => row.localDate >= cutoffKey)
}

function saveWeeklySlotAssignments(next: WeeklySlotAssignment[]): void {
  if (typeof window === 'undefined') return
  if (isWeeklyScheduleDiskActive()) {
    setWeeklySlotAssignmentsOnDiskCache(next)
    return
  }
  try {
    localStorage.setItem(WEEKLY_SLOT_ASSIGNMENTS_KEY, JSON.stringify(next))
  } catch (err) {
    if (isBrowserStorageQuotaError(err)) {
      throw new Error(BROWSER_STORAGE_FULL_MESSAGE)
    }
    throw err
  }
}

export function getWeeklySlotExceptions(): WeeklySlotException[] {
  if (typeof window === 'undefined') return []
  try {
    let parsed: Array<Partial<WeeklySlotException>> = []
    if (isWeeklyScheduleDiskActive()) {
      const disk = getWeeklyScheduleDiskCache()
      parsed = Array.isArray(disk?.exceptions)
        ? (disk.exceptions as Array<Partial<WeeklySlotException>>)
        : []
    } else {
      const raw = localStorage.getItem(WEEKLY_SLOT_EXCEPTIONS_KEY)
      parsed = raw ? (JSON.parse(raw) as Array<Partial<WeeklySlotException>>) : []
    }
    return parsed
      .map((item) => sanitizeWeeklySlotException(item))
      .filter((item): item is WeeklySlotException => !!item)
  } catch {
    return []
  }
}

function saveWeeklySlotExceptions(next: WeeklySlotException[]): void {
  if (typeof window === 'undefined') return
  const pruned = pruneStaleWeeklySlotExceptions(next, 45)
  if (isWeeklyScheduleDiskActive()) {
    setWeeklySlotExceptionsOnDiskCache(pruned)
    return
  }
  const write = (rows: WeeklySlotException[]) => {
    localStorage.setItem(WEEKLY_SLOT_EXCEPTIONS_KEY, JSON.stringify(rows))
  }
  try {
    write(pruned)
  } catch (err) {
    if (!isBrowserStorageQuotaError(err)) throw err
    const tighter = pruneStaleWeeklySlotExceptions(pruned, 14)
    try {
      write(tighter)
    } catch (retryErr) {
      if (isBrowserStorageQuotaError(retryErr)) {
        throw new Error(BROWSER_STORAGE_FULL_MESSAGE)
      }
      throw retryErr
    }
  }
}

function upsertWeeklySlotException(input: {
  slotId: string
  localDate: string
  type: WeeklySlotException['type']
}): WeeklySlotException {
  const nowIso = new Date().toISOString()
  const existing = getWeeklySlotExceptions()
  const found = existing.find(
    (row) => row.slotId === input.slotId && row.localDate === input.localDate,
  )
  if (found) {
    const next = existing.map((row) =>
      row.id === found.id
        ? { ...row, type: input.type, updatedAt: nowIso }
        : row,
    )
    saveWeeklySlotExceptions(next)
    return { ...found, type: input.type, updatedAt: nowIso }
  }
  const created: WeeklySlotException = {
    id: `slot-ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    slotId: input.slotId,
    localDate: input.localDate,
    type: input.type,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
  saveWeeklySlotExceptions([...existing, created])
  return created
}

function removeWeeklySlotExceptionsForSlot(slotId: string): void {
  const next = getWeeklySlotExceptions().filter((row) => row.slotId !== slotId)
  saveWeeklySlotExceptions(next)
}

function studentNameForId(studentId: string): string {
  return getStudents().find((row) => row.id === studentId)?.name.trim() || 'Student'
}

function isSchedulableStudent(student: StudentRecord | undefined): student is StudentRecord {
  return !!student && !isStudentOnBreak(student)
}

function weeklySlotConflictMessage(collision: WeeklySlotAssignment): string {
  return formatScheduleConflictError({
    kind: 'weekly_slot',
    studentName: studentNameForId(collision.studentId),
    dayOfWeek: collision.dayOfWeek,
    startMinute: collision.startMinute,
    durationMinutes: collision.durationMinutes,
  })
}

function slotHasExceptionOnDate(slotId: string, targetDay: Date): boolean {
  const occurrenceDate = localDateKey(targetDay)
  return getWeeklySlotExceptions().some(
    (row) => row.slotId === slotId && row.localDate === occurrenceDate,
  )
}

function slotWouldBlockTimeOnDate(
  slot: WeeklySlotAssignment,
  targetDay: Date,
  snappedStart: number,
  durationMinutes: number,
): boolean {
  if (slot.dayOfWeek !== targetDay.getDay()) return false
  if (slotHasExceptionOnDate(slot.id, targetDay)) return false

  const student = getStudents().find((row) => row.id === slot.studentId)
  if (!isSchedulableStudent(student)) return false

  const occurrenceDate = localDateKey(targetDay)
  const sessionsOnDate = (student.scheduledClasses ?? []).filter((session) => {
    if (session.sourceSlotId !== slot.id) return false
    const when = new Date(session.scheduledFor)
    return Number.isFinite(when.getTime()) && localDateKey(when) === occurrenceDate
  })

  if (
    sessionsOnDate.some(
      (session) => session.status !== 'cancelled' && session.status !== 'completed',
    )
  ) {
    return false
  }

  if (sessionsOnDate.length > 0) {
    return false
  }

  return sessionMinutesOverlap(snappedStart, durationMinutes, slot.startMinute, slot.durationMinutes)
}

export function findScheduleConflictOnDate(
  excludeSessionId: string | null,
  targetDay: Date,
  startMinute: number,
  durationMinutes: number,
  options?: { excludeSlotId?: string },
): ScheduleConflict | null {
  const snappedStart = Math.floor(startMinute / SLOT_MINUTES) * SLOT_MINUTES
  const excludeSlotId = options?.excludeSlotId?.trim() || null
  const targetStartMs = new Date(
    targetDay.getFullYear(),
    targetDay.getMonth(),
    targetDay.getDate(),
    0,
    0,
    0,
    0,
  ).getTime()
  const targetEndMs = targetStartMs + 24 * 60 * 60 * 1000

  for (const student of getActiveStudents()) {
    for (const session of student.scheduledClasses ?? []) {
      if (excludeSessionId && session.id === excludeSessionId) continue
      if (excludeSlotId && session.sourceSlotId?.trim() === excludeSlotId) continue
      if (session.status === 'completed' || session.status === 'cancelled') continue
      const when = new Date(session.scheduledFor)
      const t = when.getTime()
      if (!Number.isFinite(t) || t < targetStartMs || t >= targetEndMs) continue
      const otherStart = when.getHours() * 60 + when.getMinutes()
      const otherDur = session.durationMin
      if (sessionMinutesOverlap(snappedStart, durationMinutes, otherStart, otherDur)) {
        return {
          kind: 'session',
          studentName: student.name.trim() || 'Student',
          scheduledFor: session.scheduledFor,
          durationMin: otherDur,
        }
      }
    }
  }

  for (const slot of getWeeklySlotAssignments()) {
    if (excludeSlotId && slot.id === excludeSlotId) continue
    if (!slotWouldBlockTimeOnDate(slot, targetDay, snappedStart, durationMinutes)) continue
    return {
      kind: 'weekly_slot',
      studentName: studentNameForId(slot.studentId),
      dayOfWeek: slot.dayOfWeek,
      startMinute: slot.startMinute,
      durationMinutes: slot.durationMinutes,
      onDate: localDateKey(targetDay),
    }
  }

  return null
}

/** True when a weekly pattern would collide with sessions/slots over the next N days. */
function findWeeklyPatternHorizonConflict(
  assignment: WeeklySlotAssignment,
  excludeSlotId?: string,
  daysAhead: number = 30,
): ScheduleConflict | null {
  const windowDays = Math.max(1, Math.min(90, Math.floor(daysAhead)))
  generateScheduledClassesWindow(windowDays)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + windowDays)
  const cursor = new Date(today)

  while (cursor < horizon) {
    if (cursor.getDay() === assignment.dayOfWeek) {
      const occurrenceDate = localDateKey(cursor)
      if (excludeSlotId) {
        const exception = getWeeklySlotExceptions().find(
          (row) => row.slotId === excludeSlotId && row.localDate === occurrenceDate,
        )
        if (exception) {
          cursor.setDate(cursor.getDate() + 1)
          continue
        }
      }
      const conflict = findScheduleConflictOnDate(
        null,
        cursor,
        assignment.startMinute,
        assignment.durationMinutes,
        { excludeSlotId },
      )
      if (conflict) return conflict
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return null
}

export function validateSingleOccurrenceReschedule(
  studentId: string,
  sessionId: string | null,
  targetDay: Date,
  startMinute: number,
  durationMinutes: number,
): { ok: true } | { ok: false; error: string } {
  const config = getTeacherWeeklyScheduleConfig()
  if (!config.workingDays.includes(targetDay.getDay())) {
    return { ok: false, error: 'Unavailable that day.' }
  }
  const endMinute = startMinute + durationMinutes
  if (startMinute < config.startMinute || endMinute > config.endMinute) {
    return { ok: false, error: 'Time is outside your configured teaching hours.' }
  }

  generateScheduledClassesWindow(daysAheadToCover(targetDay))

  const conflict = findScheduleConflictOnDate(sessionId, targetDay, startMinute, durationMinutes)
  if (conflict) {
    return { ok: false, error: formatScheduleConflictError(conflict) }
  }

  return { ok: true }
}

export function rescheduleSingleClassOccurrence(
  studentId: string,
  sessionId: string,
  targetDay: Date,
  startMinute: number,
  durationMinutes: number,
): { ok: true } | { ok: false; error: string } {
  const validated = validateSingleOccurrenceReschedule(
    studentId,
    sessionId,
    targetDay,
    startMinute,
    durationMinutes,
  )
  if (!validated.ok) return validated

  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const session = (student.scheduledClasses ?? []).find((row) => row.id === sessionId)
  if (!session) return { ok: false, error: 'Class session not found.' }
  const slotId = session.sourceSlotId?.trim()
  if (!slotId) return { ok: false, error: 'This class is not tied to a weekly slot.' }

  const originalDate = new Date(session.scheduledFor)
  if (!Number.isFinite(originalDate.getTime())) {
    return { ok: false, error: 'Invalid class date.' }
  }
  const originalLocalDate = localDateKey(originalDate)

  const snappedStart = Math.floor(startMinute / SLOT_MINUTES) * SLOT_MINUTES
  const scheduledFor = isoForSlotDate(
    new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate()),
    snappedStart,
  )
  const nowIso = new Date().toISOString()

  upsertWeeklySlotException({
    slotId,
    localDate: originalLocalDate,
    type: 'rescheduled',
  })

  const nextSessions = sortClassesByDate(
    (student.scheduledClasses ?? [])
      .map((row) => {
        if (row.id !== sessionId) return row
        return {
          ...row,
          scheduledFor,
          durationMin: durationMinutes,
          updatedAt: nowIso,
        }
      })
      .map((row) => sanitizeClassSession(row))
      .filter((row): row is StudentClassSession => !!row),
  )

  saveStudent({ ...student, scheduledClasses: nextSessions, updatedAt: nowIso })
  notifyStudentLocalDataChanged(studentId)
  return { ok: true }
}

export function createOneOffClassSession(
  studentId: string,
  targetDay: Date,
  startMinute: number,
  durationMinutes: number,
): { ok: true; session: StudentClassSession } | { ok: false; error: string } {
  const studentCheck = getStudents().find((row) => row.id === studentId)
  if (!studentCheck) return { ok: false, error: 'Student not found.' }
  if (isStudentOnBreak(studentCheck)) {
    return { ok: false, error: 'This student is on break. Restore them before scheduling a class.' }
  }

  const validated = validateSingleOccurrenceReschedule(
    studentId,
    null,
    targetDay,
    startMinute,
    durationMinutes,
  )
  if (!validated.ok) return validated

  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return { ok: false, error: 'Student not found.' }

  const snappedStart = Math.floor(startMinute / SLOT_MINUTES) * SLOT_MINUTES
  const scheduledFor = isoForSlotDate(
    new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate()),
    snappedStart,
  )

  return upsertStudentClassSession(studentId, {
    title: `${student.name.trim() || 'Student'} class`,
    scheduledFor,
    durationMin: durationMinutes,
    status: 'planned',
  })
}

export function updateOneOffClassSession(
  studentId: string,
  sessionId: string,
  targetDay: Date,
  startMinute: number,
  durationMinutes: number,
): { ok: true } | { ok: false; error: string } {
  const validated = validateSingleOccurrenceReschedule(
    studentId,
    sessionId,
    targetDay,
    startMinute,
    durationMinutes,
  )
  if (!validated.ok) return validated

  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const session = (student.scheduledClasses ?? []).find((row) => row.id === sessionId)
  if (!session) return { ok: false, error: 'Class session not found.' }
  if (session.sourceSlotId?.trim()) {
    return { ok: false, error: 'This class is tied to a weekly slot. Use the recurring edit flow.' }
  }

  const snappedStart = Math.floor(startMinute / SLOT_MINUTES) * SLOT_MINUTES
  const scheduledFor = isoForSlotDate(
    new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate()),
    snappedStart,
  )
  const nowIso = new Date().toISOString()

  const nextSessions = sortClassesByDate(
    (student.scheduledClasses ?? [])
      .map((row) => {
        if (row.id !== sessionId) return row
        return {
          ...row,
          scheduledFor,
          durationMin: durationMinutes,
          updatedAt: nowIso,
        }
      })
      .map((row) => sanitizeClassSession(row))
      .filter((row): row is StudentClassSession => !!row),
  )

  saveStudent({ ...student, scheduledClasses: nextSessions, updatedAt: nowIso })
  notifyStudentLocalDataChanged(studentId)
  return { ok: true }
}

/** Restore planned vs prepared after leaving live without completing. */
function statusAfterLeavingLive(session: StudentClassSession): 'planned' | 'prepared' {
  const hasOutline = Boolean(session.prepTimeBlocks?.length)
  const hasPrepContent =
    hasOutline || Boolean(session.prepNotes?.trim()) || hasPrepExtras(session) || Boolean(session.prepOutlineSummary?.trim())
  return hasPrepContent ? 'prepared' : 'planned'
}

/**
 * Leave a live session without completing: clear live start, no bookmark, no completed.
 * Idempotent when the class is already planned/prepared.
 */
export function leaveLiveClassSessionWithoutCompleting(
  studentId: string,
  sessionId: string,
): { ok: true; status: 'planned' | 'prepared' } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const session = (student.scheduledClasses ?? []).find((row) => row.id === sessionId)
  if (!session) return { ok: false, error: 'Class session not found.' }

  if (session.status === 'planned' || session.status === 'prepared') {
    return { ok: true, status: session.status }
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    return { ok: false, error: 'This class is already finished.' }
  }
  if (session.status !== 'in_progress') {
    return { ok: false, error: 'This class cannot leave live.' }
  }

  const nowIso = new Date().toISOString()
  const nextStatus = statusAfterLeavingLive(session)
  const nextSessions = sortClassesByDate(
    (student.scheduledClasses ?? [])
      .map((row) => {
        if (row.id !== sessionId) return row
        return {
          ...row,
          status: nextStatus,
          classStartedAt: undefined,
          classEndedAt: undefined,
          extendedMinutesTotal: undefined,
          updatedAt: nowIso,
        }
      })
      .map((row) => sanitizeClassSession(row))
      .filter((row): row is StudentClassSession => !!row),
  )

  saveStudent({ ...student, scheduledClasses: nextSessions, updatedAt: nowIso })
  notifyStudentLocalDataChanged(studentId)
  return { ok: true, status: nextStatus }
}

/**
 * Move this class occurrence only (weekly pattern unchanged).
 * Supports planned/prepared, live (R2), and missed (Phase 5 reschedule).
 */
export function moveClassOccurrence(
  studentId: string,
  sessionId: string,
  targetDay: Date,
  startMinute: number,
  durationMinutes: number,
): { ok: true; scheduledFor: string } | { ok: false; error: string } {
  try {
    const students = getStudents()
    const student = students.find((row) => row.id === studentId)
    if (!student) return { ok: false, error: 'Student not found.' }
    const session = (student.scheduledClasses ?? []).find((row) => row.id === sessionId)
    if (!session) return { ok: false, error: 'Class session not found.' }

    if (session.status === 'completed' || session.status === 'cancelled') {
      return { ok: false, error: 'This class is already finished.' }
    }
    if (
      session.status !== 'planned' &&
      session.status !== 'prepared' &&
      session.status !== 'in_progress' &&
      session.status !== 'missed'
    ) {
      return { ok: false, error: 'This class cannot be moved.' }
    }

    const wasMissed = session.status === 'missed'

    if (session.status === 'in_progress') {
      const left = leaveLiveClassSessionWithoutCompleting(studentId, sessionId)
      if (!left.ok) return left
    }

    const refreshed = getStudentScheduledClasses(studentId).find((row) => row.id === sessionId)
    if (!refreshed) return { ok: false, error: 'Class session not found.' }

    const isOneOff = !refreshed.sourceSlotId?.trim()
    const result = isOneOff
      ? updateOneOffClassSession(studentId, sessionId, targetDay, startMinute, durationMinutes)
      : rescheduleSingleClassOccurrence(studentId, sessionId, targetDay, startMinute, durationMinutes)

    if (!result.ok) return result

    if (wasMissed) {
      const afterMove = getStudents().find((row) => row.id === studentId)
      const row = (afterMove?.scheduledClasses ?? []).find((s) => s.id === sessionId)
      if (afterMove && row) {
        const nowIso = new Date().toISOString()
        const nextStatus = statusAfterLeavingLive(row)
        const nextSessions = sortClassesByDate(
          (afterMove.scheduledClasses ?? [])
            .map((s) =>
              s.id === sessionId
                ? { ...s, status: nextStatus, classStartedAt: undefined, classEndedAt: undefined, updatedAt: nowIso }
                : s,
            )
            .map((s) => sanitizeClassSession(s))
            .filter((s): s is StudentClassSession => !!s),
        )
        saveStudent({ ...afterMove, scheduledClasses: nextSessions, updatedAt: nowIso })
        notifyStudentLocalDataChanged(studentId)
      }
    }

    const updated = getStudentScheduledClasses(studentId).find((row) => row.id === sessionId)
    if (!updated) return { ok: false, error: 'Class moved but could not reload the new time.' }
    return { ok: true, scheduledFor: updated.scheduledFor }
  } catch (err) {
    if (isBrowserStorageQuotaError(err)) {
      return { ok: false, error: BROWSER_STORAGE_FULL_MESSAGE }
    }
    const msg = err instanceof Error ? err.message : 'Could not move class.'
    if (/storage is full/i.test(msg)) return { ok: false, error: msg }
    return { ok: false, error: msg }
  }
}

export function cancelClassSession(
  studentId: string,
  sessionId: string,
): { ok: true } | { ok: false; error: string } {
  return transitionStudentClassStatus(studentId, sessionId, 'cancelled')
}

/**
 * Cancel this class occurrence. For weekly-linked sessions, also writes a
 * `cancelled` slot exception so the generator does not recreate that day.
 * Live sessions leave without bookmark / completed — clear live clock fields.
 */
export function cancelClassOccurrence(
  studentId: string,
  sessionId: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const students = getStudents()
    const idx = students.findIndex((row) => row.id === studentId)
    if (idx < 0) return { ok: false, error: 'Student not found.' }
    const student = students[idx]
    const session = (student.scheduledClasses ?? []).find((row) => row.id === sessionId)
    if (!session) return { ok: false, error: 'Class session not found.' }
    if (session.status === 'completed' || session.status === 'cancelled') {
      return { ok: false, error: 'This class is already finished.' }
    }

    const slotId = session.sourceSlotId?.trim()
    const when = new Date(session.scheduledFor)
    const occurrenceDate = Number.isFinite(when.getTime()) ? localDateKey(when) : null
    const wasLive = session.status === 'in_progress'
    const nowIso = new Date().toISOString()

    const nextSessions = sortClassesByDate(
      (student.scheduledClasses ?? [])
        .map((row) => {
          if (row.id !== sessionId) return row
          return {
            ...row,
            status: 'cancelled' as const,
            ...(wasLive
              ? {
                  classStartedAt: undefined,
                  classEndedAt: undefined,
                  extendedMinutesTotal: undefined,
                }
              : {}),
            updatedAt: nowIso,
          }
        })
        .map((row) => sanitizeClassSession(row))
        .filter((row): row is StudentClassSession => !!row),
    )

    saveStudent({ ...student, scheduledClasses: nextSessions, updatedAt: nowIso })

    if (slotId && occurrenceDate) {
      upsertWeeklySlotException({
        slotId,
        localDate: occurrenceDate,
        type: 'cancelled',
      })
    }

    notifyStudentLocalDataChanged(studentId)
    return { ok: true }
  } catch (err) {
    if (isBrowserStorageQuotaError(err)) {
      return { ok: false, error: BROWSER_STORAGE_FULL_MESSAGE }
    }
    const msg = err instanceof Error ? err.message : 'Could not cancel class.'
    if (/storage is full/i.test(msg)) return { ok: false, error: msg }
    return { ok: false, error: msg }
  }
}

/**
 * Cancel all planned/prepared classes in [rangeStart, rangeEnd] (inclusive local days).
 * Weekly slot assignments are kept; cancelled exceptions prevent regeneration.
 */
export function clearScheduledClassesInDateRange(
  rangeStart: Date,
  rangeEnd: Date,
): { ok: true; cancelledCount: number } {
  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate())
  const rows = getClassSessionsForDateRange(start, end, {
    daysAhead: daysAheadToCover(end),
  })

  let cancelledCount = 0
  const touchedStudents = new Set<string>()
  for (const row of rows) {
    if (row.session.status !== 'planned' && row.session.status !== 'prepared') continue
    const result = cancelClassOccurrence(row.studentId, row.session.id)
    if (result.ok) {
      cancelledCount += 1
      touchedStudents.add(row.studentId)
    }
  }

  for (const studentId of touchedStudents) {
    notifyStudentLocalDataChanged(studentId)
  }

  return { ok: true, cancelledCount }
}

/**
 * Cancel one student's planned/prepared classes in [rangeStart, rangeEnd].
 * Weekly slot assignments stay; cancelled exceptions prevent regeneration.
 */
export function clearStudentClassesInDateRange(
  studentId: string,
  rangeStart: Date,
  rangeEnd: Date,
): { ok: true; cancelledCount: number } | { ok: false; error: string } {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return { ok: false, error: 'Student not found.' }

  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate())
  const startMs = start.getTime()
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime()

  generateScheduledClassesWindow(daysAheadToCover(end))

  let cancelledCount = 0
  const sessions = [...(student.scheduledClasses ?? [])]
  for (const session of sessions) {
    if (session.status !== 'planned' && session.status !== 'prepared') continue
    const t = new Date(session.scheduledFor).getTime()
    if (!Number.isFinite(t) || t < startMs || t >= endMs) continue
    const result = cancelClassOccurrence(studentId, session.id)
    if (result.ok) cancelledCount += 1
  }

  if (cancelledCount > 0) notifyStudentLocalDataChanged(studentId)
  return { ok: true, cancelledCount }
}

/**
 * Remove this student from the teaching calendar: drop all their weekly times and
 * cancel planned / prepared / live classes. Completed history stays. Other students untouched.
 */
export function removeStudentFromCalendar(studentId: string): {
  ok: true
  removedSlots: number
  cancelledSessions: number
} | { ok: false; error: string } {
  if (typeof window === 'undefined') return { ok: false, error: 'Not available.' }
  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }

  const removedSlots = removeWeeklySlotsForStudent(studentId)

  const nowIso = new Date().toISOString()
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return { ok: false, error: 'Student not found.' }

  let cancelledSessions = 0
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (
      session.status !== 'planned' &&
      session.status !== 'prepared' &&
      session.status !== 'in_progress'
    ) {
      return session
    }
    cancelledSessions += 1
    return {
      ...session,
      status: 'cancelled' as const,
      updatedAt: nowIso,
      classStartedAt: undefined,
      classEndedAt: undefined,
    }
  })

  if (cancelledSessions > 0) {
    saveStudent({
      ...student,
      scheduledClasses: sortClassesByDate(
        nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
      ),
      updatedAt: nowIso,
    })
  }

  notifyStudentLocalDataChanged(studentId)
  flushWeeklyScheduleToDisk()
  return { ok: true, removedSlots, cancelledSessions }
}

/**
 * Wipe the teaching calendar: remove all weekly times + exceptions, and cancel
 * every planned / prepared / live class. Students and completed class history stay.
 */
export function resetTeacherCalendar(): {
  ok: true
  removedSlots: number
  cancelledSessions: number
} {
  if (typeof window === 'undefined') {
    return { ok: true, removedSlots: 0, cancelledSessions: 0 }
  }

  const assignments = getWeeklySlotAssignments()
  const removedSlots = assignments.length
  saveWeeklySlotAssignments([])
  saveWeeklySlotExceptions([])

  const nowIso = new Date().toISOString()
  let cancelledSessions = 0
  const students = getStudents()
  for (const student of students) {
    let changed = false
    const nextSessions = (student.scheduledClasses ?? []).map((session) => {
      if (
        session.status !== 'planned' &&
        session.status !== 'prepared' &&
        session.status !== 'in_progress'
      ) {
        return session
      }
      changed = true
      cancelledSessions += 1
      return {
        ...session,
        status: 'cancelled' as const,
        updatedAt: nowIso,
        // Clear live markers so nothing looks mid-class after reset
        classStartedAt: undefined,
        classEndedAt: undefined,
      }
    })
    if (!changed) continue
    saveStudent({
      ...student,
      scheduledClasses: sortClassesByDate(
        nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
      ),
      updatedAt: nowIso,
    })
    notifyStudentLocalDataChanged(student.id)
  }

  flushWeeklyScheduleToDisk()
  return { ok: true, removedSlots, cancelledSessions }
}

function buildWeeklySlotFromInput(
  input: WeeklySlotAssignmentInput,
  existing?: WeeklySlotAssignment,
): { ok: true; assignment: WeeklySlotAssignment } | { ok: false; error: string } {
  const student = getStudents().find((row) => row.id === input.studentId)
  if (!student) {
    return { ok: false, error: 'Student not found.' }
  }
  if (isStudentOnBreak(student)) {
    return { ok: false, error: 'This student is on break. Restore them before setting a weekly time.' }
  }
  const dayOfWeek = Number(input.dayOfWeek)
  const startMinute = Number(input.startMinute)
  const durationMinutes = normalizeClassDurationMinutes(input.durationMinutes, 30)
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { ok: false, error: 'Invalid day of week.' }
  }
  if (!Number.isFinite(startMinute) || startMinute < 0 || startMinute > 23 * 60 + 30) {
    return { ok: false, error: 'Invalid start time.' }
  }
  const nowIso = new Date().toISOString()
  const assignment: WeeklySlotAssignment = {
    id: existing?.id ?? `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dayOfWeek,
    startMinute: Math.floor(startMinute / SLOT_MINUTES) * SLOT_MINUTES,
    durationMinutes,
    studentId: input.studentId,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  }
  const config = getTeacherWeeklyScheduleConfig()
  if (!config.workingDays.includes(assignment.dayOfWeek)) {
    return { ok: false, error: 'Unavailable that day.' }
  }
  const assignmentEnd = assignment.startMinute + assignment.durationMinutes
  if (assignment.startMinute < config.startMinute || assignmentEnd > config.endMinute) {
    return { ok: false, error: 'Slot is outside your configured teaching time range.' }
  }
  return { ok: true, assignment }
}

function cancelFutureSessionsForSlot(slotId: string): void {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const nowIso = new Date().toISOString()
  for (const student of getStudents()) {
    let changed = false
    const nextSessions = (student.scheduledClasses ?? []).map((session) => {
      if (session.sourceSlotId !== slotId) return session
      if (session.status !== 'planned' && session.status !== 'prepared') return session
      const t = new Date(session.scheduledFor).getTime()
      if (!Number.isFinite(t) || t < todayMs) return session
      changed = true
      return { ...session, status: 'cancelled' as const, updatedAt: nowIso }
    })
    if (changed) {
      saveStudent({
        ...student,
        scheduledClasses: sortClassesByDate(
          nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
        ),
        updatedAt: nowIso,
      })
    }
  }
}

function findActiveWeeklySlotCollision(
  assignment: WeeklySlotAssignment,
  excludeSlotId?: string,
): WeeklySlotAssignment | undefined {
  const keepIds = activeStudentIds()
  return getWeeklySlotAssignments().find(
    (row) =>
      row.id !== excludeSlotId &&
      keepIds.has(row.studentId) &&
      overlapsSlot(row, assignment),
  )
}

export function upsertWeeklySlotAssignment(
  input: WeeklySlotAssignmentInput,
): { ok: true; assignment: WeeklySlotAssignment } | { ok: false; error: string } {
  pruneOrphanWeeklySlots()
  const built = buildWeeklySlotFromInput(input)
  if (!built.ok) return built
  const assignment = built.assignment
  const collision = findActiveWeeklySlotCollision(assignment)
  if (collision) {
    return { ok: false, error: weeklySlotConflictMessage(collision) }
  }
  const horizonConflict = findWeeklyPatternHorizonConflict(assignment)
  if (horizonConflict) {
    return { ok: false, error: formatScheduleConflictError(horizonConflict) }
  }
  const next = [...getWeeklySlotAssignments(), assignment].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
  )
  saveWeeklySlotAssignments(next)
  generateScheduledClassesWindow(30)
  notifyStudentLocalDataChanged(input.studentId)
  return { ok: true, assignment }
}

export function validateWeeklySlotUpdate(
  slotId: string,
  input: WeeklySlotAssignmentInput,
): { ok: true; assignment: WeeklySlotAssignment } | { ok: false; error: string } {
  pruneOrphanWeeklySlots()
  const assignments = getWeeklySlotAssignments()
  const existing = assignments.find((assignment) => assignment.id === slotId)
  if (!existing) return { ok: false, error: 'Slot assignment not found.' }
  const built = buildWeeklySlotFromInput(input, existing)
  if (!built.ok) return built
  const assignment = built.assignment
  const collision = findActiveWeeklySlotCollision(assignment, slotId)
  if (collision) {
    return { ok: false, error: weeklySlotConflictMessage(collision) }
  }
  const horizonConflict = findWeeklyPatternHorizonConflict(assignment, slotId)
  if (horizonConflict) {
    return { ok: false, error: formatScheduleConflictError(horizonConflict) }
  }
  return { ok: true, assignment }
}

export function updateWeeklySlotAssignment(
  slotId: string,
  input: WeeklySlotAssignmentInput,
): { ok: true; assignment: WeeklySlotAssignment } | { ok: false; error: string } {
  const validated = validateWeeklySlotUpdate(slotId, input)
  if (!validated.ok) return validated
  const assignment = validated.assignment
  const assignments = getWeeklySlotAssignments()
  const next = assignments
    .map((row) => (row.id === slotId ? assignment : row))
    .sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.startMinute - b.startMinute))
  saveWeeklySlotAssignments(next)
  cancelFutureSessionsForSlot(slotId)
  generateScheduledClassesWindow(30)
  notifyStudentLocalDataChanged(input.studentId)
  return { ok: true, assignment }
}

export function removeWeeklySlotAssignment(slotId: string): { ok: true } | { ok: false; error: string } {
  const assignments = getWeeklySlotAssignments()
  const next = assignments.filter((assignment) => assignment.id !== slotId)
  if (next.length === assignments.length) return { ok: false, error: 'Slot assignment not found.' }
  cancelFutureSessionsForSlot(slotId)
  removeWeeklySlotExceptionsForSlot(slotId)
  saveWeeklySlotAssignments(next)
  generateScheduledClassesWindow(30)
  return { ok: true }
}

/** Drop all weekly teaching slots for a student (e.g. when removing or putting on break). */
export function removeWeeklySlotsForStudent(studentId: string): number {
  const assignments = getWeeklySlotAssignments()
  const removedSlots = assignments.filter((assignment) => assignment.studentId === studentId)
  if (removedSlots.length === 0) return 0
  for (const slot of removedSlots) {
    cancelFutureSessionsForSlot(slot.id)
    removeWeeklySlotExceptionsForSlot(slot.id)
  }
  const next = assignments.filter((assignment) => assignment.studentId !== studentId)
  saveWeeklySlotAssignments(next)
  flushWeeklyScheduleToDisk()
  return removedSlots.length
}

/** Put a student on break: hide from roster, free weekly times, cancel future planned classes. */
export function putStudentOnBreak(studentId: string): { ok: true } | { ok: false; error: string } {
  if (typeof window === 'undefined') return { ok: false, error: 'Not available.' }
  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  if (isStudentOnBreak(student)) return { ok: true }

  removeWeeklySlotsForStudent(studentId)

  const nowIso = new Date().toISOString()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const nextSessions = (student.scheduledClasses ?? []).map((session) => {
    if (session.status !== 'planned' && session.status !== 'prepared') return session
    const t = new Date(session.scheduledFor).getTime()
    if (!Number.isFinite(t) || t < todayMs) return session
    return { ...session, status: 'cancelled' as const, updatedAt: nowIso }
  })

  saveStudent({
    ...student,
    rosterStatus: 'on_break',
    onBreakAt: nowIso,
    scheduledClasses: sortClassesByDate(
      nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
    ),
    updatedAt: nowIso,
  })
  notifyStudentLocalDataChanged(studentId)
  return { ok: true }
}

/** Restore a student from on break to the active roster. */
export function restoreStudentFromBreak(studentId: string): { ok: true } | { ok: false; error: string } {
  if (typeof window === 'undefined') return { ok: false, error: 'Not available.' }
  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  if (!isStudentOnBreak(student)) return { ok: true }

  const { onBreakAt: _cleared, ...rest } = student
  saveStudent({
    ...rest,
    rosterStatus: 'active',
    updatedAt: new Date().toISOString(),
  })
  notifyStudentLocalDataChanged(studentId)
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
  const { startMs, endMs } = getLocalDayBoundsMs(day)
  const rangeStart = new Date(startMs)
  const rangeEnd = new Date(endMs - 1)
  return getClassSessionsForDateRange(rangeStart, rangeEnd)
}

/** Class sessions in a local date range (inclusive), excluding completed/cancelled. */
export function getClassSessionsForDateRange(
  start: Date,
  end: Date,
  options?: { daysAhead?: number },
): TodaysClassSessionRow[] {
  pruneOrphanWeeklySlots()
  generateScheduledClassesWindow(options?.daysAhead ?? 30)
  const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0).getTime()
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 0, 0, 0, 0).getTime()
  const out: TodaysClassSessionRow[] = []
  for (const row of getActiveStudents()) {
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

/** Prefer end time for “which day did this class land on”; else scheduled start. */
function classDayAnchorMs(session: StudentClassSession): number | null {
  const ended = session.classEndedAt ? new Date(session.classEndedAt).getTime() : NaN
  if (Number.isFinite(ended)) return ended
  const scheduled = new Date(session.scheduledFor).getTime()
  return Number.isFinite(scheduled) ? scheduled : null
}

/** Completed classes that belong to this local calendar day (for Dashboard “Done”). */
export function getTodaysCompletedClassSessionsForTeacher(day: Date = new Date()): TodaysClassSessionRow[] {
  pruneOrphanWeeklySlots()
  generateScheduledClassesWindow(30)
  const { startMs, endMs } = getLocalDayBoundsMs(day)
  const out: TodaysClassSessionRow[] = []
  for (const row of getActiveStudents()) {
    const sessions = (row.scheduledClasses ?? [])
      .map((session) => sanitizeClassSession(session))
      .filter((session): session is StudentClassSession => !!session)
    for (const session of sessions) {
      if (session.status !== 'completed') continue
      const anchor = classDayAnchorMs(session)
      if (anchor == null || anchor < startMs || anchor >= endMs) continue
      out.push({ studentId: row.id, studentName: row.name.trim() || 'Student', session })
    }
  }
  out.sort((a, b) => {
    const aMs = classDayAnchorMs(a.session) ?? 0
    const bMs = classDayAnchorMs(b.session) ?? 0
    return aMs - bMs
  })
  return out
}

export type DashboardStillOpenKind = 'needs_recap' | 'missed' | 'needs_prep'

export interface DashboardStillOpenItem extends TodaysClassSessionRow {
  kind: DashboardStillOpenKind
}

/** Soft after-class recap still waiting (same rule as Past classes). */
export function sessionNeedsPostClassRecap(session: StudentClassSession): boolean {
  return (
    session.status === 'completed' &&
    !session.classEndNote?.trim() &&
    session.postClassRecapPromptDismissed !== true
  )
}

const DASHBOARD_RECAP_LOOKBACK_DAYS = 7

/**
 * Cross-student leftovers for the Dashboard Still open band.
 * Recaps: last 7 local days. Prep: planned on today or tomorrow. Missed: any open missed.
 */
export function getDashboardStillOpenItems(nowMs: number = Date.now()): DashboardStillOpenItem[] {
  pruneOrphanWeeklySlots()
  generateScheduledClassesWindow(30)
  const now = new Date(nowMs)
  const todayBounds = getLocalDayBoundsMs(now)
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const tomorrowBounds = getLocalDayBoundsMs(tomorrow)
  const prepEndMs = tomorrowBounds.endMs
  const recapStartMs = getLocalDayBoundsMs(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DASHBOARD_RECAP_LOOKBACK_DAYS - 1)),
  ).startMs

  const out: DashboardStillOpenItem[] = []
  for (const row of getActiveStudents()) {
    const studentName = row.name.trim() || 'Student'
    const sessions = (row.scheduledClasses ?? [])
      .map((session) => sanitizeClassSession(session))
      .filter((session): session is StudentClassSession => !!session)
    for (const session of sessions) {
      if (session.status === 'missed') {
        out.push({ kind: 'missed', studentId: row.id, studentName, session })
        continue
      }
      if (session.status === 'planned') {
        const t = new Date(session.scheduledFor).getTime()
        if (Number.isFinite(t) && t >= todayBounds.startMs && t < prepEndMs) {
          out.push({ kind: 'needs_prep', studentId: row.id, studentName, session })
        }
        continue
      }
      if (sessionNeedsPostClassRecap(session)) {
        const anchor = classDayAnchorMs(session)
        if (anchor != null && anchor >= recapStartMs && anchor < todayBounds.endMs) {
          out.push({ kind: 'needs_recap', studentId: row.id, studentName, session })
        }
      }
    }
  }

  const kindRank: Record<DashboardStillOpenKind, number> = {
    missed: 0,
    needs_recap: 1,
    needs_prep: 2,
  }
  out.sort((a, b) => {
    const kr = kindRank[a.kind] - kindRank[b.kind]
    if (kr !== 0) return kr
    const aMs = classDayAnchorMs(a.session) ?? new Date(a.session.scheduledFor).getTime()
    const bMs = classDayAnchorMs(b.session) ?? new Date(b.session.scheduledFor).getTime()
    return aMs - bMs
  })
  return out
}

const NOW_LIVE_STATES: TodayClassTeachingState[] = ['ending', 'grace', 'live', 'starting']

/** One class in focus for the Dashboard Now band (live/starting first, else soonest upcoming today). */
export function pickDashboardNowRow(
  todaysOpenRows: TodaysClassSessionRow[],
  nowMs: number = Date.now(),
): TodaysClassSessionRow | null {
  if (todaysOpenRows.length === 0) return null

  const withState = todaysOpenRows.map((row) => ({
    row,
    state: resolveTodayClassTeachingState(row.session, nowMs),
  }))

  for (const state of NOW_LIVE_STATES) {
    const matches = withState
      .filter((item) => item.state === state)
      .sort(
        (a, b) =>
          new Date(a.row.session.scheduledFor).getTime() - new Date(b.row.session.scheduledFor).getTime(),
      )
    if (matches[0]) return matches[0].row
  }

  const upcoming = withState
    .filter((item) => item.state === 'upcoming')
    .sort(
      (a, b) =>
        new Date(a.row.session.scheduledFor).getTime() - new Date(b.row.session.scheduledFor).getTime(),
    )
  return upcoming[0]?.row ?? null
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
  const assignedBookIds = dedupeStrings(student.assignedBookIds ?? [])
  const assignedUnitRefs = dedupeUnitRefs(student.assignedUnitRefs ?? [])
  const out: StudentSectionOption[] = []
  const pushUnitSections = (bookId: string, unitId: string) => {
    const book = library.books.find((item) => item.id === bookId)
    const unit = book?.units.find((item) => item.id === unitId)
    if (!book || !unit) return
    out.push(...flattenUnitSections(book, unit))
  }
  if (assignedBookIds.length) {
    for (const bookId of assignedBookIds) {
      const book = library.books.find((item) => item.id === bookId)
      if (!book) continue
      for (const unit of book.units) out.push(...flattenUnitSections(book, unit))
    }
  } else {
    for (const ref of assignedUnitRefs) pushUnitSections(ref.bookId, ref.unitId)
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
    const bookStarts = resolveCurriculumBookStarts(studentRec, library, options)
    const fromBookStart = mostRecentCurriculumBookStart(bookStarts, options)
    if (fromBookStart) return fromBookStart
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

/**
 * Find the curriculum section (lesson/part) that contains a PDF page for a book+unit.
 * Walks options newest-to-oldest so nested parts resolve to the most specific match.
 */
export function resolveStudentSectionAtPdfPage(
  studentId: string,
  library: BookLibraryPayload | null,
  bookId: string,
  unitId: string,
  pdfPage: number,
  totalPdfPages: number | null = null,
): StudentSectionOption | null {
  if (!library?.books?.length) return null
  const page = Math.floor(pdfPage)
  if (!Number.isFinite(page) || page < 1) return null
  const bid = bookId.trim()
  const uid = unitId.trim()
  if (!bid || !uid) return null
  const book = library.books.find((b) => b.id === bid)
  const unit = book?.units.find((u) => u.id === uid)
  if (!book || !unit) return null

  const options = getStudentSectionOptions(studentId, library)
  for (let i = options.length - 1; i >= 0; i--) {
    const o = options[i]!
    if (o.bookId !== bid || o.unitId !== uid) continue
    if (pageInSectionOptionRange(o, page, book, unit, totalPdfPages)) return o
  }
  return null
}

/**
 * Find the curriculum section for a **book / mapped page** (printed page from TOC).
 * Converts to PDF index using page alignment, then delegates to resolveStudentSectionAtPdfPage.
 */
export function resolveStudentSectionAtMappedPage(
  studentId: string,
  library: BookLibraryPayload | null,
  bookId: string,
  unitId: string,
  mappedPage: number,
  totalPdfPages: number | null,
): StudentSectionOption | null {
  if (!library?.books?.length) return null
  const page = Math.floor(mappedPage)
  if (!Number.isFinite(page) || page < 1) return null
  const bid = bookId.trim()
  const uid = unitId.trim()
  const book = library.books.find((b) => b.id === bid)
  const unit = book?.units.find((u) => u.id === uid)
  const pdf =
    resolveMappedPageToPdfPage(page, book, unit, totalPdfPages) ??
    page
  return resolveStudentSectionAtPdfPage(studentId, library, bid, uid, pdf, totalPdfPages)
}

/** Whether a printed / mapped book page falls inside a section's TOC page hints. */
export function mappedPageInSectionOptionRange(
  option: StudentSectionOption,
  mappedPage: number,
): boolean {
  const page = Math.floor(mappedPage)
  if (!Number.isFinite(page) || page < 1) return false
  const start = option.startPageHint ?? 1
  const endHint = option.endPageHint ?? option.startPageHint
  const end = endHint != null && Number.isFinite(endHint) ? Math.max(start, Math.floor(endHint)) : null
  if (end == null || !Number.isFinite(end)) return page >= start
  return page >= start && page <= end
}

/**
 * Find the curriculum section for a **book-wide mapped page** (printed page from TOC).
 * Searches all units in the book; walks options newest-to-oldest for specificity.
 */
export function resolveStudentSectionAtMappedBookPage(
  studentId: string,
  library: BookLibraryPayload | null,
  bookId: string,
  mappedPage: number,
): StudentSectionOption | null {
  if (!library?.books?.length) return null
  const page = Math.floor(mappedPage)
  if (!Number.isFinite(page) || page < 1) return null
  const bid = bookId.trim()
  if (!bid) return null

  const options = getStudentSectionOptions(studentId, library)
  for (let i = options.length - 1; i >= 0; i--) {
    const o = options[i]!
    if (o.bookId !== bid) continue
    if (mappedPageInSectionOptionRange(o, page)) return o
  }
  return null
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
 *
 * Prefer {@link getStudentTeachingOpenPdfPageForBookUnit} when opening the teaching reader —
 * that ladder puts the teacher plan pin above casual browse history.
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
    if (u && u !== uid) continue
    consider(bm.pdfPage, s.classEndedAt ?? s.updatedAt ?? s.scheduledFor)
  }
  for (const h of student.curriculumHistory ?? []) {
    if (h.bookId !== bid || h.unitId !== uid) continue
    consider(h.page, h.closedAt ?? h.openedAt)
  }
  return bestPage
}

/** End-of-class bookmark for this book+unit (newest completed class), with timestamp. */
export function getStudentLastClassBookmarkForBookUnit(
  studentId: string,
  bookId: string,
  unitId: string,
): { pdfPage: number; atMs: number } | null {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student || !bookId.trim() || !unitId.trim()) return null
  const bid = bookId.trim()
  const uid = unitId.trim()
  let best: { pdfPage: number; atMs: number } | null = null
  for (const s of student.scheduledClasses ?? []) {
    if (s.status !== 'completed') continue
    const bm = s.bookmarkAtEnd
    if (!bm?.bookId?.trim() || bm.bookId.trim() !== bid) continue
    const u = bm.unitId?.trim()
    if (u && u !== uid) continue
    const page = bm.pdfPage
    if (!Number.isFinite(page) || page < 1) continue
    const t = Date.parse(s.classEndedAt ?? s.updatedAt ?? s.scheduledFor)
    if (!Number.isFinite(t)) continue
    if (!best || t >= best.atMs) {
      best = { pdfPage: Math.max(1, Math.floor(page)), atMs: t }
    }
  }
  return best
}

/** Newest end-of-class bookmark for this book (any unit), with timestamp. */
export function getStudentLastClassBookmarkForBook(
  studentId: string,
  bookId: string,
): { pdfPage: number; unitId?: string; atMs: number } | null {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student || !bookId.trim()) return null
  const bid = bookId.trim()
  let best: { pdfPage: number; unitId?: string; atMs: number } | null = null
  for (const s of student.scheduledClasses ?? []) {
    if (s.status !== 'completed') continue
    const bm = s.bookmarkAtEnd
    if (!bm?.bookId?.trim() || bm.bookId.trim() !== bid) continue
    const page = bm.pdfPage
    if (!Number.isFinite(page) || page < 1) continue
    const t = Date.parse(s.classEndedAt ?? s.updatedAt ?? s.scheduledFor)
    if (!Number.isFinite(t)) continue
    if (!best || t >= best.atMs) {
      best = {
        pdfPage: Math.max(1, Math.floor(page)),
        unitId: bm.unitId?.trim() || undefined,
        atMs: t,
      }
    }
  }
  return best
}

/** End-of-class bookmark PDF page for this book+unit (newest completed class). */
export function getStudentLastClassBookmarkPdfPageForBookUnit(
  studentId: string,
  bookId: string,
  unitId: string,
): number | null {
  return getStudentLastClassBookmarkForBookUnit(studentId, bookId, unitId)?.pdfPage ?? null
}

function pdfPageFromCurriculumBookStart(
  bookStart: StudentCurriculumBookStart,
  bookId: string,
  library: BookLibraryPayload | null,
  totalPdfPages: number | null,
): number | null {
  const book = library?.books.find((b) => b.id === bookId)
  const unit = book?.units.find((u) => u.id === bookStart.unitId)
  if (book && unit) {
    const pdf =
      resolveMappedPageToPdfPage(bookStart.mappedPage, book, unit, totalPdfPages) ?? bookStart.mappedPage
    if (Number.isFinite(pdf) && pdf >= 1) return Math.max(1, Math.floor(pdf))
    return null
  }
  if (Number.isFinite(bookStart.mappedPage) && bookStart.mappedPage >= 1) {
    return Math.max(1, Math.floor(bookStart.mappedPage))
  }
  return null
}

/**
 * End-class used to default missing page hints to PDF page 1. Treat that as a weak stop when a
 * real planned start exists, so reopen does not jump to the cover.
 */
function isWeakDefaultPageOneStop(
  pdfPage: number,
  bookStart: StudentCurriculumBookStart | null,
): boolean {
  return pdfPage === 1 && bookStart != null && bookStart.mappedPage > 1
}

/** True when this book’s plan pin was saved more recently than its last class stop. */
export function isStudentCurriculumBookStartFresherThanLastStop(
  studentId: string,
  bookId: string,
  library: BookLibraryPayload | null = null,
): boolean {
  const bookStart = getStudentCurriculumBookStart(studentId, bookId, library)
  if (!bookStart) return false
  const startMs = Date.parse(bookStart.updatedAt)
  if (!Number.isFinite(startMs)) return false
  const last = getStudentLastClassBookmarkForBook(studentId, bookId)
  if (!last) return true
  if (isWeakDefaultPageOneStop(last.pdfPage, bookStart)) return true
  return startMs > last.atMs
}

/**
 * PDF page for opening the teaching reader on a book+unit.
 * Ladder: last-class bookmark (if ≥ plan pin time) → teacher starting place → weak reader history → null.
 * Re-saving a starting place beats an older last-class stop until the next end-class.
 */
export function getStudentTeachingOpenPdfPageForBookUnit(
  studentId: string,
  bookId: string,
  unitId: string,
  library: BookLibraryPayload | null = null,
  totalPdfPages: number | null = null,
): number | null {
  const bid = bookId.trim()
  const uid = unitId.trim()
  if (!bid || !uid) return null

  const bookStart = getStudentCurriculumBookStart(studentId, bid, library)
  const startMs = bookStart ? Date.parse(bookStart.updatedAt) : Number.NaN
  const startOnThisUnit = Boolean(bookStart && bookStart.unitId === uid)
  const startPdf =
    startOnThisUnit && bookStart
      ? pdfPageFromCurriculumBookStart(bookStart, bid, library, totalPdfPages)
      : null

  const lastStop = getStudentLastClassBookmarkForBookUnit(studentId, bid, uid)
  if (lastStop != null) {
    const startBeatsStop =
      startOnThisUnit && startPdf != null && Number.isFinite(startMs) && startMs > lastStop.atMs
    const weakPageOne = isWeakDefaultPageOneStop(lastStop.pdfPage, bookStart)
    if (!startBeatsStop && !weakPageOne) return lastStop.pdfPage
  }

  if (startPdf != null) return startPdf

  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return null
  let bestPage: number | null = null
  let bestTime = Number.NEGATIVE_INFINITY
  for (const h of student.curriculumHistory ?? []) {
    if (h.bookId !== bid || h.unitId !== uid) continue
    const page = h.page
    if (!Number.isFinite(page) || page < 1) continue
    const t = Date.parse(h.closedAt ?? h.openedAt)
    if (!Number.isFinite(t)) continue
    if (bestPage === null || t >= bestTime) {
      bestPage = Math.max(1, Math.floor(page))
      bestTime = t
    }
  }
  return bestPage
}

/**
 * Best unit + PDF page when opening a book without an explicit unit.
 * Prefers fresher plan pin’s unit, else last-class bookmark unit, else first unit page ladder.
 */
export function getStudentOpenTargetForBook(
  studentId: string,
  bookId: string,
  library: BookLibraryPayload | null = null,
  totalPdfPages: number | null = null,
): { unitId: string; pdfPage: number } | null {
  const bid = bookId.trim()
  if (!bid) return null
  const book = library?.books.find((b) => b.id === bid)
  if (!book?.units.length) return null

  const bookStart = getStudentCurriculumBookStart(studentId, bid, library)
  const startFresher = isStudentCurriculumBookStartFresherThanLastStop(studentId, bid, library)
  if (startFresher && bookStart) {
    const unit = book.units.find((u) => u.id === bookStart.unitId)
    if (unit) {
      const pdf =
        getStudentTeachingOpenPdfPageForBookUnit(studentId, bid, unit.id, library, totalPdfPages) ??
        pdfPageFromCurriculumBookStart(bookStart, bid, library, totalPdfPages)
      if (pdf != null) return { unitId: unit.id, pdfPage: pdf }
    }
  }

  const last = getStudentLastClassBookmarkForBook(studentId, bid)
  if (last) {
    const unit =
      (last.unitId ? book.units.find((u) => u.id === last.unitId) : null) ?? book.units[0] ?? null
    if (unit) {
      const pdf =
        getStudentTeachingOpenPdfPageForBookUnit(studentId, bid, unit.id, library, totalPdfPages) ??
        last.pdfPage
      return { unitId: unit.id, pdfPage: pdf }
    }
  }

  if (bookStart) {
    const unit = book.units.find((u) => u.id === bookStart.unitId) ?? book.units[0]
    if (unit) {
      const pdf =
        getStudentTeachingOpenPdfPageForBookUnit(studentId, bid, unit.id, library, totalPdfPages) ??
        pdfPageFromCurriculumBookStart(bookStart, bid, library, totalPdfPages) ??
        1
      return { unitId: unit.id, pdfPage: pdf }
    }
  }

  const first = book.units[0]
  if (!first) return null
  const pdf = getStudentTeachingOpenPdfPageForBookUnit(studentId, bid, first.id, library, totalPdfPages) ?? 1
  return { unitId: first.id, pdfPage: pdf }
}

/** Book + unit for a class session: saved section → auto next section → assignment default. */
export function resolveClassTeachingBookUnit(
  studentId: string,
  classSessionId: string,
  library: BookLibraryPayload | null | undefined,
): { bookId: string; unitId: string; section: StudentSectionOption | null } | null {
  const sessions = getStudentScheduledClasses(studentId)
  const session = sessions.find((s) => s.id === classSessionId)
  if (!session) return null

  const options = library?.books?.length ? getStudentSectionOptions(studentId, library) : []
  const savedId = session.selectedSection?.id?.trim()
  const fromSaved = savedId ? (options.find((o) => o.id === savedId) ?? null) : null
  if (fromSaved) {
    return { bookId: fromSaved.bookId, unitId: fromSaved.unitId, section: fromSaved }
  }
  if (session.selectedSection?.bookId?.trim() && session.selectedSection.unitId?.trim()) {
    return {
      bookId: session.selectedSection.bookId.trim(),
      unitId: session.selectedSection.unitId.trim(),
      section: null,
    }
  }

  const fromNext = library?.books?.length
    ? resolveNextSectionForClass(studentId, classSessionId, library)
    : null
  if (fromNext) {
    return { bookId: fromNext.bookId, unitId: fromNext.unitId, section: fromNext }
  }

  const fallback = getStudentDefaultBookUnitForReader(studentId, library)
  if (!fallback) return null
  return { bookId: fallback.bookId, unitId: fallback.unitId, section: null }
}

/** Drop pathLabel when persisting a section option onto a class session. */
export function toStudentBookSectionRef(option: StudentSectionOption): StudentBookSectionRef {
  return {
    id: option.id,
    type: option.type,
    bookId: option.bookId,
    bookTitle: option.bookTitle,
    unitId: option.unitId,
    unitTitle: option.unitTitle,
    title: option.title,
    ...(option.lessonId ? { lessonId: option.lessonId } : {}),
    ...(option.lessonTitle ? { lessonTitle: option.lessonTitle } : {}),
    ...(option.partId ? { partId: option.partId } : {}),
    ...(option.partTitle ? { partTitle: option.partTitle } : {}),
    ...(option.partStructureTag ? { partStructureTag: option.partStructureTag } : {}),
    ...(typeof option.startPageHint === 'number' ? { startPageHint: option.startPageHint } : {}),
    ...(typeof option.endPageHint === 'number' ? { endPageHint: option.endPageHint } : {}),
  }
}

/**
 * Default book + unit when opening the teaching reader for a student without explicit `book` / `unit` in the URL.
 * Prefers each assigned book’s starting-place unit when set; else assigned unit refs; else first unit.
 */
export function getStudentDefaultBookUnitForReader(
  studentId: string,
  library: BookLibraryPayload | null | undefined,
): { bookId: string; unitId: string } | null {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student || !library?.books?.length) return null
  const bookMap = new Map(library.books.map((b) => [b.id, b]))

  for (const bid of student.assignedBookIds ?? []) {
    const book = bookMap.get(bid)
    if (!book) continue
    const openTarget = getStudentOpenTargetForBook(studentId, bid, library)
    if (openTarget) {
      const unit = book.units.find((u) => u.id === openTarget.unitId)
      if (unit) return { bookId: bid, unitId: unit.id }
    }
    const start = getStudentCurriculumBookStart(studentId, bid, library)
    if (start) {
      const unit = book.units.find((u) => u.id === start.unitId)
      if (unit) return { bookId: bid, unitId: unit.id }
    }
  }

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
 * Short “last time we stopped…” line for the next/live class card.
 * Prefers the prior class bookmark (any book), then same-book reader history.
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

  if (bookmark?.bookId?.trim()) {
    const bmBookId = bookmark.bookId.trim()
    const bmUnitId = bookmark.unitId?.trim()
    const page = bookmark.pdfPage
    if (Number.isFinite(page) && page >= 1) {
      const bmBook = library.books.find((b) => b.id === bmBookId)
      const bmUnit = bmUnitId ? bmBook?.units.find((u) => u.id === bmUnitId) : bmBook?.units[0]
      const pageLabel = mapPdfPageToDisplayLabel(Math.floor(page), bmBook, bmUnit, null, 'mapped')
      const sameBookUnit = bmBookId === bid && (!bmUnitId || bmUnitId === uid)
      if (sameBookUnit) {
        const options = getStudentSectionOptions(studentId, library)
        let piece: StudentSectionOption | null = null
        for (let i = options.length - 1; i >= 0; i--) {
          const o = options[i]
          if (o.bookId !== bid) continue
          if (bmUnitId && o.unitId !== bmUnitId) continue
          const b = library.books.find((bk) => bk.id === o.bookId)
          const u = b?.units.find((un) => un.id === o.unitId)
          if (pageInSectionOptionRange(o, page, b, u, null)) {
            piece = o
            break
          }
        }
        const pieceTitle = piece ? displaySectionTitleForHeadline(piece) : null
        return pieceTitle
          ? `Last time: Page ${pageLabel} (${pieceTitle})`
          : `Last time: Page ${pageLabel}`
      }
      const bookTitle = (bmBook?.title ?? 'Book').trim() || 'Book'
      return `Last time: ${bookTitle} · p. ${pageLabel}`
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
  const last = rows[0]
  if (!last) return null
  const pageLabel = mapPdfPageToDisplayLabel(last.page, histBook, histUnit, null, 'mapped')
  return `Last time: Page ${pageLabel} (last reader session)`
}

export function generateScheduledClassesWindow(daysAhead: number = 30): { ok: true } {
  if (typeof window === 'undefined') return { ok: true }
  const windowDays = Math.max(1, Math.min(90, Math.floor(daysAhead || 30)))
  const assignments = getWeeklySlotAssignments()
  if (assignments.length === 0) return { ok: true }

  const students = getActiveStudents()
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
      const occurrenceDate = localDateKey(dayCursor)
      const exception = getWeeklySlotExceptions().find(
        (row) => row.slotId === slot.id && row.localDate === occurrenceDate,
      )
      if (exception) continue
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

function resolveSpotlightClassSession(sessions: StudentClassSession[]): StudentClassSession | null {
  const inProgress = sessions.find((session) => session.status === 'in_progress')
  if (inProgress) return inProgress
  return computeNextClass(sessions)
}

function collectWordReviewAggregatedRows(
  student: StudentRecord,
  savedWordEntries?: unknown[],
): StudentWordReviewRow[] {
  const prepSignals = collectClassPrepSignals({
    student,
    savedWordEntries,
  })
  return combineAggregatedWordReviewRows(prepSignals.vocabSignals, student.scheduledClasses ?? [])
}

export function getStudentWordReviewView(
  studentId: string,
  savedWordEntries?: unknown[],
): StudentWordReviewView | { error: string } {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return { error: 'Student not found.' }
  const aggregatedRows = collectWordReviewAggregatedRows(student, savedWordEntries)
  return buildStudentWordReviewView(
    {
      wordReviewEntries: student.wordReviewEntries,
      wordReviewHidden: student.wordReviewHidden,
    },
    aggregatedRows,
  )
}

export function upsertStudentWordReviewEntry(
  studentId: string,
  word: string,
  strength: StudentWordReviewStrength,
): { ok: true } | { ok: false; error: string } {
  const trimmed = word.trim()
  if (!trimmed) return { ok: false, error: 'Enter a word.' }
  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  const key = trimmed.toLowerCase()
  const entries = sanitizeWordReviewEntries(student.wordReviewEntries).filter(
    (entry) => entry.word.toLowerCase() !== key,
  )
  entries.push({ word: trimmed, strength, source: 'manual', updatedAt: nowIso })
  const hidden = sanitizeWordReviewHidden(student.wordReviewHidden).filter((item) => item !== key)
  saveStudent({
    ...student,
    wordReviewEntries: entries,
    wordReviewHidden: hidden,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function removeStudentWordReviewEntry(
  studentId: string,
  word: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = word.trim()
  if (!trimmed) return { ok: false, error: 'Word not found.' }
  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const nowIso = new Date().toISOString()
  const key = trimmed.toLowerCase()
  const entries = sanitizeWordReviewEntries(student.wordReviewEntries).filter(
    (entry) => entry.word.toLowerCase() !== key,
  )
  const hidden = sanitizeWordReviewHidden(student.wordReviewHidden)
  if (!hidden.includes(key)) hidden.push(key)
  saveStudent({
    ...student,
    wordReviewEntries: entries,
    wordReviewHidden: hidden,
    updatedAt: nowIso,
  })
  return { ok: true }
}

export function seedStudentWordReviewFromSignals(
  studentId: string,
  savedWordEntries?: unknown[],
): { ok: true; count: number } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const existing = sanitizeWordReviewEntries(student.wordReviewEntries)
  if (existing.length > 0) return { ok: false, error: 'Word list already has saved entries.' }
  const aggregatedRows = collectWordReviewAggregatedRows(student, savedWordEntries)
  if (!aggregatedRows.length) return { ok: false, error: 'No words to import from class history yet.' }
  const nowIso = new Date().toISOString()
  const seeded = buildSeedEntriesFromRows(aggregatedRows, nowIso)
  saveStudent({
    ...student,
    wordReviewEntries: seeded,
    updatedAt: nowIso,
  })
  return { ok: true, count: seeded.length }
}

export function applyWordReviewToNextClass(
  studentId: string,
  savedWordEntries?: unknown[],
): { ok: true; wordCount: number } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((row) => row.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const viewResult = getStudentWordReviewView(studentId, savedWordEntries)
  if ('error' in viewResult) return { ok: false, error: viewResult.error }
  const words = viewResult.needsPractice.map((row) => row.word)
  if (!words.length) return { ok: false, error: 'Add at least one word that needs practice first.' }

  const sessions = sortClassesByDate(
    (student.scheduledClasses ?? [])
      .map((session) => sanitizeClassSession(session))
      .filter((session): session is StudentClassSession => !!session),
  )
  const target = resolveSpotlightClassSession(sessions)
  if (!target) return { ok: false, error: 'No upcoming class to update.' }

  const nowIso = new Date().toISOString()
  const nextSessions = sessions.map((session) =>
    session.id === target.id
      ? { ...session, plannedVocabulary: dedupeTrimmed(words), updatedAt: nowIso }
      : session,
  )
  saveStudent({
    ...student,
    scheduledClasses: nextSessions,
    updatedAt: nowIso,
  })
  return { ok: true, wordCount: words.length }
}

export function buildStudentClassPrepContext(
  studentId: string,
  classId: string,
  library?: BookLibraryPayload | null,
  bookContext?: BookContextRecord | null,
  options?: BuildStudentClassPrepContextOptions,
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
  const heuristicSectionVocabulary = dedupeTrimmed([
    ...target.plannedVocabulary,
    ...target.goals.flatMap((goal) => goal.split(/\s+/)),
    ...target.activities.flatMap((activity) => activity.split(/\s+/)),
  ]).filter((token) => token.length >= 4)
  const sectionVocabulary = dedupeTrimmed([
    ...(options?.partSectionVocabulary ?? []),
    ...heuristicSectionVocabulary,
  ]).slice(0, 12)
  const checkpointIdeas: string[] =
    resolvedOption?.type === 'part' && /vocab|word/i.test(resolvedOption.title)
      ? ['Tap each target word and explain meaning in context.', 'Finish with a quick 4-item retrieval check.']
      : ['Pause halfway for a comprehension check question.', 'End with a short recap and one transfer question.']
  const nowMs = Date.now()
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
      sessionNote: sessionNoteForHistory(session),
      dueReviewWords: dueReviewWordsForSession(session, nowMs),
    }))
  const prepSignals = collectClassPrepSignals({
    student,
    resolvedSection: resolvedSection
      ? { bookId: resolvedSection.bookId, unitId: resolvedSection.unitId }
      : undefined,
    sectionOption: resolvedOption,
    savedWordEntries: options?.savedWordEntries,
    namedRecurringIssues: [],
  })
  const aggregatedWordRows = combineAggregatedWordReviewRows(
    prepSignals.vocabSignals,
    student.scheduledClasses ?? [],
  )
  const wordReviewView = buildStudentWordReviewView(
    {
      wordReviewEntries: student.wordReviewEntries,
      wordReviewHidden: student.wordReviewHidden,
    },
    aggregatedWordRows,
  )
  const vocabSignals = resolveVocabSignalsFromWordReview(wordReviewView)
  const hasVocabSignals =
    vocabSignals.strongWords.length > 0 ||
    vocabSignals.needsPracticeWords.length > 0 ||
    vocabSignals.savedNotebookWords.length > 0
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
          sectionVocabulary,
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
      firstOrEarlyClasses: prepSignals.prepContextFlags.completedClassCount < 3,
    },
    recentHistory,
    readingPosition: prepSignals.readingPosition,
    vocabSignals,
    namedRecurringIssues: prepSignals.namedRecurringIssues,
    prepContextMode: prepSignals.prepContextMode,
    prepContextFlags: {
      ...prepSignals.prepContextFlags,
      hasVocabSignals,
    },
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
  const merged: StudentRecord = { ...prev, assignedBookIds: bookIds, assignedUnitRefs: refs }
  const optsWithNext = library ? getStudentSectionOptionsForRecord(merged, library) : []
  let curriculumBookStarts = resolveCurriculumBookStarts(prev, library, optsWithNext)
  let curriculumAnchorSectionId = prev.curriculumAnchorSectionId?.trim() || undefined

  if (bookIds.length === 0) {
    curriculumBookStarts = {}
    curriculumAnchorSectionId = undefined
  } else {
    curriculumBookStarts = Object.fromEntries(
      Object.entries(curriculumBookStarts).filter(([bookId, start]) => {
        if (!bookIds.includes(bookId)) return false
        if (!library) return true
        return optsWithNext.some((o) => o.id === start.sectionId)
      }),
    )
    const anchorOk =
      curriculumAnchorSectionId && optsWithNext.some((o) => o.id === curriculumAnchorSectionId)
    if (!anchorOk) {
      curriculumAnchorSectionId = mostRecentCurriculumBookStart(curriculumBookStarts, optsWithNext)?.id
    }
  }

  const nextStarts =
    Object.keys(curriculumBookStarts).length > 0 ? curriculumBookStarts : undefined
  saveStudent({
    ...prev,
    assignedBookIds: bookIds,
    assignedUnitRefs: refs,
    curriculumAnchorSectionId,
    curriculumBookStarts: nextStarts,
    updatedAt: new Date().toISOString(),
  })
  notifyStudentLocalDataChanged(studentId)
  return { ok: true }
}

/** Live class if any, else soonest planned/prepared session. */
export function getSpotlightClassSessionId(studentId: string): string | null {
  const sessions = getStudentScheduledClasses(studentId)
  const live = sessions.find((s) => s.status === 'in_progress')
  if (live) return live.id
  const next = [...sessions]
    .filter((s) => s.status === 'planned' || s.status === 'prepared')
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0]
  return next?.id ?? null
}

/** Point the spotlight class at this lesson piece (Books ↔ Next class sync). */
export function syncSpotlightClassSectionFromBookStart(
  studentId: string,
  section: StudentBookSectionRef | StudentSectionOption,
): { ok: true } | { ok: false; error: string } {
  const classId = getSpotlightClassSessionId(studentId)
  if (!classId) return { ok: true }
  const ref =
    'pathLabel' in section && typeof (section as StudentSectionOption).pathLabel === 'string'
      ? toStudentBookSectionRef(section as StudentSectionOption)
      : (section as StudentBookSectionRef)
  const result = updateStudentClassSelectedSection(studentId, classId, ref)
  if (result.ok) notifyStudentLocalDataChanged(studentId)
  return result
}

/**
 * Set or clear the teacher starting place for one book.
 * Does not overwrite starts on other books. Pass `sectionId: null` to clear that book only.
 * Setting a start also updates the spotlight class “what we’re teaching” to match.
 */
export function updateStudentCurriculumBookStart(
  studentId: string,
  input: {
    bookId: string
    sectionId: string | null
    /** Mapped / printed page; defaults to the section’s start hint when omitted. */
    mappedPage?: number | null
    /** When false, skip spotlight class sync (Next class already wrote the section). Default true. */
    syncSpotlight?: boolean
  },
  library: BookLibraryPayload | null,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const prev = students[idx]
  const bookId = input.bookId.trim()
  if (!bookId) return { ok: false, error: 'Book is required.' }

  const options = library?.books?.length ? getStudentSectionOptions(studentId, library) : []
  let curriculumBookStarts = resolveCurriculumBookStarts(prev, library, options)

  const trimmedSection = input.sectionId?.trim() ?? ''
  if (!trimmedSection) {
    const { [bookId]: _removed, ...rest } = curriculumBookStarts
    curriculumBookStarts = rest
    const nextAnchor = mostRecentCurriculumBookStart(curriculumBookStarts, options)?.id
    saveStudent({
      ...prev,
      curriculumBookStarts: Object.keys(curriculumBookStarts).length > 0 ? curriculumBookStarts : undefined,
      curriculumAnchorSectionId: nextAnchor,
      updatedAt: new Date().toISOString(),
    })
    notifyStudentLocalDataChanged(studentId)
    return { ok: true }
  }

  if (!library?.books?.length) {
    return { ok: false, error: 'Load the book library before setting a reading place.' }
  }
  const section = options.find((o) => o.id === trimmedSection)
  if (!section || section.bookId !== bookId) {
    return { ok: false, error: 'That lesson piece is not available for this student’s current assignments.' }
  }
  const mappedFromInput =
    typeof input.mappedPage === 'number' && Number.isFinite(input.mappedPage) && input.mappedPage >= 1
      ? Math.floor(input.mappedPage)
      : null
  const mappedFromSection =
    typeof section.startPageHint === 'number' && section.startPageHint >= 1
      ? Math.floor(section.startPageHint)
      : null
  const previousMapped =
    typeof curriculumBookStarts[bookId]?.mappedPage === 'number' &&
    curriculumBookStarts[bookId]!.mappedPage >= 1
      ? Math.floor(curriculumBookStarts[bookId]!.mappedPage)
      : null
  // Prefer explicit page → section hint → keep prior start for this book → 1 last resort.
  const mappedPage = mappedFromInput ?? mappedFromSection ?? previousMapped ?? 1
  const nowIso = new Date().toISOString()
  curriculumBookStarts = {
    ...curriculumBookStarts,
    [bookId]: {
      sectionId: section.id,
      unitId: section.unitId,
      mappedPage,
      updatedAt: nowIso,
    },
  }
  saveStudent({
    ...prev,
    curriculumBookStarts,
    curriculumAnchorSectionId: section.id,
    updatedAt: nowIso,
  })
  notifyStudentLocalDataChanged(studentId)
  if (input.syncSpotlight !== false) {
    syncSpotlightClassSectionFromBookStart(studentId, section)
  }
  return { ok: true }
}

/** @deprecated Use `updateStudentCurriculumBookStart` (per book). */
export function updateStudentCurriculumReadingAnchor(
  studentId: string,
  sectionId: string | null,
  library: BookLibraryPayload | null,
): { ok: true } | { ok: false; error: string } {
  const trimmed = sectionId?.trim() ?? ''
  if (!trimmed) {
    const students = getStudents()
    const prev = students.find((s) => s.id === studentId)
    if (!prev) return { ok: false, error: 'Student not found.' }
    const options = library?.books?.length ? getStudentSectionOptions(studentId, library) : []
    const starts = resolveCurriculumBookStarts(prev, library, options)
    const legacyBookId =
      options.find((o) => o.id === prev.curriculumAnchorSectionId?.trim())?.bookId ??
      Object.keys(starts)[0]
    if (!legacyBookId) {
      saveStudent({
        ...prev,
        curriculumAnchorSectionId: undefined,
        curriculumBookStarts: undefined,
        updatedAt: new Date().toISOString(),
      })
      notifyStudentLocalDataChanged(studentId)
      return { ok: true }
    }
    return updateStudentCurriculumBookStart(studentId, { bookId: legacyBookId, sectionId: null }, library)
  }
  if (!library?.books?.length) {
    return { ok: false, error: 'Load the book library before setting a reading anchor.' }
  }
  const options = getStudentSectionOptions(studentId, library)
  const section = options.find((o) => o.id === trimmed)
  if (!section) {
    return { ok: false, error: 'That lesson piece is not available for this student’s current assignments.' }
  }
  return updateStudentCurriculumBookStart(
    studentId,
    {
      bookId: section.bookId,
      sectionId: section.id,
      mappedPage: section.startPageHint ?? 1,
    },
    library,
  )
}

export function getStudentCurriculumBookStart(
  studentId: string,
  bookId: string,
  library: BookLibraryPayload | null = null,
): StudentCurriculumBookStart | null {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return null
  const options = library?.books?.length ? getStudentSectionOptions(studentId, library) : []
  const starts = resolveCurriculumBookStarts(student, library, options)
  return starts[bookId.trim()] ?? null
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

/** Ends any other live class for this student so a new one can start (e.g. forgot to tap End on the map). */
function endOtherInProgressClassSessions(
  studentId: string,
  exceptClassId: string,
): { ok: true } | { ok: false; error: string } {
  const student = getStudents().find((s) => s.id === studentId)
  if (!student) return { ok: false, error: 'Student not found.' }
  const others = (student.scheduledClasses ?? []).filter(
    (session) => session.id !== exceptClassId && session.status === 'in_progress',
  )
  for (const session of others) {
    const ended = endStudentClassSession(studentId, session.id)
    if (!ended.ok) return ended
  }
  return { ok: true }
}

const BOOK_OVERLAY_CLASS_STATUSES: ReadonlySet<StudentClassStatus> = new Set([
  'planned',
  'prepared',
  'in_progress',
])

/** Planned, prepared, or live — book + lesson board bind to this class session. */
export function isBookOverlayClassSessionStatus(status: StudentClassStatus): boolean {
  return BOOK_OVERLAY_CLASS_STATUSES.has(status)
}

/**
 * Class session id for book/board storage.
 * When the URL names a session, use it only if status is planned/prepared/live (not completed/cancelled).
 * With no URL session, fall back to any live class (map opened without class context).
 */
export function resolveBookOverlayClassSessionId(args: {
  urlClassSessionId: string | null | undefined
  sessions: readonly { id: string; status: StudentClassStatus }[] | null | undefined
}): string | null {
  const urlId = args.urlClassSessionId?.trim() || null
  const sessions = args.sessions ?? []
  if (urlId) {
    const match = sessions.find((s) => s.id === urlId)
    if (!match) return null
    return isBookOverlayClassSessionStatus(match.status) ? match.id : null
  }
  return sessions.find((s) => s.status === 'in_progress')?.id ?? null
}

export interface BuildStudentMapReaderHrefArgs {
  studentId: string
  bookId?: string | null
  unitId?: string | null
  classSessionId?: string | null
  /** When true (default), map opens the teaching reader once pages are ready. */
  openBook?: boolean
}

/** Fullscreen map teaching reader — use for “Open book”, not the Books library page. */
export function buildStudentMapReaderHref({
  studentId,
  bookId,
  unitId,
  classSessionId,
  openBook = true,
}: BuildStudentMapReaderHrefArgs): string {
  const params = new URLSearchParams()
  const sessionId = classSessionId?.trim()
  if (sessionId) params.set('classSession', sessionId)
  if (openBook) params.set('openBook', '1')
  const bid = bookId?.trim()
  const uid = unitId?.trim()
  if (bid) params.set('book', bid)
  if (uid) params.set('unit', uid)
  const qs = params.toString()
  return `/students/${encodeURIComponent(studentId)}/map${qs ? `?${qs}` : ''}`
}

/**
 * Fullscreen map for a class session — lands on the book shelf (no auto-open).
 * Teacher picks Workshop / Literature; `book`/`unit` hint the planned title for badges.
 */
export function buildPrepareLessonMapHref(
  studentId: string,
  classSessionId: string,
  library?: BookLibraryPayload | null,
): string {
  const resolved = resolveClassTeachingBookUnit(studentId, classSessionId, library ?? null)
  return buildStudentMapReaderHref({
    studentId,
    classSessionId,
    openBook: false,
    bookId: resolved?.bookId,
    unitId: resolved?.unitId,
  })
}

/** Prep map with reading-checks side panel open (`?checksPrep=1`). */
export function buildReadingChecksPrepHref(
  studentId: string,
  classSessionId: string,
  library?: BookLibraryPayload | null,
): string {
  const base = buildPrepareLessonMapHref(studentId, classSessionId, library)
  return base.includes('?') ? `${base}&checksPrep=1` : `${base}?checksPrep=1`
}

/** Marks a class as live teaching: `in_progress` + `classStartedAt`. */
export function startStudentClassSession(
  studentId: string,
  classId: string,
): { ok: true } | { ok: false; error: string } {
  const endedOthers = endOtherInProgressClassSessions(studentId, classId)
  if (!endedOthers.ok) return endedOthers

  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const sessions = student.scheduledClasses ?? []
  const target = sessions.find((s) => s.id === classId)
  if (!target) return { ok: false, error: 'Class session not found.' }
  if (target.status === 'completed' || target.status === 'cancelled' || target.status === 'missed') {
    return { ok: false, error: 'This class cannot be started.' }
  }
  if (target.status === 'in_progress') {
    return { ok: true }
  }
  const nowIso = new Date().toISOString()
  const nextSessions = sessions.map((session) =>
    session.id === classId
      ? {
          ...session,
          status: 'in_progress' as const,
          classStartedAt: nowIso,
          extendedMinutesTotal: undefined,
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
  notifyStudentLocalDataChanged(studentId)
  return { ok: true }
}

/**
 * Add overtime minutes while live. Cap is +15 past the original scheduled end.
 */
export function extendStudentClassSession(
  studentId: string,
  classId: string,
  addMinutes: number,
): { ok: true; extendedMinutesTotal: number } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const sessions = student.scheduledClasses ?? []
  const target = sessions.find((s) => s.id === classId)
  if (!target) return { ok: false, error: 'Class session not found.' }
  if (target.status !== 'in_progress') {
    return { ok: false, error: 'Only a live class can be extended.' }
  }
  const current = sanitizeExtendedMinutesTotal(target.extendedMinutesTotal) ?? 0
  if (!canExtendClassBy(current, addMinutes)) {
    return { ok: false, error: 'That would go past the +15 minute overtime cap.' }
  }
  const nextTotal = sanitizeExtendedMinutesTotal(current + Math.floor(addMinutes))
  if (nextTotal == null) {
    return { ok: false, error: 'Invalid extend amount.' }
  }
  const nowIso = new Date().toISOString()
  const nextSessions = sessions.map((session) =>
    session.id === classId
      ? {
          ...session,
          extendedMinutesTotal: nextTotal,
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
  notifyStudentLocalDataChanged(studentId)
  return { ok: true, extendedMinutesTotal: nextTotal }
}

/** Any live class across active students (app-wide one-live rule). */
export function findAppWideLiveClass(): TodaysClassSessionRow | null {
  for (const row of getActiveStudents()) {
    const live = (row.scheduledClasses ?? []).find((session) => session.status === 'in_progress')
    if (!live) continue
    const session = sanitizeClassSession(live)
    if (!session) continue
    return {
      studentId: row.id,
      studentName: row.name.trim() || 'Student',
      session,
    }
  }
  return null
}

export type SoftAutoStartReconcileResult = {
  started: TodaysClassSessionRow | null
  blocked: Array<TodaysClassSessionRow & { blockedByStudentName: string }>
}

/**
 * Soft auto-start while the app is open: planned/prepared whose start ≤ now and
 * still inside end+grace become live. At most one live app-wide; conflicts stay planned.
 * Idempotent. Does not navigate or write bookmarks.
 */
export function reconcileSoftClassAutoStart(
  nowMs: number = Date.now(),
): SoftAutoStartReconcileResult {
  const candidates = getTodaysClassSessionsForTeacher(new Date(nowMs))
    .filter((row) => isSessionEligibleForSoftAutoStart(row.session, nowMs))
    .sort(
      (a, b) =>
        new Date(a.session.scheduledFor).getTime() - new Date(b.session.scheduledFor).getTime(),
    )

  if (candidates.length === 0) {
    return { started: null, blocked: [] }
  }

  const live = findAppWideLiveClass()
  if (live) {
    return {
      started: null,
      blocked: candidates.map((row) => ({
        ...row,
        blockedByStudentName: live.studentName,
      })),
    }
  }

  const [first, ...rest] = candidates
  const started = startStudentClassSession(first.studentId, first.session.id)
  if (!started.ok) {
    return { started: null, blocked: [] }
  }

  const refreshed = getStudentScheduledClasses(first.studentId).find((s) => s.id === first.session.id)
  const startedRow: TodaysClassSessionRow = {
    studentId: first.studentId,
    studentName: first.studentName,
    session: refreshed ?? { ...first.session, status: 'in_progress' },
  }

  const blocked =
    rest.length > 0
      ? rest.map((row) => ({
          ...row,
          blockedByStudentName: first.studentName,
        }))
      : []

  return { started: startedRow, blocked }
}

/**
 * Bookmark for end class / hard auto-end: prefer the last page actually viewed in the reader,
 * then the planned start, then section page hints. Avoid inventing page 1 when a better signal exists.
 */
export function resolveClassEndBookmark(
  studentId: string,
  session: {
    selectedSection?: StudentBookSectionRef | null
  },
  assignedBookIds?: string[],
): { bookId: string; pdfPage: number; unitId?: string } | undefined {
  const student = getStudents().find((row) => row.id === studentId)
  const books =
    assignedBookIds && assignedBookIds.length > 0
      ? assignedBookIds
      : (student?.assignedBookIds ?? [])
  const section = session.selectedSection ?? undefined
  const bookId = (section?.bookId ?? books[0] ?? '').trim()
  if (!bookId) return undefined

  let unitId = section?.unitId?.trim() || undefined
  if (!unitId) {
    const start = getStudentCurriculumBookStart(studentId, bookId, null)
    unitId = start?.unitId?.trim() || undefined
  }
  if (!unitId) {
    const ref = student?.assignedUnitRefs?.find((r) => r.bookId === bookId)
    unitId = ref?.unitId?.trim() || undefined
  }

  if (unitId) {
    const saved = peekSavedUnitPage(bookId, unitId)
    if (saved != null) {
      return { bookId, pdfPage: saved, unitId }
    }
  }

  const latestForBook = getLatestSavedUnitPageForBook(bookId)
  if (latestForBook) {
    return {
      bookId,
      pdfPage: latestForBook.page,
      unitId: latestForBook.unitId,
    }
  }

  const bookStart = getStudentCurriculumBookStart(studentId, bookId, null)
  if (bookStart && bookStart.mappedPage >= 1) {
    return {
      bookId,
      pdfPage: Math.max(1, Math.floor(bookStart.mappedPage)),
      unitId: unitId ?? bookStart.unitId,
    }
  }

  const hint = section?.endPageHint ?? section?.startPageHint
  if (typeof hint === 'number' && Number.isFinite(hint) && hint >= 1) {
    const pdfPage = Math.floor(hint)
    return unitId ? { bookId, pdfPage, unitId } : { bookId, pdfPage }
  }

  return unitId ? { bookId, pdfPage: 1, unitId } : { bookId, pdfPage: 1 }
}

/** @deprecated Prefer {@link resolveClassEndBookmark}. */
export function resolveHardAutoEndBookmark(
  studentId: string,
  session: StudentClassSession,
): { bookId: string; pdfPage: number; unitId?: string } | undefined {
  return resolveClassEndBookmark(studentId, session)
}

/**
 * Complete a live class because grace expired (Phase 4).
 * Idempotent if already completed. No recap prompt — soft “add note later” stays available on Past.
 */
export function hardAutoEndStudentClassSession(
  studentId: string,
  classId: string,
  input?: { readingCheckWrapLine?: string },
): { ok: true; alreadyEnded: boolean; studentName: string } | { ok: false; error: string } {
  const student = getStudents().find((row) => row.id === studentId)
  if (!student) return { ok: false, error: 'Student not found.' }
  const studentName = student.name.trim() || 'Student'
  const session = (student.scheduledClasses ?? []).find((row) => row.id === classId)
  if (!session) return { ok: false, error: 'Class session not found.' }

  if (session.status === 'completed') {
    return { ok: true, alreadyEnded: true, studentName }
  }
  if (session.status !== 'in_progress') {
    return { ok: false, error: 'This class is not in progress.' }
  }

  flushPendingUnitPageSave()
  const bookmark = resolveClassEndBookmark(studentId, session)
  const ended = endStudentClassSession(studentId, classId, {
    ...(bookmark ? { bookmarkAtEnd: bookmark } : {}),
    ...(input?.readingCheckWrapLine ? { readingCheckWrapLine: input.readingCheckWrapLine } : {}),
  })
  if (!ended.ok) return ended
  return { ok: true, alreadyEnded: false, studentName }
}

export type HardAutoEndReconcileResult = {
  ended: Array<{ studentId: string; studentName: string; sessionId: string; alreadyEnded: boolean }>
}

/**
 * Hard auto-end while the app is open: any live class past end+grace is completed.
 * Run before soft auto-start so a freed slot can start. Idempotent.
 */
export function reconcileHardClassAutoEnd(nowMs: number = Date.now()): HardAutoEndReconcileResult {
  const ended: HardAutoEndReconcileResult['ended'] = []

  for (const row of getActiveStudents()) {
    const liveSessions = (row.scheduledClasses ?? []).filter((session) => session.status === 'in_progress')
    for (const raw of liveSessions) {
      const session = sanitizeClassSession(raw)
      if (!session) continue
      if (!isSessionDueForHardAutoEnd(session, nowMs)) continue
      const result = hardAutoEndStudentClassSession(row.id, session.id)
      if (!result.ok) continue
      ended.push({
        studentId: row.id,
        studentName: result.studentName,
        sessionId: session.id,
        alreadyEnded: result.alreadyEnded,
      })
    }
  }

  return { ended }
}

/**
 * Mark overdue planned/prepared sessions as missed (never taught past end+grace).
 */
export function reconcileMissedClassSessions(nowMs: number = Date.now()): {
  missed: Array<{ studentId: string; studentName: string; sessionId: string }>
} {
  const missed: Array<{ studentId: string; studentName: string; sessionId: string }> = []
  const nowIso = new Date(nowMs).toISOString()

  for (const row of getActiveStudents()) {
    let changed = false
    const nextSessions = (row.scheduledClasses ?? []).map((raw) => {
      const session = sanitizeClassSession(raw)
      if (!session) return raw
      if (!isSessionDueForMissed(session, nowMs)) return session
      changed = true
      missed.push({
        studentId: row.id,
        studentName: row.name.trim() || 'Student',
        sessionId: session.id,
      })
      return {
        ...session,
        status: 'missed' as const,
        classStartedAt: undefined,
        updatedAt: nowIso,
      }
    })

    if (!changed) continue
    const sanitized = sortClassesByDate(
      nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
    )
    saveStudent({ ...row, scheduledClasses: sanitized, updatedAt: nowIso })
    notifyStudentLocalDataChanged(row.id)
  }

  return { missed }
}

/**
 * Mark a missed class as taught anyway → completed (optional short note).
 */
export function markMissedClassTaughtAnyway(
  studentId: string,
  classId: string,
  note?: string,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const student = students[idx]
  const sessions = student.scheduledClasses ?? []
  const target = sessions.find((s) => s.id === classId)
  if (!target) return { ok: false, error: 'Class session not found.' }
  if (target.status !== 'missed') {
    return { ok: false, error: 'Only a missed class can be marked taught.' }
  }
  const nowIso = new Date().toISOString()
  const classEndNote = sanitizeClassEndNote(note)
  const nextSessions = sessions.map((session) =>
    session.id === classId
      ? {
          ...session,
          status: 'completed' as const,
          classEndedAt: nowIso,
          classEndNote,
          updatedAt: nowIso,
        }
      : session,
  )
  const sanitized = sortClassesByDate(
    nextSessions.map((s) => sanitizeClassSession(s)).filter((s): s is StudentClassSession => !!s),
  )
  saveStudent({ ...student, scheduledClasses: sanitized, updatedAt: nowIso })
  notifyStudentLocalDataChanged(studentId)
  return { ok: true }
}

export type ClassScheduleCatchUpResult = {
  autoEnded: HardAutoEndReconcileResult['ended']
  missed: Array<{ studentId: string; studentName: string; sessionId: string }>
  started: SoftAutoStartReconcileResult
}

/**
 * On app open / tick: auto-end overdue live → mark no-shows missed → soft auto-start in-window.
 */
export function reconcileClassScheduleCatchUp(nowMs: number = Date.now()): ClassScheduleCatchUpResult {
  const autoEnded = reconcileHardClassAutoEnd(nowMs)
  const missedResult = reconcileMissedClassSessions(nowMs)
  const started = reconcileSoftClassAutoStart(nowMs)
  return {
    autoEnded: autoEnded.ended,
    missed: missedResult.missed,
    started,
  }
}

export type EndStudentClassSessionInput = {
  classEndNote?: string
  /** Longer log: what you did this call, pages, plan for next time (optional). */
  sessionNote?: string
  bookmarkAtEnd?: { bookId: string; pdfPage: number; unitId?: string }
  /** Auto reading-check wrap line for teacher glance / past classes. */
  readingCheckWrapLine?: string
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
  const readingCheckWrapLine = sanitizeReadingCheckWrapLine(input?.readingCheckWrapLine)
  const bookmarkSanitized =
    input?.bookmarkAtEnd !== undefined && input.bookmarkAtEnd !== null
      ? sanitizeBookmarkAtEnd(input.bookmarkAtEnd)
      : undefined

  const nextSessions = sessions.map((session) => {
    if (session.id !== classId) return session
    return {
      ...session,
      status: 'completed' as const,
      classEndedAt: nowIso,
      classEndNote,
      sessionNote,
      ...(readingCheckWrapLine ? { readingCheckWrapLine } : {}),
      ...(bookmarkSanitized ? { bookmarkAtEnd: bookmarkSanitized } : {}),
      updatedAt: nowIso,
    }
  })
  const sanitized = nextSessions
    .map((row) => sanitizeClassSession(row))
    .filter((row): row is StudentClassSession => !!row)

  let nextCurriculumHistory = [...(student.curriculumHistory ?? [])]
  if (bookmarkSanitized) {
    const unitId = resolveCurriculumUnitIdForBookmark(student, bookmarkSanitized)
    if (unitId) {
      const entry = {
        id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        bookId: bookmarkSanitized.bookId,
        unitId,
        page: Math.max(1, Math.floor(bookmarkSanitized.pdfPage)),
        openedAt: nowIso,
        closedAt: nowIso,
      }
      nextCurriculumHistory = [entry, ...nextCurriculumHistory].slice(0, 500)
    }
  }

  const clearFirstClassWelcome = Boolean(student.firstClassWelcome)
  saveStudent({
    ...student,
    scheduledClasses: sortClassesByDate(sanitized),
    curriculumHistory: nextCurriculumHistory,
    ...(clearFirstClassWelcome ? { firstClassWelcome: undefined } : {}),
    updatedAt: nowIso,
  })
  notifyStudentLocalDataChanged(studentId)
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
  notifyStudentLocalDataChanged(studentId)
  return { ok: true }
}

export function updateStudentClassPrepSummary(
  studentId: string,
  classId: string,
  aiPrepSummary: string,
): { ok: true } | { ok: false; error: string } {
  return updateStudentClassPrep(studentId, classId, { prepNotes: aiPrepSummary })
}

export interface StudentClassPrepUpdate extends ClassPrepExtrasPayload {
  prepTimeBlocks?: ClassPrepTimeBlock[]
  prepOutlineSummary?: string
  prepNotes?: string
  /** When set, replaces planned vocabulary (e.g. seed from words to revisit). */
  plannedVocabulary?: string[]
  /** When set, replaces this-class skipped lesson parts. */
  prepSkippedPartIds?: string[]
  classroomHomeGoals?: ClassroomHomeGoals | null
}

export function updateStudentClassPrep(
  studentId: string,
  classId: string,
  payload: StudentClassPrepUpdate,
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
    const prepTimeBlocks =
      payload.prepTimeBlocks !== undefined ? sanitizePrepTimeBlocks(payload.prepTimeBlocks) : session.prepTimeBlocks
    const prepOutlineSummary =
      payload.prepOutlineSummary !== undefined
        ? payload.prepOutlineSummary.trim() || undefined
        : session.prepOutlineSummary
    const prepNotes = payload.prepNotes !== undefined ? payload.prepNotes.trim() || undefined : session.prepNotes
    const prepSkippedPartIds =
      payload.prepSkippedPartIds !== undefined
        ? dedupeTrimmed(payload.prepSkippedPartIds).slice(0, 40)
        : session.prepSkippedPartIds
    const extras = sanitizeClassPrepExtras({
      prepPriorities: payload.prepPriorities ?? session.prepPriorities,
      prepSuggestedActivities: payload.prepSuggestedActivities ?? session.prepSuggestedActivities,
      prepCheckpointMoments: payload.prepCheckpointMoments ?? session.prepCheckpointMoments,
      prepWordsToRevisit: payload.prepWordsToRevisit ?? session.prepWordsToRevisit,
      prepDifferentiationTips: payload.prepDifferentiationTips ?? session.prepDifferentiationTips,
      prepCarryOver: payload.prepCarryOver ?? session.prepCarryOver,
    })
    const classroomHomeGoals =
      payload.classroomHomeGoals !== undefined
        ? sanitizeClassroomHomeGoals(payload.classroomHomeGoals)
        : session.classroomHomeGoals
    const hasOutline = Boolean(prepTimeBlocks?.length)
    const mergedSession = { ...session, ...extras, classroomHomeGoals }
    const skipped = (prepSkippedPartIds ?? []).filter(Boolean)
    const plannedWords =
      payload.plannedVocabulary !== undefined
        ? dedupeTrimmed(payload.plannedVocabulary)
        : session.plannedVocabulary
    const hasPrepContent =
      hasOutline ||
      Boolean(prepNotes) ||
      hasPrepExtras(mergedSession) ||
      Boolean(classroomHomeGoals) ||
      skipped.length > 0 ||
      plannedWords.length > 0
    return {
      ...session,
      status: session.status === 'planned' && hasPrepContent ? 'prepared' : session.status,
      prepTimeBlocks,
      prepOutlineSummary,
      prepNotes,
      prepSkippedPartIds: skipped.length ? skipped : undefined,
      ...extras,
      classroomHomeGoals,
      plannedVocabulary: plannedWords,
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

export function setStudentFirstClassWelcome(
  studentId: string,
  firstClassWelcome: boolean,
): { ok: true } | { ok: false; error: string } {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === studentId)
  if (idx < 0) return { ok: false, error: 'Student not found.' }
  const prev = students[idx]
  const completedCount = (prev.scheduledClasses ?? []).filter(
    (session) => session.status === 'completed',
  ).length
  if (firstClassWelcome && completedCount > 0) {
    return { ok: false, error: 'This student already has a completed class.' }
  }
  saveStudent({
    ...prev,
    firstClassWelcome: firstClassWelcome ? true : undefined,
    updatedAt: new Date().toISOString(),
  })
  notifyStudentLocalDataChanged(studentId)
  return { ok: true }
}

export function studentShowsFirstClassWelcome(
  student: Pick<StudentRecord, 'firstClassWelcome' | 'scheduledClasses'> | null | undefined,
): boolean {
  if (!student?.firstClassWelcome) return false
  const completedCount = (student.scheduledClasses ?? []).filter(
    (session) => session.status === 'completed',
  ).length
  return completedCount === 0
}

export function addStudentRecord(input: {
  name: string
  note?: string
  className?: string
  defaultDifficultyTier?: DifficultyTier
  firstClassWelcome?: boolean
}): { ok: true; studentId: string } | { ok: false; error: string } {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Name is required.' }

  const students = getStudents()
  const alreadyExists = students.some(
    (student) => normalizeStudentKey(student.name) === normalizeStudentKey(name),
  )
  if (alreadyExists) return { ok: false, error: 'Student already exists.' }

  const now = new Date().toISOString()
  const studentId = generateStudentId()
  saveStudent({
    id: studentId,
    name,
    note: input.note?.trim() || undefined,
    className: input.className?.trim() || undefined,
    defaultDifficultyTier: input.defaultDifficultyTier ?? DEFAULT_PLAY_TIER,
    firstClassWelcome: input.firstClassWelcome === true ? true : undefined,
    createdAt: now,
    updatedAt: now,
    assignedQuizIds: [],
  })

  return { ok: true, studentId }
}

export function addStudentRecords(
  names: string[],
  options?: { firstClassWelcome?: boolean },
): {
  added: Array<{ name: string; studentId: string }>
  failed: Array<{ name: string; error: string }>
} {
  const added: Array<{ name: string; studentId: string }> = []
  const failed: Array<{ name: string; error: string }> = []
  const seenInPaste = new Set<string>()

  for (const rawName of names) {
    const name = rawName.trim()
    if (!name) continue

    const key = normalizeStudentKey(name)
    if (seenInPaste.has(key)) {
      failed.push({ name, error: 'Duplicate name in this list.' })
      continue
    }
    seenInPaste.add(key)

    const result = addStudentRecord({
      name,
      firstClassWelcome: options?.firstClassWelcome,
    })
    if (!result.ok) {
      failed.push({ name, error: result.error })
      continue
    }
    added.push({ name, studentId: result.studentId })
  }

  return { added, failed }
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

/**
 * Permanently delete a student: free weekly times, wipe profile data, optionally delete local files.
 * Prefer this over calling storage delete alone so schedule cleanup cannot be skipped.
 */
export function deleteStudentPermanently(
  studentId: string,
): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof window === 'undefined') return { ok: false, error: 'Not available.' }
  removeWeeklySlotsForStudent(studentId)
  const removed = removeStudentFromBrowserStorage(studentId)
  if (!removed.ok) return { ok: false, error: 'Student was not found.' }
  notifyStudentLocalDataChanged(studentId)
  return { ok: true, name: removed.name }
}
