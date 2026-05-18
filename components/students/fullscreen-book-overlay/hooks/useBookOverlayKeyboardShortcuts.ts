import { useEffect, useRef } from 'react'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import {
  BOOK_OVERLAY_DEFAULT_SHAPE_MODE,
  BOOK_OVERLAY_ERASER_MODES,
  BOOK_OVERLAY_SHAPE_MODES,
  BOOK_OVERLAY_STAMP_VARIANTS,
  BOOK_OVERLAY_STAMP_VARIANT_BY_DIGIT,
  INITIAL_SHORTCUT_TAP_STATE,
  isBookOverlayShapeMode,
  resolveShortcutTapIndex,
  type BookOverlayShapeMode,
  type ShortcutTapState,
} from '@/lib/books/book-overlay-keyboard-shortcuts'
import { EYEDROPPER_VARIANTS, type EyedropperVariant } from '@/lib/books/eyedropper-variant'

const MAX_THICKNESS_STEP = 6 satisfies AnnotationStrokeThicknessStep

function clampThicknessStep(step: number): AnnotationStrokeThicknessStep {
  return Math.max(0, Math.min(MAX_THICKNESS_STEP, step)) as AnnotationStrokeThicknessStep
}

interface UseBookOverlayKeyboardShortcutsArgs {
  open: boolean
  onClose: () => void
  isLessonPaperOpen: boolean
  lessonPaperMode: 'type' | 'draw' | 'select'
  annotationMode: BookAnnotationInteractionMode
  setAnnotationMode: (m: BookAnnotationInteractionMode) => void
  stampVariant: StampVariant
  setStampVariant: (v: StampVariant) => void
  eyedropperVariant: EyedropperVariant
  setEyedropperVariant: (v: EyedropperVariant) => void
  isAnnotationRailVisible: boolean
  setIsAnnotationRailVisible: (v: boolean) => void
  isPageListOpen: boolean
  setIsPageListOpen: (v: boolean) => void
  isWhiteboardOpen: boolean
  setIsWhiteboardOpen: (v: boolean) => void
  clearInkOpen: boolean
  pdfDialogOpen: boolean
  regionSelectOpen: boolean
  captionDialogOpen: boolean
  setClearInkOpen: (v: boolean) => void
  penThicknessStep: AnnotationStrokeThicknessStep
  setPenThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  markerThicknessStep: AnnotationStrokeThicknessStep
  setMarkerThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  eraserPixelThicknessStep: AnnotationStrokeThicknessStep
  setEraserPixelThicknessStep: (s: AnnotationStrokeThicknessStep) => void
  toolbarCaps: { canUndo: boolean; canRedo: boolean }
  getActiveAnnotationRef: () => {
    current: { undo: () => void; redo: () => void; clear: () => void } | null
  }
}

export function useBookOverlayKeyboardShortcuts({
  open,
  onClose,
  isLessonPaperOpen,
  lessonPaperMode,
  annotationMode,
  setAnnotationMode,
  stampVariant,
  setStampVariant,
  eyedropperVariant,
  setEyedropperVariant,
  isAnnotationRailVisible,
  setIsAnnotationRailVisible,
  isPageListOpen,
  setIsPageListOpen,
  isWhiteboardOpen,
  setIsWhiteboardOpen,
  clearInkOpen,
  pdfDialogOpen,
  regionSelectOpen,
  captionDialogOpen,
  setClearInkOpen,
  penThicknessStep,
  setPenThicknessStep,
  markerThicknessStep,
  setMarkerThicknessStep,
  eraserPixelThicknessStep,
  setEraserPixelThicknessStep,
  toolbarCaps,
  getActiveAnnotationRef,
}: UseBookOverlayKeyboardShortcutsArgs) {
  const lastShapeRef = useRef<BookOverlayShapeMode>(BOOK_OVERLAY_DEFAULT_SHAPE_MODE)
  const stampTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)
  const shapeTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)
  const eyedropperTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)
  const eraserTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)

  useEffect(() => {
    if (isBookOverlayShapeMode(annotationMode)) {
      lastShapeRef.current = annotationMode
    }
  }, [annotationMode])

  useEffect(() => {
    if (!open) return

    function shouldIgnoreToolShortcuts(): boolean {
      if (isBookOverlayKeyboardTypingTarget()) return true
      if (isLessonPaperOpen && lessonPaperMode === 'type') return true
      if (clearInkOpen || pdfDialogOpen || regionSelectOpen || captionDialogOpen) return true
      return false
    }

    function activateShape(mode: BookOverlayShapeMode) {
      lastShapeRef.current = mode
      setAnnotationMode(mode)
    }

    function tapIndex(
      ref: { current: ShortcutTapState },
      variantCount: number,
      currentIndex: number,
    ): number {
      const now = performance.now()
      const { index, nextState } = resolveShortcutTapIndex(
        ref.current,
        now,
        variantCount,
        currentIndex,
      )
      ref.current = nextState
      return index
    }

    function stampCurrentIndex(): number {
      const idx = BOOK_OVERLAY_STAMP_VARIANTS.indexOf(stampVariant)
      return idx >= 0 ? idx : 0
    }

    function shapeCurrentIndex(): number {
      if (isBookOverlayShapeMode(annotationMode)) {
        const idx = BOOK_OVERLAY_SHAPE_MODES.indexOf(annotationMode)
        return idx >= 0 ? idx : 0
      }
      const idx = BOOK_OVERLAY_SHAPE_MODES.indexOf(lastShapeRef.current)
      return idx >= 0 ? idx : 0
    }

    function eyedropperCurrentIndex(): number {
      const idx = EYEDROPPER_VARIANTS.indexOf(eyedropperVariant)
      return idx >= 0 ? idx : 0
    }

    function eraserCurrentIndex(): number {
      const idx = BOOK_OVERLAY_ERASER_MODES.indexOf(
        annotationMode as (typeof BOOK_OVERLAY_ERASER_MODES)[number],
      )
      return idx >= 0 ? idx : 0
    }

    function adjustThickness(delta: -1 | 1) {
      if (annotationMode === 'pen' || annotationMode === 'text') {
        setPenThicknessStep(clampThicknessStep(penThicknessStep + delta))
        return
      }
      if (annotationMode === 'marker' || annotationMode === 'sticky') {
        setMarkerThicknessStep(clampThicknessStep(markerThicknessStep + delta))
        return
      }
      if (annotationMode === 'eraser') {
        setEraserPixelThicknessStep(clampThicknessStep(eraserPixelThicknessStep + delta))
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return

      const key = e.key
      const keyLower = key.length === 1 ? key.toLowerCase() : key

      if (key === 'Escape') {
        if (clearInkOpen || pdfDialogOpen || regionSelectOpen || captionDialogOpen) return
        if (isWhiteboardOpen) {
          e.preventDefault()
          setIsWhiteboardOpen(false)
          return
        }
        if (isPageListOpen) {
          e.preventDefault()
          setIsPageListOpen(false)
          return
        }
        e.preventDefault()
        onClose()
        return
      }

      const mod = e.ctrlKey || e.metaKey

      if (mod && (keyLower === 'z' || keyLower === 'y')) {
        if (shouldIgnoreToolShortcuts()) return
        const ann = getActiveAnnotationRef().current
        if (!ann) return
        if (keyLower === 'y' || (keyLower === 'z' && e.shiftKey)) {
          if (!toolbarCaps.canRedo) return
          e.preventDefault()
          ann.redo()
          return
        }
        if (keyLower === 'z' && !e.shiftKey) {
          if (!toolbarCaps.canUndo) return
          e.preventDefault()
          ann.undo()
          return
        }
      }

      if (mod && e.shiftKey && key === 'Backspace') {
        if (shouldIgnoreToolShortcuts()) return
        e.preventDefault()
        setClearInkOpen(true)
        return
      }

      if (e.altKey && BOOK_OVERLAY_STAMP_VARIANT_BY_DIGIT[key]) {
        if (shouldIgnoreToolShortcuts()) return
        e.preventDefault()
        stampTapRef.current = INITIAL_SHORTCUT_TAP_STATE
        setStampVariant(BOOK_OVERLAY_STAMP_VARIANT_BY_DIGIT[key]!)
        setAnnotationMode('stamp')
        return
      }

      if (shouldIgnoreToolShortcuts()) return
      if (mod) return

      if (key === 'Backquote') {
        e.preventDefault()
        setIsAnnotationRailVisible(!isAnnotationRailVisible)
        return
      }

      if (keyLower === 'g') {
        e.preventDefault()
        setIsPageListOpen(!isPageListOpen)
        if (!isPageListOpen) setIsWhiteboardOpen(false)
        return
      }

      if (keyLower === 'w') {
        e.preventDefault()
        setIsWhiteboardOpen(!isWhiteboardOpen)
        if (!isWhiteboardOpen) setIsPageListOpen(false)
        return
      }

      if (key === '[' || key === ']') {
        e.preventDefault()
        adjustThickness(key === '[' ? -1 : 1)
        return
      }

      if (keyLower === 'p') {
        e.preventDefault()
        setAnnotationMode('pen')
        return
      }
      if (keyLower === 'i') {
        if (e.repeat) return
        e.preventDefault()
        const idx = tapIndex(eyedropperTapRef, EYEDROPPER_VARIANTS.length, eyedropperCurrentIndex())
        setEyedropperVariant(EYEDROPPER_VARIANTS[idx]!)
        setAnnotationMode('eyedropper')
        return
      }
      if (keyLower === 'h') {
        e.preventDefault()
        setAnnotationMode('marker')
        return
      }
      if (keyLower === 'e') {
        if (e.repeat) return
        e.preventDefault()
        const idx = tapIndex(eraserTapRef, BOOK_OVERLAY_ERASER_MODES.length, eraserCurrentIndex())
        setAnnotationMode(BOOK_OVERLAY_ERASER_MODES[idx]!)
        return
      }
      if (keyLower === 'm') {
        if (e.repeat) return
        e.preventDefault()
        const idx = tapIndex(shapeTapRef, BOOK_OVERLAY_SHAPE_MODES.length, shapeCurrentIndex())
        activateShape(BOOK_OVERLAY_SHAPE_MODES[idx]!)
        return
      }
      if (keyLower === 's') {
        if (e.repeat) return
        e.preventDefault()
        const idx = tapIndex(stampTapRef, BOOK_OVERLAY_STAMP_VARIANTS.length, stampCurrentIndex())
        setStampVariant(BOOK_OVERLAY_STAMP_VARIANTS[idx]!)
        setAnnotationMode('stamp')
        return
      }
      if (keyLower === 't') {
        e.preventDefault()
        setAnnotationMode('text')
        return
      }
      if (keyLower === 'n') {
        e.preventDefault()
        setAnnotationMode('sticky')
        return
      }
      if (keyLower === 'k') {
        e.preventDefault()
        setAnnotationMode('callout')
        return
      }
      if (keyLower === 'l') {
        e.preventDefault()
        setAnnotationMode('laser')
        return
      }

      const shapeByKey: Record<string, BookOverlayShapeMode> = {
        r: 'rect',
        o: 'ellipse',
        a: 'arrow',
      }
      if (shapeByKey[keyLower]) {
        e.preventDefault()
        shapeTapRef.current = INITIAL_SHORTCUT_TAP_STATE
        activateShape(shapeByKey[keyLower]!)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    open,
    onClose,
    isLessonPaperOpen,
    lessonPaperMode,
    annotationMode,
    setAnnotationMode,
    stampVariant,
    setStampVariant,
    eyedropperVariant,
    setEyedropperVariant,
    isAnnotationRailVisible,
    setIsAnnotationRailVisible,
    isPageListOpen,
    setIsPageListOpen,
    isWhiteboardOpen,
    setIsWhiteboardOpen,
    clearInkOpen,
    pdfDialogOpen,
    regionSelectOpen,
    captionDialogOpen,
    setClearInkOpen,
    penThicknessStep,
    setPenThicknessStep,
    markerThicknessStep,
    setMarkerThicknessStep,
    eraserPixelThicknessStep,
    setEraserPixelThicknessStep,
    toolbarCaps,
    getActiveAnnotationRef,
  ])
}
