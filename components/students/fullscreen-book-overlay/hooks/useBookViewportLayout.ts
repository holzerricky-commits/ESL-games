import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import {
  shouldIgnoreSpreadTargetWidthCorrection,
  spreadRenderLayoutBaseKey,
} from '@/lib/books/spread-resize-config'
import { shouldSkipSpreadTargetWidthSync } from '@/lib/books/spread-viewport-zoom'
import { computeSpreadPageWidth } from '@/lib/books/spread-viewport-layout'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseBookViewportLayoutArgs {
  open: boolean
  pageAspectRatio: number
  spreadResizeScaleEnabled: boolean
  /** When false, size the spread to fill the page area without hardcover chrome reserves. */
  includeBookFrame?: boolean
  selectedBookId: string | null
  selectedUnitId: string | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  pageAreaRef: MutableRefObject<HTMLDivElement | null>
  spreadRenderBaseKeyRef: MutableRefObject<string>
  /** Skip live size-chasing until this timestamp (performance.now). */
  spreadTargetHoldUntilRef: MutableRefObject<number>
  targetSpreadPageWidthRef: MutableRefObject<number>
  setPageAreaSize: Dispatch<SetStateAction<{ w: number; h: number }>>
  setTargetSpreadPageWidth: Dispatch<SetStateAction<number>>
  setSpreadPageWidth: Dispatch<SetStateAction<number>>
}

export function useBookViewportLayout({
  open,
  pageAspectRatio,
  spreadResizeScaleEnabled,
  includeBookFrame = true,
  selectedBookId,
  selectedUnitId,
  selectedUnit,
  pageAreaRef,
  spreadRenderBaseKeyRef,
  spreadTargetHoldUntilRef,
  targetSpreadPageWidthRef,
  setPageAreaSize,
  setTargetSpreadPageWidth,
  setSpreadPageWidth,
}: UseBookViewportLayoutArgs) {
  useEffect(() => {
    if (!open) {
      spreadRenderBaseKeyRef.current = ''
      return
    }
    const area = pageAreaRef.current
    if (!area) return
    let lastDevicePixelRatio =
      typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
        ? window.devicePixelRatio
        : 1

    function syncPageWidth() {
      const el = pageAreaRef.current
      if (!el) return
      if (performance.now() < spreadTargetHoldUntilRef.current) return

      const bounds = el.getBoundingClientRect()

      const nextDpr =
        typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
          ? window.devicePixelRatio
          : lastDevicePixelRatio
      if (shouldSkipSpreadTargetWidthSync(lastDevicePixelRatio, nextDpr, spreadResizeScaleEnabled)) {
        lastDevicePixelRatio = nextDpr
        return
      }
      lastDevicePixelRatio = nextDpr

      const minWidth = 1
      const baseKey = spreadRenderLayoutBaseKey(
        selectedBookId,
        selectedUnitId,
        includeBookFrame,
        pageAspectRatio,
      )
      const nextWidth = computeSpreadPageWidth(
        bounds.width,
        bounds.height,
        pageAspectRatio,
        minWidth,
        includeBookFrame,
      )
      const keyChanged = spreadRenderBaseKeyRef.current !== baseKey
      if (
        !keyChanged &&
        shouldIgnoreSpreadTargetWidthCorrection(targetSpreadPageWidthRef.current, nextWidth)
      ) {
        return
      }

      setPageAreaSize({ w: bounds.width, h: bounds.height })
      setTargetSpreadPageWidth(nextWidth)
      if (keyChanged) {
        spreadRenderBaseKeyRef.current = baseKey
        setSpreadPageWidth(nextWidth)
      }
    }
    syncPageWidth()
    const observer = new ResizeObserver(() => syncPageWidth())
    observer.observe(area)
    return () => {
      observer.disconnect()
    }
  }, [
    open,
    pageAspectRatio,
    spreadResizeScaleEnabled,
    includeBookFrame,
    selectedUnit,
    selectedBookId,
    selectedUnitId,
    pageAreaRef,
    spreadRenderBaseKeyRef,
    spreadTargetHoldUntilRef,
    targetSpreadPageWidthRef,
    setPageAreaSize,
    setSpreadPageWidth,
    setTargetSpreadPageWidth,
  ])
}
