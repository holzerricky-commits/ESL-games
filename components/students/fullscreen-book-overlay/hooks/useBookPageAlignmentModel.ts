import { useMemo } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { buildPageAlignmentRuntime } from '@/lib/books/page-alignment-runtime'
import type { PageNumberingMode } from '@/lib/books/page-numbering'
import { getFileAlignment } from '@/lib/books/page-range'

interface UseBookPageAlignmentModelArgs {
  numPages: number | null
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  visiblePages: number[]
  numberingMode: PageNumberingMode | undefined
}

export function useBookPageAlignmentModel({
  numPages,
  selectedBook,
  selectedUnit,
  visiblePages,
  numberingMode,
}: UseBookPageAlignmentModelArgs) {
  const pageAlignmentRuntime = useMemo(() => {
    if (numPages == null || numPages < 1 || !selectedUnit || !selectedBook) {
      return buildPageAlignmentRuntime(null, [], [])
    }
    const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(selectedBook, selectedUnit.filePath)
    return buildPageAlignmentRuntime(numPages, hiddenPdfPages, notCountedPdfPages)
  }, [numPages, selectedBook, selectedUnit])

  const printedJumpBounds = useMemo(() => {
    if (numberingMode === 'original') {
      return { min: 1, max: Math.max(1, numPages ?? 1), usePrinted: false as const }
    }
    const rt = pageAlignmentRuntime
    if (!rt.effectiveTotal) {
      return { min: 1, max: Math.max(1, numPages ?? 1), usePrinted: false as const }
    }
    let minP = Number.MAX_SAFE_INTEGER
    let maxP = 1
    for (const pdf of visiblePages) {
      const e = rt.effectivePageByPdf.get(pdf)
      if (e == null) continue
      minP = Math.min(minP, e)
      maxP = Math.max(maxP, e)
    }
    if (minP === Number.MAX_SAFE_INTEGER) {
      return { min: 1, max: Math.max(1, rt.effectiveTotal), usePrinted: true as const }
    }
    return { min: minP, max: maxP, usePrinted: true as const }
  }, [visiblePages, pageAlignmentRuntime, numPages, numberingMode])

  return { pageAlignmentRuntime, printedJumpBounds }
}
