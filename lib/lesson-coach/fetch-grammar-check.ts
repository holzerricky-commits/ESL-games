import type { GrammarCheckResult } from '@/lib/lesson-coach/grammar-check'

type ApiResponse = {
  ok?: boolean
  issues?: GrammarCheckResult['issues']
  issueCount?: number
  mode?: string
  warning?: string
  error?: string
}

/** Run full grammar check (rules + AI) via API. */
export async function fetchGrammarCheck(text: string): Promise<GrammarCheckResult> {
  const res = await fetch('/api/lesson-coach/grammar-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mode: 'both' }),
  })
  const data = (await res.json()) as ApiResponse
  if (!res.ok || !data.ok || !Array.isArray(data.issues)) {
    throw new Error(data.error ?? 'Grammar check failed')
  }
  return {
    issues: data.issues,
    issueCount: data.issueCount ?? data.issues.length,
    mode: 'both',
    warning: data.warning,
  }
}
