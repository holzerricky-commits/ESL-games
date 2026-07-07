'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import {
  Check,
  Circle,
  Eraser,
  Heart,
  Highlighter,
  Minus,
  MousePointer2,
  MoveUpRight,
  Paintbrush,
  PenLine,
  Pipette,
  Pencil,
  Sparkles,
  Square,
  Star,
  StickyNote,
  ThumbsUp,
  Repeat,
  ArrowRight,
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
  STAMP_COLOR_THUMBS_UP,
  STAMP_COLOR_REPEAT,
  STAMP_COLOR_YOUR_TURN,
  STAMP_COLOR_NEW_WORD,
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
import { StraightHVStrokeIcon } from '@/components/students/annotation-popover-controls'
import { TopStripStraightStrokeChip } from '@/components/students/annotation-top-strip-controls'
import { ThicknessSliderRow } from '@/components/students/annotation-thickness-slider-row'
import { SpectrumColorPicker } from '@/components/students/annotation-spectrum-picker'
import { ColorSwatchRow, PenSwatchRow } from '@/components/students/annotation-swatch-picker'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import {
  ANNOTATION_ERASER_THICKNESS_PREVIEW_DOTS,
  ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS,
  ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS,
  buildFineInkThicknessPreviewDots,
} from '@/lib/books/annotation-storage'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  TextAnnotationVisualStyle,
  WritableStickerVariant,
} from '@/lib/books/annotation-command-types'
import {
  STICKER_QUICK_LABEL,
  STICKER_QUICK_VARIANTS,
  WRITABLE_STICKER_LABEL,
  WRITABLE_STICKER_VARIANTS,
  type StickerKind,
} from '@/lib/books/sticker-tool'
import { writableStickerIcon } from '@/components/students/annotation-sticker-icons'
import { defaultWritableStickerFill } from '@/lib/books/writable-sticker-visuals'
import { shapeFillModeHasFill } from '@/lib/books/annotation-command-types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import {
  EYEDROPPER_VARIANT_LABEL,
  type EyedropperVariant,
} from '@/lib/books/eyedropper-variant'
import {
  filterPenSwatchesForProfile,
  normalizeActivePenStrokeProfile,
  penProfileWidthScaleMultiplier,
  PEN_STROKE_PROFILE_LABEL,
  PEN_STROKE_PROFILES,
  type PenStrokeProfile,
} from '@/lib/books/pen-stroke-profile'

const SHAPE_TOOLBAR_MODES = ['line', 'rect', 'ellipse', 'triangle', 'arrow'] as const
type ShapeToolbarMode = (typeof SHAPE_TOOLBAR_MODES)[number]

const SHAPE_LABEL: Record<ShapeToolbarMode, string> = {
  line: 'Line',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  arrow: 'Arrow',
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
const STAMP_LABEL = STICKER_QUICK_LABEL

const SHAPE_ICON_OPTIONS = SHAPE_TOOLBAR_MODES.map((mode) => ({
  value: mode,
  ariaLabel: SHAPE_LABEL[mode],
  icon: (() => {
    const Icon = shapeIconForMode(mode)
    return <Icon className={iconCls} strokeWidth={1.75} aria-hidden />
  })(),
}))

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

export function stampIconForVariant(variant: StampVariant, questionColor: string): ReactNode {
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
  if (variant === 'heart') {
    return <Heart className={iconCls} strokeWidth={1.75} style={{ color: STAMP_COLOR_HEART }} aria-hidden />
  }
  if (variant === 'thumbsUp') {
    return <ThumbsUp className={iconCls} strokeWidth={1.75} style={{ color: STAMP_COLOR_THUMBS_UP }} aria-hidden />
  }
  if (variant === 'repeat') {
    return <Repeat className={iconCls} strokeWidth={1.75} style={{ color: STAMP_COLOR_REPEAT }} aria-hidden />
  }
  if (variant === 'yourTurn') {
    return <ArrowRight className={iconCls} strokeWidth={1.75} style={{ color: STAMP_COLOR_YOUR_TURN }} aria-hidden />
  }
  return <Sparkles className={iconCls} strokeWidth={1.75} style={{ color: STAMP_COLOR_NEW_WORD }} aria-hidden />
}

const STAMP_ICON_OPTIONS: { value: StampVariant; ariaLabel: string; icon: ReactNode }[] =
  STICKER_QUICK_VARIANTS.map((value) => ({
    value,
    ariaLabel: STICKER_QUICK_LABEL[value],
    icon: stampIconForVariant(value, value === 'question' ? '#c4b5a8' : ''),
  }))

const WRITABLE_STICKER_ICON_OPTIONS: {
  value: WritableStickerVariant
  ariaLabel: string
  icon: ReactNode
}[] = WRITABLE_STICKER_VARIANTS.map((value) => ({
  value,
  ariaLabel: WRITABLE_STICKER_LABEL[value],
  icon: writableStickerIcon(value),
}))

export interface BookAnnotationToolbarProps {
  annotationMode: BookAnnotationInteractionMode
  setAnnotationMode: (m: BookAnnotationInteractionMode) => void
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
  penStrokeProfile: PenStrokeProfile
  setPenStrokeProfile: (profile: PenStrokeProfile) => void
  penColorSource: AnnotationColorSource
  penCustomHex: string
  pickPenCustomColor: (hex: string) => void
  textColor: string
  setTextColor: (c: string) => void
  shapeStrokeSwatchId: string
  pickShapeStrokeSwatch: (id: string) => void
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
  shapeThicknessStep: AnnotationStrokeThicknessStep
  setShapeThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  textThicknessStep: AnnotationStrokeThicknessStep
  setTextThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  stickyThicknessStep: AnnotationStrokeThicknessStep
  setStickyThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  stampThicknessStep: AnnotationStrokeThicknessStep
  setStampThicknessStep: (s: AnnotationStrokeThicknessStep) => void
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
  markerStraightStroke: boolean
  setMarkerStraightStroke: (v: boolean) => void
  markerDecoratedEdge: boolean
  setMarkerDecoratedEdge: (v: boolean) => void
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
  /** When true, color/thickness/line style live in the top options bar. */
  useContextStrip?: boolean
}

const popoverContentClass =
  'w-[min(24rem,calc(100vw-2rem))] border-[#3d2a1a]/45 bg-[#1a1512] p-3.5 text-[#faf6ef] shadow-xl z-[80]'

const eraserPopoverCompactClass =
  'w-auto border-[#3d2a1a]/45 bg-[#1a1512] p-2 text-[#faf6ef] shadow-xl z-[80]'

const eyedropperPopoverClass =
  'w-auto border-[#3d2a1a]/45 bg-[#1a1512] p-2 text-[#faf6ef] shadow-xl z-[80]'

/** Variant picker in the annotation rail — matches `ANNOTATION_RAIL_SURFACE`. */
const railVariantPopoverClass =
  'w-auto border border-white/10 bg-black/24 p-2 text-white/75 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px] z-[80]'

const EYEDROPPER_LONG_PRESS_MS = 450
const VARIANT_TOOL_HOLD_MS = 450
const VARIANT_TOOL_DOUBLE_CLICK_MS = 280

/** Single click activates; double-click or hold opens the variant flyout (Photoshop-style). */
function useRailVariantToolPress(onActivate: () => void, onOpenVariantMenu: () => void) {
  const holdRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({
    timer: null,
    fired: false,
  })
  const clickBurstRef = useRef(0)
  const clickBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAltMenuOpenRef = useRef(0)

  const clearHold = useCallback(() => {
    const ref = holdRef.current
    if (ref.timer) {
      clearTimeout(ref.timer)
      ref.timer = null
    }
  }, [])

  const flushClickBurst = useCallback(() => {
    const count = clickBurstRef.current
    clickBurstRef.current = 0
    if (holdRef.current.fired) {
      holdRef.current.fired = false
      return
    }
    if (count >= 2) onOpenVariantMenu()
    else if (count === 1) onActivate()
  }, [onActivate, onOpenVariantMenu])

  const scheduleClickBurstEnd = useCallback(() => {
    if (clickBurstTimerRef.current) clearTimeout(clickBurstTimerRef.current)
    clickBurstTimerRef.current = setTimeout(() => {
      clickBurstTimerRef.current = null
      flushClickBurst()
    }, VARIANT_TOOL_DOUBLE_CLICK_MS)
  }, [flushClickBurst])

  useEffect(() => {
    return () => {
      clearHold()
      if (clickBurstTimerRef.current) clearTimeout(clickBurstTimerRef.current)
    }
  }, [clearHold])

  const openMenuFromAlternateGesture = useCallback(() => {
    const now = performance.now()
    if (now - lastAltMenuOpenRef.current < 80) return
    lastAltMenuOpenRef.current = now
    clearHold()
    holdRef.current.fired = false
    clickBurstRef.current = 0
    if (clickBurstTimerRef.current) {
      clearTimeout(clickBurstTimerRef.current)
      clickBurstTimerRef.current = null
    }
    onOpenVariantMenu()
  }, [clearHold, onOpenVariantMenu])

  return useMemo(
    () => ({
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        if (e.button === 2) {
          e.preventDefault()
          openMenuFromAlternateGesture()
          return
        }
        if (e.button !== 0) return
        const ref = holdRef.current
        ref.fired = false
        clearHold()
        ref.timer = setTimeout(() => {
          ref.fired = true
          clickBurstRef.current = 0
          if (clickBurstTimerRef.current) {
            clearTimeout(clickBurstTimerRef.current)
            clickBurstTimerRef.current = null
          }
          onOpenVariantMenu()
        }, VARIANT_TOOL_HOLD_MS)
      },
      onPointerUp: clearHold,
      onPointerCancel: clearHold,
      onPointerLeave: clearHold,
      onMouseDown: (e: MouseEvent<HTMLButtonElement>) => {
        if (e.button === 2) e.preventDefault()
      },
      onContextMenu: (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        e.stopPropagation()
        openMenuFromAlternateGesture()
      },
      onClick: () => {
        clearHold()
        if (holdRef.current.fired) return
        clickBurstRef.current += 1
        scheduleClickBurstEnd()
      },
    }),
    [clearHold, onOpenVariantMenu, openMenuFromAlternateGesture, scheduleClickBurstEnd],
  )
}

const railVariantToolTitleSuffix = ' · double-click or hold for more'

function penProfileLucideIcon(profile: PenStrokeProfile) {
  switch (profile) {
    case 'brush':
      return Paintbrush
    case 'effects':
      return Sparkles
    default:
      return Pencil
  }
}

function penProfileIcon(profile: PenStrokeProfile, className = iconCls) {
  const Icon = penProfileLucideIcon(profile)
  return <Icon className={className} strokeWidth={1.75} aria-hidden />
}

const PEN_PROFILE_OPTIONS = PEN_STROKE_PROFILES.map((profile) => ({
  value: profile,
  ariaLabel: PEN_STROKE_PROFILE_LABEL[profile],
  icon: penProfileIcon(profile),
}))

const toolBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center overflow-visible rounded-full border border-white/14 bg-black/50 shadow-sm backdrop-blur-sm transition-colors hover:bg-black/65'

const toolBtnActiveClass = 'ring-2 ring-amber-400/55'

export function BookAnnotationToolbar(props: BookAnnotationToolbarProps) {
  const {
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
    pickMarkerSwatchColor,
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
    markerStraightStroke,
    setMarkerStraightStroke,
    markerDecoratedEdge,
    setMarkerDecoratedEdge,
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
    useContextStrip = false,
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
  const [stickersOpen, setStickersOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [eraserSubMode, setEraserSubMode] = useState<'rubber' | 'line'>('line')
  const [eyedropperOpen, setEyedropperOpen] = useState(false)
  const activePenStrokeProfile = normalizeActivePenStrokeProfile(penStrokeProfile)
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
    which: 'pen' | 'marker' | 'eraser' | 'shapes' | 'stickers' | 'text' | 'eyedropper',
  ) {
    if (which !== 'pen') {
      setPenOpen(false)
      setPenSpectrumOpen(false)
    }
    if (which !== 'marker') setMarkerOpen(false)
    if (which !== 'eraser') setEraserOpen(false)
    if (which !== 'shapes') setShapesOpen(false)
    if (which !== 'stickers') setStickersOpen(false)
    if (which !== 'text') setTextOpen(false)
    if (which !== 'eyedropper') setEyedropperOpen(false)
  }

  function closeAllPopovers() {
    setPenOpen(false)
    setPenSpectrumOpen(false)
    setMarkerOpen(false)
    setEraserOpen(false)
    setShapesOpen(false)
    setStickersOpen(false)
    setTextOpen(false)
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
  const stickerActive =
    annotationMode === 'sticker' || annotationMode === 'stamp' || annotationMode === 'sticky'
  const stickerToolbarIcon =
    stickerKind === 'writable' || annotationMode === 'sticky' ? (
      <span className="relative inline-flex">
        {writableStickerIcon(writableStickerVariant)}
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-black/20"
          style={{
            backgroundColor: defaultWritableStickerFill(writableStickerVariant, stickyFillColor),
          }}
          aria-hidden
        />
      </span>
    ) : (
      stampIconForVariant(stampVariant, stampQuestionColor)
    )
  const stickerToolbarLabel =
    stickerKind === 'writable'
      ? WRITABLE_STICKER_LABEL[writableStickerVariant]
      : STAMP_LABEL[stampVariant]
  const textActive = annotationMode === 'text'
  const calloutActive = annotationMode === 'callout'
  const selectActive = annotationMode === 'select'
  const penSwatch = useMemo(() => getPenSwatch(penSwatchId), [penSwatchId])
  const penSwatchesForProfile = useMemo(
    () => filterPenSwatchesForProfile(penStrokeProfile),
    [penStrokeProfile],
  )
  const penThicknessPreviewDots = useMemo(
    () => buildFineInkThicknessPreviewDots(penProfileWidthScaleMultiplier(penStrokeProfile)),
    [penStrokeProfile],
  )
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

  const eyedropperRailPress = useRailVariantToolPress(
    () => {
      closeAllPopovers()
      setAnnotationMode('eyedropper')
    },
    () => {
      closeAllExcept('eyedropper')
      setEyedropperOpen(true)
    },
  )
  const shapesRailPress = useRailVariantToolPress(
    () => {
      closeAllPopovers()
      activateShapeTool()
    },
    () => {
      closeAllExcept('shapes')
      setShapesOpen(true)
    },
  )
  const stickersRailPress = useRailVariantToolPress(
    () => {
      closeAllPopovers()
      setAnnotationMode('sticker')
    },
    () => {
      closeAllExcept('stickers')
      setStickersOpen(true)
    },
  )
  const textRailPress = useRailVariantToolPress(
    () => {
      closeAllPopovers()
      setAnnotationMode('text')
    },
    () => {
      closeAllExcept('text')
      setTextOpen(true)
    },
  )
  const eraserRailPress = useRailVariantToolPress(
    () => {
      closeAllPopovers()
      setAnnotationMode(eraserSubMode === 'line' ? 'eraser-line' : 'eraser')
    },
    () => {
      closeAllExcept('eraser')
      setEraserOpen(true)
    },
  )
  const penRailPress = useRailVariantToolPress(
    () => {
      closeAllPopovers()
      setAnnotationMode('pen')
    },
    () => {
      closeAllExcept('pen')
      setPenOpen(true)
    },
  )

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
      {useContextStrip ? (
        <Popover open={penOpen} onOpenChange={setPenOpen}>
          <PopoverAnchor asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={penOpen}
              aria-haspopup="dialog"
              aria-pressed={penActive}
              aria-label={PEN_STROKE_PROFILE_LABEL[activePenStrokeProfile]}
              title={`${PEN_STROKE_PROFILE_LABEL[activePenStrokeProfile]} (${SC.pen})${railVariantToolTitleSuffix}`}
              className={cn(toolBtnClass, (penOpen || penActive) && toolBtnActiveClass)}
              {...penRailPress}
            >
              <ToolbarIcon
                icon={penProfileLucideIcon(activePenStrokeProfile)}
                colorDot={penColorSource === 'custom' ? penCustomHex : penSwatch.color}
              />
            </Button>
          </PopoverAnchor>
          <PopoverContent
            side={layout === 'vertical' ? 'left' : 'top'}
            align="center"
            className={railVariantPopoverClass}
          >
            <PopoverIconSegmentRow
              label="Pen"
              labelHidden
              surface="rail"
              value={activePenStrokeProfile}
              onChange={(v) => {
                setPenStrokeProfile(v as PenStrokeProfile)
                setPenOpen(false)
                setAnnotationMode('pen')
              }}
              idPrefix="pen-profile"
              options={PEN_PROFILE_OPTIONS}
            />
          </PopoverContent>
        </Popover>
      ) : (
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
                icon={penProfileLucideIcon(penStrokeProfile)}
                colorDot={penColorSource === 'custom' ? penCustomHex : penSwatch.color}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
            <div className={popoverStackClass}>
              <PopoverIconSegmentRow
                label="Pen type"
                value={activePenStrokeProfile}
                onChange={(v) => setPenStrokeProfile(v as PenStrokeProfile)}
                idPrefix="pen-profile"
                options={PEN_PROFILE_OPTIONS}
              />
              <PenSwatchRow
                swatchId={penSwatchId}
                colorSource={penColorSource}
                customHex={penCustomHex}
                onPick={pickPenPresetSwatch}
                idPrefix="pen"
                swatches={penSwatchesForProfile}
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
                previewDots={penThicknessPreviewDots}
                ariaLabel="Pen thickness"
              />
              <LineDashStyleIconRow value={penLineDashStyle} onChange={setPenLineDashStyle} idPrefix="pen" />
            </div>
          </PopoverContent>
        </Popover>
      )}

      {useContextStrip ? (
        <Popover open={eyedropperOpen} onOpenChange={setEyedropperOpen}>
          <PopoverAnchor asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={eyedropperOpen}
              aria-haspopup="dialog"
              aria-pressed={eyedropperActive}
              aria-label={EYEDROPPER_VARIANT_LABEL[eyedropperVariant]}
              title={`${eyedropperVariant === 'smart' ? 'Smart ink' : 'Sample color'} (${SC.eyedropper})${railVariantToolTitleSuffix}`}
              className={cn('relative', toolBtnClass, (eyedropperOpen || eyedropperActive) && toolBtnActiveClass)}
              {...eyedropperRailPress}
            >
              {eyedropperVariant === 'smart' ? <SmartEyedropperIcon /> : <ToolbarIcon icon={Pipette} />}
            </Button>
          </PopoverAnchor>
          <PopoverContent
            side={layout === 'vertical' ? 'left' : 'top'}
            align="center"
            className={railVariantPopoverClass}
          >
            <PopoverIconSegmentRow
              label="Eyedropper"
              labelHidden
              surface="rail"
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
          </PopoverContent>
        </Popover>
      ) : (
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
              onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
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
              onContextMenu={(e: MouseEvent<HTMLButtonElement>) => {
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
      )}

      {useContextStrip ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Highlighter"
          title={`Highlighter (${SC.highlighter})`}
          className={cn(toolBtnClass, markerActive && toolBtnActiveClass)}
          onClick={() => {
            closeAllPopovers()
            setAnnotationMode('marker')
          }}
        >
          <ToolbarIcon icon={Highlighter} colorDot={markerColor} />
        </Button>
      ) : (
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
                previewDots={ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS}
                ariaLabel="Highlighter thickness"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  id="marker-straight-stroke"
                  className={cn(
                    'flex h-7 w-9 items-center justify-center rounded text-xs transition-colors',
                    markerStraightStroke
                      ? 'bg-amber-600/35 text-white'
                      : 'text-[#c4b5a8]/90 hover:bg-[#1f1a16]/90',
                  )}
                  aria-pressed={markerStraightStroke}
                  aria-label={
                    markerStraightStroke
                      ? 'Straight horizontal or vertical on'
                      : 'Straight horizontal or vertical off'
                  }
                  title="Straight horizontal or vertical"
                  onClick={() => setMarkerStraightStroke(!markerStraightStroke)}
                >
                  <StraightHVStrokeIcon />
                </button>
                <button
                  type="button"
                  id="marker-decorated-edge"
                  className={cn(
                    'flex h-7 w-9 items-center justify-center rounded text-xs transition-colors',
                    markerDecoratedEdge
                      ? 'bg-amber-600/35 text-white'
                      : 'text-[#c4b5a8]/90 hover:bg-[#1f1a16]/90',
                  )}
                  aria-pressed={markerDecoratedEdge}
                  aria-label={
                    markerDecoratedEdge
                      ? 'Decorated highlighter edge on'
                      : 'Decorated highlighter edge off'
                  }
                  title="Decorated edge (flames, waves, leaves by color)"
                  onClick={() => setMarkerDecoratedEdge(!markerDecoratedEdge)}
                >
                  <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <PopoverHint>
                Straight stroke snaps horizontal or vertical only (Shift while drawing). Decorated edge adds
                themed ornaments on the top of the highlight (flames, waves, leaves by color).
              </PopoverHint>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {useContextStrip ? (
        <Popover open={shapesOpen} onOpenChange={setShapesOpen}>
          <PopoverAnchor asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={shapesOpen}
              aria-haspopup="dialog"
              aria-label={`Shapes: ${SHAPE_LABEL[shapeToolbarIcon]}`}
              title={`Shapes – ${SHAPE_LABEL[shapeToolbarIcon]} (${SC.shapes})${railVariantToolTitleSuffix}`}
              className={cn(toolBtnClass, (shapesOpen || shapesActive) && toolBtnActiveClass)}
              {...shapesRailPress}
            >
              <ToolbarIcon icon={shapeIconForMode(shapeToolbarIcon)} colorDot={shapeStrokeSwatch.color} />
            </Button>
          </PopoverAnchor>
          <PopoverContent
            side={layout === 'vertical' ? 'left' : 'top'}
            align="center"
            className={railVariantPopoverClass}
          >
            <PopoverIconGridRow
              label="Shape"
              labelHidden
              surface="rail"
              value={
                SHAPE_TOOLBAR_MODES.includes(annotationMode as ShapeToolbarMode)
                  ? annotationMode
                  : shapeToolbarIcon
              }
              onChange={(m) => pickShape(m as ShapeToolbarMode)}
              idPrefix="shape-kind"
              options={SHAPE_ICON_OPTIONS}
            />
          </PopoverContent>
        </Popover>
      ) : (
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
              onPick={pickShapeStrokeSwatch}
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
            {!useContextStrip ? (
              <ThicknessSliderRow
                value={shapeThicknessStep}
                onChange={setShapeThicknessStep}
                idPrefix="shape"
                previewDots={ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS}
                ariaLabel="Shape stroke width"
              />
            ) : null}
          </div>
        </PopoverContent>
        </Popover>
      )}

      {useContextStrip ? (
        <Popover open={stickersOpen} onOpenChange={setStickersOpen}>
          <PopoverAnchor asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={stickersOpen}
              aria-haspopup="dialog"
              aria-label={`Sticker: ${stickerToolbarLabel}`}
              title={`Sticker – ${stickerToolbarLabel} (${SC.sticker})${railVariantToolTitleSuffix}`}
              className={cn(toolBtnClass, (stickersOpen || stickerActive) && toolBtnActiveClass)}
              {...stickersRailPress}
            >
              {stickerToolbarIcon}
            </Button>
          </PopoverAnchor>
          <PopoverContent
            side={layout === 'vertical' ? 'left' : 'top'}
            align="center"
            className={railVariantPopoverClass}
          >
            <div className={popoverStackClass}>
              <PopoverIconSegmentRow
                label="Kind"
                labelHidden
                surface="rail"
                value={stickerKind}
                onChange={(v) => {
                  if (v === 'quick' || v === 'writable') {
                    setStickerKind(v)
                    setAnnotationMode('sticker')
                  }
                }}
                idPrefix="sticker-kind"
                options={[
                  { value: 'quick', ariaLabel: 'Quick', icon: stampIconForVariant(stampVariant, stampQuestionColor) },
                  { value: 'writable', ariaLabel: 'Writable', icon: writableStickerIcon(writableStickerVariant) },
                ]}
              />
              {stickerKind === 'quick' ? (
                <PopoverIconGridRow
                  label="Quick sticker"
                  labelHidden
                  surface="rail"
                  value={stampVariant}
                  onChange={(v) => {
                    setStampVariant(v as StampVariant)
                    setStickerKind('quick')
                    setAnnotationMode('sticker')
                    setStickersOpen(false)
                  }}
                  idPrefix="sticker-quick-variant"
                  options={STAMP_ICON_OPTIONS}
                />
              ) : (
                <PopoverIconGridRow
                  label="Writable sticker"
                  labelHidden
                  surface="rail"
                  value={writableStickerVariant}
                  onChange={(v) => {
                    setWritableStickerVariant(v as WritableStickerVariant)
                    setStickerKind('writable')
                    setAnnotationMode('sticker')
                    setStickersOpen(false)
                  }}
                  idPrefix="sticker-writable-variant"
                  options={WRITABLE_STICKER_ICON_OPTIONS}
                />
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Popover
          open={stickersOpen}
          onOpenChange={(o) => {
            setStickersOpen(o)
            if (o) {
              closeAllExcept('stickers')
              setAnnotationMode('sticker')
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={stickersOpen}
              aria-haspopup="dialog"
              aria-label={`Sticker: ${stickerToolbarLabel}`}
              title={`Sticker – ${stickerToolbarLabel} (${SC.sticker}, ${SC.stickerVariants}; ${SC.stickyWritable} for writable)`}
              className={cn(toolBtnClass, (stickersOpen || stickerActive) && toolBtnActiveClass)}
            >
              {stickerToolbarIcon}
            </Button>
          </PopoverTrigger>
          <PopoverContent side={layout === 'vertical' ? 'left' : 'top'} align="center" className={popoverContentClass}>
            <div className={popoverStackClass}>
              <PopoverIconSegmentRow
                label="Kind"
                value={stickerKind}
                onChange={(v) => {
                  if (v === 'quick' || v === 'writable') {
                    setStickerKind(v)
                    setAnnotationMode('sticker')
                  }
                }}
                idPrefix="sticker-kind"
                options={[
                  { value: 'quick', ariaLabel: 'Quick', icon: stampIconForVariant(stampVariant, stampQuestionColor) },
                  { value: 'writable', ariaLabel: 'Writable', icon: writableStickerIcon(writableStickerVariant) },
                ]}
              />
              {stickerKind === 'quick' ? (
                <>
                  <PopoverIconGridRow
                    label="Quick sticker"
                    labelHidden
                    value={stampVariant}
                    onChange={(v) => {
                      setStampVariant(v as StampVariant)
                      setStickerKind('quick')
                      setAnnotationMode('sticker')
                    }}
                    idPrefix="sticker-quick-variant"
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
                  <ThicknessSliderRow
                    value={stampThicknessStep}
                    onChange={setStampThicknessStep}
                    idPrefix="stamp"
                    previewDots={ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS}
                    ariaLabel="Sticker size"
                  />
                </>
              ) : (
                <>
                  <PopoverHint>
                    Tap the page to place. Notes use your pick color; speech and thought default to white;
                    captions use a dark bar.
                  </PopoverHint>
                  <PopoverIconGridRow
                    label="Writable sticker"
                    labelHidden
                    value={writableStickerVariant}
                    onChange={(v) => {
                      setWritableStickerVariant(v as WritableStickerVariant)
                      setStickerKind('writable')
                      setAnnotationMode('sticker')
                    }}
                    idPrefix="sticker-writable-variant"
                    options={WRITABLE_STICKER_ICON_OPTIONS}
                  />
                  <ColorSwatchRow
                    colors={ANNOTATION_STICKY_FILL_SWATCHES}
                    current={stickyFillColor}
                    onPick={setStickyFillColor}
                    idPrefix="sticky"
                    label="Fill color"
                  />
                  <ThicknessSliderRow
                    value={stickyThicknessStep}
                    onChange={setStickyThicknessStep}
                    idPrefix="sticky"
                    ariaLabel="Text size"
                  />
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {useContextStrip ? (
        <Popover open={textOpen} onOpenChange={setTextOpen}>
          <PopoverAnchor asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={textOpen}
              aria-haspopup="dialog"
              aria-label={textVisualStyle === 'filled' ? 'Text with background' : 'Plain text'}
              title={`Text – ${textVisualStyle === 'filled' ? 'with background' : 'plain'} (${SC.text})${railVariantToolTitleSuffix}`}
              className={cn(toolBtnClass, (textOpen || textActive) && toolBtnActiveClass)}
              {...textRailPress}
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
          </PopoverAnchor>
          <PopoverContent
            side={layout === 'vertical' ? 'left' : 'top'}
            align="center"
            className={railVariantPopoverClass}
          >
            <PopoverIconSegmentRow
              label="Style"
              labelHidden
              surface="rail"
              value={textVisualStyle}
              onChange={(v) => {
                if (v === 'plain' || v === 'filled') {
                  setTextVisualStyle(v)
                  setAnnotationMode('text')
                  setTextOpen(false)
                }
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
          </PopoverContent>
        </Popover>
      ) : (
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
              value={textThicknessStep}
              onChange={setTextThicknessStep}
              idPrefix="text"
              ariaLabel="Text size"
            />
          </div>
        </PopoverContent>
        </Popover>
      )}

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

      {useContextStrip ? (
        <Popover open={eraserOpen} onOpenChange={setEraserOpen}>
          <PopoverAnchor asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={eraserOpen}
              aria-haspopup="dialog"
              aria-label={`Eraser: ${eraserModeLabel}`}
              title={`${eraserModeLabel} (${SC.eraserStroke})${railVariantToolTitleSuffix}`}
              className={cn(toolBtnClass, (eraserOpen || eraserActive) && toolBtnActiveClass)}
              {...eraserRailPress}
            >
              {eraserSubMode === 'rubber' ? <PenEraserIcon /> : <ToolbarIcon icon={Eraser} />}
            </Button>
          </PopoverAnchor>
          <PopoverContent
            side={layout === 'vertical' ? 'left' : 'top'}
            align="center"
            className={railVariantPopoverClass}
          >
            <PopoverIconSegmentRow
              label="Mode"
              labelHidden
              surface="rail"
              value={eraserSubMode === 'line' ? 'line' : 'rubber'}
              onChange={(v) => {
                if (v === 'line') {
                  setEraserSubMode('line')
                  setAnnotationMode('eraser-line')
                } else {
                  setEraserSubMode('rubber')
                  setAnnotationMode('eraser')
                }
                setEraserOpen(false)
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
          </PopoverContent>
        </Popover>
      ) : (
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
                  previewDots={ANNOTATION_ERASER_THICKNESS_PREVIEW_DOTS}
                  ariaLabel="Eraser thickness"
                />
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-pressed={selectActive}
        aria-label="Select and move"
        title={`Select (${SC.select}); ${SC.selectAdd}, ${SC.selectSubtract}, ${SC.selectToggle}; ${SC.selectAll}, ${SC.deselectAll}; ${SC.duplicate}; ${SC.groupToggle} group/ungroup; ${SC.removeFromGroup} remove from group; double-click group for per-stroke outlines; Tab cycle stack. Pen: auto-group chip in top bar.`}
        onClick={() => {
          closeAllPopovers()
          setAnnotationMode('select')
        }}
        className={cn(toolBtnClass, selectActive && 'ring-2 ring-blue-400/55')}
      >
        <ToolbarIcon icon={MousePointer2} />
      </Button>
    </div>
  )
}
