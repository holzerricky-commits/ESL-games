'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import type { PenSwatch } from '@/lib/books/annotation-palettes'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import {
  buildShapeToolPreviewDraft,
  buildShapeToolPreviewOptions,
  type ShapeToolPreviewKind,
} from '@/lib/books/shape-tool-preview-style'
import { drawTwoPointShapePreview } from '@/lib/books/two-point-shape-preview'

export function ShapeToolPreview({
  shapeKind,
  shapeStrokeSwatch,
  shapeThicknessStep,
  shapeLineDashStyle,
  shapeStrokeEnabled,
  shapeFillMode,
  shapeFillColor,
  shapeRoundedCorners = true,
}: {
  shapeKind: ShapeToolPreviewKind
  shapeStrokeSwatch: PenSwatch
  shapeThicknessStep: AnnotationStrokeThicknessStep
  shapeLineDashStyle: AnnotationLineDashStyle
  shapeStrokeEnabled: boolean
  shapeFillMode: ShapeFillMode
  shapeFillColor: string
  shapeRoundedCorners?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draft = useMemo(() => buildShapeToolPreviewDraft(shapeKind), [shapeKind])
  const opts = useMemo(
    () =>
      buildShapeToolPreviewOptions({
        shapeKind,
        shapeStrokeSwatch,
        shapeThicknessStep,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
        shapeRoundedCorners,
      }),
    [
      shapeKind,
      shapeStrokeSwatch,
      shapeThicknessStep,
      shapeLineDashStyle,
      shapeStrokeEnabled,
      shapeFillMode,
      shapeFillColor,
      shapeRoundedCorners,
    ],
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
    drawTwoPointShapePreview(ctx, draft, cssW, cssH, opts)
  }, [draft, opts])

  return (
    <div ref={containerRef} className="h-20 w-full">
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
    </div>
  )
}
