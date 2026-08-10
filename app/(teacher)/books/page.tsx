import { Suspense } from 'react'
import { BooksPageClient } from '@/components/books/books-page-client'

export default function BooksPage() {
  return (
    <section>
      <Suspense
        fallback={
          <div className="py-10">
            <p className="text-[13px] text-muted-foreground">Loading…</p>
          </div>
        }
      >
        <BooksPageClient />
      </Suspense>
    </section>
  )
}
