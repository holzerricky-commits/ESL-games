'use client'

import { useEffect, useMemo } from 'react'
import { ArrowLeft, BookOpenText, ChevronDown, MapPin } from 'lucide-react'
import {
  groupNotebookSourceAnchors,
  listNotebookSourceAnchors,
  type NotebookSourceFilter,
} from '@/lib/books/notebook-source-page'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useDeferredValue } from 'react'

interface NotebookSourceNavProps {
  lessonPaperHtml: string
  lessonPaperEditVersion: number
  currentPageNumber: number
  notebookReturnPage: number | null
  onGoToSourcePage: (page: number) => void
  onReturnToCurrentPage: () => void
}

export function NotebookSourceNav({
  lessonPaperHtml,
  lessonPaperEditVersion,
  currentPageNumber,
  notebookReturnPage,
  onGoToSourcePage,
  onReturnToCurrentPage,
}: NotebookSourceNavProps) {
  void lessonPaperEditVersion
  const deferredHtml = useDeferredValue(lessonPaperHtml)
  const [anchorLimit, setAnchorLimit] = useState(140)
  const { anchors, truncated } = useMemo(
    () => listNotebookSourceAnchors(deferredHtml, { maxAnchors: anchorLimit }),
    [deferredHtml, anchorLimit],
  )
  const [activeFilter, setActiveFilter] = useState<NotebookSourceFilter>('all')
  const [showParts, setShowParts] = useState(true)
  const [showCaptures, setShowCaptures] = useState(true)
  const filtered = useMemo(
    () => (activeFilter === 'all' ? anchors : anchors.filter((a) => a.category === activeFilter)),
    [activeFilter, anchors],
  )
  const sessionGroups = useMemo(() => groupNotebookSourceAnchors(filtered), [filtered])
  const filterOptions: Array<{ id: NotebookSourceFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'vocabulary', label: 'Vocabulary' },
    { id: 'sentences', label: 'Sentences' },
    { id: 'concepts', label: 'Concepts' },
    { id: 'diagrams', label: 'Diagrams' },
  ]

  useEffect(() => {
    setAnchorLimit(140)
  }, [lessonPaperHtml])

  if (!anchors.length && notebookReturnPage == null) return null

  return (
    <div className="mb-3 space-y-2 rounded-md border border-[#e6e6e6] bg-[#faf8f5] px-2 py-2">
      {notebookReturnPage != null ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#2f6fed]/25 bg-[#2f6fed]/8 px-2 py-1.5">
          <p className="text-[11px] font-medium text-[#1f4fb8]">
            Viewing book page {currentPageNumber} (jumped from notebook)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 border-[#2f6fed]/30 text-[11px] text-[#1f4fb8]"
            onClick={onReturnToCurrentPage}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to current page
          </Button>
        </div>
      ) : null}
      {anchors.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">In this notebook</span>
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`rounded px-2 py-1 text-[10px] font-semibold ${
                  activeFilter === option.id ? 'bg-[#5c4030] text-white' : 'bg-white text-[#6b6b6b]'
                }`}
                onClick={() => setActiveFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {truncated ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] text-[#8a7a66]">
                Showing the first {anchors.length} source anchors for performance.
              </p>
              <button
                type="button"
                className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-[#5c4030] ring-1 ring-[#d7cec3]"
                onClick={() => setAnchorLimit((prev) => Math.min(2000, prev + 200))}
              >
                Load more anchors
              </button>
            </div>
          ) : null}
          {sessionGroups.map((group) => {
            const parts = group.anchors.filter((a) => a.kind === 'part')
            const captures = group.anchors.filter((a) => a.kind === 'whiteboard_capture')
            return (
              <div key={group.sessionKey} className="space-y-1 rounded border border-[#ece7df] bg-[#fffdf9] p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7a6a56]">{group.sessionLabel}</p>
                {parts.length > 0 ? (
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]"
                      onClick={() => setShowParts((v) => !v)}
                    >
                      <ChevronDown className={`h-3 w-3 ${showParts ? '' : '-rotate-90'}`} aria-hidden />
                      Parts ({parts.length})
                    </button>
                    {showParts ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {parts.map((anchor) => (
                          <Button
                            key={anchor.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 max-w-full gap-1 truncate border-[#5c4030]/20 bg-white text-[11px] text-[#3d2918]"
                            onClick={() => onGoToSourcePage(anchor.page)}
                            title={`Go to source page ${anchor.page}`}
                          >
                            <BookOpenText className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{anchor.label}</span>
                            <span className="shrink-0 tabular-nums text-[#6b6b6b]">p{anchor.page}</span>
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {captures.length > 0 ? (
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]"
                      onClick={() => setShowCaptures((v) => !v)}
                    >
                      <ChevronDown className={`h-3 w-3 ${showCaptures ? '' : '-rotate-90'}`} aria-hidden />
                      Whiteboard Captures ({captures.length})
                    </button>
                    {showCaptures ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {captures.map((anchor) => (
                          <Button
                            key={anchor.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 max-w-full gap-1 truncate border-[#5c4030]/20 bg-white text-[11px] text-[#3d2918]"
                            onClick={() => onGoToSourcePage(anchor.page)}
                            title={`Go to source page ${anchor.page}`}
                          >
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{anchor.label}</span>
                            <span className="shrink-0 tabular-nums text-[#6b6b6b]">p{anchor.page}</span>
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
