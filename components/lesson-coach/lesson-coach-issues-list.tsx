'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GrammarIssue } from '@/lib/lesson-coach/types'
import { cn } from '@/lib/utils'

function snippet(text: string, issue: GrammarIssue): string {
  const pad = 12
  const from = Math.max(0, issue.start - pad)
  const to = Math.min(text.length, issue.end + pad)
  const before = text.slice(from, issue.start)
  const focus = text.slice(issue.start, issue.end)
  const after = text.slice(issue.end, to)
  return `${from > 0 ? '…' : ''}${before}[${focus}]${after}${to < text.length ? '…' : ''}`
}

type LessonCoachIssuesListProps = {
  text: string
  issues: GrammarIssue[]
}

/** Teacher-only issue list — collapsed rows, tap for explanation. */
export function LessonCoachIssuesList({ text, issues }: LessonCoachIssuesListProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (issues.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-500">
        No issues found — try a longer sentence or run check again after more typing.
      </p>
    )
  }

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {issues.map((issue, index) => {
        const open = openId === issue.id
        return (
          <li key={issue.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : issue.id)}
              className={cn(
                'flex w-full flex-col rounded-xl border px-3 py-3 text-left transition-colors',
                open
                  ? 'border-amber-700/50 bg-amber-950/40'
                  : 'border-zinc-700 bg-zinc-950 active:bg-zinc-900',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-zinc-100">
                    {index + 1}. {issue.message}
                  </span>
                  <IssueStatusBadge status={issue.status} />
                </span>
                <ChevronDown
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform',
                    open && 'rotate-180',
                  )}
                  aria-hidden
                />
              </span>
              <span className="mt-1 font-mono text-xs text-zinc-500">{snippet(text, issue)}</span>
              {open ? (
                <span className="mt-3 space-y-2 border-t border-zinc-800 pt-3 text-sm text-zinc-300">
                  {issue.suggestion ? (
                    <span className="block">
                      <span className="text-zinc-500">Try: </span>
                      <strong className="text-amber-100">{issue.suggestion}</strong>
                    </span>
                  ) : null}
                  {issue.explanation ? (
                    <span className="block text-zinc-400">{issue.explanation}</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function IssueStatusBadge({ status }: { status: GrammarIssue['status'] }) {
  const label =
    status === 'applied'
      ? 'Applied'
      : status === 'revealed'
        ? 'Fix shown (you)'
        : status === 'highlighted'
          ? 'On shared screen'
          : null
  if (!label) return null
  return (
    <span
      className={cn(
        'w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        status === 'applied' && 'bg-emerald-900/50 text-emerald-300',
        status === 'revealed' && 'bg-amber-900/50 text-amber-300',
        status === 'highlighted' && 'bg-sky-900/50 text-sky-300',
      )}
    >
      {label}
    </span>
  )
}
