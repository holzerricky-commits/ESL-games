'use client'

import { useEffect, useState, type PointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  TRANSLATION_CHIP_CURSOR_NUDGE_X_PX,
  TRANSLATION_CHIP_PREVIEW_CLASS,
} from '@/lib/translate/place-translation-chip'

type PlaceTranslationOverlayProps = {
  /** Word being placed; null hides the overlay. */
  text: string | null
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  onCancel: () => void
  /** Called with the tap point when it lands on a book page. */
  onPlace: (clientX: number, clientY: number) => void
}

function insideRect(el: HTMLDivElement | null, x: number, y: number): boolean {
  if (!el) return false
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/** Full-screen click catcher: the picked word rides the cursor; tap a book page to drop it. */
export function PlaceTranslationOverlay({
  text,
  leftPageCaptureRef,
  rightPageCaptureRef,
  onCancel,
  onPlace,
}: PlaceTranslationOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const active = mounted && text != null && text.length > 0

  useEffect(() => {
    if (!active) {
      setCursor(null)
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
    const onPointerMove = (e: globalThis.PointerEvent) => {
      setCursor({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('pointermove', onPointerMove, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
    }
  }, [active, onCancel])

  if (!active) return null

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const onPage =
      insideRect(leftPageCaptureRef.current, e.clientX, e.clientY) ||
      insideRect(rightPageCaptureRef.current, e.clientX, e.clientY)
    if (onPage) {
      onPlace(e.clientX, e.clientY)
    } else {
      onCancel()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[85] cursor-crosshair touch-none"
      role="presentation"
      onPointerDown={onPointerDown}
    >
      {cursor ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: cursor.x + TRANSLATION_CHIP_CURSOR_NUDGE_X_PX,
            top: cursor.y,
            transform: 'translateY(-50%)',
          }}
          aria-hidden
        >
          <span className={TRANSLATION_CHIP_PREVIEW_CLASS}>{text}</span>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
