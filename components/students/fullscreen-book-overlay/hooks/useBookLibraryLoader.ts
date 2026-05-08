import { useEffect } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { clampPdfPage, getUnitReaderBounds } from '@/lib/books/page-range'
import { getSavedUnitPage } from '@/lib/books/progress'

export interface CurriculumHistoryEntry {
  id: string
  bookId: string
  unitId: string
  page: number
  openedAt: string
  closedAt?: string
}

interface UseBookLibraryLoaderArgs {
  open: boolean
  assignedBookIds: string[]
  assignedUnitRefs: Array<{ bookId: string; unitId: string }>
  curriculumHistory: CurriculumHistoryEntry[]
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
  useEffect(() => {
    if (!open) return
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
        if (!active) return
        const lib = payload as BookLibraryPayload
        setLibrary(lib)

        const booksById = new Map(lib.books.map((book) => [book.id, book]))
        const sortedHistory = [...curriculumHistory].sort(
          (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
        )
        const assignedBookIdSet = new Set(assignedBookIds)
        const historyCandidates =
          assignedBookIds.length > 0
            ? sortedHistory.filter((entry) => assignedBookIdSet.has(entry.bookId))
            : sortedHistory

        let selectedBook = null as (typeof lib.books)[number] | null
        let selectedUnit: (typeof lib.books)[number]['units'][number] | null = null
        let initialPage: number | null = null

        for (const ref of assignedUnitRefs) {
          const book = booksById.get(ref.bookId)
          if (!book) continue
          const unit = book.units.find((u) => u.id === ref.unitId)
          if (!unit) continue
          selectedBook = book
          selectedUnit = unit
          initialPage = null
          break
        }

        if (!selectedBook || !selectedUnit) {
          for (const bookId of assignedBookIds) {
            const book = booksById.get(bookId)
            if (!book) continue
            if (book.units.length > 0) {
              selectedBook = book
              selectedUnit = book.units[0] ?? null
              initialPage = null
              break
            }
            if (!selectedBook) {
              selectedBook = book
            }
          }
        }

        if (!selectedBook || !selectedUnit) {
          for (const entry of historyCandidates) {
            const book = booksById.get(entry.bookId)
            if (!book) continue
            const unit = book.units.find((u) => u.id === entry.unitId)
            if (!unit) continue
            selectedBook = book
            selectedUnit = unit
            initialPage = Number.isFinite(entry.page) ? Math.max(1, Math.floor(entry.page)) : 1
            break
          }
        }

        setSelectedBookId(selectedBook?.id ?? null)
        setSelectedUnitId(selectedUnit?.id ?? null)
        if (selectedUnit && selectedBook) {
          const bounds = getUnitReaderBounds(selectedUnit, null, selectedBook ?? undefined)
          const seededPage = initialPage ?? getSavedUnitPage(selectedBook.id, selectedUnit.id)
          setPageNumber(clampPdfPage(seededPage, bounds))
        } else {
          setPageNumber(1)
        }
        setNumPages(null)
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
