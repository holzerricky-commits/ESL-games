'use client'

import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import {
  bookCoverImageUrl,
  getBookCoverSource,
} from '@/lib/books/book-cover-display'
import type { BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

export interface BookCoverThumbnailProps {
  book: BookRecord
  unitId: string
  width: number
  pdfReady: boolean
  label: string
  className?: string
  pdfPage?: number
  fitHeight?: boolean
}

export function BookCoverThumbnail({
  book,
  unitId,
  width,
  pdfReady,
  label,
  className,
  pdfPage = 1,
  fitHeight = false,
}: BookCoverThumbnailProps) {
  const source = getBookCoverSource(book, pdfPage)

  if (!source) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-[var(--border)] bg-background text-xs text-muted-foreground',
          className,
        )}
        style={fitHeight ? undefined : { width, aspectRatio: '1 / 1.414' }}
      >
        No cover
      </div>
    )
  }

  if (source.kind === 'image') {
    return (
      <div
        className={cn(
          'relative flex overflow-hidden rounded-md border border-[var(--border)] bg-background shadow-sm',
          fitHeight ? 'h-full w-full min-w-0 shrink' : 'shrink-0',
          className,
        )}
        style={fitHeight ? undefined : { width, aspectRatio: '1 / 1.414' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- served from local book-library */}
        <img
          src={bookCoverImageUrl(source.imagePath)}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    )
  }

  return (
    <PdfPageThumbnail
      fileUrl={makeUnitFileUrl(source.filePath)}
      unitId={unitId}
      pageNumber={source.pageNumber}
      width={width}
      fitHeight={fitHeight}
      pdfReady={pdfReady}
      label={label}
      className={className}
    />
  )
}
