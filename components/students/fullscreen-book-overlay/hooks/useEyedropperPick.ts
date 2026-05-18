import { useCallback, useRef, type MutableRefObject } from 'react'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { EyedropperVariant } from '@/lib/books/eyedropper-variant'
import { inkFromEyedropperSample } from '@/lib/books/eyedropper-variant'
import { sampleColorFromCaptureElement } from '@/lib/books/eyedropper-sample'

interface UseEyedropperPickArgs {
  pageNumber: number
  spreadRightPage: number | null
  isWhiteboardOpen: boolean
  whiteboardPage: number
  leftPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  wbCaptureRootRef: MutableRefObject<HTMLDivElement | null>
  pickPenCustomColor: (hex: string) => void
  setAnnotationMode: (m: BookAnnotationInteractionMode) => void
  eyedropperVariant: EyedropperVariant
}

export function useEyedropperPick({
  pageNumber,
  spreadRightPage,
  isWhiteboardOpen,
  whiteboardPage,
  leftPageCaptureRef,
  rightPageCaptureRef,
  wbCaptureRootRef,
  pickPenCustomColor,
  setAnnotationMode,
  eyedropperVariant,
}: UseEyedropperPickArgs) {
  const inFlightRef = useRef(false)

  const onEyedropperPick = useCallback(
    async (targetPage: number, clientX: number, clientY: number) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        let captureEl: HTMLElement | null = null
        if (isWhiteboardOpen && targetPage === whiteboardPage) {
          captureEl = wbCaptureRootRef.current
        } else if (targetPage === pageNumber) {
          captureEl = leftPageCaptureRef.current
        } else if (spreadRightPage != null && targetPage === spreadRightPage) {
          captureEl = rightPageCaptureRef.current
        }
        if (!captureEl) return

        const sampled = await sampleColorFromCaptureElement(captureEl, clientX, clientY)
        if (!sampled) return

        pickPenCustomColor(inkFromEyedropperSample(sampled, eyedropperVariant))
        setAnnotationMode('pen')
      } finally {
        inFlightRef.current = false
      }
    },
    [
      isWhiteboardOpen,
      leftPageCaptureRef,
      pageNumber,
      eyedropperVariant,
      pickPenCustomColor,
      rightPageCaptureRef,
      setAnnotationMode,
      spreadRightPage,
      wbCaptureRootRef,
      whiteboardPage,
    ],
  )

  return onEyedropperPick
}
