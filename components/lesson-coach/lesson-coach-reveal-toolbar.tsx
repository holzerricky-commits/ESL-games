'use client'

import { Eye, Highlighter, RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GrammarIssue } from '@/lib/lesson-coach/types'
import {
  getActiveRevealIssue,
  patchApplyFix,
  patchHighlightNext,
  patchShowFix,
  patchUndoApply,
} from '@/lib/lesson-coach/issue-reveal'
import type { LessonCoachSession, LessonCoachSessionPatch } from '@/lib/lesson-coach/types'

type LessonCoachRevealToolbarProps = {
  session: LessonCoachSession
  patch: (body: LessonCoachSessionPatch) => Promise<LessonCoachSession>
}

export function LessonCoachRevealToolbar({ session, patch }: LessonCoachRevealToolbarProps) {
  const active = getActiveRevealIssue(session.issues)
  const hasHidden = session.issues.some((i) => i.status === 'hidden')
  const canShowFix = active?.status === 'highlighted'
  const canApply = active?.status === 'revealed' && Boolean(active.suggestion)
  const canUndo = (session.textUndoStack?.length ?? 0) > 0

  const run = (body: LessonCoachSessionPatch | null) => {
    if (!body) return
    void patch(body)
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-xs text-amber-200/70">
        Staged reveal — students see highlight on shared screen only until you apply a fix.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!hasHidden}
          onClick={() => run(patchHighlightNext(session.issues, session.revealIndex))}
          className="min-h-11 flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
        >
          <Highlighter className="mr-1.5 h-4 w-4 shrink-0" />
          Highlight next
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canShowFix}
          onClick={() => run(patchShowFix(session.issues))}
          className="min-h-11 flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
        >
          <Eye className="mr-1.5 h-4 w-4 shrink-0" />
          Show fix
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canApply}
          onClick={() =>
            run(
              patchApplyFix(
                session.sharedText,
                session.issues,
                session.textUndoStack ?? [],
              ),
            )
          }
          className="min-h-11 flex-1 border-amber-700/60 bg-amber-700/30 text-amber-50 hover:bg-amber-700/40"
        >
          <Wand2 className="mr-1.5 h-4 w-4 shrink-0" />
          Apply fix
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canUndo}
          onClick={() => run(patchUndoApply(session.textUndoStack ?? []))}
          className="min-h-11 border-zinc-600 bg-transparent text-zinc-300 hover:bg-zinc-800"
        >
          <RotateCcw className="mr-1.5 h-4 w-4 shrink-0" />
          Undo
        </Button>
      </div>
      {active ? (
        <p className="text-xs text-zinc-500">
          Active: {statusLabel(active.status)}
          {active.status === 'revealed' && active.suggestion ? (
            <span className="text-amber-200/90"> — {active.suggestion}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

function statusLabel(status: GrammarIssue['status']): string {
  switch (status) {
    case 'highlighted':
      return 'highlight on shared screen'
    case 'revealed':
      return 'fix visible to you only'
    case 'applied':
      return 'applied on shared text'
    default:
      return 'hidden'
  }
}
