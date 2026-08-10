'use client'

import { useEffect, useState } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import { PDF_HERO_THUMB_WIDTH, PDF_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
import { cn } from '@/lib/utils'

function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

interface StudentCardLessonPreviewProps {
  filePath: string
  unitId: string
  page: number
  /** Shown if the thumbnail fails to render */
  label: string
  fitHeight?: boolean
  objectFit?: 'cover' | 'contain'
  className?: string
}

export function StudentCardLessonPreview({
  filePath,
  unitId,
  page,
  label,
  fitHeight = false,
  objectFit = 'cover',
  className,
}: StudentCardLessonPreviewProps) {
  const [pdfReady, setPdfReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void ensureReactPdfWorker().then(() => {
      if (!cancelled) setPdfReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const fileUrl = makeUnitFileUrl(filePath)

  return (
    <PdfPageThumbnail
      fileUrl={fileUrl}
      unitId={unitId}
      pageNumber={page}
      width={fitHeight ? PDF_HERO_THUMB_WIDTH : Math.min(80, PDF_THUMB_WIDTH + 4)}
      fitHeight={fitHeight}
      objectFit={objectFit}
      pdfReady={pdfReady}
      label={label}
      className={cn('border-[var(--border)] bg-[var(--surface-2)] shadow-sm', className)}
    />
  )
}
