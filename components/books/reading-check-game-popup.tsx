'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getReadingCheckCorrectAnswerLabel,
  type ReadingCheckQuestion,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import {
  appendReadingCheckLiveMark,
  type ReadingCheckLiveMarkResult,
} from '@/lib/books/reading-check-live-marks'
import { playAnswerIncorrectBuzz } from '@/lib/audio/play-answer-feedback'
import { playRewardChime } from '@/lib/audio/play-reward-chime'
import { cn } from '@/lib/utils'

export type ReadingCheckGamePopupMode = 'live' | 'preview'

type ReviewState = {
  result: ReadingCheckLiveMarkResult
  selectedAnswer: string | null
  correctAnswer: string | null
}

export interface ReadingCheckGamePopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stop: ReadingCheckStop
  question: ReadingCheckQuestion
  /** Display title used for accessibility only. */
  title: string
  mode: ReadingCheckGamePopupMode
  storyId?: string
  bookId?: string | null
  studentId?: string | null
  classSessionId?: string | null
  /** Called after a persisted live mark (not in preview). */
  onLiveMarked?: (result: ReadingCheckLiveMarkResult) => void
}

function resolveChoiceAnswerLabel(question: ReadingCheckQuestion, choiceIndex: number): string | null {
  if (question.kind !== 'mcq') return null
  const choice = question.choices[choiceIndex]?.trim()
  if (!choice) return null
  return `${String.fromCharCode(65 + choiceIndex)}. ${choice}`
}

function choiceTone(correct: boolean, wrongPick: boolean, locked: boolean): string {
  if (!locked) return 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
  if (correct) return 'border-emerald-400 bg-emerald-50 text-emerald-950'
  if (wrongPick) return 'border-rose-400 bg-rose-50 text-rose-950'
  return 'border-slate-100 bg-slate-50 text-slate-400'
}

function badgeTone(correct: boolean, wrongPick: boolean, locked: boolean): string {
  if (!locked) return 'border-slate-200 bg-slate-50 text-slate-600'
  if (correct) return 'border-emerald-300 bg-emerald-100 text-emerald-800'
  if (wrongPick) return 'border-rose-300 bg-rose-100 text-rose-800'
  return 'border-slate-100 bg-slate-100 text-slate-400'
}

/**
 * Shared reading-check popup.
 * Preview mode: try answers without saving. Live mode: persist marks.
 * Minimal light card: question + answers; color feedback on tiles only.
 */
export function ReadingCheckGamePopup({
  open,
  onOpenChange,
  stop,
  question,
  title,
  mode,
  storyId,
  bookId = null,
  studentId = null,
  classSessionId = null,
  onLiveMarked,
}: ReadingCheckGamePopupProps) {
  const [mounted, setMounted] = useState(false)
  const [reviewState, setReviewState] = useState<ReviewState | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) setReviewState(null)
  }, [open, stop.id, question.id, question.prompt])

  if (!mounted || !open) return null

  function close() {
    setReviewState(null)
    onOpenChange(false)
  }

  function saveMark(
    result: ReadingCheckLiveMarkResult,
    selectedAnswer: string | null,
    correctAnswer: string | null,
  ) {
    if (mode !== 'live') return
    const sid = storyId?.trim()
    if (!sid) return
    appendReadingCheckLiveMark({
      storyId: sid,
      stopId: stop.id,
      result,
      studentId,
      bookId,
      classSessionId,
      selectedAnswer,
      correctAnswer,
    })
    onLiveMarked?.(result)
  }

  function revealAnswer(
    selectedAnswer: string | null,
    result: ReadingCheckLiveMarkResult,
    correctAnswer: string | null,
  ) {
    saveMark(result, selectedAnswer, correctAnswer)
    setReviewState({ result, selectedAnswer, correctAnswer })
    if (result === 'correct') {
      playRewardChime()
    } else if (result === 'incorrect') {
      playAnswerIncorrectBuzz()
    }
  }

  function markSkip() {
    saveMark('skip', null, getReadingCheckCorrectAnswerLabel(question))
    close()
  }

  function chooseTrueFalse(value: boolean) {
    if (question.kind !== 'true_false') return
    const correct = question.correctTrue === value
    revealAnswer(
      value ? 'True' : 'False',
      correct ? 'correct' : 'incorrect',
      getReadingCheckCorrectAnswerLabel(question),
    )
  }

  function chooseMcq(choiceIndex: number) {
    if (question.kind !== 'mcq') return
    const selectedAnswer = resolveChoiceAnswerLabel(question, choiceIndex)
    const correct = question.correctIndex === choiceIndex
    revealAnswer(
      selectedAnswer,
      correct ? 'correct' : 'incorrect',
      getReadingCheckCorrectAnswerLabel(question),
    )
  }

  const shakeCard = reviewState?.result === 'incorrect'

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="reading-check-backdrop absolute inset-0 border-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close reading check"
        onClick={close}
      />

      <div
        className={cn(
          'reading-check-card pointer-events-auto relative z-[1] w-full max-w-[560px] overflow-hidden rounded-3xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:max-w-[600px]',
          shakeCard && 'reading-check-shake',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-sky-400 to-[#3B6FD4]"
          aria-hidden
        />

        <div className="relative p-6 sm:p-7">
          <Button
            type="button"
            variant="ghost"
            className="absolute right-3 top-3 h-9 w-9 p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={close}
          >
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Close</span>
          </Button>

          <p className="pr-10 text-xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-2xl">
            {question.prompt}
          </p>

          <div className="mt-6 space-y-3">
            {question.kind === 'true_false'
              ? ([true, false] as const).map((value) => {
                  const label = value ? 'True' : 'False'
                  const locked = reviewState != null
                  const isCorrect = question.correctTrue === value
                  const wasChosen = reviewState?.selectedAnswer === label
                  const wrongPick = Boolean(wasChosen && !isCorrect)
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={locked}
                      className={cn(
                        'flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition',
                        choiceTone(isCorrect, wrongPick, locked),
                        locked && isCorrect && 'reading-check-choice-pop',
                        locked && wrongPick && 'reading-check-choice-wrong',
                      )}
                      onClick={() => chooseTrueFalse(value)}
                    >
                      <span className="text-base font-medium sm:text-lg">{label}</span>
                      {locked && isCorrect ? (
                        <Check className="h-5 w-5 animate-answer-word-pop text-emerald-600" aria-hidden />
                      ) : null}
                      {locked && wrongPick ? <X className="h-5 w-5 text-rose-500" aria-hidden /> : null}
                    </button>
                  )
                })
              : question.choices
                  .map((choice) => choice.trim())
                  .filter(Boolean)
                  .map((choice, i) => {
                    const label = `${String.fromCharCode(65 + i)}. ${choice}`
                    const locked = reviewState != null
                    const isCorrect = question.correctIndex === i
                    const wasChosen = reviewState?.selectedAnswer === label
                    const wrongPick = Boolean(wasChosen && !isCorrect)
                    return (
                      <button
                        key={`${stop.id}-choice-${i}`}
                        type="button"
                        disabled={locked}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition',
                          choiceTone(isCorrect, wrongPick, locked),
                          locked && isCorrect && 'reading-check-choice-pop',
                          locked && wrongPick && 'reading-check-choice-wrong',
                        )}
                        onClick={() => chooseMcq(i)}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                            badgeTone(isCorrect, wrongPick, locked),
                          )}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="min-w-0 flex-1 text-base leading-relaxed sm:text-lg">{choice}</span>
                        {locked && isCorrect ? (
                          <Check className="mt-0.5 h-5 w-5 shrink-0 animate-answer-word-pop text-emerald-600" aria-hidden />
                        ) : null}
                        {locked && wrongPick ? (
                          <X className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden />
                        ) : null}
                      </button>
                    )
                  })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={markSkip}
            >
              Skip
            </Button>
            {reviewState ? (
              <Button
                type="button"
                className="bg-[#3B6FD4] text-white hover:bg-[#335fc0]"
                onClick={close}
              >
                {mode === 'preview' ? 'Done' : 'Continue'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
