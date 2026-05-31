import type {
  GrammarIssue,
  LessonCoachSessionPatch,
  RevealUndoSnapshot,
} from '@/lib/lesson-coach/types'

export function getActiveRevealIssue(issues: GrammarIssue[]): GrammarIssue | null {
  return (
    issues.find((i) => i.status === 'highlighted' || i.status === 'revealed') ?? null
  )
}

export function countOpenIssues(issues: GrammarIssue[]): number {
  return issues.filter((i) => i.status !== 'applied').length
}

/** Clear in-progress reveal; keep applied issues. */
function clearInProgressReveal(issues: GrammarIssue[]): GrammarIssue[] {
  return issues.map((i) =>
    i.status === 'highlighted' || i.status === 'revealed'
      ? { ...i, status: 'hidden' as const }
      : i,
  )
}

/** Highlight the next hidden issue (one active highlight at a time). */
export function highlightNextIssue(
  issues: GrammarIssue[],
  afterIndex = -1,
): GrammarIssue[] {
  const cleared = clearInProgressReveal(issues)
  let idx = -1
  for (let i = afterIndex + 1; i < cleared.length; i++) {
    if (cleared[i].status === 'hidden') {
      idx = i
      break
    }
  }
  if (idx < 0) {
    idx = cleared.findIndex((i) => i.status === 'hidden')
  }
  if (idx < 0) return cleared
  return cleared.map((issue, i) =>
    i === idx ? { ...issue, status: 'highlighted' as const } : issue,
  )
}

export function showFixForActive(issues: GrammarIssue[]): GrammarIssue[] {
  const activeIdx = issues.findIndex((i) => i.status === 'highlighted')
  if (activeIdx < 0) return issues
  return issues.map((issue, i) =>
    i === activeIdx ? { ...issue, status: 'revealed' as const } : issue,
  )
}

export function applySuggestionToText(text: string, issue: GrammarIssue): string {
  const replacement =
    issue.suggestion ?? text.slice(issue.start, issue.end)
  return text.slice(0, issue.start) + replacement + text.slice(issue.end)
}

/** Shift issue spans after a text edit. Drops issues that overlap the edited span. */
export function shiftIssuesAfterEdit(
  issues: GrammarIssue[],
  editStart: number,
  editEnd: number,
  insertedLength: number,
  appliedIssueId: string,
): GrammarIssue[] {
  const delta = insertedLength - (editEnd - editStart)
  const result: GrammarIssue[] = []

  for (const issue of issues) {
    if (issue.id === appliedIssueId) {
      result.push({
        ...issue,
        status: 'applied' as const,
        end: editStart + insertedLength,
      })
      continue
    }
    if (issue.status === 'applied') {
      result.push(issue)
      continue
    }
    if (issue.end <= editStart) {
      result.push(issue)
      continue
    }
    if (issue.start >= editEnd) {
      result.push({
        ...issue,
        start: issue.start + delta,
        end: issue.end + delta,
        status: issue.status === 'highlighted' || issue.status === 'revealed' ? 'hidden' : issue.status,
      })
      continue
    }
    // Overlaps edit — drop from list (positions invalid)
  }

  return result
}

export function applyActiveFix(
  sharedText: string,
  issues: GrammarIssue[],
): { sharedText: string; issues: GrammarIssue[] } | null {
  const active = issues.find((i) => i.status === 'revealed')
  if (!active) return null

  const newText = applySuggestionToText(sharedText, active)
  const insertLen = (active.suggestion ?? sharedText.slice(active.start, active.end)).length
  const newIssues = shiftIssuesAfterEdit(
    clearInProgressReveal(issues),
    active.start,
    active.end,
    insertLen,
    active.id,
  )

  return { sharedText: newText, issues: newIssues }
}

export function patchHighlightNext(
  issues: GrammarIssue[],
  revealIndex: number,
): LessonCoachSessionPatch {
  const nextIssues = highlightNextIssue(issues, revealIndex)
  return {
    issues: nextIssues,
    revealIndex: nextIssues.findIndex((i) => i.status === 'highlighted'),
  }
}

export function patchShowFix(issues: GrammarIssue[]): LessonCoachSessionPatch {
  const nextIssues = showFixForActive(issues)
  const revealed = nextIssues.filter((i) => i.status === 'revealed').length
  return {
    issues: nextIssues,
    revealedCount: revealed,
  }
}

export function patchApplyFix(
  sharedText: string,
  issues: GrammarIssue[],
  undoStack: RevealUndoSnapshot[],
): LessonCoachSessionPatch | null {
  const result = applyActiveFix(sharedText, issues)
  if (!result) return null

  const openCount = result.issues.filter((i) => i.status !== 'applied').length

  return {
    sharedText: result.sharedText,
    issues: result.issues,
    issueCount: openCount,
    textUndoStack: [{ sharedText, issues }, ...undoStack].slice(0, 8),
    revealIndex: -1,
  }
}

export function patchUndoApply(
  undoStack: RevealUndoSnapshot[],
): LessonCoachSessionPatch | null {
  const [prev, ...rest] = undoStack
  if (!prev) return null
  return {
    sharedText: prev.sharedText,
    issues: prev.issues,
    textUndoStack: rest,
    issueCount: prev.issues.filter((i) => i.status !== 'applied').length,
    revealIndex: -1,
  }
}

/** Issues to draw on the shared sentence (active mistake or fixed spans). */
export function getSharedScreenHighlightIssues(issues: GrammarIssue[]): GrammarIssue[] {
  const active = getActiveRevealIssue(issues)
  if (active) return [active]
  return issues.filter((i) => i.status === 'applied')
}

/** Apply fix for the highlighted mistake (or the revealed one). */
export function patchApplyFromHighlight(
  sharedText: string,
  issues: GrammarIssue[],
  undoStack: RevealUndoSnapshot[],
): LessonCoachSessionPatch | null {
  const highlighted = issues.find((i) => i.status === 'highlighted')
  if (highlighted) {
    return patchApplyFix(sharedText, showFixForActive(issues), undoStack)
  }
  return patchApplyFix(sharedText, issues, undoStack)
}
