import { useEffect, useMemo, useState } from 'react'
import {
  findReadingStoryAtPdfPage,
  mergeStoriesForBook,
  type ReadingStoryMap,
  type ReadingStoryPdfRange,
  type ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseReadingStoryAtPageArgs {
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  pageNumber: number
  /** Optional facing page so a story that starts on the right still lights up. */
  spreadRightPage?: number | null
  numPages: number | null
}

export function useReadingStoryAtPage({
  selectedBook,
  selectedUnit,
  pageNumber,
  spreadRightPage = null,
  numPages,
}: UseReadingStoryAtPageArgs) {
  const [stories, setStories] = useState<ReadingStoryMap[]>([])
  const [overridesById, setOverridesById] = useState<Record<string, ReadingStoryRangeOverride>>({})

  useEffect(() => {
    if (!selectedBook) {
      setStories([])
      setOverridesById({})
      return
    }
    let cancelled = false
    void fetch(`/api/reading-stories?bookId=${encodeURIComponent(selectedBook.id)}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; stories?: ReadingStoryMap[]; overrides?: ReadingStoryRangeOverride[] }) => {
        if (cancelled || !data.ok) return
        const overrides = data.overrides ?? []
        const byId: Record<string, ReadingStoryRangeOverride> = {}
        for (const o of overrides) byId[o.storyId] = o
        setOverridesById(byId)
        setStories(mergeStoriesForBook(selectedBook.id, overrides, selectedBook))
      })
      .catch(() => {
        if (!cancelled) {
          setStories([])
          setOverridesById({})
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedBook])

  const readingStoryHit = useMemo(() => {
    if (!selectedBook || !selectedUnit) return null
    const pages = [pageNumber]
    if (typeof spreadRightPage === 'number') pages.push(spreadRightPage)
    for (const pdfPage of pages) {
      const hit = findReadingStoryAtPdfPage({
        book: selectedBook,
        unit: selectedUnit,
        pdfPage,
        totalPdfPages: numPages,
        stories,
        overridesByStoryId: overridesById,
      })
      if (hit) return hit
    }
    return null
  }, [selectedBook, selectedUnit, pageNumber, spreadRightPage, numPages, stories, overridesById])

  return {
    readingStoryHit: readingStoryHit as {
      story: ReadingStoryMap
      range: ReadingStoryPdfRange
    } | null,
  }
}
