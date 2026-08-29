'use client'

import 'react-pdf/dist/Page/TextLayer.css'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { InteractiveVocabReaderShelf } from '@/components/books/interactive-vocab-reader-shelf'
import { ReadingCheckLiveShelf } from '@/components/books/reading-check-live-shelf'
import type { ReadingCheckLivePin } from '@/components/students/fullscreen-book-overlay/sections/ReadingCheckHotspotPlacementLayer'
import type { ReadingCheckQuestionPinTone } from '@/components/books/reading-check-question-pin'
import { latestReadingCheckLiveMarkForStop } from '@/lib/books/reading-check-live-marks'
import { mapPdfPageToDisplayLabel } from '@/lib/books/page-numbering'
import {
  listReadingCheckLivePinsOnSpread,
  readingCheckStopLinkLabel,
} from '@/lib/books/reading-check-pack'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { focusHoleRectToCaptureRegion } from '@/lib/books/focus-zoom-transform'
import { BookFocusTheaterLayer } from '@/components/students/fullscreen-book-overlay/sections/BookFocusDimOverlay'
import { OverlayDialogs } from './sections/OverlayDialogs'
import { PageListRail } from './sections/PageListRail'
import { BookAudioPlaylistRail } from './sections/BookAudioPlaylistRail'
import { BookExerciseTaskRail } from './sections/BookExerciseTaskRail'
import { BookExercisePlaySheet } from './sections/BookExercisePlaySheet'
import { BookExerciseMcqPlaySheet } from './sections/BookExerciseMcqPlaySheet'
import { AnnotationRail } from './sections/AnnotationRail'
import { BookBottomChrome } from './sections/BookViewport'
import { BookAudioNowPlayingPill } from './sections/BookAudioNowPlayingPill'
import { BookWorkspaceLeftBar } from './sections/BookWorkspaceLeftBar'
import { ClassLessonSettingsPanel } from '@/components/students/class-lesson-settings-panel'
import { ClassToolboxHost } from '@/components/students/class-toolbox/ClassToolboxHost'
import type { ClassToolboxToolId } from '@/lib/class-toolbox/types'
import { BookCanvasStage } from './sections/BookCanvasStage'
import { PageGridStage } from './sections/PageGridStage'
import { useWhiteboardToolbarLaunch } from './hooks/useWhiteboardToolbarLaunch'
import { useBookAudioPlayer } from './hooks/useBookAudioPlayer'
import { useAudioTrackPlacement } from './hooks/useAudioTrackPlacement'
import { useBookExerciseTasks } from './hooks/useBookExerciseTasks'
import { TranslateToolPanel } from './sections/TranslateToolPanel'
import { PictureSearchToolPanel } from './sections/PictureSearchToolPanel'
import { PlaceTranslationOverlay, type PlaceFromTranslateSurface } from './sections/PlaceTranslationOverlay'
import { WritableTextTranslatePopover } from './sections/WritableTextTranslatePopover'
import type { PinWritableTextGlossInput } from './sections/WritableTextTranslatePopover'
import { useWritableTextTranslateSelection } from './hooks/useWritableTextTranslateSelection'
import { WritableTextGlossReviewProvider } from './writable-text-gloss-review-context'
import { appendTextGlossToCommands } from '@/lib/books/text-gloss'
import {
  TRANSLATION_CHIP_FILL,
  TRANSLATION_CHIP_FONT_ID,
  TRANSLATION_CHIP_TEXT,
  translationChipFontSizeNorm,
  translationChipPlacementNorm,
} from '@/lib/translate/place-translation-chip'
import { newAnnotationId } from '@/components/students/book-page-annotation-layer/helpers'
import type { TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import { fetchPlacedImageAsFile } from '@/lib/board-image-import-client'
import {
  buildImageCommandFromEncoded,
  TRANSLATE_PLACE_IMAGE_WIDTH_FRACTION,
} from '@/lib/books/board-image-commit'
import {
  boardPasteAnchorFromElementRect,
} from '@/lib/books/board-paste-placement'
import { downscaleImageFile } from '@/lib/books/clipboard-image'
import { toast } from 'sonner'
import { warmSpeechVoices } from '@/lib/audio/speak-text'
import { getUnitReaderBounds } from '@/lib/books/page-range'
import {
  BOOK_BOTTOM_CHROME_HEIGHT,
  BOOK_OVERLAY_GLASS_CHROME,
  bookWorkspaceDeskLeftCss,
  bookWorkspaceDeskLeftPx,
} from './constants'
import type { FullscreenBookOverlayViewModel } from './hooks/useFullscreenBookOverlayController'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import { bookOverlayMaterialBgTextureEnabled } from '@/lib/books/feature-flags'
import { WritingAssistProvider } from '@/lib/writing-assist/writing-assist-context'
import { buildLessonVocabulary } from '@/lib/writing-assist/build-lesson-vocabulary'
import { LessonCoachConnectDialog } from '@/components/lesson-coach/lesson-coach-connect-dialog'
import { LessonCoachSyncProvider } from '@/lib/lesson-coach/lesson-coach-sync-context'
import {
  useInkSessionMarkerStrokeSelectionActive,
  useInkSessionPenStrokeSelectionActive,
  useInkSessionShapeSelectionActive,
  useInkSessionStickySelectionActive,
} from './hooks/useInkSessionTextSelectionActive'
import { requestSpreadSessionFlush } from '@/lib/books/spread-session-events'
import { requestWhiteboardSessionFlush } from '@/lib/books/whiteboard-session-events'
import { flushPendingUnitPageSave } from '@/lib/books/progress'
import { shouldShowSpreadLoadingHold } from '@/lib/books/spread-drawable-ready'
import { isBookExerciseLiveEligible, isBookExerciseMultipleChoice, type BookExerciseKind } from '@/lib/books/book-exercises'

function parsePrintedPageLabel(label: string | null | undefined): number | null {
  if (!label) return null
  const trimmed = label.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 1 ? n : null
}

function liveCheckPinTone(result: string | null | undefined): ReadingCheckQuestionPinTone {
  if (result === 'correct' || result === 'incorrect' || result === 'skip') return result
  return 'default'
}

export function FullscreenBookOverlayView({
  vm,
  onClose,
  topChrome,
  deskRail,
  deskRailOpen = false,
  onDeskRailOpenChange,
  preferOpenExercises = false,
}: {
  vm: FullscreenBookOverlayViewModel
  onClose: () => void
  topChrome?: ReactNode
  deskRail?: ReactNode
  deskRailOpen?: boolean
  onDeskRailOpenChange?: (open: boolean) => void
  preferOpenExercises?: boolean
}) {
  const overlayRootRef = vm.overlayRootRef
  const [bookTextSpreadCapability, setBookTextSpreadCapability] = useState({
    hasSelectable: false,
    pending: false,
  })
  const onBookTextSpreadCapabilityChange = useCallback(
    (state: { hasSelectable: boolean; pending: boolean }) => {
      setBookTextSpreadCapability(state)
    },
    [],
  )
  const dismissToolSettingsRef = useRef<(() => void) | null>(null)
  const dismissToolSettingsOnSpreadUse = useCallback(() => {
    dismissToolSettingsRef.current?.()
  }, [])
  const [floatingBottomChrome, setFloatingBottomChrome] = useState(true)

  const {
    ANIMATION_MS,
    PdfPage,
    LESSON_BOARD_SURFACE,
    activePageRowRef,
    annotationMode,
    effectiveAnnotationMode,
    annotationTargetPage,
    bookStageRef,
    captionDialog,
    captionDraft,
    captureBusy,
    captureFormat,
    commitPageJump,
    copyLastCaptureToClipboard,
    eraserLineThicknessStep,
    eraserPixelThicknessStep,
    error,
    spreadReportEpoch,
    getActiveAnnotationRef,
    goToAdjacentPage,
    goToPage,
    handleCaptionSave,
    hasCurriculumOrHistory,
    hasLastImageCapture,
    hasResolvedUnit,
    hideChromeForCapture,
    interactiveVocabPack,
    readingStoryHit,
    liveReadingCheckPack,
    isAnnotationRailVisible,
    isAnnotationRailPinned,
    setIsAnnotationRailPinned,
    annotationRailPinHydrated,
    annotationRailKeyboardDismissAt,
    annotationRailKeyboardOpenAt,
    isPageListOpen,
    syncWorkspaceDeskLeftPx,
    pageListRailTab,
    exportCaptureLayoutActive,
    showBookFrame,
    setShowBookFrame,
    readerLayoutMode,
    enterPageGridOverview,
    exitPageGridOverview,
    openSpreadAtPageFromGrid,
    isVisible,
    isWhiteboardOpen,
    isWhiteboardSessionOpen,
    isWhiteboardMinimized,
    minimizeWhiteboard,
    expandWhiteboard,
    openWhiteboard,
    registerWhiteboardToolbarLaunch,
    swapWhiteboardSlotSide,
    setWhiteboardSlotSide,
    applyWhiteboardSlotSide,
    registerWhiteboardSlotMotion,
    whiteboardLayoutMode,
    whiteboardFloatRect,
    floatWhiteboard,
    dockWhiteboardToSlot,
    forceDockWhiteboard,
    commitWhiteboardFloatRect,
    userPresented,
    confirmSpreadSlotPixels,
    spreadTurnGridRef,
    turnSlide,
    handleTurnSlideComplete,
    open,
    jpegQuality,
    leftPageCaptureRef,
    loading,
    makeUnitFileUrl,
    markerColor,
    markerThicknessStep,
    shapeThicknessStep,
    textThicknessStep,
    stickyThicknessStep,
    stampThicknessStep,
    numPages,
    numberingMode,
    onDocumentLoadSuccess,
    onLeftAnnotationCaps,
    onPdfPageLoadSuccess,
    onRightAnnotationCaps,
    onSpreadOverlayCaps,
    onWhiteboardCaps,
    pageAreaRef,
    pageCanvasHeightPx,
    pageAspectRatio,
    pageJumpDraft,
    pageListNumbers,
    pageListScrollRoot,
    pageNumber,
    pdfDialogOpen,
    pdfExporting,
    pdfFrom,
    pdfProgressLabel,
    pdfReady,
    pdfTo,
    penSwatchId,
    pickPenSwatch,
    penStrokeProfile,
    setPenStrokeProfile,
    penColorSource,
    penCustomHex,
    pickPenCustomColor,
    onEyedropperPick,
    textColor,
    setTextColor,
    pickTextColor,
    shapeStrokeSwatchId,
    pickShapeStrokeSwatch,
    stickyFillColor,
    setStickyFillColor,
    pickStickyFillColor,
    penColor,
    penInkStyle,
    penThicknessStep,
    penLineDashStyle,
    setPenLineDashStyle,
    markerLineDashStyle,
    setMarkerLineDashStyle,
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
    eyedropperVariant,
    setEyedropperVariant,
    printedJumpBounds,
    regionSelectOpen,
    readerPresentationReady,
    rightPageCaptureRef,
    runImageCapture,
    runPdfPacketExport,
    selectedBook,
    selectedBookId,
    selectedUnit,
    setAnnotationMode,
    setAnnotationTargetPage,
    setCaptureFormat,
    setCaptionDialog,
    setCaptionDraft,
    setEraserLineThicknessStep,
    setEraserPixelThicknessStep,
    setHideChromeForCapture,
    setIsAnnotationRailVisible,
    setIsPageListOpen,
    togglePageListRail,
    setPageListRailTab,
    setIsWhiteboardOpen,
    setJpegQuality,
    markerColorSource,
    markerCustomHex,
    pickMarkerSwatchColor,
    pickMarkerCustomColor,
    setMarkerThicknessStep,
    setShapeThicknessStep,
    setTextThicknessStep,
    setStickyThicknessStep,
    setStampThicknessStep,
    setPageJumpDraft,
    setPageJumpFocused,
    setPageListScrollRoot,
    setPdfDialogOpen,
    setPdfFrom,
    setPdfTo,
    setPenThicknessStep,
    setRegionSelectOpen,
    setStampVariant,
    setStickerKind,
    setWritableStickerVariant,
    pickTextFillColor,
    setTextFillColor,
    setTextVisualStyle,
    setTextAlign,
    setTextFontId,
    setTextFontWeight,
    setWatermarkEnabled,
    whiteboardStorageKey,
    lessonBoardBookId,
    lessonBoardUnitId,
    boardFooterLabel,
    boardBookFullTitle,
    boardBookAccentColor,
    boardShelf,
    nextUnitBoard,
    showNextUnitBoardPrompt,
    openNextUnitBoard,
    dismissNextUnitBoardPrompt,
    switchLessonBoardNotebook,
    whiteboardSlotSide,
    whiteboardContentHeightPx,
    ensureWhiteboardRunwayBelowView,
    activeClassSessionId,
    shapeColor,
    shapeStrokeWidthScale,
    showSpreadRightPage,
    spreadDisplayScale,
    spreadReaderDisplayScale,
    spreadFitMotionActive,
    effectiveSpreadScreenScale,
    focusZoomDrawActive,
    focusZoomActive,
    focusLayout,
    pinchZoomActive,
    clearPinchZoom,
    stepPinchZoom,
    pinchZoomState,
    pinchSpreadRef,
    toggleFocusZoom,
    startFocusDraw,
    clearFocusZoom,
    commitFocusNormRect,
    applyFocusPanDelta,
    cancelFocusDraw,
    bookFocusZoomEnabled,
    spreadGutterPullRatio,
    spreadPageWidth,
    spreadStrokeCaptureEnabled,
    spreadStrokeOverlayRef,
    spreadSessionStoreRef,
    spreadImagePasteRef,
    wbStrokeOverlayRef,
    whiteboardStrokeCaptureEnabled,
    whiteboardSessionStoreRef,
    whiteboardSelectionMoveClampRef,
    whiteboardSessionDoc,
    whiteboardInkRevision,
    appendWhiteboardSessionCommand,
    whiteboardSessionUndo,
    whiteboardSessionRedo,
    whiteboardSessionClear,
    selectLessonBoardPage,
    createLessonBoardPage,
    renameLessonBoardPage,
    saveLessonBoardNow,
    deleteActiveLessonBoardPage,
    canDeleteActiveLessonBoardPage,
    lessonBoardActivePageRowRef,
    boardLinkPlacementActive,
    lessonBoardPageLinks,
    activeBoardPageLink,
    isPrepMode,
    startBoardLinkPlacement,
    cancelBoardLinkPlacement,
    placeBoardLinkAt,
    removeActiveBoardPageLink,
    openBoardFromLink,
    readingCheckHotspotPlacementActive,
    cancelReadingCheckHotspotPlacement,
    placeReadingCheckHotspotAt,
    readingCheckHotspotPreviewPdfPage,
    readingCheckHotspotPreviewCenter,
    readingCheckHotspotPreviewLabel,
    onReadingCheckHotspotPreviewClick,
    onWhiteboardOverlayCaps,
    layoutSpreadPageWidth,
    spreadRightPage,
    spreadDrawableReady,
    onSpreadSlotsPixelsReady,
    stampScale,
    stampVariant,
    stampIndicatorPulseEpoch,
    stickerKind,
    writableStickerVariant,
    stampQuestionColor,
    setStampQuestionColor,
    stampEffectsEnabled,
    setStampEffectsEnabled,
    stickyFontSizeNorm,
    strokeColor,
    strokeWidthScale,
    eraserLineStrokeWidthScale,
    penStrokeWidthScale,
    strokeLineDashStyleForInk,
    coachLessonId,
    coachLessonTitle,
    coachPartId,
    coachPartTitle,
    studentId,
    studentName,
    suppressChrome,
    textFontSizeNorm,
    textFontId,
    textFontWeight,
    textFillColor,
    bookTextVisualStyle,
    textVisualStyle,
    textAlign,
    toolbarCaps,
    unitPageBounds,
    unitThumbFileUrl,
    visiblePages,
    watermarkEnabled,
    leftAnnRef,
    rightAnnRef,
    wbAnnRef,
    wbCaptureRootRef,
    classToolId,
    setClassToolId,
    browserFullscreenSupported,
    isBrowserFullscreen,
    toggleBrowserFullscreen,
  } = vm

  const writableTranslateSelection = useWritableTextTranslateSelection(
    open && hasResolvedUnit,
  )

  /** Chinese word picked in the translate dock, waiting for a tap on the spread. */
  const [placeTranslationText, setPlaceTranslationText] = useState<string | null>(null)
  const [placeTranslationImage, setPlaceTranslationImage] = useState<{
    src: string
    alt: string
  } | null>(null)

  const [bookAudioOpen, setBookAudioOpen] = useState(false)
  const [bookExercisesOpen, setBookExercisesOpen] = useState(false)
  const [playExerciseTaskId, setPlayExerciseTaskId] = useState<string | null>(null)
  const bookAudio = useBookAudioPlayer(selectedBookId)
  const audioPinBookUnits = useMemo(
    () => (selectedBook?.units ?? []).map((unit) => ({ id: unit.id, filePath: unit.filePath })),
    [selectedBook],
  )
  const audioPins = useAudioTrackPlacement({
    bookId: selectedBookId,
    unitId: selectedUnit?.id ?? null,
    unitFilePath: selectedUnit?.filePath ?? null,
    bookUnits: audioPinBookUnits,
  })
  const bookExercises = useBookExerciseTasks({
    bookId: selectedBookId,
    unitId: selectedUnit?.id ?? null,
    fileUrl: selectedUnit?.filePath ? makeUnitFileUrl(selectedUnit.filePath) : null,
  })

  useEffect(() => {
    if (!open || !preferOpenExercises) return
    setClassToolId(null)
    setBookExercisesOpen(true)
  }, [open, preferOpenExercises, selectedBookId, setClassToolId])

  useEffect(() => {
    setBookAudioOpen(false)
    setBookExercisesOpen(false)
    setPlayExerciseTaskId(null)
    setClassToolId(null)
  }, [selectedBookId, setClassToolId])

  useEffect(() => {
    if (!deskRailOpen) return
    setIsPageListOpen(false)
    setBookAudioOpen(false)
    setBookExercisesOpen(false)
    setPlayExerciseTaskId(null)
    setClassToolId(null)
    audioPins.cancelAudioPinPlacement()
    bookExercises.cancelBoxDraw()
  }, [
    deskRailOpen,
    setIsPageListOpen,
    setClassToolId,
    audioPins.cancelAudioPinPlacement,
    bookExercises.cancelBoxDraw,
  ])

  useEffect(() => {
    if (isPageListOpen) {
      setBookAudioOpen(false)
      setBookExercisesOpen(false)
      setPlayExerciseTaskId(null)
      setClassToolId(null)
      onDeskRailOpenChange?.(false)
    }
  }, [isPageListOpen, onDeskRailOpenChange, setClassToolId])

  useEffect(() => {
    if (!open) {
      setBookAudioOpen(false)
      setBookExercisesOpen(false)
      setPlayExerciseTaskId(null)
      onDeskRailOpenChange?.(false)
      bookAudio.stop()
      audioPins.cancelAudioPinPlacement()
      bookExercises.cancelBoxDraw()
    }
  }, [
    open,
    bookAudio.stop,
    audioPins.cancelAudioPinPlacement,
    bookExercises.cancelBoxDraw,
    onDeskRailOpenChange,
  ])

  useEffect(() => {
    if (!audioPins.audioPinPlacementActive && !bookExercises.boxDrawActive) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      audioPins.cancelAudioPinPlacement()
      bookExercises.cancelBoxDraw()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    audioPins.audioPinPlacementActive,
    audioPins.cancelAudioPinPlacement,
    bookExercises.boxDrawActive,
    bookExercises.cancelBoxDraw,
  ])

  const toggleBookAudioRail = useCallback(() => {
    setBookAudioOpen((wasOpen) => {
      const next = !wasOpen
      if (next) {
        setIsPageListOpen(false)
        setBookExercisesOpen(false)
        setPlayExerciseTaskId(null)
        setClassToolId(null)
        bookExercises.cancelBoxDraw()
        onDeskRailOpenChange?.(false)
      }
      if (!next) audioPins.cancelAudioPinPlacement()
      return next
    })
  }, [
    setIsPageListOpen,
    setClassToolId,
    audioPins.cancelAudioPinPlacement,
    bookExercises.cancelBoxDraw,
    onDeskRailOpenChange,
  ])

  const toggleBookExercisesRail = useCallback(() => {
    setBookExercisesOpen((wasOpen) => {
      const next = !wasOpen
      if (next) {
        setIsPageListOpen(false)
        setBookAudioOpen(false)
        setPlayExerciseTaskId(null)
        setClassToolId(null)
        audioPins.cancelAudioPinPlacement()
        onDeskRailOpenChange?.(false)
      }
      if (!next) bookExercises.cancelBoxDraw()
      return next
    })
  }, [
    setIsPageListOpen,
    setClassToolId,
    audioPins.cancelAudioPinPlacement,
    bookExercises.cancelBoxDraw,
    onDeskRailOpenChange,
  ])

  const handleTogglePageList = useCallback(() => {
    setBookAudioOpen(false)
    setBookExercisesOpen(false)
    setClassToolId(null)
    onDeskRailOpenChange?.(false)
    audioPins.cancelAudioPinPlacement()
    bookExercises.cancelBoxDraw()
    togglePageListRail()
  }, [
    togglePageListRail,
    setClassToolId,
    audioPins.cancelAudioPinPlacement,
    bookExercises.cancelBoxDraw,
    onDeskRailOpenChange,
  ])

  const toggleClassToolTranslate = useCallback(() => {
    setClassToolId((prev) => {
      const next = prev === 'translate' ? null : 'translate'
      if (next) {
        setIsPageListOpen(false)
        setBookAudioOpen(false)
        setBookExercisesOpen(false)
        setPlayExerciseTaskId(null)
        audioPins.cancelAudioPinPlacement()
        bookExercises.cancelBoxDraw()
        onDeskRailOpenChange?.(false)
      }
      return next
    })
  }, [
    setClassToolId,
    setIsPageListOpen,
    audioPins.cancelAudioPinPlacement,
    bookExercises.cancelBoxDraw,
    onDeskRailOpenChange,
  ])

  const toggleClassToolPictures = useCallback(() => {
    setClassToolId((prev) => {
      const next = prev === 'pictures' ? null : 'pictures'
      if (next) {
        setIsPageListOpen(false)
        setBookAudioOpen(false)
        setBookExercisesOpen(false)
        setPlayExerciseTaskId(null)
        audioPins.cancelAudioPinPlacement()
        bookExercises.cancelBoxDraw()
        onDeskRailOpenChange?.(false)
      }
      return next
    })
  }, [
    setClassToolId,
    setIsPageListOpen,
    audioPins.cancelAudioPinPlacement,
    bookExercises.cancelBoxDraw,
    onDeskRailOpenChange,
  ])

  const handleStartAudioPinPlacement = useCallback(
    (trackId: string) => {
      cancelBoardLinkPlacement?.()
      bookExercises.cancelBoxDraw()
      setIsPageListOpen(false)
      setBookExercisesOpen(false)
      setPlayExerciseTaskId(null)
      setClassToolId(null)
      onDeskRailOpenChange?.(false)
      setBookAudioOpen(true)
      audioPins.startAudioPinPlacement(trackId)
    },
    [
      audioPins.startAudioPinPlacement,
      cancelBoardLinkPlacement,
      setIsPageListOpen,
      setClassToolId,
      bookExercises.cancelBoxDraw,
      onDeskRailOpenChange,
    ],
  )

  const handleStartExerciseBoxDraw = useCallback((kind?: BookExerciseKind) => {
    cancelBoardLinkPlacement?.()
    audioPins.cancelAudioPinPlacement()
    setIsPageListOpen(false)
    setBookAudioOpen(false)
    setClassToolId(null)
    onDeskRailOpenChange?.(false)
    setBookExercisesOpen(true)
    setPlayExerciseTaskId(null)
    bookExercises.startBoxDraw(kind)
  }, [
    audioPins.cancelAudioPinPlacement,
    bookExercises.startBoxDraw,
    cancelBoardLinkPlacement,
    setIsPageListOpen,
    setClassToolId,
    onDeskRailOpenChange,
  ])

  const placeTranslationOnSpread = useCallback(
    (clientX: number, clientY: number, surface: PlaceFromTranslateSurface) => {
      const text = placeTranslationText
      setPlaceTranslationText(null)
      if (!text) return

      if (surface === 'whiteboard') {
        const content = document.querySelector('[data-whiteboard-content]')
        const store = whiteboardSessionStoreRef.current
        if (!(content instanceof HTMLElement) || !store) {
          toast.error('Could not place the word — open the board and try again.')
          return
        }
        const rect = content.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
          toast.error('Could not place the word — open the board and try again.')
          return
        }
        const fontSizeNorm = translationChipFontSizeNorm(rect.height)
        const placement = translationChipPlacementNorm({
          clientX,
          clientY,
          spreadLeftPx: rect.left,
          spreadTopPx: rect.top,
          spreadWidthPx: rect.width,
          spreadHeightPx: rect.height,
        })
        const cmd: TextAnnotationCommand = {
          kind: 'text',
          id: newAnnotationId(),
          x: placement.x,
          y: placement.y,
          yAnchor: placement.yAnchor,
          text,
          fontSizeNorm,
          fontId: TRANSLATION_CHIP_FONT_ID,
          color: TRANSLATION_CHIP_TEXT,
          visualStyle: 'filled',
          fillColor: TRANSLATION_CHIP_FILL,
        }
        store.appendCommand(cmd)
        return
      }

      const store = spreadSessionStoreRef.current
      const leftEl = leftPageCaptureRef.current
      if (!store || !leftEl) {
        toast.error('Could not place the word — open a book page and try again.')
        return
      }
      const leftRect = leftEl.getBoundingClientRect()
      const rightRect = rightPageCaptureRef.current?.getBoundingClientRect() ?? null
      const spreadLeftPx = leftRect.left
      const spreadRightPx =
        rightRect && rightRect.width > 0 ? rightRect.right : leftRect.right
      const spreadWidthPx = spreadRightPx - spreadLeftPx
      const spreadHeightPx = leftRect.height
      if (spreadWidthPx <= 0 || spreadHeightPx <= 0) {
        toast.error('Could not place the word — open a book page and try again.')
        return
      }

      const fontSizeNorm = translationChipFontSizeNorm(spreadHeightPx)
      const placement = translationChipPlacementNorm({
        clientX,
        clientY,
        spreadLeftPx,
        spreadTopPx: leftRect.top,
        spreadWidthPx,
        spreadHeightPx,
      })
      const cmd: TextAnnotationCommand = {
        kind: 'text',
        id: newAnnotationId(),
        x: placement.x,
        y: placement.y,
        yAnchor: placement.yAnchor,
        text,
        fontSizeNorm,
        fontId: TRANSLATION_CHIP_FONT_ID,
        color: TRANSLATION_CHIP_TEXT,
        visualStyle: 'filled',
        fillColor: TRANSLATION_CHIP_FILL,
      }
      store.appendCommand(cmd)
    },
    [
      placeTranslationText,
      spreadSessionStoreRef,
      leftPageCaptureRef,
      rightPageCaptureRef,
      whiteboardSessionStoreRef,
    ],
  )

  const placeTranslateImage = useCallback(
    (clientX: number, clientY: number, surface: PlaceFromTranslateSurface) => {
      const payload = placeTranslationImage
      setPlaceTranslationImage(null)
      if (!payload) return

      void (async () => {
        const file = await fetchPlacedImageAsFile(payload.src)
        const encoded = file ? await downscaleImageFile(file) : null
        if (!encoded) {
          toast.error('Could not place the picture — try another image.')
          return
        }

        if (surface === 'whiteboard') {
          const content = document.querySelector('[data-whiteboard-content]')
          const store = whiteboardSessionStoreRef.current
          if (!(content instanceof HTMLElement) || !store) {
            toast.error('Could not place the picture — open the board and try again.')
            return
          }
          const rect = content.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) {
            toast.error('Could not place the picture — open the board and try again.')
            return
          }
          const scrollParent = content.parentElement
          const cmd = buildImageCommandFromEncoded(
            encoded,
            {
              widthPx: rect.width,
              heightPx: rect.height,
              viewportHeightPx: scrollParent?.clientHeight ?? rect.height,
              scrollTopPx: scrollParent?.scrollTop ?? 0,
              anchorNorm: boardPasteAnchorFromElementRect(clientX, clientY, rect),
              maxWidthFraction: TRANSLATE_PLACE_IMAGE_WIDTH_FRACTION,
            },
            payload.alt,
          )
          store.appendCommand(cmd)
          store.setSelectedIds([cmd.id])
          setAnnotationMode('select')
          return
        }

        const store = spreadSessionStoreRef.current
        const leftEl = leftPageCaptureRef.current
        if (!store || !leftEl) {
          toast.error('Could not place the picture — open a book page and try again.')
          return
        }
        const leftRect = leftEl.getBoundingClientRect()
        const rightRect = rightPageCaptureRef.current?.getBoundingClientRect() ?? null
        const spreadLeftPx = leftRect.left
        const spreadRightPx =
          rightRect && rightRect.width > 0 ? rightRect.right : leftRect.right
        const spreadWidthPx = spreadRightPx - spreadLeftPx
        const spreadHeightPx = leftRect.height
        if (spreadWidthPx <= 0 || spreadHeightPx <= 0) {
          toast.error('Could not place the picture — open a book page and try again.')
          return
        }
        const spreadRect = new DOMRect(spreadLeftPx, leftRect.top, spreadWidthPx, spreadHeightPx)
        const cmd = buildImageCommandFromEncoded(
          encoded,
          {
            widthPx: spreadWidthPx,
            heightPx: spreadHeightPx,
            viewportHeightPx: spreadHeightPx,
            scrollTopPx: 0,
            anchorNorm: boardPasteAnchorFromElementRect(clientX, clientY, spreadRect),
            maxWidthFraction: TRANSLATE_PLACE_IMAGE_WIDTH_FRACTION,
          },
          payload.alt,
        )
        store.appendCommand(cmd)
        store.setSelectedIds([cmd.id])
        setAnnotationMode('select')
      })()
    },
    [
      placeTranslationImage,
      spreadSessionStoreRef,
      leftPageCaptureRef,
      rightPageCaptureRef,
      whiteboardSessionStoreRef,
      setAnnotationMode,
    ],
  )
  const pinWritableTextGloss = useCallback(
    (input: PinWritableTextGlossInput) => {
      const store = isWhiteboardOpen
        ? whiteboardSessionStoreRef.current
        : spreadSessionStoreRef.current
      if (!store) return false
      const target = store.getState().doc.commands.find(
        (cmd) =>
          cmd.id === input.annotationId && (cmd.kind === 'text' || cmd.kind === 'sticky'),
      )
      if (!target) return false

      const liveField = document.querySelector(
        `textarea[data-annotation-id="${input.annotationId}"]`,
      )
      const liveText =
        liveField instanceof HTMLTextAreaElement ? liveField.value : target.text

      store.patchCommands((cmds) => {
        const withLiveText = cmds.map((cmd) => {
          if (cmd.id !== input.annotationId) return cmd
          if (cmd.kind !== 'text' && cmd.kind !== 'sticky') return cmd
          if (cmd.text === liveText) return cmd
          return { ...cmd, text: liveText }
        })
        return appendTextGlossToCommands(withLiveText, {
          commandId: input.annotationId,
          start: input.start,
          end: input.end,
          source: input.source,
          chinese: input.chinese,
          pinyin: input.pinyin,
        })
      })
      return true
    },
    [isWhiteboardOpen, spreadSessionStoreRef, whiteboardSessionStoreRef],
  )
  const spreadStickySelectionActive = useInkSessionStickySelectionActive(
    spreadSessionStoreRef,
    hasResolvedUnit && !isWhiteboardOpen,
  )
  const whiteboardStickySelectionActive = useInkSessionStickySelectionActive(
    whiteboardSessionStoreRef,
    hasResolvedUnit && isWhiteboardOpen,
  )
  const stickySelectionActive = spreadStickySelectionActive || whiteboardStickySelectionActive
  const spreadShapeSelectionActive = useInkSessionShapeSelectionActive(
    spreadSessionStoreRef,
    hasResolvedUnit && !isWhiteboardOpen,
  )
  const whiteboardShapeSelectionActive = useInkSessionShapeSelectionActive(
    whiteboardSessionStoreRef,
    hasResolvedUnit && isWhiteboardOpen,
  )
  const shapeSelectionActive = spreadShapeSelectionActive || whiteboardShapeSelectionActive
  const spreadPenStrokeSelectionActive = useInkSessionPenStrokeSelectionActive(
    spreadSessionStoreRef,
    hasResolvedUnit && !isWhiteboardOpen,
  )
  const whiteboardPenStrokeSelectionActive = useInkSessionPenStrokeSelectionActive(
    whiteboardSessionStoreRef,
    hasResolvedUnit && isWhiteboardOpen,
  )
  const penStrokeSelectionActive = spreadPenStrokeSelectionActive || whiteboardPenStrokeSelectionActive
  const spreadMarkerStrokeSelectionActive = useInkSessionMarkerStrokeSelectionActive(
    spreadSessionStoreRef,
    hasResolvedUnit && !isWhiteboardOpen,
  )
  const whiteboardMarkerStrokeSelectionActive = useInkSessionMarkerStrokeSelectionActive(
    whiteboardSessionStoreRef,
    hasResolvedUnit && isWhiteboardOpen,
  )
  const markerStrokeSelectionActive =
    spreadMarkerStrokeSelectionActive || whiteboardMarkerStrokeSelectionActive

  const [coachDialogOpen, setCoachDialogOpen] = useState(false)
  const [coachSessionId, setCoachSessionId] = useState<string | null>(null)
  const [coachUrl, setCoachUrl] = useState<string | null>(null)
  const [interactiveVocabOpen, setInteractiveVocabOpen] = useState(false)
  const [readingChecksOpen, setReadingChecksOpen] = useState(false)
  const [liveCheckStopId, setLiveCheckStopId] = useState<string | null>(null)
  const [liveCheckMarkEpoch, setLiveCheckMarkEpoch] = useState(0)
  const [lessonSettingsOpen, setLessonSettingsOpen] = useState(false)
  const [toolboxMenuOpen, setToolboxMenuOpen] = useState(false)
  const [activeToolboxTool, setActiveToolboxTool] = useState<ClassToolboxToolId | null>(null)
  const whiteboardLaunch = useWhiteboardToolbarLaunch()

  const clearToolbox = useCallback(() => {
    setToolboxMenuOpen(false)
    setActiveToolboxTool(null)
  }, [])

  useEffect(() => {
    if (userPresented) return
    clearToolbox()
  }, [userPresented, clearToolbox])

  const closeOverlay = useCallback(() => {
    flushPendingUnitPageSave()
    requestSpreadSessionFlush()
    requestWhiteboardSessionFlush()
    clearToolbox()
    onClose()
  }, [clearToolbox, onClose])

  const toolboxChromeOpen = toolboxMenuOpen || activeToolboxTool != null

  const toggleToolbox = useCallback(() => {
    if (toolboxMenuOpen) {
      setToolboxMenuOpen(false)
      return
    }
    if (activeToolboxTool) {
      setActiveToolboxTool(null)
      return
    }
    setLessonSettingsOpen(false)
    setToolboxMenuOpen(true)
  }, [toolboxMenuOpen, activeToolboxTool])

  useEffect(() => {
    warmSpeechVoices()
  }, [])

  useEffect(() => {
    if (!interactiveVocabPack) setInteractiveVocabOpen(false)
  }, [interactiveVocabPack])

  useEffect(() => {
    if (!liveReadingCheckPack) {
      setReadingChecksOpen(false)
      setLiveCheckStopId(null)
    }
  }, [liveReadingCheckPack])

  const liveCheckPins = useMemo((): ReadingCheckLivePin[] => {
    if (!liveReadingCheckPack) return []
    void liveCheckMarkEpoch
    const leftDisplayPage =
      selectedBook && selectedUnit
        ? parsePrintedPageLabel(
            mapPdfPageToDisplayLabel(pageNumber, selectedBook, selectedUnit, numPages),
          )
        : null
    const rightDisplayPage =
      selectedBook && selectedUnit && spreadRightPage != null
        ? parsePrintedPageLabel(
            mapPdfPageToDisplayLabel(spreadRightPage, selectedBook, selectedUnit, numPages),
          )
        : null
    return listReadingCheckLivePinsOnSpread(liveReadingCheckPack.stops, {
      leftPdfPage: pageNumber,
      rightPdfPage: spreadRightPage,
      leftDisplayPage,
      rightDisplayPage,
    }).map((pin) => {
      const marked = latestReadingCheckLiveMarkForStop(liveReadingCheckPack.storyId, pin.stop.id)
      return {
        id: pin.stop.id,
        pdfPage: pin.pdfPage,
        x: pin.x,
        y: pin.y,
        label: readingCheckStopLinkLabel(pin.stop, pin.index),
        tone: liveCheckPinTone(marked?.result),
      }
    })
  }, [
    liveCheckMarkEpoch,
    liveReadingCheckPack,
    numPages,
    pageNumber,
    selectedBook,
    selectedUnit,
    spreadRightPage,
  ])

  useEffect(() => {
    registerWhiteboardToolbarLaunch({
      playEnter: whiteboardLaunch.playEnter,
      playExit: whiteboardLaunch.playExit,
    })
    return () => registerWhiteboardToolbarLaunch(null)
  }, [
    registerWhiteboardToolbarLaunch,
    whiteboardLaunch.playEnter,
    whiteboardLaunch.playExit,
  ])

  const handleWhiteboardRailClick = useCallback(() => {
    if (!isWhiteboardSessionOpen) {
      whiteboardLaunch.playEnter(openWhiteboard)
      return
    }
    if (isWhiteboardMinimized) {
      whiteboardLaunch.playEnter(expandWhiteboard)
      return
    }
    whiteboardLaunch.playExit(minimizeWhiteboard)
  }, [
    isWhiteboardSessionOpen,
    isWhiteboardMinimized,
    openWhiteboard,
    expandWhiteboard,
    minimizeWhiteboard,
    whiteboardLaunch,
  ])

  const handleMinimizeWhiteboardAnimated = useCallback(() => {
    if (!isWhiteboardSessionOpen || isWhiteboardMinimized) {
      minimizeWhiteboard()
      return
    }
    whiteboardLaunch.playExit(minimizeWhiteboard)
  }, [isWhiteboardMinimized, isWhiteboardSessionOpen, minimizeWhiteboard, whiteboardLaunch])

  const handleExpandWhiteboardAnimated = useCallback(() => {
    whiteboardLaunch.playEnter(expandWhiteboard)
  }, [expandWhiteboard, whiteboardLaunch])

  const lessonWordsForAssist = useMemo(
    () =>
      buildLessonVocabulary({
        book: selectedBook,
        unit: selectedUnit,
        interactiveVocabPack,
      }),
    [selectedBook, selectedUnit, interactiveVocabPack],
  )

  /** After first drawable spread, skip full-viewport hold on routine page turns (R1). */
  const [spreadHasBeenDrawable, setSpreadHasBeenDrawable] = useState(false)
  useEffect(() => {
    if (spreadDrawableReady) setSpreadHasBeenDrawable(true)
  }, [spreadDrawableReady])
  useEffect(() => {
    if (!open) setSpreadHasBeenDrawable(false)
  }, [open])

  const showSpreadLoadingHold = useMemo(
    () =>
      shouldShowSpreadLoadingHold({
        userPresented,
        open,
        overlayVisible: isVisible,
        readerPresentationReady,
        hasCurriculumOrHistory,
        hasResolvedUnit,
        error,
        spreadDrawableReady,
        spreadHasBeenDrawable,
      }),
    [
      spreadHasBeenDrawable,
      userPresented,
      open,
      isVisible,
      readerPresentationReady,
      hasCurriculumOrHistory,
      hasResolvedUnit,
      error,
      spreadDrawableReady,
    ],
  )

  useEffect(() => {
    if (classToolId == null) return
    setIsPageListOpen(false)
    setBookAudioOpen(false)
    setBookExercisesOpen(false)
    setPlayExerciseTaskId(null)
    audioPins.cancelAudioPinPlacement()
    bookExercises.cancelBoxDraw()
    onDeskRailOpenChange?.(false)
  }, [
    classToolId,
    setIsPageListOpen,
    audioPins.cancelAudioPinPlacement,
    bookExercises.cancelBoxDraw,
    onDeskRailOpenChange,
  ])

  const hideFocusPresentationChrome = suppressChrome || focusZoomActive
  const showTopChrome = Boolean(topChrome) && !hideFocusPresentationChrome
  const hintTopClass = showTopChrome ? 'top-3' : isPrepMode ? 'top-14' : 'top-3'
  const classToolDrawerOpen =
    classToolId != null && !hideFocusPresentationChrome
  const bookDeskLeft = bookWorkspaceDeskLeftCss({
    pageListOpen: isPageListOpen,
    audioPlaylistOpen: bookAudioOpen,
    exerciseRailOpen: bookExercisesOpen,
    classToolDrawerOpen,
    deskRailOpen,
  })
  const bookDeskLeftPx = bookWorkspaceDeskLeftPx({
    pageListOpen: isPageListOpen,
    audioPlaylistOpen: bookAudioOpen,
    exerciseRailOpen: bookExercisesOpen,
    classToolDrawerOpen,
    deskRailOpen,
  })

  useLayoutEffect(() => {
    if (!open) return
    syncWorkspaceDeskLeftPx(bookDeskLeftPx)
  }, [open, bookDeskLeftPx, syncWorkspaceDeskLeftPx])

  useEffect(() => {
    if (!hideFocusPresentationChrome) return
    setToolboxMenuOpen(false)
    setActiveToolboxTool(null)
  }, [hideFocusPresentationChrome])

  const playExerciseTask = bookExercises.tasks.find((task) => task.id === playExerciseTaskId)
  const playExerciseLive =
    playExerciseTask && isBookExerciseLiveEligible(playExerciseTask) ? playExerciseTask : null

  return (
    <WritingAssistProvider
      lessonWords={lessonWordsForAssist}
      active={open && userPresented}
    >
    <LessonCoachSyncProvider sessionId={coachSessionId}>
    <div
      ref={overlayRootRef}
      className={cn(
        'absolute inset-0 z-50 bg-[var(--book-reading-mat)] p-0 transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        userPresented
          ? isVisible
            ? 'opacity-100'
            : 'opacity-0'
          : 'opacity-[0.001]',
        (!open || !isVisible || !userPresented) && 'pointer-events-none',
      )}
      aria-hidden={!open || !userPresented}
      inert={!open || !userPresented ? true : undefined}
    >
      {userPresented ? (
        <div
          className={cn(
            'book-overlay-reading-bg',
            bookOverlayMaterialBgTextureEnabled && 'book-overlay-reading-bg--textured',
          )}
          aria-hidden
        />
      ) : null}
      <PageListRail
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        isPageListOpen={isPageListOpen}
        selectedUnitTitle={selectedUnit?.title}
        pageListNumbers={pageListNumbers}
        pageNumber={pageNumber}
        showSpreadRightPage={showSpreadRightPage}
        spreadRightPage={spreadRightPage}
        unitThumbFileUrl={unitThumbFileUrl}
        selectedUnitId={selectedUnit?.id ?? ''}
        pageListScrollRoot={pageListScrollRoot}
        setPageListScrollRoot={setPageListScrollRoot}
        pdfReady={pdfReady}
        selectedBook={selectedBook}
        selectedUnit={selectedUnit}
        numberingMode={numberingMode}
        activePageRowRef={activePageRowRef}
        goToPage={goToPage}
        setIsPageListOpen={setIsPageListOpen}
        isWhiteboardOpen={isWhiteboardSessionOpen}
        pageListRailTab={pageListRailTab}
        setPageListRailTab={setPageListRailTab}
        whiteboardSessionDoc={whiteboardSessionDoc}
        onSelectLessonBoardPage={selectLessonBoardPage}
        onNewLessonBoardPage={createLessonBoardPage}
        onRenameLessonBoardPage={renameLessonBoardPage}
        lessonBoardActivePageRowRef={lessonBoardActivePageRowRef}
      />
      <BookAudioPlaylistRail
        open={bookAudioOpen}
        onClose={() => {
          audioPins.cancelAudioPinPlacement()
          setBookAudioOpen(false)
        }}
        tracks={bookAudio.tracks}
        loading={bookAudio.loading}
        currentTrackId={bookAudio.currentTrackId}
        isPlaying={bookAudio.isPlaying}
        currentTime={bookAudio.currentTime}
        duration={bookAudio.duration}
        onPlayTrack={bookAudio.playTrack}
        onTogglePlayPause={bookAudio.togglePlayPause}
        onPlayNext={bookAudio.playNext}
        onPlayPrevious={bookAudio.playPrevious}
        onSeek={bookAudio.seek}
        placementTrackId={audioPins.placementTrackId}
        placedCountByTrackId={audioPins.placedCountByTrackId}
        onStartPinPlacement={handleStartAudioPinPlacement}
        onCancelPinPlacement={audioPins.cancelAudioPinPlacement}
        onRemovePlacedTrack={(trackId) => {
          void audioPins.removeAudioPinsByTrackId(trackId)
        }}
      />
      <BookExerciseTaskRail
        open={bookExercisesOpen}
        onClose={() => {
          bookExercises.cancelBoxDraw()
          setBookExercisesOpen(false)
        }}
        tasks={bookExercises.tasks}
        loading={bookExercises.loading}
        saving={bookExercises.saving}
        drafting={bookExercises.drafting}
        selectedTaskId={bookExercises.selectedTaskId}
        boxDrawActive={bookExercises.boxDrawActive}
        drawKind={bookExercises.boxDrawKind}
        onDrawKindChange={bookExercises.setBoxDrawKind}
        onStartBoxDraw={handleStartExerciseBoxDraw}
        onCancelBoxDraw={bookExercises.cancelBoxDraw}
        onSelectTask={(task) => {
          bookExercises.setSelectedTaskId(task.id)
          goToPage(task.pdfPage)
        }}
        onClearSelection={() => bookExercises.setSelectedTaskId(null)}
        onDraftFromBox={(taskId) => bookExercises.draftExerciseFromBox(taskId)}
        onRemoveTask={(task) => {
          void bookExercises.removeExerciseTask(task.id)
        }}
        onSaveDraft={(taskId, next) =>
          bookExercises.saveExerciseTask(taskId, { ...next, status: 'draft' })
        }
        onApprove={(taskId, next) =>
          bookExercises.saveExerciseTask(taskId, { ...next, status: 'approved' })
        }
        onUnapprove={(taskId) => bookExercises.saveExerciseTask(taskId, { status: 'draft' })}
      />
      {deskRail}
      <TranslateToolPanel
        studentId={studentId}
        open={classToolDrawerOpen && classToolId === 'translate'}
        onClose={() => setClassToolId(null)}
        onPlaceText={
          hasResolvedUnit
            ? (text) => {
                setPlaceTranslationImage(null)
                setPlaceTranslationText(text)
              }
            : undefined
        }
        onPlaceImage={
          hasResolvedUnit
            ? (src, alt) => {
                setPlaceTranslationText(null)
                setPlaceTranslationImage({ src, alt })
              }
            : undefined
        }
      />
      <PictureSearchToolPanel
        open={classToolDrawerOpen && classToolId === 'pictures'}
        onClose={() => setClassToolId(null)}
        studentId={studentId}
        wbAnnRef={wbAnnRef}
        boardVisible={isWhiteboardOpen}
        onPlacePicture={
          hasResolvedUnit
            ? (src, alt) => {
                setPlaceTranslationText(null)
                setPlaceTranslationImage({ src, alt })
                setClassToolId(null)
              }
            : undefined
        }
      />
      {playExerciseLive ? (
        isBookExerciseMultipleChoice(playExerciseLive) ? (
          <BookExerciseMcqPlaySheet task={playExerciseLive} onClose={() => setPlayExerciseTaskId(null)} />
        ) : (
          <BookExercisePlaySheet task={playExerciseLive} onClose={() => setPlayExerciseTaskId(null)} />
        )
      ) : null}
      <audio
        ref={bookAudio.audioRef}
        preload="metadata"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        aria-hidden
      />
      <AnnotationRail
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        selectedBookId={selectedBookId}
        suppressChrome={suppressChrome || readerLayoutMode === 'pageGrid'}
        pageCanvasHeightPx={pageCanvasHeightPx}
        isAnnotationRailVisible={isAnnotationRailVisible}
        setIsAnnotationRailVisible={setIsAnnotationRailVisible}
        isAnnotationRailPinned={isAnnotationRailPinned}
        setIsAnnotationRailPinned={setIsAnnotationRailPinned}
        annotationRailPinHydrated={annotationRailPinHydrated}
        annotationRailKeyboardDismissAt={annotationRailKeyboardDismissAt}
        annotationRailKeyboardOpenAt={annotationRailKeyboardOpenAt}
        annotationMode={annotationMode}
        setAnnotationMode={setAnnotationMode}
        stampVariant={stampVariant}
        setStampVariant={setStampVariant}
        stickerKind={stickerKind}
        setStickerKind={setStickerKind}
        writableStickerVariant={writableStickerVariant}
        setWritableStickerVariant={setWritableStickerVariant}
        stampQuestionColor={stampQuestionColor}
        setStampQuestionColor={setStampQuestionColor}
        stampEffectsEnabled={stampEffectsEnabled}
        setStampEffectsEnabled={setStampEffectsEnabled}
        penSwatchId={penSwatchId}
        pickPenSwatch={pickPenSwatch}
        penStrokeProfile={penStrokeProfile}
        setPenStrokeProfile={setPenStrokeProfile}
        penColorSource={penColorSource}
        penCustomHex={penCustomHex}
        pickPenCustomColor={pickPenCustomColor}
        textColor={textColor}
        setTextColor={setTextColor}
        stickyFillColor={stickyFillColor}
        setStickyFillColor={setStickyFillColor}
        shapeStrokeSwatchId={shapeStrokeSwatchId}
        pickShapeStrokeSwatch={pickShapeStrokeSwatch}
        markerColor={markerColor}
        markerColorSource={markerColorSource}
        markerCustomHex={markerCustomHex}
        pickMarkerSwatchColor={pickMarkerSwatchColor}
        pickMarkerCustomColor={pickMarkerCustomColor}
        penThicknessStep={penThicknessStep}
        setPenThicknessStep={setPenThicknessStep}
        markerThicknessStep={markerThicknessStep}
        setMarkerThicknessStep={setMarkerThicknessStep}
        shapeThicknessStep={shapeThicknessStep}
        setShapeThicknessStep={setShapeThicknessStep}
        textThicknessStep={textThicknessStep}
        setTextThicknessStep={setTextThicknessStep}
        stickyThicknessStep={stickyThicknessStep}
        setStickyThicknessStep={setStickyThicknessStep}
        stampThicknessStep={stampThicknessStep}
        setStampThicknessStep={setStampThicknessStep}
        eraserPixelThicknessStep={eraserPixelThicknessStep}
        setEraserPixelThicknessStep={setEraserPixelThicknessStep}
        eraserLineThicknessStep={eraserLineThicknessStep}
        setEraserLineThicknessStep={setEraserLineThicknessStep}
        textVisualStyle={textVisualStyle}
        setTextVisualStyle={setTextVisualStyle}
        textAlign={textAlign}
        setTextAlign={setTextAlign}
        textFillColor={textFillColor}
        setTextFillColor={setTextFillColor}
        penLineDashStyle={penLineDashStyle}
        setPenLineDashStyle={setPenLineDashStyle}
        markerLineDashStyle={markerLineDashStyle}
        setMarkerLineDashStyle={setMarkerLineDashStyle}
        markerStraightStroke={markerStraightStroke}
        setMarkerStraightStroke={setMarkerStraightStroke}
        markerDecoratedEdge={markerDecoratedEdge}
        setMarkerDecoratedEdge={setMarkerDecoratedEdge}
        penAutoGroupConnected={penAutoGroupConnected}
        setPenAutoGroupConnected={setPenAutoGroupConnected}
        marqueeSelectRule={marqueeSelectRule}
        setMarqueeSelectRule={setMarqueeSelectRule}
        textFontId={textFontId}
        setTextFontId={setTextFontId}
        textFontWeight={textFontWeight}
        setTextFontWeight={setTextFontWeight}
        pickTextColor={pickTextColor}
        pickTextFillColor={pickTextFillColor}
        pickStickyFillColor={pickStickyFillColor}
        stickySelectionActive={stickySelectionActive}
        shapeSelectionActive={shapeSelectionActive}
        penStrokeSelectionActive={penStrokeSelectionActive}
        markerStrokeSelectionActive={markerStrokeSelectionActive}
        bookTextSpreadHasSelectable={bookTextSpreadCapability.hasSelectable}
        bookTextCapabilityPending={bookTextSpreadCapability.pending}
        shapeLineDashStyle={shapeLineDashStyle}
        setShapeLineDashStyle={setShapeLineDashStyle}
        shapeStrokeEnabled={shapeStrokeEnabled}
        setShapeStrokeEnabled={setShapeStrokeEnabled}
        shapeFillMode={shapeFillMode}
        setShapeFillMode={setShapeFillMode}
        shapeFillColor={shapeFillColor}
        setShapeFillColor={setShapeFillColor}
        shapeRoundedCorners={shapeRoundedCorners}
        setShapeRoundedCorners={setShapeRoundedCorners}
        eyedropperVariant={eyedropperVariant}
        setEyedropperVariant={setEyedropperVariant}
        isWhiteboardOpen={isWhiteboardOpen}
        registerToolSettingsCloseRef={dismissToolSettingsRef}
      />

      <LessonCoachConnectDialog
        open={coachDialogOpen}
        onOpenChange={setCoachDialogOpen}
        sessionId={coachSessionId}
        coachUrl={coachUrl}
        onSessionCreated={({ id, coachUrl: url }) => {
          setCoachSessionId(id)
          setCoachUrl(url)
        }}
        studentId={studentId}
        studentName={studentName}
        bookId={selectedBookId}
        bookTitle={selectedBook?.title ?? null}
        unitId={selectedUnit?.id ?? null}
        unitTitle={selectedUnit?.title ?? null}
        lessonId={coachLessonId}
        lessonTitle={coachLessonTitle}
        partId={coachPartId}
        partTitle={coachPartTitle}
      />

      <div
        className="absolute inset-y-0 right-0 z-[10] min-h-0 min-w-0 pt-[var(--book-top-chrome-clearance)] pb-[var(--book-bottom-chrome-clearance)]"
        style={
          {
            left: bookDeskLeft,
            '--book-top-chrome-clearance': showTopChrome ? BOOK_BOTTOM_CHROME_HEIGHT : '0px',
            '--book-bottom-chrome-clearance': floatingBottomChrome
              ? '0px'
              : BOOK_BOTTOM_CHROME_HEIGHT,
          } as CSSProperties
        }
      >
        <div
          ref={bookStageRef}
          className="relative z-10 grid h-full w-full min-h-0 min-w-0 place-items-center"
        >
          <div
            className="relative h-full w-full min-h-0 min-w-0 shrink-0"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          >
        {boardLinkPlacementActive ? (
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 z-[45] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white/90',
              hintTopClass,
              BOOK_OVERLAY_GLASS_CHROME,
            )}
            role="status"
            aria-live="polite"
          >
            Tap where this board should appear on the book
            <span className="ml-2 text-white/55">({SC.deselectAll} to cancel)</span>
          </div>
        ) : null}
        {audioPins.audioPinPlacementActive ? (
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 z-[45] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white/90',
              hintTopClass,
              BOOK_OVERLAY_GLASS_CHROME,
            )}
            role="status"
            aria-live="polite"
          >
            Tap the page to place this track
            <span className="ml-2 text-white/55">({SC.deselectAll} to cancel)</span>
          </div>
        ) : null}
        {readingCheckHotspotPlacementActive ? (
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 z-[45] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white/90',
              hintTopClass,
              BOOK_OVERLAY_GLASS_CHROME,
            )}
            role="status"
            aria-live="polite"
          >
            Tap where this question should appear
            <span className="ml-2 text-white/55">({SC.deselectAll} to cancel)</span>
          </div>
        ) : null}
        {bookExercises.boxDrawActive ? (
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 z-[45] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white/90',
              hintTopClass,
              BOOK_OVERLAY_GLASS_CHROME,
            )}
            role="status"
            aria-live="polite"
          >
            Drag around one exercise
            <span className="ml-2 text-white/55">({SC.deselectAll} to cancel)</span>
          </div>
        ) : null}

        <div className="absolute inset-0 overscroll-none">
          {readerLayoutMode === 'pageGrid' && hasResolvedUnit && selectedUnit ? (
            <PageGridStage
              pageNumbers={visiblePages}
              activeLeftPage={pageNumber}
              activeRightPage={showSpreadRightPage ? spreadRightPage : null}
              fileUrl={unitThumbFileUrl}
              unitId={selectedUnit.id}
              pdfReady={pdfReady}
              pageAspectRatio={pageAspectRatio}
              selectedBook={selectedBook}
              selectedUnit={selectedUnit}
              numPages={numPages}
              numberingMode={numberingMode}
              onSelectPage={openSpreadAtPageFromGrid}
            />
          ) : null}
          <div
            className={cn(
              'absolute inset-0',
              readerLayoutMode === 'pageGrid' && 'invisible pointer-events-none',
            )}
            aria-hidden={readerLayoutMode === 'pageGrid'}
          >
          <WritableTextGlossReviewProvider openReview={writableTranslateSelection.openFromGloss}>
          <BookCanvasStage
            pageAreaRef={pageAreaRef}
            hasCurriculumOrHistory={hasCurriculumOrHistory}
            studentId={studentId}
            hideSelectionContextBar={writableTranslateSelection.visible}
            onAnnotationToolUseOnSpread={dismissToolSettingsOnSpreadUse}
            loading={loading}
            error={error}
            hasResolvedUnit={hasResolvedUnit}
            pdfReady={pdfReady}
            spreadDisplayScale={spreadDisplayScale}
            spreadReaderDisplayScale={spreadReaderDisplayScale}
            spreadFitMotionActive={spreadFitMotionActive}
            effectiveSpreadScreenScale={effectiveSpreadScreenScale}
            focusZoomDrawActive={focusZoomDrawActive}
            focusLayout={focusLayout}
            pinchSpreadRef={pinchSpreadRef}
            pinchZoomActive={pinchZoomActive}
            onFocusDrawCancel={cancelFocusDraw}
            onFocusDrawConfirm={commitFocusNormRect}
            onFocusExit={clearFocusZoom}
            onFocusPanDelta={applyFocusPanDelta}
            onFocusNewArea={startFocusDraw}
            ANIMATION_MS={ANIMATION_MS}
            PdfPage={PdfPage}
            selectedUnitFilePath={selectedUnit?.filePath ?? ''}
            makeUnitFileUrl={makeUnitFileUrl}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            isWhiteboardOpen={isWhiteboardSessionOpen}
            isWhiteboardMinimized={isWhiteboardMinimized}
            onMinimizeWhiteboard={handleMinimizeWhiteboardAnimated}
            whiteboardPanelAnchorRef={whiteboardLaunch.panelAnchorRef}
            whiteboardPanelAppearStyle={whiteboardLaunch.panelAppearStyle}
            whiteboardPanelAppearBlocking={whiteboardLaunch.panelAppearBlocking}
            onWhiteboardPanelTransitionEnd={whiteboardLaunch.onPanelTransitionEnd}
            suppressChrome={suppressChrome}
            swapWhiteboardSlotSide={swapWhiteboardSlotSide}
            setWhiteboardSlotSide={setWhiteboardSlotSide}
            applyWhiteboardSlotSide={applyWhiteboardSlotSide}
            registerWhiteboardSlotMotion={registerWhiteboardSlotMotion}
            exportCaptureLayoutActive={exportCaptureLayoutActive}
            showBookFrame={showBookFrame}
            leftPageCaptureRef={leftPageCaptureRef}
            pageNumber={pageNumber}
            spreadPageWidth={layoutSpreadPageWidth}
            spreadGutterPullRatio={spreadGutterPullRatio}
            onPdfPageLoadSuccess={onPdfPageLoadSuccess}
            selectedBookId={selectedBookId}
            selectedUnitId={selectedUnit?.id}
            lessonBoardBookId={lessonBoardBookId ?? undefined}
            lessonBoardUnitId={lessonBoardUnitId ?? undefined}
            boardFooterLabel={boardFooterLabel}
            boardBookFullTitle={boardBookFullTitle}
            boardBookAccentColor={boardBookAccentColor}
            boardShelf={boardShelf}
            onSelectBoardNotebook={switchLessonBoardNotebook}
            nextUnitBoard={nextUnitBoard}
            showNextUnitBoardPrompt={showNextUnitBoardPrompt}
            onOpenNextUnitBoard={openNextUnitBoard}
            onDismissNextUnitBoardPrompt={dismissNextUnitBoardPrompt}
            pageCanvasHeightPx={pageCanvasHeightPx}
            annotationMode={effectiveAnnotationMode}
            onEnterSelectMode={() => setAnnotationMode('select')}
            eyedropperVariant={eyedropperVariant}
            stickerKind={stickerKind}
            writableStickerVariant={writableStickerVariant}
            stampVariant={stampVariant}
            stampIndicatorPulseEpoch={stampIndicatorPulseEpoch}
            stampQuestionColor={stampQuestionColor}
            strokeWidthScale={strokeWidthScale}
            eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
            penStrokeWidthScale={penStrokeWidthScale}
            shapeStrokeWidthScale={shapeStrokeWidthScale}
            stampScale={stampScale}
            strokeColor={strokeColor}
            penInkColor={penColor}
            penInkStyle={penInkStyle}
            penStrokeProfile={penStrokeProfile}
            shapeColor={shapeColor}
            textColor={textColor}
            stickyFillColor={stickyFillColor}
            strokeLineDashStyle={strokeLineDashStyleForInk}
            markerStraightStroke={markerStraightStroke}
            markerDecoratedEdge={markerDecoratedEdge}
            penAutoGroupConnected={penAutoGroupConnected}
            marqueeSelectRule={marqueeSelectRule}
            shapeLineDashStyle={shapeLineDashStyle}
            shapeStrokeEnabled={shapeStrokeEnabled}
            shapeFillMode={shapeFillMode}
            shapeFillColor={shapeFillColor}
            shapeRoundedCorners={shapeRoundedCorners}
            textFontSizeNorm={textFontSizeNorm}
            textFontId={textFontId}
            textFontWeight={textFontWeight}
            bookTextVisualStyle={bookTextVisualStyle}
            textVisualStyle={textVisualStyle}
            textAlign={textAlign}
            textFillColor={textFillColor}
            stickyFontSizeNorm={stickyFontSizeNorm}
            annotationTargetPage={annotationTargetPage}
            setAnnotationTargetPage={setAnnotationTargetPage}
            onLeftAnnotationCaps={onLeftAnnotationCaps}
            leftAnnRef={leftAnnRef}
            showSpreadRightPage={showSpreadRightPage}
            rightPageCaptureRef={rightPageCaptureRef}
            spreadRightPage={spreadRightPage}
            onRightAnnotationCaps={onRightAnnotationCaps}
            rightAnnRef={rightAnnRef}
            wbCaptureRootRef={wbCaptureRootRef}
            LESSON_BOARD_SURFACE={LESSON_BOARD_SURFACE}
            whiteboardStorageKey={whiteboardStorageKey}
            whiteboardSlotSide={whiteboardSlotSide}
            whiteboardLayoutMode={whiteboardLayoutMode}
            whiteboardFloatRect={whiteboardFloatRect}
            floatWhiteboard={floatWhiteboard}
            dockWhiteboardToSlot={dockWhiteboardToSlot}
            forceDockWhiteboard={forceDockWhiteboard}
            commitWhiteboardFloatRect={commitWhiteboardFloatRect}
            whiteboardContentHeightPx={whiteboardContentHeightPx}
            ensureWhiteboardRunwayBelowView={ensureWhiteboardRunwayBelowView}
            createLessonBoardPage={createLessonBoardPage}
            saveLessonBoardNow={saveLessonBoardNow}
            deleteActiveLessonBoardPage={deleteActiveLessonBoardPage}
            canDeleteActiveLessonBoardPage={canDeleteActiveLessonBoardPage}
            boardLinkPlacementActive={boardLinkPlacementActive}
            lessonBoardPageLinks={lessonBoardPageLinks}
            onPlaceBoardLink={placeBoardLinkAt}
            onOpenBoardFromLink={openBoardFromLink}
            startBoardLinkPlacement={() => {
              audioPins.cancelAudioPinPlacement()
              bookExercises.cancelBoxDraw()
              startBoardLinkPlacement()
            }}
            removeActiveBoardPageLink={removeActiveBoardPageLink}
            activeBoardPageLink={activeBoardPageLink}
            boardLinkInHeader={isPrepMode}
            audioPinPlacementActive={audioPins.audioPinPlacementActive}
            audioPins={audioPins.audioPins}
            audioTracks={bookAudio.tracks}
            audioPlayingTrackId={bookAudio.currentTrackId}
            audioIsPlaying={bookAudio.isPlaying}
            onPlaceAudioPin={(pdfPage, center) => {
              void audioPins.placeAudioPinAt(pdfPage, center)
            }}
            onPlayAudioPin={(pin) => bookAudio.playTrack(pin.trackId)}
            onRemoveAudioPin={(pin) => {
              void audioPins.removeAudioPin(pin.id)
            }}
            onMoveAudioPin={(pin, pdfPage, center) => {
              void audioPins.moveAudioPin(pin.id, pdfPage, center)
            }}
            readingCheckHotspotPlacementActive={readingCheckHotspotPlacementActive}
            onPlaceReadingCheckHotspot={placeReadingCheckHotspotAt}
            readingCheckHotspotPreviewPdfPage={readingCheckHotspotPreviewPdfPage}
            readingCheckHotspotPreviewCenter={readingCheckHotspotPreviewCenter}
            readingCheckHotspotPreviewLabel={readingCheckHotspotPreviewLabel}
            onReadingCheckHotspotPreviewClick={onReadingCheckHotspotPreviewClick}
            readingCheckLivePins={userPresented ? liveCheckPins : []}
            onReadingCheckLivePinClick={setLiveCheckStopId}
            exerciseBoxDrawActive={bookExercises.boxDrawActive}
            exerciseTasks={bookExercises.tasks}
            selectedExerciseTaskId={bookExercises.selectedTaskId}
            onPlaceExerciseBox={(pdfPage, rect) => {
              void bookExercises.placeExerciseBox(pdfPage, rect)
            }}
            onCancelExerciseBoxDraw={bookExercises.cancelBoxDraw}
            onSelectExerciseTask={(task) => {
              audioPins.cancelAudioPinPlacement()
              bookExercises.cancelBoxDraw()
              setBookAudioOpen(false)
              setIsPageListOpen(false)
              setClassToolId(null)
              onDeskRailOpenChange?.(false)
              if (isBookExerciseLiveEligible(task) && !bookExercisesOpen) {
                bookExercises.setSelectedTaskId(task.id)
                setPlayExerciseTaskId(task.id)
                return
              }
              setPlayExerciseTaskId(null)
              setBookExercisesOpen(true)
              bookExercises.setSelectedTaskId(task.id)
            }}
            onRemoveExerciseTask={(task) => {
              void bookExercises.removeExerciseTask(task.id)
            }}
            onMoveExerciseTask={(task, center) => {
              void bookExercises.moveExercisePin(task.id, center)
            }}
            wbAnnRef={wbAnnRef}
            onWhiteboardCaps={onWhiteboardCaps}
            regionSelectOpen={regionSelectOpen}
            setRegionSelectOpen={setRegionSelectOpen}
            runImageCapture={runImageCapture}
            captureBusy={captureBusy}
            pdfExporting={pdfExporting}
            pdfProgressLabel={pdfProgressLabel}
            numPages={numPages}
            visiblePages={visiblePages}
            readerBounds={unitPageBounds}
            showSpreadLoadingHold={showSpreadLoadingHold}
            spreadReportEpoch={spreadReportEpoch}
            onSpreadSlotsPixelsReady={onSpreadSlotsPixelsReady}
            confirmSpreadSlotPixels={confirmSpreadSlotPixels}
            spreadStrokeOverlayRef={spreadStrokeOverlayRef}
            onSpreadOverlayCaps={onSpreadOverlayCaps}
            spreadStrokeCaptureEnabled={spreadStrokeCaptureEnabled}
            spreadSessionStoreRef={spreadSessionStoreRef}
            spreadImagePasteRef={spreadImagePasteRef}
            wbStrokeOverlayRef={wbStrokeOverlayRef}
            whiteboardStrokeCaptureEnabled={whiteboardStrokeCaptureEnabled}
            whiteboardSessionStoreRef={whiteboardSessionStoreRef}
            whiteboardSelectionMoveClampRef={whiteboardSelectionMoveClampRef}
            whiteboardSessionDoc={whiteboardSessionDoc}
            whiteboardInkRevision={whiteboardInkRevision}
            appendWhiteboardSessionCommand={appendWhiteboardSessionCommand}
            whiteboardSessionUndo={whiteboardSessionUndo}
            whiteboardSessionRedo={whiteboardSessionRedo}
            whiteboardSessionClear={whiteboardSessionClear}
            onWhiteboardOverlayCaps={onWhiteboardOverlayCaps}
            onBookTextSpreadCapabilityChange={onBookTextSpreadCapabilityChange}
            onEyedropperPick={onEyedropperPick}
            spreadTurnGridRef={spreadTurnGridRef}
            turnSlide={turnSlide}
            onTurnSlideComplete={handleTurnSlideComplete}
          />
          </WritableTextGlossReviewProvider>
          </div>
        </div>

        <PlaceTranslationOverlay
          text={placeTranslationText}
          imageUrl={placeTranslationImage?.src ?? null}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          onCancel={() => {
            setPlaceTranslationText(null)
            setPlaceTranslationImage(null)
          }}
          onPlace={(clientX, clientY, surface) => {
            if (placeTranslationImage) placeTranslateImage(clientX, clientY, surface)
            else placeTranslationOnSpread(clientX, clientY, surface)
          }}
        />
        <WritableTextTranslatePopover
          studentId={studentId}
          enabled={open && hasResolvedUnit}
          visible={writableTranslateSelection.visible && !suppressChrome}
          text={writableTranslateSelection.text}
          context={writableTranslateSelection.context}
          anchorRect={writableTranslateSelection.anchorRect}
          annotationId={writableTranslateSelection.annotationId}
          selectionStart={writableTranslateSelection.selectionStart}
          selectionEnd={writableTranslateSelection.selectionEnd}
          initialResult={writableTranslateSelection.initialResult}
          onDismiss={writableTranslateSelection.clear}
          onPinGloss={pinWritableTextGloss}
        />
          </div>
        </div>
      </div>

      {showTopChrome ? (
        <div
          className="pointer-events-none fixed z-[56] top-0 left-[var(--book-workspace-left-inset)] right-0"
          style={{ '--book-workspace-left-inset': bookDeskLeft } as CSSProperties}
        >
          <div className="pointer-events-auto">{topChrome}</div>
        </div>
      ) : null}

      <BookBottomChrome
        deskLeft={bookDeskLeft}
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        suppressChrome={hideFocusPresentationChrome}
        visiblePages={visiblePages}
        pageNumber={pageNumber}
        goToAdjacentPage={goToAdjacentPage}
        pageJumpDraft={pageJumpDraft}
        setPageJumpDraft={setPageJumpDraft}
        setPageJumpFocused={setPageJumpFocused}
        spreadRightPage={spreadRightPage}
        selectedBook={selectedBook}
        selectedUnit={selectedUnit}
        numberingMode={numberingMode}
        commitPageJump={commitPageJump}
        printedJumpBounds={printedJumpBounds}
        unitPageBounds={unitPageBounds}
        toolbarCaps={toolbarCaps}
        isWhiteboardOpen={isWhiteboardOpen}
        isWhiteboardSessionOpen={isWhiteboardSessionOpen}
        isWhiteboardMinimized={isWhiteboardMinimized}
        whiteboardLayoutMode={whiteboardLayoutMode}
        onMinimizeWhiteboard={handleMinimizeWhiteboardAnimated}
        onExpandWhiteboard={handleExpandWhiteboardAnimated}
        onFloatWhiteboard={() => floatWhiteboard(0, 0)}
        onDockWhiteboard={dockWhiteboardToSlot}
        bookFocusZoomEnabled={bookFocusZoomEnabled}
        focusZoomActive={focusZoomActive}
        focusZoomDrawActive={focusZoomDrawActive}
        onFocusZoomDraw={startFocusDraw}
        pinchZoomActive={pinchZoomActive}
        pinchZoomScale={pinchZoomState.scale}
        onStepPinchZoom={stepPinchZoom}
        onResetZoom={() => {
          clearPinchZoom()
          clearFocusZoom()
        }}
        showBookFrame={showBookFrame}
        onToggleBookFrame={() => setShowBookFrame(!showBookFrame)}
        readerLayoutMode={readerLayoutMode}
        onEnterPageGridOverview={enterPageGridOverview}
        onExitPageGridOverview={exitPageGridOverview}
        pdfReady={pdfReady}
        captureBusy={captureBusy}
        captureFormat={captureFormat}
        setCaptureFormat={setCaptureFormat}
        jpegQuality={jpegQuality}
        setJpegQuality={setJpegQuality}
        hideChromeForCapture={hideChromeForCapture}
        setHideChromeForCapture={setHideChromeForCapture}
        watermarkEnabled={watermarkEnabled}
        setWatermarkEnabled={setWatermarkEnabled}
        studentName={studentName}
        runImageCapture={runImageCapture}
        setRegionSelectOpen={setRegionSelectOpen}
        copyLastCaptureToClipboard={copyLastCaptureToClipboard}
        hasLastImageCapture={hasLastImageCapture}
        onExportPdfPacket={() => {
          if (numPages != null && selectedUnit) {
            const b = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
            setPdfFrom(String(b.min))
            setPdfTo(String(b.max))
          }
          setPdfDialogOpen(true)
        }}
        getActiveAnnotationRef={getActiveAnnotationRef}
        browserFullscreenSupported={browserFullscreenSupported}
        isBrowserFullscreen={isBrowserFullscreen}
        onToggleBrowserFullscreen={toggleBrowserFullscreen}
        floatingChrome={floatingBottomChrome}
        onFloatingChromeChange={setFloatingBottomChrome}
      />

      {bookAudio.currentTrack && userPresented ? (
        <BookAudioNowPlayingPill
          title={bookAudio.currentTrack.title}
          isPlaying={bookAudio.isPlaying}
          currentTime={bookAudio.currentTime}
          duration={bookAudio.duration}
          deskLeft={bookDeskLeft}
          floatingChrome={floatingBottomChrome}
          hidden={hideFocusPresentationChrome}
          onTogglePlayPause={bookAudio.togglePlayPause}
          onRestart={bookAudio.restart}
          onSeek={bookAudio.seek}
          onStop={bookAudio.stop}
        />
      ) : null}

      <BookWorkspaceLeftBar
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        suppressChrome={hideFocusPresentationChrome}
        isPageListOpen={isPageListOpen}
        onTogglePageList={handleTogglePageList}
        isWhiteboardOpen={isWhiteboardOpen}
        isWhiteboardSessionOpen={isWhiteboardSessionOpen}
        isWhiteboardMinimized={isWhiteboardMinimized}
        onWhiteboardClick={handleWhiteboardRailClick}
        translateDockOpen={classToolId === 'translate'}
        onTranslateDockToggle={toggleClassToolTranslate}
        picturesDockOpen={classToolId === 'pictures'}
        onPicturesDockToggle={toggleClassToolPictures}
        onOpenCoachDialog={() => setCoachDialogOpen(true)}
        onClose={closeOverlay}
        lessonSettingsOpen={lessonSettingsOpen}
        onLessonSettingsToggle={() => {
          setToolboxMenuOpen(false)
          setActiveToolboxTool(null)
          setLessonSettingsOpen((open) => !open)
        }}
        toolboxOpen={toolboxChromeOpen}
        onToolboxToggle={toggleToolbox}
        hasInteractiveVocab={!!interactiveVocabPack}
        interactiveVocabOpen={interactiveVocabOpen}
        onInteractiveVocabToggle={() => setInteractiveVocabOpen((open) => !open)}
        hasReadingChecks={!!liveReadingCheckPack}
        readingChecksOpen={readingChecksOpen}
        onReadingChecksToggle={() => setReadingChecksOpen((open) => !open)}
        hasBookAudio={bookAudio.hasTracks}
        bookAudioOpen={bookAudioOpen}
        bookAudioPlaying={bookAudio.isPlaying}
        onBookAudioToggle={toggleBookAudioRail}
        bookExercisesOpen={bookExercisesOpen}
        onBookExercisesToggle={toggleBookExercisesRail}
      />

      {userPresented ? (
        <ClassToolboxHost
          menuOpen={toolboxMenuOpen}
          onMenuOpenChange={setToolboxMenuOpen}
          activeTool={activeToolboxTool}
          onActiveToolChange={setActiveToolboxTool}
        />
      ) : null}

      <ClassLessonSettingsPanel
        open={lessonSettingsOpen}
        onClose={() => setLessonSettingsOpen(false)}
      />

      {interactiveVocabPack ? (
        <InteractiveVocabReaderShelf
          pack={interactiveVocabPack}
          hideTrigger
          open={interactiveVocabOpen}
          onOpenChange={setInteractiveVocabOpen}
        />
      ) : null}

      {liveReadingCheckPack && readingStoryHit && userPresented ? (
        <ReadingCheckLiveShelf
          pack={liveReadingCheckPack}
          storyTitle={readingStoryHit.story.title}
          studentId={studentId}
          classSessionId={activeClassSessionId}
          hideTrigger
          open={readingChecksOpen}
          onOpenChange={setReadingChecksOpen}
          selectedBook={selectedBook}
          selectedUnit={selectedUnit}
          totalPdfPages={numPages}
          leftPdfPage={pageNumber}
          rightPdfPage={spreadRightPage}
          activeStopId={liveCheckStopId}
          onActiveStopIdChange={setLiveCheckStopId}
          onLiveMarked={() => setLiveCheckMarkEpoch((epoch) => epoch + 1)}
        />
      ) : null}

      {focusLayout && focusZoomActive ? (
        <BookFocusTheaterLayer
          overlayRef={overlayRootRef}
          pageAreaRef={pageAreaRef}
          holeRect={focusLayout.holeRect}
          onExit={clearFocusZoom}
          onNewArea={startFocusDraw}
          onPanDelta={applyFocusPanDelta}
          exportBusy={captureBusy}
          onExportRegion={() => {
            void runImageCapture({
              kind: 'region',
              regionCss: focusHoleRectToCaptureRegion(focusLayout.holeRect),
            })
          }}
        />
      ) : null}

      <OverlayDialogs
        pdfDialogOpen={pdfDialogOpen}
        setPdfDialogOpen={setPdfDialogOpen}
        numPages={numPages}
        pdfFrom={pdfFrom}
        setPdfFrom={setPdfFrom}
        pdfTo={pdfTo}
        setPdfTo={setPdfTo}
        runPdfPacketExport={runPdfPacketExport}
        captionDialog={captionDialog}
        setCaptionDialog={setCaptionDialog}
        captionDraft={captionDraft}
        setCaptionDraft={setCaptionDraft}
        onSaveCaption={handleCaptionSave}
      />
    </div>
    </LessonCoachSyncProvider>
    </WritingAssistProvider>
  )
}
