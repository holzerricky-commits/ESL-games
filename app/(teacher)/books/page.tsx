import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { BooksPageClient } from '@/components/books/books-page-client'

export default function BooksPage() {
  return (
    <section>
      <PageHeader
        title="Books"
        description="Open local unit PDFs from the book-library folder and continue where you left off."
      />
      <Suspense
        fallback={
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
            <p className="text-sm text-muted-foreground">Loading books…</p>
          </div>
        }
      >
        <BooksPageClient />
      </Suspense>
    </section>
  )
}
