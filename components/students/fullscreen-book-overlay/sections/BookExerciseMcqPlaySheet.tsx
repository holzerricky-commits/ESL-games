'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trophy, X } from 'lucide-react'
import { WelcomeCelebrationLayer } from '@/components/students/welcome-celebration-layer'
import { Button } from '@/components/ui/button'
import { playAnswerIncorrectBuzz } from '@/lib/audio/play-answer-feedback'
import { playRewardChime } from '@/lib/audio/play-reward-chime'
import {
  gradeBookExerciseMcqSelections,
  emptyBookExerciseMcqSelections,
  type BookExerciseMcqSelections,
  type BookExerciseTask,
} from '@/lib/books/book-exercises'
import { cn } from '@/lib/utils'

function choiceTone(args: {
  checked: boolean
  isCorrect: boolean
  wrongPick: boolean
  selected: boolean
}): string {
  if (args.checked && args.isCorrect) {
    return 'border-emerald-500 bg-emerald-50 text-emerald-950'
  }
  if (args.checked && args.wrongPick) {
    return 'border-rose-500 bg-rose-50 text-rose-950'
  }
  if (args.checked) {
    return 'border-slate-100 bg-slate-50 text-slate-400'
  }
  if (args.selected) {
    return 'border-violet-500 bg-violet-50 text-violet-950 ring-2 ring-violet-400'
  }
  return 'border-slate-200 bg-white text-slate-900 hover:border-violet-300 hover:bg-violet-50/60'
}

function badgeTone(args: {
  checked: boolean
  isCorrect: boolean
  wrongPick: boolean
  selected: boolean
}): string {
  if (args.checked && args.isCorrect) {
    return 'border-emerald-300 bg-emerald-100 text-emerald-800'
  }
  if (args.checked && args.wrongPick) {
    return 'border-rose-300 bg-rose-100 text-rose-800'
  }
  if (args.selected) {
    return 'border-violet-400 bg-violet-100 text-violet-800'
  }
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export function BookExerciseMcqPlaySheet({
  task,
  onClose,
}: {
  task: BookExerciseTask
  onClose: () => void
}) {
  const [mode, setMode] = useState<'answer' | 'result' | 'review'>('answer')
  const [mounted, setMounted] = useState(false)
  const [selections, setSelections] = useState<BookExerciseMcqSelections>(() =>
    emptyBookExerciseMcqSelections(task),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [grade, setGrade] = useState<ReturnType<typeof gradeBookExerciseMcqSelections> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setMode('answer')
    setSelections(emptyBookExerciseMcqSelections(task))
    setCurrentIndex(0)
    setReviewIndex(0)
    setGrade(null)
  }, [task.id])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const answerQuestion = task.questions[currentIndex] ?? null
  const answerPick = answerQuestion ? (selections[answerQuestion.id] ?? null) : null
  const reviewQuestions = useMemo(
    () => (grade ? task.questions.filter((question) => grade.byQuestion[question.id] === false) : []),
    [grade, task.questions],
  )
  const reviewQuestion = reviewQuestions[reviewIndex] ?? null
  const score = grade?.correctCount ?? 0
  const totalQuestions = task.questions.length
  const shakeCard = mode === 'result' && Boolean(grade && !grade.allCorrect)

  function pickChoice(questionId: string, choiceIndex: number) {
    if (mode !== 'answer') return
    setSelections((prev) => ({ ...prev, [questionId]: choiceIndex }))
  }

  function goNext() {
    if (!answerQuestion || answerPick == null) return
    if (currentIndex < task.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      return
    }
    const next = gradeBookExerciseMcqSelections(task, selections)
    setGrade(next)
    setMode('result')
    if (next.allCorrect) playRewardChime()
    else playAnswerIncorrectBuzz()
  }

  function onTryAgain() {
    setMode('answer')
    setSelections(emptyBookExerciseMcqSelections(task))
    setCurrentIndex(0)
    setReviewIndex(0)
    setGrade(null)
  }

  function startReviewWrongOnes() {
    if (!grade || grade.allCorrect) return
    setReviewIndex(0)
    setMode('review')
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="reading-check-backdrop absolute inset-0 border-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close exercise"
        onClick={onClose}
      />

      <div
        data-book-overlay-modal=""
        className="reading-check-card pointer-events-auto relative z-[1] w-full max-w-[640px] overflow-hidden rounded-3xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-label={task.label}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={cn(shakeCard && 'reading-check-shake')}>
          <div
            className="h-1.5 w-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-[#AF52DE]"
            aria-hidden
          />

          <div className="relative p-6 sm:p-7">
            <Button
              type="button"
              variant="ghost"
              className="absolute right-3 top-3 h-9 w-9 p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
            >
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Close</span>
            </Button>

            <p className="pr-10 text-sm font-semibold uppercase tracking-wide text-violet-600">{task.label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Choose the correct answer
            </p>
            {mode === 'answer' && answerQuestion ? (
              <>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-500">
                    Question {currentIndex + 1} of {task.questions.length}
                  </p>
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-[#AF52DE] transition-all"
                      style={{ width: `${((currentIndex + 1) / task.questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 min-h-[320px]">
                  <p className="text-2xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                    {answerQuestion.prompt}
                  </p>
                  <div className="mt-5 space-y-3">
                    {answerQuestion.choices
                      .map((choice, index) => ({ choice: choice.trim(), index }))
                      .filter((entry) => entry.choice.length > 0)
                      .map(({ choice, index }) => {
                        const selected = answerPick === index
                        return (
                          <button
                            key={`${answerQuestion.id}-${index}`}
                            type="button"
                            className={cn(
                              'flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition',
                              choiceTone({
                                checked: false,
                                isCorrect: false,
                                wrongPick: false,
                                selected,
                              }),
                            )}
                            onClick={() => pickChoice(answerQuestion.id, index)}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                                badgeTone({
                                  checked: false,
                                  isCorrect: false,
                                  wrongPick: false,
                                  selected,
                                }),
                              )}
                            >
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span className="min-w-0 flex-1 text-base leading-relaxed sm:text-lg">{choice}</span>
                          </button>
                        )
                      })}
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Back
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-1.5 bg-[#AF52DE] text-white hover:bg-[#9b44c9]"
                      disabled={answerPick == null}
                      onClick={goNext}
                    >
                      {currentIndex === task.questions.length - 1 ? 'Finish' : 'Next'}
                      {currentIndex === task.questions.length - 1 ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {mode === 'result' && grade ? (
              <div className="relative mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-b from-violet-50 via-white to-slate-50 px-6 py-8 text-center sm:px-8">
                <WelcomeCelebrationLayer active={grade.allCorrect} />
                <div className="relative z-[6]">
                  <div
                    className={cn(
                      'mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-sm',
                      grade.allCorrect
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                        : 'border-amber-200 bg-amber-100 text-amber-700',
                    )}
                  >
                    <Trophy className="h-10 w-10" aria-hidden />
                  </div>
                  <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                    {score}/{totalQuestions}
                  </p>
                  <p
                    className={cn(
                      'mt-3 text-xl font-semibold',
                      grade.allCorrect ? 'text-emerald-700' : 'text-amber-700',
                    )}
                  >
                    {grade.allCorrect ? 'Great job!' : 'Nice try!'}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
                    {grade.allCorrect
                      ? 'You got every answer right.'
                      : `You got ${score} right. You can try again or look at the ones that went wrong.`}
                  </p>

                  <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                    {grade.allCorrect ? (
                      <Button type="button" className="bg-[#AF52DE] text-white hover:bg-[#9b44c9]" onClick={onClose}>
                        Close
                      </Button>
                    ) : (
                      <>
                        <Button type="button" variant="outline" className="gap-1.5" onClick={startReviewWrongOnes}>
                          Review wrong ones
                        </Button>
                        <Button
                          type="button"
                          className="gap-1.5 bg-[#AF52DE] text-white hover:bg-[#9b44c9]"
                          onClick={onTryAgain}
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden />
                          Try again
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {mode === 'review' && reviewQuestion && grade ? (
              <>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-rose-600">
                    Wrong answer {reviewIndex + 1} of {reviewQuestions.length}
                  </p>
                  <div className="h-2 flex-1 rounded-full bg-rose-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 transition-all"
                      style={{ width: `${((reviewIndex + 1) / reviewQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 min-h-[320px]">
                  <p className="text-2xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-3xl">
                    {reviewQuestion.prompt}
                  </p>
                  <div className="mt-5 space-y-3">
                    {reviewQuestion.choices
                      .map((choice, index) => ({ choice: choice.trim(), index }))
                      .filter((entry) => entry.choice.length > 0)
                      .map(({ choice, index }) => {
                        const selected = selections[reviewQuestion.id] === index
                        const isCorrect = reviewQuestion.correctIndex === index
                        const wrongPick = Boolean(selected && !isCorrect)
                        return (
                          <div
                            key={`${reviewQuestion.id}-${index}`}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition',
                              choiceTone({
                                checked: true,
                                isCorrect,
                                wrongPick,
                                selected: false,
                              }),
                              isCorrect && 'reading-check-choice-pop',
                              wrongPick && 'reading-check-choice-wrong',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                                badgeTone({
                                  checked: true,
                                  isCorrect,
                                  wrongPick,
                                  selected: false,
                                }),
                              )}
                            >
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span className="min-w-0 flex-1 text-base leading-relaxed sm:text-lg">{choice}</span>
                            {isCorrect ? (
                              <Check
                                className="mt-0.5 h-5 w-5 shrink-0 animate-answer-word-pop text-emerald-600"
                                aria-hidden
                              />
                            ) : null}
                            {wrongPick ? (
                              <X className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden />
                            ) : null}
                          </div>
                        )
                      })}
                  </div>
                  <p className="mt-3 text-sm font-medium text-rose-700">Red was the wrong pick. Green is the right answer.</p>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    disabled={reviewIndex === 0}
                    onClick={() => setReviewIndex((prev) => Math.max(0, prev - 1))}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="gap-1.5" onClick={onTryAgain}>
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      Try again
                    </Button>
                    {reviewIndex < reviewQuestions.length - 1 ? (
                      <Button
                        type="button"
                        className="gap-1.5 bg-[#AF52DE] text-white hover:bg-[#9b44c9]"
                        onClick={() => setReviewIndex((prev) => prev + 1)}
                      >
                        Next
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="bg-[#AF52DE] text-white hover:bg-[#9b44c9]"
                        onClick={() => setMode('result')}
                      >
                        Done
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
