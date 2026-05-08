import { useCallback } from 'react'
import type { RefObject } from 'react'

interface UseCurrentPageCaptureElArgs {
  isWhiteboardOpen: boolean
  wbCaptureRootRef: RefObject<HTMLElement | null>
  isSinglePageMode: boolean
  spreadRightPage: number | null
  annotationTargetPage: number
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
}

export function useCurrentPageCaptureEl({
  isWhiteboardOpen,
  wbCaptureRootRef,
  isSinglePageMode,
  spreadRightPage,
  annotationTargetPage,
  leftPageCaptureRef,
  rightPageCaptureRef,
}: UseCurrentPageCaptureElArgs): () => HTMLElement | null {
  return useCallback((): HTMLElement | null => {
    if (isWhiteboardOpen && wbCaptureRootRef.current) return wbCaptureRootRef.current
    if (isSinglePageMode) return leftPageCaptureRef.current
    if (spreadRightPage != null && annotationTargetPage === spreadRightPage) {
      return rightPageCaptureRef.current
    }
    return leftPageCaptureRef.current
  }, [annotationTargetPage, isSinglePageMode, isWhiteboardOpen, spreadRightPage])
}
