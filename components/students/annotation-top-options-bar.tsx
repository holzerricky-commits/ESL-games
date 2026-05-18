'use client'

import { ANNOTATION_MARKER_SWATCHES } from '@/lib/books/annotation-palettes'
import { isBookOverlayShapeMode } from '@/lib/books/book-overlay-keyboard-shortcuts'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import {
  ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS,
  ThicknessSliderRow,
} from '@/components/students/annotation-thickness-slider-row'
import { ColorSwatchRow, PenSwatchRow } from '@/components/students/annotation-swatch-picker'
import { cn } from '@/lib/utils'

export interface AnnotationTopOptionsBarProps {
  hasResolvedUnit: boolean
  suppressChrome: boolean
  chromePanelsOpen: boolean
  annotationMode: BookAnnotationInteractionMode
  penSwatchId: string
  pickPenSwatch: (id: string) => void
  penColorSource: AnnotationColorSource
  penThicknessStep: AnnotationStrokeThicknessStep
  setPenThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  markerColor: string
  pickMarkerSwatchColor: (hex: string) => void
  shapeStrokeSwatchId: string
  setShapeStrokeSwatchId: (id: string) => void
  markerThicknessStep: AnnotationStrokeThicknessStep
  setMarkerThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserPixelThicknessStep: AnnotationStrokeThicknessStep
  setEraserPixelThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserLineThicknessStep: AnnotationStrokeThicknessStep
  setEraserLineThicknessStep: (s: AnnotationStrokeThicknessStep) => void
}

const TOP_OPTIONS_SURFACE =
  'rounded-xl border border-white/10 bg-black/24 text-white/65 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px]'

const barSectionClass =
  '[&_.space-y-2]:space-y-1 [&_p]:text-[0.55rem] [&_p]:leading-tight [&_p]:whitespace-nowrap'

export function AnnotationTopOptionsBar({
  hasResolvedUnit,
  suppressChrome,
  chromePanelsOpen,
  annotationMode,
  penSwatchId,
  pickPenSwatch,
  penColorSource,
  penThicknessStep,
  setPenThicknessStep,
  markerColor,
  pickMarkerSwatchColor,
  shapeStrokeSwatchId,
  setShapeStrokeSwatchId,
  markerThicknessStep,
  setMarkerThicknessStep,
  eraserPixelThicknessStep,
  setEraserPixelThicknessStep,
  eraserLineThicknessStep,
  setEraserLineThicknessStep,
}: AnnotationTopOptionsBarProps) {
  const isPen = annotationMode === 'pen'
  const isMarker = annotationMode === 'marker'
  const isShape = isBookOverlayShapeMode(annotationMode)
  const isEraser = annotationMode === 'eraser' || annotationMode === 'eraser-line'

  if (!hasResolvedUnit || suppressChrome || chromePanelsOpen) {
    return null
  }

  if (!isPen && !isMarker && !isShape && !isEraser) {
    return null
  }

  return (
    <div className="pointer-events-none absolute left-14 right-14 top-12 z-[55] flex justify-center">
      <div
        className={cn(
          TOP_OPTIONS_SURFACE,
          barSectionClass,
          'pointer-events-auto flex max-w-full flex-row flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2',
        )}
        role="region"
        aria-label="Tool properties"
      >
        {isPen ? (
          <>
            <div className="shrink-0">
              <PenSwatchRow
                swatchId={penSwatchId}
                onPick={pickPenSwatch}
                idPrefix="top-pen"
                label="Ink"
                colorSource={penColorSource}
              />
            </div>
            <div className="min-w-[9rem] max-w-[14rem] flex-1">
              <ThicknessSliderRow
                value={penThicknessStep}
                onChange={setPenThicknessStep}
                idPrefix="top-pen"
                ariaLabel="Pen thickness"
              />
            </div>
          </>
        ) : null}

        {isMarker ? (
          <>
            <div className="shrink-0">
              <ColorSwatchRow
                colors={ANNOTATION_MARKER_SWATCHES}
                current={markerColor}
                onPick={pickMarkerSwatchColor}
                idPrefix="top-marker"
                label="Color"
              />
            </div>
            <div className="min-w-[9rem] max-w-[14rem] flex-1">
              <ThicknessSliderRow
                value={markerThicknessStep}
                onChange={setMarkerThicknessStep}
                idPrefix="top-marker"
                previewDots={ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS}
                ariaLabel="Highlighter thickness"
              />
            </div>
          </>
        ) : null}

        {isShape ? (
          <>
            <div className="shrink-0">
              <PenSwatchRow
                swatchId={shapeStrokeSwatchId}
                onPick={setShapeStrokeSwatchId}
                idPrefix="top-shape-stroke"
                label="Stroke"
              />
            </div>
            <div className="min-w-[9rem] max-w-[14rem] flex-1">
              <ThicknessSliderRow
                value={markerThicknessStep}
                onChange={setMarkerThicknessStep}
                idPrefix="top-shape"
                previewDots={ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS}
                ariaLabel="Shape stroke width"
              />
            </div>
          </>
        ) : null}

        {isEraser ? (
          <div className="min-w-[9rem] max-w-[18rem] flex-1">
            <ThicknessSliderRow
              value={annotationMode === 'eraser-line' ? eraserLineThicknessStep : eraserPixelThicknessStep}
              onChange={
                annotationMode === 'eraser-line' ? setEraserLineThicknessStep : setEraserPixelThicknessStep
              }
              idPrefix="top-eraser"
              previewDots={ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS}
              ariaLabel={annotationMode === 'eraser-line' ? 'Stroke eraser width' : 'Eraser thickness'}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
