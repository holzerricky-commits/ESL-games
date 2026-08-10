import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  emptyLessonBoardLinksDiskPayload,
  normalizeLessonBoardLinksDiskPayload,
  type LessonBoardLinksDiskPayload,
} from '@/lib/local-data/lesson-board-links-disk-types'
import { LESSON_BOARD_LINKS_JSON_PATH, STUDENT_RECORDS_DIR } from '@/lib/local-data/student-records-paths'

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

export async function readLessonBoardLinksFromDisk(): Promise<LessonBoardLinksDiskPayload> {
  try {
    const raw = await readFile(LESSON_BOARD_LINKS_JSON_PATH, 'utf8')
    return normalizeLessonBoardLinksDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyLessonBoardLinksDiskPayload()
  }
}

export async function writeLessonBoardLinksToDisk(payload: LessonBoardLinksDiskPayload): Promise<void> {
  const normalized = normalizeLessonBoardLinksDiskPayload(payload)
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(LESSON_BOARD_LINKS_JSON_PATH, normalized)
  })
}
