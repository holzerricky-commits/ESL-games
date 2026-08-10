'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { BookOutlinePartRow, BOOK_OUTLINE_PAGE_BADGE_CLASS } from '@/components/books/book-outline-part-row'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import {
  formatEffectivePageSpan,
  type PageNumberingMode,
} from '@/lib/books/page-numbering'
import { resolveStoryTitleThumbPdfPage } from '@/lib/books/story-thumb-pdf-page'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

interface BookOutlineSummaryTreeProps {
  book: BookRecord
  selectedUnitId: string | null
  readerLessonId: string | null
  readerPartId: string | null
  numPages: number | null
  pdfReady: boolean
  numberingMode?: PageNumberingMode
  onSelectUnit: (unitId: string) => void
  onSelectLesson: (unit: BookUnitRecord, lesson: BookLessonRecord) => void
  onSelectPart: (unit: BookUnitRecord, lesson: BookLessonRecord, part: BookLessonPartRecord) => void
}

export function BookOutlineSummaryTree({
  book,
  selectedUnitId,
  readerLessonId,
  readerPartId,
  numPages,
  pdfReady,
  numberingMode = 'mapped',
  onSelectUnit,
  onSelectLesson,
  onSelectPart,
}: BookOutlineSummaryTreeProps) {
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(selectedUnitId)
  const [expandedLessonByUnit, setExpandedLessonByUnit] = useState<Record<string, string | null>>({})

  if (book.units.length === 0) {
    return (
      <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
        No units yet. Use Edit lesson outline to map structure from your PDF.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {book.units.map((unit) => {
        const active = selectedUnitId === unit.id
        const unitOpen = expandedUnitId === unit.id
        const lessons = unit.lessons ?? []
        const unitCoverUrl = makeUnitFileUrl(unit.filePath)

        return (
          <div
            key={unit.id}
            className={cn(
              'overflow-hidden rounded-lg border text-left transition-colors',
              active
                ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                : 'border-[var(--border)] bg-[var(--surface-2)]',
            )}
          >
            <div className="flex items-stretch">
              <button
                type="button"
                className="flex shrink-0 items-center justify-center px-1.5 text-muted-foreground hover:text-foreground"
                aria-expanded={unitOpen}
                aria-label={unitOpen ? 'Hide lessons' : 'Show lessons'}
                onClick={() => setExpandedUnitId((prev) => (prev === unit.id ? null : unit.id))}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', unitOpen && 'rotate-180')} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectUnit(unit.id)
                  setExpandedUnitId(unit.id)
                }}
                className={cn(
                  'min-w-0 flex-1 px-2 py-2 text-left text-sm',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="block font-medium">{unit.title}</span>
              </button>
            </div>
            {unitOpen ? (
              <div className="border-t border-[var(--border)] bg-background/30 px-1 py-1">
                {lessons.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">No lessons mapped for this unit yet.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {lessons.map((lesson, lessonIndex) => {
                      const partsOpen = expandedLessonByUnit[unit.id] === lesson.id
                      const parts = lesson.parts ?? []
                      const lessonRange = pageRangeForIndex(lessons, lessonIndex)
                      return (
                        <li key={lesson.id} className="rounded-md">
                          <div className="flex items-start gap-0">
                            <button
                              type="button"
                              className={cn(
                                'mt-0.5 flex shrink-0 items-center justify-center p-1 text-muted-foreground hover:text-foreground',
                                parts.length === 0 && 'pointer-events-none opacity-25',
                              )}
                              aria-expanded={partsOpen}
                              disabled={parts.length === 0}
                              onClick={() =>
                                setExpandedLessonByUnit((prev) => ({
                                  ...prev,
                                  [unit.id]: prev[unit.id] === lesson.id ? null : lesson.id,
                                }))
                              }
                            >
                              <ChevronDown
                                className={cn('h-3.5 w-3.5 transition-transform', partsOpen && 'rotate-180')}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectLesson(unit, lesson)}
                              className={cn(
                                'min-w-0 flex-1 rounded px-1.5 py-1 text-left text-sm leading-snug',
                                active && readerLessonId === lesson.id && readerPartId == null
                                  ? 'bg-[var(--brand-blue)]/20 font-medium text-foreground'
                                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                              )}
                            >
                              <span className="flex min-w-0 items-baseline gap-2">
                                <span className="truncate font-medium">
                                  Lesson {lessonIndex + 1}: {lesson.title || 'Lesson'}
                                </span>
                                <span className={BOOK_OUTLINE_PAGE_BADGE_CLASS}>
                                  {formatEffectivePageSpan(
                                    lessonRange.start,
                                    lessonRange.end,
                                    book,
                                    unit,
                                    numPages,
                                    numberingMode,
                                  )}
                                </span>
                              </span>
                            </button>
                          </div>
                          {partsOpen && parts.length > 0 ? (
                            <ul className="ml-5 border-l border-[var(--border)]/80 py-0.5 pl-2">
                              {parts.map((part, partIndex) => {
                                const partRange = pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
                                const partRangeStart = partRange.start ?? lessonRange.start ?? 1
                                return (
                                  <li key={part.id}>
                                    <BookOutlinePartRow
                                      part={part}
                                      partIndex={partIndex}
                                      pageRangeLabel={formatEffectivePageSpan(
                                        partRange.start,
                                        partRange.end,
                                        book,
                                        unit,
                                        numPages,
                                        numberingMode,
                                      )}
                                      isActive={active && readerPartId === part.id}
                                      onSelect={() => onSelectPart(unit, lesson, part)}
                                      fileUrl={unitCoverUrl}
                                      pdfReady={pdfReady}
                                      storyThumbPdfPage={resolveStoryTitleThumbPdfPage({
                                        book,
                                        unit,
                                        lesson,
                                        part,
                                        partRangeStart,
                                        totalPdfPages: numPages,
                                      })}
                                      totalPdfPages={numPages}
                                    />
                                  </li>
                                )
                              })}
                            </ul>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
