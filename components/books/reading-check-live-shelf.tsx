'use client'

import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react'
import { Check, CircleHelp, ListChecks, X } from 'lucide-react'
import { ReadingCheckGamePopup } from '@/components/books/reading-check-game-popup'
import { ReadingCheckQuestionPin } from '@/components/books/reading-check-question-pin'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  primaryQuestionOfStop,
  readingCheckHotspotOnSpread,
  stopHasReadingCheckHotspot,
  type ReadingCheckPack,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import {
  latestReadingCheckLiveMarkForStop,
  type ReadingCheckLiveMarkResult,
} from '@/lib/books/reading-check-live-marks'
import { mapPdfPageToDisplayLabel } from '@/lib/books/page-numbering'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

interface ReadingCheckLiveShelfProps {
  pack: ReadingCheckPack
  storyTitle: string
  studentId?: string | null
  classSessionId?: string | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  className?: string
  selectedBook?: BookRecord | null
  selectedUnit?: BookUnitRecord | null
  totalPdfPages?: number | null
  leftPdfPage?: number | null
  rightPdfPage?: number | null
  leftPageCaptureRef?: RefObject<HTMLDivElement | null>
  rightPageCaptureRef?: RefObject<HTMLDivElement | null>
}

type PageRects = {
  left: DOMRect | null
  right: DOMRect | null
}

function stopLinkLabel(stop: ReadingCheckStop, index: number): string {
  const label = stop.label.trim()
  if (label) return label
  return `Check ${index + 1}`
}

function markTone(result: ReadingCheckLiveMarkResult | null): string {
  if (result === 'correct') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900'
  if (result === 'incorrect') return 'border-rose-500/40 bg-rose-500/10 text-rose-900'
  if (result === 'skip') return 'border-border bg-muted/60 text-muted-foreground'
  return 'border-transparent hover:border-border hover:bg-muted/80'
}

function parseDisplayPage(label: string | null | undefined): number | null {
  if (!label) return null
  const trimmed = label.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 1 ? n : null
}

/** Live ? pins: size matches ReadingCheckQuestionPin (h-11 w-11). */
const LIVE_PIN_SIZE_PX = 44
const LIVE_PIN_PAGE_PAD_PX = 16
const LIVE_PIN_GAP_PX = 8

/**
 * In-class reading checks: side list + page-corner pins + answer-review popup.
 * Never changes the book page. Live pins sit bottom-right so they don’t cover text.
 */
export function ReadingCheckLiveShelf({
  pack,
  storyTitle,
  studentId = null,
  classSessionId = null,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  className,
  selectedBook = null,
  selectedUnit = null,
  totalPdfPages = null,
  leftPdfPage = null,
  rightPdfPage = null,
  leftPageCaptureRef,
  rightPageCaptureRef,
}: ReadingCheckLiveShelfProps) {
  const [mounted, setMounted] = useState(false)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const [markByStopId, setMarkByStopId] = useState<Record<string, ReadingCheckLiveMarkResult>>({})
  const [pageRects, setPageRects] = useState<PageRects>({ left: null, right: null })

  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  const usableStops = useMemo(
    () =>
      pack.stops.filter((s) => {
        const q = primaryQuestionOfStop(s)
        return !!q?.prompt.trim()
      }),
    [pack.stops],
  )

  const leftDisplayPage = useMemo(() => {
    if (!selectedBook || !selectedUnit || leftPdfPage == null) return null
    return parseDisplayPage(mapPdfPageToDisplayLabel(leftPdfPage, selectedBook, selectedUnit, totalPdfPages))
  }, [leftPdfPage, selectedBook, selectedUnit, totalPdfPages])

  const rightDisplayPage = useMemo(() => {
    if (!selectedBook || !selectedUnit || rightPdfPage == null) return null
    return parseDisplayPage(mapPdfPageToDisplayLabel(rightPdfPage, selectedBook, selectedUnit, totalPdfPages))
  }, [rightPdfPage, selectedBook, selectedUnit, totalPdfPages])

  const hotspotStops = useMemo(
    () =>
      usableStops.filter((stop) => {
        if (!stopHasReadingCheckHotspot(stop) || !stop.hotspot) return false
        return (
          readingCheckHotspotOnSpread(stop, {
            leftPdfPage,
            rightPdfPage,
            leftDisplayPage,
            rightDisplayPage,
          }) != null
        )
      }),
    [usableStops, leftDisplayPage, rightDisplayPage, leftPdfPage, rightPdfPage],
  )

  useEffect(() => {
    if (!open) setActiveStopId(null)
  }, [open])

  useEffect(() => {
    const next: Record<string, ReadingCheckLiveMarkResult> = {}
    for (const stop of usableStops) {
      const latest = latestReadingCheckLiveMarkForStop(pack.storyId, stop.id)
      if (latest) next[stop.id] = latest.result
    }
    setMarkByStopId(next)
  }, [pack.storyId, usableStops])

  useLayoutEffect(() => {
    const updateRects = () => {
      setPageRects({
        left: leftPageCaptureRef?.current?.getBoundingClientRect() ?? null,
        right: rightPageCaptureRef?.current?.getBoundingClientRect() ?? null,
      })
    }

    updateRects()
    const leftEl = leftPageCaptureRef?.current ?? null
    const rightEl = rightPageCaptureRef?.current ?? null
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateRects) : null
    if (leftEl) observer?.observe(leftEl)
    if (rightEl) observer?.observe(rightEl)
    window.addEventListener('resize', updateRects)
    window.addEventListener('scroll', updateRects, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateRects)
      window.removeEventListener('scroll', updateRects, true)
    }
  }, [leftPageCaptureRef, rightPageCaptureRef, leftPdfPage, rightPdfPage])

  const activeStop = usableStops.find((s) => s.id === activeStopId) ?? null
  const activeQuestion = activeStop ? primaryQuestionOfStop(activeStop) : null
  const activeIndex = activeStop ? usableStops.findIndex((s) => s.id === activeStop.id) : -1

  function openStop(stopId: string) {
    setActiveStopId(stopId)
  }

  const livePinLayouts = useMemo(() => {
    const indexOnPage: Record<'left' | 'right', number> = { left: 0, right: 0 }
    const layouts: Array<{
      stop: ReadingCheckStop
      index: number
      style: CSSProperties
    }> = []

    hotspotStops.forEach((stop, index) => {
      const side = readingCheckHotspotOnSpread(stop, {
        leftPdfPage,
        rightPdfPage,
        leftDisplayPage,
        rightDisplayPage,
      })
      if (side !== 'left' && side !== 'right') return
      const rect = side === 'left' ? pageRects.left : pageRects.right
      if (!rect) return
      const stackIndex = indexOnPage[side]
      indexOnPage[side] += 1
      layouts.push({
        stop,
        index,
        style: {
          position: 'fixed',
          left:
            rect.right -
            LIVE_PIN_PAGE_PAD_PX -
            LIVE_PIN_SIZE_PX -
            stackIndex * (LIVE_PIN_SIZE_PX + LIVE_PIN_GAP_PX),
          top: rect.bottom - LIVE_PIN_PAGE_PAD_PX - LIVE_PIN_SIZE_PX,
          zIndex: 76,
        },
      })
    })

    return layouts
  }, [
    hotspotStops,
    leftDisplayPage,
    leftPdfPage,
    pageRects.left,
    pageRects.right,
    rightDisplayPage,
    rightPdfPage,
  ])

  if (usableStops.length === 0) return null

  return (
    <div className={cn(!hideTrigger && 'flex justify-end', className)}>
      <div>
        {!hideTrigger ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-2 shadow-md"
            onClick={() => setOpen(true)}
          >
            <ListChecks className="h-4 w-4" aria-hidden />
            Checks ({usableStops.length})
          </Button>
        ) : null}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle className="text-base font-semibold">Reading checks</SheetTitle>
              <p className="text-xs font-normal text-muted-foreground">
                {storyTitle} · tap a check, student speaks, then tap the answer to review it.
              </p>
            </SheetHeader>

            <ScrollArea className="flex-1 px-2 py-3">
              <ul className="space-y-1">
                {usableStops.map((stop, index) => {
                  const marked = markByStopId[stop.id] ?? null
                  const hasHotspot = hotspotStops.some((item) => item.id === stop.id)
                  return (
                    <li key={stop.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-start gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition',
                          markTone(marked),
                        )}
                        onClick={() => openStop(stop.id)}
                      >
                        <span className="mt-0.5 w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-snug">{stopLinkLabel(stop, index)}</span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            {stop.displayPage != null ? `p${stop.displayPage}` : 'story beat'}
                            {hasHotspot ? ' · on page' : ''}
                          </span>
                        </span>
                        {marked === 'correct' ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-label="Marked correct" />
                        ) : marked === 'incorrect' ? (
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-label="Marked incorrect" />
                        ) : marked === 'skip' ? (
                          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Skipped" />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {mounted && livePinLayouts.length > 0
          ? createPortal(
              <>
                {livePinLayouts.map(({ stop, index, style }) => {
                  const marked = markByStopId[stop.id] ?? null
                  return (
                    <ReadingCheckQuestionPin
                      key={stop.id}
                      tone={
                        marked === 'correct'
                          ? 'correct'
                          : marked === 'incorrect'
                            ? 'incorrect'
                            : marked === 'skip'
                              ? 'skip'
                              : 'default'
                      }
                      style={style}
                      onClick={() => openStop(stop.id)}
                      label={stopLinkLabel(stop, index)}
                    />
                  )
                })}
              </>,
              document.body,
            )
          : null}

        {activeStop != null && activeQuestion != null ? (
          <ReadingCheckGamePopup
            open
            onOpenChange={(next) => {
              if (!next) setActiveStopId(null)
            }}
            stop={activeStop}
            question={activeQuestion}
            title={activeIndex >= 0 ? stopLinkLabel(activeStop, activeIndex) : 'Check'}
            mode="live"
            storyId={pack.storyId}
            bookId={pack.bookId}
            studentId={studentId}
            classSessionId={classSessionId}
            onLiveMarked={(result) => {
              setMarkByStopId((prev) => ({ ...prev, [activeStop.id]: result }))
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
