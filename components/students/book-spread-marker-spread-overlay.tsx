'use client'

import type { MutableRefObject } from 'react'
import type { LiveStrokeDraft } from '@/components/students/book-page-annotation-layer'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { BookSpreadPageMarkerLayer } from '@/components/students/book-spread-page-marker-layer'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'

/**
 * Fallback when per-page multiply canvases stay invisible under the session layer.
 * Off by default — spread-level z-[25] can stack above in-page text unless layout is adjusted.
 */
type BookSpreadMarkerSpreadOverlayProps = {
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  pageCanvasHeightPx: number
  layout: SpreadInkLayout
  layoutMeasureRevision?: number
  commands: readonly AnnotationCommand[]
  leftPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  trailingMarkerStrokeDraft?: LiveStrokeDraft | null
}

export function BookSpreadMarkerSpreadOverlay({
  spreadOverlayWidthPx,
  spreadPageWidthPx,
  pageCanvasHeightPx,
  layout,
  layoutMeasureRevision = 0,
  commands,
  leftPageCaptureRef,
  rightPageCaptureRef,
  trailingMarkerStrokeDraft = null,
}: BookSpreadMarkerSpreadOverlayProps) {
  const { leftPageOriginXPx, rightPageOriginXPx } = layout

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[25]"
      style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
      aria-hidden
    >
      <div
        className="absolute top-0"
        style={{
          left: leftPageOriginXPx,
          width: spreadPageWidthPx,
          height: pageCanvasHeightPx,
        }}
      >
        <BookSpreadPageMarkerLayer
          side="left"
          widthPx={spreadPageWidthPx}
          heightPx={pageCanvasHeightPx}
          commands={commands}
          layout={layout}
          layoutMeasureRevision={layoutMeasureRevision}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          trailingMarkerStrokeDraft={trailingMarkerStrokeDraft}
        />
      </div>
      <div
        className="absolute top-0"
        style={{
          left: rightPageOriginXPx,
          width: spreadPageWidthPx,
          height: pageCanvasHeightPx,
        }}
      >
        <BookSpreadPageMarkerLayer
          side="right"
          widthPx={spreadPageWidthPx}
          heightPx={pageCanvasHeightPx}
          commands={commands}
          layout={layout}
          layoutMeasureRevision={layoutMeasureRevision}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          trailingMarkerStrokeDraft={trailingMarkerStrokeDraft}
        />
      </div>
    </div>
  )
}
