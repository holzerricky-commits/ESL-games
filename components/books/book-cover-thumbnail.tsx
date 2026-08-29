'use client'

import { CachedBookImage } from '@/components/books/cached-book-image'
import { PersistedPageThumbnail } from '@/components/books/persisted-page-thumbnail'
import {
  bookCoverImageUrl,
  getBookCoverSource,
} from '@/lib/books/book-cover-display'
import type { BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

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
  unitId: _unitId,
  width,
  pdfReady: _pdfReady,
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
        <CachedBookImage
          src={bookCoverImageUrl(source.imagePath)}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <PersistedPageThumbnail
      filePath={source.filePath}
      pageNumber={source.pageNumber}
      width={width}
      fitHeight={fitHeight}
      objectFit="cover"
      label={label}
      eager
      className={className}
    />
  )
}
