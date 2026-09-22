import { trimList } from '@/lib/context/utils'

export type ContextScanSource = 'model' | 'fallback'

export interface ContextScanOutcome<T> {
  source: ContextScanSource
  record: T
}

export type ContextScanSaveDecision<T> =
  | { action: 'save'; record: T }
  | { action: 'reject' }

/**
 * Failed / empty model scans must not replace saved unit or lesson research.
 * A generic fallback record is only for in-memory recovery, never a disk write.
 */
export function resolveScannedContextSave<T extends { createdAt: string }>(
  scanned: ContextScanOutcome<T>,
  existing: T | null,
): ContextScanSaveDecision<T> {
  if (scanned.source !== 'model') return { action: 'reject' }
  if (!existing) return { action: 'save', record: scanned.record }
  return { action: 'save', record: { ...scanned.record, createdAt: existing.createdAt } }
}

export function unitScanHasUsableModelFields(parsed: {
  theme?: unknown
  bigIdeas?: unknown
  crossCurricularLinks?: unknown
  targetLanguageDomains?: unknown
}): boolean {
  const theme = String(parsed.theme ?? '').trim()
  return (
    theme.length > 0 ||
    trimList(parsed.bigIdeas, 6).length > 0 ||
    trimList(parsed.crossCurricularLinks, 6).length > 0 ||
    trimList(parsed.targetLanguageDomains, 8).length > 0
  )
}

export function lessonScanHasUsableModelFields(parsed: {
  textType?: unknown
  lessonGoals?: unknown
  comprehensionSkill?: unknown
  strategy?: unknown
  essentialQuestions?: unknown
  languageFocus?: { grammarNotes?: unknown; writingNotes?: unknown }
}): boolean {
  const textType = String(parsed.textType ?? '').trim()
  const comprehensionSkill = String(parsed.comprehensionSkill ?? '').trim()
  const strategy = String(parsed.strategy ?? '').trim()
  return (
    textType.length > 0 ||
    comprehensionSkill.length > 0 ||
    strategy.length > 0 ||
    trimList(parsed.lessonGoals, 8).length > 0 ||
    trimList(parsed.essentialQuestions, 5).length > 0 ||
    trimList(parsed.languageFocus?.grammarNotes, 6).length > 0 ||
    trimList(parsed.languageFocus?.writingNotes, 6).length > 0
  )
}
