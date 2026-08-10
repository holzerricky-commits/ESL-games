'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { BookCoverThumbnail } from '@/components/books/book-cover-thumbnail'
import { BookContentFormatBadge } from '@/components/books/book-content-format-badge'
import { bookHasCustomCover } from '@/lib/books/book-cover-display'
import { DAY_LABELS, fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import { StudentBookPickSteps } from '@/components/students/student-book-pick-steps'
import { StudentSetupScheduleDialog } from '@/components/students/student-setup-schedule-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getStudentProfileView,
  getWeeklySlotAssignments,
  removeWeeklySlotAssignment,
  updateStudentCurriculumAssignments,
} from '@/lib/students/selectors'
import type { StudentSetupStatus } from '@/lib/students/student-setup-status'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentSetupFlowProps {
  student: StudentProfileView
  setup: StudentSetupStatus
  bookLibrary: BookLibraryPayload | null
  libraryLoading: boolean
  onSetupUpdated: () => void
  onFinish: () => void
}

export function StudentSetupFlow({
  student,
  setup,
  bookLibrary,
  libraryLoading,
  onSetupUpdated,
  onFinish,
}: StudentSetupFlowProps) {
  const [editingBooks, setEditingBooks] = useState(false)
  const [isSavingBooks, setIsSavingBooks] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [slotRefresh, setSlotRefresh] = useState(0)
  const [pickSession, setPickSession] = useState(0)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  useEffect(() => {
    if (!setup.hasBook) setEditingBooks(false)
  }, [setup.hasBook])

  useEffect(() => {
    let active = true
    async function setupPdfWorker() {
      const { pdfjs } = await import('react-pdf')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      if (active) setPdfReady(true)
    }
    void setupPdfWorker()
    return () => {
      active = false
    }
  }, [])

  const liveStudent = useMemo(() => getStudentProfileView(student.id) ?? student, [student, slotRefresh])

  const studentSlots = useMemo(() => {
    void slotRefresh
    return getWeeklySlotAssignments().filter((slot) => slot.studentId === student.id)
  }, [student.id, slotRefresh, setup.weeklySlotSummary])

  async function saveAssignedBooks(bookIds: string[]) {
    setIsSavingBooks(true)
    try {
      updateStudentCurriculumAssignments(
        liveStudent.id,
        {
          assignedBookIds: bookIds,
          assignedUnitRefs: [],
        },
        bookLibrary,
      )
      setEditingBooks(false)
      onSetupUpdated()
      toast.success(bookIds.length === 1 ? 'Book assigned.' : 'Books assigned.')
    } finally {
      setIsSavingBooks(false)
    }
  }

  function startEditingBooks() {
    setPickSession((n) => n + 1)
    setEditingBooks(true)
  }

  function handleRemoveSlot(slotId: string) {
    const result = removeWeeklySlotAssignment(slotId)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSlotRefresh((n) => n + 1)
    onSetupUpdated()
    toast.success('Time removed.')
  }

  function handleScheduleChanged() {
    setSlotRefresh((n) => n + 1)
    onSetupUpdated()
  }

  const assignedBooks = useMemo(() => {
    if (!bookLibrary) return []
    return (liveStudent.assignedBookIds ?? [])
      .map((id) => bookLibrary.books.find((book) => book.id === id))
      .filter((book): book is BookRecord => Boolean(book))
  }, [bookLibrary, liveStudent.assignedBookIds])

  const showBookWizard = !setup.hasBook || editingBooks
  const showWeeklyStep = setup.hasBook && !editingBooks
  const booksDone = setup.hasBook && !editingBooks
  const scheduleDone = studentSlots.length > 0 || setup.hasUpcomingClass
  const canContinue = setup.hasBook && scheduleDone
  const editingExistingBooks = editingBooks && setup.hasBook
  const hasScheduleTimes = studentSlots.length > 0 || setup.hasUpcomingClass

  return (
    <div className="mx-auto w-full max-w-7xl pb-10 pt-2">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/students"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} aria-hidden />
            Students
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Set up {liveStudent.name}
          </h1>
          <p className="text-sm text-muted-foreground">Assign books, then pick class times.</p>
        </div>

        <nav className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1" aria-label="Setup steps">
          <SetupStepPill label="Books" step={1} done={booksDone} active={!booksDone || showBookWizard} />
          <SetupStepPill
            label="Schedule"
            step={2}
            done={scheduleDone && booksDone}
            active={Boolean(showWeeklyStep && !scheduleDone)}
          />
        </nav>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
        {showBookWizard ? (
          <section className="space-y-4 px-6 py-6 sm:px-8 sm:py-8">
            <SectionHeading done={false} title="Books" hint="Pick the books this student will use." />
            <StudentBookPickSteps
              mode="multi"
              library={bookLibrary}
              libraryLoading={libraryLoading}
              pdfReady={pdfReady}
              resetKey={pickSession}
              initialSelectedIds={liveStudent.assignedBookIds ?? []}
              isSaving={isSavingBooks}
              onCancel={editingExistingBooks ? () => setEditingBooks(false) : undefined}
              onConfirm={(bookIds) => void saveAssignedBooks(bookIds)}
            />
          </section>
        ) : (
          <>
            <div
              className={cn(
                'grid gap-0',
                showWeeklyStep && 'lg:grid-cols-2 lg:divide-x lg:divide-[var(--border)]',
              )}
            >
              <section className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
                <SectionHeading done={booksDone} title="Books" hint="Curriculum for this student." />

                {assignedBooks.length > 0 ? (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {assignedBooks.map((book, index) => {
                      const firstUnit = book.units[0]
                      const showCover = firstUnit && (bookHasCustomCover(book) || pdfReady)
                      return (
                        <li
                          key={book.id}
                          className="group relative flex items-center gap-4 rounded-xl border border-[var(--border)] bg-background p-4 transition-colors hover:border-[var(--brand-blue)]/40"
                        >
                          <div className="shrink-0">
                            {showCover && firstUnit ? (
                              <BookCoverThumbnail
                                book={book}
                                unitId={firstUnit.id}
                                width={72}
                                pdfReady={pdfReady}
                                label={`${book.title} cover`}
                                className="w-[4.5rem]"
                              />
                            ) : (
                              <div
                                className="flex aspect-[1/1.414] w-[4.5rem] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1 text-center text-[9px] leading-snug text-muted-foreground"
                                aria-hidden
                              >
                                {libraryLoading ? '…' : 'Cover'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground">
                                {book.title}
                              </h3>
                              <BookContentFormatBadge book={book} />
                            </div>
                            {index === 0 ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={startEditingBooks}
                              >
                                <Pencil size={13} aria-hidden />
                                Change books
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {libraryLoading ? 'Loading books…' : 'No books yet'}
                  </p>
                )}
              </section>

              {showWeeklyStep ? (
                <section className="space-y-5 border-t border-[var(--border)] px-6 py-6 sm:px-8 sm:py-8 lg:border-t-0">
                  <SectionHeading
                    done={scheduleDone}
                    title="Schedule"
                    hint="Weekly times or one-off classes."
                  />

                  {setup.hasUpcomingClass && studentSlots.length === 0 ? (
                    <p className="rounded-xl border border-[var(--border)] bg-background px-4 py-3 text-sm text-muted-foreground">
                      A class is already booked.
                    </p>
                  ) : null}

                  {studentSlots.length > 0 ? (
                    <ul className="space-y-2">
                      {studentSlots.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-background px-4 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{DAY_LABELS[slot.dayOfWeek]}</p>
                            <p className="text-muted-foreground">
                              {fmtScheduleMinute(slot.startMinute)} · {slot.durationMinutes} min · every week
                            </p>
                          </div>
                          <button
                            type="button"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${DAY_LABELS[slot.dayOfWeek]} ${fmtScheduleMinute(slot.startMinute)}`}
                            onClick={() => handleRemoveSlot(slot.id)}
                          >
                            <X size={16} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : !setup.hasUpcomingClass ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] bg-background/60 px-5 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No class times yet. Open the calendar to add one or more.
                      </p>
                    </div>
                  ) : null}

                  {!hasScheduleTimes ? (
                    <Button
                      type="button"
                      className="gap-1.5 bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]"
                      onClick={() => setScheduleOpen(true)}
                    >
                      <Calendar size={16} aria-hidden />
                      Book on calendar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setScheduleOpen(true)}
                    >
                      <Calendar size={16} aria-hidden />
                      Add another time
                    </Button>
                  )}
                </section>
              ) : null}
            </div>

            {canContinue ? (
              <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-background/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <p className="text-sm text-muted-foreground">Books and schedule look ready.</p>
                <Button
                  type="button"
                  className="w-full bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)] sm:w-auto sm:min-w-[12rem]"
                  onClick={onFinish}
                >
                  Continue to class prep
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <StudentSetupScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        studentId={liveStudent.id}
        studentName={liveStudent.name}
        onChanged={handleScheduleChanged}
      />
    </div>
  )
}

function SetupStepPill({
  label,
  step,
  done,
  active,
}: {
  label: string
  step: number
  done: boolean
  active: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        done && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        !done && active && 'bg-[var(--brand-blue)] text-white',
        !done && !active && 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'inline-flex size-5 items-center justify-center rounded text-[11px] font-semibold',
          done && 'bg-emerald-600/15',
          !done && active && 'bg-white/20',
          !done && !active && 'bg-muted',
        )}
      >
        {done ? <Check size={12} aria-hidden /> : step}
      </span>
      {label}
    </span>
  )
}

function SectionHeading({
  done,
  title,
  hint,
}: {
  done: boolean
  title: string
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {done ? <Check size={16} className="shrink-0 text-emerald-600" aria-hidden /> : null}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
