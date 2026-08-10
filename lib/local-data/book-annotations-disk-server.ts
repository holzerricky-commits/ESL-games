import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  emptyBookAnnotationsDiskPayload,
  normalizeBookAnnotationsDiskPayload,
  type BookAnnotationsDiskPayload,
} from '@/lib/local-data/book-annotations-disk-types'
import { BOOK_ANNOTATIONS_JSON_PATH, STUDENT_RECORDS_DIR } from '@/lib/local-data/student-records-paths'

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

export async function readBookAnnotationsFromDisk(): Promise<BookAnnotationsDiskPayload> {
  try {
    const raw = await readFile(BOOK_ANNOTATIONS_JSON_PATH, 'utf8')
    return normalizeBookAnnotationsDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyBookAnnotationsDiskPayload()
  }
}

export async function writeBookAnnotationsToDisk(payload: BookAnnotationsDiskPayload): Promise<void> {
  const normalized = normalizeBookAnnotationsDiskPayload(payload)
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(BOOK_ANNOTATIONS_JSON_PATH, normalized)
  })
}
