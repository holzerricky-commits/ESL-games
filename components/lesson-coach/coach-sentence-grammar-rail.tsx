'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LessonCoachSessionPatch } from '@/lib/lesson-coach/types'
import type { CoachActiveField } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { useLessonCoachSync } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { getActiveRevealIssue } from '@/lib/lesson-coach/issue-reveal'
import {
  patchApplyFromHighlight,
  patchHighlightNext,
} from '@/lib/lesson-coach/issue-reveal'
import { cn } from '@/lib/utils'

export type CoachSentenceGrammarVariant = 'overlay' | 'paper'

type CoachSentenceGrammarPanelProps = {
  text: string
  coachField: CoachActiveField
  variant?: CoachSentenceGrammarVariant
}

/** Show grammar UI on the field being edited or the field that was last checked. */
export function shouldShowGrammarPanel(
  coachField: CoachActiveField,
  localText: string,
  sessionId: string | null,
  activeField: CoachActiveField | null,
  sessionActiveField: CoachActiveField | null | undefined,
): boolean {
  if (!localText.trim() || !sessionId) return false
  if (activeField === coachField) return true
  if (activeField == null && sessionActiveField === coachField) return true
  return false
}

function variantStyles(variant: CoachSentenceGrammarVariant) {
  if (variant === 'paper') {
    return {
      check:
        'border-[#c8c8c8] bg-white text-[#333] shadow-sm hover:border-amber-400/60 hover:bg-amber-50/90',
      card: 'border-[#e4e4e4] bg-white text-[#333] shadow-sm',
      count: 'text-amber-900',
      ok: 'text-emerald-700',
      action:
        'border-[#dadada] bg-[#fafafa] text-[#444] hover:border-amber-400/50 hover:bg-amber-50 disabled:opacity-40',
      actionActive: 'border-amber-500/50 bg-amber-50 text-amber-900',
      ruleBtn: 'border-[#e8e8e8] bg-[#fafafa] text-[#666] hover:bg-white',
      ruleBody: 'border-[#ececec] bg-[#fafafa] text-[#555]',
      ruleTitle: 'text-[#222]',
      ruleTry: 'text-amber-800',
      ruleExplain: 'text-[#666]',
    }
  }
  return {
    check:
      'border-white/25 bg-black/55 text-white/90 shadow-md hover:border-amber-400/45 hover:bg-amber-500/25',
    card: 'border-white/20 bg-black/60 text-white/90 shadow-md backdrop-blur-sm',
    count: 'text-amber-100',
    ok: 'text-emerald-300',
    action:
      'border-white/20 bg-black/45 text-white/85 hover:border-amber-400/40 hover:bg-amber-500/20 disabled:opacity-40',
    actionActive: 'border-amber-400/50 bg-amber-500/30 text-amber-50',
    ruleBtn: 'border-white/15 bg-black/40 text-white/70 hover:bg-black/55',
    ruleBody: 'border-white/10 bg-black/50 text-white/80',
    ruleTitle: 'text-white/95',
    ruleTry: 'text-amber-200/90',
    ruleExplain: 'text-white/65',
  }
}

/**
 * Two-tier grammar UX on the shared screen: text "Check" then an anchored teaching card
 * (count, Show mistake, Fix, expandable Rule) below the sentence.
 */
export function CoachSentenceGrammarPanel({
  text,
  coachField,
  variant = 'overlay',
}: CoachSentenceGrammarPanelProps) {
  const {
    session,
    sessionId,
    issueCount,
    activeField,
    syncSharedText,
    runGrammarCheck,
    checkBusy,
    patchSession,
  } = useLessonCoachSync()

  const [ruleOpen, setRuleOpen] = useState(false)
  const trimmed = text.trim()

  const show = shouldShowGrammarPanel(
    coachField,
    trimmed,
    sessionId,
    activeField,
    session?.activeField,
  )
  if (!show) return null

  const styles = variantStyles(variant)
  const issues = session?.issues ?? []
  const active = getActiveRevealIssue(issues)
  const openCount = issues.filter((i) => i.status !== 'applied').length
  const hasChecked = issues.length > 0 || issueCount > 0
  const canShow = openCount > 0
  const canFix = active?.status === 'highlighted' && Boolean(active.suggestion)

  const ruleIssue =
    active ??
    [...issues].reverse().find((i) => i.status === 'applied' && (i.explanation || i.message))

  const runPatch = (body: LessonCoachSessionPatch | null) => {
    if (!body || !sessionId) return
    void patchSession(body)
  }

  const onCheck = () => {
    syncSharedText(trimmed, coachField)
    if (sessionId) {
      void patchSession({ sharedText: trimmed, activeField: coachField })
    }
    void runGrammarCheck()
  }

  return (
    <div
      className={cn(
        'pointer-events-auto mt-1 flex w-full min-w-[8.5rem] max-w-[min(18rem,92vw)] flex-col gap-1.5',
        variant === 'paper' ? 'max-w-full' : '',
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!hasChecked ? (
        <button
          type="button"
          className={cn(
            'w-fit rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
            styles.check,
            checkBusy && 'opacity-70',
          )}
          disabled={checkBusy}
          onClick={onCheck}
        >
          {checkBusy ? 'Checking…' : 'Check'}
        </button>
      ) : (
        <div className={cn('rounded-lg border px-2.5 py-2', styles.card)}>
          {openCount > 0 ? (
            <p className={cn('text-[11px] font-semibold tabular-nums', styles.count)}>
              {openCount} mistake{openCount === 1 ? '' : 's'}
            </p>
          ) : (
            <p className={cn('text-[11px] font-semibold', styles.ok)}>Looks good</p>
          )}

          {openCount > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                  active?.status === 'highlighted' ? styles.actionActive : styles.action,
                )}
                disabled={!canShow || !sessionId}
                onClick={() =>
                  runPatch(patchHighlightNext(issues, session?.revealIndex ?? -1))
                }
              >
                Show mistake
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                  styles.action,
                  canFix && styles.actionActive,
                )}
                disabled={!canFix || !session?.sharedText || !sessionId}
                onClick={() => {
                  if (!session) return
                  const body = patchApplyFromHighlight(
                    session.sharedText,
                    issues,
                    session.textUndoStack ?? [],
                  )
                  runPatch(body)
                }}
              >
                Fix
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={cn(
                'mt-2 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                styles.action,
              )}
              disabled={checkBusy}
              onClick={onCheck}
            >
              Check again
            </button>
          )}

          {ruleIssue && (ruleIssue.explanation || ruleIssue.message) ? (
            <div className="mt-2 border-t border-inherit pt-2">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-between gap-1 rounded-md border px-2 py-1 text-left text-[10px] font-medium',
                  styles.ruleBtn,
                )}
                onClick={() => setRuleOpen((o) => !o)}
                aria-expanded={ruleOpen}
              >
                <span>Rule</span>
                <ChevronDown
                  className={cn('h-3 w-3 shrink-0 transition-transform', ruleOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>
              {ruleOpen ? (
                <div
                  className={cn(
                    'mt-1 rounded-md border px-2 py-1.5 text-[11px] leading-snug',
                    styles.ruleBody,
                  )}
                >
                  {ruleIssue.message ? (
                    <p className={cn('font-medium', styles.ruleTitle)}>{ruleIssue.message}</p>
                  ) : null}
                  {ruleIssue.suggestion && active?.status !== 'applied' ? (
                    <p className={cn('mt-1', styles.ruleTry)}>Try: {ruleIssue.suggestion}</p>
                  ) : null}
                  {ruleIssue.explanation ? (
                    <p className={cn('mt-1', styles.ruleExplain)}>{ruleIssue.explanation}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

/** @deprecated Use CoachSentenceGrammarPanel */
export const CoachSentenceGrammarRail = CoachSentenceGrammarPanel
