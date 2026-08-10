'use client'

import { useEffect, useRef } from 'react'
import {
  invalidateReaderPrefetchPagesAtWidth,
  queueReaderPrefetchPagesImmediate,
  readerPrefetchWidthBucket,
} from '@/lib/books/reader-page-prefetch-queue'
import { resolveReaderPagePrefetchWidthPx } from '@/lib/books/reader-page-render-width'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'

export function useReaderZoomSharpPrefetch(args: {
  enabled: boolean
  fileUrl: string | null
  unitId: string | null
  spreadPageWidth: number
  screenScale: number
  visiblePages: readonly number[]
}): void {
  const zoomRepaintRevision = useBrowserZoomRepaintRevision()
  const lastZoomRepaintRevisionRef = useRef(0)
  const lastPrefetchBucketRef = useRef<number | null>(null)
  const visiblePagesKey = args.visiblePages.join(',')

  useEffect(() => {
    const { enabled, fileUrl, unitId, spreadPageWidth, screenScale, visiblePages } = args
    if (!enabled || !fileUrl || !unitId || !(spreadPageWidth > 0) || visiblePages.length === 0) {
      return
    }

    const prefetchWidthPx = resolveReaderPagePrefetchWidthPx(spreadPageWidth, screenScale)
    const prefetchBucket = readerPrefetchWidthBucket(prefetchWidthPx)
    const dprChanged = zoomRepaintRevision !== lastZoomRepaintRevisionRef.current
    const bucketChanged = lastPrefetchBucketRef.current !== prefetchBucket

    if (dprChanged) {
      invalidateReaderPrefetchPagesAtWidth(unitId, visiblePages, spreadPageWidth)
      if (prefetchWidthPx !== spreadPageWidth) {
        invalidateReaderPrefetchPagesAtWidth(unitId, visiblePages, prefetchWidthPx)
      }
      lastZoomRepaintRevisionRef.current = zoomRepaintRevision
    }

    if (!dprChanged && !bucketChanged) return

    queueReaderPrefetchPagesImmediate({
      fileUrl,
      unitId,
      pages: [...visiblePages],
      widthPx: prefetchWidthPx,
    })

    lastPrefetchBucketRef.current = prefetchBucket
  }, [
    args.enabled,
    args.fileUrl,
    args.unitId,
    args.spreadPageWidth,
    args.screenScale,
    visiblePagesKey,
    zoomRepaintRevision,
  ])
}
