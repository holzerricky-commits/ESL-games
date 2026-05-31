import type { GrammarIssue, LessonCoachSessionPatch } from '@/lib/lesson-coach/types'

export type GrammarCheckMode = 'deep' | 'both'

export type GrammarCheckResult = {
  issues: GrammarIssue[]
  issueCount: number
  mode: GrammarCheckMode
  warning?: string
}

export function toGrammarCheckPatch(
  result: GrammarCheckResult,
): LessonCoachSessionPatch & {
  issues: GrammarIssue[]
  issueCount: number
} {
  return {
    issues: result.issues,
    issueCount: result.issueCount,
    revealedCount: 0,
    revealIndex: -1,
    textUndoStack: [],
  }
}
