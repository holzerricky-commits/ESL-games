import 'server-only'

import { analyzeTextDeep } from '@/lib/lesson-coach/grammar-deep'
import { analyzeText } from '@/lib/lesson-coach/grammar-lite'
import { mergeGrammarIssues } from '@/lib/lesson-coach/grammar-merge'
import type { GrammarCheckMode, GrammarCheckResult } from '@/lib/lesson-coach/grammar-check'

/** Server-side grammar check (deep or merged lite+deep). */
export async function runGrammarCheck(
  text: string,
  mode: GrammarCheckMode,
): Promise<GrammarCheckResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    return { issues: [], issueCount: 0, mode }
  }

  if (mode === 'deep') {
    const deep = await analyzeTextDeep(trimmed)
    return {
      issues: deep.issues,
      issueCount: deep.issues.length,
      mode,
      warning: deep.error,
    }
  }

  const lite = analyzeText(trimmed)
  const deep = await analyzeTextDeep(trimmed)
  const issues = mergeGrammarIssues(lite, deep.issues)
  return {
    issues,
    issueCount: issues.length,
    mode,
    warning: deep.error,
  }
}
