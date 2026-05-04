'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatEffectivePageSpan, mapPdfPageToDisplayLabel } from '@/lib/books/page-numbering'
import type { BookLibraryPayload } from '@/lib/books/types'
import {
  getStudentDefaultBookUnitForReader,
  getStudentProfileView,
  getStudentSectionOptions,
  updateStudentCurriculumAssignments,
  updateStudentCurriculumReadingAnchor,
} from '@/lib/students/selectors'
import type { StudentProfileView } from '@/lib/students/types'
import { Button } from '@/components/ui/button'

interface StudentCurriculumTabProps {
  student: StudentProfileView
  onDataUpdated?: () => void
}

/** First assigned book in order that exists in the library with at least one unit — primary spell-book target. */
function primaryAssignedUnitRefs(
  lib: BookLibraryPayload | null,
  bookIds: string[],
): Array<{ bookId: string; unitId: string }> {
  if (!lib?.books?.length || bookIds.length === 0) return []
  const byId = new Map(lib.books.map((b) => [b.id, b]))
  for (const bookId of bookIds) {
    const book = byId.get(bookId)
    const first = book?.units?.[0]
    if (book && first) return [{ bookId, unitId: first.id }]
  }
  return []
}

export function StudentCurriculumTab({ student, onDataUpdated }: StudentCurriculumTabProps) {
  const liveStudent = useMemo(() => getStudentProfileView(student.id) ?? student, [student])
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignedBookIds, setAssignedBookIds] = useState<string[]>(liveStudent.assignedBookIds ?? [])
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAnchor, setIsSavingAnchor] = useState(false)
  const [anchorPick, setAnchorPick] = useState<string>(liveStudent.curriculumAnchorSectionId ?? '')
  const [anchorError, setAnchorError] = useState<string | null>(null)
  const [showBookModal, setShowBookModal] = useState(false)

  useEffect(() => {
    setAssignedBookIds(liveStudent.assignedBookIds ?? [])
  }, [liveStudent.assignedBookIds])

  useEffect(() => {
    setAnchorPick(liveStudent.curriculumAnchorSectionId ?? '')
  }, [liveStudent.curriculumAnchorSectionId])

  useEffect(() => {
    let active = true
    async function loadLibrary() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/books')
        const payload = (await res.json()) as BookLibraryPayload | { error: string }
        if (!res.ok) {
          const message = 'error' in payload ? payload.error : 'Could not load books.'
          throw new Error(message)
        }
        if (active) setLibrary(payload as BookLibraryPayload)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Could not load books.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadLibrary()
    return () => {
      active = false
    }
  }, [])

  const anchorOptions = useMemo(() => {
    if (!library) return []
    const set = new Set(assignedBookIds)
    return getStudentSectionOptions(liveStudent.id, library).filter((o) => set.has(o.bookId))
  }, [library, liveStudent.id, assignedBookIds])

  const libraryReaderHref = useMemo(() => {
    const base = `/books?student=${encodeURIComponent(liveStudent.id)}`
    const pick = library ? getStudentDefaultBookUnitForReader(liveStudent.id, library) : null
    if (!pick) return base
    return `${base}&book=${encodeURIComponent(pick.bookId)}&unit=${encodeURIComponent(pick.unitId)}`
  }, [liveStudent.id, library])

  const lastClassBookmarkSummary = useMemo(() => {
    const sessions = liveStudent.scheduledClasses ?? []
    const withBm = sessions.filter((s) => s.status === 'completed' && s.bookmarkAtEnd?.bookId)
    if (!withBm.length) return null
    const latest = [...withBm].sort(
      (a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime(),
    )[0]
    const bm = latest.bookmarkAtEnd!
    const book = library?.books.find((b) => b.id === bm.bookId)
    const unit = bm.unitId ? book?.units.find((u) => u.id === bm.unitId) : undefined
    const pageLabel = mapPdfPageToDisplayLabel(bm.pdfPage, book, unit, null, 'mapped')
    const bits: string[] = [book?.title ?? bm.bookId]
    if (unit?.title) bits.push(unit.title)
    bits.push(`PDF p. ${pageLabel}`)
    return bits.join(' · ')
  }, [liveStudent.scheduledClasses, library])

  function toggleBook(bookId: string) {
    const hasBook = assignedBookIds.includes(bookId)
    setAssignedBookIds((prev) => {
      if (hasBook) return prev.filter((id) => id !== bookId)
      return [...prev, bookId]
    })
  }

  async function saveAssignments() {
    setIsSaving(true)
    try {
      updateStudentCurriculumAssignments(
        liveStudent.id,
        {
          assignedBookIds,
          assignedUnitRefs: primaryAssignedUnitRefs(library, assignedBookIds),
        },
        library,
      )
      setShowBookModal(false)
      onDataUpdated?.()
    } finally {
      setIsSaving(false)
    }
  }

  function clearAssignments() {
    setAssignedBookIds([])
    updateStudentCurriculumAssignments(
      liveStudent.id,
      {
        assignedBookIds: [],
        assignedUnitRefs: [],
      },
      library,
    )
    setAnchorPick('')
    onDataUpdated?.()
  }

  async function saveAnchor() {
    setAnchorError(null)
    setIsSavingAnchor(true)
    try {
      const id = anchorPick.trim() || null
      const result = updateStudentCurriculumReadingAnchor(liveStudent.id, id, library)
      if (!result.ok) {
        setAnchorError(result.error)
        return
      }
      onDataUpdated?.()
    } finally {
      setIsSavingAnchor(false)
    }
  }

  const history = liveStudent.curriculumHistory ?? []

  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_minmax(0,1fr)]">
      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
          <h3 className="text-base font-semibold text-foreground">Curriculum assignments</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage which books this student should follow from your local library.
          </p>
          {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading library...</p> : null}
          {error ? <p className="mt-4 text-sm text-[var(--brand-red)]">{error}</p> : null}

          {assignedBookIds.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
              <p className="text-base font-semibold text-foreground">No curriculum assigned yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add books for this student to create a clear learning path.
              </p>
              <Button type="button" className="mt-5" onClick={() => setShowBookModal(true)} disabled={loading || !!error}>
                Add curriculum
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {assignedBookIds.map((bookId) => {
                const book = (library?.books ?? []).find((item) => item.id === bookId)
                return (
                  <article key={bookId} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <p className="font-semibold text-foreground">{book?.title ?? bookId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {book?.units?.length ? `${book.units.length} unit(s)` : 'Book metadata unavailable'}
                    </p>
                  </article>
                )
              })}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setShowBookModal(true)} disabled={loading || !!error}>
                  Edit curriculum
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAssignments}
                  disabled={isSaving}
                >
                  Clear all
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
          <h3 className="text-base font-semibold text-foreground">Where reading starts</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the first lesson piece you plan to use for new classes until a completed class sets the chain. This
            does not change the class list by itself.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Last class bookmark: </span>
            {lastClassBookmarkSummary ?? 'None yet.'}
          </p>
          {assignedBookIds.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Assign books above to pick a starting lesson piece.</p>
          ) : loading || error ? (
            <p className="mt-4 text-sm text-muted-foreground">{loading ? 'Loading options…' : 'Fix library errors to set an anchor.'}</p>
          ) : anchorOptions.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No lesson pieces found for the assigned books in the library.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block min-w-0 flex-1">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Starting lesson piece</span>
                <select
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-foreground"
                  value={anchorPick}
                  onChange={(e) => setAnchorPick(e.target.value)}
                  disabled={isSavingAnchor}
                >
                  <option value="">First in list (default)</option>
                  {anchorOptions.map((o) => {
                    const b = library?.books.find((bk) => bk.id === o.bookId)
                    const u = b?.units.find((un) => un.id === o.unitId)
                    const span =
                      b && u && typeof o.startPageHint === 'number'
                        ? formatEffectivePageSpan(o.startPageHint, o.endPageHint ?? null, b, u, null, 'mapped')
                        : ''
                    const suffix = span && span !== 'pages —' && !span.startsWith('pages —') ? ` · ${span}` : ''
                    return (
                      <option key={o.id} value={o.id}>
                        {o.pathLabel}
                        {suffix}
                      </option>
                    )
                  })}
                </select>
              </label>
              <Button type="button" onClick={() => void saveAnchor()} disabled={isSavingAnchor}>
                {isSavingAnchor ? 'Saving…' : 'Save anchor'}
              </Button>
            </div>
          )}
          {anchorError ? <p className="mt-2 text-sm text-[var(--brand-red)]">{anchorError}</p> : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">Reading history</h3>
          <Button asChild variant="outline" size="sm">
            <Link href={libraryReaderHref}>Open Library Reader</Link>
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No session history yet. Open a unit from this student context to start tracking progress.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              (() => {
                const histBook = library?.books.find((b) => b.id === entry.bookId)
                const histUnit = histBook?.units.find((u) => u.id === entry.unitId)
                const pageLabel = mapPdfPageToDisplayLabel(entry.page, histBook, histUnit, null, 'mapped')
                return (
                  <article key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm">
                    <p className="font-medium text-foreground">
                      {entry.bookId} / {entry.unitId}
                    </p>
                    <p className="mt-1 text-muted-foreground">Page {pageLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Opened {new Date(entry.openedAt).toLocaleString('en-US')}
                      {entry.closedAt ? ` · Closed ${new Date(entry.closedAt).toLocaleString('en-US')}` : ''}
                    </p>
                    <div className="mt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/books?student=${liveStudent.id}&book=${entry.bookId}&unit=${entry.unitId}`}>Reopen this unit</Link>
                      </Button>
                    </div>
                  </article>
                )
              })()
            ))}
          </div>
        )}
      </section>

      {showBookModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h4 className="text-lg font-semibold text-foreground">Select books</h4>
                <p className="text-sm text-muted-foreground">
                  Choose which books are assigned to {liveStudent.name}.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowBookModal(false)}>
                Close
              </Button>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-auto pr-1">
              {(library?.books ?? []).map((book) => {
                const checked = assignedBookIds.includes(book.id)
                return (
                  <label
                    key={book.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBook(book.id)}
                      className="mt-1 h-4 w-4 accent-[var(--brand-blue)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{book.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {book.units.length} unit(s){book.description ? ` · ${book.description}` : ''}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBookModal(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveAssignments()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save curriculum'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
