import { useCallback } from 'react'
import type { RefObject } from 'react'

interface UseCurrentPageCaptureElArgs {
  isWhiteboardOpen: boolean
  wbCaptureRootRef: RefObject<HTMLElement | null>
  spreadRightPage: number | null
  annotationTargetPage: number
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
}

export function useCurrentPageCaptureEl({
  isWhiteboardOpen,
  wbCaptureRootRef,
  spreadRightPage,
  annotationTargetPage,
  leftPageCaptureRef,
  rightPageCaptureRef,
}: UseCurrentPageCaptureElArgs): () => HTMLElement | null {
  return useCallback((): HTMLElement | null => {
    if (isWhiteboardOpen && wbCaptureRootRef.current) return wbCaptureRootRef.current
    if (spreadRightPage != null && annotationTargetPage === spreadRightPage) {
      return rightPageCaptureRef.current
    }
    return leftPageCaptureRef.current
  }, [annotationTargetPage, isWhiteboardOpen, spreadRightPage])
}
