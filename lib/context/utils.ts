import { createHash } from 'node:crypto'
import type { ContextPageRange, ContextRecord, ContextScanProfile } from '@/lib/context/types'

export const CONTEXT_VERSION = 'v1'

export function clampPageRange(range: ContextPageRange): ContextPageRange {
  const startPage = Math.max(1, Math.floor(range.startPage || 1))
  const endPage = Math.max(startPage, Math.floor(range.endPage || startPage))
  return { startPage, endPage }
}

export function normalizeScanProfile(profile: unknown): ContextScanProfile {
  if (profile === 'quick' || profile === 'deep') return profile
  return 'balanced'
}

export function stableId(raw: string): string {
  return createHash('sha256').update(raw).digest('hex').slice(0, 20)
}

export function trimList(values: unknown, max: number): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const v = String(raw ?? '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
    if (out.length >= max) break
  }
  return out
}

export function contextIndexKey(record: ContextRecord): string {
  if (record.kind === 'unit') return `unit::${record.bookId}::${record.unitId}`
  if (record.kind === 'book') return `book::${record.bookId}`
  if (record.kind === 'part') return `part::${record.bookId}::${record.unitId}::${record.lessonId}::${record.partId}`
  return `lesson::${record.bookId}::${record.unitId}::${record.lessonId}`
}
