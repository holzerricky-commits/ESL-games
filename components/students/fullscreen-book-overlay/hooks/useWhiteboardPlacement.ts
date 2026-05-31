import { useCallback, useEffect, useRef, useState } from 'react'
import type { WhiteboardSlotMotionApi } from './useWhiteboardSlotMotion'

export type WhiteboardLayoutMode = 'slot' | 'fullscreen'
export type WhiteboardSlotSide = 'left' | 'right'

interface WhiteboardPlacementPrefs {
  layoutMode: WhiteboardLayoutMode
  slotSide: WhiteboardSlotSide
}

interface UseWhiteboardPlacementArgs {
  studentId: string
  selectedBookId: string | null
  selectedUnitId: string | null
  pageNumber: number
  spreadRightPage: number | null
  annotationTargetPage: number
}

function placementStorageKey(studentId: string, bookId: string, unitId: string): string {
  return `wb-placement:${studentId}:${bookId}:${unitId}`
}

function readPlacementPrefs(key: string): WhiteboardPlacementPrefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WhiteboardPlacementPrefs
    if (parsed.layoutMode !== 'slot' && parsed.layoutMode !== 'fullscreen') return null
    if (parsed.slotSide !== 'left' && parsed.slotSide !== 'right') return null
    return parsed
  } catch {
    return null
  }
}

function writePlacementPrefs(key: string, prefs: WhiteboardPlacementPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify(prefs))
  } catch {
    /* ignore quota */
  }
}

export function oppositeWhiteboardSlotSide(side: WhiteboardSlotSide): WhiteboardSlotSide {
  return side === 'left' ? 'right' : 'left'
}

/** Board on the side opposite the active annotation / reader focus. */
export function defaultWhiteboardSlotSide(
  annotationTargetPage: number,
  pageNumber: number,
  spreadRightPage: number | null,
): WhiteboardSlotSide {
  if (spreadRightPage != null && annotationTargetPage === spreadRightPage) return 'left'
  return 'right'
}

export function useWhiteboardPlacement({
  studentId,
  selectedBookId,
  selectedUnitId,
  pageNumber,
  spreadRightPage,
  annotationTargetPage,
}: UseWhiteboardPlacementArgs) {
  const [layoutMode, setLayoutMode] = useState<WhiteboardLayoutMode>('slot')
  const [slotSide, setSlotSide] = useState<WhiteboardSlotSide>('right')
  const prefsKeyRef = useRef<string | null>(null)
  const slotMotionApiRef = useRef<WhiteboardSlotMotionApi | null>(null)

  useEffect(() => {
    if (!selectedBookId || !selectedUnitId) {
      prefsKeyRef.current = null
      return
    }
    const key = placementStorageKey(studentId, selectedBookId, selectedUnitId)
    prefsKeyRef.current = key
    const saved = readPlacementPrefs(key)
    if (saved) {
      setLayoutMode(saved.layoutMode)
      setSlotSide(saved.slotSide)
    } else {
      setLayoutMode('slot')
      setSlotSide(defaultWhiteboardSlotSide(annotationTargetPage, pageNumber, spreadRightPage))
    }
  }, [studentId, selectedBookId, selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps -- load once per book/unit

  const persistPrefs = useCallback(
    (next: WhiteboardPlacementPrefs) => {
      const key = prefsKeyRef.current
      if (!key) return
      writePlacementPrefs(key, next)
    },
    [],
  )

  const setWhiteboardLayoutMode = useCallback((mode: WhiteboardLayoutMode) => {
    setLayoutMode(mode)
    setSlotSide((side) => {
      persistPrefs({ layoutMode: mode, slotSide: side })
      return side
    })
  }, [persistPrefs])

  const applyWhiteboardSlotSide = useCallback(
    (side: WhiteboardSlotSide) => {
      setSlotSide(side)
      setLayoutMode((mode) => {
        persistPrefs({ layoutMode: mode, slotSide: side })
        return mode
      })
    },
    [persistPrefs],
  )

  const registerWhiteboardSlotMotion = useCallback((api: WhiteboardSlotMotionApi | null) => {
    slotMotionApiRef.current = api
  }, [])

  const setWhiteboardSlotSide = useCallback(
    (side: WhiteboardSlotSide) => {
      if (slotMotionApiRef.current) {
        slotMotionApiRef.current.moveTo(side)
        return
      }
      applyWhiteboardSlotSide(side)
    },
    [applyWhiteboardSlotSide],
  )

  const toggleWhiteboardFullscreen = useCallback(() => {
    setWhiteboardLayoutMode(layoutMode === 'fullscreen' ? 'slot' : 'fullscreen')
  }, [layoutMode, setWhiteboardLayoutMode])

  const swapWhiteboardSlotSide = useCallback(() => {
    setWhiteboardSlotSide(oppositeWhiteboardSlotSide(slotSide))
  }, [slotSide, setWhiteboardSlotSide])

  const openWhiteboardWithDefaultPlacement = useCallback(() => {
    const side = defaultWhiteboardSlotSide(annotationTargetPage, pageNumber, spreadRightPage)
    setSlotSide(side)
    setLayoutMode('slot')
    const key = prefsKeyRef.current
    if (key) writePlacementPrefs(key, { layoutMode: 'slot', slotSide: side })
  }, [annotationTargetPage, pageNumber, spreadRightPage])

  const resetPlacementForUnitChange = useCallback(() => {
    const side = defaultWhiteboardSlotSide(annotationTargetPage, pageNumber, spreadRightPage)
    setSlotSide(side)
    setLayoutMode('slot')
  }, [annotationTargetPage, pageNumber, spreadRightPage])

  return {
    whiteboardLayoutMode: layoutMode,
    whiteboardSlotSide: slotSide,
    setWhiteboardLayoutMode,
    setWhiteboardSlotSide,
    applyWhiteboardSlotSide,
    registerWhiteboardSlotMotion,
    swapWhiteboardSlotSide,
    toggleWhiteboardFullscreen,
    openWhiteboardWithDefaultPlacement,
    resetPlacementForUnitChange,
  }
}
