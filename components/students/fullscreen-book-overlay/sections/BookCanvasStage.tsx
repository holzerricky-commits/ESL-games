'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { ComponentType, CSSProperties, MutableRefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { BookCaptureRegionOverlay } from '@/components/students/book-capture-region-overlay'
import { BookPageAnnotationLayer, type AnnotationCapabilities, type BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { BookSpreadStrokeOverlay } from '@/components/students/book-spread-stroke-overlay'
import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import { Button } from '@/components/ui/button'
import type { BookReaderDocumentReadyMeta } from '@/components/students/fullscreen-book-overlay/types'
import { useReaderPrefetchCacheRevision } from '@/components/students/fullscreen-book-overlay/hooks/useReaderPrefetchCacheRevision'
import { ReaderPageSlot } from '@/components/students/fullscreen-book-overlay/sections/ReaderPageSlot'
import { preloadAllManifestBrushPatterns } from '@/lib/books/brush-pattern-loader'
import { seamClientX } from '@/lib/books/spread-stroke-split'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import { cn } from '@/lib/utils'

interface BookCanvasStageProps {
  pageAreaRef: MutableRefObject<HTMLDivElement | null>
  hasCurriculumOrHistory: boolean
  studentId: string
  loading: boolean
  error: string | null
  hasResolvedUnit: boolean
  pdfReady: boolean
  spreadDisplayScale: number
  ANIMATION_MS: number
  PdfPage: ComponentType<any>
  selectedUnitFilePath: string
  makeUnitFileUrl: (filePath: string) => string
  onDocumentLoadSuccess: (doc: BookReaderDocumentReadyMeta) => void
  isWhiteboardOpen: boolean
  isSinglePageMode: boolean
  leftPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  pageNumber: number
  spreadPageWidth: number
  onPdfPageLoadSuccess: (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => void
  selectedBookId: string | null
  selectedUnitId?: string
  pageCanvasHeightPx: number
  annotationMode: any
  stampVariant: any
  stampQuestionColor: string
  strokeWidthScale: number
  eraserLineStrokeWidthScale: number
  penStrokeWidthScale: number
  shapeStrokeWidthScale: number
  stampScale: number
  strokeColor: string | undefined
  penInkColor: string
  penInkStyle?: import('@/lib/books/pen-ink').PenInkStyle
  shapeColor: string | undefined
  textColor: string | undefined
  stickyFillColor?: string
  strokeLineDashStyle?: AnnotationLineDashStyle
  shapeLineDashStyle?: AnnotationLineDashStyle
  shapeStrokeEnabled?: boolean
  shapeFillMode?: ShapeFillMode
  shapeFillColor?: string
  textFontSizeNorm: number
  textVisualStyle?: 'plain' | 'filled'
  textFillColor?: string
  stickyFontSizeNorm: number
  setAnnotationTargetPage: (page: number) => void
  onLeftAnnotationCaps: (caps: AnnotationCapabilities) => void
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  showSpreadRightPage: boolean
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  spreadRightPage: number | null
  onRightAnnotationCaps: (caps: AnnotationCapabilities) => void
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  spreadGutterOverlayStyle: CSSProperties
  wbCaptureRootRef: MutableRefObject<HTMLDivElement | null>
  WHITEBOARD_NOTEBOOK_SURFACE: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'>
  whiteboardPage: number
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  onWhiteboardCaps: (caps: AnnotationCapabilities) => void
  regionSelectOpen: boolean
  setRegionSelectOpen: (v: boolean) => void
  runImageCapture: (args: {
    kind: 'full' | 'page' | 'region'
    regionCss?: DOMRect | Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>
  }) => Promise<void>
  pdfExporting: boolean
  pdfProgressLabel: string | null
  numPages: number | null
  /** Phase E1 (Option B): paper-tone hold until first spread `react-pdf` onLoadSuccess. */
  viewportPaintHold: boolean
  firstSpreadPaintSession: number
  onFirstSpreadPaintReady: () => void
  spreadStrokeOverlayRef: MutableRefObject<BookPageAnnotationHandle | null>
  onSpreadOverlayCaps: (caps: AnnotationCapabilities) => void
  spreadStrokeCaptureEnabled: boolean
  onEyedropperPick?: (
    pageNumber: number,
    clientX: number,
    clientY: number,
  ) => void
}

export function BookCanvasStage({
  pageAreaRef,
  hasCurriculumOrHistory,
  studentId,
  loading,
  error,
  hasResolvedUnit,
  pdfReady,
  spreadDisplayScale,
  ANIMATION_MS,
  PdfPage,
  selectedUnitFilePath,
  makeUnitFileUrl,
  onDocumentLoadSuccess,
  isWhiteboardOpen,
  isSinglePageMode,
  leftPageCaptureRef,
  pageNumber,
  spreadPageWidth,
  onPdfPageLoadSuccess,
  selectedBookId,
  selectedUnitId,
  pageCanvasHeightPx,
  annotationMode,
  stampVariant,
  stampQuestionColor,
  strokeWidthScale,
  eraserLineStrokeWidthScale,
  penStrokeWidthScale,
  shapeStrokeWidthScale,
  stampScale,
  strokeColor,
  penInkColor,
  penInkStyle,
  shapeColor,
  textColor,
  stickyFillColor = '#fef3c7',
  strokeLineDashStyle = 'solid',
  shapeLineDashStyle = 'solid',
  shapeStrokeEnabled = true,
  shapeFillMode = 'none',
  shapeFillColor = '#eab308',
  textFontSizeNorm,
  textVisualStyle = 'plain',
  textFillColor = '#fef9c3',
  stickyFontSizeNorm,
  setAnnotationTargetPage,
  onLeftAnnotationCaps,
  leftAnnRef,
  showSpreadRightPage,
  rightPageCaptureRef,
  spreadRightPage,
  onRightAnnotationCaps,
  rightAnnRef,
  spreadGutterOverlayStyle,
  wbCaptureRootRef,
  WHITEBOARD_NOTEBOOK_SURFACE,
  whiteboardPage,
  wbAnnRef,
  onWhiteboardCaps,
  regionSelectOpen,
  setRegionSelectOpen,
  runImageCapture,
  pdfExporting,
  pdfProgressLabel,
  numPages,
  viewportPaintHold,
  firstSpreadPaintSession,
  onFirstSpreadPaintReady,
  spreadStrokeOverlayRef,
  onSpreadOverlayCaps,
  spreadStrokeCaptureEnabled,
  onEyedropperPick,
}: BookCanvasStageProps) {
  const shapeColorResolved = shapeColor ?? '#111827'

  const eyedropperForPage = useCallback(
    (targetPage: number) =>
      onEyedropperPick
        ? (clientX: number, clientY: number) => onEyedropperPick(targetPage, clientX, clientY)
        : undefined,
    [onEyedropperPick],
  )
  const textColorResolved = textColor ?? '#111827'
  const prefetchRevision = useReaderPrefetchCacheRevision()
  /** Phase E1 — see `lib/books/first-spread-paint-ready-contract.ts`. */
  const firstSpreadReportedRef = useRef(false)
  const leftPagePaintedRef = useRef(false)
  const rightPagePaintedRef = useRef(false)

  const tryReportFirstSpreadPaintReady = useCallback(() => {
    if (firstSpreadReportedRef.current) return
    if (isSinglePageMode) {
      if (!leftPagePaintedRef.current) return
      firstSpreadReportedRef.current = true
      onFirstSpreadPaintReady()
      return
    }
    if (!showSpreadRightPage || spreadRightPage == null) {
      if (!leftPagePaintedRef.current) return
      firstSpreadReportedRef.current = true
      onFirstSpreadPaintReady()
      return
    }
    if (leftPagePaintedRef.current && rightPagePaintedRef.current) {
      firstSpreadReportedRef.current = true
      onFirstSpreadPaintReady()
    }
  }, [isSinglePageMode, showSpreadRightPage, spreadRightPage, onFirstSpreadPaintReady])

  useEffect(() => {
    firstSpreadReportedRef.current = false
    leftPagePaintedRef.current = false
    rightPagePaintedRef.current = false
  }, [firstSpreadPaintSession, isSinglePageMode])

  const handleLeftPdfPageLoadSuccess = useCallback(
    (p: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
      onPdfPageLoadSuccess(p)
      leftPagePaintedRef.current = true
      tryReportFirstSpreadPaintReady()
    },
    [onPdfPageLoadSuccess, tryReportFirstSpreadPaintReady],
  )

  const handleRightPdfPageLoadSuccess = useCallback(
    (p: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
      onPdfPageLoadSuccess(p)
      rightPagePaintedRef.current = true
      tryReportFirstSpreadPaintReady()
    },
    [onPdfPageLoadSuccess, tryReportFirstSpreadPaintReady],
  )

  const handleSingleFallbackPdfLoadSuccess = useCallback(
    (p: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
      onPdfPageLoadSuccess(p)
      leftPagePaintedRef.current = true
      tryReportFirstSpreadPaintReady()
    },
    [onPdfPageLoadSuccess, tryReportFirstSpreadPaintReady],
  )
  /** Same overlap intent as gutter overlay, in px — keep in sync with `SPREAD_CLUSTER_OVERLAP_RATIO`. */
  const spreadSidePullPx = Math.max(0, Math.round(spreadPageWidth * 0.018))
  /** Two pages minus one overlap — must match grid width and `useSpreadGutterOverlayStyle` clusterW. */
  const spreadOverlayWidthPx = Math.max(0, Math.round(spreadPageWidth * 2 - spreadSidePullPx))
  const spreadOverlayHeightPx = pageCanvasHeightPx

  const spreadGridRef = useRef<HTMLDivElement | null>(null)
  const [leftPenInkPatternOriginXPx, setLeftPenInkPatternOriginXPx] = useState(0)
  const [rightPenInkPatternOriginXPx, setRightPenInkPatternOriginXPx] = useState(0)
  const [spreadSeamNormX, setSpreadSeamNormX] = useState(0.5)

  const measurePenInkPatternOrigins = useCallback(() => {
    const spread = spreadGridRef.current?.getBoundingClientRect()
    const left = leftPageCaptureRef.current?.getBoundingClientRect()
    const right = rightPageCaptureRef.current?.getBoundingClientRect()
    if (!spread || !(spreadOverlayWidthPx > 0)) return
    const scale = spreadDisplayScale > 0 ? spreadDisplayScale : 1
    if (left) setLeftPenInkPatternOriginXPx((left.left - spread.left) / scale)
    if (right) setRightPenInkPatternOriginXPx((right.left - spread.left) / scale)
    if (left && right) {
      const seamClient = seamClientX(left, right)
      setSpreadSeamNormX((seamClient - spread.left) / scale / spreadOverlayWidthPx)
    }
  }, [leftPageCaptureRef, rightPageCaptureRef, spreadDisplayScale, spreadOverlayWidthPx])

  useLayoutEffect(() => {
    if (isSinglePageMode) {
      setLeftPenInkPatternOriginXPx(0)
      setRightPenInkPatternOriginXPx(0)
      setSpreadSeamNormX(0.5)
      return
    }
    measurePenInkPatternOrigins()
    const grid = spreadGridRef.current
    if (!grid) return
    const ro = new ResizeObserver(() => measurePenInkPatternOrigins())
    ro.observe(grid)
    window.addEventListener('resize', measurePenInkPatternOrigins)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measurePenInkPatternOrigins)
    }
  }, [
    isSinglePageMode,
    measurePenInkPatternOrigins,
    spreadPageWidth,
    pageCanvasHeightPx,
    spreadDisplayScale,
    showSpreadRightPage,
    spreadRightPage,
    pageNumber,
  ])

  const [sharedPdf, setSharedPdf] = useState<PDFDocumentProxy | null>(null)
  const [unitPdfLoading, setUnitPdfLoading] = useState(false)
  const [unitPdfError, setUnitPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (unitPdfError) onFirstSpreadPaintReady()
  }, [unitPdfError, onFirstSpreadPaintReady])

  useEffect(() => {
    if (!selectedBookId) return
    preloadAllManifestBrushPatterns()
  }, [selectedBookId])

  const onDocumentLoadSuccessRef = useRef(onDocumentLoadSuccess)
  onDocumentLoadSuccessRef.current = onDocumentLoadSuccess

  useEffect(() => {
    if (!pdfReady || !selectedUnitFilePath) {
      setSharedPdf(null)
      setUnitPdfLoading(false)
      setUnitPdfError(null)
      return
    }
    const fileUrl = makeUnitFileUrl(selectedUnitFilePath)
    let cancelled = false
    setUnitPdfLoading(true)
    setUnitPdfError(null)
    setSharedPdf(null)
    void loadCachedPdfDocument(fileUrl)
      .then(async (doc) => {
        if (cancelled) return
        let pageAspectRatio: number | undefined
        try {
          const n = doc.numPages
          if (n > 0) {
            const p = Math.min(Math.max(1, pageNumber), n)
            const page = await doc.getPage(p)
            const v = page.getViewport({ scale: 1 })
            const r = v.width / v.height
            if (Number.isFinite(r) && r > 0) pageAspectRatio = r
          }
        } catch {
          /* layout falls back to default aspect until react-pdf reports */
        }
        if (cancelled) return
        onDocumentLoadSuccessRef.current({ numPages: doc.numPages, pageAspectRatio })
        setSharedPdf(doc)
      })
      .catch((e) => {
        if (cancelled) return
        setUnitPdfError(e instanceof Error ? e.message : 'Could not open this PDF unit.')
      })
      .finally(() => {
        if (!cancelled) setUnitPdfLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Intentionally omit `onDocumentLoadSuccess` — use ref so page turns do not reload the PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when unit or worker readiness changes
  }, [pdfReady, selectedUnitFilePath, makeUnitFileUrl])

  return (
    <>
      <div ref={pageAreaRef} className="absolute inset-0 overflow-hidden">
        {!hasCurriculumOrHistory ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/92 p-6 text-center backdrop-blur-sm">
              <p className="text-base font-semibold text-foreground">No curriculum assigned yet for this student.</p>
              <p className="mt-2 text-sm text-muted-foreground">Assign a curriculum book first in the teacher plan screen.</p>
              <Button asChild className="mt-4">
                <Link href={`/students/${studentId}/plan?tab=curriculum`}>Open curriculum planning</Link>
              </Button>
            </div>
          </div>
        ) : loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading book...</p>
        ) : error ? (
          <p className="p-6 text-sm text-[var(--brand-red)]">{error}</p>
        ) : !hasResolvedUnit ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/92 p-6 text-center backdrop-blur-sm">
              <p className="text-base font-semibold text-foreground">Assigned book has no units.</p>
              <p className="mt-2 text-sm text-muted-foreground">Add unit PDF files to this book folder in `book-library` and try again.</p>
            </div>
          </div>
        ) : !pdfReady ? (
          <p className="p-6 text-sm text-muted-foreground">Preparing PDF viewer...</p>
        ) : unitPdfLoading || !sharedPdf ? (
          <p className="p-6 text-sm text-muted-foreground">Loading PDF...</p>
        ) : unitPdfError ? (
          <p className="p-6 text-sm text-[var(--brand-red)]">{unitPdfError}</p>
        ) : (
          <div className="absolute inset-0 flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
            {viewportPaintHold ? (
              <div
                className="absolute inset-0 z-[18] flex flex-col items-center justify-center gap-2 bg-[var(--surface-2)] text-center"
                aria-busy="true"
                aria-live="polite"
              >
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
                <p className="text-xs text-muted-foreground">Loading pages…</p>
              </div>
            ) : null}
            <div
              className={cn(
                'relative flex w-max max-h-full max-w-full shrink-0 items-center justify-center leading-none bg-[var(--surface-2)]',
                isWhiteboardOpen && 'pointer-events-none',
              )}
              style={{
                transform: spreadDisplayScale !== 1 ? `scale(${spreadDisplayScale})` : undefined,
                transformOrigin: 'center center',
                transition: `transform ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
              }}
            >
              {isSinglePageMode ? (
                <div className="flex w-max max-w-full items-start justify-center leading-none">
                  {selectedUnitId ? (
                    <ReaderPageSlot
                      key={`slot-p-${pageNumber}`}
                      unitId={selectedUnitId}
                      pageNumber={pageNumber}
                      spreadPageWidth={spreadPageWidth}
                      pageCanvasHeightPx={pageCanvasHeightPx}
                      pdf={sharedPdf}
                      PdfPage={PdfPage}
                      onPdfPageLoadSuccess={handleLeftPdfPageLoadSuccess}
                      prefetchRevision={prefetchRevision}
                      captureRef={leftPageCaptureRef}
                    >
                      {selectedBookId ? (
                        <BookPageAnnotationLayer
                          ref={leftAnnRef}
                          studentId={studentId}
                          bookId={selectedBookId}
                          unitId={selectedUnitId}
                          pageNumber={pageNumber}
                          widthPx={spreadPageWidth}
                          heightPx={pageCanvasHeightPx}
                          mode={annotationMode}
                          stampVariant={stampVariant}
                          stampQuestionColor={stampQuestionColor}
                          strokeWidthScale={strokeWidthScale}
                          eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                          penStrokeWidthScale={penStrokeWidthScale}
                          shapeStrokeWidthScale={shapeStrokeWidthScale}
                          stampScale={stampScale}
                          strokeColor={strokeColor}
                          penInkColor={penInkColor}
                          penInkStyle={penInkStyle}
                          strokeLineDashStyle={strokeLineDashStyle}
                          shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                          shapeLineDashStyle={shapeLineDashStyle}
                          shapeStrokeEnabled={shapeStrokeEnabled}
                          shapeFillMode={shapeFillMode}
                          shapeFillColor={shapeFillColor}
                          textFontSizeNorm={textFontSizeNorm}
                          textVisualStyle={textVisualStyle}
                          textFillColor={textFillColor}
                          stickyFillColor={stickyFillColor}
                          stickyFontSizeNorm={stickyFontSizeNorm}
                          defaultStickyWNorm={0.22}
                          defaultStickyHNorm={0.11}
                          onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                          onEyedropperPick={eyedropperForPage(pageNumber)}
                          onCapabilitiesChange={onLeftAnnotationCaps}
                        />
                      ) : null}
                    </ReaderPageSlot>
                  ) : (
                    <div ref={leftPageCaptureRef} className="relative inline-block">
                      <PdfPage
                        key={`p-${pageNumber}`}
                        pdf={sharedPdf}
                        pageNumber={pageNumber}
                        width={spreadPageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={handleSingleFallbackPdfLoadSuccess}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  ref={spreadGridRef}
                  className="relative inline-grid w-max max-w-full grid-cols-2 items-start gap-0"
                  style={{
                    minHeight: pageCanvasHeightPx,
                    height: pageCanvasHeightPx,
                    width: spreadOverlayWidthPx,
                  }}
                >
                    <div className="flex min-w-0 items-start justify-end overflow-hidden">
                      {selectedUnitId ? (
                        <ReaderPageSlot
                          key={`slot-l-${pageNumber}`}
                          unitId={selectedUnitId}
                          pageNumber={pageNumber}
                          spreadPageWidth={spreadPageWidth}
                          pageCanvasHeightPx={pageCanvasHeightPx}
                          pdf={sharedPdf}
                          PdfPage={PdfPage}
                          onPdfPageLoadSuccess={handleLeftPdfPageLoadSuccess}
                          prefetchRevision={prefetchRevision}
                          captureRef={leftPageCaptureRef}
                        >
                          {selectedBookId ? (
                            <BookPageAnnotationLayer
                              ref={leftAnnRef}
                              studentId={studentId}
                              bookId={selectedBookId}
                              unitId={selectedUnitId}
                              pageNumber={pageNumber}
                              widthPx={spreadPageWidth}
                              heightPx={pageCanvasHeightPx}
                              mode={annotationMode}
                              stampVariant={stampVariant}
                              stampQuestionColor={stampQuestionColor}
                              strokeWidthScale={strokeWidthScale}
                              eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                              penStrokeWidthScale={penStrokeWidthScale}
                              shapeStrokeWidthScale={shapeStrokeWidthScale}
                              stampScale={stampScale}
                              strokeColor={strokeColor}
                              penInkColor={penInkColor}
                              penInkStyle={penInkStyle}
                              penInkPatternOriginXPx={leftPenInkPatternOriginXPx}
                              strokeLineDashStyle={strokeLineDashStyle}
                              shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                              shapeLineDashStyle={shapeLineDashStyle}
                              shapeStrokeEnabled={shapeStrokeEnabled}
                              shapeFillMode={shapeFillMode}
                              shapeFillColor={shapeFillColor}
                              textFontSizeNorm={textFontSizeNorm}
                              textVisualStyle={textVisualStyle}
                              textFillColor={textFillColor}
                              stickyFillColor={stickyFillColor}
                              stickyFontSizeNorm={stickyFontSizeNorm}
                              defaultStickyWNorm={0.22}
                              defaultStickyHNorm={0.11}
                              onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                              onEyedropperPick={eyedropperForPage(pageNumber)}
                              onCapabilitiesChange={onLeftAnnotationCaps}
                            />
                          ) : null}
                        </ReaderPageSlot>
                      ) : (
                        <div ref={leftPageCaptureRef} className="relative inline-block">
                          <PdfPage
                            key={`l-${pageNumber}`}
                            pdf={sharedPdf}
                            pageNumber={pageNumber}
                            width={spreadPageWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            onLoadSuccess={handleLeftPdfPageLoadSuccess}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 items-start justify-start overflow-hidden" style={{ marginLeft: -spreadSidePullPx }}>
                      {showSpreadRightPage && spreadRightPage != null ? (
                        selectedUnitId ? (
                          <ReaderPageSlot
                            key={`slot-r-${spreadRightPage}`}
                            unitId={selectedUnitId}
                            pageNumber={spreadRightPage}
                            spreadPageWidth={spreadPageWidth}
                            pageCanvasHeightPx={pageCanvasHeightPx}
                            pdf={sharedPdf}
                            PdfPage={PdfPage}
                            onPdfPageLoadSuccess={handleRightPdfPageLoadSuccess}
                            prefetchRevision={prefetchRevision}
                            captureRef={rightPageCaptureRef}
                          >
                            {selectedBookId ? (
                              <BookPageAnnotationLayer
                                ref={rightAnnRef}
                                studentId={studentId}
                                bookId={selectedBookId}
                                unitId={selectedUnitId}
                                pageNumber={spreadRightPage}
                                widthPx={spreadPageWidth}
                                heightPx={pageCanvasHeightPx}
                                mode={annotationMode}
                                stampVariant={stampVariant}
                                stampQuestionColor={stampQuestionColor}
                                strokeWidthScale={strokeWidthScale}
                                eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                                penStrokeWidthScale={penStrokeWidthScale}
                                shapeStrokeWidthScale={shapeStrokeWidthScale}
                                stampScale={stampScale}
                                strokeColor={strokeColor}
                                penInkColor={penInkColor}
                                penInkStyle={penInkStyle}
                                penInkPatternOriginXPx={rightPenInkPatternOriginXPx}
                                strokeLineDashStyle={strokeLineDashStyle}
                                shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                                shapeLineDashStyle={shapeLineDashStyle}
                                shapeStrokeEnabled={shapeStrokeEnabled}
                                shapeFillMode={shapeFillMode}
                                shapeFillColor={shapeFillColor}
                                textFontSizeNorm={textFontSizeNorm}
                                textVisualStyle={textVisualStyle}
                                textFillColor={textFillColor}
                                stickyFillColor={stickyFillColor}
                                stickyFontSizeNorm={stickyFontSizeNorm}
                                defaultStickyWNorm={0.22}
                                defaultStickyHNorm={0.11}
                                onPointerSessionStart={() => setAnnotationTargetPage(spreadRightPage)}
                                onEyedropperPick={
                                  spreadRightPage != null ? eyedropperForPage(spreadRightPage) : undefined
                                }
                                onCapabilitiesChange={onRightAnnotationCaps}
                              />
                            ) : null}
                          </ReaderPageSlot>
                        ) : (
                          <div ref={rightPageCaptureRef} className="relative inline-block">
                            <PdfPage
                              key={`r-${spreadRightPage}`}
                              pdf={sharedPdf}
                              pageNumber={spreadRightPage}
                              width={spreadPageWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              onLoadSuccess={handleRightPdfPageLoadSuccess}
                            />
                          </div>
                        )
                      ) : (
                        <div aria-hidden style={{ width: spreadPageWidth, height: pageCanvasHeightPx }} />
                      )}
                    </div>
                    <div className="pointer-events-none absolute z-[1]" aria-hidden style={{ ...spreadGutterOverlayStyle, backgroundImage: 'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,0.03) 44.5%, rgba(0,0,0,0.06) 46%, rgba(0,0,0,0.09) 47.5%, rgba(0,0,0,0.11) 48.5%, rgba(0,0,0,0.13) 49.5%, rgba(0,0,0,0.14) 50%, rgba(0,0,0,0.13) 50.5%, rgba(0,0,0,0.11) 51.5%, rgba(0,0,0,0.09) 52.5%, rgba(0,0,0,0.06) 54%, rgba(0,0,0,0.03) 56.5%, transparent 100%)' }} />
                    {!isWhiteboardOpen &&
                    showSpreadRightPage &&
                    spreadRightPage != null &&
                    selectedBookId &&
                    selectedUnitId ? (
                      <BookSpreadStrokeOverlay
                        ref={spreadStrokeOverlayRef}
                        leftPageCaptureRef={leftPageCaptureRef}
                        rightPageCaptureRef={rightPageCaptureRef}
                        leftAnnRef={leftAnnRef}
                        rightAnnRef={rightAnnRef}
                        annotationMode={annotationMode}
                        strokeWidthScale={strokeWidthScale}
                        eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                        penStrokeWidthScale={penStrokeWidthScale}
                        strokeColor={strokeColor}
                        penInkColor={penInkColor}
                        penInkStyle={penInkStyle}
                        strokeLineDashStyle={strokeLineDashStyle}
                        pageNumberLeft={pageNumber}
                        pageNumberRight={spreadRightPage}
                        setAnnotationTargetPage={setAnnotationTargetPage}
                        onCapabilitiesChange={onSpreadOverlayCaps}
                        captureEnabled={spreadStrokeCaptureEnabled}
                        spreadOverlayWidthPx={spreadOverlayWidthPx}
                        spreadOverlayHeightPx={spreadOverlayHeightPx}
                        spreadPageWidthPx={spreadPageWidth}
                        leftPenInkPatternOriginXPx={leftPenInkPatternOriginXPx}
                        rightPenInkPatternOriginXPx={rightPenInkPatternOriginXPx}
                        spreadSeamNormX={spreadSeamNormX}
                      />
                    ) : null}
                  </div>
              )}
            </div>

            {isWhiteboardOpen && selectedBookId && numPages != null && selectedUnitId ? (
              <div className="pointer-events-none absolute inset-0 z-[15] flex min-h-0 min-w-0 items-center justify-center">
                <div
                  ref={wbCaptureRootRef}
                  className="pointer-events-auto relative overflow-hidden border border-[#4a3421]/20 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
                  style={{ width: spreadPageWidth, height: pageCanvasHeightPx, ...WHITEBOARD_NOTEBOOK_SURFACE }}
                >
                  <BookPageAnnotationLayer
                    key={`wb-${whiteboardPage}`}
                    ref={wbAnnRef}
                    studentId={studentId}
                    bookId={selectedBookId}
                    unitId={selectedUnitId}
                    pageNumber={whiteboardPage}
                    storageChannel="whiteboard"
                    widthPx={spreadPageWidth}
                    heightPx={pageCanvasHeightPx}
                    mode={annotationMode}
                    stampVariant={stampVariant}
                    stampQuestionColor={stampQuestionColor}
                    strokeWidthScale={strokeWidthScale}
                    eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                    penStrokeWidthScale={penStrokeWidthScale}
                    shapeStrokeWidthScale={shapeStrokeWidthScale}
                    stampScale={stampScale}
                    strokeColor={strokeColor}
                    penInkColor={penInkColor}
                    penInkStyle={penInkStyle}
                    strokeLineDashStyle={strokeLineDashStyle}
                    shapeColor={shapeColorResolved}
                    textColor={textColorResolved}
                    shapeLineDashStyle={shapeLineDashStyle}
                    shapeStrokeEnabled={shapeStrokeEnabled}
                    shapeFillMode={shapeFillMode}
                    shapeFillColor={shapeFillColor}
                    textFontSizeNorm={textFontSizeNorm}
                    textVisualStyle={textVisualStyle}
                    textFillColor={textFillColor}
                    stickyFillColor={stickyFillColor}
                    stickyFontSizeNorm={stickyFontSizeNorm}
                    defaultStickyWNorm={0.22}
                    defaultStickyHNorm={0.11}
                    onEyedropperPick={eyedropperForPage(whiteboardPage)}
                    onCapabilitiesChange={onWhiteboardCaps}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
        <BookCaptureRegionOverlay
          open={regionSelectOpen}
          onCancel={() => setRegionSelectOpen(false)}
          onConfirm={(rect) => {
            setRegionSelectOpen(false)
            void runImageCapture({ kind: 'region', regionCss: rect })
          }}
        />
        {pdfExporting ? (
          <div className="absolute inset-0 z-[88] flex flex-col items-center justify-center gap-2 bg-black/55 px-4 text-center text-sm text-white backdrop-blur-[2px]">
            <p>{pdfProgressLabel ?? 'Exporting…'}</p>
          </div>
        ) : null}
      </div>
    </>
  )
}
