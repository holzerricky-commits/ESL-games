'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  dispatchReadingCheckHotspotPlaceCancelled,
  dispatchReadingCheckHotspotPlaceResult,
  dispatchReadingCheckHotspotTry,
  registerReadingCheckHotspotPlaceStartHandler,
  type ReadingCheckHotspotPlaceStartDetail,
} from '@/lib/books/reading-check-hotspot-placement-events'
import { mapPdfPageToDisplayLabel } from '@/lib/books/page-numbering'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

export type UseReadingCheckHotspotPlacementArgs = {
  enabled: boolean
  bookId: string | null
  unitId: string | null
  selectedBook: BookRecord | null
  selectedUnit: BookUnitRecord | null
  totalPdfPages: number | null
  leftPdfPage: number | null
  rightPdfPage: number | null
  minimizeWhiteboard: () => void
  cancelBoardLinkPlacement?: () => void
}

function parseDisplayPage(label: string | null | undefined): number | null {
  if (!label) return null
  const trimmed = label.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 1 ? n : null
}

export function useReadingCheckHotspotPlacement({
  enabled,
  bookId,
  unitId,
  selectedBook,
  selectedUnit,
  totalPdfPages,
  leftPdfPage,
  rightPdfPage,
  minimizeWhiteboard,
  cancelBoardLinkPlacement,
}: UseReadingCheckHotspotPlacementArgs) {
  const [placementActive, setPlacementActive] = useState(false)
  const [pending, setPending] = useState<ReadingCheckHotspotPlaceStartDetail | null>(null)
  const [previewPdfPage, setPreviewPdfPage] = useState<number | null>(null)
  const [previewCenter, setPreviewCenter] = useState<[number, number] | null>(null)
  const [previewLabel, setPreviewLabel] = useState<string | undefined>(undefined)
  const [lastPlaced, setLastPlaced] = useState<{ stopId: string; storyId: string } | null>(null)

  const cancelReadingCheckHotspotPlacement = useCallback(() => {
    setPending((current) => {
      if (current) {
        dispatchReadingCheckHotspotPlaceCancelled({ stopId: current.stopId })
      }
      return null
    })
    setPlacementActive(false)
  }, [])

  const startFromDetail = useCallback(
    (detail: ReadingCheckHotspotPlaceStartDetail) => {
      if (!enabled) return false
      if (!bookId || !unitId) return false
      if (detail.bookId !== bookId || detail.unitId !== unitId) return false
      cancelBoardLinkPlacement?.()
      minimizeWhiteboard()
      setPending((prev) => {
        if (prev && prev.stopId !== detail.stopId) {
          dispatchReadingCheckHotspotPlaceCancelled({ stopId: prev.stopId })
        }
        return detail
      })
      setPlacementActive(true)
      toast.message('Tap the book page to place the question pin')
      return true
    },
    [bookId, cancelBoardLinkPlacement, enabled, minimizeWhiteboard, unitId],
  )

  useEffect(() => {
    if (!enabled) {
      setPlacementActive(false)
      setPending(null)
      return
    }
    return registerReadingCheckHotspotPlaceStartHandler(startFromDetail)
  }, [enabled, startFromDetail])

  const placeReadingCheckHotspotAt = useCallback(
    (pdfPage: number, center: [number, number]) => {
      if (!pending) {
        setPlacementActive(false)
        return false
      }
      const pageSide: 'left' | 'right' =
        leftPdfPage != null && pdfPage === leftPdfPage
          ? 'left'
          : rightPdfPage != null && pdfPage === rightPdfPage
            ? 'right'
            : 'right'
      const displayLabel =
        selectedBook && selectedUnit
          ? mapPdfPageToDisplayLabel(pdfPage, selectedBook, selectedUnit, totalPdfPages)
          : String(pdfPage)
      const displayPage = parseDisplayPage(displayLabel)

      dispatchReadingCheckHotspotPlaceResult({
        stopId: pending.stopId,
        storyId: pending.storyId,
        bookId: pending.bookId,
        unitId: pending.unitId,
        pdfPage,
        x: center[0],
        y: center[1],
        pageSide,
        displayPage,
      })

      setLastPlaced({ stopId: pending.stopId, storyId: pending.storyId })
      setPreviewPdfPage(pdfPage)
      setPreviewCenter(center)
      setPreviewLabel('Question pin')
      setPlacementActive(false)
      setPending(null)
      toast.success(
        displayPage != null ? `Pinned on page ${displayPage}` : `Pinned on book page ${pdfPage}`,
      )
      return true
    },
    [leftPdfPage, pending, rightPdfPage, selectedBook, selectedUnit, totalPdfPages],
  )

  const onReadingCheckHotspotPreviewClick = useCallback(() => {
    if (!lastPlaced) return
    dispatchReadingCheckHotspotTry(lastPlaced)
  }, [lastPlaced])

  return {
    readingCheckHotspotPlacementActive: placementActive,
    cancelReadingCheckHotspotPlacement,
    placeReadingCheckHotspotAt,
    readingCheckHotspotPreviewPdfPage: previewPdfPage,
    readingCheckHotspotPreviewCenter: previewCenter,
    readingCheckHotspotPreviewLabel: previewLabel,
    onReadingCheckHotspotPreviewClick,
  }
}
