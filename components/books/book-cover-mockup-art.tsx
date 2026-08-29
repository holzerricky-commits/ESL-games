'use client'

import { BookOpen } from 'lucide-react'
import { PersistedPageThumbnail } from '@/components/books/persisted-page-thumbnail'

export interface BookCoverMockupArtProps {
  filePath: string
  pageNumber?: number
  label: string
}

export function BookCoverMockupArt({
  filePath,
  pageNumber = 1,
  label,
}: BookCoverMockupArtProps) {
  if (!filePath) {
    return (
      <div className="book-cover-mockup__fallback">
        <BookOpen className="h-8 w-8 opacity-60" aria-hidden />
        <span className="book-cover-mockup__fallback-label">{label}</span>
      </div>
    )
  }

  return (
    <PersistedPageThumbnail
      filePath={filePath}
      pageNumber={pageNumber}
      fitHeight
      objectFit="cover"
      label={label}
      eager
      className="h-full w-full rounded-none border-0 bg-transparent"
    />
  )
}
