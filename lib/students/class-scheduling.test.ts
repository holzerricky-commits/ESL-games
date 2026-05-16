import { beforeEach, describe, expect, it } from 'vitest'
import { saveReaderProgressMap } from '@/lib/books/progress'
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
  startStudentClassSession,
  endStudentClassSession,
  getNextClassResumeHeadline,
  getStudentResumePdfPageForBookUnit,
  getStudentDefaultBookUnitForReader,
  getTodaysClassSessionsForTeacher,
  dismissPostClassRecapPrompt,
  updateStudentClassEndNote,
  updateStudentClassSessionNote,
  resolveNextSectionForClass,
  updateStudentClassSelectedSection,
  upsertStudentClassLessonNotebookDoc,
  upsertStudentClassLessonNotebookOverlayImages,
  ensureStudentClassLessonNotebookPageSpanSection,
  buildNotebookPageSpanKey,
  upsertStudentClassLessonNotebookSectionTocAnchor,
} from '@/lib/students/selectors'
import type { BookLibraryPayload } from '@/lib/books/types'
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

  it('startStudentClassSession auto-creates one lesson notebook session with header entry', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Notebook class',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const selected = updateStudentClassSelectedSection('student-1', created.session.id, {
      id: 'part:book-a:unit-1:lesson-1:part-1',
      type: 'part',
      bookId: 'book-a',
      bookTitle: 'Test Book',
      unitId: 'unit-1',
      unitTitle: 'Unit 1',
      title: 'Part 1',
      startPageHint: 33,
      endPageHint: 34,
    })
    expect(selected.ok).toBe(true)
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const row = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    const notebook = row?.lessonNotebookSession
    expect(notebook?.classSessionId).toBe(created.session.id)
    expect(notebook?.sections).toHaveLength(1)
    expect(notebook?.sections[0]?.anchorKey).toBe('p33-34')
    const headerPayload = notebook?.sections[0]?.entries?.[0]?.payload as
      | { title?: string; pageLabel?: string; lessonPartLabel?: string }
      | undefined
    expect(headerPayload?.title).toBe('Part 1')
    expect(headerPayload?.pageLabel).toBe('33-34')
    expect(headerPayload?.lessonPartLabel).toBe('Part 1')
  })

  it('upsertStudentClassLessonNotebookDoc saves rich text html into notebook doc layer', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Notebook class',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const firstSession = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    const firstSectionId = firstSession?.lessonNotebookSession?.sections?.[0]?.sectionId
    expect(firstSectionId).toBeTruthy()
    if (!firstSectionId) return
    const saved = upsertStudentClassLessonNotebookDoc('student-1', created.session.id, {
      sectionId: firstSectionId,
      html: '<h3>Warm-up</h3><ul><li>river</li><li>forest</li></ul>',
    })
    expect(saved.ok).toBe(true)
    const updatedSession = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    const docEntry = updatedSession?.lessonNotebookSession?.sections?.[0]?.entries?.find(
      (entry) => entry.payload?.kind === 'doc_richtext',
    )
    expect(docEntry?.payload?.html).toContain('<h3>Warm-up</h3>')
  })

  it('upsertStudentClassLessonNotebookDoc stores lightweight doc snapshots on successive saves', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Notebook class',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const sectionId = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
      ?.lessonNotebookSession?.sections?.[0]?.sectionId
    expect(sectionId).toBeTruthy()
    if (!sectionId) return

    const first = upsertStudentClassLessonNotebookDoc('student-1', created.session.id, {
      sectionId,
      html: '<p>Version 1</p>',
    })
    expect(first.ok).toBe(true)
    const second = upsertStudentClassLessonNotebookDoc('student-1', created.session.id, {
      sectionId,
      html: '<p>Version 2</p>',
      clientDocUpdatedAt: first.ok ? first.docUpdatedAt : undefined,
    })
    expect(second.ok).toBe(true)

    const session = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    const history = session?.lessonNotebookSession?.sections?.[0]?.entries?.find(
      (entry) => entry.payload?.kind === 'doc_history',
    )
    const snapshots = (history?.payload?.snapshots as Array<{ html?: string }> | undefined) ?? []
    expect(snapshots.length).toBeGreaterThan(0)
    expect(snapshots[0]?.html).toContain('Version 1')
  })

  it('upsertStudentClassLessonNotebookDoc returns conflict when client revision is stale', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Notebook class',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const sectionId = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
      ?.lessonNotebookSession?.sections?.[0]?.sectionId
    expect(sectionId).toBeTruthy()
    if (!sectionId) return

    const first = upsertStudentClassLessonNotebookDoc('student-1', created.session.id, {
      sectionId,
      html: '<p>Teacher version</p>',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = upsertStudentClassLessonNotebookDoc('student-1', created.session.id, {
      sectionId,
      html: '<p>Teacher version 2</p>',
      clientDocUpdatedAt: first.docUpdatedAt,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return

    const conflict = upsertStudentClassLessonNotebookDoc('student-1', created.session.id, {
      sectionId,
      html: '<p>Stale client attempt</p>',
      clientDocUpdatedAt: '1999-01-01T00:00:00.000Z',
    })
    expect(conflict.ok).toBe(false)
    if (conflict.ok) return
    expect(conflict.conflict).toBe(true)
    expect(conflict.latestHtml).toContain('Teacher version 2')
  })

  it('upsertStudentClassLessonNotebookOverlayImages saves overlay images with normalized positions', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Notebook class',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const sectionId = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
      ?.lessonNotebookSession?.sections?.[0]?.sectionId
    expect(sectionId).toBeTruthy()
    if (!sectionId) return
    const saved = upsertStudentClassLessonNotebookOverlayImages('student-1', created.session.id, {
      sectionId,
      images: [
        {
          id: 'img-1',
          src: 'data:image/png;base64,abc',
          xNorm: 0.12,
          yNorm: 0.2,
          widthNorm: 0.4,
        },
      ],
    })
    expect(saved.ok).toBe(true)
    const session = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    const overlayEntry = session?.lessonNotebookSession?.sections?.[0]?.entries?.find(
      (entry) => entry.layer === 'overlay' && entry.payload?.kind === 'overlay_images',
    )
    const firstImage = (overlayEntry?.payload?.images as Array<{ id: string }> | undefined)?.[0]
    expect(firstImage?.id).toBe('img-1')
  })

  it('buildNotebookPageSpanKey creates stable page span keys', () => {
    expect(buildNotebookPageSpanKey(33, 34)).toBe('p33-34')
    expect(buildNotebookPageSpanKey(35, null)).toBe('p35')
  })

  it('ensureStudentClassLessonNotebookPageSpanSection creates missing page span section once', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Notebook class',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const first = ensureStudentClassLessonNotebookPageSpanSection('student-1', created.session.id, {
      pageSpanKey: 'p35-36',
      title: 'Reading Part',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = ensureStudentClassLessonNotebookPageSpanSection('student-1', created.session.id, {
      pageSpanKey: 'p35-36',
      title: 'Reading Part',
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.sectionId).toBe(first.sectionId)
    const session = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    const keys =
      session?.lessonNotebookSession?.sections
        ?.filter((section) => section.anchorType === 'page_span')
        .map((section) => section.anchorKey) ?? []
    expect(keys.filter((key) => key === 'p35-36')).toHaveLength(1)
  })

  it('upsertStudentClassLessonNotebookSectionTocAnchor re-anchors section to selected TOC part', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Notebook class',
      scheduledFor: '2026-04-25T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const ensured = ensureStudentClassLessonNotebookPageSpanSection('student-1', created.session.id, {
      pageSpanKey: 'p33-34',
      title: 'Reading',
    })
    expect(ensured.ok).toBe(true)
    if (!ensured.ok) return
    const updated = upsertStudentClassLessonNotebookSectionTocAnchor(
      'student-1',
      created.session.id,
      ensured.sectionId,
      {
        tocPartKey: 'lesson-1::part-2',
        breadcrumb: 'Unit 1 > Reading > p33-34',
        title: 'Reading',
      },
    )
    expect(updated.ok).toBe(true)
    const session = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    const section = session?.lessonNotebookSession?.sections.find((s) => s.sectionId === ensured.sectionId)
    const header = section?.entries.find((entry) => entry.payload?.kind === 'header_block')
    expect(header?.payload?.tocPartKey).toBe('lesson-1::part-2')
    expect(header?.payload?.breadcrumb).toBe('Unit 1 > Reading > p33-34')
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
    const firstNotebookId = getStudentProfileView('student-1')?.scheduledClasses.find(
      (s) => s.id === created.session.id,
    )?.lessonNotebookSession?.sessionId
    expect(startStudentClassSession('student-1', created.session.id).ok).toBe(true)
    const secondNotebookId = getStudentProfileView('student-1')?.scheduledClasses.find(
      (s) => s.id === created.session.id,
    )?.lessonNotebookSession?.sessionId
    expect(secondNotebookId).toBe(firstNotebookId)
  })

  it('startStudentClassSession refuses when another class is already in progress', () => {
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
    const blocked = startStudentClassSession('student-1', b.session.id)
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.error).toMatch(/already in progress/i)
    const profile = getStudentProfileView('student-1')
    expect(profile?.scheduledClasses.find((s) => s.id === b.session.id)?.status).not.toBe('in_progress')
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
    const row = profile?.scheduledClasses.find((s) => s.id === created.session.id)
    expect(row?.bookmarkAtEnd).toEqual({ bookId: 'book-a', pdfPage: 5, unitId: 'unit-resolved' })
    expect(profile?.curriculumHistory?.[0]).toMatchObject({
      bookId: 'book-a',
      unitId: 'unit-resolved',
      page: 5,
    })
  })

  it('endStudentClassSession saves the live reader page when it changed during class', () => {
    const live = sessionBase({
      id: 'class-live',
      title: 'Live',
      scheduledFor: '2026-04-25T09:00:00.000Z',
      status: 'in_progress',
      classStartedAt: '2026-04-25T09:00:00.000Z',
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [live],
      }),
    ])
    saveReaderProgressMap({
      'book-a': {
        'unit-1': {
          page: 22,
          updatedAt: '2026-04-25T09:30:00.000Z',
        },
      },
    })

    const ended = endStudentClassSession('student-1', 'class-live', {
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 1, unitId: 'unit-1' },
    })

    expect(ended.ok).toBe(true)
    const profile = getStudentProfileView('student-1')
    const row = profile?.scheduledClasses.find((s) => s.id === 'class-live')
    expect(row?.bookmarkAtEnd).toEqual({ bookId: 'book-a', pdfPage: 22, unitId: 'unit-1' })
    expect(profile?.curriculumHistory?.[0]).toMatchObject({
      bookId: 'book-a',
      unitId: 'unit-1',
      page: 22,
    })
  })

  it('endStudentClassSession does not use reader progress saved before class started', () => {
    const live = sessionBase({
      id: 'class-live',
      title: 'Live',
      scheduledFor: '2026-04-25T09:00:00.000Z',
      status: 'in_progress',
      classStartedAt: '2026-04-25T09:00:00.000Z',
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [{ bookId: 'book-a', unitId: 'unit-1' }],
        scheduledClasses: [live],
      }),
    ])
    saveReaderProgressMap({
      'book-a': {
        'unit-1': {
          page: 22,
          updatedAt: '2026-04-24T09:30:00.000Z',
        },
      },
    })

    const ended = endStudentClassSession('student-1', 'class-live', {
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 5, unitId: 'unit-1' },
    })

    expect(ended.ok).toBe(true)
    const profile = getStudentProfileView('student-1')
    const row = profile?.scheduledClasses.find((s) => s.id === 'class-live')
    expect(row?.bookmarkAtEnd).toEqual({ bookId: 'book-a', pdfPage: 5, unitId: 'unit-1' })
    expect(profile?.curriculumHistory?.[0]).toMatchObject({
      bookId: 'book-a',
      unitId: 'unit-1',
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

  it('getStudentResumePdfPageForBookUnit ignores book-only bookmarks for unit-specific resume', () => {
    const bookOnlyClass = sessionBase({
      id: 'class-book-only',
      title: 'Past',
      scheduledFor: '2026-05-10T10:00:00.000Z',
      status: 'completed',
      classEndedAt: '2026-05-10T11:00:00.000Z',
      bookmarkAtEnd: { bookId: 'book-a', pdfPage: 55 },
    })
    saveStudents([
      seedStudent({
        assignedBookIds: ['book-a'],
        assignedUnitRefs: [
          { bookId: 'book-a', unitId: 'unit-1' },
          { bookId: 'book-a', unitId: 'unit-2' },
        ],
        scheduledClasses: [bookOnlyClass],
      }),
    ])
    expect(getStudentResumePdfPageForBookUnit('student-1', 'book-a', 'unit-2')).toBeNull()
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
        sessionNote: '  Pages 5–10 · next: grammar drill  ',
        bookmarkAtEnd: { bookId: 'book-a', pdfPage: 3, unitId: 'unit-1' },
      }).ok,
    ).toBe(true)
    const row = getStudentProfileView('student-1')?.scheduledClasses.find((s) => s.id === created.session.id)
    expect(row?.sessionNote).toBe('Pages 5–10 · next: grammar drill')
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
