import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  createReadingCheckHotspotPlacement,
  getLiveEligibleReadingCheckPack,
  pickStoryWithLiveReadingChecks,
  type ReadingCheckHotspotPageSide,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import type { ReadingStoryMap } from '@/lib/books/reading-story-map'

interface UseLiveReadingCheckPackArgs {
  /** Page owners, best first. The first story with an approved pack is used. */
  stories: readonly ReadingStoryMap[]
}

/**
 * Loads check packs for every story on this page and keeps the first
 * approved one. A duplicate story with no checks does not hide a pack
 * that was placed on another story covering the same pages.
 */
export function useLiveReadingCheckPack({ stories }: UseLiveReadingCheckPackArgs) {
  const storyKey = stories.map((row) => row.id).join('\0')
  const storiesRef = useRef(stories)
  storiesRef.current = stories
  const [pack, setPack] = useState<ReadingCheckPack | null>(null)
  const packRef = useRef(pack)
  packRef.current = pack
  const [story, setStory] = useState<ReadingStoryMap | null>(null)

  useEffect(() => {
    const current = storiesRef.current.filter((row) => row.id.trim())
    if (current.length === 0) {
      setPack(null)
      setStory(null)
      return
    }

    let cancelled = false
    void Promise.all(
      current.map(async (row) => {
        try {
          const response = await fetch(
            `/api/reading-stories/checks?storyId=${encodeURIComponent(row.id)}`,
          )
          const data = (await response.json()) as { ok?: boolean; pack?: ReadingCheckPack | null }
          return [row.id, data.ok ? (data.pack ?? null) : null] as const
        } catch {
          return [row.id, null] as const
        }
      }),
    )
      .then((rows) => {
        if (cancelled) return
        const packs = new Map(rows)
        const chosen = pickStoryWithLiveReadingChecks(current, packs)
        setStory(chosen)
        setPack(chosen ? getLiveEligibleReadingCheckPack(packs.get(chosen.id)) : null)
      })
      .catch(() => {
        if (!cancelled) {
          setPack(null)
          setStory(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [storyKey])

  /** Drop a pin at a new spot and save it without sending the pack back to draft. */
  const moveLiveReadingCheckPin = useCallback(
    (args: {
      stopId: string
      pdfPage: number
      center: [number, number]
      pageSide: ReadingCheckHotspotPageSide
      displayPage: number | null
    }) => {
      const current = packRef.current
      if (!current) return
      const hotspot = createReadingCheckHotspotPlacement({
        pdfPage: args.pdfPage,
        pageSide: args.pageSide,
        x: args.center[0],
        y: args.center[1],
      })
      setPack({
        ...current,
        stops: current.stops.map((s) =>
          s.id === args.stopId
            ? { ...s, hotspot, displayPage: args.displayPage ?? s.displayPage }
            : s,
        ),
      })
      void fetch('/api/reading-stories/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place-hotspot',
          storyId: current.storyId,
          bookId: current.bookId,
          unitId: current.unitId,
          stopId: args.stopId,
          hotspot,
          displayPage: args.displayPage,
        }),
      })
        .then((r) => r.json())
        .then((data: { ok?: boolean; error?: string }) => {
          if (!data.ok) toast.error(data.error || 'Could not save the pin position.')
        })
        .catch(() => toast.error('Could not save the pin position.'))
    },
    [],
  )

  return { liveReadingCheckPack: pack, liveReadingCheckStory: story, moveLiveReadingCheckPin }
}
