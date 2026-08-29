'use client'

import { ListChecks, Puzzle, SquareDashedMousePointer, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BOOK_AUDIO_PLAYLIST_RAIL_WIDTH_PX,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH,
  BOOK_WORKSPACE_RAIL_MOTION_TW,
} from '@/components/students/fullscreen-book-overlay/constants'
import { BookExerciseTaskEditor } from '@/components/students/fullscreen-book-overlay/sections/BookExerciseTaskEditor'
import {
  BOOK_EXERCISE_KIND_MULTIPLE_CHOICE,
  BOOK_EXERCISE_KIND_WORD_BANK,
  bookExerciseContentSummary,
  bookExerciseKindLabel,
  isBookExerciseMultipleChoice,
  type BookExerciseItem,
  type BookExerciseKind,
  type BookExerciseMcqQuestion,
  type BookExerciseTask,
} from '@/lib/books/book-exercises'
import { cn } from '@/lib/utils'

interface BookExerciseTaskRailProps {
  open: boolean
  onClose: () => void
  tasks: BookExerciseTask[]
  loading: boolean
  saving: boolean
  drafting?: boolean
  selectedTaskId: string | null
  boxDrawActive: boolean
  drawKind: BookExerciseKind
  onDrawKindChange: (kind: BookExerciseKind) => void
  onStartBoxDraw: (kind: BookExerciseKind) => void
  onCancelBoxDraw: () => void
  onSelectTask: (task: BookExerciseTask) => void
  onClearSelection: () => void
  onDraftFromBox?: (taskId: string) => Promise<boolean>
  onRemoveTask: (task: BookExerciseTask) => void
  onSaveDraft: (
    taskId: string,
    next: { label: string; wordBank?: string[]; items?: BookExerciseItem[]; questions?: BookExerciseMcqQuestion[] },
  ) => Promise<boolean>
  onApprove: (
    taskId: string,
    next: { label: string; wordBank?: string[]; items?: BookExerciseItem[]; questions?: BookExerciseMcqQuestion[] },
  ) => Promise<boolean>
  onUnapprove: (taskId: string) => Promise<boolean>
}

const kindToggleClass = 'h-7 flex-1 rounded-md px-1.5 text-[11px] font-medium'

export function BookExerciseTaskRail({
  open,
  onClose,
  tasks,
  loading,
  saving,
  drafting = false,
  selectedTaskId,
  boxDrawActive,
  drawKind,
  onDrawKindChange,
  onStartBoxDraw,
  onCancelBoxDraw,
  onSelectTask,
  onClearSelection,
  onDraftFromBox,
  onRemoveTask,
  onSaveDraft,
  onApprove,
  onUnapprove,
}: BookExerciseTaskRailProps) {
  const editing = tasks.find((task) => task.id === selectedTaskId) ?? null

  return (
    <div
      className={cn(
        'absolute inset-y-0 z-50 flex min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[#2a2a2e] text-[#a1a1aa] shadow-[4px_0_16px_rgba(0,0,0,0.35)] transition-transform',
        BOOK_WORKSPACE_RAIL_MOTION_TW,
        open ? 'translate-x-0' : '-translate-x-full pointer-events-none',
      )}
      style={{
        left: BOOK_WORKSPACE_LEFT_BAR_WIDTH,
        width: `min(${BOOK_AUDIO_PLAYLIST_RAIL_WIDTH_PX}px, calc(100vw - ${BOOK_WORKSPACE_LEFT_BAR_WIDTH} - 12px))`,
      }}
      aria-hidden={!open}
    >
      {editing ? (
        <BookExerciseTaskEditor
          task={editing}
          saving={saving}
          drafting={drafting}
          onBack={onClearSelection}
          onDraftFromBox={onDraftFromBox ? () => onDraftFromBox(editing.id) : undefined}
          onSaveDraft={(next) => onSaveDraft(editing.id, next)}
          onApprove={(next) => onApprove(editing.id, next)}
          onUnapprove={() => onUnapprove(editing.id)}
        />
      ) : (
        <>
          <header className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-2 py-2">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <SquareDashedMousePointer className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />
                <p className="min-w-0 truncate text-[11px] font-semibold leading-tight text-white/90">
                  Exercises
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-md border-white/15 bg-white/5 p-0 text-[#a1a1aa] hover:bg-white/10 hover:text-white"
                onClick={() => {
                  onCancelBoxDraw()
                  onClose()
                }}
                aria-label="Close exercises"
              >
                <X size={14} />
              </Button>
            </div>
            <div className="flex gap-1" role="group" aria-label="Exercise type">
              <Button
                type="button"
                size="sm"
                className={cn(
                  kindToggleClass,
                  drawKind === BOOK_EXERCISE_KIND_WORD_BANK
                    ? 'bg-violet-500/30 text-white hover:bg-violet-500/40'
                    : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white',
                )}
                aria-pressed={drawKind === BOOK_EXERCISE_KIND_WORD_BANK}
                onClick={() => onDrawKindChange(BOOK_EXERCISE_KIND_WORD_BANK)}
              >
                Word bank
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn(
                  kindToggleClass,
                  drawKind === BOOK_EXERCISE_KIND_MULTIPLE_CHOICE
                    ? 'bg-violet-500/30 text-white hover:bg-violet-500/40'
                    : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white',
                )}
                aria-pressed={drawKind === BOOK_EXERCISE_KIND_MULTIPLE_CHOICE}
                onClick={() => onDrawKindChange(BOOK_EXERCISE_KIND_MULTIPLE_CHOICE)}
              >
                Choose answer
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className={cn(
                'h-8 justify-start gap-1.5 rounded-md text-xs',
                boxDrawActive
                  ? 'bg-violet-500/30 text-white hover:bg-violet-500/40'
                  : 'bg-white/10 text-white hover:bg-white/15',
              )}
              aria-pressed={boxDrawActive}
              onClick={() => {
                if (boxDrawActive) onCancelBoxDraw()
                else onStartBoxDraw(drawKind)
              }}
            >
              <SquareDashedMousePointer className="h-3.5 w-3.5" aria-hidden />
              {boxDrawActive ? 'Cancel boxing' : 'Box a task'}
            </Button>
            {boxDrawActive ? (
              <p className="px-0.5 text-[10px] leading-snug text-violet-200/90">
                Drag around one {drawKind === BOOK_EXERCISE_KIND_MULTIPLE_CHOICE ? 'choose-answer' : 'word-bank'}{' '}
                exercise. Escape cancels.
              </p>
            ) : (
              <p className="px-0.5 text-[10px] leading-snug text-white/45">
                {drawKind === BOOK_EXERCISE_KIND_MULTIPLE_CHOICE
                  ? 'Box a task. Questions come next.'
                  : 'Box a task, then draft from the box or type the word bank.'}
              </p>
            )}
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-1.5 py-2 [scrollbar-width:thin] [scrollbar-color:#52525b_transparent]">
            {loading ? (
              <p className="px-2 py-3 text-xs text-white/50">Loading exercises…</p>
            ) : tasks.length === 0 ? (
              <p className="px-2 py-3 text-xs text-white/50">No boxed tasks on this unit yet.</p>
            ) : (
              tasks.map((task) => {
                const selected = task.id === selectedTaskId
                const KindIcon = isBookExerciseMultipleChoice(task) ? ListChecks : Puzzle
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex w-full items-start gap-1 rounded-md px-1 py-1 outline-none transition-colors',
                      selected
                        ? 'bg-violet-500/20 text-white ring-1 ring-violet-400/40'
                        : 'hover:bg-white/10 hover:text-white/90',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                    >
                      <KindIcon
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/70"
                        strokeWidth={2}
                        fill="currentColor"
                        fillOpacity={0.2}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[12px] font-medium leading-snug [overflow-wrap:anywhere]">
                          {task.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] tabular-nums text-white/40">
                          Page {task.pdfPage} · {bookExerciseKindLabel(task.kind)} · {bookExerciseContentSummary(task)}
                        </span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="mt-0.5 h-7 w-7 shrink-0 text-white/55 hover:bg-white/10 hover:text-white"
                      title="Remove from book"
                      aria-label={`Remove ${task.label}`}
                      onClick={() => onRemoveTask(task)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
