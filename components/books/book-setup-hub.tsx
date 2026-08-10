'use client'

import { BookCoverUploadControl } from '@/components/books/book-cover-upload-control'
import { BookContentFormatBadge } from '@/components/books/book-content-format-badge'
import { BookAddUnitsDrop } from '@/components/books/book-add-units-drop'
import {
  BookIdentityDangerMenu,
  BookIdentityEditDialog,
} from '@/components/books/book-identity-fields'
import { bookHasCustomCover } from '@/lib/books/book-cover-display'
import { BOOK_SETUP_COPY, type BookSetupTab } from '@/lib/books/book-setup-copy'
import {
  isPresentationBook,
  resolveBookCatalogIdentity,
} from '@/lib/books/book-catalog-labels'
import { bookHasTocMapping } from '@/lib/books/strip-book-toc-mapping'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const HUB_TABS: { id: BookSetupTab; label: string }[] = [
  { id: 'materials', label: BOOK_SETUP_COPY.materials.tabLabel },
  { id: 'outline', label: BOOK_SETUP_COPY.outline.tabLabel },
  { id: 'stories', label: BOOK_SETUP_COPY.stories.tabLabel },
  { id: 'plan', label: BOOK_SETUP_COPY.plan.tabLabel },
  { id: 'advanced', label: BOOK_SETUP_COPY.advanced.tabLabel },
]

interface BookSetupHubProps {
  book: BookRecord
  library: BookLibraryPayload
  activeTab: BookSetupTab
  onTabChange: (tab: BookSetupTab) => void
  pdfReady: boolean
  materialsCount: number
  onCoverUpdated: (payload: BookLibraryPayload) => void
  onIdentitySaved: (payload: BookLibraryPayload) => void
  onBookRemoved?: (payload: BookLibraryPayload, removedBookId: string) => void
  onUnitsUploaded?: () => Promise<void> | void
  outlineTab: React.ReactNode
  materialsTab: React.ReactNode
  storiesTab: React.ReactNode
  planTab: React.ReactNode
  advancedTab: React.ReactNode
}

export function BookSetupHub({
  book,
  library,
  activeTab,
  onTabChange,
  pdfReady,
  materialsCount: _materialsCount,
  onCoverUpdated,
  onIdentitySaved,
  onBookRemoved,
  onUnitsUploaded,
  outlineTab,
  materialsTab,
  storiesTab,
  planTab,
  advancedTab,
}: BookSetupHubProps) {
  const [editOpen, setEditOpen] = useState(false)
  const outlineReady = bookHasTocMapping(book)
  const hasUnits = book.units.length > 0
  const isPresentation = isPresentationBook(book)
  const catalog = resolveBookCatalogIdentity(book)
  const catalogLine = [catalog.series, catalog.grade, catalog.role].filter(Boolean).join(' · ')
  const showAddUnits = Boolean(onUnitsUploaded) && !hasUnits

  return (
    <div className="min-w-0 space-y-5">
      <section className="space-y-3">
        <p className="text-[13px] font-medium text-muted-foreground">Advanced tools</p>
        <div className="flex flex-wrap items-start gap-4">
          {book.units[0]?.filePath || bookHasCustomCover(book) ? (
            <BookCoverUploadControl
              book={book}
              pdfReady={pdfReady}
              width={100}
              label={isPresentation ? 'Presentation cover' : 'Book cover'}
              onCoverUpdated={onCoverUpdated}
            />
          ) : (
            <div className="flex h-[138px] w-[100px] shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-background text-xs text-muted-foreground">
              No cover
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-3xl">
                    {book.title}
                  </h3>
                  <BookContentFormatBadge book={book} />
                </div>
                {catalogLine ? (
                  <p className="text-sm text-muted-foreground">{catalogLine}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {isPresentation
                    ? hasUnits
                      ? 'Decks ready'
                      : 'Needs decks'
                    : outlineReady
                      ? 'Outlined'
                      : 'Needs outline'}
                  {' · '}
                  {book.units.length}{' '}
                  {isPresentation
                    ? `deck${book.units.length === 1 ? '' : 's'}`
                    : `unit${book.units.length === 1 ? '' : 's'}`}
                  {' · '}
                  Guides & extras — story prep lives on the lesson shelf
                </p>
              </div>
              <BookIdentityDangerMenu
                book={book}
                library={library}
                onSaved={onIdentitySaved}
                onRemoved={onBookRemoved}
                onEdit={() => setEditOpen(true)}
              />
            </div>
          </div>
        </div>

        {showAddUnits ? (
          <BookAddUnitsDrop book={book} onUploadComplete={onUnitsUploaded!} />
        ) : null}
      </section>

      <BookIdentityEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        book={book}
        library={library}
        onSaved={onIdentitySaved}
      />

      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Advanced tools">
        {HUB_TABS.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-tight transition',
                selected
                  ? 'bg-foreground text-background'
                  : 'bg-[var(--surface-3)] text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="min-w-0">
        {activeTab === 'outline' ? outlineTab : null}
        {activeTab === 'stories' ? storiesTab : null}
        {activeTab === 'materials' ? materialsTab : null}
        {activeTab === 'plan' ? planTab : null}
        {activeTab === 'advanced' ? advancedTab : null}
      </div>
    </div>
  )
}
