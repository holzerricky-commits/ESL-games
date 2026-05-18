import { useCallback, useEffect } from 'react'
import { clampPdfPageToVisible, getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import { saveUnitPage } from '@/lib/books/progress'
import type { BookReaderDocumentReadyMeta } from '@/components/students/fullscreen-book-overlay/types'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseBookPdfPageSyncArgs {
  selectedBookId: string | null
  selectedUnitId: string | null
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  numPages: number | null
  visiblePages: number[]
  isSinglePageMode: boolean
  pageNumber: number
  setNumPages: (v: number | null) => void
  setPageNumber: (v: number) => void
  /** Apply width÷height from `getViewport({ scale: 1 })` before first react-pdf paint. */
  primeReaderPageAspectRatio?: (ratio: number) => void
}

function clampSpreadAnchorPage(bounded: number, visiblePages: number[], isSinglePageMode: boolean): number {
  if (isSinglePageMode) return bounded
  const idx = visiblePages.indexOf(bounded)
  return idx >= 0 ? visiblePages[Math.max(0, idx - (idx % 2))] ?? bounded : bounded
}

export function useBookPdfPageSync({
  selectedBookId,
  selectedUnitId,
  selectedBook,
  selectedUnit,
  numPages,
  visiblePages,
  isSinglePageMode,
  pageNumber,
  setNumPages,
  setPageNumber,
  primeReaderPageAspectRatio,
}: UseBookPdfPageSyncArgs) {
  const onDocumentLoadSuccess = useCallback(
    (meta: BookReaderDocumentReadyMeta) => {
      setNumPages(meta.numPages)
      if (meta.pageAspectRatio != null && Number.isFinite(meta.pageAspectRatio) && meta.pageAspectRatio > 0) {
        primeReaderPageAspectRatio?.(meta.pageAspectRatio)
      }
      if (!selectedBookId || !selectedUnitId || !selectedUnit) return
      const bounds = getUnitReaderBounds(selectedUnit, meta.numPages, selectedBook ?? undefined)
      const nextVisible = getVisiblePdfPages(selectedUnit, meta.numPages, selectedBook ?? undefined)
      let bounded = clampPdfPageToVisible(pageNumber, nextVisible, bounds)
      bounded = clampSpreadAnchorPage(bounded, nextVisible, isSinglePageMode)
      if (bounded !== pageNumber) {
        setPageNumber(bounded)
      }
      saveUnitPage(selectedBookId, selectedUnitId, bounded)
    },
    [
      isSinglePageMode,
      pageNumber,
      selectedBook,
      selectedBookId,
      selectedUnit,
      selectedUnitId,
      setNumPages,
      setPageNumber,
      primeReaderPageAspectRatio,
    ],
  )

  useEffect(() => {
    if (!selectedBookId || !selectedUnitId || !selectedUnit) return
    const bounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
    let bounded = clampPdfPageToVisible(pageNumber, visiblePages, bounds)
    bounded = clampSpreadAnchorPage(bounded, visiblePages, isSinglePageMode)
    if (bounded === pageNumber) return
    setPageNumber(bounded)
    saveUnitPage(selectedBookId, selectedUnitId, bounded)
  }, [
    isSinglePageMode,
    numPages,
    pageNumber,
    selectedBook,
    selectedBookId,
    selectedUnit,
    selectedUnitId,
    setPageNumber,
    visiblePages,
  ])

  return { onDocumentLoadSuccess }
}
