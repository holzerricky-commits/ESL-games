'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  BOOK_EXERCISE_MCQ_MAX_CHOICES,
  BOOK_EXERCISE_MCQ_MIN_CHOICES,
  bookExerciseTaskCanApprove,
  countBookExerciseBlanks,
  createEmptyBookExerciseItem,
  createEmptyBookExerciseMcqQuestion,
  formatWordBankText,
  isBookExerciseMultipleChoice,
  parseWordBankText,
  sanitizeBookExerciseMcqQuestion,
  type BookExerciseItem,
  type BookExerciseMcqQuestion,
  type BookExerciseTask,
} from '@/lib/books/book-exercises'
import { cn } from '@/lib/utils'

const fieldClass =
  'border-white/15 bg-black/25 text-xs text-white placeholder:text-white/35 focus-visible:ring-white/25'

type WordBankEditorDraft = {
  label: string
  wordBankText: string
  items: BookExerciseItem[]
}

type McqEditorDraft = {
  label: string
  questions: BookExerciseMcqQuestion[]
}

function wordBankDraftFromTask(task: BookExerciseTask): WordBankEditorDraft {
  return {
    label: task.label,
    wordBankText: formatWordBankText(task.wordBank),
    items: task.items.length
      ? task.items.map((item) => ({ ...item, answers: [...item.answers] }))
      : [createEmptyBookExerciseItem()],
  }
}

function mcqDraftFromTask(task: BookExerciseTask): McqEditorDraft {
  return {
    label: task.label,
    questions: task.questions.length
      ? task.questions.map((question) => ({
          ...question,
          choices: [...question.choices],
        }))
      : [createEmptyBookExerciseMcqQuestion()],
  }
}

function alignedAnswers(stem: string, answers: string[]): string[] {
  const blanks = countBookExerciseBlanks(stem)
  const next = answers.slice(0, blanks)
  while (next.length < blanks) next.push('')
  return next
}

function normalizeMcqDraftQuestions(questions: BookExerciseMcqQuestion[]): BookExerciseMcqQuestion[] {
  return questions
    .map((question) => sanitizeBookExerciseMcqQuestion(question))
    .filter((question): question is BookExerciseMcqQuestion => !!question)
}

export type BookExerciseTaskEditorProps = {
  task: BookExerciseTask
  saving: boolean
  drafting?: boolean
  onBack: () => void
  onDraftFromBox?: () => Promise<boolean>
  onSaveDraft: (next: {
    label: string
    wordBank?: string[]
    items?: BookExerciseItem[]
    questions?: BookExerciseMcqQuestion[]
  }) => Promise<boolean>
  onApprove: (next: {
    label: string
    wordBank?: string[]
    items?: BookExerciseItem[]
    questions?: BookExerciseMcqQuestion[]
  }) => Promise<boolean>
  onUnapprove: () => Promise<boolean>
}

export function BookExerciseTaskEditor({
  task,
  saving,
  drafting = false,
  onBack,
  onDraftFromBox,
  onSaveDraft,
  onApprove,
  onUnapprove,
}: BookExerciseTaskEditorProps) {
  const [wordBankDraft, setWordBankDraft] = useState<WordBankEditorDraft>(() => wordBankDraftFromTask(task))
  const [mcqDraft, setMcqDraft] = useState<McqEditorDraft>(() => mcqDraftFromTask(task))

  useEffect(() => {
    setWordBankDraft(wordBankDraftFromTask(task))
    setMcqDraft(mcqDraftFromTask(task))
  }, [task.id, task.updatedAt])

  const approved = task.status === 'approved'
  const busy = saving || drafting

  if (isBookExerciseMultipleChoice(task)) {
    const previewTask: BookExerciseTask = {
      ...task,
      label: mcqDraft.label.trim() || task.label,
      questions: normalizeMcqDraftQuestions(mcqDraft.questions),
    }
    const canApprove = bookExerciseTaskCanApprove(previewTask)
    const payload = () => ({
      label: previewTask.label,
      questions: previewTask.questions,
    })

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-1 py-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onBack}
            aria-label="Back to exercise list"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            value={mcqDraft.label}
            onChange={(event) => setMcqDraft((prev) => ({ ...prev, label: event.target.value }))}
            className={cn('h-7 border-white/15 bg-transparent px-1.5 text-xs font-medium text-white', fieldClass)}
            aria-label="Task name"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:thin] [scrollbar-color:#52525b_transparent]">
          <p
            className={cn(
              'rounded-md px-2 py-1 text-[10px] font-medium',
              approved
                ? 'bg-emerald-500/15 text-emerald-200'
                : canApprove
                  ? 'bg-white/8 text-white/70'
                  : 'bg-white/5 text-white/45',
            )}
          >
            {approved
              ? 'Approved — tap the pin in class to Check.'
              : canApprove
                ? 'Ready to approve. Draft stays off class until you do.'
                : 'Draft from the box, or type each question, 2–4 choices, and pick the correct answer.'}
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">Questions</span>
            {mcqDraft.questions.map((question, questionIndex) => (
              <div key={question.id} className="rounded-md border border-white/10 bg-white/5 p-1.5">
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="text-[10px] text-white/40">{questionIndex + 1}</span>
                  {mcqDraft.questions.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-white/45 hover:bg-white/10 hover:text-white"
                      aria-label={`Remove question ${questionIndex + 1}`}
                      onClick={() =>
                        setMcqDraft((prev) => ({
                          ...prev,
                          questions: prev.questions.filter((row) => row.id !== question.id),
                        }))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
                <Textarea
                  value={question.prompt}
                  onChange={(event) => {
                    const prompt = event.target.value
                    setMcqDraft((prev) => ({
                      ...prev,
                      questions: prev.questions.map((row) =>
                        row.id === question.id ? { ...row, prompt } : row,
                      ),
                    }))
                  }}
                  placeholder="What is the correct answer?"
                  className={cn('min-h-[56px] resize-y', fieldClass)}
                />
                <div className="mt-2 flex flex-col gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">Choices</span>
                  {question.choices.map((choice, choiceIndex) => (
                    <div key={`${question.id}-choice-${choiceIndex}`} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={question.correctIndex === choiceIndex}
                        onChange={() =>
                          setMcqDraft((prev) => ({
                            ...prev,
                            questions: prev.questions.map((row) =>
                              row.id === question.id ? { ...row, correctIndex: choiceIndex } : row,
                            ),
                          }))
                        }
                        className="h-3.5 w-3.5 shrink-0 accent-violet-400"
                        aria-label={`Mark choice ${choiceIndex + 1} as correct`}
                      />
                      <Input
                        value={choice}
                        onChange={(event) => {
                          const value = event.target.value
                          setMcqDraft((prev) => ({
                            ...prev,
                            questions: prev.questions.map((row) => {
                              if (row.id !== question.id) return row
                              const choices = [...row.choices]
                              choices[choiceIndex] = value
                              return { ...row, choices }
                            }),
                          }))
                        }}
                        placeholder={`Choice ${choiceIndex + 1}`}
                        className={cn('h-8 flex-1', fieldClass)}
                      />
                      {question.choices.length > BOOK_EXERCISE_MCQ_MIN_CHOICES ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-white/45 hover:bg-white/10 hover:text-white"
                          aria-label={`Remove choice ${choiceIndex + 1}`}
                          onClick={() =>
                            setMcqDraft((prev) => ({
                              ...prev,
                              questions: prev.questions.map((row) => {
                                if (row.id !== question.id) return row
                                const choices = row.choices.filter((_, index) => index !== choiceIndex)
                                let correctIndex = row.correctIndex
                                if (correctIndex === choiceIndex) correctIndex = null
                                else if (correctIndex != null && correctIndex > choiceIndex) {
                                  correctIndex -= 1
                                }
                                return { ...row, choices, correctIndex }
                              }),
                            }))
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      ) : (
                        <span className="h-7 w-7 shrink-0" aria-hidden />
                      )}
                    </div>
                  ))}
                  {question.choices.length < BOOK_EXERCISE_MCQ_MAX_CHOICES ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 justify-start gap-1.5 px-1 text-[11px] text-white/65 hover:bg-white/10 hover:text-white"
                      onClick={() =>
                        setMcqDraft((prev) => ({
                          ...prev,
                          questions: prev.questions.map((row) =>
                            row.id === question.id ? { ...row, choices: [...row.choices, ''] } : row,
                          ),
                        }))
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Add choice
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 justify-start gap-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() =>
                setMcqDraft((prev) => ({
                  ...prev,
                  questions: [...prev.questions, createEmptyBookExerciseMcqQuestion()],
                }))
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add question
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5 border-t border-white/10 px-2 py-2">
          {onDraftFromBox ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
              disabled={busy}
              onClick={() => {
                const hasContent = mcqDraft.questions.some(
                  (question) =>
                    question.prompt.trim().length > 0 ||
                    question.choices.some((choice) => choice.trim().length > 0),
                )
                if (
                  hasContent &&
                  !window.confirm('Replace the current questions with a draft from this box?')
                ) {
                  return
                }
                void onDraftFromBox()
              }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {drafting ? 'Reading the box…' : 'Draft from box'}
            </Button>
          ) : null}
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex-1 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
              disabled={busy}
              onClick={() => void onSaveDraft(payload())}
            >
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            {approved ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 flex-1 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
                disabled={busy}
                onClick={() => void onUnapprove()}
              >
                Back to draft
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 bg-violet-500/80 text-xs text-white hover:bg-violet-500"
                disabled={busy || !canApprove}
                onClick={() => void onApprove(payload())}
              >
                Approve
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const wordBank = useMemo(() => parseWordBankText(wordBankDraft.wordBankText), [wordBankDraft.wordBankText])
  const previewTask: BookExerciseTask = {
    ...task,
    label: wordBankDraft.label.trim() || task.label,
    wordBank,
    items: wordBankDraft.items.map((item) => ({
      ...item,
      answers: alignedAnswers(item.stem, item.answers),
    })),
  }
  const canApprove = bookExerciseTaskCanApprove(previewTask)

  const payload = () => ({
    label: previewTask.label,
    wordBank: previewTask.wordBank,
    items: previewTask.items,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-1 py-1.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onBack}
          aria-label="Back to exercise list"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          value={wordBankDraft.label}
          onChange={(event) => setWordBankDraft((prev) => ({ ...prev, label: event.target.value }))}
          className={cn('h-7 border-white/15 bg-transparent px-1.5 text-xs font-medium text-white', fieldClass)}
          aria-label="Task name"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:thin] [scrollbar-color:#52525b_transparent]">
        <p
          className={cn(
            'rounded-md px-2 py-1 text-[10px] font-medium',
            approved
              ? 'bg-emerald-500/15 text-emerald-200'
              : canApprove
                ? 'bg-white/8 text-white/70'
                : 'bg-white/5 text-white/45',
          )}
        >
          {approved
            ? 'Approved — live Check will use this later.'
            : canApprove
              ? 'Ready to approve. Draft stays off class until you do.'
              : 'Draft from the box, or type the bank and sentences with ___.'}
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">Word bank</span>
          <Textarea
            value={wordBankDraft.wordBankText}
            onChange={(event) =>
              setWordBankDraft((prev) => ({ ...prev, wordBankText: event.target.value }))
            }
            placeholder={'because\nalthough\nwhile'}
            className={cn('min-h-[88px] resize-y', fieldClass)}
          />
          <span className="text-[10px] text-white/35">One word or phrase per line. Extra unused words are fine.</span>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">Sentences</span>
          {wordBankDraft.items.map((item, index) => {
            const answers = alignedAnswers(item.stem, item.answers)
            const blanks = answers.length
            return (
              <div key={item.id} className="rounded-md border border-white/10 bg-white/5 p-1.5">
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="text-[10px] text-white/40">{index + 1}</span>
                  {wordBankDraft.items.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-white/45 hover:bg-white/10 hover:text-white"
                      aria-label={`Remove sentence ${index + 1}`}
                      onClick={() =>
                        setWordBankDraft((prev) => ({
                          ...prev,
                          items: prev.items.filter((row) => row.id !== item.id),
                        }))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
                <Textarea
                  value={item.stem}
                  onChange={(event) => {
                    const stem = event.target.value
                    setWordBankDraft((prev) => ({
                      ...prev,
                      items: prev.items.map((row) =>
                        row.id === item.id ? { ...row, stem, answers: alignedAnswers(stem, row.answers) } : row,
                      ),
                    }))
                  }}
                  placeholder="I like ___ and ___ in the morning."
                  className={cn('min-h-[56px] resize-y', fieldClass)}
                />
                {blanks === 0 ? (
                  <p className="mt-1 text-[10px] text-white/35">
                    Put ___ where each missing word goes. Two gaps in one sentence is fine.
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-col gap-1">
                    {answers.map((answer, blankIndex) => (
                      <label key={`${item.id}-blank-${blankIndex}`} className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-white/40">
                          Gap {blankIndex + 1}
                          {blanks === 1 ? '' : ` of ${blanks}`}
                        </span>
                        <select
                          value={answer}
                          disabled={wordBank.length === 0}
                          onChange={(event) => {
                            const value = event.target.value
                            setWordBankDraft((prev) => ({
                              ...prev,
                              items: prev.items.map((row) => {
                                if (row.id !== item.id) return row
                                const nextAnswers = alignedAnswers(row.stem, row.answers)
                                nextAnswers[blankIndex] = value
                                return { ...row, answers: nextAnswers }
                              }),
                            }))
                          }}
                          className={cn(
                            'h-8 w-full rounded-md border px-2 outline-none',
                            fieldClass,
                            !answer && 'text-white/40',
                          )}
                        >
                          <option value="">{wordBank.length ? 'Pick a word' : 'Add the word bank first'}</option>
                          {wordBank.map((word) => (
                            <option key={word} value={word}>
                              {word}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 justify-start gap-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() =>
              setWordBankDraft((prev) => ({ ...prev, items: [...prev.items, createEmptyBookExerciseItem()] }))
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add sentence
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-white/10 px-2 py-2">
        {onDraftFromBox ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
            disabled={busy}
            onClick={() => {
              const hasContent =
                wordBankDraft.wordBankText.trim().length > 0 ||
                wordBankDraft.items.some((item) => item.stem.trim().length > 0)
              if (
                hasContent &&
                !window.confirm('Replace the current bank and sentences with a draft from this box?')
              ) {
                return
              }
              void onDraftFromBox()
            }}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {drafting ? 'Reading the box…' : 'Draft from box'}
          </Button>
        ) : null}
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 flex-1 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
            disabled={busy}
            onClick={() => void onSaveDraft(payload())}
          >
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          {approved ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex-1 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
              disabled={busy}
              onClick={() => void onUnapprove()}
            >
              Back to draft
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-8 flex-1 bg-violet-500/80 text-xs text-white hover:bg-violet-500"
              disabled={busy || !canApprove}
              onClick={() => void onApprove(payload())}
            >
              Approve
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
