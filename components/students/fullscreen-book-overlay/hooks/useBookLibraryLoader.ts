import { useCallback, useEffect, useRef } from 'react'
import { fetchBooksLibraryCached, getBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import type { BookLibraryPayload } from '@/lib/books/types'
import { nextNumPagesAfterSelectionChange } from '@/lib/books/book-reader-selection-num-pages'
import {
  preferResumePageForResolvedUnit,
  resolveInitialBookReaderSelection,
  shouldApplyInitialReaderSelection,
  type BookReaderCurriculumHistoryEntry,
} from '@/lib/books/resolve-initial-book-reader-selection'
import {
  getStudentOpenTargetForBook,
  getStudentTeachingOpenPdfPageForBookUnit,
} from '@/lib/students/selectors'

export type { BookReaderCurriculumHistoryEntry as CurriculumHistoryEntry } from '@/lib/books/resolve-initial-book-reader-selection'
export { nextNumPagesAfterSelectionChange } from '@/lib/books/book-reader-selection-num-pages'

interface UseBookLibraryLoaderArgs {
  open: boolean
  studentId?: string | null
  assignedBookIds: string[]
  assignedUnitRefs: Array<{ bookId: string; unitId: string }>
  curriculumHistory: BookReaderCurriculumHistoryEntry[]
  preferBookId?: string | null
  preferUnitId?: string | null
  /** Optional precomputed page; teaching open is recomputed with the loaded library when student+book+unit are set. */
  preferResumePage?: number | null
  getCachedNumPages?: (unitId: string) => number | null | undefined
  setLoading: (v: boolean) => void
  setError: (v: string | null) => void
  setLibrary: (v: BookLibraryPayload | null) => void
  setSelectedBookId: (v: string | null) => void
  setSelectedUnitId: (v: string | null) => void
  setPageNumber: (v: number) => void
  setNumPages: (v: number | null) => void
}

export function useBookLibraryLoader({
  open,
  studentId = null,
  assignedBookIds,
  assignedUnitRefs,
  curriculumHistory,
  preferBookId,
  preferUnitId,
  preferResumePage,
  getCachedNumPages,
  setLoading,
  setError,
  setLibrary,
  setSelectedBookId,
  setSelectedUnitId,
  setPageNumber,
  setNumPages,
}: UseBookLibraryLoaderArgs) {
  /** Avoid clearing `numPages` / reseeding page on every reopen when book/unit unchanged — keeps spread model + live page stable (see reopen UX). */
  const lastAppliedSelectionRef = useRef<{ bookId: string | null; unitId: string | null } | null>(null)
  const getCachedNumPagesRef = useRef(getCachedNumPages)
  getCachedNumPagesRef.current = getCachedNumPages
  const assignedBookIdsKey = assignedBookIds.join('\u001f')
  const assignedUnitRefsKey = assignedUnitRefs.map((ref) => `${ref.bookId}:${ref.unitId}`).join('\u001f')
  const curriculumHistoryKey = curriculumHistory
    .map((entry) => `${entry.id}:${entry.bookId}:${entry.unitId}:${entry.page}:${entry.openedAt}`)
    .join('\u001f')

  const markSelectionApplied = useCallback((bookId: string | null, unitId: string | null) => {
    lastAppliedSelectionRef.current = {
      bookId: bookId?.trim() || null,
      unitId: unitId?.trim() || null,
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let active = true
    async function loadLibrary() {
      const hadCache = getBooksLibraryCached() != null
      if (!hadCache) setLoading(true)
      setError(null)
      try {
        const lib = await fetchBooksLibraryCached()
        if (!active) return

        setLibrary(lib)
        const sid = studentId?.trim() ?? ''
        const bid = preferBookId?.trim() ?? ''
        const preferredUnit = preferUnitId?.trim() ?? ''
        // A real saved place / last stop / plan pin wins. Null means "no signal" —
        // keep the caller's unit (prep desk, shelf volume, class chip).
        const openTarget = sid && bid ? getStudentOpenTargetForBook(sid, bid, lib) : null
        let uid = openTarget?.unitId ?? preferredUnit
        let teachingPage: number | null = openTarget?.pdfPage ?? null
        if (teachingPage == null && sid && bid && uid) {
          teachingPage = getStudentTeachingOpenPdfPageForBookUnit(sid, bid, uid, lib)
        }
        const resumePage = preferResumePageForResolvedUnit({
          requestedUnitId: preferredUnit,
          resolvedUnitId: uid,
          preferResumePage,
        })
        const { selectedBookId, selectedUnitId, pageNumber } = resolveInitialBookReaderSelection({
          library: lib,
          assignedBookIds,
          assignedUnitRefs,
          curriculumHistory,
          preferBookId: bid || preferBookId,
          preferUnitId: uid || preferUnitId,
          // Same-unit resume (session memory or an explicit prep page) beats the stored page.
          preferResumePage: resumePage ?? teachingPage,
        })
        const nextBookId = selectedBookId ?? null
        const nextUnitId = selectedUnitId ?? null
        const selectionChanged = shouldApplyInitialReaderSelection(
          lastAppliedSelectionRef.current,
          nextBookId,
          nextUnitId,
        )

        lastAppliedSelectionRef.current = { bookId: nextBookId, unitId: nextUnitId }
        if (!selectionChanged) return

        setSelectedBookId(selectedBookId)
        setSelectedUnitId(selectedUnitId)
        setPageNumber(pageNumber)
        const nextNumPages = nextNumPagesAfterSelectionChange(nextUnitId, getCachedNumPagesRef.current)
        if (nextNumPages !== 'keep') {
          setNumPages(nextNumPages)
        }
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
    // setters from useState are stable; array keys capture content, not identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when curriculum/open inputs change
  }, [
    assignedBookIdsKey,
    assignedUnitRefsKey,
    curriculumHistoryKey,
    open,
    preferBookId,
    preferUnitId,
    preferResumePage,
    studentId,
  ])

  return { markSelectionApplied }
}
