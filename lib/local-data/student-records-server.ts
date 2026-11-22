import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StudentProgressRecord, StudentRecord } from '@/lib/types'
import { STUDENT_PROGRESS_JSON_PATH, STUDENTS_JSON_PATH } from './student-records-paths'

let writeQueue = Promise.resolve()
let studentsJsonPathForIo = STUDENTS_JSON_PATH

/** Tests write the roster to a temp file so they do not touch the teacher's students.json. */
export function __setStudentsJsonPathForTests(next: string | null): void {
  studentsJsonPathForIo = next ?? STUDENTS_JSON_PATH
}

function enqueueWrite<T>(writer: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(writer)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, filePath)
}

function dedupeStudents(parsed: StudentRecord[]): StudentRecord[] {
  const seen = new Set<string>()
  const deduped: StudentRecord[] = []
  for (const student of parsed) {
    if (!student || typeof student.id !== 'string' || typeof student.name !== 'string') continue
    if (seen.has(student.id)) continue
    seen.add(student.id)
    deduped.push(student)
  }
  return deduped
}

export async function readStudentsFromDisk(): Promise<StudentRecord[]> {
  const parsed = await readJsonFile<unknown[]>(studentsJsonPathForIo, [])
  if (!Array.isArray(parsed)) return []
  return dedupeStudents(parsed as StudentRecord[])
}

export async function writeStudentsToDisk(students: StudentRecord[]): Promise<void> {
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(studentsJsonPathForIo, dedupeStudents(students))
  })
}

/**
 * Read the roster and write it back inside the same queue slot.
 * Callers that do slow work first (avatar download) must patch here, not write
 * the array they read before that work — a class save can land in between.
 * Return the same array reference to leave the file untouched.
 */
export async function updateStudentsOnDisk(
  mutate: (students: StudentRecord[]) => StudentRecord[],
): Promise<void> {
  return enqueueWrite(async () => {
    const parsed = await readJsonFile<unknown[]>(studentsJsonPathForIo, [])
    const current = dedupeStudents(Array.isArray(parsed) ? (parsed as StudentRecord[]) : [])
    const next = mutate(current)
    if (next === current) return
    await writeJsonFileAtomic(studentsJsonPathForIo, dedupeStudents(next))
  })
}

export async function readStudentProgressFromDisk(): Promise<Record<string, StudentProgressRecord>> {
  const parsed = await readJsonFile<Record<string, StudentProgressRecord>>(STUDENT_PROGRESS_JSON_PATH, {})
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return parsed
}

export async function writeStudentProgressToDisk(map: Record<string, StudentProgressRecord>): Promise<void> {
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(STUDENT_PROGRESS_JSON_PATH, map)
  })
}
