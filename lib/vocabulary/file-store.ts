import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import type { VocabularySet, VocabularySetStatus, VocabularySourceContext } from '@/lib/vocabulary/types'
import type { VocabularyStore } from '@/lib/vocabulary/store'
import { createContextKey } from '@/lib/vocabulary/utils'
import { getVocabularyRiskScore } from '@/lib/vocabulary/risk'

const DATA_DIR = join(/* turbopackIgnore: true */ process.cwd(), 'data')
const VOCAB_DIR = join(DATA_DIR, 'vocabulary')
const SAFE_SET_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

function isSafeSetId(setId: string): boolean {
  return SAFE_SET_ID_RE.test(setId.trim())
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isVocabularySet(value: unknown): value is VocabularySet {
  if (!value || typeof value !== 'object') return false
  const set = value as Partial<VocabularySet>
  if (typeof set.id !== 'string' || !isSafeSetId(set.id)) return false
  if (set.status !== 'draft' && set.status !== 'approved' && set.status !== 'published') return false
  if (typeof set.generationVersion !== 'string') return false
  if (typeof set.createdAt !== 'string' || typeof set.updatedAt !== 'string') return false
  if (!set.context || typeof set.context !== 'object') return false
  const context = set.context as Partial<VocabularySourceContext>
  if (
    typeof context.studentId !== 'string' ||
    typeof context.classId !== 'string' ||
    typeof context.classTitle !== 'string' ||
    typeof context.bookId !== 'string' ||
    typeof context.unitId !== 'string' ||
    !context.pageRange ||
    typeof context.pageRange.startPage !== 'number' ||
    typeof context.pageRange.endPage !== 'number'
  ) {
    return false
  }
  if (!Array.isArray(set.entries)) return false
  return set.entries.every((entry) => (
    entry &&
    typeof entry === 'object' &&
    typeof entry.id === 'string' &&
    typeof entry.word === 'string' &&
    typeof entry.lemma === 'string' &&
    typeof entry.definition === 'string' &&
    isStringArray(entry.examples) &&
    isStringArray(entry.synonyms) &&
    isStringArray(entry.antonyms) &&
    isStringArray(entry.relevanceTags) &&
    typeof entry.confidence === 'number' &&
    isStringArray(entry.reviewFlags) &&
    typeof entry.approved === 'boolean' &&
    typeof entry.updatedAt === 'string'
  ))
}

async function readJson(path: string): Promise<VocabularySet | null> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return isVocabularySet(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function writeJson(path: string, value: VocabularySet): Promise<void> {
  await mkdir(VOCAB_DIR, { recursive: true })
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8')
}

function sanitizeSet(set: VocabularySet): VocabularySet {
  const seen = new Set<string>()
  const entries = set.entries
    .map((entry) => ({
      ...entry,
      word: entry.word.trim(),
      lemma: entry.lemma.trim(),
      definition: entry.definition.trim(),
      examples: entry.examples.map((line) => line.trim()).filter(Boolean).slice(0, 3),
      synonyms: entry.synonyms.map((line) => line.trim()).filter(Boolean).slice(0, 8),
      antonyms: entry.antonyms.map((line) => line.trim()).filter(Boolean).slice(0, 8),
      relevanceTags: (entry.relevanceTags ?? []).map((line) => line.trim()).filter(Boolean).slice(0, 5),
      confidence: Number.isFinite(Number(entry.confidence)) ? Math.max(0, Math.min(1, Number(entry.confidence))) : 0.5,
      reviewFlags: (entry.reviewFlags ?? []).map((line) => line.trim()).filter(Boolean).slice(0, 4),
    }))
    .filter((entry) => {
      if (!entry.word || !entry.lemma || !entry.definition) return false
      const key = entry.lemma.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  return { ...set, entries }
}

export class FileVocabularyStore implements VocabularyStore {
  private writeQueue = Promise.resolve()

  private setPath(setId: string): string | null {
    const safeId = setId.trim()
    if (!isSafeSetId(safeId)) return null
    const root = resolve(VOCAB_DIR)
    const absPath = resolve(root, `${safeId}.json`)
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`
    return absPath.startsWith(prefix) ? absPath : null
  }

  private indexPath(): string {
    return join(VOCAB_DIR, 'index.json')
  }

  private async readIndex(): Promise<Record<string, string>> {
    try {
      const raw = await readFile(this.indexPath(), 'utf8')
      const parsed = JSON.parse(raw) as Record<string, string>
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  private enqueueWrite<T>(writer: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(writer)
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async getSet(setId: string): Promise<VocabularySet | null> {
    const path = this.setPath(setId)
    return path ? readJson(path) : null
  }

  async getSetByContext(context: VocabularySourceContext): Promise<VocabularySet | null> {
    const contextKey = createContextKey(context)
    const index = await this.readIndex()
    const setId = index[contextKey]
    if (!setId) return null
    return this.getSet(setId)
  }

  async saveDraftSet(set: VocabularySet): Promise<VocabularySet> {
    const next = sanitizeSet(set)
    return this.enqueueWrite(async () => {
      const setFile = this.setPath(next.id)
      if (!setFile) throw new Error('Invalid vocabulary set id.')
      await mkdir(VOCAB_DIR, { recursive: true })
      const index = await this.readIndex()
      index[createContextKey(next.context)] = next.id
      await Promise.all([
        writeJson(setFile, next),
        writeFile(this.indexPath(), JSON.stringify(index, null, 2), 'utf8'),
      ])
      return next
    })
  }

  async updateEntry(setId: string, entryId: string, patch: Partial<VocabularySet['entries'][number]>): Promise<VocabularySet | null> {
    return this.enqueueWrite(async () => {
      const path = this.setPath(setId)
      if (!path) return null
      const set = await this.getSet(setId)
      if (!set) return null
      const now = new Date().toISOString()
      const entries = set.entries.map((entry) => {
        if (entry.id !== entryId) return entry
        return {
          ...entry,
          ...patch,
          updatedAt: now,
        }
      })
      const next = sanitizeSet({ ...set, entries, updatedAt: now })
      await writeJson(path, next)
      return next
    })
  }

  async removeEntry(setId: string, entryId: string): Promise<VocabularySet | null> {
    return this.enqueueWrite(async () => {
      const path = this.setPath(setId)
      if (!path) return null
      const set = await this.getSet(setId)
      if (!set) return null
      const next = {
        ...set,
        entries: set.entries.filter((entry) => entry.id !== entryId),
        updatedAt: new Date().toISOString(),
      }
      await writeJson(path, next)
      return next
    })
  }

  async bulkUpdateEntries(
    setId: string,
    predicate: (entry: VocabularySet['entries'][number]) => boolean,
    patch: Partial<VocabularySet['entries'][number]>,
  ): Promise<VocabularySet | null> {
    return this.enqueueWrite(async () => {
      const path = this.setPath(setId)
      if (!path) return null
      const set = await this.getSet(setId)
      if (!set) return null
      const now = new Date().toISOString()
      const entries = set.entries.map((entry) => {
        if (!predicate(entry)) return entry
        return { ...entry, ...patch, updatedAt: now }
      })
      const next = sanitizeSet({ ...set, entries, updatedAt: now })
      await writeJson(path, next)
      return next
    })
  }

  async listEntriesByRisk(
    setId: string,
    options?: { onlyFlags?: boolean; excludeApproved?: boolean },
  ): Promise<VocabularySet['entries'] | null> {
    const set = await this.getSet(setId)
    if (!set) return null
    let entries = [...set.entries]
    if (options?.onlyFlags) {
      entries = entries.filter((entry) => (entry.reviewFlags ?? []).length > 0)
    }
    if (options?.excludeApproved) {
      entries = entries.filter((entry) => !entry.approved)
    }
    entries.sort((a, b) => {
      const risk = getVocabularyRiskScore(b) - getVocabularyRiskScore(a)
      if (risk !== 0) return risk
      return (a.word ?? '').localeCompare(b.word ?? '')
    })
    return entries
  }

  async setStatus(setId: string, status: VocabularySetStatus): Promise<VocabularySet | null> {
    return this.enqueueWrite(async () => {
      const path = this.setPath(setId)
      if (!path) return null
      const set = await this.getSet(setId)
      if (!set) return null
      const next = { ...set, status, updatedAt: new Date().toISOString() }
      await writeJson(path, next)
      return next
    })
  }
}

let singleton: FileVocabularyStore | null = null

export function getVocabularyStore(): VocabularyStore {
  if (!singleton) singleton = new FileVocabularyStore()
  return singleton
}
