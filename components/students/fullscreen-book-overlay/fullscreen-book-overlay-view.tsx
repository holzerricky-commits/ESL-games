'use client'

import { X } from 'lucide-react'
import { InteractiveVocabReaderShelf } from '@/components/books/interactive-vocab-reader-shelf'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OverlayDialogs } from './sections/OverlayDialogs'
import { PageListRail } from './sections/PageListRail'
import { AnnotationRail } from './sections/AnnotationRail'
import { LessonPaperPanel } from './sections/LessonPaperPanel'
import { BookViewport } from './sections/BookViewport'
import { TopOverlayControls } from './sections/TopOverlayControls'
import { WhiteboardHeader } from './sections/WhiteboardHeader'
import { BookCanvasStage } from './sections/BookCanvasStage'
import { BookNotesPanelSection } from './sections/BookNotesPanelSection'
import type { FullscreenBookOverlayViewModel } from './hooks/useFullscreenBookOverlayController'

export function FullscreenBookOverlayView({
  vm,
  onClose,
}: {
  vm: FullscreenBookOverlayViewModel
  onClose: () => void
}) {
  const {
    ANIMATION_MS,
    BOOK_FRAME_ASPECT_RATIO,
    BOOK_FRAME_VIEWPORT_INSET_X,
    BOOK_FRAME_VIEWPORT_INSET_Y,
    BOOK_FRAME_VIEWPORT_WIDTH_RATIO,
    PdfDocument,
    PdfPage,
    PDF_DOCUMENT_OPTIONS,
    WHITEBOARD_NOTEBOOK_SURFACE,
    activePageRowRef,
    annotationMode,
    annotationTargetPage,
    applyLessonPaperCommand,
    bookStageRef,
    captionDialog,
    captionDraft,
    captureBusy,
    captureFormat,
    clearInkOpen,
    clearTargetPage,
    commitPageJump,
    copyLastCaptureToClipboard,
    currentNotebookPageSpanKey,
    eraserLineThicknessStep,
    eraserPixelThicknessStep,
    error,
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
    isNotesOpen,
    isPageListOpen,
    isSinglePageMode,
    isVisible,
    isWhiteboardOpen,
    jpegQuality,
    lessonPaperBreadcrumb,
    lessonPaperDrawTool,
    lessonPaperEditorRef,
    lessonPaperHeader,
    lessonPaperLastPartContextKeyRef,
    lessonPaperMode,
    lessonPaperOverlayDragRef,
    lessonPaperOverlayHostRef,
    lessonPaperOverlayImages,
    lessonPaperOverlayMode,
    lessonPaperOverlayPageNumber,
    lessonPaperOverlaySize,
    lessonPaperPanPx,
    lessonPaperScrollRef,
    lessonPaperScrollRunwayPx,
    lessonPaperViewMode,
    leftPageCaptureRef,
    loading,
    makeUnitFileUrl,
    markerColor,
    markerThicknessStep,
    notesPage,
    numPages,
    numberingMode,
    onDocumentLoadSuccess,
    onLeftAnnotationCaps,
    onLessonPaperInput,
    onLessonPaperPaste,
    onPdfPageLoadSuccess,
    onRightAnnotationCaps,
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
    penColor,
    penThicknessStep,
    printedJumpBounds,
    regionSelectOpen,
    rightPageCaptureRef,
    runImageCapture,
    runPdfPacketExport,
    scheduleLessonPaperEditorFocus,
    selectedBook,
    selectedBookId,
    selectedUnit,
    setAnnotationMode,
    setAnnotationTargetPage,
    setCaptureFormat,
    setCaptionDialog,
    setCaptionDraft,
    setClearInkOpen,
    setEraserLineThicknessStep,
    setEraserPixelThicknessStep,
    setHideChromeForCapture,
    setIsAnnotationRailVisible,
    setIsLessonPaperOpen,
    setIsNotesOpen,
    setIsPageListOpen,
    setIsWhiteboardOpen,
    setJpegQuality,
    setLessonPaperDrawTool,
    setLessonPaperMode,
    setLessonPaperViewMode,
    setMarkerColor,
    setMarkerThicknessStep,
    setNotesPage,
    setPageJumpDraft,
    setPageJumpFocused,
    setPageListScrollRoot,
    setPdfDialogOpen,
    setPdfFrom,
    setPdfTo,
    setPenColor,
    setPenThicknessStep,
    setRegionSelectOpen,
    setStampVariant,
    setWatermarkEnabled,
    setWhiteboardPage,
    flushLessonPaperSaveNow,
    shapeColor,
    shapeStrokeWidthScale,
    showSpreadRightPage,
    spreadDisplayScale,
    spreadGutterOverlayStyle,
    spreadPageWidth,
    spreadRightPage,
    stampScale,
    stampVariant,
    stickyFontSizeNorm,
    strokeColor,
    strokeWidthScale,
    studentId,
    studentName,
    suppressChrome,
    textFontSizeNorm,
    toolbarCaps,
    unitPageBounds,
    unitThumbFileUrl,
    visiblePages,
    watermarkEnabled,
    wbAnnRef,
    wbCaptureRootRef,
    whiteboardPage,
  } = vm

  return (
    <div
      className={`absolute inset-0 z-50 p-0 transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
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
      />
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-[padding] duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[padding] motion-reduce:transition-none',
          isLessonPaperOpen && 'pr-[25vw]',
        )}
      >
        <div
          ref={bookStageRef}
          className={`relative z-10 transition-all duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform motion-reduce:transition-none ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
          style={{
            transform: isLessonPaperOverlayMode
              ? `translateX(calc(${isLessonPaperOpen ? '-12.5vw' : '0px'} + ${lessonPaperPanPx}px))`
              : `translateX(${isLessonPaperOpen ? '-12.5vw' : '0px'})`,
          }}
        >
          <div
            className="relative mx-auto max-w-full shrink-0 will-change-[width,transform]"
            style={{
              width: isLessonPaperSplitView
                ? `min(50vw, calc(100vh * ${BOOK_FRAME_ASPECT_RATIO}))`
                : isLessonPaperOpen
                  ? `calc(75vw / ${BOOK_FRAME_VIEWPORT_WIDTH_RATIO})`
                  : `min(100vw, calc(100vh * ${BOOK_FRAME_ASPECT_RATIO}))`,
              aspectRatio: '1264 / 816',
              transition: `width ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1), transform ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          >
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            if (isLessonPaperOpen) flushLessonPaperSaveNow()
            onClose()
          }}
          aria-label="Close book overlay"
          className="absolute right-2 top-2 z-30 h-9 w-9 rounded-full bg-[var(--card)]/95"
        >
          <X size={16} />
        </Button>

        <TopOverlayControls
          hasResolvedUnit={hasResolvedUnit}
          suppressChrome={suppressChrome}
          numPages={numPages}
          isPageListOpen={isPageListOpen}
          setIsPageListOpen={setIsPageListOpen}
          isNotesOpen={isNotesOpen}
          setIsNotesOpen={setIsNotesOpen}
          isWhiteboardOpen={isWhiteboardOpen}
          setIsWhiteboardOpen={setIsWhiteboardOpen}
          isSinglePageMode={isSinglePageMode}
          pageNumber={pageNumber}
          annotationTargetPage={annotationTargetPage}
          setNotesPage={setNotesPage}
          setWhiteboardPage={setWhiteboardPage}
          isLessonPaperOpen={isLessonPaperOpen}
          setIsLessonPaperOpen={setIsLessonPaperOpen}
          interactiveVocabNode={interactiveVocabPack ? <InteractiveVocabReaderShelf pack={interactiveVocabPack} /> : null}
        />

        {/* eslint-disable-next-line @next/next/no-img-element -- decorative frame asset from local public folder */}
        <img
          src="/Full%20Screen%20Book%20Overlay/Book%20Opened.png"
          alt="Open book frame"
          className="pointer-events-none block h-full w-full select-none object-contain drop-shadow-[0_22px_44px_rgba(0,0,0,0.42)]"
          draggable={false}
        />

        <div
          className="absolute overflow-visible"
          style={{
            left: `${BOOK_FRAME_VIEWPORT_INSET_X * 100}%`,
            right: `${BOOK_FRAME_VIEWPORT_INSET_X * 100}%`,
            top: `${BOOK_FRAME_VIEWPORT_INSET_Y * 100}%`,
            bottom: `${BOOK_FRAME_VIEWPORT_INSET_Y * 100}%`,
          }}
        >
          <WhiteboardHeader
            isWhiteboardOpen={isWhiteboardOpen}
            selectedBookId={selectedBookId}
            numPages={numPages}
            suppressChrome={suppressChrome}
            isSinglePageMode={isSinglePageMode}
            showSpreadRightPage={showSpreadRightPage}
            spreadRightPage={spreadRightPage}
            whiteboardPage={whiteboardPage}
            setWhiteboardPage={setWhiteboardPage}
            pageNumber={pageNumber}
            selectedBook={selectedBook}
            selectedUnit={selectedUnit}
            numberingMode={numberingMode}
            setIsWhiteboardOpen={setIsWhiteboardOpen}
          />
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
            PdfDocument={PdfDocument}
            PdfPage={PdfPage}
            selectedUnitFilePath={selectedUnit?.filePath ?? ''}
            makeUnitFileUrl={makeUnitFileUrl}
            PDF_DOCUMENT_OPTIONS={PDF_DOCUMENT_OPTIONS}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            isWhiteboardOpen={isWhiteboardOpen}
            isSinglePageMode={isSinglePageMode}
            leftPageCaptureRef={leftPageCaptureRef}
            pageNumber={pageNumber}
            spreadPageWidth={spreadPageWidth}
            onPdfPageLoadSuccess={onPdfPageLoadSuccess}
            selectedBookId={selectedBookId}
            selectedUnitId={selectedUnit?.id}
            pageCanvasHeightPx={pageCanvasHeightPx}
            annotationMode={annotationMode}
            stampVariant={stampVariant}
            strokeWidthScale={strokeWidthScale}
            shapeStrokeWidthScale={shapeStrokeWidthScale}
            stampScale={stampScale}
            strokeColor={strokeColor}
            shapeColor={shapeColor}
            textFontSizeNorm={textFontSizeNorm}
            stickyFontSizeNorm={stickyFontSizeNorm}
            setAnnotationTargetPage={setAnnotationTargetPage}
            onLeftAnnotationCaps={onLeftAnnotationCaps}
            showSpreadRightPage={showSpreadRightPage}
            rightPageCaptureRef={rightPageCaptureRef}
            spreadRightPage={spreadRightPage}
            onRightAnnotationCaps={onRightAnnotationCaps}
            spreadGutterOverlayStyle={spreadGutterOverlayStyle}
            wbCaptureRootRef={wbCaptureRootRef}
            WHITEBOARD_NOTEBOOK_SURFACE={WHITEBOARD_NOTEBOOK_SURFACE}
            whiteboardPage={whiteboardPage}
            wbAnnRef={wbAnnRef}
            onWhiteboardCaps={onWhiteboardCaps}
            regionSelectOpen={regionSelectOpen}
            setRegionSelectOpen={setRegionSelectOpen}
            runImageCapture={runImageCapture}
            pdfExporting={pdfExporting}
            pdfProgressLabel={pdfProgressLabel}
            numPages={numPages}
          />
        </div>

        <AnnotationRail
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
          penColor={penColor}
          setPenColor={setPenColor}
          markerColor={markerColor}
          setMarkerColor={setMarkerColor}
          penThicknessStep={penThicknessStep}
          setPenThicknessStep={setPenThicknessStep}
          markerThicknessStep={markerThicknessStep}
          setMarkerThicknessStep={setMarkerThicknessStep}
          eraserPixelThicknessStep={eraserPixelThicknessStep}
          setEraserPixelThicknessStep={setEraserPixelThicknessStep}
          eraserLineThicknessStep={eraserLineThicknessStep}
          setEraserLineThicknessStep={setEraserLineThicknessStep}
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
          getActiveAnnotationRef={getActiveAnnotationRef}
          clearInkOpen={clearInkOpen}
          setClearInkOpen={setClearInkOpen}
          clearTargetPage={clearTargetPage}
        />
        <BookViewport
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
          isLessonPaperOpen={isLessonPaperOpen}
          setIsLessonPaperOpen={setIsLessonPaperOpen}
          isLessonPaperOverlayMode={isLessonPaperOverlayMode}
          lessonPaperViewMode={lessonPaperViewMode}
          setLessonPaperViewMode={setLessonPaperViewMode}
        />
          </div>
        <LessonPaperPanel
          hasResolvedUnit={hasResolvedUnit}
          isLessonPaperOpen={isLessonPaperOpen}
          setIsLessonPaperOpen={setIsLessonPaperOpen}
          lessonPaperMode={lessonPaperMode}
          setLessonPaperMode={setLessonPaperMode}
          scheduleLessonPaperEditorFocus={scheduleLessonPaperEditorFocus}
          lessonPaperDrawTool={lessonPaperDrawTool}
          setLessonPaperDrawTool={setLessonPaperDrawTool}
          applyLessonPaperCommand={applyLessonPaperCommand}
          lessonPaperScrollRef={lessonPaperScrollRef}
          lessonPaperLastPartContextKeyRef={lessonPaperLastPartContextKeyRef}
          selectedUnitTitle={selectedUnit?.title}
          lessonPaperHeader={lessonPaperHeader}
          lessonPaperBreadcrumb={lessonPaperBreadcrumb}
          currentNotebookPageSpanKey={currentNotebookPageSpanKey}
          lessonPaperOverlayHostRef={lessonPaperOverlayHostRef}
          lessonPaperEditorRef={lessonPaperEditorRef}
          onLessonPaperInput={onLessonPaperInput}
          onLessonPaperPaste={onLessonPaperPaste}
          selectedBookId={selectedBookId}
          studentId={studentId}
          selectedUnitId={selectedUnit?.id}
          lessonPaperOverlayPageNumber={lessonPaperOverlayPageNumber}
          lessonPaperOverlaySize={lessonPaperOverlaySize}
          lessonPaperOverlayMode={lessonPaperOverlayMode}
          stampVariant={stampVariant}
          lessonPaperOverlayImages={lessonPaperOverlayImages}
          lessonPaperOverlayDragRef={lessonPaperOverlayDragRef}
          lessonPaperScrollRunwayPx={lessonPaperScrollRunwayPx}
        />
      </div>

      <BookNotesPanelSection
        hasResolvedUnit={hasResolvedUnit}
        numPages={numPages}
        selectedBookId={selectedBookId}
        studentId={studentId}
        selectedUnitId={selectedUnit?.id}
        isNotesOpen={isNotesOpen}
        setIsNotesOpen={setIsNotesOpen}
        notesPage={notesPage}
        setNotesPage={setNotesPage}
        unitPageBoundsMax={unitPageBounds.max}
        pageNumber={pageNumber}
        isSinglePageMode={isSinglePageMode}
      />

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
    </div>
  )
}
