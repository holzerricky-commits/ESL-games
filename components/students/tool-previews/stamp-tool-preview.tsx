'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { drawStampSymbol } from '@/lib/books/annotation-draw'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import { buildStampPreviewDrawParams } from '@/lib/books/stamp-tool-preview-style'

export function StampToolPreview({
  stampVariant,
  stampQuestionColor,
  stampScale,
  pageHeightPx,
}: {
  stampVariant: StampVariant
  stampQuestionColor: string
  stampScale: number
  pageHeightPx?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawParams = useMemo(
    () =>
      buildStampPreviewDrawParams({
        stampVariant,
        stampQuestionColor,
        stampScale,
        pageHeightPx,
      }),
    [stampVariant, stampQuestionColor, stampScale, pageHeightPx],
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
    drawStampSymbol(ctx, drawParams.variant, cssW / 2, cssH / 2, drawParams.radiusPx, drawParams.color)
  }, [drawParams])

  return (
    <div ref={containerRef} className="flex h-20 w-full items-center justify-center">
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
    </div>
  )
}
