'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Library } from 'lucide-react'
import { BookPartChecksPrep } from '@/components/books/book-part-checks-prep'
import { BookPartLiveSpreadPreview } from '@/components/books/book-part-live-spread-preview'
import {
  BookPartPagesConfirm,
  type BookPartPagesDisplayRange,
} from '@/components/books/book-part-pages-confirm'
import { BookPartStoryTextPrep } from '@/components/books/book-part-story-text-prep'
import { BookPartOutlineSpreadPreview } from '@/components/books/book-part-outline-spread-preview'
import { BookPartVocabPrep } from '@/components/books/book-part-vocab-prep'
import {
  BookPartWorkbenchToolSwitcher,
  type BookPartWorkbenchToolId,
} from '@/components/books/book-part-workbench-tool-switcher'
import { BookWorkbenchShell, BOOK_WORKBENCH_LEFT_WIDTH_PX } from '@/components/books/book-workbench-shell'
import { UnitPdfPageCountLoader } from '@/components/books/unit-pdf-page-count-loader'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import { formatPartListHeadline, formatPartPageRangeLabel, isStoryPartShelfTag, isVocabPartShelfTag } from '@/lib/books/book-part-shelf'
import type { BooksWorkshopOpenRequest } from '@/lib/books/books-workshop'
import { BOOK_LESSON_PART_TAG_LABELS, resolvePartStructureTag } from '@/lib/books/part-structure-tag'
import { resolveTocExtractProfileForBook } from '@/lib/books/toc-extract-profile'
import { readingStoryPartKey } from '@/lib/books/reading-story-map'
import type { ReadingCheckPack, ReadingCheckStop } from '@/lib/books/reading-check-pack'
import { resolveMappedPageToPdfPage } from '@/lib/books/page-numbering'
import { readingStoryTextStatus } from '@/lib/books/reading-story-text'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import { resolveOutlinePrintedStartPdfPage } from '@/lib/books/story-thumb-pdf-page'
import { useSearchablePdfStatus } from '@/lib/books/use-searchable-pdf-status'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

const PART_PREP_THUMB_WIDTH = 260

interface BookPartPrepShellProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  lessonIndex: number
  part: BookLessonPartRecord
  partIndex: number
  pdfReady: boolean
  onBackToParts: () => void
  onBackToLessons: () => void
  onBackToLibrary: () => void
  onOpenWorkshop?: (request: BooksWorkshopOpenRequest) => void
}

export function BookPartPrepShell({
  book,
  unit,
  lesson,
  lessonIndex,
  part,
  partIndex,
  pdfReady,
  onBackToParts,
  onBackToLessons,
  onBackToLibrary,
  onOpenWorkshop,
}: BookPartPrepShellProps) {
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [textReady, setTextReady] = useState(false)
  const [checksReady, setChecksReady] = useState(false)
  const [storyDisplayRange, setStoryDisplayRange] = useState<BookPartPagesDisplayRange | null>(null)
  const [activeTool, setActiveTool] = useState<BookPartWorkbenchToolId>('pages')
  const [checksDraft, setChecksDraft] = useState<ReadingCheckPack | null>(null)
  const [checksActiveStop, setChecksActiveStop] = useState<ReadingCheckStop | null>(null)
  const [requestedStopId, setRequestedStopId] = useState<string | null>(null)
  const fileUrl = unit.filePath ? makeUnitFileUrl(unit.filePath) : null
  const lessons = unit.lessons ?? []
  const lessonRange = pageRangeForIndex(lessons, lessonIndex)
  const parts = lesson.parts ?? []
  const range = pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
  const tag = resolvePartStructureTag(part, partIndex, resolveTocExtractProfileForBook(book))
  const typeLabel = BOOK_LESSON_PART_TAG_LABELS[tag] ?? 'Part'
  const isStory = isStoryPartShelfTag(tag)
  const isVocab = isVocabPartShelfTag(tag)
  const headline = formatPartListHeadline(typeLabel, part.title)
  const storyId = useMemo(
    () => readingStoryPartKey(book.id, unit.id, lesson.id, part.id),
    [book.id, unit.id, lesson.id, part.id],
  )
  const pagesReadyForSelectable =
    isStory &&
    (storyDisplayRange != null || (range.start != null && range.end != null))
  const { status: selectableStatus, filePath: searchableFilePath } = useSearchablePdfStatus({
    bookId: book.id,
    unitId: unit.id,
    storyId,
    lessonId: lesson.id,
    partId: part.id,
    title: part.title?.trim() || 'Story',
    totalPdfPages: pageCount,
    enabled: pagesReadyForSelectable,
  })
  const selectableReady =
    selectableStatus === 'stamped' || selectableStatus === 'native-text'
  const liveDocumentUrl =
    selectableReady && searchableFilePath?.trim()
      ? makeUnitFileUrl(searchableFilePath.trim())
      : null
  const workshopPdfPage =
    resolveOutlinePrintedStartPdfPage(range.start, book, unit, pageCount) ??
    (typeof range.start === 'number' ? Math.max(1, Math.floor(range.start)) : 1)
  const outlineRangeLabel =
    range.start != null
      ? range.end != null && range.end !== range.start
        ? `${range.start}–${range.end}`
        : `${range.start}`
      : '—'

  function openWorkshop() {
    onOpenWorkshop?.({
      bookId: book.id,
      unitId: unit.id,
      pdfPage: workshopPdfPage,
      storyId: isStory ? storyId : null,
      kind: isStory ? 'story' : isVocab ? 'vocab' : 'unmarked',
      lessonId: isVocab || isStory ? lesson.id : null,
      partId: isVocab || isStory ? part.id : null,
      startPageHint: range.start,
      endPageHint: range.end,
      bookTitle: book.title,
      unitTitle: unit.title,
      lessonTitle: lesson.title,
      partTitle: headline.name,
      typeLabel: headline.prefix ?? typeLabel,
      pageRangeLabel: range.start != null ? formatPartPageRangeLabel(range.start, range.end) : null,
    })
  }

  const handleTextReadyChange = useCallback((ready: boolean) => {
    setTextReady(ready)
  }, [])

  const handleChecksReadyChange = useCallback((ready: boolean) => {
    setChecksReady(ready)
  }, [])

  const handleChecksDraftChange = useCallback((next: ReadingCheckPack | null) => {
    setChecksDraft(next)
  }, [])

  const handleChecksActiveStopChange = useCallback((stop: ReadingCheckStop | null) => {
    setChecksActiveStop(stop)
  }, [])

  const handleStoryDisplayRangeChange = useCallback((next: BookPartPagesDisplayRange | null) => {
    setStoryDisplayRange((prev) => {
      if (next == null) return prev == null ? prev : null
      if (prev?.startDisplay === next.startDisplay && prev?.endDisplay === next.endDisplay) {
        return prev
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!isStory) {
      setTextReady(false)
      setChecksReady(false)
      setStoryDisplayRange(null)
      setActiveTool('pages')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [textRes, packRes] = await Promise.all([
          fetch(`/api/reading-stories/text?storyId=${encodeURIComponent(storyId)}`),
          fetch(`/api/reading-stories/checks?storyId=${encodeURIComponent(storyId)}`),
        ])
        const textData = (await textRes.json()) as {
          ok?: boolean
          text?: { text?: string } | null
        }
        const packData = (await packRes.json()) as {
          ok?: boolean
          pack?: { status?: string } | null
        }
        if (cancelled) return
        if (textData.ok) {
          setTextReady(readingStoryTextStatus(textData.text?.text) === 'ready')
        }
        if (packData.ok) {
          setChecksReady(packData.pack?.status === 'approved')
        }
      } catch {
        // Badges stay in default todo state.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isStory, storyId])

  const checksFocusPdfPage = useMemo(() => {
    if (activeTool !== 'checks' || !checksActiveStop) return null
    if (typeof checksActiveStop.hotspot?.pdfPage === 'number' && checksActiveStop.hotspot.pdfPage >= 1) {
      return checksActiveStop.hotspot.pdfPage
    }
    if (typeof checksActiveStop.displayPage === 'number' && checksActiveStop.displayPage >= 1) {
      return resolveMappedPageToPdfPage(checksActiveStop.displayPage, book, unit, pageCount)
    }
    return null
  }, [activeTool, book, checksActiveStop, pageCount, unit])

  useEffect(() => {
    if (requestedStopId && checksActiveStop?.id === requestedStopId) {
      setRequestedStopId(null)
    }
  }, [requestedStopId, checksActiveStop])

  const pageCountLoader = (
    <UnitPdfPageCountLoader
      fileUrl={fileUrl}
      pdfReady={pdfReady}
      enabled={Boolean(fileUrl) && pageCount == null}
      onNumPages={setPageCount}
    />
  )

  if (isStory) {
    let leftTool: ReactNode
    if (activeTool === 'text') {
      leftTool = (
        <BookPartStoryTextPrep
          book={book}
          unit={unit}
          lesson={lesson}
          part={{ ...part, structureTag: tag }}
          partIndex={partIndex}
          totalPdfPages={pageCount}
          layout="panel"
          onTextReadyChange={handleTextReadyChange}
        />
      )
    } else if (activeTool === 'checks') {
      leftTool = (
        <BookPartChecksPrep
          book={book}
          unit={unit}
          lesson={lesson}
          part={{ ...part, structureTag: tag }}
          partIndex={partIndex}
          totalPdfPages={pageCount}
          textReady={textReady}
          onChecksReadyChange={handleChecksReadyChange}
          rail
          onOpenStoryText={() => setActiveTool('text')}
          onDraftChange={handleChecksDraftChange}
          onActiveStopChange={handleChecksActiveStopChange}
          requestedStopId={requestedStopId}
          className="h-full"
        />
      )
    } else {
      leftTool = (
        <BookPartPagesConfirm
          book={book}
          unit={unit}
          lesson={lesson}
          part={{ ...part, structureTag: tag }}
          partIndex={partIndex}
          partTypeLabel={headline.prefix}
          partTitle={headline.name}
          pdfReady={pdfReady}
          totalPdfPages={pageCount}
          onPdfNumPages={setPageCount}
          layout="controls"
          rail
          onDisplayRangeChange={handleStoryDisplayRangeChange}
          onOpenInBook={onOpenWorkshop ? () => openWorkshop() : undefined}
        />
      )
    }

    return (
      <>
        {pageCountLoader}
        <BookWorkbenchShell
          open
          onClose={onBackToParts}
          ariaLabel={`Prep ${headline.name}`}
          title={headline.name}
          subtitle={[headline.prefix, book.title].filter(Boolean).join(' · ')}
          left={leftTool}
          leftWidthPx={activeTool === 'checks' ? 420 : BOOK_WORKBENCH_LEFT_WIDTH_PX}
          leftPaneClassName={
            activeTool === 'checks'
              ? 'flex min-h-0 flex-col overflow-hidden overscroll-contain'
              : undefined
          }
          leftFooter={
            <div className="px-3 py-3">
              <BookPartWorkbenchToolSwitcher
                active={activeTool}
                onChange={setActiveTool}
                textReady={textReady}
                checksReady={checksReady}
              />
            </div>
          }
          book={
            fileUrl ? (
              <BookPartLiveSpreadPreview
                fileUrl={fileUrl}
                unitId={`${book.id}-${unit.id}-${part.id}-part-live`}
                book={book}
                unit={unit}
                pdfReady={pdfReady}
                totalPdfPages={pageCount}
                printedStart={storyDisplayRange?.startDisplay ?? range.start}
                printedEnd={storyDisplayRange?.endDisplay ?? range.end}
                onPdfNumPages={setPageCount}
                documentUrl={liveDocumentUrl}
                enableTextLayer={selectableReady && activeTool !== 'checks'}
                className="h-full min-h-0 rounded-none bg-transparent p-0 shadow-none sm:p-0"
                checksPlacement={
                  activeTool === 'checks'
                    ? {
                        storyId,
                        bookId: book.id,
                        unitId: unit.id,
                        stops: checksDraft?.stops ?? [],
                        activeStopId: checksActiveStop?.id ?? null,
                        onSelectStop: setRequestedStopId,
                      }
                    : null
                }
                focusPdfPage={activeTool === 'checks' ? checksFocusPdfPage : null}
              />
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                No PDF
              </div>
            )
          }
        />
      </>
    )
  }

  return (
    <section className="w-full space-y-8">
      {pageCountLoader}

      <header className="flex items-center justify-between gap-4 px-0.5">
        <nav
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[13px] text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <button
            type="button"
            onClick={onBackToLibrary}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 transition hover:text-foreground"
          >
            <Library className="h-3.5 w-3.5" aria-hidden />
            Library
          </button>
          <span className="shrink-0 text-muted-foreground/35" aria-hidden>
            /
          </span>
          <button
            type="button"
            onClick={onBackToLessons}
            className="shrink-0 rounded-full py-1 transition hover:text-foreground"
          >
            Lessons
          </button>
          <span className="shrink-0 text-muted-foreground/35" aria-hidden>
            /
          </span>
          <button
            type="button"
            onClick={onBackToParts}
            className="shrink-0 rounded-full py-1 transition hover:text-foreground"
          >
            Parts
          </button>
          <span className="hidden shrink-0 text-muted-foreground/35 sm:inline" aria-hidden>
            /
          </span>
          <span className="hidden min-w-0 truncate py-1 sm:inline">{lesson.title}</span>
        </nav>
      </header>

      <div className="space-y-6">
        {isVocab ? null : (
          <div className="rounded-[28px] bg-[var(--surface-2)] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-start lg:gap-10 lg:p-10">
              <div className="mx-auto shrink-0 lg:mx-0">
                {fileUrl ? (
                  <BookPartOutlineSpreadPreview
                    fileUrl={fileUrl}
                    unitId={`${book.id}-${unit.id}-${part.id}-part-shell`}
                    book={book}
                    unit={unit}
                    pdfReady={pdfReady}
                    totalPdfPages={pageCount}
                    printedStart={range.start}
                    printedEnd={range.end}
                    thumbWidth={PART_PREP_THUMB_WIDTH}
                    size="lg"
                    onPdfNumPages={setPageCount}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center rounded-2xl bg-[var(--surface-3)] p-4 text-sm text-muted-foreground"
                    style={{
                      width: PART_PREP_THUMB_WIDTH * 2 + 8 + 44 * 2 + 24,
                      minHeight: Math.round(PART_PREP_THUMB_WIDTH * 1.414),
                    }}
                  >
                    No PDF
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-6 text-center lg:pt-1 lg:text-left">
                <div className="space-y-1">
                  {headline.prefix ? (
                    <p className="text-[13px] font-medium text-muted-foreground">{headline.prefix}</p>
                  ) : null}
                  <h3 className="text-[24px] font-semibold leading-snug tracking-tight text-foreground md:text-[28px]">
                    {headline.name}
                  </h3>
                </div>
                <div className="space-y-1">
                  <p className="text-[13px] font-medium text-muted-foreground">Pages</p>
                  <p className="text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
                    {outlineRangeLabel}
                  </p>
                  <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
                    From the lesson outline. Page editing for stories lives on main and paired story parts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isVocab ? (
          <BookPartVocabPrep
            book={book}
            unit={unit}
            lesson={lesson}
            part={{ ...part, structureTag: tag }}
            partTypeLabel={headline.prefix}
            partTitle={headline.name}
            pageRangeLabel={outlineRangeLabel}
            pdfReady={pdfReady}
            totalPdfPages={pageCount}
            startPageHint={range.start}
            endPageHint={range.end}
            onPdfNumPages={setPageCount}
            onOpenWorkshop={onOpenWorkshop ? () => openWorkshop() : undefined}
          />
        ) : (
          <div className="overflow-hidden rounded-[28px] bg-[var(--surface-2)] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)]">
            <div className="px-6 py-5 sm:px-8">
              <p className="text-[17px] font-semibold tracking-tight text-foreground">Story prep</p>
              <p className="mt-0.5 text-[14px] text-muted-foreground">
                Story text and reading checks are available on main and paired story parts.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
