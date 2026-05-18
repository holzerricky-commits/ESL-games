'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Check,
  Circle,
  Eraser,
  Heart,
  Highlighter,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pipette,
  Pencil,
  Sparkles,
  Square,
  Star,
  StickyNote,
  Triangle,
  Type,
  X,
} from 'lucide-react'
import { ToolbarIcon, TOOLBAR_ICON_CLASS } from '@/components/students/annotation-toolbar-icon'
import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_STAMP_QUESTION_SWATCHES,
  ANNOTATION_STICKY_FILL_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
  ANNOTATION_TEXT_STROKE_SWATCHES,
  STAMP_COLOR_CHECK,
  STAMP_COLOR_CROSS,
  STAMP_COLOR_HEART,
  STAMP_COLOR_STAR,
  getPenSwatch,
} from '@/lib/books/annotation-palettes'
import {
  LineDashStyleIconRow,
  PopoverHint,
  PopoverIconGridRow,
  PopoverIconSegmentRow,
  ShapeFillIconRow,
  ShapeLineStyleIconRow,
  popoverStackClass,
} from '@/components/students/annotation-popover-controls'
import {
  ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS,
  ThicknessSliderRow,
} from '@/components/students/annotation-thickness-slider-row'
import { SpectrumColorPicker } from '@/components/students/annotation-spectrum-picker'
import { ColorSwatchRow, PenSwatchRow } from '@/components/students/annotation-swatch-picker'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import { ANNOTATION_PEN_THICKNESS_PREVIEW_DOTS } from '@/lib/books/annotation-storage'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  TextAnnotationVisualStyle,
} from '@/lib/books/annotation-command-types'
import { shapeFillModeHasFill } from '@/lib/books/annotation-command-types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import {
  EYEDROPPER_VARIANT_LABEL,
  type EyedropperVariant,
} from '@/lib/books/eyedropper-variant'

const SHAPE_TOOLBAR_MODES = ['line', 'rect', 'ellipse', 'triangle', 'arrow'] as const
type ShapeToolbarMode = (typeof SHAPE_TOOLBAR_MODES)[number]

const SHAPE_LABEL: Record<ShapeToolbarMode, string> = {
  line: 'Line',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  arrow: 'Arrow',
}

const STAMP_LABEL: Record<StampVariant, string> = {
  check: 'Check',
  cross: 'Cross',
  question: 'Question',
  star: 'Star',
  heart: 'Heart',
}

function StampQuestionMarkIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <text
        x="9"
        y="12.5"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        ?
      </text>
    </svg>
  )
}

function shapeIconForMode(mode: ShapeToolbarMode): typeof Minus {
  if (mode === 'line') return Minus
  if (mode === 'rect') return Square
  if (mode === 'ellipse') return Circle
  if (mode === 'triangle') return Triangle
  return MoveUpRight
}

/** Pixel/rub eraser – pen stylus with round nib. */
function SmartEyedropperIcon() {
  return (
    <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
      <Pipette className={iconCls} strokeWidth={1.75} aria-hidden />
      <Sparkles className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-amber-400" aria-hidden />
    </span>
  )
}

function PenEraserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-[#e8dcc4]">
      <path
        d="M5.5 14.5 L12.5 7.5 L14 9 L7 16 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="5" cy="14.5" r="2.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

function TextWithBackgroundIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="text-[#e8dcc4]">
      <rect x="2" y="5" width="14" height="9" rx="1" fill="currentColor" opacity="0.4" />
      <text x="9" y="12.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">
        T
      </text>
    </svg>
  )
}

const iconCls = TOOLBAR_ICON_CLASS

const SHAPE_ICON_OPTIONS = SHAPE_TOOLBAR_MODES.map((mode) => ({
  value: mode,
  ariaLabel: SHAPE_LABEL[mode],
  icon: (() => {
    const Icon = shapeIconForMode(mode)
    return <Icon className={iconCls} strokeWidth={1.75} aria-hidden />
  })(),
}))

function stampIconForVariant(variant: StampVariant, questionColor: string): ReactNode {
  if (variant === 'check') {
    return <Check className={iconCls} strokeWidth={2} style={{ color: STAMP_COLOR_CHECK }} aria-hidden />
  }
  if (variant === 'cross') {
    return <X className={iconCls} strokeWidth={2} style={{ color: STAMP_COLOR_CROSS }} aria-hidden />
  }
  if (variant === 'question') {
    return <StampQuestionMarkIcon color={questionColor} />
  }
  if (variant === 'star') {
    return <Star className={iconCls} strokeWidth={1.75} style={{ color: STAMP_COLOR_STAR }} aria-hidden />
  }
  return <Heart className={iconCls} strokeWidth={1.75} style={{ color: STAMP_COLOR_HEART }} aria-hidden />
}

const STAMP_ICON_OPTIONS: { value: StampVariant; ariaLabel: string; icon: ReactNode }[] = [
  { value: 'check', ariaLabel: 'Check', icon: stampIconForVariant('check', '') },
  { value: 'cross', ariaLabel: 'Cross', icon: stampIconForVariant('cross', '') },
  {
    value: 'question',
    ariaLabel: 'Question',
    icon: stampIconForVariant('question', '#c4b5a8'),
  },
  { value: 'star', ariaLabel: 'Star', icon: stampIconForVariant('star', '') },
  { value: 'heart', ariaLabel: 'Heart', icon: stampIconForVariant('heart', '') },
]

export interface BookAnnotationToolbarProps {
  annotationMode: BookAnnotationInteractionMode
  setAnnotationMode: (m: BookAnnotationInteractionMode) => void
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
  setTextColor: (c: string) => void
  shapeStrokeSwatchId: string
  setShapeStrokeSwatchId: (id: string) => void
  stickyFillColor: string
  setStickyFillColor: (c: string) => void
  markerColor: string
  markerColorSource: AnnotationColorSource
  markerCustomHex: string
  pickMarkerSwatchColor: (hex: string) => void
  pickMarkerCustomColor: (hex: string) => void
  penThicknessStep: AnnotationStrokeThicknessStep
  setPenThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  markerThicknessStep: AnnotationStrokeThicknessStep
  setMarkerThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserPixelThicknessStep: AnnotationStrokeThicknessStep
  setEraserPixelThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserLineThicknessStep: AnnotationStrokeThicknessStep
  setEraserLineThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  textVisualStyle: TextAnnotationVisualStyle
  setTextVisualStyle: (v: TextAnnotationVisualStyle) => void
  textFillColor: string
  setTextFillColor: (c: string) => void
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
  setShapeFillColor: (c: string) => void
  eyedropperVariant: EyedropperVariant
  setEyedropperVariant: (v: EyedropperVariant) => void
  layout?: 'horizontal' | 'vertical'
}

const popoverContentClass =
  'w-[min(24rem,calc(100vw-2rem))] border-[#3d2a1a]/45 bg-[#1a1512] p-3.5 text-[#faf6ef] shadow-xl z-[80]'

const eraserPopoverCompactClass =
  'w-auto border-[#3d2a1a]/45 bg-[#1a1512] p-2 text-[#faf6ef] shadow-xl z-[80]'

const eyedropperPopoverClass =
  'w-auto border-[#3d2a1a]/45 bg-[#1a1512] p-2 text-[#faf6ef] shadow-xl z-[80]'

const EYEDROPPER_LONG_PRESS_MS = 450

const toolBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center overflow-visible rounded-full border border-white/14 bg-black/50 shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65'

const toolBtnActiveClass = 'ring-2 ring-amber-400/55'

export function BookAnnotationToolbar(props: BookAnnotationToolbarProps) {
  const {
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
    pickMarkerSwatchColor,
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
    layout = 'horizontal',
  } = props

  const [shapeToolbarIcon, setShapeToolbarIcon] = useState<ShapeToolbarMode>('rect')
  useEffect(() => {
    if (SHAPE_TOOLBAR_MODES.includes(annotationMode as ShapeToolbarMode)) {
      setShapeToolbarIcon(annotationMode as ShapeToolbarMode)
    }
  }, [annotationMode])

  const [penOpen, setPenOpen] = useState(false)
  const [penSpectrumOpen, setPenSpectrumOpen] = useState(false)
  const [markerOpen, setMarkerOpen] = useState(false)
  const [eraserOpen, setEraserOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const [stampsOpen, setStampsOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [stickyOpen, setStickyOpen] = useState(false)
  const [eraserSubMode, setEraserSubMode] = useState<'rubber' | 'line'>('line')
  const [eyedropperOpen, setEyedropperOpen] = useState(false)
  const eyedropperLongPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({
    timer: null,
    fired: false,
  })

  useEffect(() => {
    if (annotationMode === 'eraser') setEraserSubMode('rubber')
    if (annotationMode === 'eraser-line') setEraserSubMode('line')
  }, [annotationMode])

  function clearEyedropperLongPress() {
    const ref = eyedropperLongPressRef.current
    if (ref.timer) {
      clearTimeout(ref.timer)
      ref.timer = null
    }
  }

  function closeAllExcept(
    which: 'pen' | 'marker' | 'eraser' | 'shapes' | 'stamps' | 'text' | 'sticky' | 'eyedropper',
  ) {
    if (which !== 'pen') {
      setPenOpen(false)
      setPenSpectrumOpen(false)
    }
    if (which !== 'marker') setMarkerOpen(false)
    if (which !== 'eraser') setEraserOpen(false)
    if (which !== 'shapes') setShapesOpen(false)
    if (which !== 'stamps') setStampsOpen(false)
    if (which !== 'text') setTextOpen(false)
    if (which !== 'sticky') setStickyOpen(false)
    if (which !== 'eyedropper') setEyedropperOpen(false)
  }

  function closeAllPopovers() {
    setPenOpen(false)
    setPenSpectrumOpen(false)
    setMarkerOpen(false)
    setEraserOpen(false)
    setShapesOpen(false)
    setStampsOpen(false)
    setTextOpen(false)
    setStickyOpen(false)
    setEyedropperOpen(false)
  }

  useEffect(() => () => clearEyedropperLongPress(), [])

  const penActive = annotationMode === 'pen'
  const eyedropperActive = annotationMode === 'eyedropper'
  const eyedropperTitle =
    eyedropperVariant === 'smart'
      ? `Smart ink — readable stroke from page (${SC.eyedropper}, press ${SC.eyedropperCycle}). Hold for types.`
      : `Eyedropper — sample color (${SC.eyedropper}, press ${SC.eyedropperCycle}). Hold for types.`
  const markerActive = annotationMode === 'marker'
  const eraserActive = annotationMode === 'eraser' || annotationMode === 'eraser-line'
  const shapesActive = SHAPE_TOOLBAR_MODES.includes(annotationMode as ShapeToolbarMode)
  const stampsActive = annotationMode === 'stamp'
  const textActive = annotationMode === 'text'
  const stickyActive = annotationMode === 'sticky'
  const calloutActive = annotationMode === 'callout'
  const laserActive = annotationMode === 'laser'
  const penSwatch = useMemo(() => getPenSwatch(penSwatchId), [penSwatchId])
  const shapeStrokeSwatch = useMemo(() => getPenSwatch(shapeStrokeSwatchId), [shapeStrokeSwatchId])
  const eraserModeLabel = eraserSubMode === 'rubber' ? 'Rub eraser' : 'Stroke eraser'

  function pickShape(m: ShapeToolbarMode) {
    setShapeToolbarIcon(m)
    setAnnotationMode(m)
    setShapesOpen(false)
  }

  function activateShapeTool() {
    if (!SHAPE_TOOLBAR_MODES.includes(annotationMode as ShapeToolbarMode)) {
      setAnnotationMode(shapeToolbarIcon)
    }
  }

  function pickPenPresetSwatch(id: string) {
    pickPenSwatch(id)
    setPenSpectrumOpen(false)
  }

  function openPenSpectrumPicker() {
    pickPenCustomColor(penCustomHex)
    setPenSpectrumOpen(true)
  }

  return (
    <div className={cn('flex shrink-0 items-center justify-center gap-1', layout === 'vertical' ? 'flex-col' : 'flex-nowrap')}>
      <Popover
        open={penOpen}
        onOpenChange={(o) => {
          setPenOpen(o)
          if (o) {
            closeAllExcept('pen')
            setAnnotationMode('pen')
          } else {
            setPenSpectrumOpen(false)
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={penOpen}
            aria-haspopup="dialog"
            aria-label="Pen settings"
            title={`Pen (${SC.pen})`}
            className={cn(toolBtnClass, (penOpen || penActive) && toolBtnActiveClass)}
          >
            <ToolbarIcon
              icon={Pencil}
              colorDot={penColorSource === 'custom' ? penCustomHex : penSwatch.color}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className={popoverStackClass}>
            <PenSwatchRow
              swatchId={penSwatchId}
              colorSource={penColorSource}
              customHex={penCustomHex}
              onPick={pickPenPresetSwatch}
              idPrefix="pen"
              customPickerOpen={penSpectrumOpen}
              onOpenCustomPicker={openPenSpectrumPicker}
            />
            {penSpectrumOpen ? (
              <SpectrumColorPicker
                customHex={penCustomHex}
                onPickCustom={pickPenCustomColor}
                label="Spectrum"
              />
            ) : null}
            <ThicknessSliderRow
              value={penThicknessStep}
              onChange={setPenThicknessStep}
              idPrefix="pen"
              ariaLabel="Pen thickness"
            />
            <LineDashStyleIconRow value={penLineDashStyle} onChange={setPenLineDashStyle} idPrefix="pen" />
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={eyedropperOpen}
        onOpenChange={(o) => {
          setEyedropperOpen(o)
          if (o) closeAllExcept('eyedropper')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={eyedropperOpen}
            aria-haspopup="dialog"
            aria-pressed={eyedropperActive}
            aria-label={EYEDROPPER_VARIANT_LABEL[eyedropperVariant]}
            title={eyedropperTitle}
            className={cn('relative', toolBtnClass, (eyedropperOpen || eyedropperActive) && toolBtnActiveClass)}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              const ref = eyedropperLongPressRef.current
              ref.fired = false
              clearEyedropperLongPress()
              ref.timer = setTimeout(() => {
                ref.fired = true
                closeAllExcept('eyedropper')
                setEyedropperOpen(true)
              }, EYEDROPPER_LONG_PRESS_MS)
            }}
            onPointerUp={() => clearEyedropperLongPress()}
            onPointerCancel={() => clearEyedropperLongPress()}
            onPointerLeave={() => clearEyedropperLongPress()}
            onContextMenu={(e) => {
              e.preventDefault()
              closeAllExcept('eyedropper')
              setEyedropperOpen(true)
            }}
            onClick={() => {
              if (eyedropperLongPressRef.current.fired) {
                eyedropperLongPressRef.current.fired = false
                return
              }
              closeAllPopovers()
              setAnnotationMode('eyedropper')
            }}
          >
            {eyedropperVariant === 'smart' ? <SmartEyedropperIcon /> : <ToolbarIcon icon={Pipette} />}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={eyedropperPopoverClass}>
          <div className="space-y-2">
            <PopoverIconSegmentRow
              label="Eyedropper"
              labelHidden
              value={eyedropperVariant}
              onChange={(v) => {
                setEyedropperVariant(v as EyedropperVariant)
                setEyedropperOpen(false)
                setAnnotationMode('eyedropper')
              }}
              idPrefix="eyedropper-variant"
              options={[
                {
                  value: 'sample',
                  ariaLabel: EYEDROPPER_VARIANT_LABEL.sample,
                  icon: <Pipette className={iconCls} strokeWidth={1.75} aria-hidden />,
                },
                {
                  value: 'smart',
                  ariaLabel: EYEDROPPER_VARIANT_LABEL.smart,
                  icon: <SmartEyedropperIcon />,
                },
              ]}
            />
            <PopoverHint>Click to use · hold or right‑click for types</PopoverHint>
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={markerOpen}
        onOpenChange={(o) => {
          setMarkerOpen(o)
          if (o) {
            closeAllExcept('marker')
            setAnnotationMode('marker')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={markerOpen}
            aria-haspopup="dialog"
            aria-label="Highlighter settings"
            title={`Highlighter (${SC.highlighter})`}
            className={cn(toolBtnClass, (markerOpen || markerActive) && toolBtnActiveClass)}
          >
            <ToolbarIcon icon={Highlighter} colorDot={markerColor} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className={popoverStackClass}>
            <ColorSwatchRow
              colors={ANNOTATION_MARKER_SWATCHES}
              current={markerColor}
              onPick={pickMarkerSwatchColor}
              idPrefix="marker"
            />
            <ThicknessSliderRow
              value={markerThicknessStep}
              onChange={setMarkerThicknessStep}
              idPrefix="marker"
              previewDots={ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS}
              ariaLabel="Highlighter thickness"
            />
            <LineDashStyleIconRow value={markerLineDashStyle} onChange={setMarkerLineDashStyle} idPrefix="marker" />
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={shapesOpen}
        onOpenChange={(o) => {
          setShapesOpen(o)
          if (o) {
            closeAllExcept('shapes')
            activateShapeTool()
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={shapesOpen}
            aria-haspopup="dialog"
            aria-label={`Shapes: ${SHAPE_LABEL[shapeToolbarIcon]}`}
            title={`Shapes – ${SHAPE_LABEL[shapeToolbarIcon]} (${SC.shapes}, press ${SC.shapeCycle})`}
            className={cn(toolBtnClass, (shapesOpen || shapesActive) && toolBtnActiveClass)}
          >
            <ToolbarIcon icon={shapeIconForMode(shapeToolbarIcon)} colorDot={shapeStrokeSwatch.color} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side={layout === 'vertical' ? 'left' : 'top'}
          align="center"
          className={cn(popoverContentClass, 'w-[min(22rem,calc(100vw-2rem))]')}
        >
          <div className={popoverStackClass}>
            <PopoverIconGridRow
              label="Shape"
              labelHidden
              value={SHAPE_TOOLBAR_MODES.includes(annotationMode as ShapeToolbarMode) ? annotationMode : shapeToolbarIcon}
              onChange={(m) => pickShape(m as ShapeToolbarMode)}
              idPrefix="shape-kind"
              options={SHAPE_ICON_OPTIONS}
            />
            <PenSwatchRow
              swatchId={shapeStrokeSwatchId}
              onPick={setShapeStrokeSwatchId}
              idPrefix="shape-stroke"
              label="Stroke color"
            />
            {(annotationMode === 'rect' || annotationMode === 'ellipse' || annotationMode === 'triangle') ? (
              <ShapeLineStyleIconRow
                strokeEnabled={shapeStrokeEnabled}
                lineDashStyle={shapeLineDashStyle}
                onStrokeEnabledChange={setShapeStrokeEnabled}
                onLineDashStyleChange={setShapeLineDashStyle}
                fillMode={shapeFillMode}
                onFillModeChange={setShapeFillMode}
                idPrefix="shape"
              />
            ) : (
              <LineDashStyleIconRow value={shapeLineDashStyle} onChange={setShapeLineDashStyle} idPrefix="shape" />
            )}
            {(annotationMode === 'rect' || annotationMode === 'ellipse' || annotationMode === 'triangle') ? (
              <>
                <ShapeFillIconRow
                  fillMode={shapeFillMode}
                  onFillModeChange={setShapeFillMode}
                  strokeEnabled={shapeStrokeEnabled}
                  onStrokeEnabledChange={setShapeStrokeEnabled}
                  idPrefix="shape"
                />
                {shapeFillModeHasFill(shapeFillMode) ? (
                  <ColorSwatchRow
                    colors={ANNOTATION_MARKER_SWATCHES}
                    current={shapeFillColor}
                    onPick={setShapeFillColor}
                    idPrefix="shape-fill"
                    label="Fill color"
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={stampsOpen}
        onOpenChange={(o) => {
          setStampsOpen(o)
          if (o) {
            closeAllExcept('stamps')
            setAnnotationMode('stamp')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={stampsOpen}
            aria-haspopup="dialog"
            aria-label={`Stamp: ${STAMP_LABEL[stampVariant]}`}
            title={`Stamp – ${STAMP_LABEL[stampVariant]} (${SC.stamp}, ${SC.stampVariants})`}
            className={cn(toolBtnClass, (stampsOpen || stampsActive) && toolBtnActiveClass)}
          >
            {stampIconForVariant(stampVariant, stampQuestionColor)}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className={popoverStackClass}>
            <PopoverIconGridRow
              label="Stamp"
              labelHidden
              value={stampVariant}
              onChange={(v) => {
                setStampVariant(v as StampVariant)
                setAnnotationMode('stamp')
                setStampsOpen(false)
              }}
              idPrefix="stamp-variant"
              options={STAMP_ICON_OPTIONS}
            />
            {stampVariant === 'question' ? (
              <ColorSwatchRow
                colors={ANNOTATION_STAMP_QUESTION_SWATCHES}
                current={stampQuestionColor}
                onPick={setStampQuestionColor}
                idPrefix="stamp-question"
                label="Question color"
              />
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={textOpen}
        onOpenChange={(o) => {
          setTextOpen(o)
          if (o) {
            closeAllExcept('text')
            setAnnotationMode('text')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={textOpen}
            aria-haspopup="dialog"
            aria-label={textVisualStyle === 'filled' ? 'Text with background' : 'Plain text'}
            title={`Text – ${textVisualStyle === 'filled' ? 'with background' : 'plain'} (${SC.text})`}
            className={cn(toolBtnClass, (textOpen || textActive) && toolBtnActiveClass)}
          >
            {textVisualStyle === 'filled' ? (
              <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
                <TextWithBackgroundIcon />
                <span
                  className="pointer-events-none absolute -bottom-px -right-px h-2 w-2 rounded-full shadow-sm"
                  style={{ backgroundColor: textColor }}
                  aria-hidden
                />
              </span>
            ) : (
              <ToolbarIcon icon={Type} colorDot={textColor} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className={popoverStackClass}>
            <PopoverIconSegmentRow
              label="Style"
              labelHidden
              value={textVisualStyle}
              onChange={(v) => {
                if (v === 'plain' || v === 'filled') setTextVisualStyle(v)
              }}
              idPrefix="text-style"
              options={[
                {
                  value: 'plain',
                  ariaLabel: 'Plain text',
                  icon: <Type className={iconCls} strokeWidth={1.75} aria-hidden />,
                },
                {
                  value: 'filled',
                  ariaLabel: 'Text with background',
                  icon: <TextWithBackgroundIcon />,
                },
              ]}
            />
            <PopoverHint>
              Tap the page to place one text box. Plain is text only; Background adds a fill per line. Enter for a new
              line, Ctrl+A to select all, Escape or click away when done.
            </PopoverHint>
            <ColorSwatchRow
              colors={ANNOTATION_TEXT_STROKE_SWATCHES}
              current={textColor}
              onPick={setTextColor}
              idPrefix="text"
              label="Text color"
            />
            {textVisualStyle === 'filled' ? (
              <ColorSwatchRow
                colors={ANNOTATION_TEXT_FILL_SWATCHES}
                current={textFillColor}
                onPick={setTextFillColor}
                idPrefix="text-fill"
                label="Background"
              />
            ) : null}
            <ThicknessSliderRow
              value={penThicknessStep}
              onChange={setPenThicknessStep}
              idPrefix="text"
              previewDots={ANNOTATION_PEN_THICKNESS_PREVIEW_DOTS}
              ariaLabel="Text size"
            />
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={stickyOpen}
        onOpenChange={(o) => {
          setStickyOpen(o)
          if (o) {
            closeAllExcept('sticky')
            setAnnotationMode('sticky')
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={stickyOpen}
            aria-haspopup="dialog"
            aria-label="Sticky note"
            title={`Sticky note (${SC.sticky})`}
            className={cn(toolBtnClass, (stickyOpen || stickyActive) && toolBtnActiveClass)}
          >
            <ToolbarIcon icon={StickyNote} colorDot={stickyFillColor} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
          <div className={popoverStackClass}>
            <PopoverHint>Tap the page to place a note. Highlighter settings set note text size.</PopoverHint>
            <ColorSwatchRow
              colors={ANNOTATION_STICKY_FILL_SWATCHES}
              current={stickyFillColor}
              onPick={setStickyFillColor}
              idPrefix="sticky"
              label="Note color"
            />
            <ThicknessSliderRow
              value={markerThicknessStep}
              onChange={setMarkerThicknessStep}
              idPrefix="sticky"
              previewDots={ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS}
              ariaLabel="Note text size"
            />
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-pressed={calloutActive}
        aria-label="Numbered callout"
        title={`Numbered callout (${SC.callout})`}
        onClick={() => {
          closeAllPopovers()
          setAnnotationMode('callout')
        }}
        className={cn(toolBtnClass, calloutActive && toolBtnActiveClass)}
      >
        <ToolbarIcon icon={Circle} colorDot={shapeStrokeSwatch.color} />
      </Button>

      <Popover
        open={eraserOpen}
        onOpenChange={(o) => {
          setEraserOpen(o)
          if (o) {
            closeAllExcept('eraser')
            if (annotationMode !== 'eraser' && annotationMode !== 'eraser-line') {
              setAnnotationMode('eraser-line')
            }
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={eraserOpen}
            aria-haspopup="dialog"
            aria-label={`Eraser: ${eraserModeLabel}`}
            title={`${eraserModeLabel} (${SC.eraserStroke}, press ${SC.eraserRub} for rub)`}
            className={cn(toolBtnClass, (eraserOpen || eraserActive) && toolBtnActiveClass)}
          >
            {eraserSubMode === 'rubber' ? <PenEraserIcon /> : <ToolbarIcon icon={Eraser} />}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side={layout === 'vertical' ? 'left' : 'top'}
          align="center"
          className={eraserSubMode === 'line' ? eraserPopoverCompactClass : popoverContentClass}
        >
          <div className={eraserSubMode === 'line' ? 'space-y-0' : popoverStackClass}>
            <PopoverIconSegmentRow
              label="Mode"
              labelHidden
              value={eraserSubMode === 'line' ? 'line' : 'rubber'}
              onChange={(v) => {
                if (v === 'line') {
                  setEraserSubMode('line')
                  setAnnotationMode('eraser-line')
                } else {
                  setEraserSubMode('rubber')
                  setAnnotationMode('eraser')
                }
              }}
              idPrefix="eraser-mode"
              options={[
                {
                  value: 'rubber',
                  ariaLabel: 'Rub eraser',
                  icon: <PenEraserIcon />,
                },
                {
                  value: 'line',
                  ariaLabel: 'Stroke eraser',
                  icon: <Eraser className={iconCls} strokeWidth={1.75} aria-hidden />,
                },
              ]}
            />
            {eraserSubMode === 'rubber' ? (
              <ThicknessSliderRow
                value={eraserPixelThicknessStep}
                onChange={setEraserPixelThicknessStep}
                idPrefix="eraser-pixel"
                previewDots={ANNOTATION_DEFAULT_THICKNESS_PREVIEW_DOTS}
                ariaLabel="Eraser thickness"
              />
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-pressed={laserActive}
        aria-label="Laser pointer"
        title={`Laser pointer (${SC.laser})`}
        onClick={() => {
          closeAllPopovers()
          setAnnotationMode('laser')
        }}
        className={cn(toolBtnClass, laserActive && 'ring-2 ring-rose-400/55')}
      >
        <ToolbarIcon icon={MousePointer2} />
      </Button>
    </div>
  )
}
