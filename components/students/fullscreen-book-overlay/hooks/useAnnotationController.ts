import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { annotationTargetPageIfChanged } from '@/lib/books/annotation-target-page'
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
  DEFAULT_TEXT_FILL_COLOR,
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
import { pushStripRecent } from '@/lib/books/annotation-strip-recents'
import {
  buildStudentAnnotationToolPrefsPatch,
  patchStudentAnnotationToolPrefs,
  resolveAnnotationToolPrefsFromStorage,
} from '@/lib/books/student-annotation-tool-prefs'
import type { PenInkStyle } from '@/lib/books/pen-ink'
import {
  preloadActiveEffectPenInk,
  preloadEffectPenProfileSwatches,
} from '@/lib/books/effect-pen-preload'
import {
  coercePenSwatchIdForProfile,
  DEFAULT_PEN_STROKE_PROFILE,
  penProfileWidthScaleMultiplier,
  resolvePenInkStyleForProfile,
  type PenStrokeProfile,
} from '@/lib/books/pen-stroke-profile'
import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  TextAnnotationVisualStyle,
} from '@/lib/books/annotation-command-types'
import type { AnnotationCapabilities, BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { ANNOTATION_TEXT_FONT_NORM_STEPS } from '@/components/students/fullscreen-book-overlay/constants'
import { useCtrlTemporarySelect } from '@/components/students/fullscreen-book-overlay/hooks/useCtrlTemporarySelect'
import {
  createInkSessionSelectProxy,
  createSpreadSessionSelectProxy,
  type InkSessionSelectProxyHandle,
} from '@/lib/books/ink-session-select-proxy'
import { whiteboardInkSessionEnabled } from '@/lib/books/feature-flags'
import type { SpreadSessionStore } from '@/lib/books/spread-session-store'
import type { WhiteboardSessionStore } from '@/lib/books/whiteboard-session-store'

interface UseAnnotationControllerArgs {
  studentId: string
  pageNumber: number
  isSinglePageMode: boolean
  isWhiteboardOpen: boolean
  showSpreadRight: boolean
  spreadRightPage: number | null
  overlayOpen: boolean
  isLessonPaperOpen: boolean
  spreadSessionStoreRef?: MutableRefObject<SpreadSessionStore | null>
  whiteboardSessionStoreRef?: MutableRefObject<WhiteboardSessionStore | null>
}

export function useAnnotationController({
  studentId,
  pageNumber,
  isSinglePageMode,
  isWhiteboardOpen,
  showSpreadRight,
  spreadRightPage,
  overlayOpen,
  isLessonPaperOpen,
  spreadSessionStoreRef,
  whiteboardSessionStoreRef,
}: UseAnnotationControllerArgs) {
  const [wbCaps, setWbCaps] = useState<AnnotationCapabilities>({ canUndo: false, canRedo: false })
  const [annotationMode, setAnnotationMode] = useState<BookAnnotationInteractionMode>('pen')
  const ctrlTemporarySelect = useCtrlTemporarySelect({
    enabled: overlayOpen,
    isLessonPaperOpen,
  })
  const effectiveAnnotationMode: BookAnnotationInteractionMode = useMemo(
    () =>
      ctrlTemporarySelect && annotationMode !== 'select' ? 'select' : annotationMode,
    [ctrlTemporarySelect, annotationMode],
  )
  const [stampVariant, setStampVariant] = useState<StampVariant>('check')
  const [stampQuestionColor, setStampQuestionColor] = useState<string>(DEFAULT_STAMP_QUESTION_COLOR)
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
  const [textVisualStyle, setTextVisualStyle] = useState<TextAnnotationVisualStyle>('plain')
  const [textFillColor, setTextFillColor] = useState<string>(DEFAULT_TEXT_FILL_COLOR)
  const [penLineDashStyle, setPenLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [markerLineDashStyle, setMarkerLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [markerStraightStroke, setMarkerStraightStroke] = useState(false)
  const [markerDecoratedEdge, setMarkerDecoratedEdge] = useState(false)
  const [penAutoGroupConnected, setPenAutoGroupConnected] = useState(true)
  const [marqueeSelectRule, setMarqueeSelectRule] = useState<
    import('@/lib/books/annotation-select').MarqueeSelectRule
  >('follow-drag')
  const [shapeLineDashStyle, setShapeLineDashStyle] = useState<AnnotationLineDashStyle>('solid')
  const [shapeStrokeEnabled, setShapeStrokeEnabled] = useState(true)
  const [shapeFillMode, setShapeFillMode] = useState<ShapeFillMode>('none')
  const [shapeFillColor, setShapeFillColor] = useState<string>(ANNOTATION_MARKER_SWATCHES[0])
  const [eyedropperVariant, setEyedropperVariant] = useState<EyedropperVariant>(DEFAULT_EYEDROPPER_VARIANT)
  const [annotationTargetPage, setAnnotationTargetPageState] = useState(pageNumber)
  const setAnnotationTargetPage = useCallback((next: number) => {
    setAnnotationTargetPageState((prev) => annotationTargetPageIfChanged(prev, next))
  }, [])
  const [annCapsByPage, setAnnCapsByPage] = useState<Record<number, AnnotationCapabilities>>({})
  const [isAnnotationRailVisible, setIsAnnotationRailVisible] = useState(true)
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

  useEffect(() => {
    const gen = ++loadGenRef.current
    setPrefsReady(false)
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

  const setPenStrokeProfile = useCallback((profile: PenStrokeProfile) => {
    setPenStrokeProfileState(profile)
    setPenSwatchId((id) => coercePenSwatchIdForProfile(id, profile))
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
    setShapeStrokeSwatchId(id)
    pushStripRecent('shape', id)
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
      ? ANNOTATION_PEN_STROKE_WIDTH_STEPS[penThicknessStep]
      : annotationMode === 'marker'
        ? ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
        : annotationMode === 'eraser-line'
          ? ANNOTATION_STROKE_WIDTH_STEPS[eraserLineThicknessStep]
          : annotationMode === 'eraser'
            ? ANNOTATION_STROKE_WIDTH_STEPS[eraserPixelThicknessStep]
            : ANNOTATION_STROKE_WIDTH_STEPS[shapeThicknessStep]

  const eraserLineStrokeWidthScale = ANNOTATION_STROKE_WIDTH_STEPS[eraserLineThicknessStep]
  const penStrokeWidthScale =
    ANNOTATION_PEN_STROKE_WIDTH_STEPS[penThicknessStep] * penProfileWidthScaleMultiplier(penStrokeProfile)

  const strokeColor =
    annotationMode === 'pen' ? penColor : annotationMode === 'marker' ? markerColor : undefined

  const shapeStrokeWidthScale = ANNOTATION_STROKE_WIDTH_STEPS[shapeThicknessStep]
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
  }, [pageNumber, isSinglePageMode, setAnnotationTargetPage])

  const whiteboardDrawingInteractionActive = useMemo(() => {
    if (!whiteboardInkSessionEnabled || !isWhiteboardOpen) return false
    const mode = effectiveAnnotationMode
    return (
      mode !== 'select' &&
      mode !== 'text' &&
      mode !== 'sticky' &&
      mode !== 'stamp' &&
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
    if (
      isSinglePageMode ||
      !showSpreadRight ||
      spreadRightPage == null ||
      isWhiteboardOpen
    ) {
      return false
    }
    const mode = effectiveAnnotationMode
    return (
      mode !== 'select' &&
      mode !== 'text' &&
      mode !== 'sticky' &&
      mode !== 'stamp' &&
      mode !== 'callout' &&
      mode !== 'eyedropper'
    )
  }, [
    effectiveAnnotationMode,
    isSinglePageMode,
    isWhiteboardOpen,
    showSpreadRight,
    spreadRightPage,
  ])

  const spreadSessionInkActive =
    Boolean(spreadSessionStoreRef) &&
    !isSinglePageMode &&
    showSpreadRight &&
    spreadRightPage != null &&
    !isWhiteboardOpen

  const spreadSessionSelectReady = () =>
    spreadSessionInkActive && spreadSessionStoreRef?.current != null

  const spreadSessionToolbarActive =
    spreadSessionInkActive &&
    (spreadDrawingInteractionActive || effectiveAnnotationMode === 'select')

  const activeAnnotationPage = isSinglePageMode ? pageNumber : annotationTargetPage
  const activeAnnCaps = annCapsByPage[activeAnnotationPage] ?? { canUndo: false, canRedo: false }
  const toolbarCaps = isWhiteboardOpen
    ? whiteboardSessionToolbarActive
      ? wbOverlayCaps
      : wbCaps
    : spreadSessionToolbarActive || spreadDrawingInteractionActive
      ? spreadOverlayCaps
      : activeAnnCaps
  const onWhiteboardCaps = useCallback((caps: AnnotationCapabilities) => {
    setWbCaps(caps)
  }, [])

  const onSpreadOverlayCaps = useCallback((caps: AnnotationCapabilities) => {
    setSpreadOverlayCaps(caps)
  }, [])

  const onWhiteboardOverlayCaps = useCallback((caps: AnnotationCapabilities) => {
    setWbOverlayCaps(caps)
  }, [])

  const spreadSessionSelectProxyRef = useRef<InkSessionSelectProxyHandle | null>(null)
  spreadSessionSelectProxyRef.current = createSpreadSessionSelectProxy(
    () => spreadSessionStoreRef?.current ?? null,
  )

  const whiteboardSessionSelectProxyRef = useRef<InkSessionSelectProxyHandle | null>(null)
  whiteboardSessionSelectProxyRef.current = createInkSessionSelectProxy(
    () => whiteboardSessionStoreRef?.current ?? null,
  )

  function getActiveAnnotationRef() {
    if (isWhiteboardOpen) {
      if (whiteboardDrawingInteractionActive) return wbStrokeOverlayRef
      if (whiteboardSessionSelectReady() && effectiveAnnotationMode === 'select') {
        return whiteboardSessionSelectProxyRef
      }
      return wbAnnRef
    }
    if (isSinglePageMode) return leftAnnRef
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
      if (effectiveAnnotationMode === 'select' && whiteboardSessionSelectReady()) {
        return whiteboardSessionSelectProxyRef
      }
      return wbAnnRef
    }
    if (isSinglePageMode) return leftAnnRef
    if (spreadRightPage != null && effectiveAnnotationMode === 'select') {
      return spreadSessionSelectReady() ? spreadSessionSelectProxyRef : legacySpreadSelectProxyRef
    }
    if (spreadRightPage != null && annotationTargetPage === spreadRightPage) return rightAnnRef
    return leftAnnRef
  }, [
    isWhiteboardOpen,
    isSinglePageMode,
    spreadRightPage,
    annotationTargetPage,
    effectiveAnnotationMode,
    spreadSessionInkActive,
  ])

  const selectAllOnActivePage = useCallback(() => {
    getPageAnnotationRef().current?.selectAll?.()
  }, [getPageAnnotationRef])

  return {
    annotationMode, setAnnotationMode,
    effectiveAnnotationMode,
    ctrlTemporarySelect,
    stampVariant, setStampVariant,
    stampQuestionColor, setStampQuestionColor,
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
    textVisualStyle, setTextVisualStyle,
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
    eyedropperVariant, setEyedropperVariant,
    strokeLineDashStyleForInk,
    annotationTargetPage, setAnnotationTargetPage,
    isAnnotationRailVisible, setIsAnnotationRailVisible,
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
  }
}
