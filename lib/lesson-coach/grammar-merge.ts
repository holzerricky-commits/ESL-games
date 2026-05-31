import type { GrammarIssue } from '@/lib/lesson-coach/types'

function issueId(type: string, start: number, end: number): string {
  return `${type}:${start}:${end}`
}

/** Find first occurrence of `match` in `text` (case-sensitive, then case-insensitive). */
export function locateMatchInText(
  text: string,
  match: string,
  nearIndex = 0,
): { start: number; end: number } | null {
  const needle = match.trim()
  if (!needle || !text) return null

  const tryFind = (haystack: string, pin: string): number => {
    let best = -1
    let bestDist = Infinity
    let from = 0
    while (from < haystack.length) {
      const idx = haystack.indexOf(pin, from)
      if (idx < 0) break
      const dist = Math.abs(idx - nearIndex)
      if (dist < bestDist) {
        bestDist = dist
        best = idx
      }
      from = idx + 1
    }
    return best
  }

  let start = tryFind(text, needle)
  if (start < 0) {
    const lowerHay = text.toLowerCase()
    const lowerNeedle = needle.toLowerCase()
    start = tryFind(lowerHay, lowerNeedle)
  }
  if (start < 0) return null
  return { start, end: start + needle.length }
}

function overlaps(a: GrammarIssue, b: GrammarIssue): boolean {
  return (
    (a.start >= b.start && a.start < b.end) ||
    (a.end > b.start && a.end <= b.end) ||
    (a.start <= b.start && a.end >= b.end)
  )
}

/** Merge lite + deep lists; lite wins on overlap; cap total issues. */
export function mergeGrammarIssues(
  primary: GrammarIssue[],
  secondary: GrammarIssue[],
  maxIssues = 20,
): GrammarIssue[] {
  const out = [...primary]
  for (const issue of secondary) {
    if (out.some((existing) => overlaps(existing, issue))) continue
    out.push(issue)
    if (out.length >= maxIssues) break
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end)
}

export type DeepIssueDraft = {
  match: string
  type: string
  message: string
  suggestion?: string
  explanation?: string
}

export function deepDraftsToIssues(text: string, drafts: DeepIssueDraft[]): GrammarIssue[] {
  const issues: GrammarIssue[] = []
  let searchFrom = 0

  for (const draft of drafts) {
    const loc = locateMatchInText(text, draft.match, searchFrom)
    if (!loc) continue
    searchFrom = loc.end

    const issue: GrammarIssue = {
      id: issueId(`deep-${draft.type}`, loc.start, loc.end),
      start: loc.start,
      end: loc.end,
      type: draft.type.slice(0, 64),
      message: draft.message.slice(0, 500),
      suggestion: draft.suggestion?.slice(0, 500),
      explanation: draft.explanation?.slice(0, 2000),
      status: 'hidden',
    }
    if (issues.some((i) => overlaps(i, issue))) continue
    issues.push(issue)
  }

  return issues
}
