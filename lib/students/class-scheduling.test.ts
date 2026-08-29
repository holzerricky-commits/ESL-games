import { beforeEach, describe, expect, it } from 'vitest'
import { getStudents, saveStudent, saveStudents } from '@/lib/storage'
import {
  generateScheduledClassesWindow,
  getStudentProfileView,
  getStudentScheduledClasses,
  getWeeklySlotAssignments,
  getLessonRangeOverride,
  getStudentsListView,
  clearLessonRangeOverride,
  recordStudentClassOutcome,
  saveTeacherWeeklyScheduleConfig,
  transitionStudentClassStatus,
  upsertLessonRangeOverride,
  updateStudentClassContextRefs,
  updateStudentClassPracticeItems,
  updateStudentClassVocabularyFeedback,
  updateStudentClassPublishedVocabulary,
  upsertStudentClassSession,
  upsertWeeklySlotAssignment,
  removeWeeklySlotsForStudent,
  removeWeeklySlotAssignment,
  updateWeeklySlotAssignment,
  validateWeeklySlotUpdate,
  validateSingleOccurrenceReschedule,
  rescheduleSingleClassOccurrence,
  createOneOffClassSession,
  updateOneOffClassSession,
  moveClassOccurrence,
  leaveLiveClassSessionWithoutCompleting,
  cancelClassSession,
  cancelClassOccurrence,
  clearScheduledClassesInDateRange,
  clearStudentClassesInDateRange,
  removeStudentFromCalendar,
  resetTeacherCalendar,
  getWeeklySlotExceptions,
  localDateKey,
  getClassSessionsForDateRange,
  startStudentClassSession,
  endStudentClassSession,
  extendStudentClassSession,
  reconcileSoftClassAutoStart,
  reconcileHardClassAutoEnd,
  hardAutoEndStudentClassSession,
  reconcileClassScheduleCatchUp,
  markMissedClassTaughtAnyway,
  findAppWideLiveClass,
  getNextClassResumeHeadline,
  getStudentResumePdfPageForBookUnit,
  getStudentTeachingOpenPdfPageForBookUnit,
  getStudentLastClassBookmarkPdfPageForBookUnit,
  getStudentOpenTargetForBook,
  isStudentCurriculumBookStartFresherThanLastStop,
  getStudentDefaultBookUnitForReader,
  resolveClassTeachingBookUnit,
  getTodaysClassSessionsForTeacher,
  getTodaysCompletedClassSessionsForTeacher,
  getDashboardStillOpenItems,
  pickDashboardNowRow,
  sessionNeedsPostClassRecap,
  dismissPostClassRecapPrompt,
  updateStudentClassEndNote,
  updateStudentClassSessionNote,
  resolveNextSectionForClass,
  getStudentSectionOptions,
  resolveStudentSectionAtPdfPage,
  resolveStudentSectionAtMappedPage,
  resolveStudentSectionAtMappedBookPage,
  updateStudentCurriculumBookStart,
  getStudentCurriculumBookStart,
  resolveClassEndBookmark,
  getSpotlightClassSessionId,
  updateStudentClassSelectedSection,
  updateStudentClassPrep,
  toStudentBookSectionRef,
  buildSpreadPageSpanKey,
  buildPrepareLessonMapHref,
  buildStudentMapReaderHref,
  resolveBookOverlayClassSessionId,
  pruneOrphanWeeklySlots,
  putStudentOnBreak,
  restoreStudentFromBreak,
  deleteStudentPermanently,
} from '@/lib/students/selectors'
import type { BookLibraryPayload } from '@/lib/books/types'
import { saveUnitPage } from '@/lib/books/progress'
import type { StudentClassSession, StudentRecord } from '@/lib/types'
class LocalStorageMock {
  private map = new Map<string, string>()

  clear() {
    this.map.clear()
  }

  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null
  }

  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.map.delete(key)
  }

  setItem(key: string, value: string) {
    this.map.set(key, value)
  }

  get length() {
    return this.map.size
  }
}

function seedStudent(overrides: Partial<StudentRecord> = {}): StudentRecord {
  const nowIso = '2026-04-20T10:00:00.000Z'
  return {
    id: 'student-1',
    name: 'Lina',
    createdAt: nowIso,
    updatedAt: nowIso,
    assignedQuizIds: [],
    ...overrides,
  }
}

beforeEach(() => {
  const storage = new LocalStorageMock()
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    writable: true,
    configurable: true,
  })
})

describe('class sessions and outcomes', () => {
  it('sorts scheduled sessions and updates status/outcomes', () => {
    saveStudents([seedStudent()])
    const first = upsertStudentClassSession('student-1', {
      title: 'Lesson B',
      scheduledFor: '2026-04-22T09:00',
      durationMin: 45,
    })
    const second = upsertStudentClassSession('student-1', {
      title: 'Lesson A',
      scheduledFor: '2026-04-21T09:00',
      durationMin: 45,
    })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions.map((row) => row.title)).toEqual(['Lesson A', 'Lesson B'])

    const statusResult = transitionStudentClassStatus('student-1', second.session.id, 'prepared')
    expect(statusResult.ok).toBe(true)
    const outcomeResult = recordStudentClassOutcome('student-1', second.session.id, {
      introducedWords: ['forest', 'river'],
      practicedWords: ['river'],
      learnedWords: ['river'],
      teacherNotes: 'Good speaking confidence.',
    })
    expect(outcomeResult.ok).toBe(true)

    const profile = getStudentProfileView('student-1')
    expect(profile).not.toBeNull()
    expect(profile?.scheduledClasses[0]?.status).toBe('completed')
    expect(profile?.scheduledClasses[0]?.learnedWords).toEqual(['river'])
    expect(profile?.scheduledClasses[0]?.vocabularyReviewPlan?.length).toBe(2)
    const riverPlan = profile?.scheduledClasses[0]?.vocabularyReviewPlan?.find((row) => row.word === 'river')
    expect(riverPlan?.intervalDays).toBeGreaterThanOrEqual(14)
  })

  it('links published vocabulary set to class planned words', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Vocabulary class',
      scheduledFor: '2026-04-22T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = updateStudentClassPublishedVocabulary('student-1', created.session.id, {
      setId: 'set-123',
      status: 'published',
      words: ['river', 'valley', 'forest', 'river'],
    })
    expect(result.ok).toBe(true)

    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions[0]?.plannedVocabulary).toEqual(['river', 'valley', 'forest'])
    expect(sessions[0]?.vocabularySetId).toBe('set-123')
    expect(sessions[0]?.vocabularySetStatus).toBe('published')
  })

  it('stores unit/lesson context references on session', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Context class',
      scheduledFor: '2026-04-23T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const updated = updateStudentClassContextRefs('student-1', created.session.id, {
      unitContextId: 'unit-ctx-1',
      lessonContextId: 'lesson-ctx-1',
    })
    expect(updated.ok).toBe(true)
    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions[0]?.unitContextId).toBe('unit-ctx-1')
    expect(sessions[0]?.lessonContextId).toBe('lesson-ctx-1')
  })

  it('stores vocabulary feedback signals on session', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Feedback class',
      scheduledFor: '2026-04-23T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const first = updateStudentClassVocabularyFeedback('student-1', created.session.id, {
      tooEasy: 1,
      wrongSkillSupport: 1,
      removedWord: 'valley',
    })
    expect(first.ok).toBe(true)
    const second = updateStudentClassVocabularyFeedback('student-1', created.session.id, {
      editedMeaning: 2,
      offTheme: 1,
    })
    expect(second.ok).toBe(true)
    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions[0]?.vocabularyFeedback?.tooEasy).toBe(1)
    expect(sessions[0]?.vocabularyFeedback?.wrongSkillSupport).toBe(1)
    expect(sessions[0]?.vocabularyFeedback?.editedMeaning).toBe(2)
    expect(sessions[0]?.vocabularyFeedback?.offTheme).toBe(1)
    expect(sessions[0]?.vocabularyFeedback?.removedWords).toEqual(['valley'])
  })

  it('stores generated practice items on session', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Practice class',
      scheduledFor: '2026-04-23T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const updated = updateStudentClassPracticeItems('student-1', created.session.id, [
      {
        id: 'p1',
        type: 'meaning_match',
        word: 'river',
        prompt: 'Choose the best meaning for "river".',
        choices: ['a natural stream of water', 'a mountain top'],
        correctChoiceIndex: 0,
        createdAt: '2026-04-23T09:00:00.000Z',
      },
    ])
    expect(updated.ok).toBe(true)
    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions[0]?.practiceItems?.length).toBe(1)
    expect(sessions[0]?.practiceItems?.[0]?.word).toBe('river')
  })

  it('saves and clears lesson range overrides per lesson key', () => {
    saveStudents([seedStudent()])
    const keyA = 'book-1::unit-1::lesson-1'
    const keyB = 'book-1::unit-1::lesson-2'
    const saveA = upsertLessonRangeOverride('student-1', keyA, { startPage: 8, endPage: 5 })
    expect(saveA.ok).toBe(true)
    const saveB = upsertLessonRangeOverride('student-1', keyB, { startPage: 20, endPage: 24 })
    expect(saveB.ok).toBe(true)
    const rangeA = getLessonRangeOverride('student-1', keyA)
    const rangeB = getLessonRangeOverride('student-1', keyB)
    expect(rangeA?.startPage).toBe(8)
    expect(rangeA?.endPage).toBe(8)
    expect(rangeB?.startPage).toBe(20)
    expect(rangeB?.endPage).toBe(24)
    const cleared = clearLessonRangeOverride('student-1', keyA)
    expect(cleared.ok).toBe(true)
    expect(getLessonRangeOverride('student-1', keyA)).toBeNull()
    expect(getLessonRangeOverride('student-1', keyB)?.startPage).toBe(20)
  })

  it('computes next class label from upcoming sessions', () => {
    saveStudents([
      seedStudent({
        scheduledClasses: [
          {
            id: 'class-old',
            title: 'Completed Class',
            scheduledFor: '2025-04-18T09:00:00.000Z',
            durationMin: 45,
            status: 'completed',
            goals: [],
            activities: [],
            plannedVocabulary: [],
            introducedWords: [],
            practicedWords: [],
            reviewedWords: [],
            learnedWords: [],
            createdAt: '2025-04-18T08:00:00.000Z',
            updatedAt: '2025-04-18T08:00:00.000Z',
          },
          {
            id: 'class-next',
            title: 'Upcoming Class',
            scheduledFor: '2099-04-25T09:00:00.000Z',
            durationMin: 45,
            status: 'planned',
            goals: [],
            activities: [],
            plannedVocabulary: [],
            introducedWords: [],
            practicedWords: [],
            reviewedWords: [],
            learnedWords: [],
            createdAt: '2025-04-18T08:00:00.000Z',
            updatedAt: '2025-04-18T08:00:00.000Z',
          },
        ],
      }),
    ])

    const list = getStudentsListView()
    expect(list).toHaveLength(1)
    expect(list[0]?.nextClassLabel).toContain('Upcoming Class')
  })
})

describe('weekly schedule slots and rolling generation', () => {
  it('prevents overlapping slots and supports 60-minute assignment', () => {
    saveStudents([seedStudent()])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const first = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60,
      durationMinutes: 60,
      studentId: 'student-1',
    })
    expect(first.ok).toBe(true)

    const overlap = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60 + 30,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(overlap.ok).toBe(false)
  })

  it('generates 30-day classes idempotently from slots', () => {
    saveStudents([seedStudent()])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 60,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return
    expect(getWeeklySlotAssignments()).toHaveLength(1)

    generateScheduledClassesWindow(30)
    const firstPass = getStudentScheduledClasses('student-1')
    generateScheduledClassesWindow(30)
    const secondPass = getStudentScheduledClasses('student-1')

    expect(firstPass.length).toBeGreaterThan(0)
    expect(secondPass.length).toBe(firstPass.length)
    expect(secondPass[0]?.durationMin).toBe(60)
    expect(secondPass[0]?.sourceSlotId).toBe(slot.assignment.id)
    expect(secondPass[0]?.plannedVocabulary).toEqual([])
  })

  it('removes weekly slots when a student is deleted', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other Student' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 3],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 3,
      startMinute: 10 * 60,
      durationMinutes: 60,
      studentId: 'student-1',
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    expect(getWeeklySlotAssignments()).toHaveLength(3)

    const removed = removeWeeklySlotsForStudent('student-1')
    expect(removed).toBe(2)
    expect(getWeeklySlotAssignments()).toHaveLength(1)
    expect(getWeeklySlotAssignments()[0]?.studentId).toBe('student-2')
  })

  it('updateWeeklySlotAssignment preserves id and rejects overlaps', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other Student' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 3],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const first = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const slotId = first.assignment.id

    const updated = updateWeeklySlotAssignment(slotId, {
      dayOfWeek: 3,
      startMinute: 11 * 60,
      durationMinutes: 60,
      studentId: 'student-1',
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.assignment.id).toBe(slotId)
    expect(updated.assignment.dayOfWeek).toBe(3)
    expect(updated.assignment.durationMinutes).toBe(60)

    const validated = validateWeeklySlotUpdate(slotId, {
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(validated.ok).toBe(false)

    const overlap = updateWeeklySlotAssignment(slotId, {
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(overlap.ok).toBe(false)
  })

  it('removeWeeklySlotAssignment cancels future linked sessions', () => {
    saveStudents([seedStudent()])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return
    generateScheduledClassesWindow(30)
    const before = getStudentScheduledClasses('student-1').filter((s) => s.status === 'planned')
    expect(before.length).toBeGreaterThan(0)

    const removed = removeWeeklySlotAssignment(slot.assignment.id)
    expect(removed.ok).toBe(true)
    const after = getStudentScheduledClasses('student-1').filter(
      (s) => s.sourceSlotId === slot.assignment.id && s.status === 'planned',
    )
    expect(after).toHaveLength(0)
    const cancelled = getStudentScheduledClasses('student-1').filter(
      (s) => s.sourceSlotId === slot.assignment.id && s.status === 'cancelled',
    )
    expect(cancelled.length).toBeGreaterThan(0)
  })

  it('getClassSessionsForDateRange returns sessions in range and excludes completed/cancelled', () => {
    saveStudents([seedStudent()])
    const inRange = upsertStudentClassSession('student-1', {
      title: 'In range',
      scheduledFor: '2026-07-08T10:00:00',
      durationMin: 45,
    })
    const outOfRange = upsertStudentClassSession('student-1', {
      title: 'Out of range',
      scheduledFor: '2026-08-01T10:00:00',
      durationMin: 45,
    })
    const completed = upsertStudentClassSession('student-1', {
      title: 'Done',
      scheduledFor: '2026-07-09T10:00:00',
      durationMin: 45,
    })
    expect(inRange.ok && outOfRange.ok && completed.ok).toBe(true)
    if (!inRange.ok || !outOfRange.ok || !completed.ok) return
    transitionStudentClassStatus('student-1', completed.session.id, 'completed')
    transitionStudentClassStatus('student-1', outOfRange.session.id, 'cancelled')

    const rows = getClassSessionsForDateRange(new Date(2026, 6, 6), new Date(2026, 6, 12))
    expect(rows.map((row) => row.session.title)).toEqual(['In range'])
  })

  it('rescheduleSingleClassOccurrence moves one class and skips regeneration on that date', () => {
    saveStudents([seedStudent()])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 3],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return

    generateScheduledClassesWindow(30)
    const before = getStudentScheduledClasses('student-1')
    const target = before.find((row) => row.sourceSlotId === slot.assignment.id)
    expect(target).toBeTruthy()
    if (!target) return

    const originalDate = new Date(target.scheduledFor)
    const originalLocal = localDateKey(originalDate)
    const wednesday = new Date(originalDate)
    while (wednesday.getDay() !== 3) {
      wednesday.setDate(wednesday.getDate() + 1)
    }

    const moved = rescheduleSingleClassOccurrence(
      'student-1',
      target.id,
      wednesday,
      11 * 60,
      60,
    )
    expect(moved.ok).toBe(true)

    const exceptions = getWeeklySlotExceptions()
    expect(exceptions.some((row) => row.slotId === slot.assignment.id && row.localDate === originalLocal)).toBe(true)

    const updated = getStudentScheduledClasses('student-1').find((row) => row.id === target.id)
    expect(updated?.durationMin).toBe(60)
    expect(new Date(updated!.scheduledFor).getDay()).toBe(3)

    generateScheduledClassesWindow(30)
    const sameDayGenerated = getStudentScheduledClasses('student-1').filter((row) => {
      if (row.sourceSlotId !== slot.assignment.id) return false
      return localDateKey(new Date(row.scheduledFor)) === originalLocal
    })
    expect(sameDayGenerated.filter((row) => row.status === 'planned').length).toBe(0)

    const wednesdayLocal = localDateKey(wednesday)
    const onWednesday = getStudentScheduledClasses('student-1').filter(
      (row) => localDateKey(new Date(row.scheduledFor)) === wednesdayLocal,
    )
    expect(onWednesday.some((row) => row.id === target.id)).toBe(true)
  })

  it('validateSingleOccurrenceReschedule rejects overlapping weekly slots', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return
    generateScheduledClassesWindow(30)
    const session = getStudentScheduledClasses('student-1')[0]
    expect(session).toBeTruthy()
    if (!session) return
    const monday = new Date(session.scheduledFor)
    const result = validateSingleOccurrenceReschedule(
      'student-1',
      session.id,
      monday,
      10 * 60,
      30,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('Other')
  })

  it('validateSingleOccurrenceReschedule rejects days marked Off', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const sunday = new Date(2026, 6, 5, 0, 0, 0, 0)
    const result = validateSingleOccurrenceReschedule('student-1', null, sunday, 10 * 60, 30)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/Unavailable/i)
  })

  it('upsertWeeklySlotAssignment rejects days marked Off', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const result = upsertWeeklySlotAssignment({
      dayOfWeek: 0,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/Unavailable/i)
  })

  it('createOneOffClassSession adds a session without sourceSlotId', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    const created = createOneOffClassSession('student-1', monday, 10 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.session.sourceSlotId).toBeUndefined()
    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions.some((row) => row.id === created.session.id)).toBe(true)
  })

  it('createOneOffClassSession rejects overlap with weekly slot', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    generateScheduledClassesWindow(30)
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    expect(monday.getDay()).toBe(1)
    const result = createOneOffClassSession('student-1', monday, 10 * 60, 30)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('Other')
  })

  it('createOneOffClassSession succeeds when recurring class was cancelled that date', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    generateScheduledClassesWindow(30)
    const otherSession = getStudentScheduledClasses('student-2')[0]
    expect(otherSession).toBeTruthy()
    if (!otherSession) return
    const monday = new Date(otherSession.scheduledFor)
    monday.setHours(0, 0, 0, 0)
    expect(monday.getDay()).toBe(1)
    expect(cancelClassSession('student-2', otherSession.id).ok).toBe(true)

    const result = createOneOffClassSession('student-1', monday, 10 * 60, 30)
    expect(result.ok).toBe(true)
  })

  it('createOneOffClassSession succeeds at old slot time after single occurrence was rescheduled', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 3],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return

    generateScheduledClassesWindow(30)
    const session = getStudentScheduledClasses('student-2')[0]
    expect(session).toBeTruthy()
    if (!session) return

    const originalDate = new Date(session.scheduledFor)
    const wednesday = new Date(originalDate)
    while (wednesday.getDay() !== 3) {
      wednesday.setDate(wednesday.getDate() + 1)
    }

    expect(
      rescheduleSingleClassOccurrence('student-2', session.id, wednesday, 11 * 60, 30).ok,
    ).toBe(true)

    const result = createOneOffClassSession('student-1', originalDate, 10 * 60, 30)
    expect(result.ok).toBe(true)
  })

  it('upsertWeeklySlotAssignment names the conflicting weekly slot', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    const result = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('Other')
    expect(result.error).toContain('weekly')
  })

  it('ignores orphan weekly slots when checking overlaps', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    // Simulate a leftover slot for a deleted student (no profile left).
    const raw = [
      {
        id: 'ghost-slot',
        dayOfWeek: 1,
        startMinute: 10 * 60,
        durationMinutes: 30,
        studentId: 'deleted-student',
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
      },
    ]
    localStorage.setItem('esl_weekly_slot_assignments', JSON.stringify(raw))

    const pruned = pruneOrphanWeeklySlots()
    expect(pruned).toBe(1)
    expect(getWeeklySlotAssignments()).toHaveLength(0)

    const result = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(result.ok).toBe(true)
  })

  it('putStudentOnBreak frees weekly times and hides from active list', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other Student' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(getWeeklySlotAssignments()).toHaveLength(1)

    const paused = putStudentOnBreak('student-1')
    expect(paused.ok).toBe(true)
    expect(getWeeklySlotAssignments()).toHaveLength(0)
    expect(getStudentsListView().map((s) => s.id)).toEqual(['student-2'])
    expect(getStudentsListView(undefined, { includeOnBreak: true }).find((s) => s.id === 'student-1')?.isOnBreak).toBe(
      true,
    )

    // Same time can now be given to another active student.
    const reassigned = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    expect(reassigned.ok).toBe(true)

    const restored = restoreStudentFromBreak('student-1')
    expect(restored.ok).toBe(true)
    expect(getStudentsListView().map((s) => s.id).sort()).toEqual(['student-1', 'student-2'])
  })

  it('deleteStudentPermanently clears weekly slots', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other Student' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    const deleted = deleteStudentPermanently('student-1')
    expect(deleted.ok).toBe(true)
    expect(getWeeklySlotAssignments()).toHaveLength(0)
    expect(getStudents().find((s) => s.id === 'student-1')).toBeUndefined()
  })

  it('updateOneOffClassSession moves a one-off and cancelClassSession cancels it', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 3],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    const created = createOneOffClassSession('student-1', monday, 9 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const wednesday = new Date(2026, 6, 8, 0, 0, 0, 0)
    const moved = updateOneOffClassSession('student-1', created.session.id, wednesday, 10 * 60, 60)
    expect(moved.ok).toBe(true)

    const updated = getStudentScheduledClasses('student-1').find((row) => row.id === created.session.id)
    expect(updated?.durationMin).toBe(60)
    expect(localDateKey(new Date(updated!.scheduledFor))).toBe(localDateKey(wednesday))

    const cancelled = cancelClassSession('student-1', created.session.id)
    expect(cancelled.ok).toBe(true)
    const afterCancel = getStudentScheduledClasses('student-1').find((row) => row.id === created.session.id)
    expect(afterCancel?.status).toBe('cancelled')
  })

  it('moveClassOccurrence moves a weekly occurrence via +chip target and keeps prep status', () => {
    saveStudents([seedStudent()])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return

    generateScheduledClassesWindow(30)
    const target = getStudentScheduledClasses('student-1').find(
      (row) => row.sourceSlotId === slot.assignment.id,
    )
    expect(target).toBeTruthy()
    if (!target) return

    transitionStudentClassStatus('student-1', target.id, 'prepared')

    const original = new Date(target.scheduledFor)
    const plusDay = new Date(original.getFullYear(), original.getMonth(), original.getDate())
    const moved = moveClassOccurrence('student-1', target.id, plusDay, 10 * 60 + 30, 30)
    expect(moved.ok).toBe(true)
    if (!moved.ok) return

    const updated = getStudentScheduledClasses('student-1').find((row) => row.id === target.id)
    expect(updated?.status).toBe('prepared')
    expect(new Date(updated!.scheduledFor).getHours() * 60 + new Date(updated!.scheduledFor).getMinutes()).toBe(
      10 * 60 + 30,
    )
  })

  it('moveClassOccurrence leaves live without completing, then moves; rejects finished; moves one-offs', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    const created = createOneOffClassSession('student-1', monday, 9 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const started = startStudentClassSession('student-1', created.session.id)
    expect(started.ok).toBe(true)
    const liveMove = moveClassOccurrence('student-1', created.session.id, monday, 10 * 60, 30)
    expect(liveMove.ok).toBe(true)
    if (!liveMove.ok) return

    const afterLiveMove = getStudentScheduledClasses('student-1').find((row) => row.id === created.session.id)
    expect(afterLiveMove?.status).toBe('planned')
    expect(afterLiveMove?.classStartedAt).toBeUndefined()
    expect(afterLiveMove?.bookmarkAtEnd).toBeUndefined()
    expect(afterLiveMove?.classEndedAt).toBeUndefined()
    expect(new Date(afterLiveMove!.scheduledFor).getHours() * 60 + new Date(afterLiveMove!.scheduledFor).getMinutes()).toBe(
      10 * 60,
    )

    // Can start again later at the new time
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    endStudentClassSession('student-1', created.session.id)
    // completed cannot move
    const doneMove = moveClassOccurrence('student-1', created.session.id, monday, 11 * 60, 30)
    expect(doneMove.ok).toBe(false)

    const tuesday = new Date(2026, 6, 7, 0, 0, 0, 0)
    const other = createOneOffClassSession('student-1', tuesday, 9 * 60, 30)
    expect(other.ok).toBe(true)
    if (!other.ok) return
    const moved = moveClassOccurrence('student-1', other.session.id, tuesday, 11 * 60, 30)
    expect(moved.ok).toBe(true)
  })

  it('moveClassOccurrence from live restores prepared when prep exists and writes no bookmark', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    const created = createOneOffClassSession('student-1', monday, 9 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const withPrep = updateStudentClassPrep('student-1', created.session.id, {
      prepNotes: 'Review unit 3 vocab',
    })
    expect(withPrep.ok).toBe(true)

    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const tomorrow = new Date(2026, 6, 7, 0, 0, 0, 0)
    const moved = moveClassOccurrence('student-1', created.session.id, tomorrow, 9 * 60, 30)
    expect(moved.ok).toBe(true)
    if (!moved.ok) return

    const row = getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)
    expect(row?.status).toBe('prepared')
    expect(row?.prepNotes).toBe('Review unit 3 vocab')
    expect(row?.classStartedAt).toBeUndefined()
    expect(row?.bookmarkAtEnd).toBeUndefined()
    expect(localDateKey(new Date(row!.scheduledFor))).toBe(localDateKey(tomorrow))
  })

  it('leaveLiveClassSessionWithoutCompleting is idempotent when already planned', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    const created = createOneOffClassSession('student-1', monday, 9 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const left = leaveLiveClassSessionWithoutCompleting('student-1', created.session.id)
    expect(left.ok).toBe(true)
    if (!left.ok) return
    expect(left.status).toBe('planned')
  })

  it('cancelClassOccurrence from live clears live fields and does not bookmark', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    const created = createOneOffClassSession('student-1', monday, 10 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const live = getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)
    expect(live?.status).toBe('in_progress')
    expect(live?.classStartedAt).toBeTruthy()

    const cancelled = cancelClassOccurrence('student-1', created.session.id)
    expect(cancelled.ok).toBe(true)

    const after = getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)
    expect(after?.status).toBe('cancelled')
    expect(after?.classStartedAt).toBeUndefined()
    expect(after?.classEndedAt).toBeUndefined()
    expect(after?.extendedMinutesTotal).toBeUndefined()
    expect(after?.bookmarkAtEnd).toBeUndefined()
  })

  it('reconcileSoftClassAutoStart goes live at scheduled start and is idempotent', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    // Snap to a valid teaching day (Mon–Fri)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }
    const startMinute = 10 * 60
    const created = createOneOffClassSession('student-1', day, startMinute, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const startMs = new Date(created.session.scheduledFor).getTime()
    const before = reconcileSoftClassAutoStart(startMs - 1)
    expect(before.started).toBeNull()
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)?.status).toBe(
      'planned',
    )

    const first = reconcileSoftClassAutoStart(startMs + 5_000)
    expect(first.started?.session.id).toBe(created.session.id)
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)?.status).toBe(
      'in_progress',
    )
    expect(findAppWideLiveClass()?.session.id).toBe(created.session.id)

    const again = reconcileSoftClassAutoStart(startMs + 10_000)
    expect(again.started).toBeNull()
    expect(again.blocked).toHaveLength(0)
  })

  it('reconcileSoftClassAutoStart does not start a second student while one is live', () => {
    saveStudents([seedStudent({ id: 'student-1' }), seedStudent({ id: 'student-2', name: 'Maya' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }
    const a = createOneOffClassSession('student-1', day, 10 * 60, 30)
    const b = createOneOffClassSession('student-2', day, 10 * 60 + 30, 30)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    expect(startStudentClassSession('student-1', a.session.id).ok).toBe(true)

    const bStart = new Date(b.session.scheduledFor).getTime()
    const result = reconcileSoftClassAutoStart(bStart + 1_000)
    expect(result.started).toBeNull()
    expect(result.blocked.some((row) => row.session.id === b.session.id)).toBe(true)
    expect(getStudentScheduledClasses('student-2').find((s) => s.id === b.session.id)?.status).toBe('planned')
  })

  it('reconcileSoftClassAutoStart does not start from prep alone before the slot', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }
    const created = createOneOffClassSession('student-1', day, 14 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(
      updateStudentClassPrep('student-1', created.session.id, { prepNotes: 'Warm-up only' }).ok,
    ).toBe(true)

    const startMs = new Date(created.session.scheduledFor).getTime()
    const result = reconcileSoftClassAutoStart(startMs - 5 * 60_000)
    expect(result.started).toBeNull()
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)?.status).toBe(
      'prepared',
    )
  })

  it('updateStudentClassPrep saves classroom-home goals and marks prepared', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }
    const created = createOneOffClassSession('student-1', day, 15 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(
      updateStudentClassPrep('student-1', created.session.id, {
        classroomHomeGoals: { vocabulary: 'food words', grammar: '  ', speaking: 'favourite food' },
      }).ok,
    ).toBe(true)

    const row = getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)
    expect(row?.status).toBe('prepared')
    expect(row?.classroomHomeGoals).toEqual({ vocabulary: 'food words', speaking: 'favourite food' })
  })

  it('updateStudentClassPrep saves skip parts and starred words for this class', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }
    const created = createOneOffClassSession('student-1', day, 15 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(
      updateStudentClassPrep('student-1', created.session.id, {
        prepSkippedPartIds: ['part-grammar'],
        plannedVocabulary: ['athlete', 'athlete', 'soar'],
      }).ok,
    ).toBe(true)

    const row = getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)
    expect(row?.status).toBe('prepared')
    expect(row?.prepSkippedPartIds).toEqual(['part-grammar'])
    expect(row?.plannedVocabulary).toEqual(['athlete', 'soar'])
  })

  it('extendStudentClassSession adds overtime up to +15 and persists across reload', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }
    const created = createOneOffClassSession('student-1', day, 11 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(extendStudentClassSession('student-1', created.session.id, 5).ok).toBe(false)
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)

    const first = extendStudentClassSession('student-1', created.session.id, 10)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.extendedMinutesTotal).toBe(10)

    const mid = getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)
    expect(mid?.extendedMinutesTotal).toBe(10)

    const over = extendStudentClassSession('student-1', created.session.id, 10)
    expect(over.ok).toBe(false)

    const second = extendStudentClassSession('student-1', created.session.id, 5)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.extendedMinutesTotal).toBe(15)

    const capped = extendStudentClassSession('student-1', created.session.id, 2)
    expect(capped.ok).toBe(false)
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)?.extendedMinutesTotal).toBe(
      15,
    )
  })

  it('reconcileHardClassAutoEnd completes live class past grace once; idempotent', () => {
    saveStudents([
      seedStudent({
        id: 'student-1',
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }
    const created = createOneOffClassSession('student-1', day, 9 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(
      updateStudentClassSelectedSection('student-1', created.session.id, {
        id: 'sec-1',
        bookId: 'book-a',
        bookTitle: 'Book A',
        unitId: 'unit-1',
        unitTitle: 'Unit 1',
        type: 'lesson',
        title: 'Lesson',
        startPageHint: 12,
        endPageHint: 14,
      }).ok,
    ).toBe(true)

    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)

    const startMs = new Date(created.session.scheduledFor).getTime()
    const pastGrace = startMs + 30 * 60_000 + 5 * 60_000

    const midGrace = reconcileHardClassAutoEnd(startMs + 30 * 60_000 + 60_000)
    expect(midGrace.ended).toHaveLength(0)
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)?.status).toBe(
      'in_progress',
    )

    const first = reconcileHardClassAutoEnd(pastGrace)
    expect(first.ended).toHaveLength(1)
    expect(first.ended[0]?.alreadyEnded).toBe(false)
    const completed = getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)
    expect(completed?.status).toBe('completed')
    expect(completed?.bookmarkAtEnd?.bookId).toBe('book-a')
    expect(completed?.bookmarkAtEnd?.pdfPage).toBe(14)
    expect(completed?.classEndNote).toBeUndefined()

    const again = hardAutoEndStudentClassSession('student-1', created.session.id)
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.alreadyEnded).toBe(true)

    const secondPass = reconcileHardClassAutoEnd(pastGrace + 60_000)
    expect(secondPass.ended).toHaveLength(0)
  })

  it('reconcileClassScheduleCatchUp marks no-show missed, auto-ends live, soft-starts in window', () => {
    saveStudents([seedStudent({ id: 'student-1' }), seedStudent({ id: 'student-2', name: 'Maya' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }

    const morning = createOneOffClassSession('student-1', day, 9 * 60, 30)
    const overdueLive = createOneOffClassSession('student-1', day, 10 * 60, 30)
    const mid = createOneOffClassSession('student-2', day, 11 * 60, 30)
    expect(morning.ok && overdueLive.ok && mid.ok).toBe(true)
    if (!morning.ok || !overdueLive.ok || !mid.ok) return

    expect(startStudentClassSession('student-1', overdueLive.session.id).ok).toBe(true)

    const midStart = new Date(mid.session.scheduledFor).getTime()
    // 11:10 — morning + overdue live past end+grace; mid still in its 11:00–11:35 window
    const afternoon = midStart + 10 * 60_000

    const result = reconcileClassScheduleCatchUp(afternoon)
    expect(result.missed.some((row) => row.sessionId === morning.session.id)).toBe(true)
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === morning.session.id)?.status).toBe(
      'missed',
    )
    expect(result.autoEnded.some((row) => row.sessionId === overdueLive.session.id && !row.alreadyEnded)).toBe(
      true,
    )
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === overdueLive.session.id)?.status).toBe(
      'completed',
    )
    expect(result.started.started?.session.id).toBe(mid.session.id)
    expect(getStudentScheduledClasses('student-2').find((s) => s.id === mid.session.id)?.status).toBe(
      'in_progress',
    )
  })

  it('markMissedClassTaughtAnyway and reschedule from missed restore usable status', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() + 1)
    }
    const created = createOneOffClassSession('student-1', day, 9 * 60, 30)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const startMs = new Date(created.session.scheduledFor).getTime()
    reconcileClassScheduleCatchUp(startMs + 30 * 60_000 + 5 * 60_000)
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)?.status).toBe(
      'missed',
    )

    const taught = markMissedClassTaughtAnyway('student-1', created.session.id, 'Parent said they came')
    expect(taught.ok).toBe(true)
    const done = getStudentScheduledClasses('student-1').find((s) => s.id === created.session.id)
    expect(done?.status).toBe('completed')
    expect(done?.classEndNote).toContain('Parent')

    const other = createOneOffClassSession('student-1', day, 13 * 60, 30)
    expect(other.ok).toBe(true)
    if (!other.ok) return
    reconcileClassScheduleCatchUp(new Date(other.session.scheduledFor).getTime() + 40 * 60_000)
    expect(getStudentScheduledClasses('student-1').find((s) => s.id === other.session.id)?.status).toBe(
      'missed',
    )

    const tomorrow = new Date(day)
    tomorrow.setDate(tomorrow.getDate() + 1)
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1)
    }
    const moved = moveClassOccurrence('student-1', other.session.id, tomorrow, 13 * 60, 30)
    expect(moved.ok).toBe(true)
    const rescheduled = getStudentScheduledClasses('student-1').find((s) => s.id === other.session.id)
    expect(rescheduled?.status).toBe('planned')
    expect(localDateKey(new Date(rescheduled!.scheduledFor))).toBe(localDateKey(tomorrow))
  })

  it('cancelClassOccurrence cancels weekly class and writes cancelled exception', () => {
    saveStudents([seedStudent()])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return

    generateScheduledClassesWindow(30)
    const target = getStudentScheduledClasses('student-1').find(
      (row) => row.sourceSlotId === slot.assignment.id,
    )
    expect(target).toBeTruthy()
    if (!target) return

    const occurrenceDate = localDateKey(new Date(target.scheduledFor))
    const cancelled = cancelClassOccurrence('student-1', target.id)
    expect(cancelled.ok).toBe(true)

    const after = getStudentScheduledClasses('student-1').find((row) => row.id === target.id)
    expect(after?.status).toBe('cancelled')
    expect(
      getWeeklySlotExceptions().some(
        (row) =>
          row.slotId === slot.assignment.id &&
          row.localDate === occurrenceDate &&
          row.type === 'cancelled',
      ),
    ).toBe(true)

    generateScheduledClassesWindow(30)
    const recreated = getStudentScheduledClasses('student-1').filter(
      (row) =>
        row.sourceSlotId === slot.assignment.id &&
        localDateKey(new Date(row.scheduledFor)) === occurrenceDate &&
        row.status === 'planned',
    )
    expect(recreated).toHaveLength(0)
  })

  it('clearScheduledClassesInDateRange cancels planned sessions but keeps weekly slots', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    const tuesday = new Date(2026, 6, 7, 0, 0, 0, 0)
    const a = createOneOffClassSession('student-1', monday, 9 * 60, 30)
    const b = createOneOffClassSession('student-2', tuesday, 10 * 60, 30)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 3,
      startMinute: 11 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return

    const cleared = clearScheduledClassesInDateRange(monday, tuesday)
    expect(cleared.ok).toBe(true)
    expect(cleared.cancelledCount).toBeGreaterThanOrEqual(2)

    expect(getStudentScheduledClasses('student-1').find((row) => row.id === a.session.id)?.status).toBe(
      'cancelled',
    )
    expect(getStudentScheduledClasses('student-2').find((row) => row.id === b.session.id)?.status).toBe(
      'cancelled',
    )
    expect(getWeeklySlotAssignments().some((row) => row.id === slot.assignment.id)).toBe(true)
  })

  it('upsertWeeklySlotAssignment rejects overlap with an existing one-off', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcomingMonday = new Date(today)
    while (upcomingMonday.getDay() !== 1) {
      upcomingMonday.setDate(upcomingMonday.getDate() + 1)
    }

    const liveOneOff = createOneOffClassSession('student-2', upcomingMonday, 10 * 60, 30)
    expect(liveOneOff.ok).toBe(true)

    const weekly = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(weekly.ok).toBe(false)
  })

  it('resetTeacherCalendar removes weekly slots and cancels upcoming classes, keeps completed', () => {
    saveStudents([seedStudent({ id: 'student-1' })])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return

    generateScheduledClassesWindow(30)
    const planned = getStudentScheduledClasses('student-1').find(
      (row) => row.sourceSlotId === slot.assignment.id && row.status === 'planned',
    )
    expect(planned).toBeTruthy()
    if (!planned) return

    const done = upsertStudentClassSession('student-1', {
      title: 'Past class',
      scheduledFor: '2026-01-05T10:00:00.000Z',
      durationMin: 30,
      status: 'completed',
    })
    expect(done.ok).toBe(true)

    const reset = resetTeacherCalendar()
    expect(reset.ok).toBe(true)
    expect(reset.removedSlots).toBeGreaterThanOrEqual(1)
    expect(reset.cancelledSessions).toBeGreaterThanOrEqual(1)
    expect(getWeeklySlotAssignments()).toHaveLength(0)
    expect(getWeeklySlotExceptions()).toHaveLength(0)

    const after = getStudentScheduledClasses('student-1')
    expect(after.find((row) => row.id === planned.id)?.status).toBe('cancelled')
    if (done.ok) {
      expect(after.find((row) => row.id === done.session.id)?.status).toBe('completed')
    }

    generateScheduledClassesWindow(30)
    expect(
      getStudentScheduledClasses('student-1').filter((row) => row.status === 'planned'),
    ).toHaveLength(0)
  })

  it('clearStudentClassesInDateRange only cancels that student in range', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const monday = new Date(2026, 6, 6, 0, 0, 0, 0)
    const tuesday = new Date(2026, 6, 7, 0, 0, 0, 0)
    const a = createOneOffClassSession('student-1', monday, 9 * 60, 30)
    const b = createOneOffClassSession('student-2', monday, 10 * 60, 30)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 14 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return

    const cleared = clearStudentClassesInDateRange('student-1', monday, tuesday)
    expect(cleared.ok).toBe(true)
    if (!cleared.ok) return
    expect(cleared.cancelledCount).toBeGreaterThanOrEqual(1)

    expect(getStudentScheduledClasses('student-1').find((row) => row.id === a.session.id)?.status).toBe(
      'cancelled',
    )
    expect(getStudentScheduledClasses('student-2').find((row) => row.id === b.session.id)?.status).toBe(
      'planned',
    )
    expect(getWeeklySlotAssignments().some((row) => row.id === slot.assignment.id)).toBe(true)
  })

  it('removeStudentFromCalendar drops slots and cancels upcoming; keeps completed and other students', () => {
    saveStudents([
      seedStudent({ id: 'student-1' }),
      seedStudent({ id: 'student-2', name: 'Other' }),
    ])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1, 2, 3, 4, 5],
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
    })
    const slot1 = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    const slot2 = upsertWeeklySlotAssignment({
      dayOfWeek: 2,
      startMinute: 11 * 60,
      durationMinutes: 30,
      studentId: 'student-2',
    })
    expect(slot1.ok && slot2.ok).toBe(true)
    if (!slot1.ok || !slot2.ok) return

    generateScheduledClassesWindow(30)
    const planned = getStudentScheduledClasses('student-1').find(
      (row) => row.sourceSlotId === slot1.assignment.id && row.status === 'planned',
    )
    expect(planned).toBeTruthy()

    const done = upsertStudentClassSession('student-1', {
      title: 'Past',
      scheduledFor: '2026-01-05T10:00:00.000Z',
      durationMin: 30,
      status: 'completed',
    })
    expect(done.ok).toBe(true)

    const removed = removeStudentFromCalendar('student-1')
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.removedSlots).toBeGreaterThanOrEqual(1)
    expect(getWeeklySlotAssignments().some((row) => row.studentId === 'student-1')).toBe(false)
    expect(getWeeklySlotAssignments().some((row) => row.id === slot2.assignment.id)).toBe(true)

    if (planned) {
      expect(getStudentScheduledClasses('student-1').find((row) => row.id === planned.id)?.status).toBe(
        'cancelled',
      )
    }
    if (done.ok) {
      expect(
        getStudentScheduledClasses('student-1').find((row) => row.id === done.session.id)?.status,
      ).toBe('completed')
    }
  })
})

describe('class sessions and outcomes', () => {
  it('allows in_progress and excludes it from next-class list label', () => {
    saveStudents([seedStudent()])
    const tSoon = new Date(Date.now() + 2 * 86400000).toISOString()
    const tLater = new Date(Date.now() + 4 * 86400000).toISOString()
    const createdSoon = upsertStudentClassSession('student-1', {
      title: 'Sooner class',
      scheduledFor: tSoon,
      durationMin: 45,
    })
    const createdLater = upsertStudentClassSession('student-1', {
      title: 'Later class',
      scheduledFor: tLater,
      durationMin: 45,
    })
    expect(createdSoon.ok && createdLater.ok).toBe(true)
    if (!createdSoon.ok || !createdLater.ok) return
    const goInProgress = transitionStudentClassStatus('student-1', createdSoon.session.id, 'in_progress')
    expect(goInProgress.ok).toBe(true)
    const list = getStudentsListView()
    const row = list.find((s) => s.id === 'student-1')
    expect(row?.nextClassLabel).toContain('Later class')
  })

  it('strips invalid bookmarkAtEnd when loading sessions', () => {
    const nowIso = '2026-04-20T10:00:00.000Z'
    const badSession: StudentClassSession = {
      id: 'class-raw-1',
      title: 'Test',
      scheduledFor: '2026-05-10T10:00:00.000Z',
      durationMin: 45,
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
      bookmarkAtEnd: { bookId: '', pdfPage: 12 },
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    saveStudent({
      ...seedStudent(),
      scheduledClasses: [badSession],
    })
    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions.find((s) => s.id === 'class-raw-1')?.bookmarkAtEnd).toBeUndefined()
  })

  it('startStudentClassSession marks planned class in_progress with classStartedAt', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Live lesson',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const started = startStudentClassSession('student-1', created.session.id)
    expect(started.ok).toBe(true)
    const profile = getStudentProfileView('student-1')
    const row = profile?.scheduledClasses.find((s) => s.id === created.session.id)
    expect(row?.status).toBe('in_progress')
    expect(row?.classStartedAt).toMatch(/^\d{4}-/)
  })

  it('resolveBookOverlayClassSessionId binds planned and prepared classes from the URL', () => {
    const sessions = [
      { id: 'c-planned', status: 'planned' as const },
      { id: 'c-prepared', status: 'prepared' as const },
      { id: 'c-live', status: 'in_progress' as const },
      { id: 'c-done', status: 'completed' as const },
    ]
    expect(
      resolveBookOverlayClassSessionId({ urlClassSessionId: 'c-planned', sessions }),
    ).toBe('c-planned')
    expect(
      resolveBookOverlayClassSessionId({ urlClassSessionId: 'c-prepared', sessions }),
    ).toBe('c-prepared')
    expect(
      resolveBookOverlayClassSessionId({ urlClassSessionId: 'c-live', sessions }),
    ).toBe('c-live')
    expect(
      resolveBookOverlayClassSessionId({ urlClassSessionId: 'c-done', sessions }),
    ).toBeNull()
    expect(resolveBookOverlayClassSessionId({ urlClassSessionId: null, sessions })).toBe('c-live')
    expect(
      resolveBookOverlayClassSessionId({
        urlClassSessionId: 'c-planned',
        sessions: sessions.filter((s) => s.id !== 'c-live'),
      }),
    ).toBe('c-planned')
  })

  it('buildPrepareLessonMapHref opens map with class session and planned book/unit (no auto-open)', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [
          sessionBase({
            id: 'class-9',
            title: 'Prep',
            scheduledFor: '2026-05-01T10:00:00.000Z',
            status: 'planned',
            selectedSection: {
              id: 'sec-1',
              type: 'part',
              bookId: 'book-a',
              bookTitle: 'Test Book',
              unitId: 'unit-1',
              unitTitle: 'Unit 1',
              title: 'Part A',
            },
          }),
        ],
      }),
    ])
    expect(buildPrepareLessonMapHref('student-1', 'class-9')).toBe(
      '/students/student-1/map?classSession=class-9&book=book-a&unit=unit-1',
    )
  })

  it('buildStudentMapReaderHref opens teaching reader on map with resume params', () => {
    expect(
      buildStudentMapReaderHref({
        studentId: 'student-1',
        bookId: 'book-a',
        unitId: 'unit-2',
      }),
    ).toBe('/students/student-1/map?openBook=1&book=book-a&unit=unit-2')
    expect(buildStudentMapReaderHref({ studentId: 'student-1' })).toBe(
      '/students/student-1/map?openBook=1',
    )
  })

  it('buildSpreadPageSpanKey creates stable page span keys', () => {
    expect(buildSpreadPageSpanKey(33, 34)).toBe('p33-34')
    expect(buildSpreadPageSpanKey(35, null)).toBe('p35')
  })

  it('startStudentClassSession is idempotent when already in_progress', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Live lesson',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const firstStartedAt = getStudentProfileView('student-1')?.scheduledClasses.find(
      (s) => s.id === created.session.id,
    )?.classStartedAt
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const secondStartedAt = getStudentProfileView('student-1')?.scheduledClasses.find(
      (s) => s.id === created.session.id,
    )?.classStartedAt
    expect(secondStartedAt).toBe(firstStartedAt)
  })
  it('startStudentClassSession auto-ends other in_progress class when starting a new one', () => {
    saveStudents([seedStudent()])
    const a = upsertStudentClassSession('student-1', {
      title: 'First',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    const b = upsertStudentClassSession('student-1', {
      title: 'Second',
      scheduledFor: '2026-04-26T09:00',
      durationMin: 45,
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(startStudentClassSession('student-1', a.session.id).ok).toBe(true)
    const startedB = startStudentClassSession('student-1', b.session.id)
    expect(startedB.ok).toBe(true)
    const profile = getStudentProfileView('student-1')
    expect(profile?.scheduledClasses.find((s) => s.id === a.session.id)?.status).toBe('completed')
    expect(profile?.scheduledClasses.find((s) => s.id === b.session.id)?.status).toBe('in_progress')
  })

  it('after endStudentClassSession, another class on the same student can start', () => {
    saveStudents([seedStudent()])
    const a = upsertStudentClassSession('student-1', {
      title: 'First',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    const b = upsertStudentClassSession('student-1', {
      title: 'Second',
      scheduledFor: '2026-04-26T09:00',
      durationMin: 45,
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(startStudentClassSession('student-1', a.session.id).ok).toBe(true)
    expect(endStudentClassSession('student-1', a.session.id).ok).toBe(true)
    const startedB = startStudentClassSession('student-1', b.session.id)
    expect(startedB.ok).toBe(true)
    const profile = getStudentProfileView('student-1')
    expect(profile?.scheduledClasses.find((s) => s.id === a.session.id)?.status).toBe('completed')
    expect(profile?.scheduledClasses.find((s) => s.id === b.session.id)?.status).toBe('in_progress')
  })

  it('endStudentClassSession completes in_progress class with end metadata', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Live',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const ended = endStudentClassSession('student-1', created.session.id, {
      classEndNote: '  Great wrap-up  ',
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 12, unitId: 'unit-1' },
    })
    expect(ended.ok).toBe(true)
    const profile = getStudentProfileView('student-1')
    const row = profile?.scheduledClasses.find((s) => s.id === created.session.id)
    expect(row?.status).toBe('completed')
    expect(row?.classEndedAt).toMatch(/^\d{4}-/)
    expect(row?.classEndNote).toBe('Great wrap-up')
    expect(row?.bookmarkAtEnd).toEqual({ bookId: 'book-a', pdfPage: 12, unitId: 'unit-1' })
    expect(profile?.curriculumHistory?.length).toBe(1)
    expect(profile?.curriculumHistory?.[0]).toMatchObject({
      bookId: 'book-a',
      unitId: 'unit-1',
      page: 12,
    })
    expect(profile?.curriculumHistory?.[0].closedAt).toMatch(/^\d{4}-/)
  })

  it('endStudentClassSession resolves unit from assigned refs when bookmark omits unitId', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-resolved' }],
      }),
    ])
    const created = upsertStudentClassSession('student-1', {
      title: 'Live',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    expect(
      endStudentClassSession('student-1', created.session.id, {
        bookmarkAtEnd: { bookId: 'book-a', pdfPage: 5 },
      }).ok,
    ).toBe(true)
    const profile = getStudentProfileView('student-1')
    expect(profile?.curriculumHistory?.[0]).toMatchObject({
      bookId: 'book-a',
      unitId: 'unit-resolved',
      page: 5,
    })
  })

  it('endStudentClassSession refuses when not in progress', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Planned only',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const ended = endStudentClassSession('student-1', created.session.id)
    expect(ended.ok).toBe(false)
    if (ended.ok) return
    expect(ended.error).toMatch(/not in progress/i)
  })

  const miniLibraryForHeadline: BookLibraryPayload = {
    books: [
      {
        id: 'book-a',
        title: 'Test Book',
        units: [
          {
            id: 'unit-1',
            title: 'Unit 1',
            filePath: '/x.pdf',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson 1',
                parts: [
                  { id: 'part-story', title: 'The River Story', startPageHint: 10, endPageHint: 25 },
                  { id: 'part-vocab', title: 'Vocabulary warm-up', startPageHint: 26, endPageHint: 30 },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  function sessionBase(
    overrides: Pick<StudentClassSession, 'id' | 'title' | 'scheduledFor' | 'status'> &
      Partial<StudentClassSession>,
  ): StudentClassSession {
    const now = '2026-04-20T10:00:00.000Z'
    return {
      goals: [],
      activities: [],
      plannedVocabulary: [],
      introducedWords: [],
      practicedWords: [],
      reviewedWords: [],
      learnedWords: [],
      vocabularyReviewPlan: [],
      practiceItems: [],
      durationMin: 45,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  it('getNextClassResumeHeadline suggests keep reading when bookmark page is inside a part', () => {
    const prior = sessionBase({
      id: 'class-done',
      title: 'Past',
      scheduledFor: '2026-04-21T10:00:00.000Z',
      status: 'completed',
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 15, unitId: 'unit-1' },
    })
    const next = sessionBase({
      id: 'class-next',
      title: 'Upcoming',
      scheduledFor: '2026-04-28T10:00:00.000Z',
      status: 'planned',
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [prior, next],
      }),
    ])
    const h = getNextClassResumeHeadline('student-1', 'class-next', miniLibraryForHeadline)
    expect(h?.headline).toBe('Keep reading: The River Story')
  })

  it('getNextClassResumeHeadline suggests vocabulary check when matched part looks like vocabulary', () => {
    const prior = sessionBase({
      id: 'class-done',
      title: 'Past',
      scheduledFor: '2026-04-21T10:00:00.000Z',
      status: 'completed',
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 28, unitId: 'unit-1' },
    })
    const next = sessionBase({
      id: 'class-next',
      title: 'Upcoming',
      scheduledFor: '2026-04-28T10:00:00.000Z',
      status: 'planned',
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [prior, next],
      }),
    ])
    const h = getNextClassResumeHeadline('student-1', 'class-next', miniLibraryForHeadline)
    expect(h?.headline).toBe('Next class: Vocabulary check')
  })

  it('getNextClassResumeHeadline returns null without bookmark or library', () => {
    const prior = sessionBase({
      id: 'class-done',
      title: 'Past',
      scheduledFor: '2026-04-21T10:00:00.000Z',
      status: 'completed',
    })
    const next = sessionBase({
      id: 'class-next',
      title: 'Upcoming',
      scheduledFor: '2026-04-28T10:00:00.000Z',
      status: 'planned',
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [prior, next],
      }),
    ])
    expect(getNextClassResumeHeadline('student-1', 'class-next', miniLibraryForHeadline)).toBeNull()
    expect(getNextClassResumeHeadline('student-1', 'class-next', null)).toBeNull()
  })

  it('getNextClassResumeHeadline returns null when bookmark page is outside all part ranges', () => {
    const prior = sessionBase({
      id: 'class-done',
      title: 'Past',
      scheduledFor: '2026-04-21T10:00:00.000Z',
      status: 'completed',
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 999, unitId: 'unit-1' },
    })
    const next = sessionBase({
      id: 'class-next',
      title: 'Upcoming',
      scheduledFor: '2026-04-28T10:00:00.000Z',
      status: 'planned',
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [prior, next],
      }),
    ])
    expect(getNextClassResumeHeadline('student-1', 'class-next', miniLibraryForHeadline)).toBeNull()
  })

  it('resolveStudentSectionAtPdfPage maps a PDF page to the containing lesson part', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    const hit = resolveStudentSectionAtPdfPage(
      'student-1',
      miniLibraryForHeadline,
      'book-a',
      'unit-1',
      28,
    )
    expect(hit?.id).toBe('part:book-a:unit-1:lesson-1:part-vocab')
    expect(hit?.partTitle).toBe('Vocabulary')
  })

  it('resolveStudentSectionAtPdfPage returns null when page is outside all sections', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    expect(
      resolveStudentSectionAtPdfPage('student-1', miniLibraryForHeadline, 'book-a', 'unit-1', 999),
    ).toBeNull()
  })

  it('resolveStudentSectionAtMappedPage resolves book page with alignment and total PDF length', () => {
    const alignedLibrary: BookLibraryPayload = {
      books: [
        {
          id: 'book-a',
          title: 'Aligned Book',
          pageAlignmentByFile: {
            '/x.pdf': { notCountedPdfPages: [3], hiddenPdfPages: [1, 5] },
          },
          units: [
            {
              id: 'unit-1',
              title: 'Unit 1',
              filePath: '/x.pdf',
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'Lesson 1',
                  parts: [{ id: 'part-vocab', title: 'Vocab block', startPageHint: 2, endPageHint: 4 }],
                },
              ],
            },
          ],
        },
      ],
    }
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    const hit = resolveStudentSectionAtMappedPage(
      'student-1',
      alignedLibrary,
      'book-a',
      'unit-1',
      3,
      10,
    )
    expect(hit?.id).toBe('part:book-a:unit-1:lesson-1:part-vocab')
    expect(
      resolveStudentSectionAtPdfPage('student-1', alignedLibrary, 'book-a', 'unit-1', 99, 10),
    ).toBeNull()
  })

  it('resolveStudentSectionAtMappedBookPage finds lesson in correct unit across multi-unit book', () => {
    const multiUnitLibrary: BookLibraryPayload = {
      books: [
        {
          id: 'book-a',
          title: 'Multi Unit Book',
          units: [
            {
              id: 'unit-1',
              title: 'Unit 1',
              filePath: '/u1.pdf',
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'Lesson 1',
                  parts: [{ id: 'part-a', title: 'Intro', startPageHint: 1, endPageHint: 20 }],
                },
              ],
            },
            {
              id: 'unit-2',
              title: 'Unit 2',
              filePath: '/u2.pdf',
              lessons: [
                {
                  id: 'lesson-2',
                  title: 'Lesson 2',
                  parts: [{ id: 'part-writing', title: 'Writing', startPageHint: 70, endPageHint: 73 }],
                },
              ],
            },
          ],
        },
      ],
    }
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    const bookHit = resolveStudentSectionAtMappedBookPage('student-1', multiUnitLibrary, 'book-a', 71)
    expect(bookHit?.id).toBe('part:book-a:unit-2:lesson-2:part-writing')
    expect(bookHit?.unitId).toBe('unit-2')
    expect(
      resolveStudentSectionAtMappedPage('student-1', multiUnitLibrary, 'book-a', 'unit-1', 71, 100),
    ).toBeNull()
  })

  it('resolveNextSectionForClass prefers curriculum anchor when no completed class with a selected section precedes the planned class', () => {
    const planned = sessionBase({
      id: 'class-planned',
      title: 'Upcoming',
      scheduledFor: '2026-04-28T10:00:00.000Z',
      status: 'planned',
    })
    const anchorId = 'part:book-a:unit-1:lesson-1:part-vocab'
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        curriculumAnchorSectionId: anchorId,
        scheduledClasses: [planned],
      }),
    ])
    const next = resolveNextSectionForClass('student-1', 'class-planned', miniLibraryForHeadline)
    expect(next?.id).toBe(anchorId)
  })

  it('updateStudentCurriculumBookStart keeps a separate start per book', () => {
    const twoBookLibrary: BookLibraryPayload = {
      books: [
        miniLibraryForHeadline.books[0]!,
        {
          id: 'book-b',
          title: 'Second Book',
          units: [
            {
              id: 'unit-b1',
              title: 'Unit B',
              filePath: '/b.pdf',
              lessons: [
                {
                  id: 'lesson-b1',
                  title: 'Lesson B',
                  parts: [
                    { id: 'part-b-story', title: 'Story B', startPageHint: 40, endPageHint: 50 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a', 'book-b'],
        assignedUnitRefs: [
          { bookId: 'book-a', unitId: 'unit-1' },
          { bookId: 'book-b', unitId: 'unit-b1' },
        ],
      }),
    ])
    const aId = 'part:book-a:unit-1:lesson-1:part-vocab'
    const bId = 'part:book-b:unit-b1:lesson-b1:part-b-story'
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        { bookId: 'book-a', sectionId: aId, mappedPage: 28 },
        twoBookLibrary,
      ).ok,
    ).toBe(true)
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        { bookId: 'book-b', sectionId: bId, mappedPage: 42 },
        twoBookLibrary,
      ).ok,
    ).toBe(true)
    expect(getStudentCurriculumBookStart('student-1', 'book-a', twoBookLibrary)).toEqual({
      sectionId: aId,
      unitId: 'unit-1',
      mappedPage: 28,
      updatedAt: expect.any(String),
    })
    expect(getStudentCurriculumBookStart('student-1', 'book-b', twoBookLibrary)).toEqual({
      sectionId: bId,
      unitId: 'unit-b1',
      mappedPage: 42,
      updatedAt: expect.any(String),
    })
    const profile = getStudentProfileView('student-1')
    expect(profile?.curriculumBookStarts?.['book-a']?.mappedPage).toBe(28)
    expect(profile?.curriculumBookStarts?.['book-b']?.mappedPage).toBe(42)
  })

  it('teaching sync keeps custom mapped page when unit has no startPageHint', () => {
    const thinLibrary: BookLibraryPayload = {
      books: [
        {
          id: 'book-thin',
          title: 'Thin Book',
          units: [
            {
              id: 'unit-thin',
              title: 'Whole book',
              filePath: '/thin.pdf',
              lessons: [],
            },
          ],
        },
      ],
    }
    const unitId = 'unit:book-thin:unit-thin'
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-thin'],
        assignedUnitRefs: [{ bookId: 'book-thin', unitId: 'unit-thin' }],
        scheduledClasses: [
          sessionBase({
            id: 'class-next',
            title: 'Next',
            scheduledFor: '2026-06-01T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      }),
    ])
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        { bookId: 'book-thin', sectionId: unitId, mappedPage: 42 },
        thinLibrary,
      ).ok,
    ).toBe(true)
    expect(getStudentCurriculumBookStart('student-1', 'book-thin', thinLibrary)?.mappedPage).toBe(42)

    const options = getStudentSectionOptions('student-1', thinLibrary)
    const chosen = options.find((o) => o.id === unitId)
    expect(chosen).toBeTruthy()
    expect(chosen?.startPageHint).toBeUndefined()

    // Same path as Next class “What we’re teaching” save when there is no page hint.
    const existingStart = getStudentCurriculumBookStart('student-1', 'book-thin', thinLibrary)
    let mappedPage: number | null = null
    if (existingStart?.sectionId === chosen!.id && existingStart.mappedPage >= 1) {
      mappedPage = existingStart.mappedPage
    } else if (typeof chosen!.startPageHint === 'number' && chosen!.startPageHint >= 1) {
      mappedPage = Math.floor(chosen!.startPageHint)
    } else if (existingStart && existingStart.mappedPage >= 1) {
      mappedPage = existingStart.mappedPage
    }
    expect(
      updateStudentClassSelectedSection('student-1', 'class-next', toStudentBookSectionRef(chosen!)).ok,
    ).toBe(true)
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        {
          bookId: chosen!.bookId,
          sectionId: chosen!.id,
          mappedPage,
          syncSpotlight: false,
        },
        thinLibrary,
      ).ok,
    ).toBe(true)
    expect(getStudentCurriculumBookStart('student-1', 'book-thin', thinLibrary)?.mappedPage).toBe(42)

    // Also: null mappedPage + no section hint must not wipe prior start.
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        { bookId: 'book-thin', sectionId: unitId, mappedPage: null, syncSpotlight: false },
        thinLibrary,
      ).ok,
    ).toBe(true)
    expect(getStudentCurriculumBookStart('student-1', 'book-thin', thinLibrary)?.mappedPage).toBe(42)
  })

  it('teaching sync updates mapped page when choosing a part with startPageHint', () => {
    const storyId = 'part:book-a:unit-1:lesson-1:part-story'
    const vocabId = 'part:book-a:unit-1:lesson-1:part-vocab'
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [
          sessionBase({
            id: 'class-next',
            title: 'Next',
            scheduledFor: '2026-06-01T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      }),
    ])
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        { bookId: 'book-a', sectionId: storyId, mappedPage: 42 },
        miniLibraryForHeadline,
      ).ok,
    ).toBe(true)
    expect(getStudentCurriculumBookStart('student-1', 'book-a', miniLibraryForHeadline)?.mappedPage).toBe(42)

    const options = getStudentSectionOptions('student-1', miniLibraryForHeadline)
    const chosen = options.find((o) => o.id === vocabId)
    expect(chosen).toBeTruthy()
    expect(chosen!.startPageHint).toBe(26)

    const existingStart = getStudentCurriculumBookStart('student-1', 'book-a', miniLibraryForHeadline)
    let mappedPage: number | null = null
    if (existingStart?.sectionId === chosen!.id && existingStart.mappedPage >= 1) {
      mappedPage = existingStart.mappedPage
    } else if (typeof chosen!.startPageHint === 'number' && chosen!.startPageHint >= 1) {
      mappedPage = Math.floor(chosen!.startPageHint)
    } else if (existingStart && existingStart.mappedPage >= 1) {
      mappedPage = existingStart.mappedPage
    }
    expect(mappedPage).toBe(26)
    expect(
      updateStudentClassSelectedSection('student-1', 'class-next', toStudentBookSectionRef(chosen!)).ok,
    ).toBe(true)
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        {
          bookId: chosen!.bookId,
          sectionId: chosen!.id,
          mappedPage,
          syncSpotlight: false,
        },
        miniLibraryForHeadline,
      ).ok,
    ).toBe(true)
    expect(getStudentCurriculumBookStart('student-1', 'book-a', miniLibraryForHeadline)).toMatchObject({
      sectionId: vocabId,
      mappedPage: 26,
    })
  })

  it('updateStudentCurriculumBookStart syncs spotlight class selectedSection', () => {
    const aId = 'part:book-a:unit-1:lesson-1:part-vocab'
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [
          sessionBase({
            id: 'class-next',
            title: 'Next',
            scheduledFor: '2026-06-01T10:00:00.000Z',
            status: 'planned',
            selectedSection: {
              id: 'part:book-a:unit-1:lesson-1:part-story',
              type: 'part',
              bookId: 'book-a',
              bookTitle: 'Test Book',
              unitId: 'unit-1',
              unitTitle: 'Unit 1',
              title: 'Story',
            },
          }),
        ],
      }),
    ])
    expect(getSpotlightClassSessionId('student-1')).toBe('class-next')
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        { bookId: 'book-a', sectionId: aId, mappedPage: 28 },
        miniLibraryForHeadline,
      ).ok,
    ).toBe(true)
    const row = getStudentScheduledClasses('student-1').find((s) => s.id === 'class-next')
    expect(row?.selectedSection?.id).toBe(aId)
    expect(row?.selectedSection?.title).toMatch(/Vocabulary/i)
  })

  it('updating next-class section can sync book starting place without overwriting spotlight twice', () => {
    const storyId = 'part:book-a:unit-1:lesson-1:part-story'
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [
          sessionBase({
            id: 'class-next',
            title: 'Next',
            scheduledFor: '2026-06-01T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      }),
    ])
    const options = getStudentSectionOptions('student-1', miniLibraryForHeadline)
    const story = options.find((o) => o.id === storyId)
    expect(story).toBeTruthy()
    expect(
      updateStudentClassSelectedSection('student-1', 'class-next', toStudentBookSectionRef(story!)).ok,
    ).toBe(true)
    expect(
      updateStudentCurriculumBookStart(
        'student-1',
        {
          bookId: 'book-a',
          sectionId: storyId,
          mappedPage: story!.startPageHint ?? null,
          syncSpotlight: false,
        },
        miniLibraryForHeadline,
      ).ok,
    ).toBe(true)
    const start = getStudentCurriculumBookStart('student-1', 'book-a', miniLibraryForHeadline)
    expect(start?.sectionId).toBe(storyId)
    expect(start?.mappedPage).toBe(story!.startPageHint)
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'book-a', 'unit-1', miniLibraryForHeadline)).toBe(
      story!.startPageHint,
    )
  })

  it('resolveNextSectionForClass prefers the most recently updated per-book start', () => {
    const planned = sessionBase({
      id: 'class-planned',
      title: 'Upcoming',
      scheduledFor: '2026-04-28T10:00:00.000Z',
      status: 'planned',
    })
    const twoBookLibrary: BookLibraryPayload = {
      books: [
        miniLibraryForHeadline.books[0]!,
        {
          id: 'book-b',
          title: 'Second Book',
          units: [
            {
              id: 'unit-b1',
              title: 'Unit B',
              filePath: '/b.pdf',
              lessons: [
                {
                  id: 'lesson-b1',
                  title: 'Lesson B',
                  parts: [
                    { id: 'part-b-story', title: 'Story B', startPageHint: 40, endPageHint: 50 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const aId = 'part:book-a:unit-1:lesson-1:part-story'
    const bId = 'part:book-b:unit-b1:lesson-b1:part-b-story'
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a', 'book-b'],
        assignedUnitRefs: [
          { bookId: 'book-a', unitId: 'unit-1' },
          { bookId: 'book-b', unitId: 'unit-b1' },
        ],
        curriculumBookStarts: {
          'book-a': {
            sectionId: aId,
            unitId: 'unit-1',
            mappedPage: 12,
            updatedAt: '2026-04-01T10:00:00.000Z',
          },
          'book-b': {
            sectionId: bId,
            unitId: 'unit-b1',
            mappedPage: 42,
            updatedAt: '2026-04-10T10:00:00.000Z',
          },
        },
        scheduledClasses: [planned],
      }),
    ])
    const next = resolveNextSectionForClass('student-1', 'class-planned', twoBookLibrary)
    expect(next?.id).toBe(bId)
  })

  it('getStudentResumePdfPageForBookUnit picks the newer of class bookmark vs reader history', () => {
    const olderClass = sessionBase({
      id: 'class-old',
      title: 'Old',
      scheduledFor: '2026-04-01T10:00:00.000Z',
      status: 'completed',
      classEndedAt: '2026-04-01T11:00:00.000Z',
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 40, unitId: 'unit-1' },
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [olderClass],
        curriculumHistory: [
          {
            id: 'h1',
            bookId: 'book-a',
            unitId: 'unit-1',
            page: 12,
            openedAt: '2026-04-15T10:00:00.000Z',
            closedAt: '2026-04-20T10:00:00.000Z',
          },
        ],
      }),
    ])
    expect(getStudentResumePdfPageForBookUnit('student-1', 'book-a', 'unit-1')).toBe(12)
  })

  it('getStudentResumePdfPageForBookUnit prefers newer class bookmark over older reader history', () => {
    const newerClass = sessionBase({
      id: 'class-new',
      title: 'New',
      scheduledFor: '2026-05-10T10:00:00.000Z',
      status: 'completed',
      classEndedAt: '2026-05-10T11:00:00.000Z',
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 55, unitId: 'unit-1' },
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [newerClass],
        curriculumHistory: [
          {
            id: 'h1',
            bookId: 'book-a',
            unitId: 'unit-1',
            page: 12,
            openedAt: '2026-04-15T10:00:00.000Z',
            closedAt: '2026-04-20T10:00:00.000Z',
          },
        ],
      }),
    ])
    expect(getStudentResumePdfPageForBookUnit('student-1', 'book-a', 'unit-1')).toBe(55)
  })

  it('getStudentTeachingOpenPdfPageForBookUnit prefers plan pin over older browse history', () => {
    const library: BookLibraryPayload = {
      books: [
        {
          id: 'book-a',
          title: 'Test Book',
          units: [
            {
              id: 'unit-1',
              title: 'Unit 1',
              filePath: '/u1.pdf',
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'Lesson 1',
                  startPageHint: 10,
                  parts: [{ id: 'part-a', title: 'Part A', startPageHint: 10 }],
                },
              ],
            },
          ],
        },
      ],
    }
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        curriculumHistory: [
          {
            id: 'h1',
            bookId: 'book-a',
            unitId: 'unit-1',
            page: 1,
            openedAt: '2026-04-15T10:00:00.000Z',
            closedAt: '2026-04-20T10:00:00.000Z',
          },
        ],
      }),
    ])
    const options = getStudentSectionOptions('student-1', library)
    const part = options.find((o) => o.partId === 'part-a')
    expect(part).toBeTruthy()
    updateStudentCurriculumBookStart(
      'student-1',
      { bookId: 'book-a', sectionId: part!.id, mappedPage: 10 },
      library,
    )
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'book-a', 'unit-1', library)).toBe(10)
    expect(getStudentResumePdfPageForBookUnit('student-1', 'book-a', 'unit-1')).toBe(1)
  })

  it('getStudentTeachingOpenPdfPageForBookUnit prefers newer last-class bookmark over older plan pin', () => {
    const library: BookLibraryPayload = {
      books: [
        {
          id: 'book-a',
          title: 'Test Book',
          units: [
            {
              id: 'unit-1',
              title: 'Unit 1',
              filePath: '/u1.pdf',
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'Lesson 1',
                  startPageHint: 10,
                  parts: [{ id: 'part-a', title: 'Part A', startPageHint: 10 }],
                },
              ],
            },
          ],
        },
      ],
    }
    const optionsSeed = (() => {
      saveStudents([
        seedStudent({
          assignedBookIds: ['book-a'],
          assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        }),
      ])
      return getStudentSectionOptions('student-1', library)
    })()
    const part = optionsSeed.find((o) => o.partId === 'part-a')
    expect(part).toBeTruthy()
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        curriculumBookStarts: {
          'book-a': {
            sectionId: part!.id,
            unitId: 'unit-1',
            mappedPage: 10,
            updatedAt: '2026-04-01T10:00:00.000Z',
          },
        },
        scheduledClasses: [
          sessionBase({
            id: 'class-done',
            title: 'Done',
            scheduledFor: '2026-05-10T10:00:00.000Z',
            status: 'completed',
            classEndedAt: '2026-05-10T11:00:00.000Z',
            bookmarkAtEnd: { bookId: 'book-a', pdfPage: 42, unitId: 'unit-1' },
          }),
        ],
      }),
    ])
    expect(getStudentLastClassBookmarkPdfPageForBookUnit('student-1', 'book-a', 'unit-1')).toBe(42)
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'book-a', 'unit-1', library)).toBe(42)
    expect(isStudentCurriculumBookStartFresherThanLastStop('student-1', 'book-a', library)).toBe(false)
  })

  it('getStudentTeachingOpenPdfPageForBookUnit prefers newer plan pin over older last-class bookmark', () => {
    const library: BookLibraryPayload = {
      books: [
        {
          id: 'book-a',
          title: 'Test Book',
          units: [
            {
              id: 'unit-1',
              title: 'Unit 1',
              filePath: '/u1.pdf',
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'Lesson 1',
                  startPageHint: 10,
                  parts: [{ id: 'part-a', title: 'Part A', startPageHint: 10 }],
                },
              ],
            },
          ],
        },
      ],
    }
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [
          sessionBase({
            id: 'class-done',
            title: 'Done',
            scheduledFor: '2026-05-10T10:00:00.000Z',
            status: 'completed',
            classEndedAt: '2026-05-10T11:00:00.000Z',
            bookmarkAtEnd: { bookId: 'book-a', pdfPage: 42, unitId: 'unit-1' },
          }),
        ],
      }),
    ])
    const options = getStudentSectionOptions('student-1', library)
    const part = options.find((o) => o.partId === 'part-a')
    expect(part).toBeTruthy()
    updateStudentCurriculumBookStart(
      'student-1',
      { bookId: 'book-a', sectionId: part!.id, mappedPage: 28 },
      library,
    )
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'book-a', 'unit-1', library)).toBe(28)
    expect(isStudentCurriculumBookStartFresherThanLastStop('student-1', 'book-a', library)).toBe(true)
  })

  it('getStudentOpenTargetForBook uses starting-place unit when fresher than last stop', () => {
    const library: BookLibraryPayload = {
      books: [
        {
          id: 'book-a',
          title: 'Test Book',
          units: [
            {
              id: 'unit-1',
              title: 'Unit 1',
              filePath: '/u1.pdf',
              lessons: [{ id: 'lesson-1', title: 'Lesson 1', parts: [{ id: 'part-a', title: 'Part A' }] }],
            },
            {
              id: 'unit-2',
              title: 'Unit 2',
              filePath: '/u2.pdf',
              lessons: [
                {
                  id: 'lesson-2',
                  title: 'Lesson 2',
                  startPageHint: 5,
                  parts: [{ id: 'part-b', title: 'Part B', startPageHint: 5 }],
                },
              ],
            },
          ],
        },
      ],
    }
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [
          sessionBase({
            id: 'class-old',
            title: 'Old',
            scheduledFor: '2026-04-01T10:00:00.000Z',
            status: 'completed',
            classEndedAt: '2026-04-01T11:00:00.000Z',
            bookmarkAtEnd: { bookId: 'book-a', pdfPage: 1, unitId: 'unit-1' },
          }),
        ],
      }),
    ])
    const options = getStudentSectionOptions('student-1', library)
    const partB = options.find((o) => o.partId === 'part-b')
    expect(partB).toBeTruthy()
    updateStudentCurriculumBookStart(
      'student-1',
      { bookId: 'book-a', sectionId: partB!.id, mappedPage: 5 },
      library,
    )
    expect(getStudentOpenTargetForBook('student-1', 'book-a', library)).toEqual({
      unitId: 'unit-2',
      pdfPage: 5,
    })
    expect(getStudentDefaultBookUnitForReader('student-1', library)).toEqual({
      bookId: 'book-a',
      unitId: 'unit-2',
    })
  })

  it('getStudentTeachingOpenPdfPageForBookUnit ignores weak page-1 last stop when plan pin is deeper', () => {
    const library: BookLibraryPayload = {
      books: [
        {
          id: 'book-a',
          title: 'Test Book',
          units: [
            {
              id: 'unit-1',
              title: 'Unit 1',
              filePath: '/u1.pdf',
              lessons: [{ id: 'lesson-1', title: 'Lesson 1', parts: [{ id: 'part-a', title: 'Part A' }] }],
            },
          ],
        },
      ],
    }
    const optionsSeed = (() => {
      saveStudents([
        seedStudent({
          assignedBookIds: ['book-a'],
          assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        }),
      ])
      return getStudentSectionOptions('student-1', library)
    })()
    const part = optionsSeed.find((o) => o.partId === 'part-a')
    expect(part).toBeTruthy()
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        curriculumBookStarts: {
          'book-a': {
            sectionId: part!.id,
            unitId: 'unit-1',
            mappedPage: 120,
            updatedAt: '2026-04-01T10:00:00.000Z',
          },
        },
        scheduledClasses: [
          sessionBase({
            id: 'class-done',
            title: 'Done',
            scheduledFor: '2026-05-10T10:00:00.000Z',
            status: 'completed',
            classEndedAt: '2026-05-10T11:00:00.000Z',
            bookmarkAtEnd: { bookId: 'book-a', pdfPage: 1 },
          }),
        ],
      }),
    ])
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'book-a', 'unit-1', library)).toBe(120)
    expect(isStudentCurriculumBookStartFresherThanLastStop('student-1', 'book-a', library)).toBe(true)
    expect(getStudentOpenTargetForBook('student-1', 'book-a', library)).toEqual({
      unitId: 'unit-1',
      pdfPage: 120,
    })
  })

  it('resolveClassEndBookmark prefers last viewed reader page over section hints', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    saveUnitPage('book-a', 'unit-1', 88)
    const bookmark = resolveClassEndBookmark(
      'student-1',
      {
        selectedSection: {
          id: 'sec-1',
          type: 'lesson',
          bookId: 'book-a',
          bookTitle: 'Book A',
          unitId: 'unit-1',
          unitTitle: 'Unit 1',
          title: 'Lesson',
          startPageHint: 12,
          endPageHint: 14,
        },
      },
      ['book-a'],
    )
    expect(bookmark).toEqual({ bookId: 'book-a', pdfPage: 88, unitId: 'unit-1' })
  })

  it('resolveClassEndBookmark falls back to section end hint when no reader page was saved', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    const bookmark = resolveClassEndBookmark(
      'student-1',
      {
        selectedSection: {
          id: 'sec-1',
          type: 'lesson',
          bookId: 'book-a',
          bookTitle: 'Book A',
          unitId: 'unit-1',
          unitTitle: 'Unit 1',
          title: 'Lesson',
          startPageHint: 12,
          endPageHint: 14,
        },
      },
      ['book-a'],
    )
    expect(bookmark).toEqual({ bookId: 'book-a', pdfPage: 14, unitId: 'unit-1' })
  })

  it('resolveClassTeachingBookUnit uses saved selectedSection book and unit', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [
          sessionBase({
            id: 'class-plan',
            title: 'Plan',
            scheduledFor: '2026-05-01T10:00:00.000Z',
            status: 'planned',
            selectedSection: {
              id: 'sec-1',
              type: 'unit',
              bookId: 'book-a',
              bookTitle: 'Test Book',
              unitId: 'unit-1',
              unitTitle: 'Unit 1',
              title: 'Unit 1',
            },
          }),
        ],
      }),
    ])
    const resolved = resolveClassTeachingBookUnit('student-1', 'class-plan', null)
    expect(resolved).toEqual({ bookId: 'book-a', unitId: 'unit-1', section: null })
  })

  it('getStudentSectionOptions includes all units from assigned books even when unit refs pin one unit', () => {
    const multiUnitLibrary: BookLibraryPayload = {
      books: [
        {
          id: 'book-a',
          title: 'Test Book',
          units: [
            {
              id: 'unit-1',
              title: 'Unit 1',
              filePath: '/u1.pdf',
              lessons: [{ id: 'lesson-1', title: 'Lesson 1', parts: [{ id: 'part-a', title: 'Part A' }] }],
            },
            {
              id: 'unit-2',
              title: 'Unit 2',
              filePath: '/u2.pdf',
              lessons: [{ id: 'lesson-2', title: 'Lesson 2', parts: [{ id: 'part-b', title: 'Part B' }] }],
            },
          ],
        },
      ],
    }
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    const options = getStudentSectionOptions('student-1', multiUnitLibrary)
    expect(options.some((o) => o.unitId === 'unit-1')).toBe(true)
    expect(options.some((o) => o.unitId === 'unit-2')).toBe(true)
  })

  it('getStudentDefaultBookUnitForReader returns first assigned unit ref present in library', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    expect(getStudentDefaultBookUnitForReader('student-1', miniLibraryForHeadline)).toEqual({
      bookId: 'book-a',
      unitId: 'unit-1',
    })
  })

  it('getStudentDefaultBookUnitForReader skips refs missing from library', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [
          { bookId: 'ghost-book', unitId: 'unit-x' },
          { bookId: 'book-a', unitId: 'unit-1' },
        ],
      }),
    ])
    expect(getStudentDefaultBookUnitForReader('student-1', miniLibraryForHeadline)).toEqual({
      bookId: 'book-a',
      unitId: 'unit-1',
    })
  })

  it('getStudentDefaultBookUnitForReader falls back to first unit of first assigned book', () => {
    saveStudents([seedStudent({ assignedBookIds: ['book-a'], assignedUnitRefs: [] })])
    expect(getStudentDefaultBookUnitForReader('student-1', miniLibraryForHeadline)).toEqual({
      bookId: 'book-a',
      unitId: 'unit-1',
    })
  })

  it('getStudentDefaultBookUnitForReader returns null when nothing matches', () => {
    saveStudents([seedStudent({ assignedBookIds: ['ghost-book'], assignedUnitRefs: [] })])
    expect(getStudentDefaultBookUnitForReader('student-1', miniLibraryForHeadline)).toBeNull()
  })

  it('resolveNextSectionForClass falls back to first option when anchor id does not match any section', () => {
    const planned = sessionBase({
      id: 'class-planned',
      title: 'Upcoming',
      scheduledFor: '2026-04-28T10:00:00.000Z',
      status: 'planned',
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        curriculumAnchorSectionId: 'not-a-real-section-id',
        scheduledClasses: [planned],
      }),
    ])
    const next = resolveNextSectionForClass('student-1', 'class-planned', miniLibraryForHeadline)
    expect(next?.id).toBe('part:book-a:unit-1:lesson-1:part-story')
  })

  it('getTodaysClassSessionsForTeacher lists planned classes on the given local calendar day', () => {
    const june15 = new Date(2026, 5, 15, 9, 0, 0)
    const planned = sessionBase({
      id: 'class-today',
      title: 'Morning lesson',
      scheduledFor: '2026-06-15T10:00',
      status: 'planned',
    })
    const doneSameDay = sessionBase({
      id: 'class-done-today',
      title: 'Earlier',
      scheduledFor: '2026-06-15T08:00',
      status: 'completed',
    })
    saveStudents([seedStudent({ scheduledClasses: [planned, doneSameDay] })])
    const rows = getTodaysClassSessionsForTeacher(june15)
    expect(rows.map((r) => r.session.id)).toEqual(['class-today'])
    expect(rows[0]?.studentName).toBe('Lina')
  })

  it('getTodaysCompletedClassSessionsForTeacher lists completed classes on the local day', () => {
    const june15 = new Date(2026, 5, 15, 18, 0, 0)
    const doneToday = sessionBase({
      id: 'class-done-today',
      title: 'Morning',
      scheduledFor: '2026-06-15T08:00',
      status: 'completed',
      classEndedAt: '2026-06-15T08:45',
    })
    const doneYesterday = sessionBase({
      id: 'class-done-yesterday',
      title: 'Prior',
      scheduledFor: '2026-06-14T08:00',
      status: 'completed',
      classEndedAt: '2026-06-14T08:45',
    })
    const stillOpen = sessionBase({
      id: 'class-open',
      title: 'Later',
      scheduledFor: '2026-06-15T16:00',
      status: 'planned',
    })
    saveStudents([seedStudent({ scheduledClasses: [doneToday, doneYesterday, stillOpen] })])
    const rows = getTodaysCompletedClassSessionsForTeacher(june15)
    expect(rows.map((r) => r.session.id)).toEqual(['class-done-today'])
  })

  it('getDashboardStillOpenItems filters recap dismiss, prep window, and missed', () => {
    const now = new Date(2026, 5, 15, 12, 0, 0)
    const nowMs = now.getTime()
    const needsRecap = sessionBase({
      id: 'recap-open',
      title: 'Needs note',
      scheduledFor: '2026-06-14T10:00',
      status: 'completed',
      classEndedAt: '2026-06-14T10:45',
    })
    const recapDismissed = sessionBase({
      id: 'recap-skip',
      title: 'Skipped',
      scheduledFor: '2026-06-13T10:00',
      status: 'completed',
      classEndedAt: '2026-06-13T10:45',
      postClassRecapPromptDismissed: true,
    })
    const recapTooOld = sessionBase({
      id: 'recap-old',
      title: 'Old',
      scheduledFor: '2026-06-01T10:00',
      status: 'completed',
      classEndedAt: '2026-06-01T10:45',
    })
    const missed = sessionBase({
      id: 'missed-1',
      title: 'No-show',
      scheduledFor: '2026-06-10T09:00',
      status: 'missed',
    })
    const prepToday = sessionBase({
      id: 'prep-today',
      title: 'Today',
      scheduledFor: '2026-06-15T15:00',
      status: 'planned',
    })
    const prepTomorrow = sessionBase({
      id: 'prep-tomorrow',
      title: 'Tomorrow',
      scheduledFor: '2026-06-16T10:00',
      status: 'planned',
    })
    const prepLater = sessionBase({
      id: 'prep-later',
      title: 'Wednesday',
      scheduledFor: '2026-06-17T10:00',
      status: 'planned',
    })
    const prepared = sessionBase({
      id: 'prep-ready',
      title: 'Ready',
      scheduledFor: '2026-06-15T17:00',
      status: 'prepared',
    })
    saveStudents([
      seedStudent({
        scheduledClasses: [
          needsRecap,
          recapDismissed,
          recapTooOld,
          missed,
          prepToday,
          prepTomorrow,
          prepLater,
          prepared,
        ],
      }),
    ])
    const items = getDashboardStillOpenItems(nowMs)
    expect(items.map((i) => `${i.kind}:${i.session.id}`)).toEqual([
      'missed:missed-1',
      'needs_recap:recap-open',
      'needs_prep:prep-today',
      'needs_prep:prep-tomorrow',
    ])
    expect(sessionNeedsPostClassRecap(needsRecap)).toBe(true)
    expect(sessionNeedsPostClassRecap(recapDismissed)).toBe(false)
  })

  it('pickDashboardNowRow prefers live over upcoming', () => {
    const nowMs = new Date(2026, 5, 15, 10, 15, 0).getTime()
    const upcoming = sessionBase({
      id: 'upcoming',
      title: 'Later',
      scheduledFor: '2026-06-15T14:00',
      status: 'planned',
    })
    const live = sessionBase({
      id: 'live',
      title: 'Now',
      scheduledFor: '2026-06-15T10:00',
      status: 'in_progress',
      durationMin: 45,
    })
    const picked = pickDashboardNowRow(
      [
        { studentId: 'student-1', studentName: 'Lina', session: upcoming },
        { studentId: 'student-1', studentName: 'Lina', session: live },
      ],
      nowMs,
    )
    expect(picked?.session.id).toBe('live')
  })

  it('updateStudentClassEndNote saves recap on completed class', () => {
    const done = sessionBase({
      id: 'class-done',
      title: 'Past',
      scheduledFor: '2026-04-21T10:00:00.000Z',
      status: 'completed',
    })
    saveStudents([seedStudent({ scheduledClasses: [done] })])
    const r = updateStudentClassEndNote('student-1', 'class-done', '  Great wrap  ')
    expect(r.ok).toBe(true)
    const row = getStudents()[0]?.scheduledClasses?.find((s) => s.id === 'class-done')
    expect(row?.classEndNote).toBe('Great wrap')
    expect(row?.postClassRecapPromptDismissed).toBe(true)
  })

  it('endStudentClassSession stores optional sessionNote', () => {
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
      }),
    ])
    const created = upsertStudentClassSession('student-1', {
      title: 'Live',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    expect(
      endStudentClassSession('student-1', created.session.id, {
        sessionNote: '  Pages 5â€“10 Â· next: grammar drill  ',
        bookmarkAtEnd: { bookId: 'book-a', pdfPage: 3, unitId: 'unit-1' },
      }).ok,
    ).toBe(true)
    const row = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    expect(row?.sessionNote).toBe('Pages 5â€“10 Â· next: grammar drill')
  })

  it('updateStudentClassSessionNote saves and clears session log on completed class', () => {
    const done = sessionBase({
      id: 'class-log',
      title: 'Past',
      scheduledFor: '2026-04-21T10:00:00.000Z',
      status: 'completed',
      sessionNote: 'Initial',
    })
    saveStudents([seedStudent({ scheduledClasses: [done] })])
    expect(updateStudentClassSessionNote('student-1', 'class-log', ' Expanded notes ').ok).toBe(true)
    let row = getStudents()[0]?.scheduledClasses?.find((s) => s.id === 'class-log')
    expect(row?.sessionNote).toBe('Expanded notes')
    expect(updateStudentClassSessionNote('student-1', 'class-log', '   ').ok).toBe(true)
    row = getStudents()[0]?.scheduledClasses?.find((s) => s.id === 'class-log')
    expect(row?.sessionNote).toBeUndefined()
  })

  it('dismissPostClassRecapPrompt marks completed class without adding text', () => {
    const done = sessionBase({
      id: 'class-skip',
      title: 'Past',
      scheduledFor: '2026-04-22T10:00:00.000Z',
      status: 'completed',
    })
    saveStudents([seedStudent({ scheduledClasses: [done] })])
    expect(dismissPostClassRecapPrompt('student-1', 'class-skip').ok).toBe(true)
    const row = getStudents()[0]?.scheduledClasses?.find((s) => s.id === 'class-skip')
    expect(row?.postClassRecapPromptDismissed).toBe(true)
  })

  it('startStudentClassSession rejects completed and cancelled classes', () => {
    saveStudents([seedStudent()])
    const done = upsertStudentClassSession('student-1', {
      title: 'Done',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return
    transitionStudentClassStatus('student-1', done.session.id, 'completed')
    const restart = startStudentClassSession('student-1', done.session.id)
    expect(restart.ok).toBe(false)
    if (restart.ok) return
    expect(restart.error).toMatch(/cannot be started/i)

    const cancelled = upsertStudentClassSession('student-1', {
      title: 'Off',
      scheduledFor: '2026-04-27T09:00',
      durationMin: 45,
    })
    expect(cancelled.ok).toBe(true)
    if (!cancelled.ok) return
    transitionStudentClassStatus('student-1', cancelled.session.id, 'cancelled')
    const startCancelled = startStudentClassSession('student-1', cancelled.session.id)
    expect(startCancelled.ok).toBe(false)
  })
})
