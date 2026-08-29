'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Library, Scissors, Wand2 } from 'lucide-react'
import {
  BookIdentityDangerMenu,
  BookIdentityEditDialog,
} from '@/components/books/book-identity-fields'
import {
  BookBrowseCornerButton,
} from '@/components/books/book-browse-spread-preview'
import { Button } from '@/components/ui/button'
import { PersistedPageThumbnail } from '@/components/books/persisted-page-thumbnail'
import { UnitPdfPageCountLoader } from '@/components/books/unit-pdf-page-count-loader'
import { isPresentationBook, resolveBookCatalogIdentity } from '@/lib/books/book-catalog-labels'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import {
  bookHasBrowsablePdf,
  bookNeedsLessonShelfOutline,
  buildBookLessonShelfSections,
  resolveLessonShelfCardPdfPage,
  type BookLessonShelfCard,
} from '@/lib/books/book-lesson-shelf'
import { bookHasMultipleVolumes, listBookVolumes } from '@/lib/books/book-volumes'
import { bookHasSingleSharedPdf } from '@/lib/books/split-stacked-pdf-ranges'
import type { BooksWorkshopOpenRequest } from '@/lib/books/books-workshop'
import type { BookLibraryPayload, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

/** One step smaller than Library covers (200) so lessons read as nested. */
const LESSON_THUMB_WIDTH = 160

interface BookLessonShelfProps {
  book: BookRecord
  library: BookLibraryPayload
  pdfReady: boolean
  onBackToLibrary: () => void
  onOutlineBook: () => void
  /** Outline a specific volume (multi-PDF books). */
  onOutlineVolume?: (volumeId: string) => void
  /** Cut a stacked single-PDF book into unit files. */
  onCutIntoUnits?: () => void
  /** Quiet overflow for materials / plan / advanced. */
  onOpenAdvancedTools: () => void
  /** Presentation with no units — open add-PDF flow. */
  onAddPdf?: () => void
  /** Open parts list for a lesson (Phase B). */
  onOpenLesson?: (unitId: string, lessonId: string) => void
  /** After cleanup rename (optional). */
  onBookSaved?: (payload: BookLibraryPayload) => void
  /** After remove from library. */
  onBookRemoved?: (payload: BookLibraryPayload, removedBookId: string) => void
  /** Workshop open (shelf Open book → unmarked). */
  onOpenWorkshop?: (request: BooksWorkshopOpenRequest) => void
}

export function BookLessonShelf({
  book,
  library,
  pdfReady,
  onBackToLibrary,
  onOutlineBook,
  onOutlineVolume,
  onCutIntoUnits,
  onOpenAdvancedTools,
  onAddPdf,
  onOpenLesson,
  onBookSaved,
  onBookRemoved,
  onOpenWorkshop,
}: BookLessonShelfProps) {
  const needsOutline = bookNeedsLessonShelfOutline(book)
  const multiVolume = bookHasMultipleVolumes(book)
  const canOpenPages = bookHasBrowsablePdf(book)
  const sections = useMemo(() => buildBookLessonShelfSections(book), [book])
  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections])
  const isPresentation = isPresentationBook(book)
  const canCutIntoUnits =
    Boolean(onCutIntoUnits) && !isPresentation && bookHasSingleSharedPdf(book) && canOpenPages
  const catalog = useMemo(() => resolveBookCatalogIdentity(book), [book])
  const catalogLine = [catalog.series, catalog.grade, catalog.role].filter(Boolean).join(' · ')
  const [editOpen, setEditOpen] = useState(false)
  const lessonCount = rows.reduce((n, row) => n + row.cards.length, 0)
  const [pageCountByFile, setPageCountByFile] = useState<Record<string, number>>({})
  const browsableUnits = useMemo(
    () => book.units.filter((unit) => Boolean(unit.filePath?.trim())),
    [book],
  )
  const [browseUnitId, setBrowseUnitId] = useState<string | null>(browsableUnits[0]?.id ?? null)
  const browseUnit = browsableUnits.find((unit) => unit.id === browseUnitId) ?? browsableUnits[0] ?? null

  useEffect(() => {
    const firstId = book.units.find((unit) => Boolean(unit.filePath?.trim()))?.id ?? null
    setBrowseUnitId(firstId)
  }, [book.id])

  const openWorkshopFromShelf = () => {
    if (!browseUnit || !onOpenWorkshop) return
    onOpenWorkshop({
      bookId: book.id,
      unitId: browseUnit.id,
      pdfPage: 1,
      kind: 'unmarked',
      bookTitle: book.title,
      unitTitle: browseUnit.title,
    })
  }
  const uniqueFilePaths = useMemo(() => {
    const paths = new Set<string>()
    for (const vol of listBookVolumes(book)) {
      if (vol.filePath) paths.add(vol.filePath)
    }
    for (const row of rows) {
      if (row.unit.filePath) paths.add(row.unit.filePath)
    }
    for (const unit of book.units) {
      if (unit.filePath?.trim()) paths.add(unit.filePath.trim())
    }
    return [...paths]
  }, [book, rows])

  const outlineVolume = (volumeId: string) => {
    if (onOutlineVolume) onOutlineVolume(volumeId)
    else onOutlineBook()
  }

  const openLessonInBook = (unitId: string, pdfPage: number) => {
    const next = book.units.find((item) => item.id === unitId)
    if (!next?.filePath?.trim() || !onOpenWorkshop) return
    onOpenWorkshop({
      bookId: book.id,
      unitId,
      pdfPage: Math.max(1, Math.floor(pdfPage)),
      kind: 'unmarked',
      bookTitle: book.title,
      unitTitle: next.title,
    })
  }

  return (
    <section className="space-y-6">
      {uniqueFilePaths.map((filePath) => (
        <UnitPdfPageCountLoader
          key={filePath}
          fileUrl={makeUnitFileUrl(filePath)}
          pdfReady={pdfReady}
          enabled={pageCountByFile[filePath] == null}
          onNumPages={(pages) => {
            setPageCountByFile((prev) => (prev[filePath] === pages ? prev : { ...prev, [filePath]: pages }))
          }}
        />
      ))}

      <header className="flex flex-wrap items-start justify-between gap-3 px-0.5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={onBackToLibrary}
            >
              <Library className="h-3.5 w-3.5" aria-hidden />
              Library
            </Button>
          </div>
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight text-foreground md:text-[28px]">
              {book.title}
            </h2>
            {catalogLine ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{catalogLine}</p>
            ) : null}
            {needsOutline ? (
              <p className={catalogLine ? 'text-[13px] text-muted-foreground' : 'mt-0.5 text-[13px] text-muted-foreground'}>
                {isPresentation ? 'No decks yet' : 'No lessons yet'}
              </p>
            ) : (
              <p className={catalogLine ? 'text-[13px] text-muted-foreground' : 'mt-0.5 text-[13px] text-muted-foreground'}>
                {isPresentation
                  ? `${lessonCount} ${lessonCount === 1 ? 'deck' : 'decks'}`
                  : multiVolume
                    ? `${listBookVolumes(book).length} volumes · ${book.units.length} ${book.units.length === 1 ? 'unit' : 'units'}`
                    : `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'} · ${rows.length} ${rows.length === 1 ? 'unit' : 'units'}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canOpenPages && onOpenWorkshop ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={openWorkshopFromShelf}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Open book
            </Button>
          ) : null}
          {!multiVolume && !(needsOutline && isPresentation) ? (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={onOutlineBook}>
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
              {needsOutline ? 'Outline this book' : 'Edit outline'}
            </Button>
          ) : null}
          {canCutIntoUnits ? (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={onCutIntoUnits}>
              <Scissors className="h-3.5 w-3.5" aria-hidden />
              Cut into units
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onOpenAdvancedTools}
            className="rounded-full px-2.5 py-1 text-[12px] text-muted-foreground/70 transition hover:bg-[var(--surface-3)] hover:text-foreground"
          >
            Advanced tools
          </button>
          {onBookRemoved ? (
            <BookIdentityDangerMenu
              book={book}
              onSaved={(payload) => onBookSaved?.(payload)}
              onRemoved={onBookRemoved}
              onEdit={() => setEditOpen(true)}
            />
          ) : null}
        </div>
      </header>

      <BookIdentityEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        book={book}
        library={library}
        onSaved={(payload) => onBookSaved?.(payload)}
      />

      {needsOutline ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl bg-[var(--surface-2)] px-6 py-12 text-center">
          <div className="flex h-16 w-12 items-center justify-center rounded-sm bg-[var(--surface-3)] shadow-sm">
            <Wand2 className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </div>
          {isPresentation ? (
            <>
              <div className="space-y-1">
                <p className="text-[15px] font-medium text-foreground">Add a PDF to this presentation</p>
                <p className="text-[13px] text-muted-foreground">Drop or upload a slide PDF, then come back here.</p>
              </div>
              <Button type="button" onClick={onAddPdf ?? onOutlineBook}>
                Add PDF
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-[15px] font-medium text-foreground">No lessons yet</p>
                <p className="text-[13px] text-muted-foreground">
                  Outline units and lessons so they show up as covers on this shelf.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="button" onClick={onOutlineBook} className="gap-1.5">
                  <Wand2 className="h-4 w-4" aria-hidden />
                  Outline this book
                </Button>
                {canCutIntoUnits ? (
                  <Button type="button" variant="outline" onClick={onCutIntoUnits} className="gap-1.5">
                    <Scissors className="h-4 w-4" aria-hidden />
                    Cut into units
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.volumeId ?? 'book'} className="space-y-6">
              {section.volumeTitle ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                    {section.volumeTitle}
                  </h3>
                  {section.volumeId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => outlineVolume(section.volumeId!)}
                    >
                      <Wand2 className="h-3.5 w-3.5" aria-hidden />
                      {section.needsOutline ? 'Outline this PDF' : 'Edit outline'}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {section.needsOutline && section.volumeId ? (
                <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--surface-2)] px-5 py-6">
                  <p className="text-[13px] text-muted-foreground">
                    This volume has its own contents pages. Outline it separately from the other PDFs.
                  </p>
                  <Button type="button" className="gap-1.5" onClick={() => outlineVolume(section.volumeId!)}>
                    <Wand2 className="h-4 w-4" aria-hidden />
                    Outline this PDF
                  </Button>
                </div>
              ) : (
                section.rows.map((row) => (
                  <section key={row.unit.id} className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3 px-0.5">
                      <h3 className="text-[17px] font-semibold tracking-tight text-foreground">
                        {row.unit.title}
                      </h3>
                      <span className="text-[12px] text-muted-foreground">
                        {row.cards.length}{' '}
                        {row.cards.length === 1
                          ? isPresentation || row.cards[0]?.kind === 'unit'
                            ? isPresentation
                              ? 'deck'
                              : 'unit'
                            : 'lesson'
                          : isPresentation || row.cards.every((c) => c.kind === 'unit')
                            ? isPresentation
                              ? 'decks'
                              : 'units'
                            : 'lessons'}
                      </span>
                    </div>
                    <div className="-mx-1 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
                      <ul className="flex w-max flex-row items-start gap-4 px-1">
                        {row.cards.map((card) => (
                          <li key={card.id} className="w-[160px] shrink-0">
                            <LessonShelfCard
                              book={book}
                              unit={row.unit}
                              card={card}
                              totalPdfPages={pageCountByFile[row.unit.filePath] ?? null}
                              onOpen={
                                card.kind === 'lesson' && card.lessonId && onOpenLesson
                                  ? () => onOpenLesson(row.unit.id, card.lessonId!)
                                  : undefined
                              }
                              onOpenInBook={
                                row.unit.filePath?.trim()
                                  ? (pdfPage) => openLessonInBook(row.unit.id, pdfPage)
                                  : undefined
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function LessonShelfCard({
  book,
  unit,
  card,
  totalPdfPages,
  onOpen,
  onOpenInBook,
}: {
  book: BookRecord
  unit: BookUnitRecord
  card: BookLessonShelfCard
  totalPdfPages: number | null
  onOpen?: () => void
  onOpenInBook?: (pdfPage: number) => void
}) {
  const pageNumber = resolveLessonShelfCardPdfPage(book, unit, card, totalPdfPages)
  const filePath = unit.filePath?.trim() || null
  const hasParts =
    card.kind === 'lesson' &&
    (unit.lessons?.find((l) => l.id === card.lessonId)?.parts?.length ?? 0) > 0

  const thumb = (
    <div
      className="relative w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)]"
      style={{ aspectRatio: '1 / 1.414' }}
      aria-label={`${card.indexLabel}: ${card.title}`}
    >
      {filePath ? (
        <PersistedPageThumbnail
          filePath={filePath}
          pageNumber={pageNumber}
          width={LESSON_THUMB_WIDTH}
          fitHeight
          objectFit="cover"
          label={card.title}
          eager
          className="h-full w-full"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted-foreground">
          {card.title}
        </div>
      )}
      {hasParts ? (
        <span
          className={cn(
            'pointer-events-none absolute left-1.5 top-1.5 z-10 h-2 w-2 rounded-full',
            'bg-[var(--brand-green)] shadow-[0_0_0_2px_rgba(255,255,255,0.85)]',
          )}
          title="Has parts"
          aria-label="Has parts"
        />
      ) : null}
    </div>
  )

  return (
    <div className="group relative flex w-full flex-col gap-2">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          aria-label={`Open ${card.title}`}
        >
          {thumb}
        </button>
      ) : (
        thumb
      )}
      {filePath && onOpenInBook ? (
        <BookBrowseCornerButton
          label="Open book at this lesson"
          onClick={() => onOpenInBook(pageNumber)}
        />
      ) : null}
      <div className="min-w-0 space-y-0.5 px-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{card.indexLabel}</p>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="line-clamp-2 w-full text-left text-[13px] font-medium leading-snug tracking-tight text-foreground transition hover:opacity-80"
          >
            {card.title}
          </button>
        ) : (
          <p className="line-clamp-2 text-[13px] font-medium leading-snug tracking-tight text-foreground">
            {card.title}
          </p>
        )}
      </div>
    </div>
  )
}
