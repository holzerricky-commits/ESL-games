import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  emptyWeeklyScheduleDiskPayload,
  normalizeWeeklyScheduleDiskPayload,
  type WeeklyScheduleDiskPayload,
} from '@/lib/local-data/weekly-schedule-disk-types'
import { STUDENT_RECORDS_DIR, WEEKLY_SCHEDULE_JSON_PATH } from '@/lib/local-data/student-records-paths'

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

export async function readWeeklyScheduleFromDisk(): Promise<WeeklyScheduleDiskPayload> {
  try {
    const raw = await readFile(WEEKLY_SCHEDULE_JSON_PATH, 'utf8')
    return normalizeWeeklyScheduleDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyWeeklyScheduleDiskPayload()
  }
}

export async function writeWeeklyScheduleToDisk(payload: WeeklyScheduleDiskPayload): Promise<void> {
  const normalized = normalizeWeeklyScheduleDiskPayload(payload)
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(WEEKLY_SCHEDULE_JSON_PATH, normalized)
  })
}
