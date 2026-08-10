import { getStudents, saveStudent, saveStudents } from '@/lib/storage'
import {
  buildStudentAvatarDiceBearSpec,
  buildStudentAvatarDiceBearUrl,
  studentAvatarPublicPath,
} from '@/lib/students/student-avatar-spec'
import { STUDENT_LOCAL_DATA_CHANGED_EVENT } from '@/lib/students/selectors'

export interface EnsureStudentAvatarResult {
  ok: boolean
  avatarUrl?: string
  error?: string
}

/** Ask the local dev API to create/fetch the student's avatar PNG on disk. */
export async function ensureStudentAvatarOnServer(
  studentId: string,
  name: string,
): Promise<EnsureStudentAvatarResult> {
  try {
    const res = await fetch('/api/local-data/student-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, name }),
    })
    const payload = (await res.json()) as { ok?: boolean; avatarUrl?: string; error?: string }
    if (!res.ok || !payload.ok || !payload.avatarUrl) {
      return { ok: false, error: payload.error ?? 'Could not assign avatar.' }
    }

    const students = getStudents()
    const student = students.find((s) => s.id === studentId)
    if (student) {
      saveStudent({
        ...student,
        avatarUrl: payload.avatarUrl,
        updatedAt: new Date().toISOString(),
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STUDENT_LOCAL_DATA_CHANGED_EVENT, { detail: { studentId } }))
      }
    }

    return { ok: true, avatarUrl: payload.avatarUrl }
  } catch {
    return assignRemoteDiceBearAvatar(studentId, name)
  }
}

/** Browser-only fallback when disk API is unavailable — store remote DiceBear URL. */
function assignRemoteDiceBearAvatar(studentId: string, name: string): EnsureStudentAvatarResult {
  const students = getStudents()
  const student = students.find((s) => s.id === studentId)
  if (!student) return { ok: false, error: 'Student not found.' }

  const spec = buildStudentAvatarDiceBearSpec(studentId, name)
  const avatarUrl = buildStudentAvatarDiceBearUrl(spec)
  saveStudent({
    ...student,
    avatarUrl,
    updatedAt: new Date().toISOString(),
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STUDENT_LOCAL_DATA_CHANGED_EVENT, { detail: { studentId } }))
  }
  return { ok: true, avatarUrl }
}

export async function backfillStudentAvatarsOnServer(): Promise<void> {
  try {
    const res = await fetch('/api/local-data/student-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backfill: true }),
    })
    if (!res.ok) return

    const studentsRes = await fetch('/api/local-data/students', { cache: 'no-store' })
    if (!studentsRes.ok) return
    const payload = (await studentsRes.json()) as { students?: Array<{ id: string; avatarUrl?: string }> }
    const students = payload.students ?? []
    if (students.length === 0) return

    const { getStudents, saveStudents } = await import('@/lib/storage')
    const current = getStudents()
    const avatarById = new Map(students.map((s) => [s.id, s.avatarUrl]))
    const merged = current.map((student) => {
      const avatarUrl = avatarById.get(student.id)
      if (!avatarUrl || student.avatarUrl === avatarUrl) return student
      return { ...student, avatarUrl, updatedAt: new Date().toISOString() }
    })
    saveStudents(merged)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STUDENT_LOCAL_DATA_CHANGED_EVENT))
    }
  } catch {
    /* disk API unavailable — skip silent */
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let index = 0
  async function runNext(): Promise<void> {
    const i = index++
    if (i >= items.length) return
    results[i] = await worker(items[i]!)
    await runNext()
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runNext())
  await Promise.all(runners)
  return results
}

export async function ensureStudentAvatarsForAdded(
  added: Array<{ studentId: string; name: string }>,
): Promise<void> {
  await runWithConcurrency(added, 3, ({ studentId, name }) => ensureStudentAvatarOnServer(studentId, name))
}

export function localStudentAvatarPath(studentId: string): string {
  return studentAvatarPublicPath(studentId)
}
