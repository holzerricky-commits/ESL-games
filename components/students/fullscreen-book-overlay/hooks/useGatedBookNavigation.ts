'use client'

import { useCallback, useEffect, useRef } from 'react'
import { resolveAlignedAnchorPage, type PageNumberingMode } from '@/lib/books/page-numbering'
import {
  queueReaderPrefetchPagesImmediate,
  queueReaderPrefetchPagesLowRes,
} from '@/lib/books/page-render-cache'
import {
  getReaderPrefetchDirectionBias,
  resetReaderPrefetchDirectionBias,
  setReaderPrefetchDirectionBias,
} from '@/lib/books/reader-prefetch-direction-bias'
import {
  type ReaderPrefetchP0Intent,
  splitReaderPrefetchPages,
} from '@/lib/books/reader-prefetch-priority'
import { shouldSkipAdjacentStepEnqueue } from '@/lib/books/reader-adjacent-step-queue'
import {
  READER_ADJACENT_TURN_MIN_STEP_MS,
  resolveAdjacentAnchorPage,
} from '@/lib/books/reader-adjacent-turn-step'
import {
  flushPendingUnitPageSave,
  scheduleSaveUnitPage,
} from '@/lib/books/progress'
import {
  normalizePageTurnTarget,
  readerBoundsForUnit,
} from '@/lib/books/reader-spread-navigation'
import type { BookLibraryPayload } from '@/lib/books/types'
import { makeUnitFileUrl } from '../constants'

interface UseGatedBookNavigationArgs {
  selectedBookId: string | null
  selectedUnitId: string | null
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  numPages: number | null
  visiblePages: number[]
  pageNumber: number
  pageJumpDraft: string
  numberingMode: PageNumberingMode
  printedJumpBounds: { min: number; max: number; usePrinted: boolean }
  layoutSpreadPageWidth: number
  open: boolean
  setPageNumber: (v: number) => void
  onBeforeCommitPage?: (fromPage: number, toPage: number) => void
}

/**
 * Reader navigation — optimistic turns (R1) with one visible step per adjacent tap (R1b).
 * Jumps (page list / typed page) commit immediately. Arrow next/prev drain a step queue per frame.
 */
export function useGatedBookNavigation({
  selectedBookId,
  selectedUnitId,
  selectedBook,
  selectedUnit,
  numPages,
  visiblePages,
  pageNumber,
  pageJumpDraft,
  numberingMode,
  printedJumpBounds,
  layoutSpreadPageWidth,
  open,
  setPageNumber,
  onBeforeCommitPage,
}: UseGatedBookNavigationArgs) {
  const lastBookUnitRef = useRef<{ bookId: string; unitId: string } | null>(null)
  /** Latest anchor for burst taps (React state may lag one frame). */
  const anchorRef = useRef(pageNumber)
  const stepQueueRef = useRef<number[]>([])
  const drainingRef = useRef(false)
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onBeforeCommitPageRef = useRef(onBeforeCommitPage)
  onBeforeCommitPageRef.current = onBeforeCommitPage

  const readerBounds = readerBoundsForUnit(selectedUnit, numPages, selectedBook ?? undefined)

  useEffect(() => {
    anchorRef.current = pageNumber
  }, [pageNumber])

  useEffect(() => {
    if (!open) {
      stepQueueRef.current = []
      drainingRef.current = false
      resetReaderPrefetchDirectionBias()
      if (drainTimerRef.current != null) {
        clearTimeout(drainTimerRef.current)
        drainTimerRef.current = null
      }
    }
  }, [open])

  const kickPrefetchForAnchor = useCallback(
    (anchorPage: number, intent: ReaderPrefetchP0Intent = 'routine') => {
      if (!open || !selectedUnit || !(layoutSpreadPageWidth > 0)) return
      const fileUrl = makeUnitFileUrl(selectedUnit.filePath)
      const { immediate } = splitReaderPrefetchPages({
        anchorPage,
        visiblePages,
        readerBounds,
        directionBias: intent === 'routine' ? getReaderPrefetchDirectionBias() : 'neutral',
        intent,
      })
      queueReaderPrefetchPagesImmediate({
        fileUrl,
        unitId: selectedUnit.id,
        pages: immediate,
        widthPx: layoutSpreadPageWidth,
        shouldProceed: () => true,
      })
      queueReaderPrefetchPagesLowRes({
        fileUrl,
        unitId: selectedUnit.id,
        pages: immediate,
        widthPx: layoutSpreadPageWidth,
        shouldProceed: () => true,
      })
    },
    [open, selectedUnit, layoutSpreadPageWidth, visiblePages, readerBounds],
  )

  const commitPageNow = useCallback(
    (normalizedNext: number, prefetchIntent: ReaderPrefetchP0Intent = 'routine') => {
      if (!selectedBookId || !selectedUnitId) return
      const from = anchorRef.current
      if (from === normalizedNext) return
      onBeforeCommitPageRef.current?.(from, normalizedNext)
      anchorRef.current = normalizedNext
      setPageNumber(normalizedNext)
      scheduleSaveUnitPage(selectedBookId, selectedUnitId, normalizedNext)
      kickPrefetchForAnchor(normalizedNext, prefetchIntent)
    },
    [selectedBookId, selectedUnitId, setPageNumber, kickPrefetchForAnchor],
  )

  const scheduleDrainAfterStep = useCallback(() => {
    const run = () => {
      drainTimerRef.current = null
      const next = stepQueueRef.current.shift()
      if (next == null) {
        drainingRef.current = false
        return
      }
      commitPageNow(next)
      if (stepQueueRef.current.length > 0) {
        if (READER_ADJACENT_TURN_MIN_STEP_MS > 0) {
          drainTimerRef.current = setTimeout(run, READER_ADJACENT_TURN_MIN_STEP_MS)
        } else {
          requestAnimationFrame(run)
        }
      } else {
        drainingRef.current = false
      }
    }

    if (READER_ADJACENT_TURN_MIN_STEP_MS > 0) {
      drainTimerRef.current = setTimeout(run, READER_ADJACENT_TURN_MIN_STEP_MS)
    } else {
      requestAnimationFrame(run)
    }
  }, [commitPageNow])

  const enqueueAdjacentStep = useCallback(
    (normalizedNext: number) => {
      if (
        shouldSkipAdjacentStepEnqueue({
          anchorPage: anchorRef.current,
          queuedSteps: stepQueueRef.current,
          nextPage: normalizedNext,
        })
      ) {
        return
      }

      stepQueueRef.current.push(normalizedNext)
      if (!drainingRef.current) {
        drainingRef.current = true
        const first = stepQueueRef.current.shift()!
        commitPageNow(first)
        if (stepQueueRef.current.length > 0) {
          scheduleDrainAfterStep()
        } else {
          drainingRef.current = false
        }
      }
    },
    [commitPageNow, scheduleDrainAfterStep],
  )

  useEffect(() => {
    if (!open) flushPendingUnitPageSave()
  }, [open])

  useEffect(() => {
    if (!selectedBookId || !selectedUnitId) return
    const prev = lastBookUnitRef.current
    if (prev && (prev.bookId !== selectedBookId || prev.unitId !== selectedUnitId)) {
      flushPendingUnitPageSave()
    }
    lastBookUnitRef.current = { bookId: selectedBookId, unitId: selectedUnitId }
  }, [selectedBookId, selectedUnitId])

  useEffect(() => {
    return () => {
      flushPendingUnitPageSave()
      if (drainTimerRef.current != null) clearTimeout(drainTimerRef.current)
    }
  }, [])

  const requestGoToPage = useCallback(
    (nextPage: number) => {
      if (!selectedBookId || !selectedUnitId || !selectedUnit) return
      const normalizedNext = normalizePageTurnTarget({
        nextPage,
        visiblePages,
        readerBounds,
      })
      if (normalizedNext === anchorRef.current) return

      stepQueueRef.current = []
      drainingRef.current = false
      if (drainTimerRef.current != null) {
        clearTimeout(drainTimerRef.current)
        drainTimerRef.current = null
      }

      resetReaderPrefetchDirectionBias()
      commitPageNow(normalizedNext, 'jump')
    },
    [
      selectedBookId,
      selectedUnitId,
      selectedUnit,
      visiblePages,
      readerBounds,
      commitPageNow,
    ],
  )

  const goToAdjacentPage = useCallback(
    (direction: -1 | 1) => {
      setReaderPrefetchDirectionBias(direction === 1 ? 'forward' : 'backward')
      const nextPage = resolveAdjacentAnchorPage({
        anchorPage: anchorRef.current,
        direction,
        visiblePages,
      })
      if (nextPage == null) return

      const normalizedNext = normalizePageTurnTarget({
        nextPage,
        visiblePages,
        readerBounds,
      })
      enqueueAdjacentStep(normalizedNext)
    },
    [visiblePages, readerBounds, enqueueAdjacentStep],
  )

  const commitPageJump = useCallback(() => {
    const raw = pageJumpDraft.trim()
    const { min: effMin, max: effMax, usePrinted } = printedJumpBounds
    const clampPrinted = (n: number) => Math.max(effMin, Math.min(effMax, Math.floor(n)))
    const resolvePrintedToPdf = (printed: number): number | null => {
      if (!usePrinted) return Number.isFinite(printed) ? printed : null
      const e = clampPrinted(printed)
      const pdf = resolveAlignedAnchorPage(
        e,
        selectedBook ?? undefined,
        selectedUnit ?? undefined,
        numPages,
        numberingMode,
      )
      return pdf != null && Number.isFinite(pdf) ? pdf : null
    }

    const spreadMatch = raw.match(/^(\d+)\s*-\s*(\d+)\s*$/)
    const singleMatch = raw.match(/^(\d+)$/)

    if (usePrinted) {
      if (spreadMatch) {
        const pdf = resolvePrintedToPdf(parseInt(spreadMatch[1]!, 10))
        if (pdf != null) requestGoToPage(pdf)
        return
      }
      if (singleMatch) {
        const pdf = resolvePrintedToPdf(parseInt(singleMatch[1]!, 10))
        if (pdf != null) requestGoToPage(pdf)
        return
      }
      if (spreadMatch) {
        const pdf = resolvePrintedToPdf(parseInt(spreadMatch[1]!, 10))
        if (pdf != null) requestGoToPage(pdf)
        return
      }
      const loose = raw.match(/^(\d+)/)
      if (loose) {
        const pdf = resolvePrintedToPdf(parseInt(loose[1]!, 10))
        if (pdf != null) requestGoToPage(pdf)
      }
      return
    }

    const m = raw.match(/^(\d+)/)
    if (!m) return
    const n = parseInt(m[1]!, 10)
    if (!Number.isFinite(n)) return
    requestGoToPage(n)
  }, [
    requestGoToPage,
    numPages,
    numberingMode,
    pageJumpDraft,
    printedJumpBounds,
    selectedBook,
    selectedUnit,
  ])

  return {
    goToPage: requestGoToPage,
    goToAdjacentPage,
    commitPageJump,
  }
}
