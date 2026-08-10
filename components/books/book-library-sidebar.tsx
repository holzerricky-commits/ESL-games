'use client'

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ChevronDown, Loader2, Search, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { BookCoverThumbnail } from '@/components/books/book-cover-thumbnail'
import { BookContentFormatBadge } from '@/components/books/book-content-format-badge'
import { BookDropUpload, uploadBookPdfFiles } from '@/components/books/book-drop-upload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { bookHasCustomCover } from '@/lib/books/book-cover-display'
import { isPresentationBook, resolveBookCatalogIdentity } from '@/lib/books/book-catalog-labels'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import {
  filterBooksByLibrarySearch,
  groupBooksIntoSeriesShelves,
  partitionBooksForStudentPin,
  resolveInitialExpandedSeries,
  writeExpandedSeriesToStorage,
} from '@/lib/books/book-library-shelves'
import { bookHasTocMapping } from '@/lib/books/strip-book-toc-mapping'
import type { BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

function isFileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

interface BookLibrarySidebarProps {
  books: BookRecord[]
  selectedBookId: string | null
  pdfReady: boolean
  uploadPanelOpen: boolean
  onToggleUpload: () => void
  onUploadComplete: () => void
  onSelectBook: (bookId: string) => void
  selectedStudentId?: string | null
  /** Display name for the linked student (This student shelf). */
  selectedStudentName?: string | null
  /** Assigned book ids for the linked student, in preferred order. */
  assignedBookIds?: string[] | null
}

function BookShelfRow({
  book,
  selectedBookId,
  pdfReady,
  onSelectBook,
  subtitleMode = 'none',
}: {
  book: BookRecord
  selectedBookId: string | null
  pdfReady: boolean
  onSelectBook: (bookId: string) => void
  /** Under a grade heading, show role (grade is already visible). */
  subtitleMode?: 'none' | 'role-only' | 'grade-and-role'
}) {
  const catalog = resolveBookCatalogIdentity(book)
  const coverPath = book.units[0]?.filePath
  const coverUrl = coverPath ? makeUnitFileUrl(coverPath) : null
  const isPresentation = isPresentationBook(book)
  const mapped = isPresentation ? book.units.length > 0 : bookHasTocMapping(book)
  const active = selectedBookId === book.id
  const statusLabel = isPresentation
    ? mapped
      ? 'Decks ready'
      : 'Needs decks'
    : mapped
      ? 'Outline ready'
      : 'Needs outline'
  const subtitleParts =
    subtitleMode === 'role-only'
      ? [catalog.role].filter(Boolean)
      : subtitleMode === 'grade-and-role'
        ? [catalog.grade, catalog.role].filter(Boolean)
        : []

  return (
    <button
      type="button"
      onClick={() => onSelectBook(book.id)}
      title={statusLabel}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-2 py-2 text-left transition-colors',
        active
          ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
          : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-background/30',
      )}
    >
      {coverUrl && (bookHasCustomCover(book) || pdfReady) ? (
        <BookCoverThumbnail
          book={book}
          unitId={`${book.id}-cover`}
          width={40}
          pdfReady={pdfReady}
          label="Cover"
          className="shrink-0 rounded-md border border-[var(--border)] bg-background shadow-sm"
        />
      ) : (
        <div className="flex h-[58px] w-[40px] shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-background text-[9px] text-muted-foreground">
          —
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{book.title}</p>
          <BookContentFormatBadge book={book} />
        </div>
        {subtitleParts.length > 0 ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitleParts.join(' · ')}</p>
        ) : null}
      </div>
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          mapped ? 'bg-[var(--brand-green)]' : 'bg-amber-500',
        )}
        aria-label={statusLabel}
      />
    </button>
  )
}

export function BookLibrarySidebar({
  books,
  selectedBookId,
  pdfReady,
  uploadPanelOpen,
  onToggleUpload,
  onUploadComplete,
  onSelectBook,
  selectedStudentId,
  selectedStudentName,
  assignedBookIds = null,
}: BookLibrarySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [studentPinOpen, setStudentPinOpen] = useState(true)
  const [libraryDragActive, setLibraryDragActive] = useState(false)
  const [libraryUploading, setLibraryUploading] = useState(false)
  const libraryDragDepthRef = useRef(0)
  const isSearching = searchQuery.trim().length > 0

  async function handleLibraryPdfDrop(files: FileList | File[]) {
    if (libraryUploading) return
    setLibraryUploading(true)
    try {
      await uploadBookPdfFiles(Array.from(files))
      await onUploadComplete()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.'
      if (
        message !== 'Only PDF files are supported.' &&
        message !== 'Please drop a .pdf file.'
      ) {
        toast.error(message)
      }
    } finally {
      setLibraryDragActive(false)
      setLibraryUploading(false)
    }
  }

  function onLibraryDragEnter(event: DragEvent) {
    if (!isFileDrag(event) || libraryUploading) return
    event.preventDefault()
    event.stopPropagation()
    libraryDragDepthRef.current += 1
    setLibraryDragActive(true)
  }

  function onLibraryDragLeave(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    libraryDragDepthRef.current = Math.max(0, libraryDragDepthRef.current - 1)
    if (libraryDragDepthRef.current === 0) setLibraryDragActive(false)
  }

  function onLibraryDragOver(event: DragEvent) {
    if (!isFileDrag(event) || libraryUploading) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }

  function onLibraryDrop(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    libraryDragDepthRef.current = 0
    setLibraryDragActive(false)
    if (libraryUploading) return
    const dropped = event.dataTransfer.files
    if (dropped?.length) void handleLibraryPdfDrop(dropped)
  }

  const filteredBooks = useMemo(
    () => filterBooksByLibrarySearch(books, searchQuery),
    [books, searchQuery],
  )

  const { pinned: pinnedBooks, rest: restBooks } = useMemo(
    () =>
      selectedStudentId
        ? partitionBooksForStudentPin(filteredBooks, assignedBookIds)
        : { pinned: [] as BookRecord[], rest: filteredBooks },
    [assignedBookIds, filteredBooks, selectedStudentId],
  )

  const shelves = useMemo(() => groupBooksIntoSeriesShelves(restBooks), [restBooks])
  const allShelves = useMemo(() => groupBooksIntoSeriesShelves(books), [books])

  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(() => new Set())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated) return
    if (allShelves.length === 0 && books.length === 0) return
    setExpandedSeries(
      resolveInitialExpandedSeries({
        shelves: allShelves,
        selectedBookId,
        books,
      }),
    )
    setHydrated(true)
  }, [allShelves, books, hydrated, selectedBookId])

  useEffect(() => {
    if (!hydrated || isSearching) return
    writeExpandedSeriesToStorage(Array.from(expandedSeries))
  }, [expandedSeries, hydrated, isSearching])

  // Keep the selected book's series open so the active row stays visible.
  useEffect(() => {
    if (!hydrated || !selectedBookId || isSearching) return
    const selected = books.find((book) => book.id === selectedBookId)
    if (!selected) return
    const series = resolveBookCatalogIdentity(selected).series
    const isPinned = pinnedBooks.some((book) => book.id === selectedBookId)
    if (isPinned) {
      setStudentPinOpen(true)
      return
    }
    setExpandedSeries((prev) => {
      if (prev.has(series)) return prev
      const next = new Set(prev)
      next.add(series)
      return next
    })
  }, [books, hydrated, isSearching, pinnedBooks, selectedBookId])

  function toggleSeries(series: string) {
    if (isSearching) return
    setExpandedSeries((prev) => {
      const next = new Set(prev)
      if (next.has(series)) next.delete(series)
      else next.add(series)
      return next
    })
  }

  function isShelfOpen(series: string): boolean {
    if (isSearching) return true
    return expandedSeries.has(series)
  }

  const studentPinLabel = selectedStudentName?.trim() || 'This student'
  const showStudentPin = Boolean(selectedStudentId) && pinnedBooks.length > 0
  const showEmptyLibrary = books.length === 0
  const showNoSearchMatches =
    !showEmptyLibrary && filteredBooks.length === 0 && isSearching
  const showNoShelves =
    !showEmptyLibrary && !showNoSearchMatches && shelves.length === 0 && !showStudentPin

  return (
    <Card
      className={cn(
        'relative lg:max-w-[260px] transition-colors',
        libraryDragActive && 'border-[var(--brand-blue)] ring-2 ring-[var(--brand-blue)]/30',
      )}
      onDragEnter={onLibraryDragEnter}
      onDragLeave={onLibraryDragLeave}
      onDragOver={onLibraryDragOver}
      onDrop={onLibraryDrop}
    >
      {libraryDragActive || libraryUploading ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-xl bg-[var(--brand-blue)]/15 px-3 text-center backdrop-blur-[1px]"
          aria-live="polite"
        >
          {libraryUploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-blue)]" />
              <p className="text-xs font-semibold text-foreground">Uploading PDF…</p>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-[var(--brand-blue)]" />
              <p className="text-xs font-semibold text-foreground">Drop PDF to add</p>
            </>
          )}
        </div>
      ) : null}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Library</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={onToggleUpload}
          >
            {uploadPanelOpen ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            {uploadPanelOpen ? 'Hide' : 'Add PDF'}
          </Button>
        </div>
        {selectedStudentId ? (
          <p className="text-xs text-muted-foreground">
            {showStudentPin
              ? `${studentPinLabel}’s books are pinned on top. Full library stays below.`
              : 'Student linked — no assigned books yet. Full library below.'}
          </p>
        ) : null}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search title, series, grade…"
            className="h-8 pr-8 pl-8 text-xs"
            aria-label="Search library"
          />
          {isSearching ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {uploadPanelOpen ? (
          <BookDropUpload
            onUploadComplete={async () => {
              await onUploadComplete()
            }}
          />
        ) : null}

        {showEmptyLibrary ? (
          <p className="text-xs text-muted-foreground">
            No books yet. Drop a PDF here, or use Add PDF.
          </p>
        ) : null}

        {showNoSearchMatches ? (
          <p className="text-xs text-muted-foreground">
            No books match “{searchQuery.trim()}”. Clear search to see all shelves.
          </p>
        ) : null}

        {showStudentPin ? (
          <Collapsible
            open={isSearching ? true : studentPinOpen}
            onOpenChange={setStudentPinOpen}
            className="rounded-lg border border-[var(--brand-blue)]/40 bg-[var(--brand-blue)]/5"
          >
            <CollapsibleTrigger
              className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-[var(--brand-blue)]/10"
              disabled={isSearching}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {studentPinLabel}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {pinnedBooks.length} assigned book{pinnedBooks.length === 1 ? '' : 's'}
                  {isSearching ? ' matched' : ''}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  (isSearching ? true : studentPinOpen) ? 'rotate-0' : '-rotate-90',
                  isSearching ? 'opacity-40' : null,
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 border-t border-[var(--brand-blue)]/30 px-2 py-2">
              {pinnedBooks.map((book) => (
                <BookShelfRow
                  key={`pin-${book.id}`}
                  book={book}
                  selectedBookId={selectedBookId}
                  pdfReady={pdfReady}
                  onSelectBook={onSelectBook}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {showNoShelves ? (
          <p className="text-xs text-muted-foreground">
            {showStudentPin
              ? 'No other books in the library.'
              : 'No books to show in series shelves.'}
          </p>
        ) : null}

        {!showEmptyLibrary && !showNoSearchMatches
          ? shelves.map((shelf) => {
              const open = isShelfOpen(shelf.series)
              return (
                <Collapsible
                  key={shelf.series}
                  open={open}
                  onOpenChange={() => toggleSeries(shelf.series)}
                  className="rounded-lg border border-[var(--border)] bg-background/40"
                >
                  <CollapsibleTrigger
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-[var(--surface-2)]"
                    disabled={isSearching}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {shelf.series}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {shelf.books.length} book{shelf.books.length === 1 ? '' : 's'}
                        {isSearching ? ' matched' : ''}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                        open ? 'rotate-0' : '-rotate-90',
                        isSearching ? 'opacity-40' : null,
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 border-t border-[var(--border)] px-2 py-2">
                    {shelf.useGradeGroups
                      ? shelf.gradeGroups.map((group) => (
                          <div key={`${shelf.series}-${group.gradeKey}`} className="space-y-1.5">
                            <p className="px-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                              {group.gradeLabel}
                            </p>
                            <div className="space-y-2">
                              {group.books.map((book) => (
                                <BookShelfRow
                                  key={book.id}
                                  book={book}
                                  selectedBookId={selectedBookId}
                                  pdfReady={pdfReady}
                                  onSelectBook={onSelectBook}
                                  subtitleMode="role-only"
                                />
                              ))}
                            </div>
                          </div>
                        ))
                      : shelf.books.map((book) => (
                          <BookShelfRow
                            key={book.id}
                            book={book}
                            selectedBookId={selectedBookId}
                            pdfReady={pdfReady}
                            onSelectBook={onSelectBook}
                          />
                        ))}
                  </CollapsibleContent>
                </Collapsible>
              )
            })
          : null}
      </CardContent>
    </Card>
  )
}
