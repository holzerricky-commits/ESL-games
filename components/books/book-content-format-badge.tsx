'use client'

import { Presentation } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import type { BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

export function BookContentFormatBadge({
  book,
  className,
}: {
  book: Pick<BookRecord, 'contentFormat'>
  className?: string
}) {
  if (!isPresentationBook(book)) return null

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-[var(--brand-blue)]/35 bg-[var(--brand-blue)]/10 text-[10px] font-medium text-[var(--brand-blue-bright)]',
        className,
      )}
    >
      <Presentation className="size-3" aria-hidden />
      Presentation
    </Badge>
  )
}
