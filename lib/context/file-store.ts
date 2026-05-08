import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ContextStore } from '@/lib/context/store'
import type { BookContextRecord, ContextRecord, LessonContextRecord, PartContextRecord, UnitContextRecord } from '@/lib/context/types'
import { contextIndexKey } from '@/lib/context/utils'

const CONTEXT_DIR = join(/* turbopackIgnore: true */ process.cwd(), 'data', 'context')
const INDEX_PATH = join(CONTEXT_DIR, 'index.json')

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function recordPath(id: string): string {
  return join(CONTEXT_DIR, `${id}.json`)
}

export class FileContextStore implements ContextStore {
  private writeQueue = Promise.resolve()

  private async readIndex(): Promise<Record<string, string>> {
    return (await readJson<Record<string, string>>(INDEX_PATH)) ?? {}
  }

  private queueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task)
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async saveRecord(record: ContextRecord): Promise<ContextRecord> {
    return this.queueWrite(async () => {
      await mkdir(CONTEXT_DIR, { recursive: true })
      const index = await this.readIndex()
      index[contextIndexKey(record)] = record.id
      await writeFile(recordPath(record.id), JSON.stringify(record, null, 2), 'utf8')
      await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8')
      return record
    })
  }

  async getBookContext(bookId: string): Promise<BookContextRecord | null> {
    const index = await this.readIndex()
    const id = index[`book::${bookId}`]
    if (!id) return null
    return (await readJson<BookContextRecord>(recordPath(id))) ?? null
  }

  async saveBookContext(record: BookContextRecord): Promise<BookContextRecord> {
    return (await this.saveRecord(record)) as BookContextRecord
  }

  async getUnitContext(bookId: string, unitId: string): Promise<UnitContextRecord | null> {
    const index = await this.readIndex()
    const id = index[`unit::${bookId}::${unitId}`]
    if (!id) return null
    return (await readJson<UnitContextRecord>(recordPath(id))) ?? null
  }

  async saveUnitContext(record: UnitContextRecord): Promise<UnitContextRecord> {
    return (await this.saveRecord(record)) as UnitContextRecord
  }

  async getLessonContext(bookId: string, unitId: string, lessonId: string): Promise<LessonContextRecord | null> {
    const index = await this.readIndex()
    const id = index[`lesson::${bookId}::${unitId}::${lessonId}`]
    if (!id) return null
    return (await readJson<LessonContextRecord>(recordPath(id))) ?? null
  }

  async saveLessonContext(record: LessonContextRecord): Promise<LessonContextRecord> {
    return (await this.saveRecord(record)) as LessonContextRecord
  }

  async getPartContext(bookId: string, unitId: string, lessonId: string, partId: string): Promise<PartContextRecord | null> {
    const index = await this.readIndex()
    const id = index[`part::${bookId}::${unitId}::${lessonId}::${partId}`]
    if (!id) return null
    return (await readJson<PartContextRecord>(recordPath(id))) ?? null
  }

  async savePartContext(record: PartContextRecord): Promise<PartContextRecord> {
    return (await this.saveRecord(record)) as PartContextRecord
  }

  async listContextsForUnit(bookId: string, unitId: string): Promise<{ unit: UnitContextRecord | null; lessons: LessonContextRecord[]; parts: PartContextRecord[] }> {
    const index = await this.readIndex()
    const unitIdKey = `unit::${bookId}::${unitId}`
    const lessonPrefix = `lesson::${bookId}::${unitId}::`
    const partPrefix = `part::${bookId}::${unitId}::`
    const unit = index[unitIdKey] ? await readJson<UnitContextRecord>(recordPath(index[unitIdKey]!)) : null
    const lessonKeys = Object.keys(index).filter((key) => key.startsWith(lessonPrefix))
    const partKeys = Object.keys(index).filter((key) => key.startsWith(partPrefix))
    const lessonRecords = await Promise.all(
      lessonKeys.map(async (key) => {
        const id = index[key]
        if (!id) return null
        return readJson<LessonContextRecord>(recordPath(id))
      }),
    )
    const partRecords = await Promise.all(
      partKeys.map(async (key) => {
        const id = index[key]
        if (!id) return null
        return readJson<PartContextRecord>(recordPath(id))
      }),
    )
    return {
      unit: unit ?? null,
      lessons: lessonRecords.filter((item): item is LessonContextRecord => !!item),
      parts: partRecords.filter((item): item is PartContextRecord => !!item),
    }
  }

  async listContextsForBook(bookId: string): Promise<{ units: UnitContextRecord[]; lessons: LessonContextRecord[]; parts: PartContextRecord[] }> {
    const index = await this.readIndex()
    const unitPrefix = `unit::${bookId}::`
    const lessonPrefix = `lesson::${bookId}::`
    const partPrefix = `part::${bookId}::`
    const unitKeys = Object.keys(index).filter((key) => key.startsWith(unitPrefix))
    const lessonKeys = Object.keys(index).filter((key) => key.startsWith(lessonPrefix))
    const partKeys = Object.keys(index).filter((key) => key.startsWith(partPrefix))
    const unitRecords = await Promise.all(
      unitKeys.map(async (key) => {
        const id = index[key]
        if (!id) return null
        return readJson<UnitContextRecord>(recordPath(id))
      }),
    )
    const lessonRecords = await Promise.all(
      lessonKeys.map(async (key) => {
        const id = index[key]
        if (!id) return null
        return readJson<LessonContextRecord>(recordPath(id))
      }),
    )
    const partRecords = await Promise.all(
      partKeys.map(async (key) => {
        const id = index[key]
        if (!id) return null
        return readJson<PartContextRecord>(recordPath(id))
      }),
    )
    return {
      units: unitRecords.filter((item): item is UnitContextRecord => !!item),
      lessons: lessonRecords.filter((item): item is LessonContextRecord => !!item),
      parts: partRecords.filter((item): item is PartContextRecord => !!item),
    }
  }
}

let singleton: FileContextStore | null = null

export function getContextStore(): ContextStore {
  if (!singleton) singleton = new FileContextStore()
  return singleton
}
