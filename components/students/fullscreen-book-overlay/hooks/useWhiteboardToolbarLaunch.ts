import type { CSSProperties, RefObject } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { WhiteboardToolbarFlight } from '../sections/WhiteboardToolbarLaunchOverlay'

export type WhiteboardToolbarLaunchApi = {
  playEnter: (openBoard: () => void) => void
  playExit: (closeBoard: () => void) => void
}

interface UseWhiteboardToolbarLaunchArgs {
  surfaceStyle: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'>
}

function measureFlight(
  buttonRef: RefObject<HTMLButtonElement | null>,
  panelAnchorRef: RefObject<HTMLDivElement | null>,
): { button: DOMRect; panel: DOMRect } | null {
  const button = buttonRef.current?.getBoundingClientRect()
  const panel = panelAnchorRef.current?.getBoundingClientRect()
  if (!button || !panel || panel.width < 8 || panel.height < 8) return null
  return { button, panel }
}

export function useWhiteboardToolbarLaunch({ surfaceStyle }: UseWhiteboardToolbarLaunchArgs) {
  const toolbarButtonRef = useRef<HTMLButtonElement | null>(null)
  const panelAnchorRef = useRef<HTMLDivElement | null>(null)
  const [flight, setFlight] = useState<WhiteboardToolbarFlight | null>(null)
  const [panelObscured, setPanelObscured] = useState(false)
  const [enterMeasureGen, setEnterMeasureGen] = useState(0)
  const pendingExitRef = useRef<(() => void) | null>(null)

  const clearFlight = useCallback(() => {
    setFlight(null)
    setPanelObscured(false)
    pendingExitRef.current = null
  }, [])

  const playEnter = useCallback((openBoard: () => void) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      openBoard()
      return
    }
    setPanelObscured(true)
    openBoard()
    setEnterMeasureGen((n) => n + 1)
  }, [])

  useLayoutEffect(() => {
    if (enterMeasureGen === 0) return

    const rects = measureFlight(toolbarButtonRef, panelAnchorRef)
    if (!rects) {
      setPanelObscured(false)
      return
    }
    setFlight({ mode: 'enter', ...rects })
  }, [enterMeasureGen])

  const playExit = useCallback(
    (closeBoard: () => void) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        closeBoard()
        return
      }
      const rects = measureFlight(toolbarButtonRef, panelAnchorRef)
      if (!rects) {
        closeBoard()
        return
      }
      pendingExitRef.current = closeBoard
      setPanelObscured(true)
      setFlight({ mode: 'exit', ...rects })
    },
    [],
  )

  const onFlightComplete = useCallback(() => {
    const mode = flight?.mode
    const finish = () => {
      if (mode === 'exit' && pendingExitRef.current) {
        pendingExitRef.current()
        pendingExitRef.current = null
      }
      clearFlight()
    }
    // Let the real panel layout ink once before we hide the flight clone (enter only).
    if (mode === 'enter') {
      requestAnimationFrame(() => requestAnimationFrame(finish))
      return
    }
    finish()
  }, [clearFlight, flight?.mode])

  return {
    toolbarButtonRef,
    panelAnchorRef,
    flight,
    panelObscured,
    playEnter,
    playExit,
    onFlightComplete,
  }
}
