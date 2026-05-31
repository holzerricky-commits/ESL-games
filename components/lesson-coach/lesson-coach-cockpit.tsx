'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { LessonCoachSession, LessonCoachSessionPatch } from '@/lib/lesson-coach/types'
import { CoachDictationSentenceChrome } from '@/components/lesson-coach/coach-dictation-sentence-chrome'
import { fetchGrammarCheck } from '@/lib/lesson-coach/fetch-grammar-check'
import { toGrammarCheckPatch } from '@/lib/lesson-coach/grammar-check'
import { LessonCoachIssuesList } from '@/components/lesson-coach/lesson-coach-issues-list'
import { cn } from '@/lib/utils'

const PACING_SAVE_MS = 500

type LessonCoachCockpitProps = {
  session: LessonCoachSession
  patch: (body: LessonCoachSessionPatch) => Promise<LessonCoachSession>
}

export function LessonCoachCockpit({ session, patch }: LessonCoachCockpitProps) {
  const [pacingDraft, setPacingDraft] = useState(session.pacingNotes)
  const [pacingDirty, setPacingDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [checkBusy, setCheckBusy] = useState(false)
  const [checkWarning, setCheckWarning] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAppliedUpdateRef = useRef(session.updatedAt)

  useEffect(() => {
    if (pacingDirty) return
    if (session.updatedAt === lastAppliedUpdateRef.current) return
    lastAppliedUpdateRef.current = session.updatedAt
    setPacingDraft(session.pacingNotes)
  }, [session.pacingNotes, session.updatedAt, pacingDirty])

  const flushPacing = useCallback(
    async (text: string) => {
      setSaveState('saving')
      try {
        await patch({ pacingNotes: text })
        setPacingDirty(false)
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1500)
      } catch {
        setSaveState('error')
      }
    },
    [patch],
  )

  const schedulePacingSave = useCallback(
    (text: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        void flushPacing(text)
      }, PACING_SAVE_MS)
    },
    [flushPacing],
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const onPacingChange = (value: string) => {
    setPacingDraft(value)
    setPacingDirty(true)
    setSaveState('idle')
    schedulePacingSave(value)
  }

  const togglePrompt = (index: number) => {
    const next = session.promptScript.map((_, i) => {
      const prev = session.promptChecked[i] ?? false
      return i === index ? !prev : (session.promptChecked[i] ?? false)
    })
    void patch({ promptChecked: next })
  }

  const addCustomPrompt = () => {
    const nextScript = [...session.promptScript, 'Your question here…']
    const nextChecked = [...session.promptChecked, false]
    void patch({ promptScript: nextScript, promptChecked: nextChecked })
  }

  const runGrammarCheck = async () => {
    const text = session.sharedText
    if (!text.trim()) return
    setCheckBusy(true)
    setCheckWarning(null)
    try {
      const result = await fetchGrammarCheck(text)
      await patch(toGrammarCheckPatch(result))
      setCheckWarning(result.warning ?? null)
      setCheckedAt(Date.now())
    } catch (e) {
      setCheckWarning(e instanceof Error ? e.message : 'Check failed')
    } finally {
      setCheckBusy(false)
    }
  }

  const contextRows = [
    session.studentName ? { label: 'Student', value: session.studentName } : null,
    session.bookTitle || session.bookId
      ? { label: 'Book', value: session.bookTitle ?? session.bookId! }
      : null,
    session.unitTitle || session.unitId
      ? { label: 'Unit', value: session.unitTitle ?? session.unitId! }
      : null,
    session.lessonTitle || session.lessonId
      ? { label: 'Lesson', value: session.lessonTitle ?? session.lessonId! }
      : null,
    session.partTitle || session.partId
      ? { label: 'Part', value: session.partTitle ?? session.partId! }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const showStudentText = session.dictationMode || session.sharedText.trim().length > 0

  const activeFieldLabel =
    session.activeField === 'whiteboard'
      ? 'Whiteboard'
      : session.activeField === 'label'
        ? 'Book label'
        : session.activeField === 'lesson-paper'
          ? 'Lesson notebook'
          : null

  return (
    <div className="flex flex-col gap-5 pb-8">
      {contextRows.length > 0 ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Lesson</h2>
          <dl className="mt-3 space-y-2">
            {contextRows.map((row) => (
              <div key={row.label} className="flex gap-3 text-sm">
                <dt className="w-16 shrink-0 text-zinc-500">{row.label}</dt>
                <dd className="min-w-0 font-medium text-zinc-100">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {showStudentText ? (
        <section className="rounded-xl border border-amber-800/40 bg-amber-950/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-amber-100">Student sentence</h2>
            <div className="flex flex-wrap items-center gap-2">
              {session.dictationMode ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  Dictation
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={checkBusy || !session.sharedText.trim()}
                onClick={() => void runGrammarCheck()}
                className="min-h-10 border-amber-600/50 bg-amber-600/20 text-amber-50 hover:bg-amber-600/30"
              >
                {checkBusy ? '…' : 'Check'}
              </Button>
            </div>
          </div>
          <p className="mt-1 text-xs text-amber-200/70">
            {activeFieldLabel ? (
              <>
                Typed on <strong className="font-medium text-amber-100">{activeFieldLabel}</strong>
                {' — '}
              </>
            ) : (
              'Student text'
            )}
            {checkedAt ? (
              <span className="text-amber-200/50"> · checked</span>
            ) : null}
          </p>
          {checkWarning ? (
            <p className="mt-1 text-xs text-amber-200/80">{checkWarning}</p>
          ) : null}
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-amber-800/30 bg-zinc-950/80 p-3">
            <CoachDictationSentenceChrome
              variant="coach"
              text={session.sharedText}
              issues={session.issues}
            >
              <span className="sr-only">Grammar controls are on the shared screen beside the sentence</span>
            </CoachDictationSentenceChrome>
            {!session.sharedText.trim() ? (
              <p className="text-base leading-relaxed text-zinc-500 italic">Waiting for text…</p>
            ) : null}
          </div>

          {checkedAt != null || session.issues.length > 0 ? (
            <div className="mt-3 border-t border-amber-800/25 pt-3">
              <p className="mb-2 text-xs text-amber-200/60">
                Use Check below the sentence on the shared screen, then Show mistake, Fix, and Rule
                in the card that appears.
              </p>
              <LessonCoachIssuesList text={session.sharedText} issues={session.issues} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">Pacing guide</h2>
          <span className="text-xs text-zinc-500">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved'
                : saveState === 'error'
                  ? 'Save failed'
                  : pacingDirty
                    ? 'Editing…'
                    : 'Auto-save'}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Only you see this — plan the flow for this part.</p>
        <Textarea
          value={pacingDraft}
          onChange={(e) => onPacingChange(e.target.value)}
          placeholder="e.g. Quick vocab review → student reads → dictation → fix errors…"
          className="mt-3 min-h-[140px] resize-y border-zinc-700 bg-zinc-950 text-base text-zinc-100 placeholder:text-zinc-600"
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">What to ask</h2>
        <p className="mt-1 text-xs text-zinc-500">Tap when you have used a line. Large text for at-a-glance reading.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {session.promptScript.map((line, index) => {
            const done = session.promptChecked[index] ?? false
            return (
              <li key={`${index}-${line.slice(0, 24)}`}>
                <button
                  type="button"
                  onClick={() => togglePrompt(index)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    done
                      ? 'border-emerald-800/60 bg-emerald-950/40 text-zinc-500 line-through'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-100 active:bg-zinc-800',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                      done
                        ? 'border-emerald-600 bg-emerald-600/30 text-emerald-300'
                        : 'border-zinc-600 text-transparent',
                    )}
                    aria-hidden
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  <span className="text-base leading-snug">{line}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800"
          onClick={addCustomPrompt}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add your own prompt
        </Button>
      </section>

      <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-2 text-center text-xs text-zinc-500">
        Tip: In Safari or Chrome, use <strong className="text-zinc-400">Add to Home Screen</strong> for a
        quick app icon.
      </p>
    </div>
  )
}
