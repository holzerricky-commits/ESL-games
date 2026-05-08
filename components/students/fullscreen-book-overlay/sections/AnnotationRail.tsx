import { ChevronLeft, ChevronRight, Redo2, Trash2, Undo2 } from 'lucide-react'
import { BookAnnotationToolbar } from '@/components/students/book-annotation-toolbar'
import { BookCaptureMenu } from '@/components/students/book-capture-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getUnitReaderBounds } from '@/lib/books/page-range'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import type { BookCaptureFormat } from '@/lib/books/book-capture'
import type { BookLibraryPayload } from '@/lib/books/types'

type AnnotationCapabilities = { canUndo: boolean; canRedo: boolean }

interface AnnotationRailProps {
  hasResolvedUnit: boolean
  numPages: number | null
  selectedBookId: string | null
  isLessonPaperOverlayMode: boolean
  suppressChrome: boolean
  isAnnotationRailVisible: boolean
  setIsAnnotationRailVisible: (v: boolean) => void
  annotationMode: BookAnnotationInteractionMode
  setAnnotationMode: (v: BookAnnotationInteractionMode) => void
  stampVariant: StampVariant
  setStampVariant: (v: StampVariant) => void
  penColor: string
  setPenColor: (v: string) => void
  markerColor: string
  setMarkerColor: (v: string) => void
  penThicknessStep: AnnotationStrokeThicknessStep
  setPenThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  markerThicknessStep: AnnotationStrokeThicknessStep
  setMarkerThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  eraserPixelThicknessStep: AnnotationStrokeThicknessStep
  setEraserPixelThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  eraserLineThicknessStep: AnnotationStrokeThicknessStep
  setEraserLineThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  pdfReady: boolean
  captureBusy: boolean
  captureFormat: BookCaptureFormat
  setCaptureFormat: (v: BookCaptureFormat) => void
  jpegQuality: number
  setJpegQuality: (v: number) => void
  hideChromeForCapture: boolean
  setHideChromeForCapture: (v: boolean) => void
  watermarkEnabled: boolean
  setWatermarkEnabled: (v: boolean) => void
  studentName?: string
  runImageCapture: (args: { kind: 'full' | 'page' | 'region'; regionCss?: DOMRect }) => Promise<void>
  setRegionSelectOpen: (v: boolean) => void
  copyLastCaptureToClipboard: () => Promise<void>
  hasLastImageCapture: boolean
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  selectedBook: BookLibraryPayload['books'][number] | null
  setPdfFrom: (v: string) => void
  setPdfTo: (v: string) => void
  setPdfDialogOpen: (v: boolean) => void
  toolbarCaps: AnnotationCapabilities
  isWhiteboardOpen: boolean
  getActiveAnnotationRef: () => { current: { undo: () => void; redo: () => void; clear: () => void } | null }
  clearInkOpen: boolean
  setClearInkOpen: (v: boolean) => void
  clearTargetPage: number
}

export function AnnotationRail({
  hasResolvedUnit,
  numPages,
  selectedBookId,
  isLessonPaperOverlayMode,
  suppressChrome,
  isAnnotationRailVisible,
  setIsAnnotationRailVisible,
  annotationMode,
  setAnnotationMode,
  stampVariant,
  setStampVariant,
  penColor,
  setPenColor,
  markerColor,
  setMarkerColor,
  penThicknessStep,
  setPenThicknessStep,
  markerThicknessStep,
  setMarkerThicknessStep,
  eraserPixelThicknessStep,
  setEraserPixelThicknessStep,
  eraserLineThicknessStep,
  setEraserLineThicknessStep,
  pdfReady,
  captureBusy,
  captureFormat,
  setCaptureFormat,
  jpegQuality,
  setJpegQuality,
  hideChromeForCapture,
  setHideChromeForCapture,
  watermarkEnabled,
  setWatermarkEnabled,
  studentName,
  runImageCapture,
  setRegionSelectOpen,
  copyLastCaptureToClipboard,
  hasLastImageCapture,
  selectedUnit,
  selectedBook,
  setPdfFrom,
  setPdfTo,
  setPdfDialogOpen,
  toolbarCaps,
  isWhiteboardOpen,
  getActiveAnnotationRef,
  clearInkOpen,
  setClearInkOpen,
  clearTargetPage,
}: AnnotationRailProps) {
  if (!hasResolvedUnit || numPages == null || !selectedBookId) return null

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-4 top-1/2 z-[28] flex -translate-y-1/2 items-center md:left-6',
        isLessonPaperOverlayMode ? 'max-w-[calc(50vw-18px)]' : 'max-w-[calc(100vw-18px)]',
        suppressChrome && 'pointer-events-none invisible opacity-0',
      )}
    >
      {isAnnotationRailVisible ? (
        <div className="relative">
          <div
            className="flex max-h-[calc(100vh-210px)] flex-col items-center gap-1 overflow-y-auto overflow-x-visible rounded-2xl border border-white/10 bg-black/24 py-1.5 pl-1 pr-1 text-white shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px] [scrollbar-width:thin]"
            role="toolbar"
            aria-label="Annotation tools"
          >
            <BookAnnotationToolbar
              layout="vertical"
              annotationMode={annotationMode}
              setAnnotationMode={setAnnotationMode}
              stampVariant={stampVariant}
              setStampVariant={setStampVariant}
              penColor={penColor}
              setPenColor={setPenColor}
              markerColor={markerColor}
              setMarkerColor={setMarkerColor}
              penThicknessStep={penThicknessStep}
              setPenThicknessStep={setPenThicknessStep}
              markerThicknessStep={markerThicknessStep}
              setMarkerThicknessStep={setMarkerThicknessStep}
              eraserPixelThicknessStep={eraserPixelThicknessStep}
              setEraserPixelThicknessStep={setEraserPixelThicknessStep}
              eraserLineThicknessStep={eraserLineThicknessStep}
              setEraserLineThicknessStep={setEraserLineThicknessStep}
            />
            <span className="my-1 h-px w-7 shrink-0 bg-white/20" aria-hidden />
            <BookCaptureMenu
              disabled={!pdfReady}
              busy={captureBusy}
              captureFormat={captureFormat}
              onCaptureFormatChange={setCaptureFormat}
              jpegQuality={jpegQuality}
              onJpegQualityChange={setJpegQuality}
              hideChromeForCapture={hideChromeForCapture}
              onHideChromeForCaptureChange={setHideChromeForCapture}
              watermarkEnabled={watermarkEnabled}
              onWatermarkEnabledChange={setWatermarkEnabled}
              studentDisplayName={studentName}
              onSaveFullStage={() => runImageCapture({ kind: 'full' })}
              onSaveCurrentPage={() => runImageCapture({ kind: 'page' })}
              onSelectRegion={() => setRegionSelectOpen(true)}
              onCopyLastCapture={() => copyLastCaptureToClipboard()}
              canCopyLast={hasLastImageCapture}
              onExportPdfPacket={() => {
                if (numPages != null && selectedUnit) {
                  const b = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
                  setPdfFrom(String(b.min))
                  setPdfTo(String(b.max))
                }
                setPdfDialogOpen(true)
              }}
            />
            <span className="my-1 h-px w-7 shrink-0 bg-white/20" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15 disabled:opacity-35"
              disabled={!toolbarCaps.canUndo}
              aria-label={isWhiteboardOpen ? 'Undo whiteboard' : 'Undo annotation'}
              onClick={() => getActiveAnnotationRef().current?.undo()}
            >
              <Undo2 className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15 disabled:opacity-35"
              disabled={!toolbarCaps.canRedo}
              aria-label={isWhiteboardOpen ? 'Redo whiteboard' : 'Redo annotation'}
              onClick={() => getActiveAnnotationRef().current?.redo()}
            >
              <Redo2 className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15"
              aria-label={isWhiteboardOpen ? 'Clear whiteboard for this page' : 'Clear all ink on this page'}
              onClick={() => setClearInkOpen(true)}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
          <button
            type="button"
            className="absolute top-1/2 right-0 h-11 w-4 -translate-y-1/2 translate-x-[58%] rounded-r-full border border-l-0 border-white/12 bg-black/26 text-white/60 shadow-[0_4px_10px_rgba(0,0,0,0.16)] backdrop-blur-[1.5px] transition-colors hover:bg-black/34 hover:text-white/85"
            onClick={() => setIsAnnotationRailVisible(false)}
            aria-label="Hide annotation tools"
            title="Hide tools"
          >
            <ChevronLeft className="mx-auto h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="h-11 w-4 rounded-r-full border border-l-0 border-white/12 bg-black/22 text-white/60 shadow-[0_4px_10px_rgba(0,0,0,0.16)] backdrop-blur-[1.5px] transition-colors hover:bg-black/32 hover:text-white/85"
          onClick={() => setIsAnnotationRailVisible(true)}
          aria-label="Show annotation tools"
          title="Show tools"
        >
          <ChevronRight className="mx-auto h-3 w-3" />
        </button>
      )}

      <AlertDialog open={clearInkOpen} onOpenChange={setClearInkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isWhiteboardOpen ? 'Clear this whiteboard?' : 'Clear this page?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isWhiteboardOpen ? (
                <>
                  Remove everything on the whiteboard for page {clearTargetPage}. PDF ink on the book is not affected.
                  Undo history for this whiteboard will be cleared as well.
                </>
              ) : (
                <>
                  Remove all annotations on page {clearTargetPage}. The undo history for this page will be cleared as
                  well.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--brand-red)] text-white hover:bg-[var(--brand-red)]/90"
              onClick={() => {
                getActiveAnnotationRef().current?.clear()
                setClearInkOpen(false)
              }}
            >
              {isWhiteboardOpen ? 'Clear whiteboard' : 'Clear page'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
