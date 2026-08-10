import { useEffect, useState } from 'react'
import {
  getLiveEligibleReadingCheckPack,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import type { ReadingStoryMap } from '@/lib/books/reading-story-map'

interface UseLiveReadingCheckPackArgs {
  story: ReadingStoryMap | null | undefined
}

/**
 * Loads the check pack for the current story and returns it only when
 * approved + usable (Phase 7 live gate). Draft / empty → null.
 */
export function useLiveReadingCheckPack({ story }: UseLiveReadingCheckPackArgs) {
  const [pack, setPack] = useState<ReadingCheckPack | null>(null)

  useEffect(() => {
    const storyId = story?.id?.trim() ?? ''
    if (!storyId) {
      setPack(null)
      return
    }

    let cancelled = false
    void fetch(`/api/reading-stories/checks?storyId=${encodeURIComponent(storyId)}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; pack?: ReadingCheckPack | null }) => {
        if (cancelled) return
        setPack(getLiveEligibleReadingCheckPack(data.ok ? data.pack : null))
      })
      .catch(() => {
        if (!cancelled) setPack(null)
      })

    return () => {
      cancelled = true
    }
  }, [story?.id])

  return { liveReadingCheckPack: pack }
}
