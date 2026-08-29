'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FilledTextPillLayer } from '@/components/students/filled-text-pill-layer'
import type { TextAnnotationAlign, TextAnnotationVisualStyle } from '@/lib/books/annotation-command-types'
import type { AnnotationTextFontId, AnnotationTextFontWeight } from '@/lib/books/annotation-text-fonts'
import { computeFilledPillLayout } from '@/lib/books/filled-text-layout'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { filledTextPillStackPaddingCSS } from '@/lib/books/text-label-layout'
import {
  buildTextToolPreviewMirrorStyle,
  buildTextToolPreviewTypography,
} from '@/lib/books/text-tool-preview-style'
import { cn } from '@/lib/utils'

function previewAlignClass(textAlign: TextAnnotationAlign): string {
  switch (textAlign) {
    case 'center':
      return 'justify-center'
    case 'right':
      return 'justify-end'
    default:
      return 'justify-start'
  }
}

export function TextToolPreview({
  textFontId,
  textFontWeight = 'regular',
  textVisualStyle,
  textAlign,
  textThicknessStep,
  textColor,
  textFillColor,
  pageHeightPx,
}: {
  textFontId: AnnotationTextFontId
  textFontWeight?: AnnotationTextFontWeight
  textVisualStyle: TextAnnotationVisualStyle
  textAlign: TextAnnotationAlign
  textThicknessStep: AnnotationStrokeThicknessStep
  textColor: string
  textFillColor: string
  pageHeightPx?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const typography = useMemo(
    () =>
      buildTextToolPreviewTypography({
        textFontId,
        textFontWeight,
        textVisualStyle,
        textAlign,
        textThicknessStep,
        textColor,
        textFillColor,
        pageHeightPx,
      }),
    [textFontId, textFontWeight, textVisualStyle, textAlign, textThicknessStep, textColor, textFillColor, pageHeightPx],
  )
  const mirrorStyle = useMemo(
    () => buildTextToolPreviewMirrorStyle(typography),
    [typography],
  )

  const [filledLayout, setFilledLayout] = useState<{
    segments: string[]
    widths: number[]
    fieldWidthPx: number
  } | null>(null)

  useLayoutEffect(() => {
    if (typography.variant !== 'filled') {
      setFilledLayout(null)
      return
    }
    const overlayWidthPx = containerRef.current?.clientWidth ?? 280
    const layout = computeFilledPillLayout(
      typography.sampleText,
      typography.fontFamily,
      typography.fontSizePx,
      0.05,
      overlayWidthPx,
      undefined,
      { fontWeight: typography.fontWeight },
    )
    setFilledLayout({
      segments: [...layout.segments],
      widths: [...layout.widths],
      fieldWidthPx: layout.fieldWidthPx,
    })
  }, [
    typography.variant,
    typography.sampleText,
    typography.fontFamily,
    typography.fontWeight,
    typography.fontSizePx,
    textAlign,
  ])

  const alignClass = previewAlignClass(typography.textAlign)
  const previewHeightPx = Math.max(72, typography.contentMinHeightPx)

  if (typography.variant === 'filled') {
    const fieldWidthPx = filledLayout?.fieldWidthPx ?? 120
    return (
      <div
        ref={containerRef}
        className={cn('flex w-full items-center overflow-hidden px-2', alignClass)}
        style={{ minHeight: previewHeightPx }}
      >
        <div
          className="relative inline-block max-w-full"
          style={{ width: fieldWidthPx }}
        >
          {filledLayout ? (
            <div
              className="pointer-events-none absolute inset-0 box-border"
              style={filledTextPillStackPaddingCSS()}
              aria-hidden
            >
              <FilledTextPillLayer
                segments={filledLayout.segments}
                widths={filledLayout.widths}
                fillHex={typography.fillColor}
                rowMinPx={typography.rowMinPx}
                textAlign={typography.textAlign}
              />
            </div>
          ) : null}
          <div style={{ ...mirrorStyle, position: 'relative', zIndex: 1 }} aria-hidden>
            {typography.sampleText}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex w-full items-center overflow-hidden px-2', alignClass)}
      style={{ minHeight: previewHeightPx }}
    >
      <div style={mirrorStyle} aria-hidden>
        {typography.sampleText}
      </div>
    </div>
  )
}
