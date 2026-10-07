'use client'

import { useEffect, type MutableRefObject } from 'react'
import { clearReaderPrefetchCacheForUnit } from '@/lib/books/reader-page-prefetch-queue'
import { clearPdfLoadCacheForFileUrl, clearThumbnailCacheForUnit } from '@/lib/books/pdf-thumbnail-cache'
import { shouldEvictParkedReaderUnitCache } from '@/lib/books/class-source-parked-reader'
import type { BookLibraryPayload } from '@/lib/books/types'
import { makeUnitFileUrl } from '@/components/students/fullscreen-book-overlay/constants'

interface UsePdfUnitCacheOnChangeArgs {
  open: boolean
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  prevUnitCacheRef: MutableRefObject<{ unitId: string; fileUrl: string } | null>
  /** Assigned class-source units — keep their PDF + prefetch across strip swaps. */
  retainUnitIds?: readonly string[]
}

export function usePdfUnitCacheOnChange({
  open,
  selectedUnit,
  prevUnitCacheRef,
  retainUnitIds = [],
}: UsePdfUnitCacheOnChangeArgs) {
  const retainKey = retainUnitIds.join('\u001f')
  useEffect(() => {
    if (!open || !selectedUnit) return
    const fileUrl = makeUnitFileUrl(selectedUnit.filePath)
    const prev = prevUnitCacheRef.current
    const retain = retainKey ? retainKey.split('\u001f') : []
    if (
      prev &&
      prev.unitId !== selectedUnit.id &&
      shouldEvictParkedReaderUnitCache({
        previousUnitId: prev.unitId,
        retainUnitIds: retain,
      })
    ) {
      clearThumbnailCacheForUnit(prev.unitId)
      clearReaderPrefetchCacheForUnit(prev.unitId)
      clearPdfLoadCacheForFileUrl(prev.fileUrl)
    }
    prevUnitCacheRef.current = { unitId: selectedUnit.id, fileUrl }
  }, [open, prevUnitCacheRef, retainKey, selectedUnit])
}
