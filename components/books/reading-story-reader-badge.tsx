'use client'

import type { ReadingStoryMap, ReadingStoryPdfRange } from '@/lib/books/reading-story-map'

interface ReadingStoryReaderBadgeProps {
  story: ReadingStoryMap
  range: ReadingStoryPdfRange
}

/** Compact Phase 1 marker: current spread is inside a mapped reading story. */
export function ReadingStoryReaderBadge({ story, range }: ReadingStoryReaderBadgeProps) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-3 z-[45] max-w-[min(90vw,28rem)] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-full border border-amber-400/35 bg-[#121a2e]/92 px-3 py-1.5 text-center shadow-lg shadow-black/25 backdrop-blur-sm">
        <p className="truncate text-xs font-medium text-amber-50/95">
          Story · {story.title}
        </p>
        <p className="truncate text-[10px] text-amber-100/65">
          Pages {range.startDisplayPage}–{range.endDisplayPage}
          {range.rangeConfirmed ? '' : ' · not confirmed yet'}
        </p>
      </div>
    </div>
  )
}
