import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import { annotationTargetPageIfChanged } from '@/lib/books/annotation-target-page'
import {
  type AnnotationColorSource,
  isValidCustomHex,
  normalizeCustomHex,
} from '@/lib/books/annotation-custom-color'
import {
  ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS,
  ANNOTATION_STROKE_WIDTH_STEPS,
  type AnnotationStrokeThicknessStep,
  type BookAnnotationInteractionMode,
} from '@/lib/books/annotation-storage'
import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
  DEFAULT_TEXT_FILL_COLOR,
  DEFAULT_PEN_SWATCH_ID,
  DEFAULT_SHAPE_STROKE_SWATCH_ID,
  DEFAULT_SHAPE_FILL_COLOR,
  DEFAULT_STAMP_QUESTION_COLOR,
  DEFAULT_STICKY_FILL_COLOR,
  DEFAULT_TEXT_COLOR,
  getPenSwatch,
} from '@/lib/books/annotation-palettes'
import { DEFAULT_EYEDROPPER_VARIANT, type EyedropperVariant } from '@/lib/books/eyedropper-variant'
import { ANNOTATION_RAIL_PIN_STORAGE_KEY } from '@/components/students/fullscreen-book-overlay/hooks/useAnnotationRailHoverChrome'
import {
  DEFAULT_MARKER_CUSTOM_HEX,
  DEFAULT_PEN_CUSTOM_HEX,
} from '@/lib/books/student-annotation-tool-prefs'
import { pushStripRecent } from '@/lib/books/annotation-strip-recents'
import {
  buildStudentAnnotationToolPrefsPatch,
  patchStudentAnnotationToolPrefs,
  resolveAnnotationToolPrefsFromStorage,
  resolveStampToolPrefsFromStorage,
} from '@/lib/books/student-annotation-tool-prefs'
import type { PenInkStyle } from '@/lib/books/pen-ink'
import {
  preloadActiveEffectPenInk,
  preloadEffectPenProfileSwatches,
} from '@/lib/books/effect-pen-preload'
import {
  coercePenSwatchIdForProfile,
  DEFAULT_PEN_STROKE_PROFILE,
  normalizeActivePenStrokeProfile,
  penProfileWidthScaleMultiplier,
  resolvePenInkStyleForProfile,
  type PenStrokeProfile,
} from '@/lib/books/pen-stroke-profile'
import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  TextAnnotationAlign,
  TextAnnotationVisualStyle,
  WritableStickerVariant,
} from '@/lib/books/annotation-command-types'
import {
  isQuickStickerInteraction,
  STICKER_QUICK_VARIANTS,
  type StickerKind,
} from '@/lib/books/sticker-tool'
import type { AnnotationCapabilities, BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { ANNOTATION_TEXT_FONT_NORM_STEPS } from '@/components/students/fullscreen-book-overlay/constants'
import {
  DEFAULT_ANNOTATION_TEXT_FONT_ID,
  type AnnotationTextFontId,
} from '@/lib/books/annotation-text-fonts'
import { useCtrlTemporarySelect } from '@/components/students/fullscreen-book-overlay/hooks/useCtrlTemporarySelect'
import {
  createCompositeInkSessionSelectProxy,
  createInkSessionSelectProxy,
  createSpreadSessionSelectProxy,
  type InkSessionSelectProxyHandle,
} from '@/lib/books/ink-session-select-proxy'
import { lockPenFigureAutoJoinOnCommands } from '@/lib/books/annotation-pen-auto-group'
import { whiteboardInkSessionEnabled } from '@/lib/books/feature-flags'
import type { SpreadSessionStore } from '@/lib/books/spread-session-store'
import type { WhiteboardSessionStore } from '@/lib/books/whiteboard-session-store'

interface UseAnnotationControllerArgs {
  studentId: string
  pageNumber: number
  isWhiteboardOpen: boolean
  showSpreadRight: boolean
  spreadRightPage: number | null
  overlayOpen: boolean
  spreadSessionStoreRef?: MutableRefObject<SpreadSessionStore | null>
  whiteboardSessionStoreRef?: MutableRefObject<WhiteboardSessionStore | null>
}

export function useAnnotationController({
  studentId,
  pageNumber,
  isWhiteboardOpen,
  showSpreadRight,
  spreadRightPage,
  overlayOpen,
  spreadSessionStoreRef,
  whiteboardSessionStoreRef,
}: UseAnnotationControllerArgs) {
  const [wbCaps, setWbCaps] = useState<AnnotationCapabilities>({ canUndo: false, canRedo: false })
  const [annotationMode, setAnnotationMode] = useState<BookAnnotationInteractionMode>('pen')
  const prevAnnotationModeRef = useRef<BookAnnotationInteractionMode | null>(null)
  const prevQuickStickerRef = useRef(false)

  const ctrlTemporarySelect = useCtrlTemporarySelect({
    enabled: overlayOpen,
  })

  const effectiveAnnotationMode: BookAnnotationInteractionMode = useMemo(
    () =>
      ctrlTemporarySelect && annotationMode !== 'select' ? 'select' : annotationMode,
    [ctrlTemporarySelect, annotationMode],
  )
  const [stickerKind, setStickerKind] = useState<StickerKind>('quick')
  const [writableStickerVariant, setWritableStickerVariant] = useState<WritableStickerVariant>('note')
  const [stampVariant, setStampVariant] = useState<StampVariant>('check')
  const [stampIndicatorPulseEpoch, setStampIndicatorPulseEpoch] = useState(0)
  const pulseStampIndicator = useCallback(() => {
    setStampIndicatorPulseEpoch((n) => n + 1)
  }, [])
  const [stampQuestionColor, setStampQuestionColor] = useState<string>(DEFAULT_STAMP_QUESTION_COLOR)
  const [stampEffectsEnabled, setStampEffectsEnabled] = useState(true)
  const [penSwatchId, setPenSwatchId] = useState<string>(DEFAULT_PEN_SWATCH_ID)
  const [penStrokeProfile, setPenStrokeProfileState] = useState<PenStrokeProfile>(DEFAULT_PEN_STROKE_PROFILE)
  const [penColorSource, setPenColorSource] = useState<AnnotationColorSource>('swatch')
  const [penCustomHex, setPenCustomHex] = useState<string>(DEFAULT_PEN_CUSTOM_HEX)
  const [textColor, setTextColor] = useState<string>(DEFAULT_TEXT_COLOR)
  const [shapeStrokeSwatchId, setShapeStrokeSwatchId] = useState<string>(DEFAULT_SHAPE_STROKE_SWATCH_ID)
  const [stickyFillColor, setStickyFillColor] = useState<string>(DEFAULT_STICKY_FILL_COLOR)
  const penSwatch = useMemo(() => getPenSwatch(penSwatchId), [penSwatchId])
  const penColor = penColorSource === 'custom' ? penCustomHex : penSwatch.color
  const penInkStyle: PenInkStyle = resolvePenInkStyleForProfile(
    penStrokeProfile,
    penSwatch,
    penColorSource,
  )

  useEffect(() => {
    preloadActiveEffectPenInk(penInkStyle)
  }, [penInkStyle])

  useEffect(() => {
    if (penStrokeProfile === 'effects') {
      preloadEffectPenProfileSwatches()
    }
  }, [penStrokeProfile])
  const shapeColor = useMemo(() => getPenSwatch(shapeStrokeSwatchId).color, [shapeStrokeSwatchId])
  const [markerColor, setMarkerColor] = useState<string>(ANNOTATION_MARKER_SWATCHES[0])
  const [markerColorSource, setMarkerColorSource] = useState<AnnotationColorSource>('swatch')
  const [markerCustomHex, setMarkerCustomHex] = useState<string>(DEFAULT_MARKER_CUSTOM_HEX)
  const [penThicknessStep, setPenThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [markerThicknessStep, setMarkerThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [shapeThicknessStep, setShapeThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [textThicknessStep, setTextThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [stickyThicknessStep, setStickyThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [stampThicknessStep, setStampThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [eraserPixelThicknessStep, setEraserPixelThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [eraserLineThicknessStep, setEraserLineThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [textVisualStyle, setTextVisualStyleState] = useState<TextAnnotationVisualStyle>('plain')
  const [bookTextVisualStyle, setBookTextVisualStyle] = useState<TextAnnotationVisualStyle>('filled')
  const [textAlign, setTextAlign] = useState<TextAnnotationAlign>('left')
  const [textFontId, setTextFontId] = useState<AnnotationTextFontId>(DEFAULT_ANNOTATION_TEXT_FONT_ID)
  const [textFillColor, setTextFillColor] = useState<string>(DEFAULT_TEXT_FILL_COLOR)
  const [penLineDashStyle, setPenLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [markerLineDashStyle, setMarkerLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [markerStraightStroke, setMarkerStraightStroke] = useState(true)
  const [markerDecoratedEdge, setMarkerDecoratedEdge] = useState(false)
  const [penAutoGroupConnected, setPenAutoGroupConnected] = useState(true)
  const [marqueeSelectRule, setMarqueeSelectRule] = useState<
    import('@/lib/books/annotation-select').MarqueeSelectRule
  >('follow-drag')
  const [shapeLineDashStyle, setShapeLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [shapeStrokeEnabled, setShapeStrokeEnabled] = useState(true)
  const [shapeFillMode, setShapeFillMode] = useState<ShapeFillMode>('none')
  const [shapeFillColor, setShapeFillColor] = useState<string>(DEFAULT_SHAPE_FILL_COLOR)
  const [shapeRoundedCorners, setShapeRoundedCorners] = useState(true)
  const [eyedropperVariant, setEyedropperVariant] = useState<EyedropperVariant>(DEFAULT_EYEDROPPER_VARIANT)
  const [annotationTargetPage, setAnnotationTargetPageState] = useState(pageNumber)
  const setAnnotationTargetPage = useCallback((next: number) => {
    setAnnotationTargetPageState((prev) => annotationTargetPageIfChanged(prev, next))
  }, [])
  const [annCapsByPage, setAnnCapsByPage] = useState<Record<number, AnnotationCapabilities>>({})
  const [isAnnotationRailVisible, setIsAnnotationRailVisible] = useState(false)
  const [isAnnotationRailPinned, setIsAnnotationRailPinnedState] = useState(false)
  const [annotationRailPinHydrated, setAnnotationRailPinHydrated] = useState(false)
  const [annotationRailKeyboardDismissAt, setAnnotationRailKeyboardDismissAt] = useState(0)
  const [annotationRailKeyboardOpenAt, setAnnotationRailKeyboardOpenAt] = useState(0)

  useEffect(() => {
    try {
      setIsAnnotationRailPinnedState(
        typeof window !== 'undefined' &&
          window.localStorage.getItem(ANNOTATION_RAIL_PIN_STORAGE_KEY) === '1',
      )
    } catch {
      setIsAnnotationRailPinnedState(false)
    }
    setAnnotationRailPinHydrated(true)
  }, [])

  const setIsAnnotationRailPinned = useCallback((next: boolean) => {
    setIsAnnotationRailPinnedState(next)
    try {
      window.localStorage.setItem(ANNOTATION_RAIL_PIN_STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
    if (next) {
      setIsAnnotationRailVisible(true)
    }
  }, [])

  const toggleAnnotationRailKeyboard = useCallback(() => {
    if (isAnnotationRailPinned) {
      setIsAnnotationRailPinned(false)
      setAnnotationRailKeyboardDismissAt((n) => n + 1)
      return
    }
    setIsAnnotationRailVisible((v) => {
      if (v) {
        setAnnotationRailKeyboardDismissAt((n) => n + 1)
        return false
      }
      setAnnotationRailKeyboardOpenAt((n) => n + 1)
      return true
    })
  }, [isAnnotationRailPinned, setIsAnnotationRailPinned])
  const leftAnnRef = useRef<BookPageAnnotationHandle>(null)
  const rightAnnRef = useRef<BookPageAnnotationHandle>(null)
  const wbAnnRef = useRef<BookPageAnnotationHandle>(null)
  const spreadStrokeOverlayRef = useRef<BookPageAnnotationHandle>(null)
  const wbStrokeOverlayRef = useRef<BookPageAnnotationHandle>(null)
  const [spreadOverlayCaps, setSpreadOverlayCaps] = useState<AnnotationCapabilities>({
    canUndo: false,
    canRedo: false,
  })
  const [wbOverlayCaps, setWbOverlayCaps] = useState<AnnotationCapabilities>({
    canUndo: false,
    canRedo: false,
  })

  const [prefsReady, setPrefsReady] = useState(false)
  const loadGenRef = useRef(0)

  const lockPenFigureAutoJoinEverywhere = useCallback(() => {
    spreadSessionStoreRef?.current?.patchCommands(lockPenFigureAutoJoinOnCommands)
    whiteboardSessionStoreRef?.current?.patchCommands(lockPenFigureAutoJoinOnCommands)
    leftAnnRef.current?.lockPenFigureAutoJoin?.()
    rightAnnRef.current?.lockPenFigureAutoJoin?.()
    wbAnnRef.current?.lockPenFigureAutoJoin?.()
  }, [spreadSessionStoreRef, whiteboardSessionStoreRef])

  useEffect(() => {
    if (!prefsReady) return
    const prev = prevAnnotationModeRef.current
    prevAnnotationModeRef.current = annotationMode
    if (prev != null && prev === 'pen' && annotationMode !== 'pen') {
      lockPenFigureAutoJoinEverywhere()
    }
  }, [annotationMode, lockPenFigureAutoJoinEverywhere, prefsReady])

  useEffect(() => {
    const isQuickSticker = isQuickStickerInteraction(annotationMode, stickerKind)
    if (isQuickSticker && !prevQuickStickerRef.current) {
      setStampVariant(STICKER_QUICK_VARIANTS[0])
    }
    prevQuickStickerRef.current = isQuickSticker
  }, [annotationMode, stickerKind])

  useEffect(() => {
    const gen = ++loadGenRef.current
    setPrefsReady(false)
    prevAnnotationModeRef.current = null
    prevQuickStickerRef.current = false
    if (!studentId) {
      setPrefsReady(true)
      return
    }
    const prefs = resolveAnnotationToolPrefsFromStorage(studentId)
    setAnnotationMode(prefs.annotationMode)
    setPenStrokeProfileState(prefs.penStrokeProfile)
    setPenSwatchId(prefs.penSwatchId)
    setPenColorSource(prefs.penColorSource)
    setPenCustomHex(prefs.penCustomHex)
    setPenThicknessStep(prefs.penThicknessStep)
    setPenLineDashStyle(prefs.penLineDashStyle)
    setMarkerColor(prefs.markerColor)
    setMarkerColorSource(prefs.markerColorSource)
    setMarkerCustomHex(prefs.markerCustomHex)
    setMarkerThicknessStep(prefs.markerThicknessStep)
    setMarkerLineDashStyle(prefs.markerLineDashStyle)
    setMarkerStraightStroke(prefs.markerStraightStroke)
    setMarkerDecoratedEdge(prefs.markerDecoratedEdge)
    setPenAutoGroupConnected(prefs.penAutoGroupConnected)
    setMarqueeSelectRule(prefs.marqueeSelectRule)
    setShapeThicknessStep(prefs.shapeThicknessStep)
    setTextThicknessStep(prefs.textThicknessStep)
    setStickyThicknessStep(prefs.stickyThicknessStep)
    setStampThicknessStep(prefs.stampThicknessStep)
    setEraserPixelThicknessStep(prefs.eraserPixelThicknessStep)
    setEraserLineThicknessStep(prefs.eraserLineThicknessStep)
    setStickerKind(prefs.stickerKind)
    setWritableStickerVariant(prefs.writableStickerVariant)
    setStampVariant(resolveStampToolPrefsFromStorage(studentId).stampVariant)
    setStampQuestionColor(prefs.stampQuestionColor)
    setStampEffectsEnabled(prefs.stampEffectsEnabled)
    setTextColor(prefs.textColor)
    setTextFontId(prefs.textFontId)
    setTextVisualStyleState(prefs.textVisualStyle)
    setBookTextVisualStyle(prefs.bookTextVisualStyle)
    setTextAlign(prefs.textAlign)
    setTextFillColor(prefs.textFillColor)
    setShapeStrokeSwatchId(prefs.shapeStrokeSwatchId)
    setShapeLineDashStyle(prefs.shapeLineDashStyle)
    setShapeStrokeEnabled(prefs.shapeStrokeEnabled)
    setShapeFillMode(prefs.shapeFillMode)
    setShapeFillColor(prefs.shapeFillColor)
    setShapeRoundedCorners(prefs.shapeRoundedCorners)
    setStickyFillColor(prefs.stickyFillColor)
    setEyedropperVariant(prefs.eyedropperVariant)
    queueMicrotask(() => {
      if (loadGenRef.current === gen) setPrefsReady(true)
    })
  }, [studentId])

  useEffect(() => {
    if (!prefsReady || !studentId) return
    patchStudentAnnotationToolPrefs(
      studentId,
      buildStudentAnnotationToolPrefsPatch({
        annotationMode,
        penSwatchId,
        penStrokeProfile,
        penColorSource,
        penCustomHex,
        penThicknessStep,
        penLineDashStyle,
        markerColor,
        markerColorSource,
        markerCustomHex,
        markerThicknessStep,
        markerLineDashStyle,
        markerStraightStroke,
        markerDecoratedEdge,
        penAutoGroupConnected,
        marqueeSelectRule,
        shapeThicknessStep,
        textThicknessStep,
        stickyThicknessStep,
        stampThicknessStep,
        eraserPixelThicknessStep,
        eraserLineThicknessStep,
        stickerKind,
        writableStickerVariant,
        stampQuestionColor,
        stampEffectsEnabled,
        textColor,
        textFontId,
        textVisualStyle,
        bookTextVisualStyle,
        textAlign,
        textFillColor,
        shapeStrokeSwatchId,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
        shapeRoundedCorners,
        stickyFillColor,
        eyedropperVariant,
      }),
    )
  }, [
    prefsReady,
    studentId,
    annotationMode,
    penSwatchId,
    penStrokeProfile,
    penColorSource,
    penCustomHex,
    penThicknessStep,
    penLineDashStyle,
    markerColor,
    markerColorSource,
    markerCustomHex,
    markerThicknessStep,
    markerLineDashStyle,
    markerStraightStroke,
    markerDecoratedEdge,
    penAutoGroupConnected,
    shapeThicknessStep,
    textThicknessStep,
    stickyThicknessStep,
    stampThicknessStep,
    eraserPixelThicknessStep,
    eraserLineThicknessStep,
    stickerKind,
    writableStickerVariant,
    stampQuestionColor,
    stampEffectsEnabled,
    textColor,
    textFontId,
    textVisualStyle,
    bookTextVisualStyle,
    textAlign,
    textFillColor,
    shapeStrokeSwatchId,
    shapeLineDashStyle,
    shapeStrokeEnabled,
    shapeFillMode,
    shapeFillColor,
    shapeRoundedCorners,
    stickyFillColor,
    eyedropperVariant,
  ])

  const setPenStrokeProfile = useCallback((profile: PenStrokeProfile) => {
    const active = normalizeActivePenStrokeProfile(profile)
    setPenStrokeProfileState(active)
    setPenSwatchId((id) => coercePenSwatchIdForProfile(id, active))
  }, [])

  const pickPenSwatch = useCallback((id: string) => {
    setPenSwatchId(id)
    setPenColorSource('swatch')
    pushStripRecent('pen', id)
  }, [])

  const pickPenCustomColor = useCallback((hex: string) => {
    if (!isValidCustomHex(hex)) return
    setPenCustomHex(normalizeCustomHex(hex))
    setPenColorSource('custom')
  }, [])

  const activeTextVisualStyle = isWhiteboardOpen ? textVisualStyle : bookTextVisualStyle
  const setTextVisualStyle = useCallback(
    (next: TextAnnotationVisualStyle) => {
      if (isWhiteboardOpen) {
        setTextVisualStyleState(next)
        return
      }
      setBookTextVisualStyle(next)
    },
    [isWhiteboardOpen],
  )

  const pickMarkerSwatchColor = useCallback((hex: string) => {
    setMarkerColor(hex)
    setMarkerColorSource('swatch')
    pushStripRecent('marker', hex)
  }, [])

  const pickMarkerCustomColor = useCallback((hex: string) => {
    if (!isValidCustomHex(hex)) return
    const norm = normalizeCustomHex(hex)
    setMarkerCustomHex(norm)
    setMarkerColor(norm)
    setMarkerColorSource('custom')
  }, [])

  const pickShapeStrokeSwatch = useCallback((id: string) => {
    const solidId = coercePenSwatchIdForProfile(id, 'pen')
    setShapeStrokeSwatchId(solidId)
    pushStripRecent('shape', solidId)
  }, [])

  const pickTextColor = useCallback((hex: string) => {
    setTextColor(hex)
    pushStripRecent('text', hex)
  }, [])

  const pickTextFillColor = useCallback((hex: string) => {
    setTextFillColor(hex)
  }, [])

  const pickStickyFillColor = useCallback((hex: string) => {
    setStickyFillColor(hex)
    pushStripRecent('sticky', hex)
  }, [])

  const strokeWidthScale =
    annotationMode === 'pen'
      ? ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS[penThicknessStep]
      : annotationMode === 'marker'
        ? ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
        : annotationMode === 'eraser-line'
          ? ANNOTATION_STROKE_WIDTH_STEPS[eraserLineThicknessStep]
          : annotationMode === 'eraser'
            ? ANNOTATION_STROKE_WIDTH_STEPS[eraserPixelThicknessStep]
            : ANNOTATION_STROKE_WIDTH_STEPS[shapeThicknessStep]

  const eraserLineStrokeWidthScale = ANNOTATION_STROKE_WIDTH_STEPS[eraserLineThicknessStep]
  const penStrokeWidthScale =
    ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS[penThicknessStep] * penProfileWidthScaleMultiplier(penStrokeProfile)

  const strokeColor =
    annotationMode === 'pen' ? penColor : annotationMode === 'marker' ? markerColor : undefined

  const shapeStrokeWidthScale = ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS[shapeThicknessStep]
  const stampScale = ANNOTATION_STROKE_WIDTH_STEPS[stampThicknessStep]
  const textFontSizeNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[textThicknessStep]
  const stickyFontSizeNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[stickyThicknessStep]
  const strokeLineDashStyleForInk: AnnotationLineDashStyle =
    annotationMode === 'pen' ? penLineDashStyle : 'solid'

  const setCapsForPage = useCallback((page: number, caps: AnnotationCapabilities) => {
    setAnnCapsByPage((prev) => {
      const cur = prev[page]
      if (cur?.canUndo === caps.canUndo && cur?.canRedo === caps.canRedo) return prev
      return { ...prev, [page]: caps }
    })
  }, [])

  const onLeftAnnotationCaps = useCallback(
    (caps: AnnotationCapabilities) => setCapsForPage(pageNumber, caps),
    [pageNumber, setCapsForPage],
  )
  const rightCapsPage = spreadRightPage ?? pageNumber + 1
  const onRightAnnotationCaps = useCallback(
    (caps: AnnotationCapabilities) => setCapsForPage(rightCapsPage, caps),
    [rightCapsPage, setCapsForPage],
  )

  useEffect(() => {
    setAnnotationTargetPage(pageNumber)
  }, [pageNumber, setAnnotationTargetPage])

  const whiteboardDrawingInteractionActive = useMemo(() => {
    if (!whiteboardInkSessionEnabled || !isWhiteboardOpen) return false
    const mode = effectiveAnnotationMode
    return (
      mode !== 'select' &&
      mode !== 'text' &&
      mode !== 'sticky' &&
      mode !== 'stamp' &&
      mode !== 'sticker' &&
      mode !== 'callout' &&
      mode !== 'eyedropper'
    )
  }, [effectiveAnnotationMode, isWhiteboardOpen])

  const whiteboardSessionInkActive =
    whiteboardInkSessionEnabled && isWhiteboardOpen && Boolean(whiteboardSessionStoreRef)

  const whiteboardSessionSelectReady = () => whiteboardSessionInkActive

  const whiteboardSessionToolbarActive =
    whiteboardSessionInkActive &&
    (whiteboardDrawingInteractionActive || effectiveAnnotationMode === 'select')

  const whiteboardStrokeCaptureEnabled = whiteboardDrawingInteractionActive

  const spreadDrawingInteractionActive = useMemo(() => {
    if (isWhiteboardOpen) {
      return false
    }
    const mode = effectiveAnnotationMode
    return (
      mode !== 'select' &&
      mode !== 'text' &&
      mode !== 'sticky' &&
      mode !== 'stamp' &&
      mode !== 'sticker' &&
      mode !== 'callout' &&
      mode !== 'eyedropper'
    )
  }, [effectiveAnnotationMode, isWhiteboardOpen])

  const spreadSessionInkActive = Boolean(spreadSessionStoreRef) && !isWhiteboardOpen

  const spreadSessionSelectReady = () =>
    spreadSessionInkActive && spreadSessionStoreRef?.current != null

  const spreadSessionToolbarActive =
    spreadSessionInkActive &&
    (spreadDrawingInteractionActive || effectiveAnnotationMode === 'select')

  const activeAnnotationPage = annotationTargetPage
  const activeAnnCaps = annCapsByPage[activeAnnotationPage] ?? { canUndo: false, canRedo: false }
  const toolbarCaps = isWhiteboardOpen
    ? whiteboardSessionToolbarActive
      ? wbOverlayCaps
      : wbCaps
    : spreadSessionToolbarActive || spreadDrawingInteractionActive
      ? spreadOverlayCaps
      : activeAnnCaps
  const setCapsIfChanged = useCallback(
    (
      setter: Dispatch<SetStateAction<AnnotationCapabilities>>,
      caps: AnnotationCapabilities,
    ) => {
      setter((prev) => {
        if (prev.canUndo === caps.canUndo && prev.canRedo === caps.canRedo) return prev
        return caps
      })
    },
    [],
  )

  const onWhiteboardCaps = useCallback(
    (caps: AnnotationCapabilities) => setCapsIfChanged(setWbCaps, caps),
    [setCapsIfChanged],
  )

  const onSpreadOverlayCaps = useCallback(
    (caps: AnnotationCapabilities) => setCapsIfChanged(setSpreadOverlayCaps, caps),
    [setCapsIfChanged],
  )

  const onWhiteboardOverlayCaps = useCallback(
    (caps: AnnotationCapabilities) => setCapsIfChanged(setWbOverlayCaps, caps),
    [setCapsIfChanged],
  )

  const spreadSessionSelectProxyRef = useRef<InkSessionSelectProxyHandle | null>(null)
  spreadSessionSelectProxyRef.current = createSpreadSessionSelectProxy(
    () => spreadSessionStoreRef?.current ?? null,
  )

  const whiteboardSessionSelectProxyRef = useRef<InkSessionSelectProxyHandle | null>(null)
  whiteboardSessionSelectProxyRef.current = createInkSessionSelectProxy(
    () => whiteboardSessionStoreRef?.current ?? null,
  )

  const whiteboardCompositeSelectProxyRef = useRef<InkSessionSelectProxyHandle | null>(null)
  whiteboardCompositeSelectProxyRef.current = createCompositeInkSessionSelectProxy(
    () => whiteboardSessionStoreRef?.current ?? null,
    [wbAnnRef],
  )

  function getActiveAnnotationRef() {
    if (isWhiteboardOpen) {
      if (whiteboardDrawingInteractionActive) return wbStrokeOverlayRef
      if (whiteboardSessionSelectReady() && effectiveAnnotationMode === 'select') {
        return whiteboardSessionSelectProxyRef
      }
      return wbAnnRef
    }
    if (spreadDrawingInteractionActive) return spreadStrokeOverlayRef
    if (spreadSessionSelectReady() && effectiveAnnotationMode === 'select') {
      return spreadSessionSelectProxyRef
    }
    if (spreadRightPage != null && annotationTargetPage === spreadRightPage) return rightAnnRef
    return leftAnnRef
  }

  const syncSpreadSelectionFromActive = () => {
    const activeRef =
      spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
    const ids = activeRef.current?.getSelectedIds?.() ?? []
    leftAnnRef.current?.setSelectedIds?.(ids)
    rightAnnRef.current?.setSelectedIds?.(ids)
    return ids
  }

  const legacySpreadSelectProxyRef = useRef<{
    getSelectedIds?: () => string[]
    setSelectedIds?: (ids: string[]) => void
    selectAll?: () => void
    deleteSelected?: () => boolean
    copySelected?: () => boolean
    pasteFromClipboard?: () => boolean
    groupSelected?: () => boolean
    ungroupSelected?: () => boolean
    toggleGroupSelected?: () => boolean
    removeFromGroupSelected?: () => boolean
    deselectAll?: () => void
    duplicateSelected?: () => boolean
    selectNextInStack?: (direction: 1 | -1) => void
  } | null>(null)

  legacySpreadSelectProxyRef.current = {
    getSelectedIds: () => {
      const synced = syncSpreadSelectionFromActive()
      if (synced.length > 0) return synced
      const leftIds = leftAnnRef.current?.getSelectedIds?.() ?? []
      const rightIds = rightAnnRef.current?.getSelectedIds?.() ?? []
      return [...new Set([...leftIds, ...rightIds])]
    },
    setSelectedIds: (ids: string[]) => {
      leftAnnRef.current?.setSelectedIds?.(ids)
      rightAnnRef.current?.setSelectedIds?.(ids)
    },
    selectAll: () => {
      leftAnnRef.current?.selectAll?.()
      rightAnnRef.current?.selectAll?.()
    },
    selectAllIncludingLocked: () => {
      leftAnnRef.current?.selectAllIncludingLocked?.()
      rightAnnRef.current?.selectAllIncludingLocked?.()
    },
    deselectAll: () => {
      leftAnnRef.current?.deselectAll?.()
      rightAnnRef.current?.deselectAll?.()
    },
    deleteSelected: () => {
      const leftIds = leftAnnRef.current?.getSelectedIds?.() ?? []
      const rightIds = rightAnnRef.current?.getSelectedIds?.() ?? []
      const ids = [...new Set([...leftIds, ...rightIds])]
      if (ids.length === 0) return false
      for (const id of ids) {
        leftAnnRef.current?.removeCommandById(id)
        rightAnnRef.current?.removeCommandById(id)
      }
      leftAnnRef.current?.deselectAll?.()
      rightAnnRef.current?.deselectAll?.()
      return true
    },
    copySelected: () => {
      syncSpreadSelectionFromActive()
      const activeRef =
        spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
      return activeRef.current?.copySelected?.() ?? false
    },
    pasteFromClipboard: () => {
      syncSpreadSelectionFromActive()
      const activeRef =
        spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
      return activeRef.current?.pasteFromClipboard?.() ?? false
    },
    groupSelected: () => {
      syncSpreadSelectionFromActive()
      const activeRef =
        spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
      return activeRef.current?.groupSelected?.() ?? false
    },
    ungroupSelected: () => {
      syncSpreadSelectionFromActive()
      const activeRef =
        spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
      return activeRef.current?.ungroupSelected?.() ?? false
    },
    toggleGroupSelected: () => {
      syncSpreadSelectionFromActive()
      const activeRef =
        spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
      return activeRef.current?.toggleGroupSelected?.() ?? false
    },
    removeFromGroupSelected: () => {
      syncSpreadSelectionFromActive()
      const activeRef =
        spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
      return activeRef.current?.removeFromGroupSelected?.() ?? false
    },
    duplicateSelected: () => {
      syncSpreadSelectionFromActive()
      const activeRef =
        spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
      return activeRef.current?.duplicateSelected?.() ?? false
    },
    selectNextInStack: (direction: 1 | -1) => {
      const activeRef =
        spreadRightPage != null && annotationTargetPage === spreadRightPage ? rightAnnRef : leftAnnRef
      activeRef.current?.selectNextInStack?.(direction)
    },
  }

  const getPageAnnotationRef = useCallback(() => {
    if (isWhiteboardOpen) {
      if (whiteboardSessionSelectReady()) {
        return whiteboardCompositeSelectProxyRef
      }
      return wbAnnRef
    }
    if (spreadRightPage != null) {
      if (spreadSessionSelectReady()) {
        return spreadSessionSelectProxyRef
      }
      if (effectiveAnnotationMode === 'select') {
        return legacySpreadSelectProxyRef
      }
    }
    if (spreadRightPage != null && annotationTargetPage === spreadRightPage) return rightAnnRef
    return leftAnnRef
  }, [
    isWhiteboardOpen,
    spreadRightPage,
    annotationTargetPage,
    effectiveAnnotationMode,
    spreadSessionInkActive,
  ])

  const selectAllPageLayerAnnotations = useCallback((includeLocked: boolean) => {
    if (spreadRightPage != null) {
      if (includeLocked) {
        leftAnnRef.current?.selectAllIncludingLocked?.()
        rightAnnRef.current?.selectAllIncludingLocked?.()
      } else {
        leftAnnRef.current?.selectAll?.()
        rightAnnRef.current?.selectAll?.()
      }
      return
    }
    if (includeLocked) leftAnnRef.current?.selectAllIncludingLocked?.()
    else leftAnnRef.current?.selectAll?.()
  }, [spreadRightPage])

  const deselectAllPageLayerAnnotations = useCallback(() => {
    if (spreadRightPage != null) {
      leftAnnRef.current?.deselectAll?.()
      rightAnnRef.current?.deselectAll?.()
      return
    }
    leftAnnRef.current?.deselectAll?.()
  }, [spreadRightPage])

  /** Session ink (spread/whiteboard) plus page-local items (stamp, text, sticky, callout). */
  const selectAllOnActivePage = useCallback(() => {
    if (isWhiteboardOpen) {
      if (whiteboardSessionSelectReady()) {
        whiteboardSessionStoreRef?.current?.selectAll()
      }
      wbAnnRef.current?.selectAll?.()
      return
    }
    if (spreadSessionSelectReady()) {
      spreadSessionStoreRef?.current?.selectAll()
      return
    }
    selectAllPageLayerAnnotations(false)
  }, [
    isWhiteboardOpen,
    selectAllPageLayerAnnotations,
    spreadSessionStoreRef,
    whiteboardSessionStoreRef,
  ])

  const selectAllIncludingLockedOnActivePage = useCallback(() => {
    if (isWhiteboardOpen) {
      if (whiteboardSessionSelectReady()) {
        whiteboardSessionStoreRef?.current?.selectAllIncludingLocked()
      }
      wbAnnRef.current?.selectAllIncludingLocked?.()
      return
    }
    if (spreadSessionSelectReady()) {
      spreadSessionStoreRef?.current?.selectAllIncludingLocked()
      return
    }
    selectAllPageLayerAnnotations(true)
  }, [
    isWhiteboardOpen,
    selectAllPageLayerAnnotations,
    spreadSessionStoreRef,
    whiteboardSessionStoreRef,
  ])

  const deselectAllOnActivePage = useCallback(() => {
    if (isWhiteboardOpen) {
      if (whiteboardSessionSelectReady()) {
        whiteboardSessionStoreRef?.current?.setSelectedIds([])
      }
      wbAnnRef.current?.deselectAll?.()
      return
    }
    if (spreadSessionSelectReady()) {
      spreadSessionStoreRef?.current?.setSelectedIds([])
      return
    }
    deselectAllPageLayerAnnotations()
  }, [
    isWhiteboardOpen,
    deselectAllPageLayerAnnotations,
    spreadSessionStoreRef,
    whiteboardSessionStoreRef,
  ])

  const hasAnyAnnotationSelection = useCallback((): boolean => {
    if (isWhiteboardOpen) {
      if (
        whiteboardSessionSelectReady() &&
        (whiteboardSessionStoreRef?.current?.getState().selectedIds.length ?? 0) > 0
      ) {
        return true
      }
      if ((wbAnnRef.current?.getSelectedIds?.() ?? []).length > 0) return true
      return false
    }
    if (spreadSessionSelectReady()) {
      return (spreadSessionStoreRef?.current?.getState().selectedIds.length ?? 0) > 0
    }
    if ((leftAnnRef.current?.getSelectedIds?.() ?? []).length > 0) return true
    if ((rightAnnRef.current?.getSelectedIds?.() ?? []).length > 0) return true
    return false
  }, [isWhiteboardOpen, spreadSessionStoreRef, whiteboardSessionStoreRef])

  return {
    annotationMode, setAnnotationMode,
    effectiveAnnotationMode,
    ctrlTemporarySelect,
    stickerKind, setStickerKind,
    writableStickerVariant, setWritableStickerVariant,
    stampVariant, setStampVariant,
    stampIndicatorPulseEpoch,
    pulseStampIndicator,
    stampQuestionColor, setStampQuestionColor,
    stampEffectsEnabled, setStampEffectsEnabled,
    penSwatchId,
    pickPenSwatch,
    penStrokeProfile,
    setPenStrokeProfile,
    penColorSource,
    penCustomHex,
    pickPenCustomColor,
    textColor,
    setTextColor,
    pickTextColor,
    pickTextFillColor,
    shapeStrokeSwatchId,
    setShapeStrokeSwatchId,
    pickShapeStrokeSwatch,
    stickyFillColor,
    setStickyFillColor,
    pickStickyFillColor,
    penColor,
    penInkStyle,
    markerColor,
    markerColorSource,
    markerCustomHex,
    pickMarkerSwatchColor,
    pickMarkerCustomColor,
    penThicknessStep, setPenThicknessStep,
    markerThicknessStep, setMarkerThicknessStep,
    shapeThicknessStep, setShapeThicknessStep,
    textThicknessStep, setTextThicknessStep,
    stickyThicknessStep, setStickyThicknessStep,
    stampThicknessStep, setStampThicknessStep,
    eraserPixelThicknessStep, setEraserPixelThicknessStep,
    eraserLineThicknessStep, setEraserLineThicknessStep,
    textVisualStyle: activeTextVisualStyle, setTextVisualStyle,
    bookTextVisualStyle,
    textAlign, setTextAlign,
    textFontId, setTextFontId,
    textFillColor,
    setTextFillColor,
    penLineDashStyle, setPenLineDashStyle,
    markerLineDashStyle, setMarkerLineDashStyle,
    markerStraightStroke, setMarkerStraightStroke,
    markerDecoratedEdge, setMarkerDecoratedEdge,
    penAutoGroupConnected, setPenAutoGroupConnected,
    marqueeSelectRule, setMarqueeSelectRule,
    shapeLineDashStyle, setShapeLineDashStyle,
    shapeStrokeEnabled, setShapeStrokeEnabled,
    shapeFillMode, setShapeFillMode,
    shapeFillColor, setShapeFillColor,
    shapeRoundedCorners, setShapeRoundedCorners,
    eyedropperVariant, setEyedropperVariant,
    strokeLineDashStyleForInk,
    annotationTargetPage, setAnnotationTargetPage,
    isAnnotationRailVisible, setIsAnnotationRailVisible,
    isAnnotationRailPinned, setIsAnnotationRailPinned, annotationRailPinHydrated,
    annotationRailKeyboardDismissAt,
    annotationRailKeyboardOpenAt,
    toggleAnnotationRailKeyboard,
    leftAnnRef, rightAnnRef, wbAnnRef, spreadStrokeOverlayRef,     wbStrokeOverlayRef,
    whiteboardStrokeCaptureEnabled,
    whiteboardDrawingInteractionActive,
    strokeWidthScale,
    eraserLineStrokeWidthScale,
    penStrokeWidthScale,
    strokeColor,
    shapeStrokeWidthScale,
    stampScale,
    textFontSizeNorm,
    stickyFontSizeNorm,
    shapeColor,
    toolbarCaps,
    spreadStrokeCaptureEnabled: spreadDrawingInteractionActive,
    onSpreadOverlayCaps,
    onWhiteboardOverlayCaps,
    onLeftAnnotationCaps, onRightAnnotationCaps, onWhiteboardCaps,
    getActiveAnnotationRef,
    getPageAnnotationRef,
    selectAllOnActivePage,
    selectAllIncludingLockedOnActivePage,
    deselectAllOnActivePage,
    hasAnyAnnotationSelection,
  }
}
