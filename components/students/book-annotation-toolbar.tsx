'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
} from 'react'
import {
  Check,
  Circle,
  ScanSearch,
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
  Triangle,
  Type,
  Volume2,
  VolumeX,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import { ToolbarIcon, TOOLBAR_ICON_CLASS } from '@/components/students/annotation-toolbar-icon'
import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_SHAPE_FILL_SWATCHES,
  ANNOTATION_SOLID_PEN_SWATCHES,
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
  TopStripPenAutoGroupChip,
  TopStripShapeRoundedCornersChip,
  TopStripStraightStrokeChip,
} from '@/components/students/annotation-top-strip-controls'
import {
  RailSettingsPopoverAnchor,
  ToolSettingsAdvancedSection,
  ToolSettingsCheckboxRow,
  ToolSettingsPreviewBox,
  ToolSettingsSection,
  createRailToolSettingsPopoverContentProps,
  toolSettingsPopoverContentProps,
  toolSettingsStackClass,
} from '@/components/students/annotation-tool-settings-layout'
import { PenProfileCirclePicker } from '@/components/students/pen-profile-circle-picker'
import { PenToolStrokePreview } from '@/components/students/tool-previews/pen-tool-stroke-preview'
import { TextToolPreview } from '@/components/students/tool-previews/text-tool-preview'
import { ANNOTATION_TOOL_SETTINGS_PANEL } from '@/components/students/annotation-chrome-styles'
import type { MarqueeSelectRule } from '@/lib/books/annotation-select'
import { ThicknessSliderRow } from '@/components/students/annotation-thickness-slider-row'
import { SpectrumColorPicker } from '@/components/students/annotation-spectrum-picker'
import { ColorSwatchRow, PenSwatchRow } from '@/components/students/annotation-swatch-picker'
import type { AnnotationColorSource } from '@/lib/books/annotation-custom-color'
import {
  ANNOTATION_ERASER_THICKNESS_PREVIEW_DOTS,
  ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS,
  ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS,
  ANNOTATION_STAMP_THICKNESS_PREVIEW_DOTS,
  buildFineInkThicknessPreviewDots,
} from '@/lib/books/annotation-storage'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  TextAnnotationAlign,
  TextAnnotationVisualStyle,
  WritableStickerVariant,
} from '@/lib/books/annotation-command-types'
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import { TextFontPicker } from '@/components/students/text-font-picker'
import { TextStyleCirclePicker } from '@/components/students/text-style-circle-picker'
import { ShapeKindCirclePicker } from '@/components/students/shape-kind-circle-picker'
import { StickerKindCirclePicker } from '@/components/students/sticker-kind-circle-picker'
import { StampVariantCirclePicker } from '@/components/students/stamp-variant-circle-picker'
import { WritableStickerCirclePicker } from '@/components/students/writable-sticker-circle-picker'
import { EraserModeCirclePicker } from '@/components/students/eraser-mode-circle-picker'
import { EyedropperVariantCirclePicker } from '@/components/students/eyedropper-variant-circle-picker'
import { MarqueeRuleCirclePicker } from '@/components/students/marquee-rule-circle-picker'
import { ShapeToolPreview } from '@/components/students/tool-previews/shape-tool-preview'
import { MarkerToolPreview } from '@/components/students/tool-previews/marker-tool-preview'
import { WritableStickerPreview } from '@/components/students/tool-previews/writable-sticker-preview'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import {
  annotationRailSlotDataAttribute,
  type AnnotationRailToolSlot,
} from '@/lib/books/annotation-rail-tool-slot'
import {
  EYEDROPPER_VARIANT_LABEL,
  type EyedropperVariant,
} from '@/lib/books/eyedropper-variant'
import {
  filterPenSwatchesForProfile,
  penProfileWidthScaleMultiplier,
  PEN_STROKE_PROFILE_LABEL,
  penStrokeProfileLabel,
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

const SHAPE_KIND_SUBTITLE: Record<ShapeToolbarMode, string> = {
  line: 'Line',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  arrow: 'Arrow',
}

const SHAPE_CIRCLE_OPTIONS = SHAPE_TOOLBAR_MODES.map((mode) => ({
  value: mode,
  label: SHAPE_LABEL[mode],
  subtitle: SHAPE_KIND_SUBTITLE[mode],
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
  return <Check className={iconCls} strokeWidth={2} style={{ color: STAMP_COLOR_CHECK }} aria-hidden />
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
  stampEffectsEnabled: boolean
  setStampEffectsEnabled: (enabled: boolean) => void
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
  textAlign: TextAnnotationAlign
  setTextAlign: (v: TextAnnotationAlign) => void
  textFontId: AnnotationTextFontId
  setTextFontId: (id: AnnotationTextFontId) => void
  textFillColor: string
  setTextFillColor: (c: string) => void
  /** Page/spread canvas height for accurate text size preview (matches on-book rendering). */
  textPageHeightPx?: number
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
  shapeRoundedCorners?: boolean
  setShapeRoundedCorners?: (v: boolean) => void
  penAutoGroupConnected?: boolean
  setPenAutoGroupConnected?: (v: boolean) => void
  marqueeSelectRule?: MarqueeSelectRule
  setMarqueeSelectRule?: (r: MarqueeSelectRule) => void
  textSelectionActive?: boolean
  stickySelectionActive?: boolean
  shapeSelectionActive?: boolean
  penStrokeSelectionActive?: boolean
  markerStrokeSelectionActive?: boolean
  bookTextSpreadHasSelectable?: boolean
  bookTextCapabilityPending?: boolean
  onSettingsPanelOpenChange?: (open: boolean) => void
  /** Parent ref — call to close all rail tool settings panels (e.g. when drawing on the spread). */
  registerToolSettingsCloseRef?: MutableRefObject<(() => void) | null>
  eyedropperVariant: EyedropperVariant
  setEyedropperVariant: (v: EyedropperVariant) => void
  bookFocusZoomEnabled?: boolean
  focusZoomActive?: boolean
  focusZoomDrawActive?: boolean
  /** Toolbar crop button — always draw a new focus box. */
  onFocusZoomDraw?: () => void
  layout?: 'horizontal' | 'vertical'
  /** When true, rail mode: first click activates, second click opens settings panel. */
  useContextStrip?: boolean
  /** Override default circular tool button styling (e.g. floating side toolbar). */
  toolButtonClassName?: string
  toolButtonActiveClassName?: string
  isWhiteboardOpen?: boolean
}

const popoverContentClass =
  'w-[min(24rem,calc(100vw-2rem))] border-[#3d2a1a]/45 bg-[#1a1512] p-3.5 text-[#faf6ef] shadow-xl z-[80]'

const eraserPopoverCompactClass =
  'w-auto border-[#3d2a1a]/45 bg-[#1a1512] p-2 text-[#faf6ef] shadow-xl z-[80]'

const eyedropperPopoverClass =
  'w-auto border-[#3d2a1a]/45 bg-[#1a1512] p-2 text-[#faf6ef] shadow-xl z-[80]'

const EYEDROPPER_LONG_PRESS_MS = 450

const railSettingsTitleSuffix = ' · click again for settings'

/**
 * Rail: ignore Radix auto-close (picks / nested menus must not dismiss).
 * Close only via explicit setOpen(false) — tool toggle, click-away, or start drawing.
 */
function handleRailToolSettingsOpenChange(
  isRailMode: boolean,
  setOpen: (open: boolean) => void,
  nextOpen: boolean,
  onNonRailOpen?: () => void,
  onClose?: () => void,
) {
  if (isRailMode) {
    if (nextOpen) setOpen(true)
    return
  }
  setOpen(nextOpen)
  if (nextOpen) onNonRailOpen?.()
  else onClose?.()
}

/** Rail mode: first click activates; second click on active tool toggles settings panel. Right-click opens settings. */
function useRailToolSettingsPress(
  isActive: boolean,
  isPanelOpen: boolean,
  onActivate: () => void,
  onOpenPanel: () => void,
  onClosePanel: () => void,
) {
  const handlePrimaryClick = useCallback(() => {
    if (!isActive) onActivate()
    else if (isPanelOpen) onClosePanel()
    else onOpenPanel()
  }, [isActive, isPanelOpen, onActivate, onOpenPanel, onClosePanel])

  const handleOpenSettings = useCallback(() => {
    onActivate()
    onOpenPanel()
  }, [onActivate, onOpenPanel])

  return useMemo(
    () => ({
      onClick: handlePrimaryClick,
      onContextMenu: (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        e.stopPropagation()
        handleOpenSettings()
      },
    }),
    [handlePrimaryClick, handleOpenSettings],
  )
}

function toolSettingsPanelClass(useContextStrip: boolean, layout: 'horizontal' | 'vertical', compact = false) {
  if (useContextStrip && layout === 'vertical') {
    return compact
      ? cn(ANNOTATION_TOOL_SETTINGS_PANEL, 'w-auto overflow-x-hidden p-2')
      : ANNOTATION_TOOL_SETTINGS_PANEL
  }
  return compact ? eraserPopoverCompactClass : popoverContentClass
}

function settingsPanelStackClass(isRailMode: boolean) {
  return isRailMode ? toolSettingsStackClass : popoverStackClass
}

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

function railSlotAttrs(
  useContextStrip: boolean,
  layout: 'horizontal' | 'vertical',
  slot: AnnotationRailToolSlot,
) {
  return useContextStrip && layout === 'vertical' ? annotationRailSlotDataAttribute(slot) : {}
}

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
    textAlign,
    setTextAlign,
    textFontId,
    setTextFontId,
    textFillColor,
    setTextFillColor,
    textPageHeightPx,
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
    shapeRoundedCorners = true,
    setShapeRoundedCorners,
    penAutoGroupConnected = true,
    setPenAutoGroupConnected,
    marqueeSelectRule = 'follow-drag',
    setMarqueeSelectRule,
    textSelectionActive = false,
    stickySelectionActive = false,
    shapeSelectionActive = false,
    penStrokeSelectionActive = false,
    markerStrokeSelectionActive = false,
    bookTextSpreadHasSelectable = false,
    bookTextCapabilityPending = false,
    onSettingsPanelOpenChange,
    registerToolSettingsCloseRef,
    eyedropperVariant,
    setEyedropperVariant,
    bookFocusZoomEnabled = false,
    focusZoomActive = false,
    focusZoomDrawActive = false,
    onFocusZoomDraw,
    layout = 'horizontal',
    useContextStrip = false,
    toolButtonClassName,
    toolButtonActiveClassName,
    isWhiteboardOpen = false,
  } = props

  const resolvedToolBtnClass = toolButtonClassName ?? toolBtnClass
  const resolvedToolBtnActiveClass = toolButtonActiveClassName ?? toolBtnActiveClass

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
  const [selectOpen, setSelectOpen] = useState(false)
  const [calloutOpen, setCalloutOpen] = useState(false)
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
    which: 'pen' | 'marker' | 'eraser' | 'shapes' | 'stickers' | 'text' | 'eyedropper' | 'select' | 'callout',
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
    if (which !== 'select') setSelectOpen(false)
    if (which !== 'callout') setCalloutOpen(false)
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
    setSelectOpen(false)
    setCalloutOpen(false)
  }

  useEffect(() => {
    if (!registerToolSettingsCloseRef) return
    registerToolSettingsCloseRef.current = closeAllPopovers
    return () => {
      registerToolSettingsCloseRef.current = null
    }
  })

  const isRailMode = useContextStrip && layout === 'vertical'
  const showPenCreationOptions = !penStrokeSelectionActive
  const showMarkerCreationOptions = !markerStrokeSelectionActive
  const showShapeCreationOptions = !shapeSelectionActive
  const showTextCreationOptions = !textSelectionActive
  const showStickyCreationOptions = !stickySelectionActive
  const isFilledShape =
    annotationMode === 'rect' || annotationMode === 'ellipse' || annotationMode === 'triangle'
  const activeShapeKind: ShapeToolbarMode = SHAPE_TOOLBAR_MODES.includes(
    annotationMode as ShapeToolbarMode,
  )
    ? (annotationMode as ShapeToolbarMode)
    : shapeToolbarIcon

  useEffect(() => {
    if (!onSettingsPanelOpenChange) return
    const anyOpen =
      penOpen ||
      markerOpen ||
      eraserOpen ||
      shapesOpen ||
      stickersOpen ||
      textOpen ||
      eyedropperOpen ||
      selectOpen ||
      calloutOpen
    onSettingsPanelOpenChange(anyOpen)
  }, [
    penOpen,
    markerOpen,
    eraserOpen,
    shapesOpen,
    stickersOpen,
    textOpen,
    eyedropperOpen,
    selectOpen,
    calloutOpen,
    onSettingsPanelOpenChange,
  ])

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
  const focusZoomToolActive = focusZoomActive || focusZoomDrawActive
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
    // Rail: keep settings open so you can still tweak size/color after changing type.
    // Compact horizontal popovers still close on pick (quick single-choice menus).
    if (!isRailMode) setShapesOpen(false)
  }

  function activateShapeTool() {
    if (!SHAPE_TOOLBAR_MODES.includes(annotationMode as ShapeToolbarMode)) {
      setAnnotationMode(shapeToolbarIcon)
    }
  }

  const eyedropperRailPress = useRailToolSettingsPress(
    eyedropperActive,
    eyedropperOpen,
    () => {
      closeAllPopovers()
      setAnnotationMode('eyedropper')
    },
    () => {
      closeAllExcept('eyedropper')
      setEyedropperOpen(true)
    },
    () => setEyedropperOpen(false),
  )
  const shapesRailPress = useRailToolSettingsPress(
    shapesActive,
    shapesOpen,
    () => {
      closeAllPopovers()
      activateShapeTool()
    },
    () => {
      closeAllExcept('shapes')
      setShapesOpen(true)
    },
    () => setShapesOpen(false),
  )
  const stickersRailPress = useRailToolSettingsPress(
    stickerActive,
    stickersOpen,
    () => {
      closeAllPopovers()
      setAnnotationMode('sticker')
    },
    () => {
      closeAllExcept('stickers')
      setStickersOpen(true)
    },
    () => setStickersOpen(false),
  )
  const textRailPress = useRailToolSettingsPress(
    textActive,
    textOpen,
    () => {
      closeAllPopovers()
      setAnnotationMode('text')
    },
    () => {
      closeAllExcept('text')
      setTextOpen(true)
    },
    () => setTextOpen(false),
  )
  const eraserRailPress = useRailToolSettingsPress(
    eraserActive,
    eraserOpen,
    () => {
      closeAllPopovers()
      setAnnotationMode(eraserSubMode === 'line' ? 'eraser-line' : 'eraser')
    },
    () => {
      closeAllExcept('eraser')
      setEraserOpen(true)
    },
    () => setEraserOpen(false),
  )
  const penRailPress = useRailToolSettingsPress(
    penActive,
    penOpen,
    () => {
      closeAllPopovers()
      setAnnotationMode('pen')
    },
    () => {
      closeAllExcept('pen')
      setPenOpen(true)
    },
    () => setPenOpen(false),
  )
  const markerRailPress = useRailToolSettingsPress(
    markerActive,
    markerOpen,
    () => {
      closeAllPopovers()
      setAnnotationMode('marker')
    },
    () => {
      closeAllExcept('marker')
      setMarkerOpen(true)
    },
    () => setMarkerOpen(false),
  )
  const selectRailPress = useRailToolSettingsPress(
    selectActive,
    selectOpen,
    () => {
      closeAllPopovers()
      setAnnotationMode('select')
    },
    () => {
      closeAllExcept('select')
      setSelectOpen(true)
    },
    () => setSelectOpen(false),
  )
  const calloutRailPress = useRailToolSettingsPress(
    calloutActive,
    calloutOpen,
    () => {
      closeAllPopovers()
      setAnnotationMode('callout')
    },
    () => {
      closeAllExcept('callout')
      setCalloutOpen(true)
    },
    () => setCalloutOpen(false),
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
    <div
      className={cn(
        'flex shrink-0 items-center justify-center',
        layout === 'vertical' ? 'flex-col gap-0.5' : 'flex-nowrap gap-1',
      )}
    >
      <Popover
        open={penOpen}
        modal={isRailMode ? false : undefined}
        onOpenChange={(o) => {
          handleRailToolSettingsOpenChange(
            isRailMode,
            setPenOpen,
            o,
            () => {
              closeAllExcept('pen')
              setAnnotationMode('pen')
            },
            () => setPenSpectrumOpen(false),
          )
        }}
      >
        {isRailMode ? (
          <>
            <RailSettingsPopoverAnchor />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={penOpen}
              aria-haspopup="dialog"
              aria-pressed={penActive}
              aria-label={penStrokeProfileLabel(penStrokeProfile)}
              title={`${penStrokeProfileLabel(penStrokeProfile)} (${SC.pen})${railSettingsTitleSuffix}`}
              className={cn(resolvedToolBtnClass, (penOpen || penActive) && resolvedToolBtnActiveClass)}
              {...railSlotAttrs(useContextStrip, layout, 'pen')}
              {...penRailPress}
            >
              <ToolbarIcon
                icon={penProfileLucideIcon(penStrokeProfile)}
                colorDot={penColorSource === 'custom' ? penCustomHex : penSwatch.color}
              />
            </Button>
          </>
        ) : (
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={penOpen}
              aria-haspopup="dialog"
              aria-label="Pen settings"
              title={`Pen (${SC.pen})`}
              className={cn(resolvedToolBtnClass, (penOpen || penActive) && resolvedToolBtnActiveClass)}
            >
              <ToolbarIcon
                icon={penProfileLucideIcon(penStrokeProfile)}
                colorDot={penColorSource === 'custom' ? penCustomHex : penSwatch.color}
              />
            </Button>
          </PopoverTrigger>
        )}
        <PopoverContent
          {...toolSettingsPopoverContentProps(isRailMode, layout, closeAllPopovers)}
          className={toolSettingsPanelClass(useContextStrip, layout)}
        >
          <div className={settingsPanelStackClass(isRailMode)}>
            {showPenCreationOptions ? (
              <ToolSettingsPreviewBox label="Preview" ariaLabel="Pen stroke preview">
                <PenToolStrokePreview
                  penStrokeProfile={penStrokeProfile}
                  penThicknessStep={penThicknessStep}
                  penLineDashStyle={penLineDashStyle}
                  penSwatch={penSwatch}
                  penColorSource={penColorSource}
                  penCustomHex={penCustomHex}
                />
              </ToolSettingsPreviewBox>
            ) : null}
            {isRailMode ? (
              <ToolSettingsSection label="Pen type">
                <PenProfileCirclePicker
                  value={penStrokeProfile}
                  onChange={setPenStrokeProfile}
                  idPrefix="pen-profile"
                />
              </ToolSettingsSection>
            ) : (
              <PopoverIconSegmentRow
                label="Pen type"
                value={penStrokeProfile}
                onChange={(v) => setPenStrokeProfile(v as PenStrokeProfile)}
                idPrefix="pen-profile"
                options={PEN_PROFILE_OPTIONS}
              />
            )}
            {showPenCreationOptions ? (
              <>
                {isRailMode ? (
                  <ToolSettingsSection label="Color">
                    <PenSwatchRow
                      swatchId={penSwatchId}
                      colorSource={penColorSource}
                      customHex={penCustomHex}
                      onPick={pickPenPresetSwatch}
                      idPrefix="pen"
                      swatches={penSwatchesForProfile}
                      customPickerOpen={penSpectrumOpen}
                      onOpenCustomPicker={openPenSpectrumPicker}
                      labelHidden
                    />
                  </ToolSettingsSection>
                ) : (
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
                )}
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
                  surface={isRailMode ? 'rail' : 'default'}
                />
                <LineDashStyleIconRow
                  value={penLineDashStyle}
                  onChange={setPenLineDashStyle}
                  idPrefix="pen"
                  surface={isRailMode ? 'rail' : 'default'}
                />
                {isRailMode && setPenAutoGroupConnected ? (
                  <ToolSettingsAdvancedSection>
                    <ToolSettingsCheckboxRow
                      id="pen-panel-auto-group"
                      checked={penAutoGroupConnected}
                      onCheckedChange={setPenAutoGroupConnected}
                      label="Auto-group connected strokes"
                      description="Join touching pen strokes within a few seconds"
                    />
                  </ToolSettingsAdvancedSection>
                ) : setPenAutoGroupConnected ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <TopStripPenAutoGroupChip
                      active={penAutoGroupConnected}
                      onChange={setPenAutoGroupConnected}
                      idPrefix="pen-panel"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <PopoverHint>Use the selection bar to adjust the selected stroke.</PopoverHint>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={eyedropperOpen}
        modal={isRailMode ? false : undefined}
        onOpenChange={(o) => {
          handleRailToolSettingsOpenChange(isRailMode, setEyedropperOpen, o, () => closeAllExcept('eyedropper'))
        }}
      >
        {isRailMode ? (
          <>
            <RailSettingsPopoverAnchor />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={eyedropperOpen}
              aria-haspopup="dialog"
              aria-pressed={eyedropperActive}
              aria-label={EYEDROPPER_VARIANT_LABEL[eyedropperVariant]}
              title={`${eyedropperVariant === 'smart' ? 'Smart ink' : 'Sample color'} (${SC.eyedropper})${railSettingsTitleSuffix}`}
              className={cn('relative', resolvedToolBtnClass, (eyedropperOpen || eyedropperActive) && resolvedToolBtnActiveClass)}
              {...railSlotAttrs(useContextStrip, layout, 'eyedropper')}
              {...eyedropperRailPress}
            >
              {eyedropperVariant === 'smart' ? <SmartEyedropperIcon /> : <ToolbarIcon icon={Pipette} />}
            </Button>
          </>
        ) : (
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
              className={cn('relative', resolvedToolBtnClass, (eyedropperOpen || eyedropperActive) && resolvedToolBtnActiveClass)}
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
        )}
        <PopoverContent
          {...toolSettingsPopoverContentProps(isRailMode, layout, closeAllPopovers)}
          className={
            isRailMode ? toolSettingsPanelClass(useContextStrip, layout) : eyedropperPopoverClass
          }
        >
          {isRailMode ? (
            <div className={settingsPanelStackClass(isRailMode)}>
              <ToolSettingsSection label="Type">
                <EyedropperVariantCirclePicker
                  value={eyedropperVariant}
                  onChange={(v) => {
                    setEyedropperVariant(v)
                    setAnnotationMode('eyedropper')
                  }}
                  sampleIcon={<Pipette className={iconCls} strokeWidth={1.75} aria-hidden />}
                  smartIcon={<SmartEyedropperIcon />}
                  idPrefix="eyedropper-variant"
                />
              </ToolSettingsSection>
            </div>
          ) : (
            <div className="space-y-2">
              <PopoverIconSegmentRow
                label="Eyedropper"
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
          )}
        </PopoverContent>
      </Popover>

      <Popover
        open={markerOpen}
        modal={isRailMode ? false : undefined}
        onOpenChange={(o) => {
          handleRailToolSettingsOpenChange(isRailMode, setMarkerOpen, o, () => {
            closeAllExcept('marker')
            setAnnotationMode('marker')
          })
        }}
      >
        {isRailMode ? (
          <>
            <RailSettingsPopoverAnchor />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={markerOpen}
              aria-haspopup="dialog"
              aria-pressed={markerActive}
              aria-label="Highlighter"
              title={`Highlighter (${SC.highlighter})${railSettingsTitleSuffix}`}
              className={cn(resolvedToolBtnClass, (markerOpen || markerActive) && resolvedToolBtnActiveClass)}
              {...railSlotAttrs(useContextStrip, layout, 'marker')}
              {...markerRailPress}
            >
              <ToolbarIcon icon={Highlighter} colorDot={markerColor} />
            </Button>
          </>
        ) : (
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={markerOpen}
              aria-haspopup="dialog"
              aria-label="Highlighter settings"
              title={`Highlighter (${SC.highlighter})`}
              className={cn(resolvedToolBtnClass, (markerOpen || markerActive) && resolvedToolBtnActiveClass)}
            >
              <ToolbarIcon icon={Highlighter} colorDot={markerColor} />
            </Button>
          </PopoverTrigger>
        )}
        <PopoverContent
          {...toolSettingsPopoverContentProps(isRailMode, layout, closeAllPopovers)}
          className={toolSettingsPanelClass(useContextStrip, layout)}
        >
          <div className={settingsPanelStackClass(isRailMode)}>
            {showMarkerCreationOptions ? (
              <>
                {isRailMode ? (
                  <ToolSettingsPreviewBox label="Preview" ariaLabel="Highlighter preview">
                    <MarkerToolPreview
                      markerColor={markerColor}
                      markerThicknessStep={markerThicknessStep}
                    />
                  </ToolSettingsPreviewBox>
                ) : null}
                {isRailMode ? (
                  <ToolSettingsSection label="Color">
                    <ColorSwatchRow
                      colors={ANNOTATION_MARKER_SWATCHES}
                      current={markerColor}
                      onPick={pickMarkerSwatchColor}
                      idPrefix="marker"
                      labelHidden
                    />
                  </ToolSettingsSection>
                ) : (
                  <ColorSwatchRow
                    colors={ANNOTATION_MARKER_SWATCHES}
                    current={markerColor}
                    onPick={pickMarkerSwatchColor}
                    idPrefix="marker"
                  />
                )}
                <ThicknessSliderRow
                  value={markerThicknessStep}
                  onChange={setMarkerThicknessStep}
                  idPrefix="marker"
                  previewDots={ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS}
                  ariaLabel="Highlighter thickness"
                  surface={isRailMode ? 'rail' : 'default'}
                />
                {isRailMode ? (
                  <ToolSettingsAdvancedSection>
                    <ToolSettingsCheckboxRow
                      id="marker-panel-straight-stroke"
                      checked={markerStraightStroke}
                      onCheckedChange={setMarkerStraightStroke}
                      label="Straight horizontal"
                      description="Draws flat underlines"
                    />
                    <ToolSettingsCheckboxRow
                      id="marker-panel-decorated-edge"
                      checked={markerDecoratedEdge}
                      onCheckedChange={setMarkerDecoratedEdge}
                      label="Decorated edge"
                      description="Themed ornaments along the top of the highlight"
                    />
                  </ToolSettingsAdvancedSection>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <TopStripStraightStrokeChip
                        active={markerStraightStroke}
                        onChange={setMarkerStraightStroke}
                        idPrefix="marker-panel"
                      />
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
                      Straight stroke draws flat horizontal underlines. Decorated edge adds
                      themed ornaments on the top of the highlight (flames, waves, leaves by color).
                    </PopoverHint>
                  </>
                )}
              </>
            ) : (
              <PopoverHint>Use the selection bar to adjust the selected highlight.</PopoverHint>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={shapesOpen}
        modal={isRailMode ? false : undefined}
        onOpenChange={(o) => {
          handleRailToolSettingsOpenChange(isRailMode, setShapesOpen, o, () => {
            closeAllExcept('shapes')
            activateShapeTool()
          })
        }}
      >
        {isRailMode ? (
          <>
            <RailSettingsPopoverAnchor />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={shapesOpen}
              aria-haspopup="dialog"
              aria-label={`Shapes: ${SHAPE_LABEL[shapeToolbarIcon]}`}
              title={`Shapes – ${SHAPE_LABEL[shapeToolbarIcon]} (${SC.shapes})${railSettingsTitleSuffix}`}
              className={cn(resolvedToolBtnClass, (shapesOpen || shapesActive) && resolvedToolBtnActiveClass)}
              {...railSlotAttrs(useContextStrip, layout, 'shapes')}
              {...shapesRailPress}
            >
              <ToolbarIcon icon={shapeIconForMode(shapeToolbarIcon)} colorDot={shapeStrokeSwatch.color} />
            </Button>
          </>
        ) : (
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={shapesOpen}
              aria-haspopup="dialog"
              aria-label={`Shapes: ${SHAPE_LABEL[shapeToolbarIcon]}`}
              title={`Shapes – ${SHAPE_LABEL[shapeToolbarIcon]} (${SC.shapes}, press ${SC.shapeCycle})`}
              className={cn(resolvedToolBtnClass, (shapesOpen || shapesActive) && resolvedToolBtnActiveClass)}
            >
              <ToolbarIcon icon={shapeIconForMode(shapeToolbarIcon)} colorDot={shapeStrokeSwatch.color} />
            </Button>
          </PopoverTrigger>
        )}
        <PopoverContent
          {...toolSettingsPopoverContentProps(isRailMode, layout, closeAllPopovers)}
          className={cn(toolSettingsPanelClass(useContextStrip, layout), !isRailMode && 'w-[min(22rem,calc(100vw-2rem))]')}
        >
          <div className={settingsPanelStackClass(isRailMode)}>
            {isRailMode ? (
              showShapeCreationOptions ? (
                <>
                  <ToolSettingsPreviewBox label="Preview" ariaLabel="Shape preview">
                    <ShapeToolPreview
                      shapeKind={activeShapeKind}
                      shapeStrokeSwatch={shapeStrokeSwatch}
                      shapeThicknessStep={shapeThicknessStep}
                      shapeLineDashStyle={shapeLineDashStyle}
                      shapeStrokeEnabled={shapeStrokeEnabled}
                      shapeFillMode={shapeFillMode}
                      shapeFillColor={shapeFillColor}
                      shapeRoundedCorners={shapeRoundedCorners}
                    />
                  </ToolSettingsPreviewBox>
                  <ToolSettingsSection label="Shape">
                    <ShapeKindCirclePicker
                      value={activeShapeKind}
                      onChange={(m) => pickShape(m as ShapeToolbarMode)}
                      options={SHAPE_CIRCLE_OPTIONS}
                      idPrefix="shape-kind"
                    />
                  </ToolSettingsSection>
                  <ToolSettingsSection label="Stroke color">
                    <PenSwatchRow
                      swatchId={shapeStrokeSwatchId}
                      onPick={pickShapeStrokeSwatch}
                      idPrefix="shape-stroke"
                      labelHidden
                      swatches={ANNOTATION_SOLID_PEN_SWATCHES}
                    />
                  </ToolSettingsSection>
                  {isFilledShape ? (
                    <ShapeLineStyleIconRow
                      strokeEnabled={shapeStrokeEnabled}
                      lineDashStyle={shapeLineDashStyle}
                      onStrokeEnabledChange={setShapeStrokeEnabled}
                      onLineDashStyleChange={setShapeLineDashStyle}
                      fillMode={shapeFillMode}
                      onFillModeChange={setShapeFillMode}
                      idPrefix="shape"
                      surface="rail"
                    />
                  ) : (
                    <LineDashStyleIconRow
                      value={shapeLineDashStyle}
                      onChange={setShapeLineDashStyle}
                      idPrefix="shape"
                      surface="rail"
                      label="Outline"
                    />
                  )}
                  {isFilledShape ? (
                    <>
                      <ShapeFillIconRow
                        fillMode={shapeFillMode}
                        onFillModeChange={setShapeFillMode}
                        strokeEnabled={shapeStrokeEnabled}
                        onStrokeEnabledChange={setShapeStrokeEnabled}
                        idPrefix="shape"
                        surface="rail"
                      />
                      {shapeFillModeHasFill(shapeFillMode) ? (
                        <ToolSettingsSection label="Fill color">
                          <ColorSwatchRow
                            colors={ANNOTATION_SHAPE_FILL_SWATCHES}
                            current={shapeFillColor}
                            onPick={setShapeFillColor}
                            idPrefix="shape-fill"
                            labelHidden
                          />
                        </ToolSettingsSection>
                      ) : null}
                    </>
                  ) : null}
                  <ThicknessSliderRow
                    value={shapeThicknessStep}
                    onChange={setShapeThicknessStep}
                    idPrefix="shape"
                    previewDots={ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS}
                    ariaLabel="Shape stroke width"
                    surface="rail"
                  />
                  {isFilledShape && setShapeRoundedCorners ? (
                    <ToolSettingsAdvancedSection>
                      <ToolSettingsCheckboxRow
                        id="shape-panel-rounded-corners"
                        checked={shapeRoundedCorners}
                        onCheckedChange={setShapeRoundedCorners}
                        label="Rounded corners"
                        description="Softer corners on rectangles and ellipses"
                      />
                    </ToolSettingsAdvancedSection>
                  ) : null}
                </>
              ) : (
                <PopoverHint>Use the selection bar to adjust the selected shape.</PopoverHint>
              )
            ) : (
              <>
                <PopoverIconGridRow
                  label="Shape"
                  value={activeShapeKind}
                  onChange={(m) => pickShape(m as ShapeToolbarMode)}
                  idPrefix="shape-kind"
                  options={SHAPE_ICON_OPTIONS}
                />
                {showShapeCreationOptions ? (
                  <>
                    <PenSwatchRow
                      swatchId={shapeStrokeSwatchId}
                      onPick={pickShapeStrokeSwatch}
                      idPrefix="shape-stroke"
                      label="Stroke color"
                      swatches={ANNOTATION_SOLID_PEN_SWATCHES}
                    />
                    {isFilledShape ? (
                      <ShapeLineStyleIconRow
                        strokeEnabled={shapeStrokeEnabled}
                        lineDashStyle={shapeLineDashStyle}
                        onStrokeEnabledChange={setShapeStrokeEnabled}
                        onLineDashStyleChange={setShapeLineDashStyle}
                        fillMode={shapeFillMode}
                        onFillModeChange={setShapeFillMode}
                        idPrefix="shape"
                        surface="default"
                      />
                    ) : (
                      <LineDashStyleIconRow
                        value={shapeLineDashStyle}
                        onChange={setShapeLineDashStyle}
                        idPrefix="shape"
                        surface="default"
                        label="Line style"
                      />
                    )}
                    {isFilledShape ? (
                      <>
                        <ShapeFillIconRow
                          fillMode={shapeFillMode}
                          onFillModeChange={setShapeFillMode}
                          strokeEnabled={shapeStrokeEnabled}
                          onStrokeEnabledChange={setShapeStrokeEnabled}
                          idPrefix="shape"
                          surface="default"
                        />
                        {shapeFillModeHasFill(shapeFillMode) ? (
                          <ColorSwatchRow
                            colors={ANNOTATION_SHAPE_FILL_SWATCHES}
                            current={shapeFillColor}
                            onPick={setShapeFillColor}
                            idPrefix="shape-fill"
                            label="Fill color"
                          />
                        ) : null}
                      </>
                    ) : null}
                    <ThicknessSliderRow
                      value={shapeThicknessStep}
                      onChange={setShapeThicknessStep}
                      idPrefix="shape"
                      previewDots={ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS}
                      ariaLabel="Shape stroke width"
                      surface="default"
                    />
                    {isFilledShape && setShapeRoundedCorners ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <TopStripShapeRoundedCornersChip
                          active={shapeRoundedCorners}
                          onChange={setShapeRoundedCorners}
                          idPrefix="shape-panel"
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <PopoverHint>Use the selection bar to adjust the selected shape.</PopoverHint>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={stickersOpen}
        modal={isRailMode ? false : undefined}
        onOpenChange={(o) => {
          handleRailToolSettingsOpenChange(isRailMode, setStickersOpen, o, () => {
            closeAllExcept('stickers')
            setAnnotationMode('sticker')
          })
        }}
      >
        {isRailMode ? (
          <>
            <RailSettingsPopoverAnchor />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={stickersOpen}
              aria-haspopup="dialog"
              aria-label={`Sticker: ${stickerToolbarLabel}`}
              title={`Sticker – ${stickerToolbarLabel} (${SC.sticker})${railSettingsTitleSuffix}`}
              className={cn(resolvedToolBtnClass, (stickersOpen || stickerActive) && resolvedToolBtnActiveClass)}
              {...railSlotAttrs(useContextStrip, layout, 'stickers')}
              {...stickersRailPress}
            >
              {stickerToolbarIcon}
            </Button>
          </>
        ) : (
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={stickersOpen}
              aria-haspopup="dialog"
              aria-label={`Sticker: ${stickerToolbarLabel}`}
              title={`Sticker – ${stickerToolbarLabel} (${SC.sticker}, ${SC.stickerVariants}; ${SC.stickyWritable} for writable)`}
              className={cn(resolvedToolBtnClass, (stickersOpen || stickerActive) && resolvedToolBtnActiveClass)}
            >
              {stickerToolbarIcon}
            </Button>
          </PopoverTrigger>
        )}
        <PopoverContent
          {...toolSettingsPopoverContentProps(isRailMode, layout, closeAllPopovers)}
          className={toolSettingsPanelClass(useContextStrip, layout)}
        >
          <div className={settingsPanelStackClass(isRailMode)}>
            {isRailMode ? (
              <>
                {stickerKind === 'writable' && showStickyCreationOptions ? (
                  <ToolSettingsPreviewBox label="Preview" ariaLabel="Writable sticker preview">
                    <WritableStickerPreview
                      writableStickerVariant={writableStickerVariant}
                      stickyFillColor={stickyFillColor}
                      stickyThicknessStep={stickyThicknessStep}
                      pageHeightPx={textPageHeightPx}
                    />
                  </ToolSettingsPreviewBox>
                ) : null}
                <ToolSettingsSection label="Kind">
                  <StickerKindCirclePicker
                    value={stickerKind}
                    onChange={(kind) => {
                      setStickerKind(kind)
                      setAnnotationMode('sticker')
                    }}
                    quickIcon={stampIconForVariant(stampVariant, stampQuestionColor)}
                    writableIcon={writableStickerIcon(writableStickerVariant)}
                    idPrefix="sticker-kind"
                  />
                </ToolSettingsSection>
                {stickerKind === 'quick' ? (
                  <>
                    <ToolSettingsSection label="Sticker">
                      <StampVariantCirclePicker
                        value={stampVariant}
                        onChange={(v) => {
                          setStampVariant(v)
                          setStickerKind('quick')
                          setAnnotationMode('sticker')
                        }}
                        iconForVariant={(v) =>
                          stampIconForVariant(v, v === 'question' ? stampQuestionColor : '')
                        }
                        idPrefix="sticker-quick-variant"
                      />
                    </ToolSettingsSection>
                    {stampVariant === 'question' ? (
                      <ToolSettingsSection label="Question color">
                        <ColorSwatchRow
                          colors={ANNOTATION_STAMP_QUESTION_SWATCHES}
                          current={stampQuestionColor}
                          onPick={setStampQuestionColor}
                          idPrefix="stamp-question"
                          labelHidden
                        />
                      </ToolSettingsSection>
                    ) : null}
                    <ThicknessSliderRow
                      value={stampThicknessStep}
                      onChange={setStampThicknessStep}
                      idPrefix="stamp"
                      previewDots={ANNOTATION_STAMP_THICKNESS_PREVIEW_DOTS}
                      ariaLabel="Sticker size"
                      surface="rail"
                    />
                    <ToolSettingsAdvancedSection>
                      <ToolSettingsCheckboxRow
                        id="stamp-panel-effects"
                        checked={stampEffectsEnabled}
                        onCheckedChange={setStampEffectsEnabled}
                        label="Sound and motion"
                        description="Play effects when placing stamps"
                      />
                    </ToolSettingsAdvancedSection>
                  </>
                ) : showStickyCreationOptions ? (
                  <>
                    <ToolSettingsSection label="Type">
                      <WritableStickerCirclePicker
                        value={writableStickerVariant}
                        onChange={(v) => {
                          setWritableStickerVariant(v)
                          setStickerKind('writable')
                          setAnnotationMode('sticker')
                        }}
                        iconForVariant={writableStickerIcon}
                        idPrefix="sticker-writable-variant"
                      />
                    </ToolSettingsSection>
                    <ToolSettingsSection label="Fill color">
                      <ColorSwatchRow
                        colors={ANNOTATION_STICKY_FILL_SWATCHES}
                        current={stickyFillColor}
                        onPick={setStickyFillColor}
                        idPrefix="sticky"
                        labelHidden
                      />
                    </ToolSettingsSection>
                    <ThicknessSliderRow
                      value={stickyThicknessStep}
                      onChange={setStickyThicknessStep}
                      idPrefix="sticky"
                      ariaLabel="Text size"
                      surface="rail"
                    />
                  </>
                ) : (
                  <PopoverHint>Use the selection bar to adjust the selected note.</PopoverHint>
                )}
              </>
            ) : (
              <>
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
                  surface="default"
                />
                  <button
                    type="button"
                    className={cn(
                      'flex h-8 w-full items-center justify-center gap-2 rounded-md border border-white/12 bg-white/5 px-2 text-xs transition-colors hover:bg-white/10',
                      'text-[#faf6ef]/90',
                      stampEffectsEnabled && 'border-amber-400/40 bg-amber-400/10',
                    )}
                    aria-pressed={stampEffectsEnabled}
                    aria-label={
                      stampEffectsEnabled ? 'Stamp sound and motion on' : 'Stamp sound and motion off'
                    }
                    title={stampEffectsEnabled ? 'Stamp effects on' : 'Stamp effects off'}
                    onClick={() => setStampEffectsEnabled(!stampEffectsEnabled)}
                  >
                    {stampEffectsEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" aria-hidden />
                    )}
                    <span>{stampEffectsEnabled ? 'Effects on' : 'Effects off'}</span>
                  </button>
              </>
            ) : showStickyCreationOptions ? (
              <>
                    <PopoverHint>
                      Tap the page to place. Notes use your pick color; captions default to dark; speech and thinking bubbles default to white with an outline.
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
            ) : (
              <PopoverHint>Use the selection bar to adjust the selected note.</PopoverHint>
            )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={textOpen}
        modal={isRailMode ? false : undefined}
        onOpenChange={(o) => {
          handleRailToolSettingsOpenChange(isRailMode, setTextOpen, o, () => {
            closeAllExcept('text')
            setAnnotationMode('text')
          })
        }}
      >
        {isRailMode ? (
          <>
            <RailSettingsPopoverAnchor />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={textOpen}
              aria-haspopup="dialog"
              aria-label={textVisualStyle === 'filled' ? 'Text with background' : 'Plain text'}
              title={`Text – ${textVisualStyle === 'filled' ? 'with background' : 'plain'} (${SC.text})${railSettingsTitleSuffix}`}
              className={cn(resolvedToolBtnClass, (textOpen || textActive) && resolvedToolBtnActiveClass)}
              {...railSlotAttrs(useContextStrip, layout, 'text')}
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
          </>
        ) : (
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={textOpen}
              aria-haspopup="dialog"
              aria-label={textVisualStyle === 'filled' ? 'Text with background' : 'Plain text'}
              title={`Text – ${textVisualStyle === 'filled' ? 'with background' : 'plain'} (${SC.text})`}
              className={cn(resolvedToolBtnClass, (textOpen || textActive) && resolvedToolBtnActiveClass)}
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
        )}
        <PopoverContent
          {...toolSettingsPopoverContentProps(isRailMode, layout, closeAllPopovers)}
          className={toolSettingsPanelClass(useContextStrip, layout)}
        >
          <div className={settingsPanelStackClass(isRailMode)}>
            {showTextCreationOptions ? (
              <ToolSettingsPreviewBox label="Preview" ariaLabel="Text preview">
                <TextToolPreview
                  textFontId={textFontId}
                  textVisualStyle={textVisualStyle}
                  textAlign={textAlign}
                  textThicknessStep={textThicknessStep}
                  textColor={textColor}
                  textFillColor={textFillColor}
                  pageHeightPx={textPageHeightPx}
                />
              </ToolSettingsPreviewBox>
            ) : null}
            {isRailMode ? (
              <>
                <ToolSettingsSection label="Style">
                  <TextStyleCirclePicker
                    value={textVisualStyle}
                    onChange={setTextVisualStyle}
                    idPrefix="text-style"
                  />
                </ToolSettingsSection>
                <ToolSettingsSection label="Alignment">
                  <PopoverIconSegmentRow
                    label="Alignment"
                    labelHidden
                    surface="rail"
                    value={textAlign}
                    onChange={(v) => {
                      if (v === 'left' || v === 'center' || v === 'right') setTextAlign(v)
                    }}
                    idPrefix="text-align"
                    options={[
                      {
                        value: 'left',
                        ariaLabel: 'Align left',
                        icon: <AlignLeft className={iconCls} strokeWidth={1.75} aria-hidden />,
                      },
                      {
                        value: 'center',
                        ariaLabel: 'Align center',
                        icon: <AlignCenter className={iconCls} strokeWidth={1.75} aria-hidden />,
                      },
                      {
                        value: 'right',
                        ariaLabel: 'Align right',
                        icon: <AlignRight className={iconCls} strokeWidth={1.75} aria-hidden />,
                      },
                    ]}
                  />
                </ToolSettingsSection>
                <ToolSettingsSection label="Font">
                  <TextFontPicker
                    value={textFontId}
                    onChange={setTextFontId}
                    idPrefix="rail-text"
                    surface="rail"
                  />
                </ToolSettingsSection>
              </>
            ) : (
              <>
                <PopoverIconSegmentRow
                  label="Style"
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
                <PopoverIconSegmentRow
                  label="Alignment"
                  value={textAlign}
                  onChange={(v) => {
                    if (v === 'left' || v === 'center' || v === 'right') setTextAlign(v)
                  }}
                  idPrefix="text-align"
                  options={[
                    {
                      value: 'left',
                      ariaLabel: 'Align left',
                      icon: <AlignLeft className={iconCls} strokeWidth={1.75} aria-hidden />,
                    },
                    {
                      value: 'center',
                      ariaLabel: 'Align center',
                      icon: <AlignCenter className={iconCls} strokeWidth={1.75} aria-hidden />,
                    },
                    {
                      value: 'right',
                      ariaLabel: 'Align right',
                      icon: <AlignRight className={iconCls} strokeWidth={1.75} aria-hidden />,
                    },
                  ]}
                />
                <TextFontPicker
                  value={textFontId}
                  onChange={setTextFontId}
                  idPrefix="text"
                  surface="default"
                />
              </>
            )}
            {showTextCreationOptions ? (
              <>
                {isRailMode ? (
                  <>
                    <ToolSettingsSection label="Text color">
                      <ColorSwatchRow
                        colors={ANNOTATION_TEXT_STROKE_SWATCHES}
                        current={textColor}
                        onPick={setTextColor}
                        idPrefix="text"
                        labelHidden
                      />
                    </ToolSettingsSection>
                    {textVisualStyle === 'filled' ? (
                      <ToolSettingsSection label="Background">
                        <ColorSwatchRow
                          colors={ANNOTATION_TEXT_FILL_SWATCHES}
                          current={textFillColor}
                          onPick={setTextFillColor}
                          idPrefix="text-fill"
                          labelHidden
                        />
                      </ToolSettingsSection>
                    ) : null}
                    <ThicknessSliderRow
                      value={textThicknessStep}
                      onChange={setTextThicknessStep}
                      idPrefix="text"
                      ariaLabel="Text size"
                      surface="rail"
                    />
                    <ToolSettingsAdvancedSection
                      hint="Tap the page to place one text box. Plain is text only; Background adds a fill per line. Enter for a new line, Ctrl+Enter to finish, Ctrl+A to select all, Escape or click away when done."
                    />
                  </>
                ) : (
                  <>
                    <PopoverHint>
                      Tap the page to place one text box. Plain is text only; Background adds a fill per line. Enter for a new
                      line, Ctrl+Enter to finish, Ctrl+A to select all, Escape or click away when done.
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
                  </>
                )}
              </>
            ) : (
              <PopoverHint>Use the selection bar to adjust the selected text.</PopoverHint>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {isRailMode ? (
        <Popover
          open={calloutOpen}
          modal={false}
          onOpenChange={(o) => {
            handleRailToolSettingsOpenChange(isRailMode, setCalloutOpen, o)
          }}
        >
          <RailSettingsPopoverAnchor />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={calloutOpen}
            aria-haspopup="dialog"
            aria-pressed={calloutActive}
            aria-label="Numbered callout"
            title={`Numbered callout (${SC.callout})${railSettingsTitleSuffix}`}
            className={cn(resolvedToolBtnClass, (calloutOpen || calloutActive) && resolvedToolBtnActiveClass)}
            {...railSlotAttrs(useContextStrip, layout, 'callout')}
            {...calloutRailPress}
          >
            <ToolbarIcon icon={Circle} colorDot={shapeStrokeSwatch.color} />
          </Button>
          <PopoverContent
            {...createRailToolSettingsPopoverContentProps(closeAllPopovers)}
            className={toolSettingsPanelClass(useContextStrip, layout)}
          >
            <div className={toolSettingsStackClass}>
              <ToolSettingsSection label="Stroke color">
                <PenSwatchRow
                  swatchId={shapeStrokeSwatchId}
                  onPick={pickShapeStrokeSwatch}
                  idPrefix="callout-stroke"
                  labelHidden
                  swatches={ANNOTATION_SOLID_PEN_SWATCHES}
                />
              </ToolSettingsSection>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
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
          className={cn(resolvedToolBtnClass, calloutActive && resolvedToolBtnActiveClass)}
        >
          <ToolbarIcon icon={Circle} colorDot={shapeStrokeSwatch.color} />
        </Button>
      )}

      <Popover
        open={eraserOpen}
        modal={isRailMode ? false : undefined}
        onOpenChange={(o) => {
          handleRailToolSettingsOpenChange(isRailMode, setEraserOpen, o, () => {
            closeAllExcept('eraser')
            if (annotationMode !== 'eraser' && annotationMode !== 'eraser-line') {
              setAnnotationMode('eraser-line')
            }
          })
        }}
      >
        {isRailMode ? (
          <>
            <RailSettingsPopoverAnchor />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={eraserOpen}
              aria-haspopup="dialog"
              aria-label={`Eraser: ${eraserModeLabel}`}
              title={`${eraserModeLabel} (${SC.eraserStroke})${railSettingsTitleSuffix}`}
              className={cn(resolvedToolBtnClass, (eraserOpen || eraserActive) && resolvedToolBtnActiveClass)}
              {...railSlotAttrs(useContextStrip, layout, 'eraser')}
              {...eraserRailPress}
            >
              {eraserSubMode === 'rubber' ? <PenEraserIcon /> : <ToolbarIcon icon={Eraser} />}
            </Button>
          </>
        ) : (
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={eraserOpen}
              aria-haspopup="dialog"
              aria-label={`Eraser: ${eraserModeLabel}`}
              title={`${eraserModeLabel} (${SC.eraserStroke}, press ${SC.eraserRub} for rub)`}
              className={cn(resolvedToolBtnClass, (eraserOpen || eraserActive) && resolvedToolBtnActiveClass)}
            >
              {eraserSubMode === 'rubber' ? <PenEraserIcon /> : <ToolbarIcon icon={Eraser} />}
            </Button>
          </PopoverTrigger>
        )}
        <PopoverContent
          {...toolSettingsPopoverContentProps(isRailMode, layout, closeAllPopovers)}
          className={
            isRailMode
              ? toolSettingsPanelClass(useContextStrip, layout, eraserSubMode === 'line')
              : eraserSubMode === 'line'
                ? eraserPopoverCompactClass
                : popoverContentClass
          }
        >
          <div className={eraserSubMode === 'line' && !isRailMode ? 'space-y-0' : settingsPanelStackClass(isRailMode)}>
            {isRailMode ? (
              <ToolSettingsSection label="Mode">
                <EraserModeCirclePicker
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
                  rubberIcon={<PenEraserIcon />}
                  lineIcon={<Eraser className={iconCls} strokeWidth={1.75} aria-hidden />}
                  idPrefix="eraser-mode"
                />
              </ToolSettingsSection>
            ) : (
              <PopoverIconSegmentRow
                label="Mode"
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
            )}
            {eraserSubMode === 'rubber' ? (
              <ThicknessSliderRow
                value={eraserPixelThicknessStep}
                onChange={setEraserPixelThicknessStep}
                idPrefix="eraser-pixel"
                previewDots={ANNOTATION_ERASER_THICKNESS_PREVIEW_DOTS}
                ariaLabel="Eraser thickness"
                surface={isRailMode ? 'rail' : 'default'}
              />
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      {bookFocusZoomEnabled ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-pressed={focusZoomToolActive}
          aria-label="Focus zoom"
          title={`Focus — drag a box to zoom in (${SC.focusZoom} same; Esc exits)`}
          onClick={() => {
            closeAllPopovers()
            onFocusZoomDraw?.()
          }}
          className={cn(
            resolvedToolBtnClass,
            focusZoomDrawActive && 'ring-2 ring-amber-400/60',
            focusZoomActive && !focusZoomDrawActive && 'ring-2 ring-sky-400/55',
          )}
          {...railSlotAttrs(useContextStrip, layout, 'focus')}
        >
          <ToolbarIcon icon={ScanSearch} />
        </Button>
      ) : null}

      {isRailMode ? (
        <Popover
          open={selectOpen}
          modal={false}
          onOpenChange={(o) => {
            handleRailToolSettingsOpenChange(isRailMode, setSelectOpen, o)
          }}
        >
          <RailSettingsPopoverAnchor />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-expanded={selectOpen}
            aria-haspopup="dialog"
            aria-pressed={selectActive}
            aria-label="Select and move"
            title={`Select (${SC.select})${railSettingsTitleSuffix}`}
            className={cn(resolvedToolBtnClass, (selectOpen || selectActive) && 'ring-2 ring-blue-400/55')}
            {...railSlotAttrs(useContextStrip, layout, 'select')}
            {...selectRailPress}
          >
            <ToolbarIcon icon={MousePointer2} />
          </Button>
          <PopoverContent
            {...createRailToolSettingsPopoverContentProps(closeAllPopovers)}
            className={toolSettingsPanelClass(useContextStrip, layout)}
          >
            <div className={toolSettingsStackClass}>
              {setMarqueeSelectRule ? (
                <ToolSettingsSection label="Marquee rule">
                  <MarqueeRuleCirclePicker
                    value={marqueeSelectRule}
                    onChange={setMarqueeSelectRule}
                    idPrefix="select-panel"
                  />
                </ToolSettingsSection>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-pressed={selectActive}
          aria-label="Select and move"
          title={`Select (${SC.select}) — marquee ink, drag PDF text to copy; ${SC.selectAdd}, ${SC.selectSubtract}, ${SC.selectToggle}; ${SC.selectAll}, ${SC.selectAllIncludingLocked}; ${SC.deselectAll} to clear; ${SC.duplicate}; ${SC.groupToggle} group/ungroup; ${SC.removeFromGroup} remove from group; double-click group for per-stroke outlines; Tab cycle stack.`}
          onClick={() => {
            closeAllPopovers()
            setAnnotationMode('select')
          }}
          className={cn(resolvedToolBtnClass, selectActive && 'ring-2 ring-blue-400/55')}
        >
          <ToolbarIcon icon={MousePointer2} />
        </Button>
      )}
    </div>
  )
}
