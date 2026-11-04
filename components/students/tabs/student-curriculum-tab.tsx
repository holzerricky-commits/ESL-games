'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { fetchBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import {
  bookAssignmentStatusFor,
  bookSeriesGradeLabel,
  inClassSiblingBookIds,
} from '@/lib/students/book-assignment-status'
import {
  getStudentProfileView,
  getStudentSectionOptions,
  resolveClassTeachingBookUnit,
  setStudentBookAssignmentStatus,
  updateStudentCurriculumAssignments,
} from '@/lib/students/selectors'
import type { StudentProfileView } from '@/lib/students/types'
import type { StudentBookAssignmentStatus } from '@/lib/types'
import { StudentBookCurriculumCard } from '@/components/students/tabs/student-book-curriculum-card'
import { StudentCurriculumBookPreview } from '@/components/students/tabs/student-curriculum-book-preview'
import { StudentBookPickerSheet } from '@/components/students/tabs/student-book-picker-sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface OpenPreviewState {
  bookId: string
  unitId?: string
  page?: number
}

interface StatusConfirmState {
  bookId: string
  status: 'paused' | 'finished'
  siblingIds: string[]
  seriesGradeLabel: string
}

const DRAG_DROP_SHELVES: Array<{
  status: 'paused' | 'finished'
  label: string
  dropHint: string
}> = [
  { status: 'paused', label: 'Paused', dropHint: 'Drop here to set aside' },
  { status: 'finished', label: 'Finished', dropHint: 'Drop here when it’s done' },
]

const COVER_DRAG_START_PX = 6

interface CoverDragSession {
  bookId: string
  fromStatus: StudentBookAssignmentStatus
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  active: boolean
  overStatus: StudentBookAssignmentStatus | null
}

function isBookShelfStatus(value: string | null | undefined): value is StudentBookAssignmentStatus {
  return value === 'in_class' || value === 'paused' || value === 'finished'
}

function shelfStatusAtPoint(x: number, y: number): StudentBookAssignmentStatus | null {
  const stack = document.elementsFromPoint(x, y)
  for (const node of stack) {
    if (!(node instanceof Element)) continue
    if (node.closest('[data-shelf-drag-cover]')) continue
    const raw = node.closest('[data-book-shelf]')?.getAttribute('data-book-shelf')
    if (isBookShelfStatus(raw)) return raw
  }
  return null
}

interface StudentCurriculumTabProps {
  student: StudentProfileView
  onDataUpdated?: () => void
  /** When provided by Plan route, avoids a second library fetch. */
  bookLibrary?: BookLibraryPayload | null
  libraryLoading?: boolean
}

export function StudentCurriculumTab({
  student,
  onDataUpdated,
  bookLibrary: bookLibraryFromParent,
  libraryLoading: libraryLoadingFromParent,
}: StudentCurriculumTabProps) {
  const liveStudent = useMemo(() => getStudentProfileView(student.id) ?? student, [student])
  const [localLibrary, setLocalLibrary] = useState<BookLibraryPayload | null>(bookLibraryFromParent ?? null)
  const [localLoading, setLocalLoading] = useState(bookLibraryFromParent === undefined)
  const [localError, setLocalError] = useState<string | null>(null)
  const usesParentLibrary = bookLibraryFromParent !== undefined

  const library = usesParentLibrary ? (bookLibraryFromParent ?? null) : localLibrary
  const loading = usesParentLibrary ? (libraryLoadingFromParent ?? false) : localLoading
  const error = usesParentLibrary ? null : localError

  const [pdfReady, setPdfReady] = useState(false)
  const [assignedBookIds, setAssignedBookIds] = useState<string[]>(liveStudent.assignedBookIds ?? [])
  const [isSaving, setIsSaving] = useState(false)
  const [showBookPicker, setShowBookPicker] = useState(false)
  const [openPreview, setOpenPreview] = useState<OpenPreviewState | null>(null)
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState | null>(null)
  const [shelfSheet, setShelfSheet] = useState<'paused' | 'finished' | null>(null)
  const [coverDrag, setCoverDrag] = useState<CoverDragSession | null>(null)
  const coverDragRef = useRef<CoverDragSession | null>(null)
  const suppressCoverClickRef = useRef(false)
  const stopCoverDragRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setAssignedBookIds(liveStudent.assignedBookIds ?? [])
  }, [liveStudent.assignedBookIds])

  useEffect(() => {
    if (usesParentLibrary) return
    let active = true
    setLocalLoading(true)
    setLocalError(null)
    void fetchBooksLibraryCached()
      .then((payload) => {
        if (active) setLocalLibrary(payload)
      })
      .catch((e) => {
        if (!active) return
        setLocalError(e instanceof Error ? e.message : 'Could not load books.')
      })
      .finally(() => {
        if (active) setLocalLoading(false)
      })
    return () => {
      active = false
    }
  }, [usesParentLibrary])

  useEffect(() => {
    if (!usesParentLibrary) return
    setLocalLibrary(bookLibraryFromParent ?? null)
  }, [usesParentLibrary, bookLibraryFromParent])

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

  const globalLatestBookmarkBookId = useMemo(() => {
    const withBm = (liveStudent.scheduledClasses ?? []).filter(
      (s) => s.status === 'completed' && s.bookmarkAtEnd?.bookId,
    )
    if (!withBm.length) return null
    const latest = [...withBm].sort(
      (a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime(),
    )[0]
    return latest?.bookmarkAtEnd?.bookId ?? null
  }, [liveStudent.scheduledClasses])

  const todayTeaching = useMemo(() => {
    const sessions = liveStudent.scheduledClasses ?? []
    const live = sessions.find((s) => s.status === 'in_progress')
    const next =
      live ??
      [...sessions]
        .filter((s) => s.status === 'planned' || s.status === 'prepared')
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0]
    if (!next) return { bookId: null as string | null, lessonLine: null as string | null }
    const fromSaved = next.selectedSection
    if (fromSaved?.bookId?.trim()) {
      const lesson =
        fromSaved.lessonTitle?.trim() ||
        fromSaved.partTitle?.trim() ||
        fromSaved.title?.trim() ||
        fromSaved.unitTitle?.trim() ||
        null
      return { bookId: fromSaved.bookId.trim(), lessonLine: lesson }
    }
    if (!library) return { bookId: null, lessonLine: null }
    const resolved = resolveClassTeachingBookUnit(liveStudent.id, next.id, library)
    const section = resolved?.section
    if (!section?.bookId) return { bookId: null, lessonLine: null }
    const lesson =
      section.lessonTitle?.trim() ||
      section.partTitle?.trim() ||
      section.title?.trim() ||
      section.unitTitle?.trim() ||
      null
    return { bookId: section.bookId, lessonLine: lesson }
  }, [liveStudent.scheduledClasses, liveStudent.id, library])

  const todayTeachingBookId = todayTeaching.bookId

  const assignedBooks = useMemo(() => {
    if (!library) return []
    return assignedBookIds
      .map((id) => library.books.find((b) => b.id === id))
      .filter((b): b is BookRecord => Boolean(b))
  }, [library, assignedBookIds])

  const booksByStatus = useMemo(() => {
    const groups: Record<StudentBookAssignmentStatus, BookRecord[]> = {
      in_class: [],
      paused: [],
      finished: [],
    }
    for (const book of assignedBooks) {
      groups[bookAssignmentStatusFor(liveStudent.bookAssignmentStatus, book.id)].push(book)
    }
    return groups
  }, [assignedBooks, liveStudent.bookAssignmentStatus])

  const hasClassBookmark = useMemo(() => {
    return (liveStudent.scheduledClasses ?? []).some(
      (s) => s.status === 'completed' && s.bookmarkAtEnd?.bookId,
    )
  }, [liveStudent.scheduledClasses])

  const singleBookNeedsStart = useMemo(() => {
    if (assignedBooks.length !== 1 || hasClassBookmark || !library) return false
    const book = assignedBooks[0]!
    const onBook = (liveStudent.scheduledClasses ?? []).some(
      (s) => s.status === 'completed' && s.bookmarkAtEnd?.bookId === book.id,
    )
    if (onBook) return false
    const starts = liveStudent.curriculumBookStarts ?? {}
    if (starts[book.id]) return false
    // Legacy single anchor still counts for this book.
    const legacyId = liveStudent.curriculumAnchorSectionId?.trim()
    if (legacyId) {
      const hit = getStudentSectionOptions(liveStudent.id, library).find((o) => o.id === legacyId)
      if (hit?.bookId === book.id) return false
    }
    return true
  }, [
    assignedBooks,
    hasClassBookmark,
    library,
    liveStudent.scheduledClasses,
    liveStudent.curriculumBookStarts,
    liveStudent.curriculumAnchorSectionId,
    liveStudent.id,
  ])

  function openPreviewFor(bookId: string, unitId?: string, page?: number) {
    setOpenPreview({ bookId, unitId, page })
  }

  function closePreview() {
    setOpenPreview(null)
  }

  useEffect(() => () => stopCoverDragRef.current?.(), [])

  useEffect(() => {
    if (!coverDrag?.active) return
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [coverDrag?.active])

  function beginCoverDrag(event: ReactPointerEvent<HTMLButtonElement>, bookId: string, fromStatus: StudentBookAssignmentStatus) {
    if (event.button !== 0) return
    suppressCoverClickRef.current = false
    const target = event.target
    if (target instanceof Element && target.closest('[aria-label="Book options"]')) return
    const rect = event.currentTarget.getBoundingClientRect()
    stopCoverDragRef.current?.()
    const session: CoverDragSession = {
      bookId,
      fromStatus,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      active: false,
      overStatus: null,
    }
    coverDragRef.current = session
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture needs an active pointer. Window listeners still follow the drag.
    }

    function onMove(moveEvent: PointerEvent) {
      const drag = coverDragRef.current
      if (!drag || moveEvent.pointerId !== drag.pointerId) return
      const distance = Math.hypot(moveEvent.clientX - drag.startX, moveEvent.clientY - drag.startY)
      const active = drag.active || distance >= COVER_DRAG_START_PX
      if (!active) return
      if (!drag.active) closePreview()
      const under = shelfStatusAtPoint(moveEvent.clientX, moveEvent.clientY)
      const next: CoverDragSession = {
        ...drag,
        x: moveEvent.clientX,
        y: moveEvent.clientY,
        active: true,
        overStatus: under && under !== drag.fromStatus ? under : null,
      }
      coverDragRef.current = next
      setCoverDrag(next)
    }

    function finish(endEvent: PointerEvent) {
      const drag = coverDragRef.current
      if (!drag || endEvent.pointerId !== drag.pointerId) return
      stop()
      if (drag.active) {
        suppressCoverClickRef.current = true
        if (drag.overStatus) applyBookStatus([drag.bookId], drag.overStatus)
      }
      coverDragRef.current = null
      setCoverDrag(null)
    }

    function stop() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (stopCoverDragRef.current === stop) stopCoverDragRef.current = null
    }

    stopCoverDragRef.current = stop
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  function handleCoverClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!suppressCoverClickRef.current) return
    suppressCoverClickRef.current = false
    event.preventDefault()
  }

  async function saveAssignments(nextIds: string[]) {
    setIsSaving(true)
    try {
      setAssignedBookIds(nextIds)
      updateStudentCurriculumAssignments(
        liveStudent.id,
        {
          assignedBookIds: nextIds,
          assignedUnitRefs: [],
        },
        library,
      )
      setShowBookPicker(false)
      if (!nextIds.includes(openPreview?.bookId ?? '')) {
        closePreview()
      }
      onDataUpdated?.()
      toast.success('Books updated.')
    } finally {
      setIsSaving(false)
    }
  }

  function applyBookStatus(bookIds: string[], status: StudentBookAssignmentStatus) {
    const result = setStudentBookAssignmentStatus(liveStudent.id, bookIds, status)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setStatusConfirm(null)
    onDataUpdated?.()
    if (status === 'paused') toast.success('Paused.')
    else if (status === 'finished') toast.success('Marked finished.')
    else toast.success('Back in class.')
  }

  function requestBookStatus(bookId: string, status: StudentBookAssignmentStatus) {
    if (status === 'in_class' || !library) {
      applyBookStatus([bookId], status)
      return
    }
    const siblingIds = inClassSiblingBookIds({
      books: library.books,
      assignedBookIds,
      status: liveStudent.bookAssignmentStatus,
      bookId,
    })
    const book = library.books.find((item) => item.id === bookId)
    const seriesGradeLabel = bookSeriesGradeLabel(book)
    if (siblingIds.length > 0 && seriesGradeLabel) {
      setStatusConfirm({ bookId, status, siblingIds, seriesGradeLabel })
      return
    }
    applyBookStatus([bookId], status)
  }

  function removeBook(bookId: string) {
    const next = assignedBookIds.filter((id) => id !== bookId)
    setAssignedBookIds(next)
    updateStudentCurriculumAssignments(
      liveStudent.id,
      {
        assignedBookIds: next,
        assignedUnitRefs: [],
      },
      library,
    )
    if (openPreview?.bookId === bookId) closePreview()
    onDataUpdated?.()
    toast.success('Book removed.')
  }

  const showAssignedGrid = assignedBooks.length > 0 || (loading && assignedBookIds.length > 0)
  const bookCount = assignedBooks.length
  const inClassCount = booksByStatus.in_class.length
  const countLine =
    bookCount > inClassCount
      ? `${bookCount} ${bookCount === 1 ? 'book' : 'books'} · ${inClassCount} in class`
      : `${bookCount} ${bookCount === 1 ? 'book' : 'books'}`
  const confirmSiblingTitles = statusConfirm
    ? statusConfirm.siblingIds
        .map((id) => library?.books.find((book) => book.id === id)?.title?.trim() || id)
        .join(', ')
    : ''

  return (
    <div className="w-full space-y-8">
      <header className="flex items-end justify-between gap-4 px-0.5">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-foreground">Books</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {loading && bookCount === 0 && assignedBookIds.length > 0 ? 'Loading…' : countLine}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBookPicker(true)}
          disabled={!!error}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-3)] text-foreground transition hover:bg-[var(--surface-4)] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          aria-label="Add book"
          title="Add book"
        >
          <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      {error ? <p className="text-sm text-[var(--brand-red)]">{error}</p> : null}

      {!showAssignedGrid ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <button
            type="button"
            onClick={() => setShowBookPicker(true)}
            disabled={!!error}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-3)] text-foreground transition hover:bg-[var(--surface-4)] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            aria-label="Add book"
          >
            <Plus className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </button>
          <p className="text-[13px] text-muted-foreground">No books yet</p>
        </div>
      ) : loading && assignedBooks.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          <section
            data-book-shelf="in_class"
            className={cn(
              'space-y-4 rounded-2xl bg-[var(--surface-3)]/70 p-4 transition-colors',
              coverDrag?.overStatus === 'in_class' && 'bg-[var(--surface-3)] ring-1 ring-[var(--border)]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-[15px] font-medium tracking-tight text-foreground">In class</h3>
                <p className="text-[12px] leading-snug text-muted-foreground">Open in class</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[var(--surface-2)] hover:text-foreground"
                    aria-label="Paused and finished books"
                    title="Paused and finished"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShelfSheet('paused')}>
                    Paused{booksByStatus.paused.length ? ` · ${booksByStatus.paused.length}` : ''}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShelfSheet('finished')}>
                    Finished{booksByStatus.finished.length ? ` · ${booksByStatus.finished.length}` : ''}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-3">
              {booksByStatus.in_class.map((book) => {
                const previewOpen = openPreview?.bookId === book.id
                const drag = coverDrag?.bookId === book.id ? coverDrag : null
                const liftStyle: CSSProperties | undefined = drag
                  ? {
                      position: 'fixed',
                      left: drag.x - drag.offsetX,
                      top: drag.y - drag.offsetY,
                      width: drag.width,
                      zIndex: 70,
                      pointerEvents: 'none',
                      transform: 'scale(1.04)',
                      filter: 'drop-shadow(0 16px 28px rgba(0,0,0,0.28))',
                    }
                  : undefined
                return (
                  <div key={book.id} className="rounded-xl bg-[var(--surface-2)]/50 px-3 py-3">
                    <StudentBookCurriculumCard
                      book={book}
                      library={library!}
                      student={liveStudent}
                      pdfReady={pdfReady}
                      scheduledClasses={liveStudent.scheduledClasses ?? []}
                      isGlobalLatestStop={book.id === globalLatestBookmarkBookId}
                      isTodayTeachingBook={book.id === todayTeachingBookId}
                      autoOpenPreview={singleBookNeedsStart && book.id === assignedBooks[0]?.id}
                      previewOpen={previewOpen}
                      onOpenPreview={(unitId, page) => openPreviewFor(book.id, unitId, page)}
                      onClosePreview={closePreview}
                      assignmentStatus="in_class"
                      onSetStatus={(status) => requestBookStatus(book.id, status)}
                      onRemove={() => removeBook(book.id)}
                      layout="row"
                      lessonLine={book.id === todayTeachingBookId ? todayTeaching.lessonLine : null}
                      coverLift={drag && liftStyle ? { width: drag.width, height: drag.height, style: liftStyle } : null}
                      onCoverPointerDown={(event) => beginCoverDrag(event, book.id, 'in_class')}
                      onCoverClick={handleCoverClick}
                    />
                  </div>
                )
              })}
              {booksByStatus.in_class.length === 0 ? (
                <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
                  No books in class. Use + to add one.
                </p>
              ) : null}
            </div>
          </section>

          {coverDrag?.active ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {DRAG_DROP_SHELVES.map((shelf) => {
                const highlighted = coverDrag.overStatus === shelf.status
                return (
                  <div
                    key={shelf.status}
                    data-book-shelf={shelf.status}
                    className={cn(
                      'flex min-h-[5.5rem] items-center justify-center rounded-2xl border border-dashed px-4 text-center text-[13px] leading-snug text-muted-foreground transition-colors',
                      highlighted
                        ? 'border-transparent bg-[var(--surface-3)] text-foreground'
                        : 'border-[var(--border)] bg-[var(--surface-3)]/40',
                    )}
                  >
                    {shelf.dropHint}
                  </div>
                )
              })}
            </div>
          ) : null}

        </div>
      )}

      {openPreview && library
        ? (() => {
            const previewBook = assignedBooks.find((b) => b.id === openPreview.bookId)
            if (!previewBook) return null
            return (
              <StudentCurriculumBookPreview
                key={`${openPreview.bookId}-${openPreview.unitId ?? 'u'}-${openPreview.page ?? 'resume'}`}
                book={previewBook}
                library={library}
                student={liveStudent}
                pdfReady={pdfReady}
                initialUnitId={openPreview.unitId}
                initialPage={openPreview.page}
                onClose={closePreview}
                onStartSaved={() => onDataUpdated?.()}
              />
            )
          })()
        : null}

      <StudentBookPickerSheet
        open={showBookPicker}
        onOpenChange={setShowBookPicker}
        library={library}
        libraryLoading={loading}
        pdfReady={pdfReady}
        studentName={liveStudent.name}
        assignedBookIds={assignedBookIds}
        onAssignedBookIdsChange={setAssignedBookIds}
        onSave={(ids) => saveAssignments(ids)}
        isSaving={isSaving}
      />

      <Dialog open={shelfSheet != null} onOpenChange={(open) => { if (!open) setShelfSheet(null) }}>
        <DialogContent className="flex max-h-[min(85vh,640px)] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-[var(--border)] px-5 py-4 text-left">
            <DialogTitle>{shelfSheet === 'finished' ? 'Finished' : 'Paused'}</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              {shelfSheet === 'finished' ? 'Done with this book' : 'Set aside for later'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {shelfSheet && library
              ? (() => {
                  const books = booksByStatus[shelfSheet]
                  if (books.length === 0) {
                    return (
                      <p className="py-8 text-center text-[13px] text-muted-foreground">
                        {shelfSheet === 'finished' ? 'No finished books yet.' : 'No paused books yet.'}
                      </p>
                    )
                  }
                  return (
                    <div className="flex flex-wrap gap-x-5 gap-y-6">
                      {books.map((book) => (
                        <StudentBookCurriculumCard
                          key={book.id}
                          book={book}
                          library={library}
                          student={liveStudent}
                          pdfReady={pdfReady}
                          scheduledClasses={liveStudent.scheduledClasses ?? []}
                          isGlobalLatestStop={book.id === globalLatestBookmarkBookId}
                          isTodayTeachingBook={book.id === todayTeachingBookId}
                          previewOpen={openPreview?.bookId === book.id}
                          onOpenPreview={(unitId, page) => {
                            setShelfSheet(null)
                            openPreviewFor(book.id, unitId, page)
                          }}
                          onClosePreview={closePreview}
                          assignmentStatus={shelfSheet}
                          onSetStatus={(status) => {
                            if (status === 'in_class') {
                              applyBookStatus([book.id], 'in_class')
                              return
                            }
                            requestBookStatus(book.id, status)
                          }}
                          onRemove={() => removeBook(book.id)}
                          layout="stack"
                        />
                      ))}
                    </div>
                  )
                })()
              : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={statusConfirm != null} onOpenChange={(open) => { if (!open) setStatusConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusConfirm?.status === 'finished'
                ? `Finish the other ${statusConfirm.seriesGradeLabel} books too?`
                : `Pause the other ${statusConfirm?.seriesGradeLabel ?? ''} books too?`}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmSiblingTitles}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (!statusConfirm) return
                applyBookStatus([statusConfirm.bookId], statusConfirm.status)
              }}
            >
              Just this one
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!statusConfirm) return
                applyBookStatus([statusConfirm.bookId, ...statusConfirm.siblingIds], statusConfirm.status)
              }}
            >
              These too
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
