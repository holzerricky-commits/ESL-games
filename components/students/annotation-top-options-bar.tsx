'use client'

import { useEffect, useMemo } from 'react'
import { isBookOverlayShapeMode } from '@/lib/books/book-overlay-keyboard-shortcuts'
import type { MarqueeSelectRule } from '@/lib/books/annotation-select'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  TextAnnotationVisualStyle,
} from '@/lib/books/annotation-command-types'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import {
  TopStripEraserModeChip,
  TopStripFillModeChip,
  TopStripLineStyleChip,
  TopStripShapeLineStyleChip,
  TopStripShapeRoundedCornersChip,
  TopStripMarqueeRuleChip,
  TopStripPenAutoGroupChip,
  TopStripMarkerDecoratedEdgeChip,
  TopStripStraightStrokeChip,
  TopStripTextFontChip,
  TopStripTextStyleChip,
} from '@/components/students/annotation-top-strip-controls'
import { ThicknessSliderRow } from '@/components/students/annotation-thickness-slider-row'
import {
  ANNOTATION_ERASER_THICKNESS_PREVIEW_DOTS,
  ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS,
  ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS,
  buildFineInkThicknessPreviewDots,
} from '@/lib/books/annotation-storage'
import { TopStripColorCluster } from '@/components/students/annotation-top-strip-color-cluster'
import { CoachDictationTopStripChip } from '@/components/lesson-coach/coach-dictation-top-strip-chip'
import { useTopOptionsBarChrome } from '@/components/students/fullscreen-book-overlay/hooks/useTopOptionsBarChrome'
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import { cn } from '@/lib/utils'
import {
  filterPenSwatchesForProfile,
  penProfileWidthScaleMultiplier,
  type PenStrokeProfile,
} from '@/lib/books/pen-stroke-profile'

export interface AnnotationTopOptionsBarProps {
  hasResolvedUnit: boolean
  suppressChrome: boolean
  /** Hides the bar while a full-width overlay panel is open (page list only; not whiteboard). */
  chromePanelsOpen: boolean
  annotationMode: BookAnnotationInteractionMode
  setAnnotationMode: (m: BookAnnotationInteractionMode) => void
  penSwatchId: string
  pickPenSwatch: (id: string) => void
  penStrokeProfile: PenStrokeProfile
  penColorSource: AnnotationColorSource
  penCustomHex: string
  pickPenCustomColor: (hex: string) => void
  markerColor: string
  pickMarkerSwatchColor: (hex: string) => void
  markerColorSource: AnnotationColorSource
  markerCustomHex: string
  pickMarkerCustomColor: (hex: string) => void
  shapeStrokeSwatchId: string
  pickShapeStrokeSwatch: (id: string) => void
  penThicknessStep: AnnotationStrokeThicknessStep
  setPenThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  markerThicknessStep: AnnotationStrokeThicknessStep
  setMarkerThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  shapeThicknessStep: AnnotationStrokeThicknessStep
  setShapeThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  textThicknessStep: AnnotationStrokeThicknessStep
  setTextThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  textFontId: AnnotationTextFontId
  setTextFontId: (id: AnnotationTextFontId) => void
  stickyThicknessStep: AnnotationStrokeThicknessStep
  setStickyThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  stampThicknessStep: AnnotationStrokeThicknessStep
  setStampThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserPixelThicknessStep: AnnotationStrokeThicknessStep
  setEraserPixelThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserLineThicknessStep: AnnotationStrokeThicknessStep
  setEraserLineThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  penLineDashStyle: AnnotationLineDashStyle
  setPenLineDashStyle: (s: AnnotationLineDashStyle) => void
  markerLineDashStyle: AnnotationLineDashStyle
  setMarkerLineDashStyle: (s: AnnotationLineDashStyle) => void
  markerStraightStroke: boolean
  setMarkerStraightStroke: (v: boolean) => void
  markerDecoratedEdge: boolean
  setMarkerDecoratedEdge: (v: boolean) => void
  penAutoGroupConnected: boolean
  setPenAutoGroupConnected: (v: boolean) => void
  marqueeSelectRule: MarqueeSelectRule
  setMarqueeSelectRule: (r: MarqueeSelectRule) => void
  shapeLineDashStyle: AnnotationLineDashStyle
  setShapeLineDashStyle: (s: AnnotationLineDashStyle) => void
  shapeStrokeEnabled: boolean
  setShapeStrokeEnabled: (v: boolean) => void
  shapeFillMode: ShapeFillMode
  setShapeFillMode: (v: ShapeFillMode) => void
  shapeFillColor: string
  setShapeFillColor: (c: string) => void
  shapeRoundedCorners: boolean
  setShapeRoundedCorners: (v: boolean) => void
  textColor: string
  pickTextColor: (hex: string) => void
  textVisualStyle: TextAnnotationVisualStyle
  setTextVisualStyle: (v: TextAnnotationVisualStyle) => void
  textFillColor: string
  pickTextFillColor: (c: string) => void
  stickyFillColor: string
  pickStickyFillColor: (hex: string) => void
}

const PENINSULA_SURFACE =
  'border-x border-b border-t-0 border-white/10 rounded-b-xl bg-black/24 text-white/65 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px]'

const THICKNESS_SLOT_CLASS = 'w-[12rem] shrink-0'
const FILLED_SHAPE_MODES = new Set<string>(['rect', 'ellipse', 'triangle'])

function StripPinAffordance({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'ml-0.5 flex h-10 w-2 shrink-0 cursor-pointer items-stretch justify-center rounded-r-md border-0 bg-transparent p-0',
        'before:block before:h-6 before:w-0.5 before:rounded-full before:bg-white/25 before:transition-colors',
        'hover:before:bg-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55 focus-visible:ring-offset-0',
        pinned && 'before:bg-amber-400/70',
      )}
      aria-pressed={pinned}
      aria-label={pinned ? 'Unpin tool properties bar' : 'Pin tool properties bar'}
      title={pinned ? 'Unpin bar' : 'Pin bar'}
      onClick={onToggle}
    />
  )
}

export function AnnotationTopOptionsBar(props: AnnotationTopOptionsBarProps) {
  const {
    hasResolvedUnit,
    suppressChrome,
    chromePanelsOpen,
    annotationMode,
    setAnnotationMode,
    penSwatchId,
    pickPenSwatch,
    penStrokeProfile,
    penColorSource,
    penCustomHex,
    pickPenCustomColor,
    penThicknessStep,
    setPenThicknessStep,
    markerColor,
    pickMarkerSwatchColor,
    markerColorSource,
    markerCustomHex,
    pickMarkerCustomColor,
    shapeStrokeSwatchId,
    pickShapeStrokeSwatch,
    markerThicknessStep,
    setMarkerThicknessStep,
    shapeThicknessStep,
    setShapeThicknessStep,
    textThicknessStep,
    setTextThicknessStep,
    textFontId,
    setTextFontId,
    stickyThicknessStep,
    setStickyThicknessStep,
    stampThicknessStep,
    setStampThicknessStep,
    eraserPixelThicknessStep,
    setEraserPixelThicknessStep,
    eraserLineThicknessStep,
    setEraserLineThicknessStep,
    penLineDashStyle,
    setPenLineDashStyle,
    markerStraightStroke,
    setMarkerStraightStroke,
    markerDecoratedEdge,
    setMarkerDecoratedEdge,
    penAutoGroupConnected,
    setPenAutoGroupConnected,
    marqueeSelectRule,
    setMarqueeSelectRule,
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
    textColor,
    pickTextColor,
    textVisualStyle,
    setTextVisualStyle,
    textFillColor,
    pickTextFillColor,
    stickyFillColor,
    pickStickyFillColor,
  } = props

  const isPen = annotationMode === 'pen'
  const isMarker = annotationMode === 'marker'
  const isShape = isBookOverlayShapeMode(annotationMode)
  const isEraserRub = annotationMode === 'eraser'
  const isStamp = annotationMode === 'stamp'
  const isText = annotationMode === 'text'
  const isSticky = annotationMode === 'sticky'
  const isCallout = annotationMode === 'callout'
  const isSelect = annotationMode === 'select'
  const hasToolContent =
    isPen ||
    isMarker ||
    isShape ||
    isEraserRub ||
    isStamp ||
    isText ||
    isSticky ||
    isCallout ||
    isSelect
  const chromeEligible = hasResolvedUnit && !suppressChrome && !chromePanelsOpen && hasToolContent
  const isFilledShape = FILLED_SHAPE_MODES.has(annotationMode)

  const penThicknessPreviewDots = useMemo(
    () => buildFineInkThicknessPreviewDots(penProfileWidthScaleMultiplier(penStrokeProfile)),
    [penStrokeProfile],
  )

  const {
    pinned,
    revealed,
    setEdgeHover,
    setBarHover,
    setInteracting,
    bumpActivity,
    togglePinned,
    pinnedHydrated,
    paletteOpen,
    setPaletteOpen,
  } = useTopOptionsBarChrome(chromeEligible)

  useEffect(() => {
    if (chromeEligible) bumpActivity()
  }, [chromeEligible, annotationMode, bumpActivity])

  useEffect(() => {
    setPaletteOpen(false)
  }, [annotationMode, setPaletteOpen])

  const penSwatchesForProfile = useMemo(
    () => filterPenSwatchesForProfile(penStrokeProfile),
    [penStrokeProfile],
  )

  const paletteDropdown = useMemo(
    () => ({
      penSwatchId,
      pickPenSwatch,
      penStrokeProfile,
      penSwatchesForProfile,
      penColorSource,
      penCustomHex,
      pickPenCustomColor,
      markerColor,
      pickMarkerSwatchColor,
      markerColorSource,
      markerCustomHex,
      pickMarkerCustomColor,
      shapeStrokeSwatchId,
      pickShapeStrokeSwatch,
      textColor,
      pickTextColor,
      textFillColor,
      pickTextFillColor,
      textVisualStyle,
      stickyFillColor,
      pickStickyFillColor,
      shapeFillColor,
      pickShapeFillColor: setShapeFillColor,
      shapeFillMode,
    }),
    [
      penSwatchId,
      pickPenSwatch,
      penStrokeProfile,
      penSwatchesForProfile,
      penColorSource,
      penCustomHex,
      pickPenCustomColor,
      markerColor,
      pickMarkerSwatchColor,
      markerColorSource,
      markerCustomHex,
      pickMarkerCustomColor,
      shapeStrokeSwatchId,
      pickShapeStrokeSwatch,
      textColor,
      pickTextColor,
      textFillColor,
      pickTextFillColor,
      textVisualStyle,
      stickyFillColor,
      pickStickyFillColor,
      shapeFillColor,
      setShapeFillColor,
      shapeFillMode,
    ],
  )

  if (!chromeEligible || !pinnedHydrated) {
    return null
  }

  const stripPointerHandlers = {
    onPointerEnter: () => {
      setBarHover(true)
      bumpActivity()
    },
    onPointerLeave: () => setBarHover(false),
    onPointerDown: () => {
      setInteracting(true)
      bumpActivity()
    },
    onPointerUp: () => setInteracting(false),
    onPointerCancel: () => setInteracting(false),
  }

  return (
    <>
      {!pinned ? (
        <div
          className="pointer-events-auto absolute inset-x-0 top-0 z-[64] h-3"
          aria-hidden
          onPointerEnter={() => {
            setEdgeHover(true)
            bumpActivity()
          }}
          onPointerLeave={() => setEdgeHover(false)}
        />
      ) : null}

      {!revealed && !pinned ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[64] h-px bg-white/20"
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-[65] overflow-hidden',
          suppressChrome && 'invisible opacity-0',
        )}
        aria-hidden={suppressChrome}
      >
        <div
          className={cn(
            'mx-auto w-max max-w-[min(100%,calc(100vw-2rem))] transition-transform duration-300 ease-out motion-reduce:transition-none',
            revealed ? 'pointer-events-auto translate-y-0' : 'pointer-events-none -translate-y-full',
          )}
          {...stripPointerHandlers}
        >
          <div
            className={cn(
              PENINSULA_SURFACE,
              'pointer-events-auto inline-flex h-10 max-w-full flex-nowrap items-center gap-3 py-1.5 pl-3 pr-1',
              revealed ? '' : 'motion-reduce:opacity-0',
            )}
            role="region"
            aria-label="Tool properties"
          >
            {isPen ? (
              <TopStripColorCluster
                kind="pen"
                idPrefix="top-pen"
                activeValue={penSwatchId}
                penStrokeProfile={penStrokeProfile}
                colorSource={penColorSource}
                customHex={penCustomHex}
                paletteTarget="pen"
                paletteDropdown={paletteDropdown}
                paletteOpen={paletteOpen}
                onPaletteOpenChange={setPaletteOpen}
                onPick={(id) => {
                  pickPenSwatch(id)
                  bumpActivity()
                }}
              />
            ) : null}
            {isMarker ? (
              <TopStripColorCluster
                kind="marker"
                idPrefix="top-marker"
                activeValue={markerColor}
                colorSource={markerColorSource}
                customHex={markerCustomHex}
                paletteTarget="marker"
                paletteDropdown={paletteDropdown}
                paletteOpen={paletteOpen}
                onPaletteOpenChange={setPaletteOpen}
                onPick={(hex) => {
                  pickMarkerSwatchColor(hex)
                  bumpActivity()
                }}
              />
            ) : null}
            {isShape || isCallout ? (
              <TopStripColorCluster
                kind="shape"
                idPrefix={isCallout ? 'top-callout' : 'top-shape-stroke'}
                activeValue={shapeStrokeSwatchId}
                paletteTarget="shapes"
                paletteDropdown={paletteDropdown}
                paletteOpen={paletteOpen}
                onPaletteOpenChange={setPaletteOpen}
                onPick={(id) => {
                  pickShapeStrokeSwatch(id)
                  bumpActivity()
                }}
              />
            ) : null}
            {isText ? (
              <TopStripColorCluster
                kind="text"
                idPrefix="top-text"
                activeValue={textColor}
                paletteTarget="text"
                paletteDropdown={paletteDropdown}
                paletteOpen={paletteOpen}
                onPaletteOpenChange={setPaletteOpen}
                onPick={(hex) => {
                  pickTextColor(hex)
                  bumpActivity()
                }}
              />
            ) : null}
            {isSticky ? (
              <TopStripColorCluster
                kind="sticky"
                idPrefix="top-sticky"
                activeValue={stickyFillColor}
                paletteTarget="sticky"
                paletteDropdown={paletteDropdown}
                paletteOpen={paletteOpen}
                onPaletteOpenChange={setPaletteOpen}
                onPick={(hex) => {
                  pickStickyFillColor(hex)
                  bumpActivity()
                }}
              />
            ) : null}
            <div className="flex shrink-0 items-center gap-1">
              {isPen ? (
                <>
                  <TopStripLineStyleChip
                    value={penLineDashStyle}
                    onChange={(s) => {
                      setPenLineDashStyle(s)
                      bumpActivity()
                    }}
                    idPrefix="top-pen"
                  />
                  <TopStripPenAutoGroupChip
                    active={penAutoGroupConnected}
                    onChange={(v) => {
                      setPenAutoGroupConnected(v)
                      bumpActivity()
                    }}
                    idPrefix="top-pen"
                  />
                </>
              ) : null}
              {isMarker ? (
                <>
                  <TopStripStraightStrokeChip
                    active={markerStraightStroke}
                    onChange={(v) => {
                      setMarkerStraightStroke(v)
                      bumpActivity()
                    }}
                    idPrefix="top-marker"
                  />
                  <TopStripMarkerDecoratedEdgeChip
                    active={markerDecoratedEdge}
                    onChange={(v) => {
                      setMarkerDecoratedEdge(v)
                      bumpActivity()
                    }}
                    idPrefix="top-marker"
                  />
                </>
              ) : null}
              {isSelect ? (
                <TopStripMarqueeRuleChip
                  rule={marqueeSelectRule}
                  onChange={(r) => {
                    setMarqueeSelectRule(r)
                    bumpActivity()
                  }}
                  idPrefix="top-select"
                />
              ) : null}
              {isShape ? (
                <>
                  {isFilledShape ? (
                    <>
                      <TopStripShapeLineStyleChip
                        strokeEnabled={shapeStrokeEnabled}
                        lineDashStyle={shapeLineDashStyle}
                        onStrokeEnabledChange={(v) => {
                          setShapeStrokeEnabled(v)
                          bumpActivity()
                        }}
                        onLineDashStyleChange={(s) => {
                          setShapeLineDashStyle(s)
                          bumpActivity()
                        }}
                        fillMode={shapeFillMode}
                        onFillModeChange={(m) => {
                          setShapeFillMode(m)
                          bumpActivity()
                        }}
                        idPrefix="top-shape"
                      />
                      <TopStripFillModeChip
                        fillMode={shapeFillMode}
                        onChange={(m) => {
                          setShapeFillMode(m)
                          bumpActivity()
                        }}
                        idPrefix="top-shape"
                      />
                      <TopStripShapeRoundedCornersChip
                        active={shapeRoundedCorners}
                        onChange={(v) => {
                          setShapeRoundedCorners(v)
                          bumpActivity()
                        }}
                        idPrefix="top-shape"
                      />
                    </>
                  ) : (
                    <TopStripLineStyleChip
                      value={shapeLineDashStyle}
                      onChange={(s) => {
                        setShapeLineDashStyle(s)
                        bumpActivity()
                      }}
                      idPrefix="top-shape"
                    />
                  )}
                </>
              ) : null}
              {isEraserRub ? (
                <TopStripEraserModeChip
                  mode="eraser"
                  onChange={(m) => {
                    setAnnotationMode(m)
                    bumpActivity()
                  }}
                  idPrefix="top-eraser"
                />
              ) : null}
              {isText || isSticky ? (
                <TopStripTextFontChip
                  value={textFontId}
                  onChange={(id) => {
                    setTextFontId(id)
                    bumpActivity()
                  }}
                  idPrefix={isText ? 'top-text' : 'top-sticky'}
                />
              ) : null}
              {isText ? (
                <>
                  <CoachDictationTopStripChip idPrefix="top-text" />
                  <TopStripTextStyleChip
                    style={textVisualStyle}
                    onChange={(s) => {
                      setTextVisualStyle(s)
                      bumpActivity()
                    }}
                    idPrefix="top-text"
                  />
                </>
              ) : null}
            </div>

            <div className={THICKNESS_SLOT_CLASS}>
              {isPen ? (
                <ThicknessSliderRow
                  value={penThicknessStep}
                  onChange={(s) => {
                    setPenThicknessStep(s)
                    bumpActivity()
                  }}
                  idPrefix="top-pen"
                  previewDots={penThicknessPreviewDots}
                  ariaLabel="Pen thickness"
                  compact
                />
              ) : null}
              {isMarker ? (
                <ThicknessSliderRow
                  value={markerThicknessStep}
                  onChange={(s) => {
                    setMarkerThicknessStep(s)
                    bumpActivity()
                  }}
                  idPrefix="top-marker"
                  previewDots={ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS}
                  ariaLabel="Highlighter thickness"
                  compact
                />
              ) : null}
              {isShape ? (
                <ThicknessSliderRow
                  value={shapeThicknessStep}
                  onChange={(s) => {
                    setShapeThicknessStep(s)
                    bumpActivity()
                  }}
                  idPrefix="top-shape"
                  previewDots={ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS}
                  ariaLabel="Shape stroke width"
                  compact
                />
              ) : null}
              {isStamp ? (
                <ThicknessSliderRow
                  value={stampThicknessStep}
                  onChange={(s) => {
                    setStampThicknessStep(s)
                    bumpActivity()
                  }}
                  idPrefix="top-stamp"
                  previewDots={ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS}
                  ariaLabel="Stamp size"
                  compact
                />
              ) : null}
              {isText ? (
                <ThicknessSliderRow
                  value={textThicknessStep}
                  onChange={(s) => {
                    setTextThicknessStep(s)
                    bumpActivity()
                  }}
                  idPrefix="top-text"
                  ariaLabel="Text size"
                  compact
                />
              ) : null}
              {isSticky ? (
                <ThicknessSliderRow
                  value={stickyThicknessStep}
                  onChange={(s) => {
                    setStickyThicknessStep(s)
                    bumpActivity()
                  }}
                  idPrefix="top-sticky"
                  ariaLabel="Note text size"
                  compact
                />
              ) : null}
              {isEraserRub ? (
                <ThicknessSliderRow
                  value={eraserPixelThicknessStep}
                  onChange={(s) => {
                    setEraserPixelThicknessStep(s)
                    bumpActivity()
                  }}
                  idPrefix="top-eraser"
                  previewDots={ANNOTATION_ERASER_THICKNESS_PREVIEW_DOTS}
                  ariaLabel="Eraser thickness"
                  compact
                />
              ) : null}
            </div>

            <StripPinAffordance pinned={pinned} onToggle={togglePinned} />
          </div>
        </div>
      </div>
    </>
  )
}
