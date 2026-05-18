import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type AnnotationColorSource,
  isValidCustomHex,
  normalizeCustomHex,
} from '@/lib/books/annotation-custom-color'
import {
  ANNOTATION_PEN_STROKE_WIDTH_STEPS,
  ANNOTATION_STROKE_WIDTH_STEPS,
  type AnnotationStrokeThicknessStep,
  type BookAnnotationInteractionMode,
} from '@/lib/books/annotation-storage'
import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
  DEFAULT_PEN_SWATCH_ID,
  DEFAULT_SHAPE_STROKE_SWATCH_ID,
  DEFAULT_STAMP_QUESTION_COLOR,
  DEFAULT_STICKY_FILL_COLOR,
  DEFAULT_TEXT_COLOR,
  getPenSwatch,
} from '@/lib/books/annotation-palettes'
import { DEFAULT_EYEDROPPER_VARIANT, type EyedropperVariant } from '@/lib/books/eyedropper-variant'
import {
  DEFAULT_MARKER_CUSTOM_HEX,
  DEFAULT_PEN_CUSTOM_HEX,
} from '@/lib/books/student-annotation-tool-prefs'
import {
  buildStudentAnnotationToolPrefsPatch,
  patchStudentAnnotationToolPrefs,
  resolveAnnotationToolPrefsFromStorage,
} from '@/lib/books/student-annotation-tool-prefs'
import type { PenInkStyle } from '@/lib/books/pen-ink'
import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  TextAnnotationVisualStyle,
} from '@/lib/books/annotation-command-types'
import type { AnnotationCapabilities, BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { ANNOTATION_TEXT_FONT_NORM_STEPS } from '@/components/students/fullscreen-book-overlay/constants'

interface UseAnnotationControllerArgs {
  studentId: string
  pageNumber: number
  isSinglePageMode: boolean
  isWhiteboardOpen: boolean
  whiteboardPage: number
  lessonPaperMode: 'type' | 'draw' | 'select'
  lessonPaperDrawTool: 'pen' | 'highlighter'
  showSpreadRight: boolean
  spreadRightPage: number | null
}

export function useAnnotationController({
  studentId,
  pageNumber,
  isSinglePageMode,
  isWhiteboardOpen,
  whiteboardPage,
  lessonPaperMode,
  lessonPaperDrawTool,
  showSpreadRight,
  spreadRightPage,
}: UseAnnotationControllerArgs) {
  const [wbCaps, setWbCaps] = useState<AnnotationCapabilities>({ canUndo: false, canRedo: false })
  const [annotationMode, setAnnotationMode] = useState<BookAnnotationInteractionMode>('pen')
  const [stampVariant, setStampVariant] = useState<StampVariant>('check')
  const [stampQuestionColor, setStampQuestionColor] = useState<string>(DEFAULT_STAMP_QUESTION_COLOR)
  const [penSwatchId, setPenSwatchId] = useState<string>(DEFAULT_PEN_SWATCH_ID)
  const [penColorSource, setPenColorSource] = useState<AnnotationColorSource>('swatch')
  const [penCustomHex, setPenCustomHex] = useState<string>(DEFAULT_PEN_CUSTOM_HEX)
  const [textColor, setTextColor] = useState<string>(DEFAULT_TEXT_COLOR)
  const [shapeStrokeSwatchId, setShapeStrokeSwatchId] = useState<string>(DEFAULT_SHAPE_STROKE_SWATCH_ID)
  const [stickyFillColor, setStickyFillColor] = useState<string>(DEFAULT_STICKY_FILL_COLOR)
  const penSwatch = useMemo(() => getPenSwatch(penSwatchId), [penSwatchId])
  const penColor = penColorSource === 'custom' ? penCustomHex : penSwatch.color
  const penInkStyle: PenInkStyle = penColorSource === 'custom' ? 'solid' : penSwatch.patternId
  const shapeColor = useMemo(() => getPenSwatch(shapeStrokeSwatchId).color, [shapeStrokeSwatchId])
  const [markerColor, setMarkerColor] = useState<string>(ANNOTATION_MARKER_SWATCHES[0])
  const [markerColorSource, setMarkerColorSource] = useState<AnnotationColorSource>('swatch')
  const [markerCustomHex, setMarkerCustomHex] = useState<string>(DEFAULT_MARKER_CUSTOM_HEX)
  const [penThicknessStep, setPenThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [markerThicknessStep, setMarkerThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [eraserPixelThicknessStep, setEraserPixelThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [eraserLineThicknessStep, setEraserLineThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [textVisualStyle, setTextVisualStyle] = useState<TextAnnotationVisualStyle>('plain')
  const [textFillColor, setTextFillColor] = useState<string>(ANNOTATION_TEXT_FILL_SWATCHES[0])
  const [penLineDashStyle, setPenLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [markerLineDashStyle, setMarkerLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [shapeLineDashStyle, setShapeLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [shapeStrokeEnabled, setShapeStrokeEnabled] = useState(true)
  const [shapeFillMode, setShapeFillMode] = useState<ShapeFillMode>('none')
  const [shapeFillColor, setShapeFillColor] = useState<string>(ANNOTATION_MARKER_SWATCHES[0])
  const [eyedropperVariant, setEyedropperVariant] = useState<EyedropperVariant>(DEFAULT_EYEDROPPER_VARIANT)
  const [annotationTargetPage, setAnnotationTargetPage] = useState(pageNumber)
  const [annCapsByPage, setAnnCapsByPage] = useState<Record<number, AnnotationCapabilities>>({})
  const [clearInkOpen, setClearInkOpen] = useState(false)
  const [isAnnotationRailVisible, setIsAnnotationRailVisible] = useState(true)
  const leftAnnRef = useRef<BookPageAnnotationHandle>(null)
  const rightAnnRef = useRef<BookPageAnnotationHandle>(null)
  const wbAnnRef = useRef<BookPageAnnotationHandle>(null)
  const spreadStrokeOverlayRef = useRef<BookPageAnnotationHandle>(null)
  const [spreadOverlayCaps, setSpreadOverlayCaps] = useState<AnnotationCapabilities>({
    canUndo: false,
    canRedo: false,
  })

  const [prefsReady, setPrefsReady] = useState(false)
  const loadGenRef = useRef(0)

  useEffect(() => {
    const gen = ++loadGenRef.current
    setPrefsReady(false)
    if (!studentId) {
      setPrefsReady(true)
      return
    }
    const prefs = resolveAnnotationToolPrefsFromStorage(studentId)
    setAnnotationMode(prefs.annotationMode)
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
    setEraserPixelThicknessStep(prefs.eraserPixelThicknessStep)
    setEraserLineThicknessStep(prefs.eraserLineThicknessStep)
    setStampVariant(prefs.stampVariant)
    setStampQuestionColor(prefs.stampQuestionColor)
    setTextColor(prefs.textColor)
    setTextVisualStyle(prefs.textVisualStyle)
    setTextFillColor(prefs.textFillColor)
    setShapeStrokeSwatchId(prefs.shapeStrokeSwatchId)
    setShapeLineDashStyle(prefs.shapeLineDashStyle)
    setShapeStrokeEnabled(prefs.shapeStrokeEnabled)
    setShapeFillMode(prefs.shapeFillMode)
    setShapeFillColor(prefs.shapeFillColor)
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
        penColorSource,
        penCustomHex,
        penThicknessStep,
        penLineDashStyle,
        markerColor,
        markerColorSource,
        markerCustomHex,
        markerThicknessStep,
        markerLineDashStyle,
        eraserPixelThicknessStep,
        eraserLineThicknessStep,
        stampVariant,
        stampQuestionColor,
        textColor,
        textVisualStyle,
        textFillColor,
        shapeStrokeSwatchId,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
        stickyFillColor,
        eyedropperVariant,
      }),
    )
  }, [
    prefsReady,
    studentId,
    annotationMode,
    penSwatchId,
    penColorSource,
    penCustomHex,
    penThicknessStep,
    penLineDashStyle,
    markerColor,
    markerColorSource,
    markerCustomHex,
    markerThicknessStep,
    markerLineDashStyle,
    eraserPixelThicknessStep,
    eraserLineThicknessStep,
    stampVariant,
    stampQuestionColor,
    textColor,
    textVisualStyle,
    textFillColor,
    shapeStrokeSwatchId,
    shapeLineDashStyle,
    shapeStrokeEnabled,
    shapeFillMode,
    shapeFillColor,
    stickyFillColor,
    eyedropperVariant,
  ])

  const pickPenSwatch = useCallback((id: string) => {
    setPenSwatchId(id)
    setPenColorSource('swatch')
  }, [])

  const pickPenCustomColor = useCallback((hex: string) => {
    if (!isValidCustomHex(hex)) return
    setPenCustomHex(normalizeCustomHex(hex))
    setPenColorSource('custom')
  }, [])

  const pickMarkerSwatchColor = useCallback((hex: string) => {
    setMarkerColor(hex)
    setMarkerColorSource('swatch')
  }, [])

  const pickMarkerCustomColor = useCallback((hex: string) => {
    if (!isValidCustomHex(hex)) return
    const norm = normalizeCustomHex(hex)
    setMarkerCustomHex(norm)
    setMarkerColor(norm)
    setMarkerColorSource('custom')
  }, [])

  const strokeWidthScale =
    annotationMode === 'pen'
      ? ANNOTATION_PEN_STROKE_WIDTH_STEPS[penThicknessStep]
      : annotationMode === 'marker'
        ? ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
        : annotationMode === 'eraser-line'
          ? ANNOTATION_STROKE_WIDTH_STEPS[eraserLineThicknessStep]
          : annotationMode === 'eraser'
            ? ANNOTATION_STROKE_WIDTH_STEPS[eraserPixelThicknessStep]
            : ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]

  const eraserLineStrokeWidthScale = ANNOTATION_STROKE_WIDTH_STEPS[eraserLineThicknessStep]
  const penStrokeWidthScale = ANNOTATION_PEN_STROKE_WIDTH_STEPS[penThicknessStep]

  const strokeColor =
    annotationMode === 'pen' ? penColor : annotationMode === 'marker' ? markerColor : undefined

  const shapeStrokeWidthScale = ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
  const stampScale = ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
  const textFontSizeNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[penThicknessStep]
  const stickyFontSizeNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[markerThicknessStep]
  const strokeLineDashStyleForInk: AnnotationLineDashStyle =
    annotationMode === 'pen'
      ? penLineDashStyle
      : annotationMode === 'marker'
        ? markerLineDashStyle
        : 'solid'

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
  }, [pageNumber, isSinglePageMode])

  const spreadStrokeToolbarActive = useMemo(
    () =>
      !isSinglePageMode &&
      showSpreadRight &&
      spreadRightPage != null &&
      !isWhiteboardOpen &&
      (annotationMode === 'pen' ||
        annotationMode === 'marker' ||
        annotationMode === 'eraser' ||
        annotationMode === 'eraser-line' ||
        annotationMode === 'laser'),
    [annotationMode, isSinglePageMode, isWhiteboardOpen, showSpreadRight, spreadRightPage],
  )

  const activeAnnotationPage = isSinglePageMode ? pageNumber : annotationTargetPage
  const activeAnnCaps = annCapsByPage[activeAnnotationPage] ?? { canUndo: false, canRedo: false }
  const toolbarCaps = isWhiteboardOpen
    ? wbCaps
    : spreadStrokeToolbarActive
      ? spreadOverlayCaps
      : activeAnnCaps
  const clearTargetPage = isWhiteboardOpen ? whiteboardPage : activeAnnotationPage
  const clearInkSpreadPagePair =
    spreadStrokeToolbarActive && spreadRightPage != null
      ? ({ left: pageNumber, right: spreadRightPage } as const)
      : null

  const onWhiteboardCaps = useCallback((caps: AnnotationCapabilities) => {
    setWbCaps(caps)
  }, [])

  const onSpreadOverlayCaps = useCallback((caps: AnnotationCapabilities) => {
    setSpreadOverlayCaps(caps)
  }, [])

  function getActiveAnnotationRef() {
    if (isWhiteboardOpen) return wbAnnRef
    if (isSinglePageMode) return leftAnnRef
    if (spreadStrokeToolbarActive) return spreadStrokeOverlayRef
    if (spreadRightPage != null && annotationTargetPage === spreadRightPage) return rightAnnRef
    return leftAnnRef
  }

  const lessonPaperOverlayMode: BookAnnotationInteractionMode = useMemo(() => {
    if (lessonPaperMode === 'draw') return lessonPaperDrawTool === 'highlighter' ? 'marker' : 'pen'
    if (lessonPaperMode === 'select') return 'text'
    return 'laser'
  }, [lessonPaperDrawTool, lessonPaperMode])

  return {
    annotationMode, setAnnotationMode,
    stampVariant, setStampVariant,
    stampQuestionColor, setStampQuestionColor,
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
    penColor,
    penInkStyle,
    markerColor,
    markerColorSource,
    markerCustomHex,
    pickMarkerSwatchColor,
    pickMarkerCustomColor,
    penThicknessStep, setPenThicknessStep,
    markerThicknessStep, setMarkerThicknessStep,
    eraserPixelThicknessStep, setEraserPixelThicknessStep,
    eraserLineThicknessStep, setEraserLineThicknessStep,
    textVisualStyle, setTextVisualStyle,
    textFillColor, setTextFillColor,
    penLineDashStyle, setPenLineDashStyle,
    markerLineDashStyle, setMarkerLineDashStyle,
    shapeLineDashStyle, setShapeLineDashStyle,
    shapeStrokeEnabled, setShapeStrokeEnabled,
    shapeFillMode, setShapeFillMode,
    shapeFillColor, setShapeFillColor,
    eyedropperVariant, setEyedropperVariant,
    strokeLineDashStyleForInk,
    annotationTargetPage, setAnnotationTargetPage,
    clearInkOpen, setClearInkOpen,
    isAnnotationRailVisible, setIsAnnotationRailVisible,
    leftAnnRef, rightAnnRef, wbAnnRef, spreadStrokeOverlayRef,
    strokeWidthScale,
    eraserLineStrokeWidthScale,
    penStrokeWidthScale,
    strokeColor,
    shapeStrokeWidthScale,
    stampScale,
    textFontSizeNorm,
    stickyFontSizeNorm,
    shapeColor,
    toolbarCaps, clearTargetPage, clearInkSpreadPagePair,
    spreadStrokeCaptureEnabled: spreadStrokeToolbarActive,
    onSpreadOverlayCaps,
    onLeftAnnotationCaps, onRightAnnotationCaps, onWhiteboardCaps,
    getActiveAnnotationRef,
    lessonPaperOverlayMode,
  }
}
