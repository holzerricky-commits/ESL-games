import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  emptySavedWordsDiskPayload,
  normalizeSavedWordsDiskPayload,
  type SavedWordsDiskPayload,
} from '@/lib/local-data/saved-words-disk-types'
import { SAVED_WORDS_JSON_PATH, STUDENT_RECORDS_DIR } from '@/lib/local-data/student-records-paths'

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

export async function readSavedWordsFromDisk(): Promise<SavedWordsDiskPayload> {
  try {
    const raw = await readFile(SAVED_WORDS_JSON_PATH, 'utf8')
    return normalizeSavedWordsDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptySavedWordsDiskPayload()
  }
}

export async function writeSavedWordsToDisk(payload: SavedWordsDiskPayload): Promise<void> {
  const normalized = normalizeSavedWordsDiskPayload(payload)
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(SAVED_WORDS_JSON_PATH, normalized)
  })
}
