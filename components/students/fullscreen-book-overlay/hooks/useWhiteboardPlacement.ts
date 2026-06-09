import { useCallback, useEffect, useRef, useState } from 'react'

import type { LessonBoardFloatRect } from '@/lib/books/lesson-board-float-layout'

import { defaultLessonBoardFloatRect } from '@/lib/books/lesson-board-float-layout'

import type { WhiteboardSlotMotionApi } from './useWhiteboardSlotMotion'



/** Lesson board docks in a spread slot or floats above the book. */

export type WhiteboardLayoutMode = 'slot' | 'floating'

export type WhiteboardSlotSide = 'left' | 'right'



interface WhiteboardPlacementPrefs {

  slotSide: WhiteboardSlotSide

  layoutMode?: WhiteboardLayoutMode

  floatRect?: LessonBoardFloatRect

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

    const parsed = JSON.parse(raw) as WhiteboardPlacementPrefs & {

      layoutMode?: unknown

      floatRect?: Partial<LessonBoardFloatRect>

    }

    if (parsed.slotSide !== 'left' && parsed.slotSide !== 'right') return null

    const floatRect =
      parsed.floatRect &&
      Number.isFinite(parsed.floatRect.leftPx) &&
      Number.isFinite(parsed.floatRect.topPx) &&
      Number.isFinite(parsed.floatRect.scale)
        ? {
            leftPx: parsed.floatRect.leftPx!,
            topPx: parsed.floatRect.topPx!,
            scale: parsed.floatRect.scale!,
          }
        : undefined
    const layoutMode: WhiteboardLayoutMode =
      parsed.layoutMode === 'floating' && floatRect ? 'floating' : 'slot'
    return { slotSide: parsed.slotSide, layoutMode, floatRect }

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

  const [slotSide, setSlotSide] = useState<WhiteboardSlotSide>('right')

  const [layoutMode, setLayoutMode] = useState<WhiteboardLayoutMode>('slot')

  const [floatRect, setFloatRect] = useState<LessonBoardFloatRect | null>(null)

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

      setSlotSide(saved.slotSide)

      setLayoutMode(saved.layoutMode ?? 'slot')

      setFloatRect(saved.floatRect ?? null)

    } else {

      setSlotSide(defaultWhiteboardSlotSide(annotationTargetPage, pageNumber, spreadRightPage))

      setLayoutMode('slot')

      setFloatRect(null)

    }

  }, [studentId, selectedBookId, selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps -- load once per book/unit



  const persistPrefs = useCallback(

    (prefs: WhiteboardPlacementPrefs) => {

      const key = prefsKeyRef.current

      if (!key) return

      writePlacementPrefs(key, prefs)

    },

    [],

  )



  const persistSlotSide = useCallback(

    (side: WhiteboardSlotSide) => {

      persistPrefs({

        slotSide: side,

        layoutMode,

        floatRect: floatRect ?? undefined,

      })

    },

    [floatRect, layoutMode, persistPrefs],

  )



  const applyWhiteboardSlotSide = useCallback(

    (side: WhiteboardSlotSide) => {

      setSlotSide(side)

      persistSlotSide(side)

    },

    [persistSlotSide],

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



  const swapWhiteboardSlotSide = useCallback(() => {

    setWhiteboardSlotSide(oppositeWhiteboardSlotSide(slotSide))

  }, [slotSide, setWhiteboardSlotSide])



  const commitFloatRect = useCallback(

    (rect: LessonBoardFloatRect) => {

      setFloatRect(rect)

      persistPrefs({ slotSide, layoutMode: 'floating', floatRect: rect })

    },

    [persistPrefs, slotSide],

  )



  const floatWhiteboard = useCallback(

    (slotLeftPx: number, slotTopPx: number) => {

      const rect = floatRect ?? defaultLessonBoardFloatRect(slotLeftPx, slotTopPx)

      setLayoutMode('floating')

      setFloatRect(rect)

      persistPrefs({ slotSide, layoutMode: 'floating', floatRect: rect })

    },

    [floatRect, persistPrefs, slotSide],

  )



  const dockWhiteboardToSlot = useCallback(() => {

    setLayoutMode('slot')

    persistPrefs({ slotSide, layoutMode: 'slot', floatRect: floatRect ?? undefined })

  }, [floatRect, persistPrefs, slotSide])



  /** Wide pages use spread overlay — floating is not supported. */

  const forceDockWhiteboard = useCallback(() => {

    if (layoutMode === 'slot') return

    setLayoutMode('slot')

    persistPrefs({ slotSide, layoutMode: 'slot', floatRect: floatRect ?? undefined })

  }, [floatRect, layoutMode, persistPrefs, slotSide])



  const openWhiteboardWithDefaultPlacement = useCallback(() => {

    const side = defaultWhiteboardSlotSide(annotationTargetPage, pageNumber, spreadRightPage)

    setSlotSide(side)

    setLayoutMode('slot')

    const key = prefsKeyRef.current

    if (key) writePlacementPrefs(key, { slotSide: side, layoutMode: 'slot' })

  }, [annotationTargetPage, pageNumber, spreadRightPage])



  const resetPlacementForUnitChange = useCallback(() => {

    const side = defaultWhiteboardSlotSide(annotationTargetPage, pageNumber, spreadRightPage)

    setSlotSide(side)

  }, [annotationTargetPage, pageNumber, spreadRightPage])



  return {

    whiteboardSlotSide: slotSide,

    whiteboardLayoutMode: layoutMode,

    whiteboardFloatRect: floatRect,

    setWhiteboardSlotSide,

    applyWhiteboardSlotSide,

    registerWhiteboardSlotMotion,

    swapWhiteboardSlotSide,

    floatWhiteboard,

    dockWhiteboardToSlot,

    forceDockWhiteboard,

    commitWhiteboardFloatRect: commitFloatRect,

    openWhiteboardWithDefaultPlacement,

    resetPlacementForUnitChange,

  }

}


