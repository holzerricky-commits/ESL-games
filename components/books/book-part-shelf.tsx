'use client'

import { useMemo, useState, type ComponentType } from 'react'
import {
  BookA,
  BookOpen,
  ChevronRight,
  Feather,
  FileText,
  Hand,
  Library,
  Link2,
  MessageCircleQuestion,
  PenLine,
  Pilcrow,
  Shapes,
  SpellCheck,
  Wand2,
  type LucideProps,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { UnitPdfPageCountLoader } from '@/components/books/unit-pdf-page-count-loader'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import {
  buildBookPartShelfCards,
  formatPartListHeadline,
  formatPartPageRangeLabel,
  isStoryPartShelfTag,
  type BookPartShelfCard,
} from '@/lib/books/book-part-shelf'
import { resolveOutlinePrintedStartPdfPage } from '@/lib/books/story-thumb-pdf-page'
import type { BookLessonPartTag, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

type PartIcon = ComponentType<LucideProps>

const PART_TYPE_ICONS: Record<BookLessonPartTag, PartIcon> = {
  unspecified: FileText,
  vocabulary_in_context: BookA,
  vocabulary_background: BookA,
  vocabulary_strategy: SpellCheck,
  comprehension: MessageCircleQuestion,
  main_story: BookOpen,
  paired_story: BookOpen,
  your_turn: Hand,
  making_connections: Link2,
  grammar: Pilcrow,
  writing_narrate: PenLine,
  genre: Shapes,
  literary_element: Feather,
}

/** Large enough to recognize the page; still smaller than lesson-shelf thumbs. */
const STORY_THUMB_WIDTH = 88

interface BookPartShelfProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  lessonIndex: number
  pdfReady: boolean
  onBackToLessons: () => void
  onBackToLibrary: () => void
  onOutlineBook: () => void
  onOpenPart: (partId: string) => void
}

export function BookPartShelf({
  book,
  unit,
  lesson,
  lessonIndex,
  pdfReady,
  onBackToLessons,
  onBackToLibrary,
  onOutlineBook,
  onOpenPart,
}: BookPartShelfProps) {
  const cards = useMemo(
    () => buildBookPartShelfCards(unit, lesson, lessonIndex),
    [unit, lesson, lessonIndex],
  )
  const hasStoryRow = cards.some((card) => isStoryPartShelfTag(card.structureTag))
  const [pageCount, setPageCount] = useState<number | null>(null)
  const fileUrl = unit.filePath ? makeUnitFileUrl(unit.filePath) : null

  return (
    <section className="space-y-6">
      {hasStoryRow ? (
        <UnitPdfPageCountLoader
          fileUrl={fileUrl}
          pdfReady={pdfReady}
          enabled={Boolean(fileUrl) && pageCount == null}
          onNumPages={setPageCount}
        />
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3 px-0.5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1">
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
            <span className="text-muted-foreground/50" aria-hidden>
              /
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground"
              onClick={onBackToLessons}
            >
              Lessons
            </Button>
          </div>
          <div>
            <p className="text-[12px] text-muted-foreground">{unit.title}</p>
            <h2 className="text-[24px] font-semibold tracking-tight text-foreground md:text-[28px]">
              {lesson.title}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {cards.length} {cards.length === 1 ? 'part' : 'parts'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={onOutlineBook}>
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Edit outline
          </Button>
        </div>
      </header>

      {cards.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl bg-[var(--surface-2)] px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-foreground">No parts in this lesson</p>
          <p className="text-[13px] text-muted-foreground">Add parts in the outline so you can prep them here.</p>
          <Button type="button" onClick={onOutlineBook} className="gap-1.5">
            <Wand2 className="h-4 w-4" aria-hidden />
            Edit outline
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {cards.map((card) => (
            <li key={card.id}>
              <PartListRow
                book={book}
                unit={unit}
                card={card}
                fileUrl={fileUrl}
                pdfReady={pdfReady}
                totalPdfPages={pageCount}
                onOpen={() => onOpenPart(card.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PartListRow({
  book,
  unit,
  card,
  fileUrl,
  pdfReady,
  totalPdfPages,
  onOpen,
}: {
  book: BookRecord
  unit: BookUnitRecord
  card: BookPartShelfCard
  fileUrl: string | null
  pdfReady: boolean
  totalPdfPages: number | null
  onOpen: () => void
}) {
  const pageLabel = formatPartPageRangeLabel(card.printedStart, card.printedEnd)
  const Icon = PART_TYPE_ICONS[card.structureTag] ?? FileText
  const headline = formatPartListHeadline(card.typeLabel, card.title)
  const ariaName = headline.prefix ? `${headline.prefix}: ${headline.name}` : headline.name
  const isStory = isStoryPartShelfTag(card.structureTag)
  const storyThumbPage = isStory
    ? resolveOutlinePrintedStartPdfPage(card.printedStart, book, unit, totalPdfPages)
    : null
  const showStoryThumb = Boolean(isStory && fileUrl && pdfReady && storyThumbPage != null)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full items-center gap-3 px-0.5 text-left outline-none transition hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] sm:gap-4',
        isStory
          ? 'border-l-2 border-[var(--brand-blue)]/45 bg-[var(--brand-blue)]/[0.03] py-3 pl-2 sm:py-3.5'
          : 'py-3.5',
      )}
      aria-label={`Open ${ariaName}`}
    >
      {showStoryThumb ? (
        <span
          className="relative shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          style={{ width: STORY_THUMB_WIDTH, aspectRatio: '1 / 1.414' }}
        >
          <PdfPageThumbnail
            fileUrl={fileUrl!}
            unitId={`${book.id}-${unit.id}-${card.id}-part-story`}
            pageNumber={storyThumbPage!}
            width={STORY_THUMB_WIDTH}
            fitHeight
            objectFit="cover"
            pdfReady={pdfReady}
            label={card.title}
            eager
            className="h-full w-full"
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--surface-2)] px-1 text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-[var(--border)]">
            {card.partIndex + 1}
          </span>
        </span>
      ) : (
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-3)] text-foreground">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--surface-2)] px-1 text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-[var(--border)]">
            {card.partIndex + 1}
          </span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate leading-snug tracking-tight',
            isStory ? 'text-[17px]' : 'text-[16px]',
          )}
        >
          {headline.prefix ? (
            <>
              <span className="font-medium text-muted-foreground">{headline.prefix}: </span>
              <span className="font-semibold text-foreground">{headline.name}</span>
            </>
          ) : (
            <span className="font-semibold text-foreground">{headline.name}</span>
          )}
        </p>
        <p className="mt-0.5 truncate text-[12px] font-normal tabular-nums text-muted-foreground sm:hidden">
          {pageLabel}
        </p>
      </div>
      <p className="hidden shrink-0 text-[12px] font-normal tabular-nums text-muted-foreground sm:block">
        {pageLabel}
      </p>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground/60 transition group-hover:text-foreground"
        aria-hidden
      />
    </button>
  )
}
