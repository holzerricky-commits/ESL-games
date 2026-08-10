import { useEffect } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'

interface UseFullscreenOverlayPanelsArgs {
  open: boolean
  /** When false while `open`, keep exit opacity until reader shell can show real content (B2). */
  presentationReady: boolean
  /** When false while `open`, do not fade the overlay in yet (map defers visible open until first paint). */
  userPresented: boolean
  setIsMounted: (v: boolean) => void
  setIsVisible: (v: boolean) => void
  setIsPageListOpen: (v: boolean) => void
  setIsWhiteboardOpen: (v: boolean) => void
  isWhiteboardOpen: boolean
  isPageListOpen: boolean
  pageNumber: number
  numPages: number | null
  library: BookLibraryPayload | null
  selectedBookId: string | null
  selectedUnitId: string | null
}

export function useFullscreenOverlayPanels({
  open,
  presentationReady: _presentationReady,
  userPresented,
  setIsMounted,
  setIsVisible,
  setIsPageListOpen,
  setIsWhiteboardOpen,
  isWhiteboardOpen,
  isPageListOpen,
  pageNumber,
  numPages,
  library,
  selectedBookId,
  selectedUnitId,
}: UseFullscreenOverlayPanelsArgs) {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    if (open) {
      setIsMounted(true)
      if (userPresented) {
        // Map click-to-open: reveal shell immediately; spreadDrawableReady gates pixels.
        timeoutId = setTimeout(() => setIsVisible(true), 16)
      } else {
        setIsVisible(false)
      }
    } else {
      setIsVisible(false)
      // B1: keep `isMounted` true after the first open so reader DOM + cached PDF stay warm (no delayed unmount).
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [open, userPresented, setIsMounted, setIsVisible])

  useEffect(() => {
    if (!open) {
      setIsPageListOpen(false)
      setIsWhiteboardOpen(false)
    }
  }, [open, setIsPageListOpen, setIsWhiteboardOpen])
}
