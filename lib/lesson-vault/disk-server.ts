import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  emptyLessonVaultDiskPayload,
  normalizeLessonVaultDiskPayload,
  type LessonVaultDiskPayload,
} from '@/lib/lesson-vault/types'
import { LESSON_VAULT_JSON_PATH, STUDENT_RECORDS_DIR } from '@/lib/local-data/student-records-paths'

let writeQueue = Promise.resolve()

function enqueueWrite<T>(writer: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(writer)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function readLessonVaultFromDisk(): Promise<LessonVaultDiskPayload> {
  try {
    const raw = await readFile(LESSON_VAULT_JSON_PATH, 'utf8')
    return normalizeLessonVaultDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyLessonVaultDiskPayload()
  }
}

export async function writeLessonVaultToDisk(payload: LessonVaultDiskPayload): Promise<void> {
  const normalized = normalizeLessonVaultDiskPayload(payload)
  return enqueueWrite(async () => {
    await mkdir(STUDENT_RECORDS_DIR, { recursive: true })
    const tmp = `${LESSON_VAULT_JSON_PATH}.tmp`
    await writeFile(tmp, JSON.stringify(normalized, null, 2), 'utf8')
    await rename(tmp, LESSON_VAULT_JSON_PATH)
  })
}
