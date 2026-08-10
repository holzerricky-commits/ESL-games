import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  emptyReaderProgressDiskPayload,
  normalizeReaderProgressDiskPayload,
  type ReaderProgressDiskPayload,
} from '@/lib/local-data/reader-progress-disk-types'
import { READER_PROGRESS_JSON_PATH, STUDENT_RECORDS_DIR } from '@/lib/local-data/student-records-paths'

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

export async function readReaderProgressFromDisk(): Promise<ReaderProgressDiskPayload> {
  try {
    const raw = await readFile(READER_PROGRESS_JSON_PATH, 'utf8')
    return normalizeReaderProgressDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyReaderProgressDiskPayload()
  }
}

export async function writeReaderProgressToDisk(payload: ReaderProgressDiskPayload): Promise<void> {
  const normalized = normalizeReaderProgressDiskPayload(payload)
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(READER_PROGRESS_JSON_PATH, normalized)
  })
}
