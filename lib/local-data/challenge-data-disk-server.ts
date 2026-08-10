import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  emptyChallengeDataDiskPayload,
  normalizeChallengeDataDiskPayload,
  type ChallengeDataDiskPayload,
} from '@/lib/local-data/challenge-data-disk-types'
import { CHALLENGE_DATA_JSON_PATH, STUDENT_RECORDS_DIR } from '@/lib/local-data/student-records-paths'

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

export async function readChallengeDataFromDisk(): Promise<ChallengeDataDiskPayload> {
  try {
    const raw = await readFile(CHALLENGE_DATA_JSON_PATH, 'utf8')
    return normalizeChallengeDataDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyChallengeDataDiskPayload()
  }
}

export async function writeChallengeDataToDisk(payload: ChallengeDataDiskPayload): Promise<void> {
  const normalized = normalizeChallengeDataDiskPayload(payload)
  return enqueueWrite(async () => {
    await writeJsonFileAtomic(CHALLENGE_DATA_JSON_PATH, normalized)
  })
}
