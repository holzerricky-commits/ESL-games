import { useCallback } from 'react'
import { resolveAlignedAnchorPage, type PageNumberingMode } from '@/lib/books/page-numbering'
import { clampPdfPageToVisible, getUnitReaderBounds } from '@/lib/books/page-range'
import { saveUnitPage } from '@/lib/books/progress'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseBookNavigationArgs {
  selectedBookId: string | null
  selectedUnitId: string | null
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  numPages: number | null
  visiblePages: number[]
  isSinglePageMode: boolean
  pageNumber: number
  pageJumpDraft: string
  numberingMode: PageNumberingMode
  printedJumpBounds: { min: number; max: number; usePrinted: boolean }
  setPageNumber: (v: number) => void
}

export function useBookNavigation({
  selectedBookId,
  selectedUnitId,
  selectedBook,
  selectedUnit,
  numPages,
  visiblePages,
  isSinglePageMode,
  pageNumber,
  pageJumpDraft,
  numberingMode,
  printedJumpBounds,
  setPageNumber,
}: UseBookNavigationArgs) {
  const goToPage = useCallback(
    (nextPage: number) => {
      if (!selectedBookId || !selectedUnitId || !selectedUnit) return
      const bounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
      let normalizedNext = clampPdfPageToVisible(nextPage, visiblePages, bounds)
      if (!isSinglePageMode) {
        const idx = visiblePages.indexOf(normalizedNext)
        normalizedNext = idx >= 0 ? visiblePages[Math.max(0, idx - (idx % 2))] ?? normalizedNext : normalizedNext
      }
      setPageNumber(normalizedNext)
      saveUnitPage(selectedBookId, selectedUnitId, normalizedNext)
    },
    [isSinglePageMode, numPages, selectedBook, selectedBookId, selectedUnit, selectedUnitId, setPageNumber, visiblePages],
  )

  const goToAdjacentPage = useCallback(
    (direction: -1 | 1) => {
      if (!visiblePages.length) return
      const step = isSinglePageMode ? 1 : 2
      const currentIndex = Math.max(0, visiblePages.indexOf(pageNumber))
      const nextIndex = Math.max(0, Math.min(currentIndex + direction * step, visiblePages.length - 1))
      const nextPage = visiblePages[nextIndex] ?? pageNumber
      goToPage(nextPage)
    },
    [goToPage, isSinglePageMode, pageNumber, visiblePages],
  )

  const commitPageJump = useCallback(() => {
    const raw = pageJumpDraft.trim()
    const { min: effMin, max: effMax, usePrinted } = printedJumpBounds
    const clampPrinted = (n: number) => Math.max(effMin, Math.min(effMax, Math.floor(n)))
    const resolvePrintedToPdf = (printed: number): number | null => {
      if (!usePrinted) return Number.isFinite(printed) ? printed : null
      const e = clampPrinted(printed)
      const pdf = resolveAlignedAnchorPage(e, selectedBook ?? undefined, selectedUnit ?? undefined, numPages, numberingMode)
      return pdf != null && Number.isFinite(pdf) ? pdf : null
    }

    const spreadMatch = raw.match(/^(\d+)\s*-\s*(\d+)\s*$/)
    const singleMatch = raw.match(/^(\d+)$/)

    if (usePrinted) {
      if (!isSinglePageMode && spreadMatch) {
        const pdf = resolvePrintedToPdf(parseInt(spreadMatch[1]!, 10))
        if (pdf != null) goToPage(pdf)
        return
      }
      if (singleMatch) {
        const pdf = resolvePrintedToPdf(parseInt(singleMatch[1]!, 10))
        if (pdf != null) goToPage(pdf)
        return
      }
      if (spreadMatch) {
        const pdf = resolvePrintedToPdf(parseInt(spreadMatch[1]!, 10))
        if (pdf != null) goToPage(pdf)
        return
      }
      const loose = raw.match(/^(\d+)/)
      if (loose) {
        const pdf = resolvePrintedToPdf(parseInt(loose[1]!, 10))
        if (pdf != null) goToPage(pdf)
      }
      return
    }

    const m = raw.match(/^(\d+)/)
    if (!m) return
    const n = parseInt(m[1]!, 10)
    if (!Number.isFinite(n)) return
    goToPage(n)
  }, [
    goToPage,
    isSinglePageMode,
    numPages,
    numberingMode,
    pageJumpDraft,
    printedJumpBounds,
    selectedBook,
    selectedUnit,
  ])

  return { goToPage, goToAdjacentPage, commitPageJump }
}
