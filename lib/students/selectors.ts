import { buildChallengeCatalogForQuizIds } from '@/lib/challenges'
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
import type { StudentListItemView, StudentProfileTab, StudentProfileView } from '@/lib/students/types'
import type { ChallengeDefinition, DifficultyTier, StudentProgressRecord, StudentRecord } from '@/lib/types'

const PROFILE_TABS: StudentProfileTab[] = ['overview', 'practice', 'challenges', 'map', 'avatar', 'info']
export type StudentMapNodeLayout = Record<string, { xPct: number; yPct: number }>
export type StudentMapPathSegments = MapPathSegments

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

export function getStudentsListView(): StudentListItemView[] {
  ensureStudentAssignmentsMigrated()
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
    }
  })

  if (dirty) saveStudentProgressMap(progressMap)
  return students
}

export function getStudentProfileView(studentId: string): StudentProfileView | null {
  const students = getStudentsListView()
  const student =
    students.find((item) => item.id === studentId) ??
    students.find((item) =>
      item.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === studentId,
    )
  if (!student) return null
  const registryRecord = getStudents().find((s) => s.id === student.id)
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

/** Ordered challenge path for a student; used by the teacher Challenges tab. */
export function getStudentAssignedQuizIds(studentId: string): string[] | null {
  ensureStudentAssignmentsMigrated()
  const student = getStudents().find((s) => s.id === studentId)
  if (!student) return null
  return Array.isArray(student.assignedQuizIds) ? [...student.assignedQuizIds] : []
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
