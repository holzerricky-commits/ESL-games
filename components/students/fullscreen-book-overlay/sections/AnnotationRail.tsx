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
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  TextAnnotationVisualStyle,
} from '@/lib/books/annotation-command-types'
import type { EyedropperVariant } from '@/lib/books/eyedropper-variant'
import type { BookCaptureFormat } from '@/lib/books/book-capture'
import type { BookLibraryPayload } from '@/lib/books/types'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'

type AnnotationCapabilities = { canUndo: boolean; canRedo: boolean }

/** Shared chrome for the annotation rail so expanded + collapsed read as one control. */
const ANNOTATION_RAIL_SURFACE =
  'border border-white/10 bg-black/24 text-white/65 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px]'

/** Same footprint for the peek tab (collapsed) and the hide handle (expanded, inside shell). */
const ANNOTATION_RAIL_HANDLE_LAYOUT =
  'flex h-11 w-4 shrink-0 items-center justify-center rounded-l-none rounded-r-2xl'

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
  stampQuestionColor: string
  setStampQuestionColor: (c: string) => void
  penSwatchId: string
  pickPenSwatch: (id: string) => void
  penColorSource: AnnotationColorSource
  penCustomHex: string
  pickPenCustomColor: (hex: string) => void
  textColor: string
  setTextColor: (v: string) => void
  shapeStrokeSwatchId: string
  setShapeStrokeSwatchId: (v: string) => void
  stickyFillColor: string
  setStickyFillColor: (v: string) => void
  markerColor: string
  markerColorSource: AnnotationColorSource
  markerCustomHex: string
  pickMarkerSwatchColor: (hex: string) => void
  pickMarkerCustomColor: (hex: string) => void
  penThicknessStep: AnnotationStrokeThicknessStep
  setPenThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  markerThicknessStep: AnnotationStrokeThicknessStep
  setMarkerThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  eraserPixelThicknessStep: AnnotationStrokeThicknessStep
  setEraserPixelThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  eraserLineThicknessStep: AnnotationStrokeThicknessStep
  setEraserLineThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  textVisualStyle: TextAnnotationVisualStyle
  setTextVisualStyle: (v: TextAnnotationVisualStyle) => void
  textFillColor: string
  setTextFillColor: (v: string) => void
  penLineDashStyle: AnnotationLineDashStyle
  setPenLineDashStyle: (v: AnnotationLineDashStyle) => void
  markerLineDashStyle: AnnotationLineDashStyle
  setMarkerLineDashStyle: (v: AnnotationLineDashStyle) => void
  shapeLineDashStyle: AnnotationLineDashStyle
  setShapeLineDashStyle: (v: AnnotationLineDashStyle) => void
  shapeStrokeEnabled: boolean
  setShapeStrokeEnabled: (v: boolean) => void
  shapeFillMode: ShapeFillMode
  setShapeFillMode: (v: ShapeFillMode) => void
  shapeFillColor: string
  setShapeFillColor: (v: string) => void
  eyedropperVariant: EyedropperVariant
  setEyedropperVariant: (v: EyedropperVariant) => void
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
  clearInkSpreadPagePair: { readonly left: number; readonly right: number } | null
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
  stampQuestionColor,
  setStampQuestionColor,
  penSwatchId,
  pickPenSwatch,
  penColorSource,
  penCustomHex,
  pickPenCustomColor,
  textColor,
  setTextColor,
  shapeStrokeSwatchId,
  setShapeStrokeSwatchId,
  stickyFillColor,
  setStickyFillColor,
  markerColor,
  markerColorSource,
  markerCustomHex,
  pickMarkerSwatchColor,
  pickMarkerCustomColor,
  penThicknessStep,
  setPenThicknessStep,
  markerThicknessStep,
  setMarkerThicknessStep,
  eraserPixelThicknessStep,
  setEraserPixelThicknessStep,
  eraserLineThicknessStep,
  setEraserLineThicknessStep,
  textVisualStyle,
  setTextVisualStyle,
  textFillColor,
  setTextFillColor,
  penLineDashStyle,
  setPenLineDashStyle,
  markerLineDashStyle,
  setMarkerLineDashStyle,
  shapeLineDashStyle,
  setShapeLineDashStyle,
  shapeStrokeEnabled,
  setShapeStrokeEnabled,
  shapeFillMode,
  setShapeFillMode,
  shapeFillColor,
  setShapeFillColor,
  eyedropperVariant,
  setEyedropperVariant,
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
  clearInkSpreadPagePair,
}: AnnotationRailProps) {
  if (!hasResolvedUnit || numPages == null || !selectedBookId) return null

  return (
    <div
      className={cn(
        /* Root must not steal hits from the book (z-28 sits above the stage); only chrome re-enables events. */
        'pointer-events-none absolute left-0 top-1/2 z-[28] flex -translate-y-1/2 items-center',
        isLessonPaperOverlayMode ? 'max-w-[calc(50vw-18px)]' : 'max-w-[calc(100vw-18px)]',
        suppressChrome && 'invisible opacity-0',
      )}
    >
      {isAnnotationRailVisible ? (
        <div
          className={cn(
            'relative inline-block max-w-full pl-2 pr-0 align-middle md:pl-3',
            !suppressChrome && 'pointer-events-auto',
          )}
        >
          <div
            className={cn(
              'flex max-h-[calc(100vh-210px)] min-h-0 w-max flex-col overflow-hidden rounded-2xl [scrollbar-width:thin]',
              ANNOTATION_RAIL_SURFACE,
            )}
          >
            <div
              className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-visible py-1.5 pl-1 pr-1 text-white"
              role="toolbar"
              aria-label="Annotation tools"
            >
            <BookAnnotationToolbar
              layout="vertical"
              annotationMode={annotationMode}
              setAnnotationMode={setAnnotationMode}
              stampVariant={stampVariant}
              setStampVariant={setStampVariant}
              stampQuestionColor={stampQuestionColor}
              setStampQuestionColor={setStampQuestionColor}
              penSwatchId={penSwatchId}
              pickPenSwatch={pickPenSwatch}
              penColorSource={penColorSource}
              penCustomHex={penCustomHex}
              pickPenCustomColor={pickPenCustomColor}
              textColor={textColor}
              setTextColor={setTextColor}
              shapeStrokeSwatchId={shapeStrokeSwatchId}
              setShapeStrokeSwatchId={setShapeStrokeSwatchId}
              stickyFillColor={stickyFillColor}
              setStickyFillColor={setStickyFillColor}
              markerColor={markerColor}
              markerColorSource={markerColorSource}
              markerCustomHex={markerCustomHex}
              pickMarkerSwatchColor={pickMarkerSwatchColor}
              pickMarkerCustomColor={pickMarkerCustomColor}
              penThicknessStep={penThicknessStep}
              setPenThicknessStep={setPenThicknessStep}
              markerThicknessStep={markerThicknessStep}
              setMarkerThicknessStep={setMarkerThicknessStep}
              eraserPixelThicknessStep={eraserPixelThicknessStep}
              setEraserPixelThicknessStep={setEraserPixelThicknessStep}
              eraserLineThicknessStep={eraserLineThicknessStep}
              setEraserLineThicknessStep={setEraserLineThicknessStep}
              textVisualStyle={textVisualStyle}
              setTextVisualStyle={setTextVisualStyle}
              textFillColor={textFillColor}
              setTextFillColor={setTextFillColor}
              penLineDashStyle={penLineDashStyle}
              setPenLineDashStyle={setPenLineDashStyle}
              markerLineDashStyle={markerLineDashStyle}
              setMarkerLineDashStyle={setMarkerLineDashStyle}
              shapeLineDashStyle={shapeLineDashStyle}
              setShapeLineDashStyle={setShapeLineDashStyle}
              shapeStrokeEnabled={shapeStrokeEnabled}
              setShapeStrokeEnabled={setShapeStrokeEnabled}
              shapeFillMode={shapeFillMode}
              setShapeFillMode={setShapeFillMode}
              shapeFillColor={shapeFillColor}
              setShapeFillColor={setShapeFillColor}
              eyedropperVariant={eyedropperVariant}
              setEyedropperVariant={setEyedropperVariant}
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
              title={isWhiteboardOpen ? `Undo whiteboard (${SC.undo})` : `Undo annotation (${SC.undo})`}
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
              title={isWhiteboardOpen ? `Redo whiteboard (${SC.redo})` : `Redo annotation (${SC.redo})`}
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
              title={
                isWhiteboardOpen
                  ? `Clear whiteboard (${SC.clearPage})`
                  : `Clear all ink on this page (${SC.clearPage})`
              }
              onClick={() => setClearInkOpen(true)}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </Button>
            </div>
          </div>
          <button
            type="button"
            className={cn(
              ANNOTATION_RAIL_SURFACE,
              ANNOTATION_RAIL_HANDLE_LAYOUT,
              'absolute left-full top-1/2 z-[1] -translate-x-1 -translate-y-1/2 border-l-0 transition-colors hover:bg-white/10 hover:text-white/85',
            )}
            onClick={() => setIsAnnotationRailVisible(false)}
            aria-label="Hide annotation tools"
            title={`Hide tools (${SC.toggleTools})`}
          >
            <ChevronLeft className="h-3 w-3 shrink-0" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            ANNOTATION_RAIL_SURFACE,
            ANNOTATION_RAIL_HANDLE_LAYOUT,
            'border-l-0 transition-colors hover:bg-white/10 hover:text-white/85',
            !suppressChrome && 'pointer-events-auto',
          )}
          onClick={() => setIsAnnotationRailVisible(true)}
          aria-label="Show annotation tools"
          title={`Show tools (${SC.toggleTools})`}
        >
          <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2} />
        </button>
      )}

      <AlertDialog open={clearInkOpen} onOpenChange={setClearInkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isWhiteboardOpen ? 'Clear this whiteboard?' : clearInkSpreadPagePair ? 'Clear both open pages?' : 'Clear this page?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isWhiteboardOpen ? (
                <>
                  Remove everything on the whiteboard for page {clearTargetPage}. PDF ink on the book is not affected.
                  Undo history for this whiteboard will be cleared as well.
                </>
              ) : clearInkSpreadPagePair ? (
                <>
                  Remove all annotations on pages {clearInkSpreadPagePair.left} and {clearInkSpreadPagePair.right}.
                  Undo history for both pages will be cleared as well.
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
              {isWhiteboardOpen ? 'Clear whiteboard' : clearInkSpreadPagePair ? 'Clear both pages' : 'Clear page'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
