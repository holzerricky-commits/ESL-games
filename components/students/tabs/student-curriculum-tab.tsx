'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { BookLibraryPayload } from '@/lib/books/types'
import { fetchBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import {
  getStudentProfileView,
  getStudentSectionOptions,
  resolveClassTeachingBookUnit,
  updateStudentCurriculumAssignments,
} from '@/lib/students/selectors'
import type { StudentProfileView } from '@/lib/students/types'
import { StudentBookCurriculumCard } from '@/components/students/tabs/student-book-curriculum-card'
import { StudentCurriculumBookPreview } from '@/components/students/tabs/student-curriculum-book-preview'
import { StudentBookPickerSheet } from '@/components/students/tabs/student-book-picker-sheet'
import { cn } from '@/lib/utils'

interface OpenPreviewState {
  bookId: string
  unitId?: string
  page?: number
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

  const todayTeachingBookId = useMemo(() => {
    const sessions = liveStudent.scheduledClasses ?? []
    const live = sessions.find((s) => s.status === 'in_progress')
    const next =
      live ??
      [...sessions]
        .filter((s) => s.status === 'planned' || s.status === 'prepared')
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0]
    const fromSaved = next?.selectedSection?.bookId?.trim()
    if (fromSaved) return fromSaved
    if (!next || !library) return null
    const resolved = resolveClassTeachingBookUnit(liveStudent.id, next.id, library)
    return resolved?.section?.bookId ?? null
  }, [liveStudent.scheduledClasses, liveStudent.id, library])

  const assignedBooks = useMemo(() => {
    if (!library) return []
    const books = assignedBookIds
      .map((id) => library.books.find((b) => b.id === id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
    if (!globalLatestBookmarkBookId) return books
    return [...books].sort((a, b) => {
      if (a.id === globalLatestBookmarkBookId) return -1
      if (b.id === globalLatestBookmarkBookId) return 1
      return 0
    })
  }, [library, assignedBookIds, globalLatestBookmarkBookId])

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

  return (
    <div className="w-full space-y-8">
      <header className="flex items-end justify-between gap-4 px-0.5">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-foreground">Books</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {loading && bookCount === 0 && assignedBookIds.length > 0
              ? 'Loading…'
              : `${bookCount} ${bookCount === 1 ? 'book' : 'books'}`}
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
        <div className="space-y-5">
          <div className="flex flex-wrap items-start gap-x-5 gap-y-8">
            {assignedBooks.map((book) => {
              const previewOpen = openPreview?.bookId === book.id
              const dimOthers = openPreview != null && !previewOpen
              return (
                <div key={book.id} className={cn(dimOthers && 'opacity-45 transition hover:opacity-80')}>
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
                    onRemove={() => removeBook(book.id)}
                  />
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => setShowBookPicker(true)}
              disabled={!!error}
              className={cn(
                'group flex w-full max-w-[180px] flex-col items-center gap-2.5 text-muted-foreground',
                'transition hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
              )}
              aria-label="Add book"
            >
              <span
                className={cn(
                  'flex aspect-[3/4] w-full items-center justify-center rounded-lg',
                  'bg-[var(--surface-3)]/70 transition group-hover:bg-[var(--surface-3)] group-active:scale-[0.98]',
                )}
              >
                <Plus className="h-7 w-7 opacity-50 transition group-hover:opacity-80" strokeWidth={1.75} />
              </span>
              <span className="text-[13px] font-medium tracking-tight">Add</span>
            </button>
          </div>

          {openPreview && library
            ? (() => {
                const previewBook = assignedBooks.find((b) => b.id === openPreview.bookId)
                if (!previewBook) return null
                return (
                  <div className="overflow-hidden rounded-2xl bg-[var(--surface-3)]/70">
                    <StudentCurriculumBookPreview
                      key={`${openPreview.bookId}-${openPreview.unitId ?? 'u'}-${openPreview.page ?? 'resume'}`}
                      book={previewBook}
                      library={library}
                      studentId={liveStudent.id}
                      pdfReady={pdfReady}
                      initialUnitId={openPreview.unitId}
                      initialPage={openPreview.page}
                      onClose={closePreview}
                      onStartSaved={() => onDataUpdated?.()}
                    />
                  </div>
                )
              })()
            : null}
        </div>
      )}

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
    </div>
  )
}
