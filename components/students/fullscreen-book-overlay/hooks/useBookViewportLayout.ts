import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseBookViewportLayoutArgs {
  open: boolean
  pageAspectRatio: number
  isLessonPaperOpen: boolean
  selectedBookId: string | null
  selectedUnitId: string | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  pageAreaRef: MutableRefObject<HTMLDivElement | null>
  spreadRenderBaseKeyRef: MutableRefObject<string>
  setPageAreaSize: Dispatch<SetStateAction<{ w: number; h: number }>>
  setIsSinglePageMode: Dispatch<SetStateAction<boolean>>
  setTargetSpreadPageWidth: Dispatch<SetStateAction<number>>
  setSpreadPageWidth: Dispatch<SetStateAction<number>>
}

export function useBookViewportLayout({
  open,
  pageAspectRatio,
  isLessonPaperOpen,
  selectedBookId,
  selectedUnitId,
  selectedUnit,
  pageAreaRef,
  spreadRenderBaseKeyRef,
  setPageAreaSize,
  setIsSinglePageMode,
  setTargetSpreadPageWidth,
  setSpreadPageWidth,
}: UseBookViewportLayoutArgs) {
  useEffect(() => {
    if (!open) return
    const area = pageAreaRef.current
    if (!area) return
    function syncPageWidth() {
      const el = pageAreaRef.current
      if (!el) return
      const bounds = el.getBoundingClientRect()
      setPageAreaSize({ w: bounds.width, h: bounds.height })
      const useSinglePageMode = false
      setIsSinglePageMode(useSinglePageMode)

      const safeHeight = bounds.height * 0.985
      const minWidth = useSinglePageMode ? 420 : 1
      const baseKey = `${selectedBookId ?? ''}|${selectedUnitId ?? ''}|${useSinglePageMode ? '1' : '0'}|${pageAspectRatio.toFixed(4)}`

      if (useSinglePageMode) {
        const widthFitSingle = bounds.width * 0.985
        const heightFitSingle = safeHeight * pageAspectRatio
        const finalSingleWidth = Math.min(widthFitSingle, heightFitSingle)
        const nextWidth = Math.floor(Math.max(minWidth, finalSingleWidth))
        setTargetSpreadPageWidth(nextWidth)
        if (spreadRenderBaseKeyRef.current !== baseKey) {
          setSpreadPageWidth(nextWidth)
          spreadRenderBaseKeyRef.current = baseKey
        }
        return
      }

      const perPageWidthForSpread = bounds.width / 2
      const widthFitSpread = perPageWidthForSpread * 0.995
      const heightFitSpread = safeHeight * pageAspectRatio
      const finalSpreadWidth = Math.min(widthFitSpread, heightFitSpread)
      const nextWidth = Math.floor(Math.max(minWidth, finalSpreadWidth))
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
    selectedUnit,
    selectedBookId,
    selectedUnitId,
    pageAreaRef,
    spreadRenderBaseKeyRef,
    setIsSinglePageMode,
    setPageAreaSize,
    setSpreadPageWidth,
    setTargetSpreadPageWidth,
  ])
}
