import { useEffect, type MutableRefObject } from 'react'
import { clearReaderPrefetchCacheForUnit } from '@/lib/books/reader-page-prefetch-queue'
import { clearPdfLoadCacheForFileUrl, clearThumbnailCacheForUnit } from '@/lib/books/pdf-thumbnail-cache'
import type { BookLibraryPayload } from '@/lib/books/types'
import { makeUnitFileUrl } from '@/components/students/fullscreen-book-overlay/constants'

interface UsePdfUnitCacheOnChangeArgs {
  open: boolean
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  prevUnitCacheRef: MutableRefObject<{ unitId: string; fileUrl: string } | null>
}

export function usePdfUnitCacheOnChange({ open, selectedUnit, prevUnitCacheRef }: UsePdfUnitCacheOnChangeArgs) {
  useEffect(() => {
    if (!open || !selectedUnit) return
    const fileUrl = makeUnitFileUrl(selectedUnit.filePath)
    const prev = prevUnitCacheRef.current
    if (prev && prev.unitId !== selectedUnit.id) {
      clearThumbnailCacheForUnit(prev.unitId)
      clearReaderPrefetchCacheForUnit(prev.unitId)
      clearPdfLoadCacheForFileUrl(prev.fileUrl)
    }
    prevUnitCacheRef.current = { unitId: selectedUnit.id, fileUrl }
  }, [open, prevUnitCacheRef, selectedUnit])
}
