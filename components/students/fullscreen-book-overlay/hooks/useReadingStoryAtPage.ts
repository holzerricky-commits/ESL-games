import { useEffect, useMemo, useState } from 'react'
import {
  listReadingStoriesAtPdfPage,
  mergeStoriesForBook,
  rankReadingStoryPageHits,
  type ReadingStoryMap,
  type ReadingStoryPageHit,
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

  const readingStoryHits = useMemo(() => {
    if (!selectedBook || !selectedUnit) return [] as ReadingStoryPageHit[]
    const pages = [pageNumber]
    if (typeof spreadRightPage === 'number') pages.push(spreadRightPage)
    const byId = new Map<string, ReadingStoryPageHit>()
    for (const pdfPage of pages) {
      for (const hit of listReadingStoriesAtPdfPage({
        book: selectedBook,
        unit: selectedUnit,
        pdfPage,
        totalPdfPages: numPages,
        stories,
        overridesByStoryId: overridesById,
      })) {
        if (!byId.has(hit.story.id)) byId.set(hit.story.id, hit)
      }
    }
    return rankReadingStoryPageHits([...byId.values()], selectedUnit.id)
  }, [selectedBook, selectedUnit, pageNumber, spreadRightPage, numPages, stories, overridesById])

  return {
    readingStoryHits,
    readingStoryHit: readingStoryHits[0] ?? null,
  }
}
