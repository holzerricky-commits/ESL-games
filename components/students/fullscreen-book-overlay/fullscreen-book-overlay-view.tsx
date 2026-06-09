'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { InteractiveVocabReaderShelf } from '@/components/books/interactive-vocab-reader-shelf'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OverlayDialogs } from './sections/OverlayDialogs'
import { PageListRail } from './sections/PageListRail'
import { BookOverlayLeftChrome } from './sections/BookOverlayLeftChrome'
import { LessonPaperPanel } from './sections/LessonPaperPanel'
import { BookLessonPaperViewControls, BookPageNavigation } from './sections/BookViewport'
import { AnnotationTopOptionsBar } from '@/components/students/annotation-top-options-bar'
import { TopOverlayControls } from './sections/TopOverlayControls'
import { BookCanvasStage } from './sections/BookCanvasStage'
import { WhiteboardToolbarLaunchOverlay } from './sections/WhiteboardToolbarLaunchOverlay'
import { useWhiteboardToolbarLaunch } from './hooks/useWhiteboardToolbarLaunch'
import { TranslateDock } from './sections/TranslateDock'
import { VocabNotebookPanel } from './sections/VocabNotebookPanel'
import {
  BOOK_OVERLAY_GLASS_CHROME,
  BOOK_OVERLAY_NOTEBOOK_UI_ENABLED,
  BOOK_OVERLAY_VIEWPORT_CONTENT_HEIGHT,
} from './constants'
import type { FullscreenBookOverlayViewModel } from './hooks/useFullscreenBookOverlayController'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import { WritingAssistProvider } from '@/lib/writing-assist/writing-assist-context'
import { buildLessonVocabulary } from '@/lib/writing-assist/build-lesson-vocabulary'
import { LessonCoachConnectDialog } from '@/components/lesson-coach/lesson-coach-connect-dialog'
import { LessonCoachSyncProvider } from '@/lib/lesson-coach/lesson-coach-sync-context'
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
  const closeOverlay = () => {
    flushPendingUnitPageSave()
    requestSpreadSessionFlush()
    requestWhiteboardSessionFlush()
    onClose()
  }

  const {
    ANIMATION_MS,
    readerViewportAspectRatio,
    PdfPage,
    WHITEBOARD_NOTEBOOK_SURFACE,
    activePageRowRef,
    annotationMode,
    effectiveAnnotationMode,
    annotationTargetPage,
    applyLessonPaperCommand,
    bookStageRef,
    captionDialog,
    captionDraft,
    captureBusy,
    captureFormat,
    commitPageJump,
    copyLastCaptureToClipboard,
    currentNotebookPageSpanKey,
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
    isAnnotationRailVisible,
    isLessonPaperOpen,
    isLessonPaperOverlayMode,
    isLessonPaperSplitView,
    isPageListOpen,
    pageListRailTab,
    isSinglePageMode,
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
    lessonPaperBreadcrumb,
    lessonPaperEditVersion,
    lessonPaperEditorRef,
    lessonPaperHeader,
    lessonPaperLastPartContextKeyRef,
    lessonPaperPanPx,
    lessonPaperScrollRef,
    lessonPaperScrollRunwayPx,
    lessonPaperViewMode,
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
    onLessonPaperInput,
    handleLessonPaperInputWithHtmlSync,
    handleStartNotebookNote,
    handleOpenWhiteboardForCapture,
    handleOpenTranslateDockForVocab,
    goToNotebookSourcePage,
    returnToNotebookCurrentPage,
    notebookReturnPage,
    lessonPaperHtml,
    onLessonPaperPaste,
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
    handleSetLessonPaperOpen,
    lessonPaperSaveState,
    notebookEditable,
    setIsPageListOpen,
    togglePageListRail,
    setPageListRailTab,
    setIsWhiteboardOpen,
    setJpegQuality,
    setLessonPaperViewMode,
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
    pickTextFillColor,
    setTextFillColor,
    setTextVisualStyle,
    setTextFontId,
    setWatermarkEnabled,
    whiteboardStorageKey,
    whiteboardSlotSide,
    whiteboardContentHeightPx,
    extendWhiteboardRunway,
    activeClassSessionId,
    shapeColor,
    shapeStrokeWidthScale,
    showSpreadRightPage,
    spreadDisplayScale,
    spreadGutterPullRatio,
    spreadPageWidth,
    spreadStrokeCaptureEnabled,
    spreadStrokeOverlayRef,
    spreadSessionStoreRef,
    wbStrokeOverlayRef,
    whiteboardStrokeCaptureEnabled,
    whiteboardSessionStoreRef,
    whiteboardSessionDoc,
    appendWhiteboardSessionCommand,
    whiteboardSessionUndo,
    whiteboardSessionRedo,
    whiteboardSessionClear,
    selectLessonBoardPage,
    createLessonBoardPage,
    renameLessonBoardPage,
    lessonBoardActivePageRowRef,
    onWhiteboardOverlayCaps,
    layoutSpreadPageWidth,
    spreadRightPage,
    spreadDrawableReady,
    onSpreadSlotsPixelsReady,
    stampScale,
    stampVariant,
    stampQuestionColor,
    setStampQuestionColor,
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
    textVisualStyle,
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
  } = vm

  const [coachDialogOpen, setCoachDialogOpen] = useState(false)
  const [coachSessionId, setCoachSessionId] = useState<string | null>(null)
  const [coachUrl, setCoachUrl] = useState<string | null>(null)
  const [vocabNotebookOpen, setVocabNotebookOpen] = useState(false)
  const notebookUiEnabled = BOOK_OVERLAY_NOTEBOOK_UI_ENABLED
  const lessonPaperLayoutActive = notebookUiEnabled && isLessonPaperOpen

  const whiteboardLaunch = useWhiteboardToolbarLaunch({
    surfaceStyle: WHITEBOARD_NOTEBOOK_SURFACE,
  })

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

  return (
    <WritingAssistProvider
      lessonWords={lessonWordsForAssist}
      active={open && userPresented}
    >
    <LessonCoachSyncProvider sessionId={coachSessionId}>
    <div
      className={cn(
        'absolute inset-0 z-50 p-0 transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
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
      {whiteboardLaunch.flight ? (
        <WhiteboardToolbarLaunchOverlay
          flight={whiteboardLaunch.flight}
          surfaceStyle={WHITEBOARD_NOTEBOOK_SURFACE}
          onComplete={whiteboardLaunch.onFlightComplete}
        />
      ) : null}
      <PageListRail
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        isPageListOpen={isPageListOpen}
        selectedUnitTitle={selectedUnit?.title}
        pageListNumbers={pageListNumbers}
        isSinglePageMode={isSinglePageMode}
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
      <BookOverlayLeftChrome
        isPageListOpen={isPageListOpen}
        onTogglePageList={togglePageListRail}
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        selectedBookId={selectedBookId}
        isLessonPaperOverlayMode={isLessonPaperOverlayMode}
        suppressChrome={suppressChrome}
        isAnnotationRailVisible={isAnnotationRailVisible}
        setIsAnnotationRailVisible={setIsAnnotationRailVisible}
        annotationMode={annotationMode}
        setAnnotationMode={setAnnotationMode}
        stampVariant={stampVariant}
        setStampVariant={setStampVariant}
        stampQuestionColor={stampQuestionColor}
        setStampQuestionColor={setStampQuestionColor}
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
        selectedUnit={selectedUnit}
        selectedBook={selectedBook}
        setPdfFrom={setPdfFrom}
        setPdfTo={setPdfTo}
        setPdfDialogOpen={setPdfDialogOpen}
        toolbarCaps={toolbarCaps}
        isWhiteboardOpen={isWhiteboardOpen}
        isWhiteboardSessionOpen={isWhiteboardSessionOpen}
        isWhiteboardMinimized={isWhiteboardMinimized}
        onWhiteboardRailClick={handleWhiteboardRailClick}
        whiteboardToolbarButtonRef={whiteboardLaunch.toolbarButtonRef}
        getActiveAnnotationRef={getActiveAnnotationRef}
        translateDockOpen={translateDockOpen}
        onTranslateDockToggle={() => setTranslateDockOpen(!translateDockOpen)}
        onOpenCoachDialog={() => setCoachDialogOpen(true)}
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

      <AnnotationTopOptionsBar
        hasResolvedUnit={hasResolvedUnit}
        suppressChrome={suppressChrome}
        chromePanelsOpen={isPageListOpen}
        annotationMode={annotationMode}
        setAnnotationMode={setAnnotationMode}
        penSwatchId={penSwatchId}
        pickPenSwatch={pickPenSwatch}
        penStrokeProfile={penStrokeProfile}
        penColorSource={penColorSource}
        penCustomHex={penCustomHex}
        pickPenCustomColor={pickPenCustomColor}
        penThicknessStep={penThicknessStep}
        setPenThicknessStep={setPenThicknessStep}
        markerColor={markerColor}
        pickMarkerSwatchColor={pickMarkerSwatchColor}
        markerColorSource={markerColorSource}
        markerCustomHex={markerCustomHex}
        pickMarkerCustomColor={pickMarkerCustomColor}
        shapeStrokeSwatchId={shapeStrokeSwatchId}
        pickShapeStrokeSwatch={pickShapeStrokeSwatch}
        markerThicknessStep={markerThicknessStep}
        setMarkerThicknessStep={setMarkerThicknessStep}
        shapeThicknessStep={shapeThicknessStep}
        setShapeThicknessStep={setShapeThicknessStep}
        textThicknessStep={textThicknessStep}
        setTextThicknessStep={setTextThicknessStep}
        textFontId={textFontId}
        setTextFontId={setTextFontId}
        stickyThicknessStep={stickyThicknessStep}
        setStickyThicknessStep={setStickyThicknessStep}
        stampThicknessStep={stampThicknessStep}
        setStampThicknessStep={setStampThicknessStep}
        eraserPixelThicknessStep={eraserPixelThicknessStep}
        setEraserPixelThicknessStep={setEraserPixelThicknessStep}
        eraserLineThicknessStep={eraserLineThicknessStep}
        setEraserLineThicknessStep={setEraserLineThicknessStep}
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
        textColor={textColor}
        pickTextColor={pickTextColor}
        textVisualStyle={textVisualStyle}
        setTextVisualStyle={setTextVisualStyle}
        textFillColor={textFillColor}
        pickTextFillColor={pickTextFillColor}
        stickyFillColor={stickyFillColor}
        pickStickyFillColor={pickStickyFillColor}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={closeOverlay}
        aria-label="Close book overlay"
        title={`Close book (${SC.closePanelOrBook})`}
        className={cn(
          BOOK_OVERLAY_GLASS_CHROME,
          'pointer-events-auto absolute left-3 top-3 z-[60] h-8 w-8 rounded-2xl border p-0 text-white hover:bg-white/10 hover:text-white/85',
          suppressChrome && 'pointer-events-none invisible opacity-0',
        )}
        aria-hidden={suppressChrome}
      >
        <X className="h-4 w-4" strokeWidth={2} aria-hidden />
      </Button>

      <div
        className={cn(
          'absolute inset-0 flex min-h-0 min-w-0 items-center justify-center transition-[padding] duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[padding] motion-reduce:transition-none',
          lessonPaperLayoutActive && 'pr-[25vw]',
        )}
      >
        <div
          ref={bookStageRef}
          className={cn(
            'relative z-10 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform motion-reduce:transition-none',
            bookStageEnterInstant ? 'transition-none' : 'transition-all duration-[650ms]',
            bookStageEnterVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
            lessonPaperLayoutActive && !isLessonPaperOverlayMode && 'w-full min-w-0 max-w-full',
          )}
          style={{
            transform: isLessonPaperOverlayMode
              ? `translateX(calc(${lessonPaperLayoutActive ? '-12.5vw' : '0px'} + ${lessonPaperPanPx}px))`
              : undefined,
          }}
        >
          <div
            className="relative mx-auto max-w-full shrink-0 will-change-[width,transform]"
            style={{
              width: isLessonPaperSplitView
                ? `min(100%, calc(${BOOK_OVERLAY_VIEWPORT_CONTENT_HEIGHT} * ${readerViewportAspectRatio}))`
                : lessonPaperLayoutActive
                  ? `min(100%, calc(${BOOK_OVERLAY_VIEWPORT_CONTENT_HEIGHT} * ${readerViewportAspectRatio}))`
                  : `min(100vw, calc(${BOOK_OVERLAY_VIEWPORT_CONTENT_HEIGHT} * ${readerViewportAspectRatio}))`,
              maxHeight: BOOK_OVERLAY_VIEWPORT_CONTENT_HEIGHT,
              aspectRatio: readerViewportAspectRatio,
              transition: `width ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1), transform ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          >
        <TopOverlayControls
          hasResolvedUnit={hasResolvedUnit}
          suppressChrome={suppressChrome}
          isPageListOpen={isPageListOpen}
          isWhiteboardExpanded={isWhiteboardOpen}
          interactiveVocabNode={interactiveVocabPack ? <InteractiveVocabReaderShelf pack={interactiveVocabPack} /> : null}
        />

        <div className="absolute inset-0 overflow-visible">
          <BookCanvasStage
            pageAreaRef={pageAreaRef}
            hasCurriculumOrHistory={hasCurriculumOrHistory}
            studentId={studentId}
            loading={loading}
            error={error}
            hasResolvedUnit={hasResolvedUnit}
            pdfReady={pdfReady}
            spreadDisplayScale={spreadDisplayScale}
            ANIMATION_MS={ANIMATION_MS}
            PdfPage={PdfPage}
            selectedUnitFilePath={selectedUnit?.filePath ?? ''}
            makeUnitFileUrl={makeUnitFileUrl}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            isWhiteboardOpen={isWhiteboardSessionOpen}
            isWhiteboardMinimized={isWhiteboardMinimized}
            onExpandWhiteboard={handleExpandWhiteboardAnimated}
            onMinimizeWhiteboard={handleMinimizeWhiteboardAnimated}
            whiteboardPanelAnchorRef={whiteboardLaunch.panelAnchorRef}
            whiteboardPanelObscured={whiteboardLaunch.panelObscured}
            suppressChrome={suppressChrome}
            swapWhiteboardSlotSide={swapWhiteboardSlotSide}
            setWhiteboardSlotSide={setWhiteboardSlotSide}
            applyWhiteboardSlotSide={applyWhiteboardSlotSide}
            registerWhiteboardSlotMotion={registerWhiteboardSlotMotion}
            isSinglePageMode={isSinglePageMode}
            leftPageCaptureRef={leftPageCaptureRef}
            pageNumber={pageNumber}
            spreadPageWidth={layoutSpreadPageWidth}
            spreadGutterPullRatio={spreadGutterPullRatio}
            onPdfPageLoadSuccess={onPdfPageLoadSuccess}
            selectedBookId={selectedBookId}
            selectedUnitId={selectedUnit?.id}
            pageCanvasHeightPx={pageCanvasHeightPx}
            annotationMode={effectiveAnnotationMode}
            eyedropperVariant={eyedropperVariant}
            stampVariant={stampVariant}
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
            textVisualStyle={textVisualStyle}
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
            WHITEBOARD_NOTEBOOK_SURFACE={WHITEBOARD_NOTEBOOK_SURFACE}
            whiteboardStorageKey={whiteboardStorageKey}
            whiteboardSlotSide={whiteboardSlotSide}
            whiteboardLayoutMode={whiteboardLayoutMode}
            whiteboardFloatRect={whiteboardFloatRect}
            floatWhiteboard={floatWhiteboard}
            dockWhiteboardToSlot={dockWhiteboardToSlot}
            forceDockWhiteboard={forceDockWhiteboard}
            commitWhiteboardFloatRect={commitWhiteboardFloatRect}
            whiteboardContentHeightPx={whiteboardContentHeightPx}
            extendWhiteboardRunway={extendWhiteboardRunway}
            createLessonBoardPage={createLessonBoardPage}
            wbAnnRef={wbAnnRef}
            onWhiteboardCaps={onWhiteboardCaps}
            regionSelectOpen={regionSelectOpen}
            setRegionSelectOpen={setRegionSelectOpen}
            runImageCapture={runImageCapture}
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
            wbStrokeOverlayRef={wbStrokeOverlayRef}
            whiteboardStrokeCaptureEnabled={whiteboardStrokeCaptureEnabled}
            whiteboardSessionStoreRef={whiteboardSessionStoreRef}
            whiteboardSessionDoc={whiteboardSessionDoc}
            appendWhiteboardSessionCommand={appendWhiteboardSessionCommand}
            whiteboardSessionUndo={whiteboardSessionUndo}
            whiteboardSessionRedo={whiteboardSessionRedo}
            whiteboardSessionClear={whiteboardSessionClear}
            onWhiteboardOverlayCaps={onWhiteboardOverlayCaps}
            onEyedropperPick={onEyedropperPick}
            spreadTurnGridRef={spreadTurnGridRef}
            turnSlide={turnSlide}
            onTurnSlideComplete={handleTurnSlideComplete}
          />
        </div>

        {notebookUiEnabled ? (
          <BookLessonPaperViewControls
            suppressChrome={suppressChrome}
            isLessonPaperOverlayMode={isLessonPaperOverlayMode}
            lessonPaperViewMode={lessonPaperViewMode}
            setLessonPaperViewMode={setLessonPaperViewMode}
          />
        ) : null}
        <TranslateDock
          open={translateDockOpen}
          onOpenChange={setTranslateDockOpen}
          suppressChrome={suppressChrome}
          pageListOpen={isPageListOpen}
          onOpenNotebook={notebookUiEnabled ? () => setVocabNotebookOpen(true) : undefined}
        />
        {notebookUiEnabled ? (
          <VocabNotebookPanel open={vocabNotebookOpen} onOpenChange={setVocabNotebookOpen} />
        ) : null}
          </div>
          <BookPageNavigation
            hasResolvedUnit={hasResolvedUnit}
            numPages={numPages}
            suppressChrome={suppressChrome}
            visiblePages={visiblePages}
            pageNumber={pageNumber}
            goToAdjacentPage={goToAdjacentPage}
            pageJumpDraft={pageJumpDraft}
            setPageJumpDraft={setPageJumpDraft}
            setPageJumpFocused={setPageJumpFocused}
            spreadRightPage={spreadRightPage}
            isSinglePageMode={isSinglePageMode}
            selectedBook={selectedBook}
            selectedUnit={selectedUnit}
            numberingMode={numberingMode}
            commitPageJump={commitPageJump}
            printedJumpBounds={printedJumpBounds}
            unitPageBounds={unitPageBounds}
          />
        </div>
        {notebookUiEnabled ? (
          <LessonPaperPanel
            hasResolvedUnit={hasResolvedUnit}
            isLessonPaperOpen={isLessonPaperOpen}
            setIsLessonPaperOpen={handleSetLessonPaperOpen}
            lessonPaperSaveState={lessonPaperSaveState}
            notebookEditable={notebookEditable}
            lessonPaperEditVersion={lessonPaperEditVersion}
            lessonPaperHtml={lessonPaperHtml}
            pageNumber={pageNumber}
            notebookReturnPage={notebookReturnPage}
            onGoToNotebookSourcePage={goToNotebookSourcePage}
            onReturnToNotebookCurrentPage={returnToNotebookCurrentPage}
            onStartNotebookNote={handleStartNotebookNote}
            onOpenWhiteboardForCapture={handleOpenWhiteboardForCapture}
            onOpenTranslateDock={handleOpenTranslateDockForVocab}
            applyLessonPaperCommand={applyLessonPaperCommand}
            lessonPaperScrollRef={lessonPaperScrollRef}
            lessonPaperLastPartContextKeyRef={lessonPaperLastPartContextKeyRef}
            selectedUnitTitle={selectedUnit?.title}
            lessonPaperHeader={lessonPaperHeader}
            lessonPaperBreadcrumb={lessonPaperBreadcrumb}
            currentNotebookPageSpanKey={currentNotebookPageSpanKey}
            lessonPaperEditorRef={lessonPaperEditorRef}
            onLessonPaperInput={handleLessonPaperInputWithHtmlSync}
            onLessonPaperPaste={onLessonPaperPaste}
            lessonPaperScrollRunwayPx={lessonPaperScrollRunwayPx}
            ANIMATION_MS={ANIMATION_MS}
          />
        ) : null}
      </div>

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
