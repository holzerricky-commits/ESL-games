import { createHash } from 'node:crypto'
import type { VocabularySourceContext } from '@/lib/vocabulary/types'

export function normalizeWord(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9\s'-]/g, '').replace(/\s+/g, ' ')
}

export function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.floor(value))
}

export function createContextKey(context: VocabularySourceContext): string {
  return [
    context.studentId,
    context.classId,
    context.bookId,
    context.unitId,
    context.sectionId ?? '',
    context.pageRange.startPage,
    context.pageRange.endPage,
  ].join('::')
}

export function createStableId(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}
