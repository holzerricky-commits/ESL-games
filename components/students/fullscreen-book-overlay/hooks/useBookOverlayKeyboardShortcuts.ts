import { useEffect, useRef } from 'react'
import type { AnnotationStrokeThicknessStep, BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { StampVariant, WritableStickerVariant } from '@/lib/books/annotation-command-types'
import type { StickerKind } from '@/lib/books/sticker-tool'
import {
  commitBookOverlayTypingTarget,
  focusBookOverlayAnnotationField,
  getBookOverlayAnnotationEditSessionId,
  isBookOverlayAnnotationEditSessionActive,
  isBookOverlayKeyboardTypingTarget,
  isWritingAssistTabActive,
  setBookOverlayAnnotationEditSessionId,
  shouldDeferBookOverlayToolShortcuts,
} from '@/lib/books/book-overlay-keyboard-guards'
import { requestSpreadSessionFlush } from '@/lib/books/spread-session-events'
import {
  BOOK_OVERLAY_DEFAULT_SHAPE_MODE,
  BOOK_OVERLAY_ERASER_MODES,
  BOOK_OVERLAY_SHAPE_MODES,
  BOOK_OVERLAY_STAMP_VARIANTS,
  ANNOTATION_KEYBOARD_NUDGE_NORM,
  ANNOTATION_KEYBOARD_NUDGE_SHIFT_MULTIPLIER,
  BOOK_OVERLAY_STAMP_VARIANT_BY_DIGIT,
  INITIAL_SHORTCUT_TAP_STATE,
  isBookOverlayShapeMode,
  resolveShortcutTapIndex,
  type BookOverlayShapeMode,
  type ShortcutTapState,
} from '@/lib/books/book-overlay-keyboard-shortcuts'
import { EYEDROPPER_VARIANTS, type EyedropperVariant } from '@/lib/books/eyedropper-variant'
import { PEN_STROKE_PROFILES, type PenStrokeProfile } from '@/lib/books/pen-stroke-profile'

const MAX_THICKNESS_STEP = 6 satisfies AnnotationStrokeThicknessStep

function clampThicknessStep(step: number): AnnotationStrokeThicknessStep {
  return Math.max(0, Math.min(MAX_THICKNESS_STEP, step)) as AnnotationStrokeThicknessStep
}

interface UseBookOverlayKeyboardShortcutsArgs {
  open: boolean
  onClose: () => void
  isLessonPaperOpen: boolean
  annotationMode: BookAnnotationInteractionMode
  setAnnotationMode: (m: BookAnnotationInteractionMode) => void
  penStrokeProfile: PenStrokeProfile
  setPenStrokeProfile: (profile: PenStrokeProfile) => void
  stampVariant: StampVariant
  setStampVariant: (v: StampVariant) => void
  stickerKind: StickerKind
  setStickerKind: (k: StickerKind) => void
  writableStickerVariant: WritableStickerVariant
  setWritableStickerVariant: (v: WritableStickerVariant) => void
  eyedropperVariant: EyedropperVariant
  setEyedropperVariant: (v: EyedropperVariant) => void
  isAnnotationRailVisible: boolean
  setIsAnnotationRailVisible: (v: boolean) => void
  isPageListOpen: boolean
  setIsPageListOpen: (v: boolean) => void
  pageListRailTab: 'book' | 'board'
  setPageListRailTab: (tab: 'book' | 'board') => void
  isWhiteboardOpen: boolean
  isWhiteboardSessionOpen: boolean
  isWhiteboardMinimized: boolean
  setIsWhiteboardOpen: (v: boolean) => void
  launchOpenWhiteboard?: () => void
  launchExpandWhiteboard?: () => void
  launchCloseWhiteboard?: () => void
  setWhiteboardSlotSide?: (side: 'left' | 'right') => void
  pdfDialogOpen: boolean
  regionSelectOpen: boolean
  captionDialogOpen: boolean
  translateDockOpen: boolean
  setTranslateDockOpen: (v: boolean) => void
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
  toolbarCaps: { canUndo: boolean; canRedo: boolean }
  selectAllOnActivePage: () => void
  deselectAllOnActivePage: () => void
  hasAnyAnnotationSelection: () => boolean
  getPageAnnotationRef: () => {
    current: {
      getSelectedIds?: () => string[]
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
      setNudgePreview?: (dx: number, dy: number) => void
      commitNudgePreview?: () => boolean
      clearNudgePreview?: () => void
    } | null
  }
  getActiveAnnotationRef: () => {
    current: {
      undo: () => void
      redo: () => void
      clear: () => void
      getSelectedIds?: () => string[]
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
      setNudgePreview?: (dx: number, dy: number) => void
      commitNudgePreview?: () => boolean
      clearNudgePreview?: () => void
    } | null
  }
}

export function useBookOverlayKeyboardShortcuts({
  open,
  onClose,
  isLessonPaperOpen,
  annotationMode,
  setAnnotationMode,
  penStrokeProfile,
  setPenStrokeProfile,
  stampVariant,
  setStampVariant,
  stickerKind,
  setStickerKind,
  writableStickerVariant,
  setWritableStickerVariant,
  eyedropperVariant,
  setEyedropperVariant,
  isAnnotationRailVisible,
  setIsAnnotationRailVisible,
  isPageListOpen,
  setIsPageListOpen,
  pageListRailTab,
  setPageListRailTab,
  isWhiteboardOpen,
  isWhiteboardSessionOpen,
  isWhiteboardMinimized,
  setIsWhiteboardOpen,
  launchOpenWhiteboard,
  launchExpandWhiteboard,
  launchCloseWhiteboard,
  setWhiteboardSlotSide,
  pdfDialogOpen,
  regionSelectOpen,
  captionDialogOpen,
  translateDockOpen,
  setTranslateDockOpen,
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
  toolbarCaps,
  selectAllOnActivePage,
  deselectAllOnActivePage,
  hasAnyAnnotationSelection,
  getPageAnnotationRef,
  getActiveAnnotationRef,
}: UseBookOverlayKeyboardShortcutsArgs) {
  const lastShapeRef = useRef<BookOverlayShapeMode>(BOOK_OVERLAY_DEFAULT_SHAPE_MODE)
  const stampTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)
  const shapeTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)
  const penTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)
  const eyedropperTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)
  const eraserTapRef = useRef<ShortcutTapState>(INITIAL_SHORTCUT_TAP_STATE)
  const nudgeOffsetRef = useRef({ dx: 0, dy: 0 })
  const nudgeKeysDownRef = useRef(new Set<string>())
  const getPageAnnotationRefNudge = useRef(getPageAnnotationRef)
  getPageAnnotationRefNudge.current = getPageAnnotationRef

  function isArrowNudgeKey(key: string): boolean {
    return (
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown'
    )
  }

  function nudgeStepForEvent(e: KeyboardEvent): number {
    return (
      ANNOTATION_KEYBOARD_NUDGE_NORM *
      (e.shiftKey ? ANNOTATION_KEYBOARD_NUDGE_SHIFT_MULTIPLIER : 1)
    )
  }

  function applyArrowStepToOffset(key: string, step: number): void {
    if (key === 'ArrowLeft') nudgeOffsetRef.current.dx -= step
    else if (key === 'ArrowRight') nudgeOffsetRef.current.dx += step
    else if (key === 'ArrowUp') nudgeOffsetRef.current.dy -= step
    else if (key === 'ArrowDown') nudgeOffsetRef.current.dy += step
  }

  function syncNudgePreview(): void {
    const { dx, dy } = nudgeOffsetRef.current
    getPageAnnotationRefNudge.current().current?.setNudgePreview?.(dx, dy)
  }

  function commitNudgeGesture(): void {
    const ann = getPageAnnotationRefNudge.current().current
    const { dx, dy } = nudgeOffsetRef.current
    nudgeKeysDownRef.current.clear()
    nudgeOffsetRef.current = { dx: 0, dy: 0 }
    if (dx === 0 && dy === 0) {
      ann?.clearNudgePreview?.()
      return
    }
    ann?.commitNudgePreview?.()
  }

  useEffect(() => {
    if (!open) return

    function nudgeTypingBlocksShortcuts(): boolean {
      return shouldDeferBookOverlayToolShortcuts() && !isLessonPaperOpen
    }

    function onNudgeKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const mod = e.ctrlKey || e.metaKey
      if (mod || e.altKey || !isArrowNudgeKey(e.key)) return
      if (nudgeTypingBlocksShortcuts()) return
      const ann = getPageAnnotationRefNudge.current().current
      const ids = ann?.getSelectedIds?.() ?? []
      if (ids.length === 0 || !ann?.setNudgePreview) return
      if (!e.repeat) nudgeKeysDownRef.current.add(e.key)
      applyArrowStepToOffset(e.key, nudgeStepForEvent(e))
      syncNudgePreview()
      e.preventDefault()
    }

    function onNudgeKeyUp(e: KeyboardEvent) {
      if (!isArrowNudgeKey(e.key)) return
      if (!nudgeKeysDownRef.current.has(e.key)) return
      nudgeKeysDownRef.current.delete(e.key)
      if (nudgeKeysDownRef.current.size === 0) {
        commitNudgeGesture()
      }
    }

    function onNudgeWindowBlur() {
      if (nudgeKeysDownRef.current.size > 0) {
        commitNudgeGesture()
      }
    }

    window.addEventListener('keydown', onNudgeKeyDown, true)
    window.addEventListener('keyup', onNudgeKeyUp, true)
    window.addEventListener('blur', onNudgeWindowBlur)
    return () => {
      window.removeEventListener('keydown', onNudgeKeyDown, true)
      window.removeEventListener('keyup', onNudgeKeyUp, true)
      window.removeEventListener('blur', onNudgeWindowBlur)
      if (nudgeKeysDownRef.current.size > 0 || nudgeOffsetRef.current.dx !== 0 || nudgeOffsetRef.current.dy !== 0) {
        commitNudgeGesture()
      }
    }
  }, [open, isLessonPaperOpen])

  useEffect(() => {
    if (isBookOverlayShapeMode(annotationMode)) {
      lastShapeRef.current = annotationMode
    }
  }, [annotationMode])

  useEffect(() => {
    if (!open) return

    function isAnnotationFieldTyping(): boolean {
      return shouldDeferBookOverlayToolShortcuts() && !isLessonPaperOpen
    }

    function shouldIgnoreToolShortcuts(): boolean {
      if (shouldDeferBookOverlayToolShortcuts()) return true
      if (isLessonPaperOpen) return true
      if (pdfDialogOpen || regionSelectOpen || captionDialogOpen) return true
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

    function penCurrentIndex(): number {
      const idx = PEN_STROKE_PROFILES.indexOf(penStrokeProfile)
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
      if (annotationMode === 'pen') {
        setPenThicknessStep(clampThicknessStep(penThicknessStep + delta))
        return
      }
      if (annotationMode === 'text') {
        setTextThicknessStep(clampThicknessStep(textThicknessStep + delta))
        return
      }
      if (annotationMode === 'marker') {
        setMarkerThicknessStep(clampThicknessStep(markerThicknessStep + delta))
        return
      }
      if (annotationMode === 'sticky') {
        setStickyThicknessStep(clampThicknessStep(stickyThicknessStep + delta))
        return
      }
      if (isBookOverlayShapeMode(annotationMode)) {
        setShapeThicknessStep(clampThicknessStep(shapeThicknessStep + delta))
        return
      }
      if (annotationMode === 'stamp' || annotationMode === 'callout') {
        setStampThicknessStep(clampThicknessStep(stampThicknessStep + delta))
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
      const mod = e.ctrlKey || e.metaKey

      if (
        !mod &&
        !e.altKey &&
        key.length === 1 &&
        isBookOverlayAnnotationEditSessionActive() &&
        !isBookOverlayKeyboardTypingTarget()
      ) {
        const editId = getBookOverlayAnnotationEditSessionId()
        if (editId && typeof document !== 'undefined') {
          const hasLiveField = document.querySelector(
            `textarea[data-annotation-id="${CSS.escape(editId)}"]`,
          )
          if (hasLiveField) focusBookOverlayAnnotationField(editId)
        }
      }

      const annotationTyping = isAnnotationFieldTyping()
      /** Alt+letter while typing: commit field then run tool (Ctrl is reserved by the browser). */
      const altCommitThenShortcut = annotationTyping && e.altKey && !mod

      if (altCommitThenShortcut) {
        commitBookOverlayTypingTarget()
      }

      if (key === 'Escape' && annotationTyping) {
        e.preventDefault()
        e.stopPropagation()
        commitBookOverlayTypingTarget()
        return
      }

      if (key === 'Escape') {
        if (pdfDialogOpen || regionSelectOpen || captionDialogOpen) return
        if (hasAnyAnnotationSelection()) {
          e.preventDefault()
          commitNudgeGesture()
          deselectAllOnActivePage()
          return
        }
        if (translateDockOpen) {
          e.preventDefault()
          setTranslateDockOpen(false)
          return
        }
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
        requestSpreadSessionFlush()
        e.preventDefault()
        onClose()
        return
      }

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
        getActiveAnnotationRef().current?.clear()
        return
      }

      if (mod && !e.shiftKey && keyLower === 's') {
        if (shouldIgnoreToolShortcuts()) return
        requestSpreadSessionFlush()
        e.preventDefault()
        return
      }

      if (mod && keyLower === 'a') {
        if (shouldIgnoreToolShortcuts()) return
        e.preventDefault()
        if (e.shiftKey) {
          deselectAllOnActivePage()
        } else {
          selectAllOnActivePage()
        }
        return
      }

      if (mod && !e.shiftKey && keyLower === 'd') {
        if (shouldIgnoreToolShortcuts()) return
        const ann = getPageAnnotationRef().current
        if (ann?.duplicateSelected?.()) {
          e.preventDefault()
        }
        return
      }

      if (mod && !e.shiftKey && (keyLower === 'c' || keyLower === 'v')) {
        if (shouldIgnoreToolShortcuts()) return
        const ann = getPageAnnotationRef().current
        if (!ann) {
          /* fall through */
        } else if (keyLower === 'c') {
          const ids = ann.getSelectedIds?.() ?? []
          if (ids.length === 0) return
          if (ann.copySelected?.()) {
            e.preventDefault()
          }
          return
        } else if (keyLower === 'v') {
          if (ann.pasteFromClipboard?.()) {
            e.preventDefault()
          }
          return
        }
      }

      if (mod && keyLower === 'g') {
        if (shouldIgnoreToolShortcuts()) return
        const ann = getPageAnnotationRef().current
        const selected = ann?.getSelectedIds?.() ?? []
        if (selected.length > 0) {
          const ok = e.shiftKey
            ? ann?.removeFromGroupSelected?.()
            : ann?.toggleGroupSelected?.()
          if (ok) {
            e.preventDefault()
          }
        }
        return
      }

      if (!mod && !e.altKey && (key === 'Delete' || key === 'Backspace')) {
        if (shouldIgnoreToolShortcuts()) return
        const ann = getPageAnnotationRef().current
        const ids = ann?.getSelectedIds?.() ?? []
        if (ids.length > 0 && ann?.deleteSelected?.()) {
          e.preventDefault()
          return
        }
      }

      if (e.altKey && BOOK_OVERLAY_STAMP_VARIANT_BY_DIGIT[key]) {
        if (shouldIgnoreToolShortcuts()) return
        e.preventDefault()
        stampTapRef.current = INITIAL_SHORTCUT_TAP_STATE
        setStampVariant(BOOK_OVERLAY_STAMP_VARIANT_BY_DIGIT[key]!)
        setStickerKind('quick')
        setAnnotationMode('sticker')
        return
      }

      if (key === 'Tab' && !mod && !e.altKey) {
        if (isWritingAssistTabActive()) return
        if (shouldIgnoreToolShortcuts()) return
        if (annotationMode !== 'select') return
        const ann = getPageAnnotationRef().current
        if (!ann?.selectNextInStack) return
        e.preventDefault()
        ann.selectNextInStack(e.shiftKey ? -1 : 1)
        return
      }

      if (shouldIgnoreToolShortcuts()) return
      if (mod) return
      if (annotationTyping && e.altKey && !altCommitThenShortcut) return

      if (key === 'Backquote') {
        e.preventDefault()
        setIsAnnotationRailVisible(!isAnnotationRailVisible)
        return
      }

      if (keyLower === 'l') {
        e.preventDefault()
        if (!isPageListOpen) {
          setIsPageListOpen(true)
          if (isWhiteboardOpen) setPageListRailTab('board')
          else setPageListRailTab('book')
        } else {
          setIsPageListOpen(false)
        }
        return
      }

      if (keyLower === 'w') {
        e.preventDefault()
        if (!isWhiteboardSessionOpen) {
          launchOpenWhiteboard?.()
          setIsPageListOpen(false)
        } else if (isWhiteboardMinimized) {
          launchExpandWhiteboard?.()
        } else {
          launchCloseWhiteboard?.()
        }
        return
      }

      if (
        isWhiteboardOpen &&
        e.altKey &&
        !mod &&
        (key === 'ArrowLeft' || key === 'ArrowRight') &&
        setWhiteboardSlotSide
      ) {
        e.preventDefault()
        setWhiteboardSlotSide(key === 'ArrowLeft' ? 'left' : 'right')
        return
      }

      if (keyLower === 'c') {
        e.preventDefault()
        setTranslateDockOpen(!translateDockOpen)
        return
      }

      if (key === '[' || key === ']') {
        e.preventDefault()
        adjustThickness(key === '[' ? -1 : 1)
        return
      }

      if (keyLower === 'p') {
        if (e.repeat) return
        e.preventDefault()
        const idx = tapIndex(penTapRef, PEN_STROKE_PROFILES.length, penCurrentIndex())
        setPenStrokeProfile(PEN_STROKE_PROFILES[idx]!)
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
        setStickerKind('quick')
        setAnnotationMode('sticker')
        return
      }
      if (keyLower === 't') {
        e.preventDefault()
        setAnnotationMode('text')
        return
      }
      if (keyLower === 'n') {
        e.preventDefault()
        setStickerKind('writable')
        setAnnotationMode('sticker')
        return
      }
      if (keyLower === 'k') {
        e.preventDefault()
        setAnnotationMode('callout')
        return
      }
      if (keyLower === 'v') {
        e.preventDefault()
        setAnnotationMode('select')
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

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [
    open,
    onClose,
    isLessonPaperOpen,
    annotationMode,
    setAnnotationMode,
    penStrokeProfile,
    setPenStrokeProfile,
    stampVariant,
    setStampVariant,
    stickerKind,
    setStickerKind,
    writableStickerVariant,
    setWritableStickerVariant,
    eyedropperVariant,
    setEyedropperVariant,
    isAnnotationRailVisible,
    setIsAnnotationRailVisible,
    isPageListOpen,
    setIsPageListOpen,
    pageListRailTab,
    setPageListRailTab,
    isWhiteboardOpen,
    isWhiteboardSessionOpen,
    isWhiteboardMinimized,
    setIsWhiteboardOpen,
    launchOpenWhiteboard,
    launchExpandWhiteboard,
    launchCloseWhiteboard,
    setWhiteboardSlotSide,
    pdfDialogOpen,
    regionSelectOpen,
    captionDialogOpen,
    translateDockOpen,
    setTranslateDockOpen,
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
    toolbarCaps,
    selectAllOnActivePage,
    deselectAllOnActivePage,
    hasAnyAnnotationSelection,
    getPageAnnotationRef,
    getActiveAnnotationRef,
  ])
}
