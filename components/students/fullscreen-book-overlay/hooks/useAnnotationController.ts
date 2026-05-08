import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ANNOTATION_PEN_STROKE_WIDTH_STEPS,
  ANNOTATION_STROKE_WIDTH_STEPS,
  type AnnotationStrokeThicknessStep,
  type BookAnnotationInteractionMode,
} from '@/lib/books/annotation-storage'
import { ANNOTATION_PEN_SWATCHES, ANNOTATION_MARKER_SWATCHES } from '@/lib/books/annotation-palettes'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import type { AnnotationCapabilities, BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { ANNOTATION_TEXT_FONT_NORM_STEPS } from '@/components/students/fullscreen-book-overlay/constants'

interface UseAnnotationControllerArgs {
  pageNumber: number
  isSinglePageMode: boolean
  isWhiteboardOpen: boolean
  whiteboardPage: number
  lessonPaperMode: 'type' | 'draw' | 'select'
  lessonPaperDrawTool: 'pen' | 'highlighter'
}

export function useAnnotationController({
  pageNumber,
  isSinglePageMode,
  isWhiteboardOpen,
  whiteboardPage,
  lessonPaperMode,
  lessonPaperDrawTool,
}: UseAnnotationControllerArgs) {
  const [wbCaps, setWbCaps] = useState<AnnotationCapabilities>({ canUndo: false, canRedo: false })
  const [annotationMode, setAnnotationMode] = useState<BookAnnotationInteractionMode>('pen')
  const [stampVariant, setStampVariant] = useState<StampVariant>('check')
  const [penColor, setPenColor] = useState<string>(ANNOTATION_PEN_SWATCHES[0])
  const [markerColor, setMarkerColor] = useState<string>(ANNOTATION_MARKER_SWATCHES[0])
  const [penThicknessStep, setPenThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [markerThicknessStep, setMarkerThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [eraserPixelThicknessStep, setEraserPixelThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [eraserLineThicknessStep, setEraserLineThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [annotationTargetPage, setAnnotationTargetPage] = useState(pageNumber)
  const [annCapsByPage, setAnnCapsByPage] = useState<Record<number, AnnotationCapabilities>>({})
  const [clearInkOpen, setClearInkOpen] = useState(false)
  const [isAnnotationRailVisible, setIsAnnotationRailVisible] = useState(true)
  const leftAnnRef = useRef<BookPageAnnotationHandle>(null)
  const rightAnnRef = useRef<BookPageAnnotationHandle>(null)
  const wbAnnRef = useRef<BookPageAnnotationHandle>(null)

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

  const strokeColor =
    annotationMode === 'pen' ? penColor : annotationMode === 'marker' ? markerColor : undefined

  const shapeStrokeWidthScale = ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
  const stampScale = ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
  const textFontSizeNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[penThicknessStep]
  const stickyFontSizeNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[markerThicknessStep]
  const shapeColor = penColor

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
  const onRightAnnotationCaps = useCallback(
    (caps: AnnotationCapabilities) => setCapsForPage(pageNumber + 1, caps),
    [pageNumber, setCapsForPage],
  )

  useEffect(() => {
    setAnnotationTargetPage(pageNumber)
  }, [pageNumber, isSinglePageMode])

  const activeAnnotationPage = isSinglePageMode ? pageNumber : annotationTargetPage
  const activeAnnCaps = annCapsByPage[activeAnnotationPage] ?? { canUndo: false, canRedo: false }
  const toolbarCaps = isWhiteboardOpen ? wbCaps : activeAnnCaps
  const clearTargetPage = isWhiteboardOpen ? whiteboardPage : activeAnnotationPage

  const onWhiteboardCaps = useCallback((caps: AnnotationCapabilities) => {
    setWbCaps(caps)
  }, [])

  function getActiveAnnotationRef() {
    if (isWhiteboardOpen) return wbAnnRef
    if (isSinglePageMode) return leftAnnRef
    return annotationTargetPage === pageNumber + 1 ? rightAnnRef : leftAnnRef
  }

  const lessonPaperOverlayMode: BookAnnotationInteractionMode = useMemo(() => {
    if (lessonPaperMode === 'draw') return lessonPaperDrawTool === 'highlighter' ? 'marker' : 'pen'
    if (lessonPaperMode === 'select') return 'text'
    return 'laser'
  }, [lessonPaperDrawTool, lessonPaperMode])

  return {
    annotationMode, setAnnotationMode,
    stampVariant, setStampVariant,
    penColor, setPenColor,
    markerColor, setMarkerColor,
    penThicknessStep, setPenThicknessStep,
    markerThicknessStep, setMarkerThicknessStep,
    eraserPixelThicknessStep, setEraserPixelThicknessStep,
    eraserLineThicknessStep, setEraserLineThicknessStep,
    annotationTargetPage, setAnnotationTargetPage,
    clearInkOpen, setClearInkOpen,
    isAnnotationRailVisible, setIsAnnotationRailVisible,
    leftAnnRef, rightAnnRef, wbAnnRef,
    strokeWidthScale, strokeColor, shapeStrokeWidthScale, stampScale, textFontSizeNorm, stickyFontSizeNorm, shapeColor,
    toolbarCaps, clearTargetPage,
    onLeftAnnotationCaps, onRightAnnotationCaps, onWhiteboardCaps,
    getActiveAnnotationRef,
    lessonPaperOverlayMode,
  }
}
