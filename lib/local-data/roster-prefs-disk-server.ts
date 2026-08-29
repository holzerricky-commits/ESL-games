import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { ROSTER_PREFS_JSON_PATH, STUDENT_RECORDS_DIR } from '@/lib/local-data/student-records-paths'
import {
  DEFAULT_STUDENTS_ROSTER_PREFS,
  normalizeStudentsRosterPrefs,
  type StudentsRosterPrefs,
} from '@/lib/students/students-roster-prefs'

let writeQueue = Promise.resolve()

function enqueueWrite<T>(writer: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(writer)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(STUDENT_RECORDS_DIR, { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, path)
}

export async function readRosterPrefsFromDisk(): Promise<StudentsRosterPrefs> {
  try {
    const raw = await readFile(ROSTER_PREFS_JSON_PATH, 'utf8')
    return normalizeStudentsRosterPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_STUDENTS_ROSTER_PREFS }
  }
}

export async function writeRosterPrefsToDisk(prefs: StudentsRosterPrefs): Promise<void> {
  const normalized = normalizeStudentsRosterPrefs(prefs)
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(ROSTER_PREFS_JSON_PATH, normalized)
  })
}
