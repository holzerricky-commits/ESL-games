'use client'

import { useLayoutEffect, useRef } from 'react'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'

function scheduleAfterNextPaint(callback: () => void): () => void {
  let cancelled = false
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!cancelled) callback()
    })
  })
  return () => {
    cancelled = true
  }
}

export interface CachedPageCanvasProps {
  bitmap: ImageBitmap
  cssWidth: number
  cssHeight: number
  /** Optional clip from the left (spread right slot seam). */
  clipLeftPx?: number
  onPainted?: () => void
  /** Fired when the cached bitmap is no longer drawable (evicted / detached). */
  onPaintFailed?: () => void
}

/**
 * Phase 1 — paints a cached page bitmap at CSS size on the first layout frame.
 * This is the primary display surface when the PageRenderCache hits.
 */
function paintBitmapToCanvas(canvas: HTMLCanvasElement, bitmap: ImageBitmap): boolean {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return false
  try {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    ctx.drawImage(bitmap, 0, 0)
    return true
  } catch {
    return false
  }
}

export function CachedPageCanvas({
  bitmap,
  cssWidth,
  cssHeight,
  clipLeftPx = 0,
  onPainted,
  onPaintFailed,
}: CachedPageCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const onPaintedRef = useRef(onPainted)
  const onPaintFailedRef = useRef(onPaintFailed)
  onPaintedRef.current = onPainted
  onPaintFailedRef.current = onPaintFailed
  const zoomRepaintRevision = useBrowserZoomRepaintRevision()

  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (!paintBitmapToCanvas(canvas, bitmap)) {
      onPaintFailedRef.current?.()
      return
    }
    if (!onPaintedRef.current) return
    return scheduleAfterNextPaint(() => onPaintedRef.current?.())
  }, [bitmap, zoomRepaintRevision])

  const clipLeft = clipLeftPx > 0 ? Math.round(clipLeftPx) : 0
  const clipStyle = clipLeft > 0 ? ({ clipPath: `inset(0 0 0 ${clipLeft}px)` } as const) : undefined

  return (
    <canvas
      ref={ref}
      width={bitmap.width}
      height={bitmap.height}
      aria-hidden
      className="pointer-events-none block max-w-full select-none bg-[#FDFCFB]"
      style={{ width: cssWidth, height: cssHeight, ...clipStyle }}
    />
  )
}
