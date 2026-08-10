'use client'

import 'react-pdf/dist/Page/TextLayer.css'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { InteractiveVocabReaderShelf } from '@/components/books/interactive-vocab-reader-shelf'
import { ReadingCheckLiveShelf } from '@/components/books/reading-check-live-shelf'
import { ReadingStoryReaderBadge } from '@/components/books/reading-story-reader-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { focusHoleRectToCaptureRegion } from '@/lib/books/focus-zoom-transform'
import { BookFocusTheaterLayer } from '@/components/students/fullscreen-book-overlay/sections/BookFocusDimOverlay'
import { OverlayDialogs } from './sections/OverlayDialogs'
import { PageListRail } from './sections/PageListRail'
import { AnnotationRail } from './sections/AnnotationRail'
import { BookBottomChrome } from './sections/BookViewport'
import { BookWorkspaceLeftBar } from './sections/BookWorkspaceLeftBar'
import { ClassLessonSettingsPanel } from '@/components/students/class-lesson-settings-panel'
import { ClassToolboxHost } from '@/components/students/class-toolbox/ClassToolboxHost'
import type { ClassToolboxToolId } from '@/lib/class-toolbox/types'
import { BookCanvasStage } from './sections/BookCanvasStage'
import { useWhiteboardToolbarLaunch } from './hooks/useWhiteboardToolbarLaunch'
import { TranslateDock } from './sections/TranslateDock'
import { PlaceTranslationOverlay } from './sections/PlaceTranslationOverlay'
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
import { toast } from 'sonner'
import { warmSpeechVoices } from '@/lib/audio/speak-text'
import { getUnitReaderBounds } from '@/lib/books/page-range'
import {
  BOOK_BOTTOM_CHROME_HEIGHT,
  BOOK_OVERLAY_GLASS_CHROME,
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
  useInkSessionTextSelectionActive,
} from './hooks/useInkSessionTextSelectionActive'
import { requestSpreadSessionFlush } from '@/lib/books/spread-session-events'
import { requestWhiteboardSessionFlush } from '@/lib/books/whiteboard-session-events'
import { flushPendingUnitPageSave } from '@/lib/books/progress'
import { shouldShowSpreadLoadingHold } from '@/lib/books/spread-drawable-ready'

export function FullscreenBookOverlayView({
  vm,
  onClose,
}: {
  vm: FullscreenBookOverlayViewModel
  onClose: () => void
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
  const [floatingBottomChrome, setFloatingBottomChrome] = useState(false)

  const {
    ANIMATION_MS,
    readerViewportAspectRatio,
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
    pageListRailTab,
    exportCaptureLayoutActive,
    showBookFrame,
    setShowBookFrame,
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
    translateDockOpen,
    setTranslateDockOpen,
    browserFullscreenSupported,
    isBrowserFullscreen,
    toggleBrowserFullscreen,
  } = vm

  const spreadTextSelectionActive = useInkSessionTextSelectionActive(
    spreadSessionStoreRef,
    hasResolvedUnit && !isWhiteboardOpen,
  )
  const whiteboardTextSelectionActive = useInkSessionTextSelectionActive(
    whiteboardSessionStoreRef,
    hasResolvedUnit && isWhiteboardOpen,
  )
  const textSelectionActive = spreadTextSelectionActive || whiteboardTextSelectionActive
  const writableTranslateSelection = useWritableTextTranslateSelection(
    open && hasResolvedUnit,
  )

  /** Chinese word picked in the translate dock, waiting for a tap on the spread. */
  const [placeTranslationText, setPlaceTranslationText] = useState<string | null>(null)

  const placeTranslationOnSpread = useCallback(
    (clientX: number, clientY: number) => {
      const text = placeTranslationText
      setPlaceTranslationText(null)
      if (!text) return

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
    if (!liveReadingCheckPack) setReadingChecksOpen(false)
  }, [liveReadingCheckPack])

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

  /** Keep stage visible after first successful open — do not hide on routine turns (R1 fix). */
  const bookStageEnterVisible =
    isVisible && (!userPresented || spreadDrawableReady || spreadHasBeenDrawable)
  const prevBookStageEnterVisibleRef = useRef(false)
  const bookStageEnterInstant =
    bookStageEnterVisible && !prevBookStageEnterVisibleRef.current
  useEffect(() => {
    prevBookStageEnterVisibleRef.current = bookStageEnterVisible
  }, [bookStageEnterVisible])

  const hideFocusPresentationChrome = suppressChrome || focusZoomActive

  useEffect(() => {
    if (!hideFocusPresentationChrome) return
    setToolboxMenuOpen(false)
    setActiveToolboxTool(null)
  }, [hideFocusPresentationChrome])

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
      <AnnotationRail
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        selectedBookId={selectedBookId}
        suppressChrome={suppressChrome}
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
        pickTextColor={pickTextColor}
        pickTextFillColor={pickTextFillColor}
        pickStickyFillColor={pickStickyFillColor}
        textSelectionActive={textSelectionActive}
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
        className="absolute inset-0 z-[10] grid min-h-0 min-w-0 place-items-center pb-[var(--book-bottom-chrome-clearance)]"
        style={
          {
            '--book-bottom-chrome-clearance': floatingBottomChrome
              ? '0px'
              : BOOK_BOTTOM_CHROME_HEIGHT,
          } as CSSProperties
        }
      >
        <div
          ref={bookStageRef}
          className={cn(
            'relative z-10 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform motion-reduce:transition-none',
            bookStageEnterInstant ? 'transition-none' : 'transition-all duration-[650ms]',
            bookStageEnterVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
          )}
        >
          <div
            className="relative flex max-h-[calc(100vh-var(--book-bottom-chrome-clearance))] max-w-[100vw] shrink-0 flex-col will-change-[width,transform]"
            style={{
              width: `min(100vw, calc((100vh - var(--book-bottom-chrome-clearance)) * ${readerViewportAspectRatio}))`,
              aspectRatio: readerViewportAspectRatio,
              transition: `width ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1), transform ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          >
        {boardLinkPlacementActive ? (
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 top-3 z-[45] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white/90',
              BOOK_OVERLAY_GLASS_CHROME,
            )}
            role="status"
            aria-live="polite"
          >
            Tap where this board should appear on the book
            <span className="ml-2 text-white/55">({SC.deselectAll} to cancel)</span>
          </div>
        ) : null}
        {readingCheckHotspotPlacementActive ? (
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 top-3 z-[45] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white/90',
              BOOK_OVERLAY_GLASS_CHROME,
            )}
            role="status"
            aria-live="polite"
          >
            Tap where this question should appear
            <span className="ml-2 text-white/55">({SC.deselectAll} to cancel)</span>
          </div>
        ) : null}

        <div className="absolute inset-0 overscroll-none">
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
            startBoardLinkPlacement={startBoardLinkPlacement}
            removeActiveBoardPageLink={removeActiveBoardPageLink}
            activeBoardPageLink={activeBoardPageLink}
            boardLinkInHeader={isPrepMode}
            readingCheckHotspotPlacementActive={readingCheckHotspotPlacementActive}
            onPlaceReadingCheckHotspot={placeReadingCheckHotspotAt}
            readingCheckHotspotPreviewPdfPage={readingCheckHotspotPreviewPdfPage}
            readingCheckHotspotPreviewCenter={readingCheckHotspotPreviewCenter}
            readingCheckHotspotPreviewLabel={readingCheckHotspotPreviewLabel}
            onReadingCheckHotspotPreviewClick={onReadingCheckHotspotPreviewClick}
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

        <TranslateDock
          studentId={studentId}
          open={translateDockOpen}
          onOpenChange={setTranslateDockOpen}
          suppressChrome={hideFocusPresentationChrome}
          pageListOpen={isPageListOpen}
          onPlaceText={hasResolvedUnit ? setPlaceTranslationText : undefined}
        />
        <PlaceTranslationOverlay
          text={placeTranslationText}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          onCancel={() => setPlaceTranslationText(null)}
          onPlace={placeTranslationOnSpread}
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

      <BookBottomChrome
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

      <BookWorkspaceLeftBar
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        suppressChrome={hideFocusPresentationChrome}
        isPageListOpen={isPageListOpen}
        onTogglePageList={togglePageListRail}
        isWhiteboardOpen={isWhiteboardOpen}
        isWhiteboardSessionOpen={isWhiteboardSessionOpen}
        isWhiteboardMinimized={isWhiteboardMinimized}
        onWhiteboardClick={handleWhiteboardRailClick}
        translateDockOpen={translateDockOpen}
        onTranslateDockToggle={() => setTranslateDockOpen(!translateDockOpen)}
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

      {readingStoryHit && !isWhiteboardOpen ? (
        <ReadingStoryReaderBadge story={readingStoryHit.story} range={readingStoryHit.range} />
      ) : null}

      {interactiveVocabPack ? (
        <InteractiveVocabReaderShelf
          pack={interactiveVocabPack}
          hideTrigger
          open={interactiveVocabOpen}
          onOpenChange={setInteractiveVocabOpen}
        />
      ) : null}

      {liveReadingCheckPack && readingStoryHit ? (
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
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
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
