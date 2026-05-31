import {
  createEmptyLessonCoachSession,
  lessonCoachSessionPatchSchema,
  lessonCoachSessionSchema,
  type LessonCoachSession,
  type LessonCoachSessionPatch,
} from '@/lib/lesson-coach/types'

const TTL_MS = 24 * 60 * 60 * 1000

type StoreGlobal = typeof globalThis & {
  __lessonCoachSessionStore?: Map<string, LessonCoachSession>
}

function getStore(): Map<string, LessonCoachSession> {
  const g = globalThis as StoreGlobal
  if (!g.__lessonCoachSessionStore) {
    g.__lessonCoachSessionStore = new Map()
  }
  return g.__lessonCoachSessionStore
}

function pruneExpired(now = Date.now()): void {
  const store = getStore()
  for (const [id, session] of store) {
    if (now - session.updatedAt > TTL_MS) store.delete(id)
  }
}

export function createLessonCoachSession(
  id: string,
  seed?: Partial<LessonCoachSessionPatch>,
): LessonCoachSession {
  pruneExpired()
  const session = alignPromptChecked(
    lessonCoachSessionSchema.parse({
      ...createEmptyLessonCoachSession(id),
      ...seed,
      id,
      updatedAt: Date.now(),
    }),
  )
  getStore().set(id, session)
  return session
}

export function getLessonCoachSession(id: string): LessonCoachSession | null {
  pruneExpired()
  const session = getStore().get(id)
  if (!session) return null
  if (Date.now() - session.updatedAt > TTL_MS) {
    getStore().delete(id)
    return null
  }
  return session
}

export function patchLessonCoachSession(
  id: string,
  patch: LessonCoachSessionPatch,
): LessonCoachSession | null {
  const existing = getLessonCoachSession(id)
  if (!existing) return null

  const parsedPatch = lessonCoachSessionPatchSchema.safeParse(patch)
  if (!parsedPatch.success) return null

  const mergedRaw = lessonCoachSessionSchema.parse({
    ...existing,
    ...parsedPatch.data,
    id,
    updatedAt: Date.now(),
  })
  const merged = alignPromptChecked(mergedRaw)
  getStore().set(id, merged)
  return merged
}

function alignPromptChecked(session: LessonCoachSession): LessonCoachSession {
  const len = session.promptScript.length
  const checked = [...session.promptChecked]
  while (checked.length < len) checked.push(false)
  if (checked.length > len) checked.length = len
  return checked.length === session.promptChecked.length && checked.every((v, i) => v === session.promptChecked[i])
    ? session
    : { ...session, promptChecked: checked }
}

/** Test helper */
export function clearLessonCoachSessionsForTests(): void {
  getStore().clear()
}
