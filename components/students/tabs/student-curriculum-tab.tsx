'use client'

import Link from 'next/link'
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
import { StudentBookPickerSheet } from '@/components/students/tabs/student-book-picker-sheet'
import { Button } from '@/components/ui/button'
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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Books for {liveStudent.name}</h2>
        <p className="text-sm text-muted-foreground">
          Assign books and set a starting page on each one. Today’s lesson is chosen under Classes —
          Prepare and Enter follow that plan.
        </p>
        {assignedBooks.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Go to{' '}
            <Link href={`/students/${liveStudent.id}?tab=classes`} className="underline-offset-2 hover:underline">
              Classes
            </Link>{' '}
            to see or change what you’re teaching today.
          </p>
        ) : null}
      </header>

      {error ? <p className="text-sm text-[var(--brand-red)]">{error}</p> : null}

      {!showAssignedGrid ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center">
          <p className="text-base font-semibold text-foreground">No books yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Add a book from your library to get started.</p>
          <Button type="button" className="mt-5" onClick={() => setShowBookPicker(true)} disabled={!!error}>
            Add a book
          </Button>
        </div>
      ) : loading && assignedBooks.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-sm text-muted-foreground">Loading assigned books…</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignedBooks.map((book) => {
            const previewOpen = openPreview?.bookId === book.id
            return (
              <div
                key={book.id}
                className={cn(previewOpen && 'sm:col-span-2 lg:col-span-3')}
              >
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
                  previewUnitId={previewOpen ? openPreview?.unitId : undefined}
                  previewPage={previewOpen ? openPreview?.page : undefined}
                  onOpenPreview={(unitId, page) => openPreviewFor(book.id, unitId, page)}
                  onClosePreview={closePreview}
                  onRemove={() => removeBook(book.id)}
                  onDataUpdated={() => onDataUpdated?.()}
                />
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => setShowBookPicker(true)}
            disabled={!!error}
            className={cn(
              'flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)]',
              'bg-[var(--surface-2)]/50 p-6 text-muted-foreground transition-colors hover:border-[var(--brand-blue)]/40 hover:bg-[var(--card)] hover:text-foreground',
            )}
          >
            <Plus className="h-8 w-8 opacity-60" />
            <span className="text-sm font-medium">Add a book</span>
          </button>
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
