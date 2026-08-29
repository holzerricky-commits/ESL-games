'use client'

import { useEffect, useState, type PointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  TRANSLATION_CHIP_CURSOR_NUDGE_X_PX,
  TRANSLATION_CHIP_PREVIEW_CLASS,
} from '@/lib/translate/place-translation-chip'

export type PlaceFromTranslateSurface = 'book' | 'whiteboard'

type PlaceTranslationOverlayProps = {
  /** Word being placed; null when placing a picture instead. */
  text: string | null
  /** Picture being placed; rides the cursor like the Chinese chip. */
  imageUrl?: string | null
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  onCancel: () => void
  /** Tap landed on a book page or the visible lesson board. */
  onPlace: (clientX: number, clientY: number, surface: PlaceFromTranslateSurface) => void
}

function insideRect(el: Element | null, x: number, y: number): boolean {
  if (!el) return false
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/** Hit-test the visible board canvas, not the tall scrolled content box. */
function insideVisibleWhiteboard(x: number, y: number): boolean {
  const content = document.querySelector('[data-whiteboard-content]')
  if (!(content instanceof HTMLElement)) return false
  const clip = content.parentElement?.getBoundingClientRect()
  const rect = content.getBoundingClientRect()
  const left = Math.max(rect.left, clip?.left ?? rect.left)
  const right = Math.min(rect.right, clip?.right ?? rect.right)
  const top = Math.max(rect.top, clip?.top ?? rect.top)
  const bottom = Math.min(rect.bottom, clip?.bottom ?? rect.bottom)
  if (right <= left || bottom <= top) return false
  return x >= left && x <= right && y >= top && y <= bottom
}

/** Full-screen click catcher: the picked word or picture rides the cursor; tap to drop. */
export function PlaceTranslationOverlay({
  text,
  imageUrl,
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

  const placingImage = Boolean(imageUrl)
  const active = mounted && (placingImage || (text != null && text.length > 0))

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
    if (insideVisibleWhiteboard(e.clientX, e.clientY)) {
      onPlace(e.clientX, e.clientY, 'whiteboard')
      return
    }
    const onPage =
      insideRect(leftPageCaptureRef.current, e.clientX, e.clientY) ||
      insideRect(rightPageCaptureRef.current, e.clientX, e.clientY)
    if (onPage) {
      onPlace(e.clientX, e.clientY, 'book')
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
        placingImage ? (
          <div
            className="pointer-events-none absolute"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden
          >
            <img
              src={imageUrl ?? ''}
              alt=""
              className="max-h-36 max-w-[11rem] rounded-md object-contain shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
              draggable={false}
            />
          </div>
        ) : (
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
        )
      ) : null}
    </div>,
    document.body,
  )
}
