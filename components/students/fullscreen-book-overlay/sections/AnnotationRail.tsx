import type { CSSProperties, MutableRefObject } from 'react'
import { useState } from 'react'
import { Pin } from 'lucide-react'
import { BookAnnotationToolbar } from '@/components/students/book-annotation-toolbar'
import { cn } from '@/lib/utils'
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
import { ANNOTATION_RAIL_SLIDE_MS, useAnnotationRailHoverChrome } from '@/components/students/fullscreen-book-overlay/hooks/useAnnotationRailHoverChrome'
import {
  FloatingSideToolbar,
  FLOATING_SIDE_TOOLBAR_BUTTON,
  FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE,
} from '@/components/students/fullscreen-book-overlay/FloatingSideToolbar'
import type { MarqueeSelectRule } from '@/lib/books/annotation-select'
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'

function AnnotationRailHandle({
  revealed,
  onPointerEnter,
  onPointerLeave,
  onActivate,
}: {
  revealed: boolean
  onPointerEnter: () => void
  onPointerLeave: () => void
  onActivate: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'annotation-rail-handle pointer-events-auto absolute top-1/2 right-0 z-[2] -translate-y-1/2 border-0 p-0',
        revealed && 'annotation-rail-handle--revealed',
      )}
      aria-label="Show annotation tools"
      aria-expanded={revealed}
      title="Annotation tools"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={onActivate}
    />
  )
}

/** Footer chrome — keep-open control, intentionally not a tool button. */
function RailPinAffordance({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={cn('annotation-rail-pin', pinned && 'annotation-rail-pin--pinned')}
      aria-pressed={pinned}
      aria-label={pinned ? 'Unpin annotation tools' : 'Keep annotation tools open'}
      title={pinned ? 'Unpin tools (allow hide)' : 'Keep tools open'}
      onClick={onToggle}
    >
      <span className="annotation-rail-pin__grip" aria-hidden />
      <Pin className="annotation-rail-pin__icon" strokeWidth={2.25} aria-hidden />
    </button>
  )
}

interface AnnotationRailProps {
  hasResolvedUnit: boolean
  numPages: number | null
  selectedBookId: string | null
  suppressChrome: boolean
  isAnnotationRailPinned: boolean
  setIsAnnotationRailPinned: (pinned: boolean) => void
  annotationRailPinHydrated: boolean
  annotationRailKeyboardDismissAt?: number
  annotationRailKeyboardOpenAt?: number
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
  stampEffectsEnabled: boolean
  setStampEffectsEnabled: (enabled: boolean) => void
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
  textAlign: import('@/lib/books/annotation-command-types').TextAnnotationAlign
  setTextAlign: (v: import('@/lib/books/annotation-command-types').TextAnnotationAlign) => void
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
  marqueeSelectRule: MarqueeSelectRule
  setMarqueeSelectRule: (r: MarqueeSelectRule) => void
  textFontId: AnnotationTextFontId
  setTextFontId: (id: AnnotationTextFontId) => void
  pickTextColor: (hex: string) => void
  pickTextFillColor: (hex: string) => void
  pickStickyFillColor: (hex: string) => void
  textSelectionActive?: boolean
  stickySelectionActive?: boolean
  shapeSelectionActive?: boolean
  penStrokeSelectionActive?: boolean
  markerStrokeSelectionActive?: boolean
  bookTextSpreadHasSelectable?: boolean
  bookTextCapabilityPending?: boolean
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
  pageCanvasHeightPx?: number
  isWhiteboardOpen: boolean
  registerToolSettingsCloseRef?: MutableRefObject<(() => void) | null>
}

export function AnnotationRail({
  hasResolvedUnit,
  numPages,
  selectedBookId,
  suppressChrome,
  isAnnotationRailPinned,
  setIsAnnotationRailPinned,
  annotationRailPinHydrated,
  annotationRailKeyboardDismissAt = 0,
  annotationRailKeyboardOpenAt = 0,
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
  stampEffectsEnabled,
  setStampEffectsEnabled,
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
  textAlign,
  setTextAlign,
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
  marqueeSelectRule,
  setMarqueeSelectRule,
  textFontId,
  setTextFontId,
  pickTextColor,
  pickTextFillColor,
  pickStickyFillColor,
  textSelectionActive = false,
  stickySelectionActive = false,
  shapeSelectionActive = false,
  penStrokeSelectionActive = false,
  markerStrokeSelectionActive = false,
  bookTextSpreadHasSelectable = false,
  bookTextCapabilityPending = false,
  shapeLineDashStyle,
  setShapeLineDashStyle,
  shapeStrokeEnabled,
  setShapeStrokeEnabled,
  shapeFillMode,
  setShapeFillMode,
  shapeFillColor,
  setShapeFillColor,
  shapeRoundedCorners,
  setShapeRoundedCorners,
  eyedropperVariant,
  setEyedropperVariant,
  pageCanvasHeightPx,
  isWhiteboardOpen,
  registerToolSettingsCloseRef,
}: AnnotationRailProps) {
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)

  const {
    revealed,
    pinned,
    revealRail,
    togglePinned,
    onEdgePointerEnter,
    onEdgePointerLeave,
    onClusterPointerEnter,
    onClusterPointerLeave,
    onClusterPointerDown,
  } = useAnnotationRailHoverChrome({
    enabled: !suppressChrome && hasResolvedUnit && numPages != null && !!selectedBookId,
    setVisible: setIsAnnotationRailVisible,
    pinned: isAnnotationRailPinned,
    setPinned: setIsAnnotationRailPinned,
    pinHydrated: annotationRailPinHydrated,
    keyboardDismissAt: annotationRailKeyboardDismissAt,
    keyboardOpenAt: annotationRailKeyboardOpenAt,
    externalHoldOpen: settingsPanelOpen,
  })

  if (!hasResolvedUnit || numPages == null || !selectedBookId) return null

  return (
    <>
      {!pinned && !suppressChrome ? (
        <div
          className="pointer-events-auto fixed top-0 right-0 z-[27] h-full w-3"
          aria-hidden
          onPointerEnter={onEdgePointerEnter}
          onPointerLeave={onEdgePointerLeave}
        />
      ) : null}

      <div
        className={cn(
          'pointer-events-none fixed right-0 top-1/2 z-[28] -translate-y-1/2 transform-gpu',
          suppressChrome && 'invisible opacity-0',
        )}
      >
        {!pinned && !suppressChrome ? (
          <AnnotationRailHandle
            revealed={revealed}
            onPointerEnter={onEdgePointerEnter}
            onPointerLeave={onEdgePointerLeave}
            onActivate={revealRail}
          />
        ) : null}
        <div className="relative size-0">
      <div
        className={cn(
          'annotation-rail-slide-panel absolute top-1/2 right-0 z-[1] -translate-y-1/2',
          revealed && 'annotation-rail-slide-panel--revealed',
          revealed
            ? 'pointer-events-auto -translate-x-4 opacity-100'
            : 'pointer-events-none translate-x-full opacity-0',
        )}
        style={{ '--annotation-rail-slide-ms': `${ANNOTATION_RAIL_SLIDE_MS}ms` } as CSSProperties}
        onPointerEnter={!suppressChrome ? onClusterPointerEnter : undefined}
        onPointerLeave={!suppressChrome ? onClusterPointerLeave : undefined}
        onPointerDown={!suppressChrome ? onClusterPointerDown : undefined}
        aria-hidden={!revealed}
      >
        <FloatingSideToolbar
            hidden={suppressChrome}
            fixed={false}
            className="annotation-rail-toolbar relative z-[1]"
            aria-label="Annotation tools"
          >
            <div className="annotation-rail-toolbar__tools">
            <BookAnnotationToolbar
              layout="vertical"
              useContextStrip
              toolButtonClassName={FLOATING_SIDE_TOOLBAR_BUTTON}
              toolButtonActiveClassName={FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE}
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
              stampEffectsEnabled={stampEffectsEnabled}
              setStampEffectsEnabled={setStampEffectsEnabled}
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
              textAlign={textAlign}
              setTextAlign={setTextAlign}
              textFontId={textFontId}
              setTextFontId={setTextFontId}
              textFillColor={textFillColor}
              setTextFillColor={setTextFillColor}
              textPageHeightPx={pageCanvasHeightPx}
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
              shapeRoundedCorners={shapeRoundedCorners}
              setShapeRoundedCorners={setShapeRoundedCorners}
              penAutoGroupConnected={penAutoGroupConnected}
              setPenAutoGroupConnected={setPenAutoGroupConnected}
              marqueeSelectRule={marqueeSelectRule}
              setMarqueeSelectRule={setMarqueeSelectRule}
              textSelectionActive={textSelectionActive}
              stickySelectionActive={stickySelectionActive}
              shapeSelectionActive={shapeSelectionActive}
              penStrokeSelectionActive={penStrokeSelectionActive}
              markerStrokeSelectionActive={markerStrokeSelectionActive}
              bookTextSpreadHasSelectable={bookTextSpreadHasSelectable}
              bookTextCapabilityPending={bookTextCapabilityPending}
              onSettingsPanelOpenChange={setSettingsPanelOpen}
              registerToolSettingsCloseRef={registerToolSettingsCloseRef}
              eyedropperVariant={eyedropperVariant}
              setEyedropperVariant={setEyedropperVariant}
              isWhiteboardOpen={isWhiteboardOpen}
            />
            </div>
            <RailPinAffordance pinned={pinned} onToggle={togglePinned} />
          </FloatingSideToolbar>
      </div>
      </div>
    </div>
    </>
  )
}
