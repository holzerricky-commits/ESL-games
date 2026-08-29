'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eye, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { playAnswerIncorrectBuzz } from '@/lib/audio/play-answer-feedback'
import { playRewardChime } from '@/lib/audio/play-reward-chime'
import {
  BOOK_EXERCISE_DRAG_THRESHOLD_PX,
  BOOK_EXERCISE_SNAP_DISTANCE_PX,
  bookExercisePlacementsFilled,
  emptyBookExercisePlacements,
  gradeBookExercisePlacements,
  nearestBookExerciseGap,
  remainingBookExerciseBank,
  revealedBookExercisePlacements,
  splitBookExerciseStem,
  type BookExercisePlacements,
  type BookExerciseTask,
} from '@/lib/books/book-exercises'
import { cn } from '@/lib/utils'

type BlankRef = { itemId: string; index: number }

type DragGhost = {
  word: string
  x: number
  y: number
  snap: BlankRef | null
}

function blankKey(blank: BlankRef): string {
  return `${blank.itemId}:${blank.index}`
}

function sameBlank(a: BlankRef | null, b: BlankRef): boolean {
  return Boolean(a && a.itemId === b.itemId && a.index === b.index)
}

function firstEmptyBlank(task: BookExerciseTask, placements: BookExercisePlacements): BlankRef | null {
  for (const item of task.items) {
    const slots = placements[item.id] ?? []
    const index = slots.findIndex((slot) => !slot)
    if (index >= 0) return { itemId: item.id, index }
  }
  return null
}

function blankTone(args: {
  filled: boolean
  selected: boolean
  checked: boolean
  correct: boolean | null
}): string {
  if (args.checked && args.correct === true) {
    return 'border-emerald-500 bg-emerald-50 text-emerald-950'
  }
  if (args.checked && args.correct === false) {
    return 'border-rose-500 bg-rose-50 text-rose-950'
  }
  if (args.selected) return 'border-violet-500 bg-violet-50 text-violet-950 ring-2 ring-violet-400'
  if (args.filled) return 'border-violet-400 bg-violet-50/80 text-slate-900'
  return 'border-slate-300 bg-slate-50 text-slate-400'
}

export function BookExercisePlaySheet({
  task,
  onClose,
}: {
  task: BookExerciseTask
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [placements, setPlacements] = useState<BookExercisePlacements>(() => emptyBookExercisePlacements(task))
  const [selectedBlank, setSelectedBlank] = useState<BlankRef | null>(null)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [grade, setGrade] = useState<ReturnType<typeof gradeBookExercisePlacements> | null>(null)
  const [drag, setDrag] = useState<DragGhost | null>(null)

  const blankEls = useRef(new Map<string, HTMLButtonElement>())
  const dragSession = useRef<{
    word: string
    pointerId: number
    startX: number
    startY: number
    moved: boolean
    fromBlank: BlankRef | null
  } | null>(null)
  const snapRef = useRef<BlankRef | null>(null)
  const skipClickRef = useRef(false)
  const placementsRef = useRef(placements)
  const checkedRef = useRef(checked)
  const bankEl = useRef<HTMLDivElement | null>(null)
  const [snapBank, setSnapBank] = useState(false)
  const [resetPulse, setResetPulse] = useState(0)

  useEffect(() => {
    placementsRef.current = placements
  }, [placements])

  useEffect(() => {
    checkedRef.current = checked
  }, [checked])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setPlacements(emptyBookExercisePlacements(task))
    setSelectedBlank(null)
    setSelectedWord(null)
    setChecked(false)
    setRevealed(false)
    setGrade(null)
    setDrag(null)
    setSnapBank(false)
    setResetPulse(0)
    dragSession.current = null
    snapRef.current = null
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

  const remaining = useMemo(
    () => remainingBookExerciseBank(task.wordBank, placements),
    [task.wordBank, placements],
  )
  const filled = bookExercisePlacementsFilled(task, placements)
  const shakeCard = Boolean(grade && !grade.allCorrect && !drag)

  function setBlankEl(blank: BlankRef, el: HTMLButtonElement | null) {
    const key = blankKey(blank)
    if (el) blankEls.current.set(key, el)
    else blankEls.current.delete(key)
  }

  function collectEmptyGapCenters() {
    const gaps: Array<{ id: BlankRef; x: number; y: number }> = []
    const current = placementsRef.current
    for (const item of task.items) {
      const slots = current[item.id] ?? []
      for (let index = 0; index < item.answers.length; index += 1) {
        if (slots[index]) continue
        const el = blankEls.current.get(blankKey({ itemId: item.id, index }))
        if (!el) continue
        const box = el.getBoundingClientRect()
        gaps.push({
          id: { itemId: item.id, index },
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
        })
      }
    }
    return gaps
  }

  function pointerOverBank(x: number, y: number): boolean {
    const el = bankEl.current
    if (!el) return false
    const box = el.getBoundingClientRect()
    const pad = 20
    return x >= box.left - pad && x <= box.right + pad && y >= box.top - pad && y <= box.bottom + pad
  }

  function setSlot(itemId: string, index: number, word: string | null) {
    setPlacements((prev) => {
      const slots = [...(prev[itemId] ?? [])]
      slots[index] = word
      const next = { ...prev, [itemId]: slots }
      placementsRef.current = next
      return next
    })
  }

  function placeWord(blank: BlankRef, word: string) {
    if (checkedRef.current) return
    setSlot(blank.itemId, blank.index, word)
    setSelectedBlank(null)
    setSelectedWord(null)
  }

  function onTapBlank(blank: BlankRef) {
    if (skipClickRef.current) {
      skipClickRef.current = false
      return
    }
    if (checked) return
    const current = placements[blank.itemId]?.[blank.index] ?? null
    if (current) {
      setSlot(blank.itemId, blank.index, null)
      setSelectedBlank(blank)
      setSelectedWord(null)
      return
    }
    if (selectedWord) {
      placeWord(blank, selectedWord)
      return
    }
    setSelectedBlank(sameBlank(selectedBlank, blank) ? null : blank)
  }

  function onTapWord(word: string) {
    if (skipClickRef.current) {
      skipClickRef.current = false
      return
    }
    if (checked) return
    if (!remaining.some((entry) => entry.toLowerCase() === word.toLowerCase())) return
    if (selectedBlank) {
      placeWord(selectedBlank, word)
      return
    }
    const empty = firstEmptyBlank(task, placements)
    if (empty) {
      placeWord(empty, word)
      return
    }
    setSelectedWord(selectedWord === word ? null : word)
  }

  function onWordPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    word: string,
    fromBlank: BlankRef | null = null,
  ) {
    if (checked) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragSession.current = {
      word,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      fromBlank,
    }
    snapRef.current = null
    setSnapBank(false)
  }

  function onWordPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = dragSession.current
    if (!session || session.pointerId !== event.pointerId) return
    const dist = Math.hypot(event.clientX - session.startX, event.clientY - session.startY)
    if (!session.moved && dist < BOOK_EXERCISE_DRAG_THRESHOLD_PX) return
    if (!session.moved) {
      session.moved = true
      if (session.fromBlank) {
        setSlot(session.fromBlank.itemId, session.fromBlank.index, null)
      }
    }
    event.preventDefault()
    const gaps = collectEmptyGapCenters()
    const snap = nearestBookExerciseGap(
      { x: event.clientX, y: event.clientY },
      gaps,
      BOOK_EXERCISE_SNAP_DISTANCE_PX,
    )
    snapRef.current = snap
    const overBank = !snap && pointerOverBank(event.clientX, event.clientY)
    setSnapBank(overBank)
    const hit = snap ? gaps.find((gap) => sameBlank(snap, gap.id)) : null
    setDrag({
      word: session.word,
      x: hit?.x ?? event.clientX,
      y: hit?.y ?? event.clientY,
      snap,
    })
  }

  function endWordPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = dragSession.current
    if (!session || session.pointerId !== event.pointerId) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
    if (session.moved) {
      skipClickRef.current = true
      const snap = snapRef.current
      if (snap) placeWord(snap, session.word)
    }
    dragSession.current = null
    snapRef.current = null
    setSnapBank(false)
    setDrag(null)
  }

  function onCheck() {
    if (!filled || checked) return
    const next = gradeBookExercisePlacements(task, placements)
    setGrade(next)
    setChecked(true)
    setSelectedBlank(null)
    setSelectedWord(null)
    if (next.allCorrect) playRewardChime()
    else playAnswerIncorrectBuzz()
  }

  function onTryAgain() {
    setPlacements(emptyBookExercisePlacements(task))
    setSelectedBlank(null)
    setSelectedWord(null)
    setChecked(false)
    setRevealed(false)
    setGrade(null)
    setDrag(null)
    setSnapBank(false)
    setResetPulse((n) => n + 1)
  }

  function onShowAnswers() {
    if (!checked || revealed) return
    const next = revealedBookExercisePlacements(task)
    setPlacements(next)
    setGrade(gradeBookExercisePlacements(task, next))
    setRevealed(true)
    setSelectedBlank(null)
    setSelectedWord(null)
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

        <div className="relative max-h-[min(82vh,760px)] overflow-y-auto p-6 sm:p-7">
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
            Complete the gaps
          </p>

          <div
            ref={bankEl}
            className={cn(
              'mt-5 flex flex-wrap gap-2 rounded-2xl p-1 transition',
              snapBank && 'bg-violet-50 ring-2 ring-violet-300',
            )}
          >
            {task.wordBank.map((word) => {
              const available = remaining.some((entry) => entry.toLowerCase() === word.toLowerCase())
              const leftover = checked && available
              const picked = selectedWord === word
              const lifting = drag?.word === word
              return (
                <button
                  key={`${word}-${resetPulse}`}
                  type="button"
                  disabled={checked || !available}
                  className={cn(
                    'touch-none rounded-full border px-3.5 py-1.5 text-base font-medium transition select-none',
                    leftover
                      ? 'border-dashed border-slate-300 bg-white text-slate-500'
                      : available && !checked
                        ? 'border-violet-200 bg-violet-50 text-violet-950 hover:border-violet-400 hover:bg-violet-100'
                        : 'border-slate-100 bg-slate-50 text-slate-400',
                    picked && 'ring-2 ring-violet-500',
                    lifting && 'opacity-40',
                    resetPulse > 0 && available && !checked && 'book-exercise-reset-chip',
                  )}
                  onClick={() => onTapWord(word)}
                  onPointerDown={(event) => onWordPointerDown(event, word)}
                  onPointerMove={onWordPointerMove}
                  onPointerUp={endWordPointer}
                  onPointerCancel={endWordPointer}
                >
                  {word}
                  {leftover ? <span className="ml-1.5 text-xs font-normal text-slate-400">extra</span> : null}
                </button>
              )
            })}
          </div>

          <ol className="mt-6 space-y-4">
            {task.items.map((item, itemIndex) => {
              const parts = splitBookExerciseStem(item.stem)
              let blankIndex = -1
              return (
                <li key={item.id} className="text-lg leading-relaxed sm:text-xl">
                  <span className="mr-2 inline-block min-w-[1.5rem] font-semibold text-slate-400">
                    {itemIndex + 1}.
                  </span>
                  {parts.map((part, partIndex) => {
                    if (part.type === 'text') {
                      return <span key={`${item.id}-t-${partIndex}`}>{part.value}</span>
                    }
                    blankIndex += 1
                    const index = blankIndex
                    const placed = placements[item.id]?.[index] ?? null
                    const correct = grade?.byItem[item.id]?.[index] ?? null
                    const blank = { itemId: item.id, index }
                    const snapping = Boolean(drag && sameBlank(drag.snap, blank))
                    return (
                      <button
                        key={`${item.id}-b-${index}`}
                        type="button"
                        ref={(el) => setBlankEl(blank, el)}
                        disabled={checked}
                        className={cn(
                          'mx-0.5 inline-flex min-w-[4.75rem] items-center justify-center rounded-md border-b-2 px-2 py-0.5 align-baseline text-[0.95em] font-semibold select-none touch-none transition-[background-color,border-color,color,box-shadow] duration-200',
                          blankTone({
                            filled: Boolean(placed),
                            selected: sameBlank(selectedBlank, blank) || snapping,
                            checked,
                            correct,
                          }),
                        )}
                        onClick={() => onTapBlank(blank)}
                        onPointerDown={
                          placed && !checked
                            ? (event) => onWordPointerDown(event, placed, blank)
                            : undefined
                        }
                        onPointerMove={onWordPointerMove}
                        onPointerUp={endWordPointer}
                        onPointerCancel={endWordPointer}
                      >
                        {placed || '\u00a0'}
                      </button>
                    )
                  })}
                </li>
              )
            })}
          </ol>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-2">
            {checked ? (
              <p
                className={cn(
                  'text-base font-medium',
                  revealed
                    ? 'text-slate-600'
                    : grade?.allCorrect
                      ? 'text-emerald-700'
                      : 'text-rose-700',
                )}
              >
                {revealed ? 'Answers shown' : grade?.allCorrect ? 'All correct' : 'Check the red gaps'}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Tap or drag a word onto a gap. Drag a placed word back to the bank or onto another gap.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {checked ? (
                <>
                  {grade && !grade.allCorrect && !revealed ? (
                    <Button type="button" variant="outline" className="gap-1.5" onClick={onShowAnswers}>
                      <Eye className="h-4 w-4" aria-hidden />
                      Show answers
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" className="gap-1.5" onClick={onTryAgain}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Try again
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="bg-[#AF52DE] text-white hover:bg-[#9b44c9]"
                  disabled={!filled}
                  onClick={onCheck}
                >
                  Check
                </Button>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {drag ? (
        <div
          className="pointer-events-none fixed z-[2] rounded-full border border-violet-300 bg-violet-50 px-3.5 py-1.5 text-base font-medium text-violet-950 shadow-lg"
          style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -50%)' }}
        >
          {drag.word}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
