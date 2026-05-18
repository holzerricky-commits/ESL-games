import { useEffect, useRef } from 'react'
import { fetchBooksLibraryCached, getBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import type { BookLibraryPayload } from '@/lib/books/types'
import {
  resolveInitialBookReaderSelection,
  type BookReaderCurriculumHistoryEntry,
} from '@/lib/books/resolve-initial-book-reader-selection'

export type { BookReaderCurriculumHistoryEntry as CurriculumHistoryEntry } from '@/lib/books/resolve-initial-book-reader-selection'

interface UseBookLibraryLoaderArgs {
  open: boolean
  assignedBookIds: string[]
  assignedUnitRefs: Array<{ bookId: string; unitId: string }>
  curriculumHistory: BookReaderCurriculumHistoryEntry[]
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
  assignedBookIds,
  assignedUnitRefs,
  curriculumHistory,
  setLoading,
  setError,
  setLibrary,
  setSelectedBookId,
  setSelectedUnitId,
  setPageNumber,
  setNumPages,
}: UseBookLibraryLoaderArgs) {
  /** Avoid clearing `numPages` on every reopen when book/unit unchanged — keeps spread model + B2 gate stable (see reopen UX). */
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
        const { selectedBookId, selectedUnitId, pageNumber } = resolveInitialBookReaderSelection({
          library: lib,
          assignedBookIds,
          assignedUnitRefs,
          curriculumHistory,
        })
        const nextBookId = selectedBookId ?? null
        const nextUnitId = selectedUnitId ?? null
        const prev = lastAppliedSelectionRef.current
        const selectionChanged =
          prev == null || prev.bookId !== nextBookId || prev.unitId !== nextUnitId

        setSelectedBookId(selectedBookId)
        setSelectedUnitId(selectedUnitId)
        setPageNumber(pageNumber)
        if (selectionChanged) {
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
  }, [assignedBookIds, assignedUnitRefs, curriculumHistory, open])
}
