'use client'

import { ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import {
  resolveUnitShelfThumbPrintedStart,
} from '@/lib/books/book-lesson-shelf'
import {
  bookHasLessonOutline,
  buildBookOutlineTree,
} from '@/lib/books/book-outline-tree'
import { resolveLessonAndPartAtPdfPage } from '@/lib/books/interactive-vocab'
import {
  formatEffectivePageSpan,
  resolveMappedPageToPdfPage,
  type PageNumberingMode,
} from '@/lib/books/page-numbering'
import { parseCompactLessonTocLabel } from '@/lib/books/lesson-title'
import { resolveOutlinePrintedStartPdfPage } from '@/lib/books/story-thumb-pdf-page'
import { resolveTocExtractProfileForBook } from '@/lib/books/toc-extract-profile'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

/** Compact unit face in the L Contents rail. */
const UNIT_TOC_THUMB_WIDTH = 40

function lessonIdAtPdfPage(
  book: BookRecord,
  unit: BookUnitRecord,
  pdfPage: number,
  numPages: number | null,
): string | null {
  const fromParts = resolveLessonAndPartAtPdfPage(book, unit, null, pdfPage, numPages)
  if (fromParts) return fromParts.lesson.id

  const lessons = unit.lessons ?? []
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!
    const range = pageRangeForIndex(lessons, i, unit.startPageHint, unit.endPageHint)
    if (range.start == null) continue
    const startPdf = resolveMappedPageToPdfPage(range.start, book, unit, numPages) ?? range.start
    const endPdf =
      range.end != null
        ? (resolveMappedPageToPdfPage(range.end, book, unit, numPages) ?? range.end)
        : startPdf
    const lo = Math.min(startPdf, endPdf)
    const hi = Math.max(startPdf, endPdf)
    if (pdfPage >= lo && pdfPage <= hi) return lesson.id
  }
  return null
}

function pageSpanBadge(
  book: BookRecord,
  unit: BookUnitRecord,
  startHint: number | undefined,
  endHint: number | undefined,
  numPages: number | null,
  numberingMode: PageNumberingMode,
): string | null {
  if (typeof startHint !== 'number' || !Number.isFinite(startHint)) return null
  const span = formatEffectivePageSpan(
    startHint,
    endHint ?? null,
    book,
    unit,
    numPages,
    numberingMode,
  )
  if (!span || span === 'pages —' || span.startsWith('pages —')) {
    return String(Math.round(startHint))
  }
  // TOC shows bare numbers (e.g. 12 or 12-18), not "p12".
  return span.replace(/^p\.?\s*/i, '')
}

export interface BookPageListTocProps {
  book: BookRecord
  selectedUnitId: string
  pageNumber: number
  numPages: number | null
  numberingMode: PageNumberingMode
  onJumpToUnitPage: (unitId: string, mappedPage: number) => void
  pdfReady: boolean
  scrollRoot?: HTMLElement | null
}

export function BookPageListToc({
  book,
  selectedUnitId,
  pageNumber,
  numPages,
  numberingMode,
  onJumpToUnitPage,
  pdfReady,
  scrollRoot = null,
}: BookPageListTocProps) {
  const outlineTree = useMemo(() => buildBookOutlineTree(book), [book])
  const showVolumes = outlineTree.length > 1 || outlineTree[0]?.volume != null
  const tocProfile = useMemo(() => resolveTocExtractProfileForBook(book), [book])

  const selectedUnit = useMemo(
    () => book.units.find((u) => u.id === selectedUnitId) ?? null,
    [book.units, selectedUnitId],
  )

  const hereLessonId = useMemo(() => {
    if (!selectedUnit) return null
    return lessonIdAtPdfPage(book, selectedUnit, pageNumber, numPages)
  }, [book, selectedUnit, pageNumber, numPages])

  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(() => new Set())
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!selectedUnitId) return
    setExpandedUnits((prev) => {
      if (prev.has(selectedUnitId)) return prev
      const next = new Set(prev)
      next.add(selectedUnitId)
      return next
    })
    if (!showVolumes || !selectedUnit) return
    const volumeKey =
      selectedUnit.volumeId?.trim() ||
      outlineTree.find((v) => v.units.some((u) => u.unit.id === selectedUnitId))?.volumeKey
    if (!volumeKey || volumeKey === '__all__') return
    setExpandedVolumes((prev) => {
      if (prev.has(volumeKey)) return prev
      const next = new Set(prev)
      next.add(volumeKey)
      return next
    })
  }, [outlineTree, selectedUnit, selectedUnitId, showVolumes])

  const toggleVolume = (volumeKey: string) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev)
      if (next.has(volumeKey)) next.delete(volumeKey)
      else next.add(volumeKey)
      return next
    })
  }

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      if (next.has(unitId)) next.delete(unitId)
      else next.add(unitId)
      return next
    })
  }

  const jumpLesson = (unit: BookUnitRecord, lesson: BookLessonRecord) => {
    if (typeof lesson.startPageHint !== 'number' || !Number.isFinite(lesson.startPageHint)) return
    onJumpToUnitPage(unit.id, lesson.startPageHint)
  }

  const jumpUnitLeaf = (unit: BookUnitRecord) => {
    const start =
      typeof unit.startPageHint === 'number' && Number.isFinite(unit.startPageHint)
        ? unit.startPageHint
        : null
    if (start == null) return
    onJumpToUnitPage(unit.id, start)
  }

  if (!bookHasLessonOutline(book)) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1" role="list" aria-label="Book contents">
      {outlineTree.map((volumeNode) => {
        const volumeOpen = !showVolumes || expandedVolumes.has(volumeNode.volumeKey)
        return (
          <div key={volumeNode.volumeKey} className="space-y-0.5">
            {showVolumes && volumeNode.volume ? (
              <button
                type="button"
                onClick={() => toggleVolume(volumeNode.volumeKey)}
                className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-expanded={volumeOpen}
              >
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-white/40 transition-transform',
                    volumeOpen && 'rotate-90',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{volumeNode.volume.title}</span>
              </button>
            ) : null}

            {volumeOpen
              ? volumeNode.units.map((unitNode) => {
                  const hasLessons = unitNode.lessons.length > 0
                  const unitOpen = hasLessons ? expandedUnits.has(unitNode.unit.id) : false
                  const unitIsHere = !hasLessons && unitNode.unit.id === selectedUnitId
                  const unitRange = pageRangeForIndex(
                    volumeNode.units.map((n) => n.unit),
                    volumeNode.units.findIndex((n) => n.unit.id === unitNode.unit.id),
                  )
                  const unitPages =
                    unitNode.unit.id === selectedUnitId ? numPages : null
                  const unitBadge = pageSpanBadge(
                    book,
                    unitNode.unit,
                    unitNode.unit.startPageHint ?? unitRange.start ?? undefined,
                    unitNode.unit.endPageHint ?? unitRange.end ?? undefined,
                    unitPages,
                    numberingMode,
                  )
                  const printedStart = resolveUnitShelfThumbPrintedStart(
                    unitNode.unit,
                    tocProfile,
                  )
                  const thumbPdfPage =
                    resolveOutlinePrintedStartPdfPage(
                      printedStart,
                      book,
                      unitNode.unit,
                      unitPages,
                    ) ?? 1
                  const unitTitle = unitNode.unit.title?.trim() || 'Unit'
                  const unitIsCurrent =
                    unitIsHere ||
                    (hasLessons && unitNode.unit.id === selectedUnitId && !hereLessonId)
                  return (
                    <div
                      key={unitNode.unit.id}
                      className={cn(showVolumes && 'ml-2')}
                      role="listitem"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (hasLessons) toggleUnit(unitNode.unit.id)
                          else jumpUnitLeaf(unitNode.unit)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[13px] leading-snug transition-colors',
                          unitIsCurrent
                            ? 'bg-white/15 font-medium text-white'
                            : 'text-white/65 hover:bg-white/10 hover:text-white',
                        )}
                        aria-expanded={hasLessons ? unitOpen : undefined}
                      >
                        {hasLessons ? (
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 text-white/40 transition-transform',
                              unitOpen && 'rotate-90',
                            )}
                            aria-hidden
                          />
                        ) : unitIsHere ? (
                          <span
                            className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                            aria-hidden
                          />
                        ) : (
                          <span className="inline-flex h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        <PdfPageThumbnail
                          fileUrl={makeUnitFileUrl(unitNode.unit.filePath)}
                          unitId={unitNode.unit.id}
                          pageNumber={thumbPdfPage}
                          width={UNIT_TOC_THUMB_WIDTH}
                          scrollRoot={scrollRoot}
                          pdfReady={pdfReady}
                          label={unitTitle}
                          className="shrink-0 border-white/15 bg-white/5"
                        />
                        <span className="min-w-0 flex-1 break-words whitespace-normal">{unitTitle}</span>
                        {unitBadge ? (
                          <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/45">
                            {unitBadge}
                          </span>
                        ) : null}
                      </button>

                      {hasLessons && unitOpen ? (
                        <ul className="ml-4 space-y-0.5 border-l border-white/10 pl-2">
                          {unitNode.lessons.map((lesson, lessonIndex) => {
                            const isHere =
                              unitNode.unit.id === selectedUnitId && lesson.id === hereLessonId
                            const compact = parseCompactLessonTocLabel(
                              lesson.title,
                              lessonIndex + 1,
                            )
                            const lessonRange = pageRangeForIndex(
                              unitNode.lessons,
                              lessonIndex,
                              unitNode.unit.startPageHint,
                              unitNode.unit.endPageHint,
                            )
                            const badge = pageSpanBadge(
                              book,
                              unitNode.unit,
                              lesson.startPageHint ?? lessonRange.start ?? undefined,
                              lesson.endPageHint ?? lessonRange.end ?? undefined,
                              unitNode.unit.id === selectedUnitId ? numPages : null,
                              numberingMode,
                            )
                            return (
                              <li key={lesson.id}>
                                <button
                                  type="button"
                                  onClick={() => jumpLesson(unitNode.unit, lesson)}
                                  title={lesson.title?.trim() || compact.title}
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] leading-snug transition-colors',
                                    isHere
                                      ? 'bg-white/15 font-medium text-white'
                                      : 'text-white/55 hover:bg-white/10 hover:text-white',
                                  )}
                                >
                                  {isHere ? (
                                    <span
                                      className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                                      title="Current place"
                                      aria-hidden
                                    />
                                  ) : (
                                    <span className="inline-flex h-1.5 w-1.5 shrink-0" aria-hidden />
                                  )}
                                  <span
                                    className={cn(
                                      'w-5 shrink-0 text-right tabular-nums',
                                      isHere ? 'text-white/80' : 'text-white/40',
                                    )}
                                  >
                                    {compact.number}
                                  </span>
                                  <span className="min-w-0 flex-1 break-words whitespace-normal">{compact.title}</span>
                                  {badge ? (
                                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/40">
                                      {badge}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </div>
                  )
                })
              : null}
          </div>
        )
      })}
    </div>
  )
}
