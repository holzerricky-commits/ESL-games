'use client'

import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { panelFlightTransformToMatchButton } from '@/lib/books/whiteboard-toolbar-launch-flip'
import { WHITEBOARD_PANEL_CHROME } from '../constants'

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
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const foldedTransform = panelFlightTransformToMatchButton(flight.button, flight.panel)
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
    const el = nodeRef.current
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
      ref={nodeRef}
      className={cn('pointer-events-none fixed z-[200]', WHITEBOARD_PANEL_CHROME)}
      style={{
        left: flight.panel.left,
        top: flight.panel.top,
        width: flight.panel.width,
        height: flight.panel.height,
        transform,
        transformOrigin: 'center center',
        transition: transitionOn ? `transform ${FLIGHT_MS}ms ${FLIGHT_EASE}` : 'none',
        ...surfaceStyle,
      }}
      aria-hidden
    />,
    document.body,
  )
}
