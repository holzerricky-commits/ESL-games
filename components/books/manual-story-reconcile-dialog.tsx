'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ManualStoryReconcileAction } from '@/lib/books/reading-story-outline-migrate'

export type ManualStoryReconcileCandidateRow = {
  manualStoryId: string
  manualTitle: string
  manualStartPage: number
  manualEndPage: number
  outlineStoryId: string | null
  outlineTitle: string | null
  outlineLessonTitle: string | null
  confidence: 'high' | 'medium' | 'none'
  suggestedAction: ManualStoryReconcileAction
  suggestedKeepUnitId: string | null
  canMerge: boolean
}

export type ManualStoryReconcileDecisionRow = {
  manualStoryId: string
  action: ManualStoryReconcileAction
  outlineStoryId?: string
  keepUnitId?: string | null
}

type Props = {
  open: boolean
  bookTitle: string
  candidates: ManualStoryReconcileCandidateRow[]
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (decisions: ManualStoryReconcileDecisionRow[]) => void
  onSkip: () => void
}

function confidenceLabel(c: ManualStoryReconcileCandidateRow['confidence']): string {
  if (c === 'high') return 'Strong match'
  if (c === 'medium') return 'Likely match'
  return 'No match'
}

function buildInitialActions(
  candidates: ManualStoryReconcileCandidateRow[],
): Record<string, ManualStoryReconcileAction> {
  const map: Record<string, ManualStoryReconcileAction> = {}
  for (const c of candidates) {
    let action = c.suggestedAction
    if (!c.canMerge && action === 'merge') action = 'keep'
    map[c.manualStoryId] = action
  }
  return map
}

function defaultAction(c: ManualStoryReconcileCandidateRow): ManualStoryReconcileAction {
  if (c.canMerge && c.suggestedAction === 'merge') return 'merge'
  if (c.suggestedAction === 'delete') return 'delete'
  return 'keep'
}

export function ManualStoryReconcileDialog({
  open,
  bookTitle,
  candidates,
  busy = false,
  onOpenChange,
  onConfirm,
  onSkip,
}: Props) {
  const [actions, setActions] = useState<Record<string, ManualStoryReconcileAction>>(() =>
    buildInitialActions(candidates),
  )

  useEffect(() => {
    if (!open) return
    setActions(buildInitialActions(candidates))
  }, [open, candidates])

  function setAllMergeableToMerge() {
    setActions((prev) => {
      const next = { ...prev }
      for (const c of candidates) {
        next[c.manualStoryId] = c.canMerge ? 'merge' : 'keep'
      }
      return next
    })
  }

  function setAllDelete() {
    setActions((prev) => {
      const next = { ...prev }
      for (const c of candidates) next[c.manualStoryId] = 'delete'
      return next
    })
  }

  function confirm() {
    const decisions: ManualStoryReconcileDecisionRow[] = candidates.map((c) => {
      const action = actions[c.manualStoryId] ?? defaultAction(c)
      if (action === 'merge' && c.outlineStoryId) {
        return {
          manualStoryId: c.manualStoryId,
          action: 'merge',
          outlineStoryId: c.outlineStoryId,
        }
      }
      if (action === 'delete') {
        return { manualStoryId: c.manualStoryId, action: 'delete' }
      }
      return {
        manualStoryId: c.manualStoryId,
        action: 'keep',
        keepUnitId: c.suggestedKeepUnitId,
      }
    })
    onConfirm(decisions)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Manual stories on this book</DialogTitle>
          <DialogDescription>
            {bookTitle} already had stories you added by hand. The new outline may list the same
            reads again. Choose what to do with each — merge moves text and reading checks onto the
            outline story.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={setAllMergeableToMerge}>
            Merge all matches
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={setAllDelete}>
            Delete all manuals
          </Button>
        </div>

        <ul className="space-y-3">
          {candidates.map((c) => {
            const action = actions[c.manualStoryId] ?? defaultAction(c)
            return (
              <li
                key={c.manualStoryId}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">{c.manualTitle}</p>
                  <span className="text-xs text-muted-foreground">
                    pp. {c.manualStartPage}–{c.manualEndPage}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.canMerge ? (
                    <>
                      → {c.outlineTitle}
                      {c.outlineLessonTitle ? ` · ${c.outlineLessonTitle}` : ''}{' '}
                      <span className="text-muted-foreground/80">({confidenceLabel(c.confidence)})</span>
                    </>
                  ) : (
                    <>No outline story matched — keep under a new unit, or delete.</>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'merge' as const, label: 'Merge', disabled: !c.canMerge },
                      { id: 'keep' as const, label: 'Keep', disabled: false },
                      { id: 'delete' as const, label: 'Delete', disabled: false },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={busy || opt.disabled}
                      onClick={() =>
                        setActions((prev) => ({ ...prev, [c.manualStoryId]: opt.id }))
                      }
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        action === opt.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:bg-muted',
                        opt.disabled && 'opacity-40',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" disabled={busy} onClick={onSkip}>
            Decide later
          </Button>
          <Button type="button" disabled={busy} onClick={confirm}>
            {busy ? 'Applying…' : 'Apply choices'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
