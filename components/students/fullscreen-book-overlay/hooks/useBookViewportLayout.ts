import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { shouldSkipSpreadTargetWidthSync } from '@/lib/books/spread-viewport-zoom'
import { computeSpreadPageWidth } from '@/lib/books/spread-viewport-layout'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseBookViewportLayoutArgs {
  open: boolean
  pageAspectRatio: number
  isLessonPaperOpen: boolean
  spreadResizeScaleEnabled: boolean
  selectedBookId: string | null
  selectedUnitId: string | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  pageAreaRef: MutableRefObject<HTMLDivElement | null>
  spreadRenderBaseKeyRef: MutableRefObject<string>
  setPageAreaSize: Dispatch<SetStateAction<{ w: number; h: number }>>
  setTargetSpreadPageWidth: Dispatch<SetStateAction<number>>
  setSpreadPageWidth: Dispatch<SetStateAction<number>>
}

export function useBookViewportLayout({
  open,
  pageAspectRatio,
  isLessonPaperOpen,
  spreadResizeScaleEnabled,
  selectedBookId,
  selectedUnitId,
  selectedUnit,
  pageAreaRef,
  spreadRenderBaseKeyRef,
  setPageAreaSize,
  setTargetSpreadPageWidth,
  setSpreadPageWidth,
}: UseBookViewportLayoutArgs) {
  useEffect(() => {
    if (!open) return
    const area = pageAreaRef.current
    if (!area) return
    let lastDevicePixelRatio =
      typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
        ? window.devicePixelRatio
        : 1

    function syncPageWidth() {
      const el = pageAreaRef.current
      if (!el) return
      const bounds = el.getBoundingClientRect()
      setPageAreaSize({ w: bounds.width, h: bounds.height })

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
      const baseKey = `${selectedBookId ?? ''}|${selectedUnitId ?? ''}|lp:${isLessonPaperOpen ? 1 : 0}`
      const nextWidth = computeSpreadPageWidth(bounds.width, bounds.height, pageAspectRatio, minWidth)

      setTargetSpreadPageWidth(nextWidth)
      if (spreadRenderBaseKeyRef.current !== baseKey) {
        setSpreadPageWidth(nextWidth)
        spreadRenderBaseKeyRef.current = baseKey
      }
    }
    syncPageWidth()
    const observer = new ResizeObserver(syncPageWidth)
    observer.observe(area)
    return () => {
      observer.disconnect()
    }
  }, [
    open,
    pageAspectRatio,
    isLessonPaperOpen,
    spreadResizeScaleEnabled,
    selectedUnit,
    selectedBookId,
    selectedUnitId,
    pageAreaRef,
    spreadRenderBaseKeyRef,
    setPageAreaSize,
    setSpreadPageWidth,
    setTargetSpreadPageWidth,
  ])
}
