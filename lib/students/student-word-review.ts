import type { ClassPrepVocabSignals } from '@/lib/students/class-prep-signals'
import type {
  StudentClassSession,
  StudentRecord,
  StudentWordReviewEntry,
  StudentWordReviewStrength,
} from '@/lib/types'

export type StudentWordReviewRowSource =
  | StudentWordReviewEntry['source']
  | 'class_outcome'
  | 'saved_notebook'
  | 'ai_prep'

export interface StudentWordReviewRow {
  word: string
  strength: StudentWordReviewStrength
  source: StudentWordReviewRowSource
}

export interface StudentWordReviewView {
  needsPractice: StudentWordReviewRow[]
  goingWell: StudentWordReviewRow[]
  hasPersistedEntries: boolean
  canImport: boolean
}

const WORD_CAP = 24

function wordKey(word: string): string {
  return word.trim().toLowerCase()
}

function dedupeRows(rows: StudentWordReviewRow[], cap = WORD_CAP): StudentWordReviewRow[] {
  const out: StudentWordReviewRow[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const word = row.word.trim()
    if (!word) continue
    const key = wordKey(word)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...row, word })
    if (out.length >= cap) break
  }
  return out
}

export function sanitizeWordReviewEntries(raw: unknown): StudentWordReviewEntry[] {
  if (!Array.isArray(raw)) return []
  const out: StudentWordReviewEntry[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<StudentWordReviewEntry>
    const word = typeof row.word === 'string' ? row.word.trim() : ''
    if (!word) continue
    const key = wordKey(word)
    if (seen.has(key)) continue
    seen.add(key)
    const strength: StudentWordReviewStrength =
      row.strength === 'strong' ? 'strong' : 'needs_practice'
    const source: StudentWordReviewEntry['source'] = row.source === 'seeded' ? 'seeded' : 'manual'
    const updatedAt =
      typeof row.updatedAt === 'string' && row.updatedAt.trim()
        ? row.updatedAt.trim()
        : new Date().toISOString()
    out.push({ word, strength, source, updatedAt })
    if (out.length >= WORD_CAP) break
  }
  return out
}

export function sanitizeWordReviewHidden(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const key = wordKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
    if (out.length >= WORD_CAP) break
  }
  return out
}

export function aggregatedRowsFromVocabSignals(signals: ClassPrepVocabSignals): StudentWordReviewRow[] {
  const rows: StudentWordReviewRow[] = []
  for (const word of signals.needsPracticeWords) {
    rows.push({ word, strength: 'needs_practice', source: 'class_outcome' })
  }
  for (const word of signals.savedNotebookWords) {
    if (!rows.some((row) => wordKey(row.word) === wordKey(word))) {
      rows.push({ word, strength: 'needs_practice', source: 'saved_notebook' })
    }
  }
  for (const word of signals.strongWords) {
    rows.push({ word, strength: 'strong', source: 'class_outcome' })
  }
  return dedupeRows(rows)
}

export function mergeWordReviewView(input: {
  entries: StudentWordReviewEntry[]
  hidden: string[]
  aggregatedRows: StudentWordReviewRow[]
}): StudentWordReviewView {
  const hidden = new Set(input.hidden.map(wordKey))
  const entryByKey = new Map(
    input.entries.map((entry) => [wordKey(entry.word), entry] as const),
  )
  const merged = new Map<string, StudentWordReviewRow>()

  for (const row of input.aggregatedRows) {
    const key = wordKey(row.word)
    if (hidden.has(key) || entryByKey.has(key)) continue
    merged.set(key, row)
  }

  for (const entry of input.entries) {
    const key = wordKey(entry.word)
    if (hidden.has(key)) continue
    merged.set(key, {
      word: entry.word,
      strength: entry.strength,
      source: entry.source,
    })
  }

  const all = [...merged.values()]
  return {
    needsPractice: dedupeRows(all.filter((row) => row.strength === 'needs_practice')),
    goingWell: dedupeRows(all.filter((row) => row.strength === 'strong')),
    hasPersistedEntries: input.entries.length > 0,
    canImport: input.entries.length === 0 && input.aggregatedRows.length > 0,
  }
}

export function buildSeedEntriesFromRows(
  rows: StudentWordReviewRow[],
  nowIso: string = new Date().toISOString(),
): StudentWordReviewEntry[] {
  return rows.map((row) => ({
    word: row.word,
    strength: row.strength,
    source: 'seeded' as const,
    updatedAt: nowIso,
  }))
}

export function resolveVocabSignalsFromWordReview(view: StudentWordReviewView): ClassPrepVocabSignals {
  return {
    needsPracticeWords: view.needsPractice.map((row) => row.word),
    strongWords: view.goingWell.map((row) => row.word),
    savedNotebookWords: view.needsPractice
      .filter((row) => row.source === 'saved_notebook')
      .map((row) => row.word),
  }
}

export function prepRevisitRowsFromSessions(sessions: StudentClassSession[]): StudentWordReviewRow[] {
  const rows: StudentWordReviewRow[] = []
  for (const session of sessions) {
    for (const item of session.prepWordsToRevisit ?? []) {
      const word = item.word?.trim()
      if (!word) continue
      rows.push({ word, strength: 'needs_practice', source: 'ai_prep' })
    }
  }
  return dedupeRows(rows)
}

export function combineAggregatedWordReviewRows(
  signals: ClassPrepVocabSignals,
  sessions: StudentClassSession[],
): StudentWordReviewRow[] {
  return dedupeRows([
    ...aggregatedRowsFromVocabSignals(signals),
    ...prepRevisitRowsFromSessions(sessions),
  ])
}

export function buildStudentWordReviewView(
  student: Pick<StudentRecord, 'wordReviewEntries' | 'wordReviewHidden'>,
  aggregatedRows: StudentWordReviewRow[],
): StudentWordReviewView {
  return mergeWordReviewView({
    entries: sanitizeWordReviewEntries(student.wordReviewEntries),
    hidden: sanitizeWordReviewHidden(student.wordReviewHidden),
    aggregatedRows,
  })
}
