import { useMemo } from 'react'
import type {
  BookLessonPartRecord,
  BookLessonRecord,
  BookLibraryPayload,
} from '@/lib/books/types'
import { getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import { buildNotebookPageSpanKey } from '@/lib/students/selectors'

type VocabReaderHit = { lesson: BookLessonRecord; part: BookLessonPartRecord }

interface UseBookReaderSpreadModelArgs {
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  numPages: number | null
  pageNumber: number
  vocabReaderHit: VocabReaderHit | null
}

export function useBookReaderSpreadModel({
  selectedBook,
  selectedUnit,
  numPages,
  pageNumber,
  vocabReaderHit,
}: UseBookReaderSpreadModelArgs) {
  const unitPageBounds = useMemo(() => {
    if (!selectedUnit) return { min: 1, max: Number.MAX_SAFE_INTEGER }
    return getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
  }, [selectedUnit, numPages, selectedBook])

  const visiblePages = useMemo(
    () => (selectedUnit ? getVisiblePdfPages(selectedUnit, numPages, selectedBook ?? undefined) : []),
    [selectedUnit, numPages, selectedBook],
  )

  const leftVisiblePageIndex = useMemo(() => {
    const idx = visiblePages.indexOf(pageNumber)
    return idx >= 0 ? idx : 0
  }, [visiblePages, pageNumber])

  const spreadRightPage = visiblePages[leftVisiblePageIndex + 1] ?? null
  const showSpreadRightPage = spreadRightPage != null

  const currentNotebookPageSpanKey = useMemo(
    () => buildNotebookPageSpanKey(pageNumber, showSpreadRightPage ? spreadRightPage : pageNumber),
    [pageNumber, showSpreadRightPage, spreadRightPage],
  )

  const currentTocPartKey = useMemo(
    () => (vocabReaderHit ? `${vocabReaderHit.lesson.id}::${vocabReaderHit.part.id}` : ''),
    [vocabReaderHit],
  )

  const currentTocPartTitle = useMemo(
    () => (vocabReaderHit?.part?.title ?? '').trim(),
    [vocabReaderHit?.part?.title],
  )

  const currentLessonPartPageSpanKey = useMemo(() => {
    const part = vocabReaderHit?.part
    const startRaw = Number(part?.startPageHint)
    if (!Number.isFinite(startRaw) || startRaw < 1) return currentNotebookPageSpanKey
    const start = Math.max(1, Math.floor(startRaw))
    const endRaw = Number(part?.endPageHint)
    const end = Number.isFinite(endRaw) && endRaw >= start ? Math.floor(endRaw) : start
    return buildNotebookPageSpanKey(start, end)
  }, [currentNotebookPageSpanKey, vocabReaderHit?.part?.endPageHint, vocabReaderHit?.part?.startPageHint])

  const currentTocBreadcrumb = useMemo(() => {
    const unitTitle = selectedUnit?.title?.trim()
    const partTitle = currentTocPartTitle
    const page = currentNotebookPageSpanKey
    const chunks = [unitTitle, partTitle, page].filter(
      (item): item is string => Boolean(item && item.trim().length > 0),
    )
    return chunks.join(' > ')
  }, [currentNotebookPageSpanKey, currentTocPartTitle, selectedUnit?.title])

  const lessonPartOrderByKey = useMemo(() => {
    const out: Record<string, number> = {}
    let idx = 0
    for (const lesson of selectedUnit?.lessons ?? []) {
      for (const part of lesson.parts ?? []) {
        out[`${lesson.id}::${part.id}`] = idx
        idx += 1
      }
    }
    return out
  }, [selectedUnit])

  return {
    unitPageBounds,
    visiblePages,
    leftVisiblePageIndex,
    spreadRightPage,
    showSpreadRightPage,
    currentNotebookPageSpanKey,
    currentTocPartKey,
    currentTocPartTitle,
    currentLessonPartPageSpanKey,
    currentTocBreadcrumb,
    lessonPartOrderByKey,
  }
}
