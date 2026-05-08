import Link from 'next/link'
import type { ComponentType, CSSProperties, MutableRefObject } from 'react'
import { BookCaptureRegionOverlay } from '@/components/students/book-capture-region-overlay'
import { BookPageAnnotationLayer, type AnnotationCapabilities, type BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { Button } from '@/components/ui/button'

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
  PdfDocument: ComponentType<any>
  PdfPage: ComponentType<any>
  selectedUnitFilePath: string
  makeUnitFileUrl: (filePath: string) => string
  PDF_DOCUMENT_OPTIONS: Record<string, unknown>
  onDocumentLoadSuccess: (doc: { numPages: number }) => void
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
  strokeWidthScale: number
  shapeStrokeWidthScale: number
  stampScale: number
  strokeColor: string | undefined
  shapeColor: string | undefined
  textFontSizeNorm: number
  stickyFontSizeNorm: number
  setAnnotationTargetPage: (page: number) => void
  onLeftAnnotationCaps: (caps: AnnotationCapabilities) => void
  showSpreadRightPage: boolean
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  spreadRightPage: number | null
  onRightAnnotationCaps: (caps: AnnotationCapabilities) => void
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
  PdfDocument,
  PdfPage,
  selectedUnitFilePath,
  makeUnitFileUrl,
  PDF_DOCUMENT_OPTIONS,
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
  strokeWidthScale,
  shapeStrokeWidthScale,
  stampScale,
  strokeColor,
  shapeColor,
  textFontSizeNorm,
  stickyFontSizeNorm,
  setAnnotationTargetPage,
  onLeftAnnotationCaps,
  showSpreadRightPage,
  rightPageCaptureRef,
  spreadRightPage,
  onRightAnnotationCaps,
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
}: BookCanvasStageProps) {
  const shapeColorResolved = shapeColor ?? '#111827'

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
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: spreadDisplayScale !== 1 ? `scale(${spreadDisplayScale})` : undefined,
              transformOrigin: 'center center',
              transition: `transform ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
            }}
          >
            <PdfDocument
              className={`h-full w-full ${isWhiteboardOpen ? 'pointer-events-none' : ''}`}
              file={makeUnitFileUrl(selectedUnitFilePath)}
              options={PDF_DOCUMENT_OPTIONS}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<p className="p-6 text-sm text-muted-foreground">Loading PDF...</p>}
              error={<p className="p-6 text-sm text-[var(--brand-red)]">Could not open this PDF unit.</p>}
            >
              {isSinglePageMode ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div ref={leftPageCaptureRef} className="relative inline-block">
                    <PdfPage pageNumber={pageNumber} width={spreadPageWidth} renderTextLayer={false} renderAnnotationLayer={false} onLoadSuccess={onPdfPageLoadSuccess} />
                    {selectedBookId && selectedUnitId ? (
                      <BookPageAnnotationLayer
                        studentId={studentId}
                        bookId={selectedBookId}
                        unitId={selectedUnitId}
                        pageNumber={pageNumber}
                        widthPx={spreadPageWidth}
                        heightPx={pageCanvasHeightPx}
                        mode={annotationMode}
                        stampVariant={stampVariant}
                        strokeWidthScale={strokeWidthScale}
                        shapeStrokeWidthScale={shapeStrokeWidthScale}
                        stampScale={stampScale}
                        strokeColor={strokeColor}
                        shapeColor={shapeColorResolved}
                        textFontSizeNorm={textFontSizeNorm}
                        stickyFontSizeNorm={stickyFontSizeNorm}
                        defaultStickyWNorm={0.22}
                        defaultStickyHNorm={0.14}
                        onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                        onCapabilitiesChange={onLeftAnnotationCaps}
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="relative inline-grid grid-cols-2 gap-0" style={{ minHeight: pageCanvasHeightPx }}>
                    <div className="flex items-center justify-end" style={{ marginRight: '-2.6%' }}>
                      <div ref={leftPageCaptureRef} className="relative inline-block">
                        <PdfPage pageNumber={pageNumber} width={spreadPageWidth} renderTextLayer={false} renderAnnotationLayer={false} onLoadSuccess={onPdfPageLoadSuccess} />
                        {selectedBookId && selectedUnitId ? (
                          <BookPageAnnotationLayer
                            studentId={studentId}
                            bookId={selectedBookId}
                            unitId={selectedUnitId}
                            pageNumber={pageNumber}
                            widthPx={spreadPageWidth}
                            heightPx={pageCanvasHeightPx}
                            mode={annotationMode}
                            stampVariant={stampVariant}
                            strokeWidthScale={strokeWidthScale}
                            shapeStrokeWidthScale={shapeStrokeWidthScale}
                            stampScale={stampScale}
                            strokeColor={strokeColor}
                            shapeColor={shapeColorResolved}
                            textFontSizeNorm={textFontSizeNorm}
                            stickyFontSizeNorm={stickyFontSizeNorm}
                            defaultStickyWNorm={0.22}
                            defaultStickyHNorm={0.14}
                            onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                            onCapabilitiesChange={onLeftAnnotationCaps}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-start" style={{ marginLeft: '-2.6%' }}>
                      {showSpreadRightPage && spreadRightPage != null ? (
                        <div ref={rightPageCaptureRef} className="relative inline-block">
                          <PdfPage pageNumber={spreadRightPage} width={spreadPageWidth} renderTextLayer={false} renderAnnotationLayer={false} onLoadSuccess={onPdfPageLoadSuccess} />
                          {selectedBookId && selectedUnitId ? (
                            <BookPageAnnotationLayer
                              studentId={studentId}
                              bookId={selectedBookId}
                              unitId={selectedUnitId}
                              pageNumber={spreadRightPage}
                              widthPx={spreadPageWidth}
                              heightPx={pageCanvasHeightPx}
                              mode={annotationMode}
                              stampVariant={stampVariant}
                              strokeWidthScale={strokeWidthScale}
                              shapeStrokeWidthScale={shapeStrokeWidthScale}
                              stampScale={stampScale}
                              strokeColor={strokeColor}
                              shapeColor={shapeColorResolved}
                              textFontSizeNorm={textFontSizeNorm}
                              stickyFontSizeNorm={stickyFontSizeNorm}
                              defaultStickyWNorm={0.22}
                              defaultStickyHNorm={0.14}
                              onPointerSessionStart={() => setAnnotationTargetPage(spreadRightPage)}
                              onCapabilitiesChange={onRightAnnotationCaps}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <div aria-hidden style={{ width: spreadPageWidth, height: pageCanvasHeightPx }} />
                      )}
                    </div>
                    <div className="pointer-events-none absolute z-[1]" aria-hidden style={{ ...spreadGutterOverlayStyle, backgroundImage: 'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,0.03) 44.5%, rgba(0,0,0,0.06) 46%, rgba(0,0,0,0.09) 47.5%, rgba(0,0,0,0.11) 48.5%, rgba(0,0,0,0.13) 49.5%, rgba(0,0,0,0.14) 50%, rgba(0,0,0,0.13) 50.5%, rgba(0,0,0,0.11) 51.5%, rgba(0,0,0,0.09) 52.5%, rgba(0,0,0,0.06) 54%, rgba(0,0,0,0.03) 56.5%, transparent 100%)' }} />
                  </div>
                </div>
              )}
            </PdfDocument>

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
                    strokeWidthScale={strokeWidthScale}
                    shapeStrokeWidthScale={shapeStrokeWidthScale}
                    stampScale={stampScale}
                    strokeColor={strokeColor}
                    shapeColor={shapeColorResolved}
                    textFontSizeNorm={textFontSizeNorm}
                    stickyFontSizeNorm={stickyFontSizeNorm}
                    defaultStickyWNorm={0.22}
                    defaultStickyHNorm={0.14}
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
