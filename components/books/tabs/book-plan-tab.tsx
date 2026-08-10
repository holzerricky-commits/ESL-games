'use client'

import { BookSetupToolHelp } from '@/components/books/book-setup-tool-help'
import { Button } from '@/components/ui/button'
import { BOOK_SETUP_COPY } from '@/lib/books/book-setup-copy'

interface BookPlanTabProps {
  onOpenFocusGrid: () => void
}

export function BookPlanTab({ onOpenFocusGrid }: BookPlanTabProps) {
  const copy = BOOK_SETUP_COPY.plan

  return (
    <div className="max-w-lg">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
        <BookSetupToolHelp title={copy.label} subtitle={copy.subtitle} detail={copy.detail}>
          <Button type="button" size="sm" variant="outline" onClick={onOpenFocusGrid}>
            Open {copy.label.toLowerCase()}
          </Button>
        </BookSetupToolHelp>
      </div>
    </div>
  )
}
