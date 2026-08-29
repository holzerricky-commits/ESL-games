'use client'

import { PersistedPageThumbnail } from '@/components/books/persisted-page-thumbnail'
import { PDF_HERO_THUMB_WIDTH, PDF_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
import { cn } from '@/lib/utils'

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
  page,
  label,
  fitHeight = false,
  objectFit = 'cover',
  className,
}: StudentCardLessonPreviewProps) {
  return (
    <PersistedPageThumbnail
      filePath={filePath}
      pageNumber={page}
      width={fitHeight ? PDF_HERO_THUMB_WIDTH : Math.min(80, PDF_THUMB_WIDTH + 4)}
      fitHeight={fitHeight}
      objectFit={objectFit}
      label={label}
      eager
      className={cn('border-[var(--border)] bg-[var(--surface-2)] shadow-sm', className)}
    />
  )
}
