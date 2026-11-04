import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  emptyLessonGrammarDiskPayload,
  normalizeLessonGrammarDiskPayload,
  type LessonGrammarDiskPayload,
} from '@/lib/lesson-grammar/types'
import { LESSON_GRAMMAR_JSON_PATH, STUDENT_RECORDS_DIR } from '@/lib/local-data/student-records-paths'

let writeQueue = Promise.resolve()

function enqueueWrite<T>(writer: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(writer)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function readLessonGrammarFromDisk(): Promise<LessonGrammarDiskPayload> {
  try {
    const raw = await readFile(LESSON_GRAMMAR_JSON_PATH, 'utf8')
    return normalizeLessonGrammarDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyLessonGrammarDiskPayload()
  }
}

export async function writeLessonGrammarToDisk(payload: LessonGrammarDiskPayload): Promise<void> {
  const normalized = normalizeLessonGrammarDiskPayload(payload)
  return enqueueWrite(async () => {
    await mkdir(STUDENT_RECORDS_DIR, { recursive: true })
    const tmp = `${LESSON_GRAMMAR_JSON_PATH}.tmp`
    await writeFile(tmp, JSON.stringify(normalized, null, 2), 'utf8')
    await rename(tmp, LESSON_GRAMMAR_JSON_PATH)
  })
}
