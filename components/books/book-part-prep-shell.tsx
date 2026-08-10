'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Library } from 'lucide-react'
import { BookPartChecksPrep } from '@/components/books/book-part-checks-prep'
import { BookPartPagesConfirm } from '@/components/books/book-part-pages-confirm'
import { BookPartPrepStatusChips } from '@/components/books/book-part-prep-status-chips'
import { BookPartStoryTextPrep } from '@/components/books/book-part-story-text-prep'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { UnitPdfPageCountLoader } from '@/components/books/unit-pdf-page-count-loader'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import { formatPartListHeadline, isStoryPartShelfTag } from '@/lib/books/book-part-shelf'
import { BOOK_LESSON_PART_TAG_LABELS, effectivePartStructureTag } from '@/lib/books/part-structure-tag'
import { readingStoryPartKey } from '@/lib/books/reading-story-map'
import { readingStoryTextStatus } from '@/lib/books/reading-story-text'
import { resolveOutlinePrintedStartPdfPage } from '@/lib/books/story-thumb-pdf-page'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

const NON_STORY_PREVIEW_WIDTH = 240

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
}

function scrollToPrepSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
}: BookPartPrepShellProps) {
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [textReady, setTextReady] = useState(false)
  const [checksReady, setChecksReady] = useState(false)
  const fileUrl = unit.filePath ? makeUnitFileUrl(unit.filePath) : null
  const lessons = unit.lessons ?? []
  const lessonRange = pageRangeForIndex(lessons, lessonIndex)
  const parts = lesson.parts ?? []
  const range = pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
  const tag = effectivePartStructureTag(part)
  const typeLabel = BOOK_LESSON_PART_TAG_LABELS[tag] ?? 'Part'
  const isStory = isStoryPartShelfTag(tag)
  const headline = formatPartListHeadline(typeLabel, part.title)
  const storyId = useMemo(
    () => readingStoryPartKey(book.id, unit.id, lesson.id, part.id),
    [book.id, unit.id, lesson.id, part.id],
  )

  const previewPage = useMemo(() => {
    return (
      resolveOutlinePrintedStartPdfPage(range.start, book, unit, pageCount) ??
      Math.max(1, Math.floor(range.start ?? 1))
    )
  }, [book, unit, range.start, pageCount])

  const outlineRangeLabel =
    range.start != null
      ? range.end != null && range.end !== range.start
        ? `${range.start}–${range.end}`
        : `${range.start}`
      : '—'

  const handleTextReadyChange = useCallback((ready: boolean) => {
    setTextReady(ready)
  }, [])

  const handleChecksReadyChange = useCallback((ready: boolean) => {
    setChecksReady(ready)
  }, [])

  useEffect(() => {
    if (!isStory) {
      setTextReady(false)
      setChecksReady(false)
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

  return (
    <section className="w-full space-y-8">
      <UnitPdfPageCountLoader
        fileUrl={fileUrl}
        pdfReady={pdfReady}
        enabled={Boolean(fileUrl) && pageCount == null}
        onNumPages={setPageCount}
      />

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
        {isStory ? (
          <BookPartPagesConfirm
            book={book}
            unit={unit}
            lesson={lesson}
            part={{ ...part, structureTag: tag }}
            partTypeLabel={headline.prefix}
            partTitle={headline.name}
            pdfReady={pdfReady}
            totalPdfPages={pageCount}
            onPdfNumPages={setPageCount}
            statusSlot={
              <BookPartPrepStatusChips
                textState={textReady ? 'ready' : 'todo'}
                checksState={checksReady ? 'ready' : 'todo'}
                onTextClick={() => scrollToPrepSection('part-prep-story-text')}
                onChecksClick={() => scrollToPrepSection('part-prep-checks')}
              />
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[28px] bg-[var(--surface-2)] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-start lg:gap-10 lg:p-10">
              <div
                className="mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl bg-[var(--surface-3)] shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)] lg:mx-0"
                style={{ aspectRatio: '1 / 1.414' }}
              >
                {fileUrl ? (
                  <PdfPageThumbnail
                    fileUrl={fileUrl}
                    unitId={`${book.id}-${unit.id}-${part.id}-part-shell`}
                    pageNumber={previewPage}
                    width={NON_STORY_PREVIEW_WIDTH}
                    fitHeight
                    objectFit="contain"
                    pdfReady={pdfReady}
                    label={part.title}
                    eager
                    className="h-full w-full border-0"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
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

        {isStory ? (
          <>
            <BookPartStoryTextPrep
              book={book}
              unit={unit}
              lesson={lesson}
              part={{ ...part, structureTag: tag }}
              totalPdfPages={pageCount}
              onTextReadyChange={handleTextReadyChange}
            />
            <BookPartChecksPrep
              book={book}
              unit={unit}
              lesson={lesson}
              part={{ ...part, structureTag: tag }}
              totalPdfPages={pageCount}
              textReady={textReady}
              onChecksReadyChange={handleChecksReadyChange}
            />
          </>
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
