'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { buildMarkerToolPreviewBarHeightPx } from '@/lib/books/marker-tool-preview-style'

export function MarkerToolPreview({
  markerColor,
  markerThicknessStep,
}: {
  markerColor: string
  markerThicknessStep: AnnotationStrokeThicknessStep
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barHeightPx = useMemo(
    () => buildMarkerToolPreviewBarHeightPx(markerThicknessStep),
    [markerThicknessStep],
  )

  useLayoutEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const cssW = container.clientWidth
    const cssH = container.clientHeight
    if (cssW <= 0 || cssH <= 0) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const barW = cssW * 0.72
    const barH = Math.min(barHeightPx, cssH * 0.55)
    const x = (cssW - barW) / 2
    const y = (cssH - barH) / 2
    const r = barH / 2

    ctx.save()
    ctx.globalAlpha = 0.88
    ctx.fillStyle = markerColor
    ctx.beginPath()
    ctx.roundRect(x, y, barW, barH, r)
    ctx.fill()
    ctx.restore()
  }, [barHeightPx, markerColor])

  return (
    <div ref={containerRef} className="flex h-20 w-full items-center justify-center">
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
    </div>
  )
}
