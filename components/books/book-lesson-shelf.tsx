'use client'

import { useMemo, useState } from 'react'
import { Library, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { UnitPdfPageCountLoader } from '@/components/books/unit-pdf-page-count-loader'
import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import {
  bookNeedsLessonShelfOutline,
  buildBookLessonShelfRows,
  resolveLessonShelfCardPdfPage,
  type BookLessonShelfCard,
} from '@/lib/books/book-lesson-shelf'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

/** One step smaller than Library covers (200) so lessons read as nested. */
const LESSON_THUMB_WIDTH = 160

interface BookLessonShelfProps {
  book: BookRecord
  pdfReady: boolean
  onBackToLibrary: () => void
  onOutlineBook: () => void
  /** Quiet overflow for materials / plan / advanced. */
  onOpenAdvancedTools: () => void
  /** Presentation with no units — open add-PDF flow. */
  onAddPdf?: () => void
  /** Open parts list for a lesson (Phase B). */
  onOpenLesson?: (unitId: string, lessonId: string) => void
}

export function BookLessonShelf({
  book,
  pdfReady,
  onBackToLibrary,
  onOutlineBook,
  onOpenAdvancedTools,
  onAddPdf,
  onOpenLesson,
}: BookLessonShelfProps) {
  const needsOutline = bookNeedsLessonShelfOutline(book)
  const rows = useMemo(() => buildBookLessonShelfRows(book), [book])
  const isPresentation = isPresentationBook(book)
  const lessonCount = rows.reduce((n, row) => n + row.cards.length, 0)
  const [pageCountByFile, setPageCountByFile] = useState<Record<string, number>>({})

  const uniqueFilePaths = useMemo(() => {
    const paths = new Set<string>()
    for (const row of rows) {
      if (row.unit.filePath) paths.add(row.unit.filePath)
    }
    return [...paths]
  }, [rows])

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
            {!needsOutline ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {isPresentation
                  ? `${lessonCount} ${lessonCount === 1 ? 'deck' : 'decks'}`
                  : `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'} · ${rows.length} ${rows.length === 1 ? 'unit' : 'units'}`}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!needsOutline ? (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={onOutlineBook}>
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
              Edit outline
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onOpenAdvancedTools}
            className="rounded-full px-2.5 py-1 text-[12px] text-muted-foreground/70 transition hover:bg-[var(--surface-3)] hover:text-foreground"
          >
            Advanced tools
          </button>
        </div>
      </header>

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
                <p className="text-[15px] font-medium text-foreground">Map this book first</p>
                <p className="text-[13px] text-muted-foreground">
                  Outline units and lessons so they show up as covers on this shelf.
                </p>
              </div>
              <Button type="button" onClick={onOutlineBook} className="gap-1.5">
                <Wand2 className="h-4 w-4" aria-hidden />
                Outline this book
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {rows.map((row) => (
            <section key={row.unit.id} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3 px-0.5">
                <h3 className="text-[17px] font-semibold tracking-tight text-foreground">{row.unit.title}</h3>
                <span className="text-[12px] text-muted-foreground">
                  {row.cards.length}{' '}
                  {row.cards.length === 1
                    ? isPresentation
                      ? 'deck'
                      : 'lesson'
                    : isPresentation
                      ? 'decks'
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
                        pdfReady={pdfReady}
                        totalPdfPages={pageCountByFile[row.unit.filePath] ?? null}
                        onOpen={
                          card.kind === 'lesson' && card.lessonId && onOpenLesson
                            ? () => onOpenLesson(row.unit.id, card.lessonId!)
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
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
  pdfReady,
  totalPdfPages,
  onOpen,
}: {
  book: BookRecord
  unit: BookUnitRecord
  card: BookLessonShelfCard
  pdfReady: boolean
  totalPdfPages: number | null
  onOpen?: () => void
}) {
  const pageNumber = resolveLessonShelfCardPdfPage(book, unit, card, totalPdfPages)
  const fileUrl = unit.filePath ? makeUnitFileUrl(unit.filePath) : null
  const hasParts =
    card.kind === 'lesson' &&
    (unit.lessons?.find((l) => l.id === card.lessonId)?.parts?.length ?? 0) > 0

  const thumb = (
    <div
      className="relative w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)]"
      style={{ aspectRatio: '1 / 1.414' }}
      aria-label={`${card.indexLabel}: ${card.title}`}
    >
      {fileUrl ? (
        <PdfPageThumbnail
          fileUrl={fileUrl}
          unitId={`${book.id}-${unit.id}-${card.id}-lesson-shelf`}
          pageNumber={pageNumber}
          width={LESSON_THUMB_WIDTH}
          fitHeight
          objectFit="cover"
          pdfReady={pdfReady}
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
    <div className="flex w-full flex-col gap-2">
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
