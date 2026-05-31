import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import type { StudentProgressRecord, StudentRecord } from '@/lib/types'
import { STUDENT_PROGRESS_JSON_PATH, STUDENT_RECORDS_DIR, STUDENTS_JSON_PATH } from './student-records-paths'

let writeQueue = Promise.resolve()

function enqueueWrite<T>(writer: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(writer)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(STUDENT_RECORDS_DIR, { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, path)
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
  const parsed = await readJsonFile<unknown[]>(STUDENTS_JSON_PATH, [])
  if (!Array.isArray(parsed)) return []
  return dedupeStudents(parsed as StudentRecord[])
}

export async function writeStudentsToDisk(students: StudentRecord[]): Promise<void> {
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(STUDENTS_JSON_PATH, dedupeStudents(students))
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
