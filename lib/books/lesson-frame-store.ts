import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  lessonFrameId,
  sanitizeLessonFrameRecord,
  type LessonFrameRecord,
} from '@/lib/books/lesson-frame'

const DIR = join(/* turbopackIgnore: true */ process.cwd(), 'data', 'lesson-frames')

function framePath(bookId: string, unitId: string, lessonId: string): string {
  const id = lessonFrameId(bookId, unitId, lessonId)
  const safe = id.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return join(DIR, `${safe}.json`)
}

function framePathFromRecordId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return join(DIR, `${safe}.json`)
}

let writeQueue: Promise<unknown> = Promise.resolve()

function queueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function getLessonFrame(
  bookId: string,
  unitId: string,
  lessonId: string,
): Promise<LessonFrameRecord | null> {
  try {
    const raw = await readFile(framePath(bookId, unitId, lessonId), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return sanitizeLessonFrameRecord(parsed as LessonFrameRecord)
  } catch {
    return null
  }
}

export async function saveLessonFrame(
  input: Partial<LessonFrameRecord> & { bookId: string; unitId: string; lessonId: string },
): Promise<LessonFrameRecord> {
  const sanitized = sanitizeLessonFrameRecord(input)
  if (!sanitized) {
    throw new Error('Invalid lesson frame.')
  }
  return queueWrite(async () => {
    await mkdir(DIR, { recursive: true })
    const next: LessonFrameRecord = {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    }
    await writeFile(framePathFromRecordId(next.id), JSON.stringify(next, null, 2), 'utf8')
    return next
  })
}

export async function listLessonFramesForBook(bookId: string): Promise<LessonFrameRecord[]> {
  const id = bookId.trim()
  if (!id) return []
  try {
    await mkdir(DIR, { recursive: true })
    const files = await readdir(DIR)
    const out: LessonFrameRecord[] = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const raw = await readFile(join(DIR, file), 'utf8')
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') continue
        const frame = sanitizeLessonFrameRecord(parsed as LessonFrameRecord)
        if (frame && frame.bookId === id) out.push(frame)
      } catch {
        // skip bad file
      }
    }
    return out.sort((a, b) => a.lessonId.localeCompare(b.lessonId))
  } catch {
    return []
  }
}

export async function deleteLessonFrame(
  bookId: string,
  unitId: string,
  lessonId: string,
): Promise<boolean> {
  try {
    await unlink(framePath(bookId, unitId, lessonId))
    return true
  } catch {
    return false
  }
}
