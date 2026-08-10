import type {
  Quiz,
  StudentResult,
  AnimationSettings,
  KnownStudentSummary,
  StudentProgressRecord,
  StudentRecord,
} from './types'
import { removeAnnotationsForStudent } from './books/annotation-storage'
import { removeStudentAnnotationToolPrefs } from './books/student-annotation-tool-prefs'
import {
  getCachedStudentProgress,
  getCachedStudents,
  isStudentRecordsDiskActive,
  setCachedStudentProgress,
  setCachedStudents,
} from './local-data/student-records-client'
import {
  getChallengeDataDiskCache,
  isChallengeDataDiskActive,
  QUIZZES_KEY as CHALLENGE_QUIZZES_KEY,
  RESULTS_KEY as CHALLENGE_RESULTS_KEY,
  setQuizzesOnDiskCache,
  setResultsOnDiskCache,
} from './local-data/challenge-data-disk-client'
import { removeLessonBoardLinksForStudent } from './local-data/lesson-board-links-disk-client'
import { removeSavedWordsForStudent } from './local-data/saved-words-disk-client'
import { resolveStudentAvatarUrl } from './students/student-avatar-url'
import { normalizeStudentKey } from './students/identity'
import { clearMapBookOverlayOpenSession } from './students/map-book-overlay-session'
import { clearMapViewportSession } from './students/map-viewport-session'
import { normalizeQuizQuestions } from './quiz-difficulty'

const QUIZZES_KEY = CHALLENGE_QUIZZES_KEY
const RESULTS_KEY = CHALLENGE_RESULTS_KEY
const ANIMATION_SETTINGS_KEY = 'esl_animation_settings'
const STUDENT_PROGRESS_KEY = 'esl_student_progress'
const STUDENTS_KEY = 'esl_students'

function normalizeQuizList(quizzes: Quiz[]): Quiz[] {
  return quizzes.map((quiz) => {
    const normalized = normalizeQuizQuestions(quiz)
    const poolLen = Math.max(
      normalized.questionsByTier?.easy?.length ?? 0,
      normalized.questionsByTier?.mid?.length ?? 0,
      normalized.questionsByTier?.hard?.length ?? 0,
      quiz.questions?.length ?? 0,
    )
    return {
      ...normalized,
      challengeQuestionCount: normalizeChallengeQuestionCount(
        (quiz as Partial<Quiz>).challengeQuestionCount,
        poolLen || 1,
      ),
    }
  })
}

function writeQuizzes(quizzes: Quiz[]): void {
  if (isChallengeDataDiskActive()) {
    setQuizzesOnDiskCache(quizzes)
    return
  }
  try {
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error(
        'Browser storage is full. Reload the page while running npm run dev locally to move data to disk.',
      )
    }
    throw err
  }
}

function writeResults(results: StudentResult[]): void {
  if (isChallengeDataDiskActive()) {
    setResultsOnDiskCache(results)
    return
  }
  try {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error(
        'Browser storage is full. Reload the page while running npm run dev locally to move data to disk.',
      )
    }
    throw err
  }
}
const DEFAULT_CHALLENGE_QUESTION_COUNT = 6

/** Removed feature: `esl_book_page_notes_v1` — strip one student when deleting accounts. */
function removeLegacyBookPageNotesForStudent(studentId: string): void {
  if (typeof window === 'undefined') return
  const key = 'esl_book_page_notes_v1'
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return
    const root = parsed as Record<string, unknown>
    if (!(studentId in root)) return
    const next = { ...root }
    delete next[studentId]
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function normalizeChallengeQuestionCount(rawCount: unknown, questionCount: number): number {
  const fallback = Math.max(1, Math.min(DEFAULT_CHALLENGE_QUESTION_COUNT, questionCount || DEFAULT_CHALLENGE_QUESTION_COUNT))
  const parsed = typeof rawCount === 'number' ? rawCount : Number(rawCount)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  return Math.max(1, Math.min(rounded, Math.max(1, questionCount)))
}

export const DEFAULT_ANIMATION_SETTINGS: AnimationSettings = {
  success: 'gentle-sparkles',
  perfect: 'fireworks-celebration',
  fail: 'warm-encouragement',
}

/** Map legacy localStorage ids to presets implemented in play-mode. */
const ANIMATION_PRESET_ALIASES: Record<string, string> = {
  'fireworks-explosion': 'fireworks-celebration',
  'confetti-burst': 'gentle-sparkles',
  'gentle-bounce': 'warm-encouragement',
  'oops-moments': 'warm-encouragement',
}

function normalizeAnimationSettings(settings: AnimationSettings): AnimationSettings {
  const mapId = (id: string) => ANIMATION_PRESET_ALIASES[id] ?? id
  return {
    success: mapId(settings.success),
    perfect: mapId(settings.perfect),
    fail: mapId(settings.fail),
  }
}

export function getQuizzes(): Quiz[] {
  if (typeof window === 'undefined') return []
  try {
    if (isChallengeDataDiskActive()) {
      const disk = getChallengeDataDiskCache()
      return normalizeQuizList((disk?.quizzes ?? []) as Quiz[])
    }
    const raw = localStorage.getItem(QUIZZES_KEY)
    const quizzes = raw ? (JSON.parse(raw) as Quiz[]) : []
    return normalizeQuizList(quizzes)
  } catch {
    return []
  }
}

export function saveQuiz(quiz: Quiz): void {
  const quizzes = getQuizzes()
  const idx = quizzes.findIndex((q) => q.id === quiz.id)
  if (idx >= 0) {
    quizzes[idx] = quiz
  } else {
    quizzes.push(quiz)
  }
  writeQuizzes(quizzes)
}

export function deleteQuiz(id: string): void {
  const quizzes = getQuizzes().filter((q) => q.id !== id)
  writeQuizzes(quizzes)
}

export function getStudentResults(): StudentResult[] {
  if (typeof window === 'undefined') return []
  try {
    if (isChallengeDataDiskActive()) {
      const disk = getChallengeDataDiskCache()
      return Array.isArray(disk?.results) ? (disk.results as StudentResult[]) : []
    }
    const raw = localStorage.getItem(RESULTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Unique student names from results, sorted by most recent activity (matches Student Results). */
export function getKnownStudentSummaries(): KnownStudentSummary[] {
  const results = getStudentResults()
  const map = new Map<string, { lastDate: string; totalQuizzes: number }>()
  for (const r of results) {
    const existing = map.get(r.studentName)
    if (existing) {
      existing.totalQuizzes += 1
      if (r.completedAt > existing.lastDate) existing.lastDate = r.completedAt
    } else {
      map.set(r.studentName, { lastDate: r.completedAt, totalQuizzes: 1 })
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, lastDate: v.lastDate, totalQuizzes: v.totalQuizzes }))
    .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
}

export function saveStudentResult(result: StudentResult): void {
  const results = getStudentResults()
  results.push(result)
  writeResults(results)
}

function getStudentsFromLocalStorage(): StudentRecord[] {
  try {
    const raw = localStorage.getItem(STUDENTS_KEY)
    const parsed = raw ? (JSON.parse(raw) as StudentRecord[]) : []
    const seen = new Set<string>()
    const deduped: StudentRecord[] = []
    for (const student of parsed) {
      if (!student || typeof student.id !== 'string' || typeof student.name !== 'string') continue
      if (seen.has(student.id)) continue
      seen.add(student.id)
      deduped.push(student)
    }
    return deduped
  } catch {
    return []
  }
}

function writeStudentsToLocalStorage(students: StudentRecord[]): void {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(students))
}

export function getStudents(): StudentRecord[] {
  if (typeof window === 'undefined') return []
  const cached = getCachedStudents()
  if (cached !== null) return cached
  return getStudentsFromLocalStorage()
}

function withPreservedAvatarFields(incoming: StudentRecord[], previous: StudentRecord[]): StudentRecord[] {
  const prevById = new Map(previous.map((s) => [s.id, s]))
  return incoming.map((student) => {
    const prev = prevById.get(student.id)
    return {
      ...student,
      avatarUrl: resolveStudentAvatarUrl(student.id, student.avatarUrl ?? prev?.avatarUrl),
    }
  })
}

export function saveStudent(student: StudentRecord): void {
  const students = getStudents()
  const idx = students.findIndex((s) => s.id === student.id)
  const prev = idx >= 0 ? students[idx] : undefined
  const merged: StudentRecord = {
    ...student,
    avatarUrl: resolveStudentAvatarUrl(student.id, student.avatarUrl ?? prev?.avatarUrl),
  }
  if (idx >= 0) {
    students[idx] = merged
  } else {
    students.push(merged)
  }
  if (isStudentRecordsDiskActive()) {
    setCachedStudents(students)
    return
  }
  try {
    writeStudentsToLocalStorage(students)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error(
        'Browser storage is full. Reload the page while running npm run dev locally to move students to disk.',
      )
    }
    throw err
  }
}

export function saveStudents(students: StudentRecord[]): void {
  const previous = getStudents()
  const merged = withPreservedAvatarFields(students, previous)
  if (isStudentRecordsDiskActive()) {
    setCachedStudents(merged)
    return
  }
  try {
    writeStudentsToLocalStorage(merged)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error(
        'Browser storage is full. Reload the page while running npm run dev locally to move students to disk.',
      )
    }
    throw err
  }
}

export function getStudentProgressMap(): Record<string, StudentProgressRecord> {
  if (typeof window === 'undefined') return {}
  const cached = getCachedStudentProgress()
  if (cached !== null) return cached
  try {
    const raw = localStorage.getItem(STUDENT_PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, StudentProgressRecord>) : {}
  } catch {
    return {}
  }
}

export function saveStudentProgressMap(map: Record<string, StudentProgressRecord>): void {
  if (isStudentRecordsDiskActive()) {
    setCachedStudentProgress(map)
    return
  }
  try {
    localStorage.setItem(STUDENT_PROGRESS_KEY, JSON.stringify(map))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error(
        'Browser storage is full. Reload the page while running npm run dev locally to move progress to disk.',
      )
    }
    throw err
  }
}

export function upsertStudentProgressRecord(studentKey: string, record: StudentProgressRecord): void {
  const map = getStudentProgressMap()
  map[studentKey] = record
  saveStudentProgressMap(map)
}

export function getAnimationSettings(): AnimationSettings {
  if (typeof window === 'undefined') return DEFAULT_ANIMATION_SETTINGS
  try {
    const raw = localStorage.getItem(ANIMATION_SETTINGS_KEY)
    const merged = raw
      ? { ...DEFAULT_ANIMATION_SETTINGS, ...JSON.parse(raw) }
      : DEFAULT_ANIMATION_SETTINGS
    return normalizeAnimationSettings(merged)
  } catch {
    return DEFAULT_ANIMATION_SETTINGS
  }
}

export function saveAnimationSettings(settings: AnimationSettings): void {
  localStorage.setItem(ANIMATION_SETTINGS_KEY, JSON.stringify(settings))
}

/**
 * Remove the student record and related browser data (progress, quiz results keyed by name,
 * book annotations, legacy page-notes bucket, map viewport session). Does not touch the `student-work` disk folder.
 */
export function removeStudentFromBrowserStorage(studentId: string): { ok: true; name: string } | { ok: false } {
  if (typeof window === 'undefined') return { ok: false }
  const students = getStudents()
  const record = students.find((s) => s.id === studentId)
  if (!record) return { ok: false }

  const key = normalizeStudentKey(record.name)
  saveStudents(students.filter((s) => s.id !== studentId))

  const progressMap = getStudentProgressMap()
  if (key in progressMap) {
    const nextProgress = { ...progressMap }
    delete nextProgress[key]
    saveStudentProgressMap(nextProgress)
  }

  const results = getStudentResults()
  const nextResults = results.filter((r) => normalizeStudentKey(r.studentName) !== key)
  if (nextResults.length !== results.length) {
    writeResults(nextResults)
  }

  removeAnnotationsForStudent(studentId)
  removeStudentAnnotationToolPrefs(studentId)
  removeSavedWordsForStudent(studentId)
  removeLessonBoardLinksForStudent(studentId)
  removeLegacyBookPageNotesForStudent(studentId)
  clearMapViewportSession(studentId)
  clearMapBookOverlayOpenSession(studentId)

  return { ok: true, name: record.name }
}

/** Deletes `student-work/<studentId>` on the machine running the Next.js server (local dev / local start). */
export async function removeStudentWorkFolderOnServer(studentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/student-work/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId }),
  })
  let data: { error?: string; detail?: string } = {}
  try {
    data = (await res.json()) as { error?: string; detail?: string }
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const detail = data.detail ? ` ${data.detail}` : ''
    return { ok: false, error: `${data.error ?? 'Request failed'}${detail}`.trim() }
  }
  return { ok: true }
}
