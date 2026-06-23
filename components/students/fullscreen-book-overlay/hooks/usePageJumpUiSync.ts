import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import type { PageAlignmentRuntime } from '@/lib/books/page-alignment-runtime'
import {
  mapPdfSpreadToDisplayLabel,
  type PageNumberingMode,
} from '@/lib/books/page-numbering'

interface UsePageJumpUiSyncArgs {
  isPageListOpen: boolean
  activePageRowRef: RefObject<HTMLButtonElement | null>
  pageNumber: number
  numPages: number | null
  pageJumpFocused: boolean
  spreadRightPage: number | null
  pageAlignmentRuntime: PageAlignmentRuntime
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  numberingMode: PageNumberingMode | undefined
  setPageJumpDraft: (value: string) => void
}

export function usePageJumpUiSync({
  isPageListOpen,
  activePageRowRef,
  pageNumber,
  numPages,
  pageJumpFocused,
  spreadRightPage,
  pageAlignmentRuntime,
  selectedBook,
  selectedUnit,
  numberingMode,
  setPageJumpDraft,
}: UsePageJumpUiSyncArgs) {
  useEffect(() => {
    if (!isPageListOpen) return
    activePageRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [isPageListOpen, pageNumber, numPages, activePageRowRef])

  useEffect(() => {
    if (pageJumpFocused) return
    setPageJumpDraft(
      mapPdfSpreadToDisplayLabel(
        pageNumber,
        spreadRightPage,
        selectedBook,
        selectedUnit,
        numPages,
        numberingMode,
      ),
    )
  }, [
    pageNumber,
    numPages,
    pageJumpFocused,
    spreadRightPage,
    pageAlignmentRuntime,
    selectedBook,
    selectedUnit,
    numberingMode,
    setPageJumpDraft,
  ])
}
