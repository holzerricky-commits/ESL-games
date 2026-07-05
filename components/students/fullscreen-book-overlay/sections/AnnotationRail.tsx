import type { RefObject } from 'react'
import { ChevronLeft, ChevronRight, Languages, Presentation, Redo2, Smartphone, Trash2, Undo2 } from 'lucide-react'
import { BookAnnotationToolbar } from '@/components/students/book-annotation-toolbar'
import { BookCaptureMenu } from '@/components/students/book-capture-menu'
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
  WritableStickerVariant,
} from '@/lib/books/annotation-command-types'
import type { StickerKind } from '@/lib/books/sticker-tool'
import type { EyedropperVariant } from '@/lib/books/eyedropper-variant'
import type { BookCaptureFormat } from '@/lib/books/book-capture'
import type { BookLibraryPayload } from '@/lib/books/types'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import { BOOK_OVERLAY_GLASS_CHROME } from '@/components/students/fullscreen-book-overlay/constants'

type AnnotationCapabilities = { canUndo: boolean; canRedo: boolean }

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
  stickerKind: StickerKind
  setStickerKind: (k: StickerKind) => void
  writableStickerVariant: WritableStickerVariant
  setWritableStickerVariant: (v: WritableStickerVariant) => void
  stampQuestionColor: string
  setStampQuestionColor: (c: string) => void
  penSwatchId: string
  pickPenSwatch: (id: string) => void
  penStrokeProfile: import('@/lib/books/pen-stroke-profile').PenStrokeProfile
  setPenStrokeProfile: (profile: import('@/lib/books/pen-stroke-profile').PenStrokeProfile) => void
  penColorSource: AnnotationColorSource
  penCustomHex: string
  pickPenCustomColor: (hex: string) => void
  textColor: string
  setTextColor: (v: string) => void
  shapeStrokeSwatchId: string
  pickShapeStrokeSwatch: (v: string) => void
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
  shapeThicknessStep: AnnotationStrokeThicknessStep
  setShapeThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  textThicknessStep: AnnotationStrokeThicknessStep
  setTextThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  stickyThicknessStep: AnnotationStrokeThicknessStep
  setStickyThicknessStep: (v: AnnotationStrokeThicknessStep) => void
  stampThicknessStep: AnnotationStrokeThicknessStep
  setStampThicknessStep: (v: AnnotationStrokeThicknessStep) => void
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
  markerStraightStroke: boolean
  setMarkerStraightStroke: (v: boolean) => void
  markerDecoratedEdge: boolean
  setMarkerDecoratedEdge: (v: boolean) => void
  penAutoGroupConnected: boolean
  setPenAutoGroupConnected: (v: boolean) => void
  shapeLineDashStyle: AnnotationLineDashStyle
  setShapeLineDashStyle: (v: AnnotationLineDashStyle) => void
  shapeStrokeEnabled: boolean
  setShapeStrokeEnabled: (v: boolean) => void
  shapeFillMode: ShapeFillMode
  setShapeFillMode: (v: ShapeFillMode) => void
  shapeFillColor: string
  setShapeFillColor: (v: string) => void
  shapeRoundedCorners: boolean
  setShapeRoundedCorners: (v: boolean) => void
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
  isWhiteboardSessionOpen: boolean
  isWhiteboardMinimized: boolean
  onWhiteboardRailClick: () => void
  whiteboardToolbarButtonRef: RefObject<HTMLButtonElement | null>
  getActiveAnnotationRef: () => { current: { undo: () => void; redo: () => void; clear: () => void } | null }
  translateDockOpen: boolean
  onTranslateDockToggle: () => void
  onOpenCoachDialog: () => void
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
  stickerKind,
  setStickerKind,
  writableStickerVariant,
  setWritableStickerVariant,
  stampQuestionColor,
  setStampQuestionColor,
  penSwatchId,
  pickPenSwatch,
  penStrokeProfile,
  setPenStrokeProfile,
  penColorSource,
  penCustomHex,
  pickPenCustomColor,
  textColor,
  setTextColor,
  shapeStrokeSwatchId,
  pickShapeStrokeSwatch,
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
  shapeThicknessStep,
  setShapeThicknessStep,
  textThicknessStep,
  setTextThicknessStep,
  stickyThicknessStep,
  setStickyThicknessStep,
  stampThicknessStep,
  setStampThicknessStep,
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
  markerStraightStroke,
  setMarkerStraightStroke,
  markerDecoratedEdge,
  setMarkerDecoratedEdge,
  penAutoGroupConnected,
  setPenAutoGroupConnected,
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
  isWhiteboardSessionOpen,
  isWhiteboardMinimized,
  onWhiteboardRailClick,
  whiteboardToolbarButtonRef,
  getActiveAnnotationRef,
  translateDockOpen,
  onTranslateDockToggle,
  onOpenCoachDialog,
}: AnnotationRailProps) {
  if (!hasResolvedUnit || numPages == null || !selectedBookId) return null

  return (
    <div
      className={cn(
        /* Positioned by BookOverlayLeftChrome; only chrome re-enables pointer events. */
        'pointer-events-none flex items-center',
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
              'flex max-h-[calc(100vh-210px)] w-max flex-col overflow-hidden rounded-2xl [scrollbar-width:thin]',
              BOOK_OVERLAY_GLASS_CHROME,
            )}
          >
            <div
              className="flex w-max flex-col items-center gap-1 overflow-y-auto overflow-x-visible py-1.5 pl-1 pr-1 text-white"
              role="toolbar"
              aria-label="Annotation tools"
            >
            <BookAnnotationToolbar
              layout="vertical"
              useContextStrip
              annotationMode={annotationMode}
              setAnnotationMode={setAnnotationMode}
              stampVariant={stampVariant}
              setStampVariant={setStampVariant}
              stickerKind={stickerKind}
              setStickerKind={setStickerKind}
              writableStickerVariant={writableStickerVariant}
              setWritableStickerVariant={setWritableStickerVariant}
              stampQuestionColor={stampQuestionColor}
              setStampQuestionColor={setStampQuestionColor}
              penSwatchId={penSwatchId}
              pickPenSwatch={pickPenSwatch}
              penStrokeProfile={penStrokeProfile}
              setPenStrokeProfile={setPenStrokeProfile}
              penColorSource={penColorSource}
              penCustomHex={penCustomHex}
              pickPenCustomColor={pickPenCustomColor}
              textColor={textColor}
              setTextColor={setTextColor}
              shapeStrokeSwatchId={shapeStrokeSwatchId}
              pickShapeStrokeSwatch={pickShapeStrokeSwatch}
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
              shapeThicknessStep={shapeThicknessStep}
              setShapeThicknessStep={setShapeThicknessStep}
              textThicknessStep={textThicknessStep}
              setTextThicknessStep={setTextThicknessStep}
              stickyThicknessStep={stickyThicknessStep}
              setStickyThicknessStep={setStickyThicknessStep}
              stampThicknessStep={stampThicknessStep}
              setStampThicknessStep={setStampThicknessStep}
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
              markerStraightStroke={markerStraightStroke}
              setMarkerStraightStroke={setMarkerStraightStroke}
              markerDecoratedEdge={markerDecoratedEdge}
              setMarkerDecoratedEdge={setMarkerDecoratedEdge}
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
              ref={whiteboardToolbarButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15',
                isWhiteboardOpen && 'bg-white/20 ring-1 ring-white/25',
                isWhiteboardMinimized && 'bg-white/12 ring-1 ring-white/20',
              )}
              aria-label={
                !isWhiteboardSessionOpen
                  ? 'Open lesson board'
                  : isWhiteboardMinimized
                    ? 'Restore lesson board'
                    : 'Minimize lesson board'
              }
              aria-pressed={isWhiteboardSessionOpen}
              title={
                !isWhiteboardSessionOpen
                  ? `Lesson board (${SC.whiteboard})`
                  : isWhiteboardMinimized
                    ? `Restore lesson board (${SC.whiteboard})`
                    : `Minimize lesson board (${SC.whiteboard})`
              }
              onClick={onWhiteboardRailClick}
            >
              <Presentation className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Button>
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
              onClick={() => getActiveAnnotationRef().current?.clear()}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </Button>
            <span className="my-1 h-px w-7 shrink-0 bg-white/20" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15',
                translateDockOpen && 'bg-white/20 ring-1 ring-white/25',
              )}
              aria-label={translateDockOpen ? 'Close translate dock' : 'Open translate dock'}
              aria-pressed={translateDockOpen}
              title={`Translate to Chinese (${SC.translate})`}
              onClick={onTranslateDockToggle}
            >
              <Languages className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15"
              aria-label="Open teacher coach on phone"
              title="Coach on phone (same Wi‑Fi)"
              onClick={onOpenCoachDialog}
            >
              <Smartphone className="h-4 w-4" strokeWidth={2} />
            </Button>
            </div>
          </div>
          <button
            type="button"
            className={cn(
              BOOK_OVERLAY_GLASS_CHROME,
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
            BOOK_OVERLAY_GLASS_CHROME,
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
    </div>
  )
}
