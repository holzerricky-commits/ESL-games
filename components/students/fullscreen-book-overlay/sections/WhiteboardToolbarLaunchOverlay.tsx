'use client'

import type { CSSProperties } from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { panelFlightTransformToMatchButton } from '@/lib/books/whiteboard-toolbar-launch-flip'
import {
  WHITEBOARD_HEADER_CHROME,
  WHITEBOARD_PANEL_CHROME,
} from '../constants'

const FLIGHT_MS = 360
const FLIGHT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

export type WhiteboardToolbarFlight = {
  mode: 'enter' | 'exit'
  button: DOMRectReadOnly
  panel: DOMRectReadOnly
}

interface WhiteboardToolbarLaunchOverlayProps {
  flight: WhiteboardToolbarFlight
  surfaceStyle: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'>
  onComplete: () => void
}

export function WhiteboardToolbarLaunchOverlay({
  flight,
  surfaceStyle,
  onComplete,
}: WhiteboardToolbarLaunchOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const foldedTransform = useMemo(
    () => panelFlightTransformToMatchButton(flight.button, flight.panel),
    [flight.button, flight.panel],
  )
  const [transform, setTransform] = useState(
    flight.mode === 'enter' ? foldedTransform : 'none',
  )
  const [transitionOn, setTransitionOn] = useState(false)

  useLayoutEffect(() => {
    setTransitionOn(false)
    if (flight.mode === 'enter') {
      setTransform(foldedTransform)
    } else {
      setTransform('none')
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionOn(true)
        setTransform(flight.mode === 'enter' ? 'none' : foldedTransform)
      })
    })

    return () => cancelAnimationFrame(raf)
  }, [flight, foldedTransform])

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return

    let done = false
    const finish = () => {
      if (done) return
      done = true
      onComplete()
    }

    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== 'transform') return
      finish()
    }

    const fallback = window.setTimeout(finish, FLIGHT_MS + 50)
    el.addEventListener('transitionend', onEnd)
    return () => {
      clearTimeout(fallback)
      el.removeEventListener('transitionend', onEnd)
    }
  }, [flight, onComplete])

  return createPortal(
    <div
      className="pointer-events-none fixed z-[200]"
      style={{
        left: flight.panel.left,
        top: flight.panel.top,
        width: flight.panel.width,
        height: flight.panel.height,
      }}
      aria-hidden
    >
      <div
        ref={panelRef}
        className={cn(
          'flex h-full w-full flex-col overflow-hidden',
          WHITEBOARD_PANEL_CHROME,
        )}
        style={{
          transform,
          transformOrigin: 'center center',
          transition: transitionOn ? `transform ${FLIGHT_MS}ms ${FLIGHT_EASE}` : 'none',
        }}
      >
        <header
          className={cn(
            'relative z-20 flex h-9 shrink-0 items-center px-2.5',
            WHITEBOARD_HEADER_CHROME,
          )}
        />
        <div className="min-h-0 flex-1" style={surfaceStyle} />
      </div>
    </div>,
    document.body,
  )
}
