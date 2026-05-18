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

      const safeHeight = bounds.height * 0.996
      const minWidth = useSinglePageMode ? 420 : 1
      // Do not key on `pageAspectRatio`: primed from PDF before first paint (B3); target width still
      // updates on every sync when aspect refines, while `spreadPageWidth` resets on book/unit/mode
      // and when lesson notebook opens or closes (viewport width step changes).
      const baseKey = `${selectedBookId ?? ''}|${selectedUnitId ?? ''}|${useSinglePageMode ? '1' : '0'}|lp:${isLessonPaperOpen ? 1 : 0}`

      if (useSinglePageMode) {
        const widthFitSingle = bounds.width * 0.996
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
      const widthFitSpread = perPageWidthForSpread
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
