import { useEffect, useRef } from 'react'
import { fetchBooksLibraryCached, getBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import type { BookLibraryPayload } from '@/lib/books/types'
import {
  resolveInitialBookReaderSelection,
  type BookReaderCurriculumHistoryEntry,
} from '@/lib/books/resolve-initial-book-reader-selection'
import { getStudentOpenTargetForBook, getStudentTeachingOpenPdfPageForBookUnit } from '@/lib/students/selectors'

export type { BookReaderCurriculumHistoryEntry as CurriculumHistoryEntry } from '@/lib/books/resolve-initial-book-reader-selection'

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
        let uid = preferUnitId?.trim() ?? ''
        let teachingPage: number | null = null
        if (sid && bid && !uid) {
          const openTarget = getStudentOpenTargetForBook(sid, bid, lib)
          if (openTarget) {
            uid = openTarget.unitId
            teachingPage = openTarget.pdfPage
          }
        }
        if (teachingPage == null && sid && bid && uid) {
          teachingPage = getStudentTeachingOpenPdfPageForBookUnit(sid, bid, uid, lib)
        }
        const { selectedBookId, selectedUnitId, pageNumber } = resolveInitialBookReaderSelection({
          library: lib,
          assignedBookIds,
          assignedUnitRefs,
          curriculumHistory,
          preferBookId: bid || preferBookId,
          preferUnitId: uid || preferUnitId,
          preferResumePage: teachingPage ?? preferResumePage,
        })
        const nextBookId = selectedBookId ?? null
        const nextUnitId = selectedUnitId ?? null
        const prev = lastAppliedSelectionRef.current
        const selectionChanged =
          prev == null || prev.bookId !== nextBookId || prev.unitId !== nextUnitId

        setSelectedBookId(selectedBookId)
        setSelectedUnitId(selectedUnitId)
        if (selectionChanged) {
          setPageNumber(pageNumber)
          setNumPages(null)
        }
        lastAppliedSelectionRef.current = { bookId: nextBookId, unitId: nextUnitId }
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
    // setters from useState are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when curriculum/open inputs change
  }, [
    assignedBookIds,
    assignedUnitRefs,
    curriculumHistory,
    open,
    preferBookId,
    preferUnitId,
    preferResumePage,
    studentId,
  ])
}
