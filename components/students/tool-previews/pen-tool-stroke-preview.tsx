'use client'

import { useLayoutEffect, useRef } from 'react'
import { drawStrokePath } from '@/lib/books/annotation-draw'
import type { AnnotationLineDashStyle } from '@/lib/books/annotation-command-types'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import type { PenSwatch } from '@/lib/books/annotation-palettes'
import { buildPenToolPreviewStrokeCommand } from '@/lib/books/pen-tool-preview-stroke'
import type { PenStrokeProfile } from '@/lib/books/pen-stroke-profile'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'

export function PenToolStrokePreview({
  penStrokeProfile,
  penThicknessStep,
  penLineDashStyle,
  penSwatch,
  penColorSource,
  penCustomHex,
}: {
  penStrokeProfile: PenStrokeProfile
  penThicknessStep: AnnotationStrokeThicknessStep
  penLineDashStyle: AnnotationLineDashStyle
  penSwatch: PenSwatch
  penColorSource: AnnotationColorSource
  penCustomHex: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    const cmd = buildPenToolPreviewStrokeCommand({
      penStrokeProfile,
      penThicknessStep,
      penLineDashStyle,
      penSwatch,
      penColorSource,
      penCustomHex,
    })
    drawStrokePath(ctx, cmd, cssW, cssH)
  }, [
    penStrokeProfile,
    penThicknessStep,
    penLineDashStyle,
    penSwatch,
    penColorSource,
    penCustomHex,
  ])

  return (
    <div ref={containerRef} className="h-20 w-full">
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
    </div>
  )
}
