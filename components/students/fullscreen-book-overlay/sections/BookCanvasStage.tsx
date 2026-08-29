'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type {
  ComponentType,
  CSSProperties,
  DragEvent as ReactDragEvent,
  MutableRefObject,
  RefObject,
  TransitionEvent,
} from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { BookCaptureRegionOverlay } from '@/components/students/book-capture-region-overlay'
import {
  BookPageAnnotationLayer,
  type AnnotationCapabilities,
  type BookPageAnnotationHandle,
  type LiveEraserLineDraft,
  type LiveStrokeDraft,
} from '@/components/students/book-page-annotation-layer'
import { BookSpreadStrokeOverlay } from '@/components/students/book-spread-stroke-overlay'
import { BookSpreadPageMarkerLayer } from '@/components/students/book-spread-page-marker-layer'
import { BookSpreadMarkerSpreadOverlay } from '@/components/students/book-spread-marker-spread-overlay'
import { BookSpreadSessionLayer } from '@/components/students/book-spread-session-layer'
import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  patchSelectedInkStrokeCommands,
  patchSelectedShapeCommands,
  patchSelectedStickyCommands,
  patchSelectedTextCommands,
  type InkStrokeSelectionPatch,
  type ShapeSelectionPatch,
} from '@/lib/books/patch-selected-commands'
import { Button } from '@/components/ui/button'
import type { BookReaderDocumentReadyMeta } from '@/components/students/fullscreen-book-overlay/types'
import { useReaderPrefetchCacheRevision } from '@/components/students/fullscreen-book-overlay/hooks/useReaderPrefetchCacheRevision'
import { useReaderZoomSharpPrefetch } from '@/components/students/fullscreen-book-overlay/hooks/useReaderZoomSharpPrefetch'
import { ReaderPageSlot } from '@/components/students/fullscreen-book-overlay/sections/ReaderPageSlot'
import { SpreadStage } from '@/components/students/fullscreen-book-overlay/sections/SpreadStage'
import type { SpreadTurnSlidePayload } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadTurnSlide'
import type { PageViewPoolRenderContext } from '@/components/students/fullscreen-book-overlay/sections/PageViewPool'
import { preloadAllEffectPenResources } from '@/lib/books/effect-pen-preload'
import { DEFAULT_TEXT_FILL_COLOR } from '@/lib/books/annotation-palettes'
import { isQuickStickerInteraction, isWritableStickerInteraction } from '@/lib/books/sticker-tool'
import { StampVariantIndicator } from '@/components/students/stamp-variant-indicator'
import { useStampVariantIndicator } from '@/components/students/hooks/useStampVariantIndicator'
import { notifyStampPlacedFromCommand } from '@/lib/books/notify-stamp-placed'
import { effectiveSpreadGutterPullPx, effectiveSpreadOverlayWidthPx } from '@/lib/books/spread-gutter'
import { SpreadPageCluster } from '@/components/books/spread-page-cluster'
import { BoardPageLinkMarkers } from '@/components/students/fullscreen-book-overlay/sections/BoardPageLinkMarkers'
import { BookAudioPinMarkers } from '@/components/students/fullscreen-book-overlay/sections/BookAudioPinMarkers'
import { BookExerciseBoxDrawOverlay } from '@/components/students/fullscreen-book-overlay/sections/BookExerciseBoxDrawOverlay'
import { BookExerciseTaskMarkers } from '@/components/students/fullscreen-book-overlay/sections/BookExerciseTaskMarkers'
import { ReadingCheckHotspotPlacementLayer, type ReadingCheckLivePin } from '@/components/students/fullscreen-book-overlay/sections/ReadingCheckHotspotPlacementLayer'
import type { LessonBoardPageLink } from '@/lib/books/lesson-board-page-links'
import type { BookAudioPin, BookAudioTrack } from '@/lib/books/book-audio'
import type { BookExerciseTask, PageNormRect } from '@/lib/books/book-exercises'
import { seamClientX } from '@/lib/books/spread-stroke-split'
import { loadCachedPdfDocument, clearPdfLoadCacheForFileUrl } from '@/lib/books/pdf-thumbnail-cache'
import { invalidatePdfPageTextProbeCacheForFileUrl } from '@/lib/books/pdf-page-text-probe'
import { SEARCHABLE_PDF_UPDATED_EVENT } from '@/lib/books/searchable-pdf-events'
import {
  pageHasSelectablePdfText,
  spreadHasSelectablePdfText,
  spreadPdfTextCapabilityPending,
  usePdfPageTextCapability,
} from '@/components/students/fullscreen-book-overlay/hooks/usePdfPageTextCapability'
import {
  bookSpreadHardcoverGutterOnlyForFrameTuning,
  bookSpreadPageArtHiddenForFrameTuning,
  bookPdfTextSelectionEnabled,
  spreadMarkerSpreadOverlayFallbackEnabled,
  spreadSessionEditingEnabled,
  pageViewPoolEnabled,
  inkSessionReactBoundaryEnabled,
} from '@/lib/books/feature-flags'
import { subscribeInkSessionStoreUi } from '@/lib/books/ink-session-store-subscription'
import type { UnitPageBounds } from '@/lib/books/page-range'
import { createSpreadSessionStore } from '@/lib/books/spread-session-store'
import type { SpreadSessionDocument } from '@/lib/books/spread-session-types'
import {
  hydrateSpreadSessionFromOwnerPages,
  mapCommandPageToSpread,
  mergeSpreadSessionPageOwnedFromOwnerPages,
} from '@/lib/books/spread-session-commit'
import { nextCalloutIndex } from '@/components/students/book-page-annotation-layer/helpers'
import { getAnnotationsForPage } from '@/lib/books/annotation-storage'
import { SPREAD_SESSION_FLUSH_EVENT } from '@/lib/books/spread-session-events'
import { INK_SESSION_AUTOSAVE_MS } from '@/lib/books/ink-session-persist-config'
import { flushSpreadSessionDocumentToPageStorage } from '@/lib/books/spread-session-persist'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'
import { useSpreadSessionPersistGuards } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadSessionPersistGuards'
import type { SpreadSessionDomConfig } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadSessionDomInteraction'
import type {
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { commitRotatedAnnotationCommands } from '@/lib/books/annotation-rotation'
import { scaleAnnotationCommandsFromOrientedFrames } from '@/lib/books/annotation-scale'
import { alignSelectedCommands, distributeVerticalSpacingSelectedCommands, type HorizontalAlignAxis } from '@/lib/books/annotation-align'
import type { OrientedSelectionFrame } from '@/lib/books/annotation-select'
import { cn } from '@/lib/utils'
import { InfiniteWhiteboardPanel } from '@/components/students/fullscreen-book-overlay/sections/InfiniteWhiteboardPanel'
import { WHITEBOARD_EYEDROPER_PAGE } from '@/lib/books/whiteboard-storage'
import {
  BOOK_WORKSPACE_RAIL_MOTION_TW,
  WHITEBOARD_CHROME_HEIGHT_PX,
  WHITEBOARD_SLOT_INSET_PX,
} from '@/components/students/fullscreen-book-overlay/constants'
import {
  getLessonBoardActivePage,
  lessonBoardAspectHeightPx,
  lessonBoardLogicalWidthPx,
  lessonBoardUsesSpreadPresentation,
  type LessonBoardPageOrientation,
} from '@/lib/books/lesson-board-types'
import type { WhiteboardSlotMotionApi } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardSlotMotion'
import type {
  WhiteboardLayoutMode,
  WhiteboardSlotSide,
} from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardPlacement'
import { useWhiteboardFloatMotion } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardFloatMotion'
import {
  lessonBoardWidePanelAnchorPx,
  lessonBoardWidePanelHeightPx,
  lessonBoardWideSpreadWidthPx as resolveLessonBoardWideSpreadWidthPx,
} from '@/lib/books/lesson-board-ink-layout'
import {
  defaultLessonBoardFloatRect,
  lessonBoardFloatDisplayMetrics,
  type LessonBoardFloatRect,
} from '@/lib/books/lesson-board-float-layout'
import { BookFocusHoleFrame } from '@/components/students/fullscreen-book-overlay/sections/BookFocusDimOverlay'
import { BookFocusZoomDrawOverlay } from '@/components/students/fullscreen-book-overlay/sections/BookFocusZoomDrawOverlay'
import type { FocusSpreadLayout, SpreadNormRect } from '@/lib/books/focus-zoom-types'
import {
  bookSpreadFrameBookBodyCenterInOuterPx,
  bookSpreadFrameShellPaddingStyle,
  computeBookSpreadFrameOuterBox,
} from '@/lib/books/book-spread-frame-metrics'
import { measuredSpreadScreenScale } from '@/lib/books/focus-zoom-transform'
import { toast } from 'sonner'
import {
  isBoardImageDragEvent,
  preventBoardImageDragDefaults,
  resolveDroppedBoardImage,
} from '@/lib/books/board-image-drop'
import { buildImageCommandFromFile } from '@/lib/books/board-image-commit'
import { boardPasteAnchorFromElementRect } from '@/lib/books/board-paste-placement'
import {
  pasteImageOutcomeToastKind,
  resolvePastedBoardImage,
  resolvePastedBoardImageFromNavigatorClipboard,
  type PastedBoardImageResolution,
  type PasteImageOutcome,
} from '@/lib/books/clipboard-image'
import type { SpreadImagePasteHandle } from '@/components/students/fullscreen-book-overlay/types'
import { registerPasteRevealIds } from '@/lib/books/board-paste-reveal'

interface BookCanvasStageProps {
  pageAreaRef: MutableRefObject<HTMLDivElement | null>
  hasCurriculumOrHistory: boolean
  studentId: string
  loading: boolean
  error: string | null
  hasResolvedUnit: boolean
  pdfReady: boolean
  spreadDisplayScale: number
  /** Frame-aware capped scale — use for CSS transform when open-book chrome is visible. */
  spreadReaderDisplayScale?: number
  /** Ease scale only during the list open/close move — later size ticks must not start a second ease. */
  spreadFitMotionActive?: boolean
  effectiveSpreadScreenScale?: number
  focusZoomDrawActive?: boolean
  focusLayout?: FocusSpreadLayout | null
  pinchSpreadRef?: RefObject<HTMLDivElement | null>
  pinchZoomActive?: boolean
  onFocusDrawCancel?: () => void
  onFocusDrawConfirm?: (rect: SpreadNormRect) => void
  onFocusExit?: () => void
  onFocusPanDelta?: (dx: number, dy: number) => void
  onFocusNewArea?: () => void
  ANIMATION_MS: number
  PdfPage: ComponentType<any>
  selectedUnitFilePath: string
  makeUnitFileUrl: (filePath: string) => string
  onDocumentLoadSuccess: (doc: BookReaderDocumentReadyMeta) => void
  isWhiteboardOpen: boolean
  isWhiteboardMinimized: boolean
  onMinimizeWhiteboard: () => void
  whiteboardPanelAnchorRef: RefObject<HTMLDivElement | null>
  /** In-place open/close fade+scale (no toolbox flight). */
  whiteboardPanelAppearStyle?: CSSProperties
  whiteboardPanelAppearBlocking?: boolean
  onWhiteboardPanelTransitionEnd?: (event: TransitionEvent<HTMLElement>) => void
  suppressChrome: boolean
  swapWhiteboardSlotSide: () => void
  setWhiteboardSlotSide: (side: WhiteboardSlotSide) => void
  applyWhiteboardSlotSide: (side: WhiteboardSlotSide) => void
  registerWhiteboardSlotMotion: (api: WhiteboardSlotMotionApi | null) => void
  /** PDF export only â€” single-page capture layout; does not affect spread ink routing. */
  exportCaptureLayoutActive: boolean
  /** Teacher preference: show hardcover frame (export still force-hides). */
  showBookFrame?: boolean
  leftPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  pageNumber: number
  spreadPageWidth: number
  /** Resolved spread seam overlap (file override â†’ book default â†’ 0.018). */
  spreadGutterPullRatio: number
  onPdfPageLoadSuccess: (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => void
  selectedBookId: string | null
  selectedUnitId?: string
  /** Unit whose lasting board is open (may differ from the PDF unit while browsing). */
  lessonBoardUnitId?: string
  /** Book whose lasting board is open (may differ from the PDF book while browsing). */
  lessonBoardBookId?: string
  boardFooterLabel?: string
  boardBookFullTitle?: string
  boardBookAccentColor?: string
  boardShelf?: import('@/lib/books/lesson-board-nav').LessonBoardShelfEntry[]
  onSelectBoardNotebook?: (next: { bookId: string; unitId: string }) => void
  nextUnitBoard?: { id: string; title: string } | null
  showNextUnitBoardPrompt?: boolean
  onOpenNextUnitBoard?: () => void
  onDismissNextUnitBoardPrompt?: () => void
  pageCanvasHeightPx: number
  annotationMode: any
  /** After finishing a writable sticker, switch to Move (quick stamps stay on stamp). */
  onEnterSelectMode?: () => void
  eyedropperVariant?: import('@/lib/books/eyedropper-variant').EyedropperVariant
  stickerKind?: import('@/lib/books/sticker-tool').StickerKind
  writableStickerVariant?: import('@/lib/books/annotation-command-types').WritableStickerVariant
  stampVariant: any
  stampIndicatorPulseEpoch?: number
  stampQuestionColor: string
  strokeWidthScale: number
  eraserLineStrokeWidthScale: number
  penStrokeWidthScale: number
  shapeStrokeWidthScale: number
  stampScale: number
  strokeColor: string | undefined
  penInkColor: string
  penInkStyle?: import('@/lib/books/pen-ink').PenInkStyle
  penStrokeProfile?: import('@/lib/books/pen-stroke-profile').PenStrokeProfile
  shapeColor: string | undefined
  textColor: string | undefined
  stickyFillColor?: string
  strokeLineDashStyle?: AnnotationLineDashStyle
  markerStraightStroke?: boolean
  markerDecoratedEdge?: boolean
  penAutoGroupConnected?: boolean
  marqueeSelectRule?: import('@/lib/books/annotation-select').MarqueeSelectRule
  shapeLineDashStyle?: AnnotationLineDashStyle
  shapeStrokeEnabled?: boolean
  shapeFillMode?: ShapeFillMode
  shapeFillColor?: string
  shapeRoundedCorners?: boolean
  textFontSizeNorm: number
  textFontId: import('@/lib/books/annotation-text-fonts').AnnotationTextFontId
  textFontWeight?: import('@/lib/books/annotation-text-fonts').AnnotationTextFontWeight
  bookTextVisualStyle?: 'plain' | 'filled'
  textVisualStyle?: 'plain' | 'filled'
  textAlign?: import('@/lib/books/annotation-command-types').TextAnnotationAlign
  textFillColor?: string
  stickyFontSizeNorm: number
  annotationTargetPage: number
  setAnnotationTargetPage: (page: number) => void
  onLeftAnnotationCaps: (caps: AnnotationCapabilities) => void
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  showSpreadRightPage: boolean
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  spreadRightPage: number | null
  onRightAnnotationCaps: (caps: AnnotationCapabilities) => void
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  wbCaptureRootRef: MutableRefObject<HTMLDivElement | null>
  LESSON_BOARD_SURFACE: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'>
  whiteboardStorageKey: string | null
  whiteboardSlotSide: WhiteboardSlotSide
  whiteboardLayoutMode: WhiteboardLayoutMode
  whiteboardFloatRect: LessonBoardFloatRect | null
  floatWhiteboard: (slotLeftPx: number, slotTopPx: number) => void
  dockWhiteboardToSlot: () => void
  forceDockWhiteboard: () => void
  commitWhiteboardFloatRect: (rect: LessonBoardFloatRect) => void
  whiteboardContentHeightPx: number
  ensureWhiteboardRunwayBelowView: (scrollTopPx: number) => void
  createLessonBoardPage?: (orientation: LessonBoardPageOrientation) => void
  saveLessonBoardNow?: () => void
  deleteActiveLessonBoardPage?: () => void
  canDeleteActiveLessonBoardPage?: boolean
  boardLinkPlacementActive?: boolean
  lessonBoardPageLinks?: readonly LessonBoardPageLink[]
  onPlaceBoardLink?: (pdfPage: number, center: [number, number]) => void
  onOpenBoardFromLink?: (link: LessonBoardPageLink) => void
  startBoardLinkPlacement?: () => void
  removeActiveBoardPageLink?: () => void
  activeBoardPageLink?: LessonBoardPageLink | null
  /** Prep mode: keep link-to-book as a header icon. */
  boardLinkInHeader?: boolean
  audioPinPlacementActive?: boolean
  audioPins?: readonly BookAudioPin[]
  audioTracks?: readonly BookAudioTrack[]
  audioPlayingTrackId?: string | null
  audioIsPlaying?: boolean
  onPlaceAudioPin?: (pdfPage: number, center: [number, number]) => void
  onPlayAudioPin?: (pin: BookAudioPin) => void
  onRemoveAudioPin?: (pin: BookAudioPin) => void
  onMoveAudioPin?: (pin: BookAudioPin, pdfPage: number, center: [number, number]) => void
  readingCheckHotspotPlacementActive?: boolean
  onPlaceReadingCheckHotspot?: (pdfPage: number, center: [number, number]) => void
  readingCheckHotspotPreviewPdfPage?: number | null
  readingCheckHotspotPreviewCenter?: [number, number] | null
  readingCheckHotspotPreviewLabel?: string
  onReadingCheckHotspotPreviewClick?: () => void
  readingCheckLivePins?: readonly ReadingCheckLivePin[]
  onReadingCheckLivePinClick?: (stopId: string) => void
  exerciseBoxDrawActive?: boolean
  exerciseTasks?: readonly BookExerciseTask[]
  selectedExerciseTaskId?: string | null
  onPlaceExerciseBox?: (pdfPage: number, rect: PageNormRect) => void
  onCancelExerciseBoxDraw?: () => void
  onSelectExerciseTask?: (task: BookExerciseTask) => void
  onRemoveExerciseTask?: (task: BookExerciseTask) => void
  onMoveExerciseTask?: (task: BookExerciseTask, center: [number, number]) => void
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  onWhiteboardCaps: (caps: AnnotationCapabilities) => void
  regionSelectOpen: boolean
  setRegionSelectOpen: (v: boolean) => void
  runImageCapture: (args: {
    kind: 'full' | 'page' | 'region'
    regionCss?: DOMRect | Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>
  }) => Promise<void>
  captureBusy?: boolean
  pdfExporting: boolean
  pdfProgressLabel: string | null
  numPages: number | null
  /** Sorted visible PDF indices for reader prefetch / page view pool. */
  visiblePages: number[]
  /** Inclusive reader bounds for pool window clamping. */
  readerBounds: UnitPageBounds
  /** Phase 3: spinner over spread until drawable-ready (cache + layout or slot pixels). */
  showSpreadLoadingHold: boolean
  /** Resets slot pixel reporting when open / unit / width bucket / page changes. */
  spreadReportEpoch: number
  /** All visible spread slots reported pixel-ready for the current anchor. */
  onSpreadSlotsPixelsReady?: () => void
  /** When false, slots warm silently and only confirm pixels after the overlay is presented. */
  confirmSpreadSlotPixels?: boolean
  spreadStrokeOverlayRef: MutableRefObject<BookPageAnnotationHandle | null>
  onSpreadOverlayCaps: (caps: AnnotationCapabilities) => void
  spreadStrokeCaptureEnabled: boolean
  onEyedropperPick?: (
    pageNumber: number,
    clientX: number,
    clientY: number,
  ) => void
  spreadTurnGridRef?: MutableRefObject<HTMLDivElement | null>
  turnSlide?: SpreadTurnSlidePayload | null
  onTurnSlideComplete?: () => void
  spreadSessionStoreRef?: MutableRefObject<ReturnType<typeof createSpreadSessionStore> | null>
  /** Filled when spread image paste/drop is available (session mode, board closed). */
  spreadImagePasteRef?: MutableRefObject<SpreadImagePasteHandle | null>
  wbStrokeOverlayRef?: MutableRefObject<BookPageAnnotationHandle | null>
  whiteboardStrokeCaptureEnabled?: boolean
  whiteboardSessionStoreRef?: MutableRefObject<import('@/lib/books/whiteboard-session-store').WhiteboardSessionStore | null>
  whiteboardSelectionMoveClampRef?: MutableRefObject<
    import('@/lib/books/annotation-scale').SelectionMoveClampContext | null
  >
  whiteboardSessionDoc?: import('@/lib/books/whiteboard-session-types').WhiteboardSessionDocument | null
  whiteboardInkRevision?: number
  appendWhiteboardSessionCommand?: (cmd: import('@/lib/books/annotation-command-types').AnnotationCommand) => void
  whiteboardSessionUndo?: () => boolean
  whiteboardSessionRedo?: () => boolean
  whiteboardSessionClear?: () => void
  onWhiteboardOverlayCaps?: (caps: AnnotationCapabilities) => void
  onBookTextSpreadCapabilityChange?: (state: { hasSelectable: boolean; pending: boolean }) => void
  /** Hide object style bar while text-range translate/review is active. */
  hideSelectionContextBar?: boolean
  /** Close rail tool settings when the user starts using a tool on the spread. */
  onAnnotationToolUseOnSpread?: () => void
}

export function BookCanvasStage({
  pageAreaRef,
  hasCurriculumOrHistory,
  studentId,
  loading,
  error,
  hasResolvedUnit,
  pdfReady,
  spreadDisplayScale,
  spreadReaderDisplayScale,
  spreadFitMotionActive = false,
  effectiveSpreadScreenScale,
  focusZoomDrawActive = false,
  focusLayout = null,
  pinchSpreadRef,
  pinchZoomActive = false,
  onFocusDrawCancel,
  onFocusDrawConfirm,
  onFocusExit,
  onFocusPanDelta,
  onFocusNewArea,
  ANIMATION_MS,
  PdfPage,
  selectedUnitFilePath,
  makeUnitFileUrl,
  onDocumentLoadSuccess,
  isWhiteboardOpen,
  isWhiteboardMinimized,
  onMinimizeWhiteboard,
  whiteboardPanelAnchorRef,
  whiteboardPanelAppearStyle,
  whiteboardPanelAppearBlocking = false,
  onWhiteboardPanelTransitionEnd,
  suppressChrome,
  swapWhiteboardSlotSide,
  setWhiteboardSlotSide,
  applyWhiteboardSlotSide,
  registerWhiteboardSlotMotion,
  exportCaptureLayoutActive,
  showBookFrame: preferBookFrame = true,
  leftPageCaptureRef,
  pageNumber,
  spreadPageWidth,
  spreadGutterPullRatio,
  onPdfPageLoadSuccess,
  selectedBookId,
  selectedUnitId,
  lessonBoardUnitId,
  lessonBoardBookId,
  boardFooterLabel,
  boardBookFullTitle,
  boardBookAccentColor,
  boardShelf,
  onSelectBoardNotebook,
  nextUnitBoard = null,
  showNextUnitBoardPrompt = false,
  onOpenNextUnitBoard,
  onDismissNextUnitBoardPrompt,
  pageCanvasHeightPx,
  annotationMode,
  onEnterSelectMode,
  eyedropperVariant = 'sample',
  stickerKind = 'quick',
  writableStickerVariant = 'note',
  stampVariant,
  stampIndicatorPulseEpoch = 0,
  stampQuestionColor,
  strokeWidthScale,
  eraserLineStrokeWidthScale,
  penStrokeWidthScale,
  shapeStrokeWidthScale,
  stampScale,
  strokeColor,
  penInkColor,
  penInkStyle,
  penStrokeProfile,
  shapeColor,
  textColor,
  stickyFillColor = '#fef3c7',
  strokeLineDashStyle = 'solid',
  markerStraightStroke = false,
  markerDecoratedEdge = false,
  penAutoGroupConnected = true,
  marqueeSelectRule = 'follow-drag',
  shapeLineDashStyle = 'solid',
  shapeStrokeEnabled = true,
  shapeFillMode = 'none',
  shapeFillColor = '#eab308',
  shapeRoundedCorners = true,
  textFontSizeNorm,
  textFontId,
  textFontWeight = 'regular',
  bookTextVisualStyle = 'filled',
  textVisualStyle = 'plain',
  textAlign = 'left',
  textFillColor = DEFAULT_TEXT_FILL_COLOR,
  stickyFontSizeNorm,
  annotationTargetPage,
  setAnnotationTargetPage,
  onLeftAnnotationCaps,
  leftAnnRef,
  showSpreadRightPage,
  rightPageCaptureRef,
  spreadRightPage,
  onRightAnnotationCaps,
  rightAnnRef,
  wbCaptureRootRef,
  LESSON_BOARD_SURFACE,
  whiteboardStorageKey,
  whiteboardSlotSide,
  whiteboardLayoutMode,
  whiteboardFloatRect,
  floatWhiteboard,
  dockWhiteboardToSlot,
  forceDockWhiteboard,
  commitWhiteboardFloatRect,
  whiteboardContentHeightPx,
  ensureWhiteboardRunwayBelowView,
  createLessonBoardPage,
  saveLessonBoardNow,
  deleteActiveLessonBoardPage,
  canDeleteActiveLessonBoardPage,
  boardLinkPlacementActive = false,
  lessonBoardPageLinks = [],
  onPlaceBoardLink,
  onOpenBoardFromLink,
  startBoardLinkPlacement,
  removeActiveBoardPageLink,
  activeBoardPageLink = null,
  boardLinkInHeader = false,
  audioPinPlacementActive = false,
  audioPins = [],
  audioTracks = [],
  audioPlayingTrackId = null,
  audioIsPlaying = false,
  onPlaceAudioPin,
  onPlayAudioPin,
  onRemoveAudioPin,
  onMoveAudioPin,
  readingCheckHotspotPlacementActive = false,
  onPlaceReadingCheckHotspot,
  readingCheckHotspotPreviewPdfPage = null,
  readingCheckHotspotPreviewCenter = null,
  readingCheckHotspotPreviewLabel,
  onReadingCheckHotspotPreviewClick,
  readingCheckLivePins = [],
  onReadingCheckLivePinClick,
  exerciseBoxDrawActive = false,
  exerciseTasks = [],
  selectedExerciseTaskId = null,
  onPlaceExerciseBox,
  onCancelExerciseBoxDraw,
  onSelectExerciseTask,
  onRemoveExerciseTask,
  onMoveExerciseTask,
  wbAnnRef,
  onWhiteboardCaps,
  regionSelectOpen,
  setRegionSelectOpen,
  runImageCapture,
  captureBusy = false,
  pdfExporting,
  pdfProgressLabel,
  numPages,
  visiblePages,
  readerBounds,
  showSpreadLoadingHold,
  spreadReportEpoch,
  onSpreadSlotsPixelsReady,
  confirmSpreadSlotPixels = true,
  spreadStrokeOverlayRef,
  onSpreadOverlayCaps,
  spreadStrokeCaptureEnabled,
  onEyedropperPick,
  spreadTurnGridRef,
  turnSlide = null,
  onTurnSlideComplete,
  spreadSessionStoreRef: spreadSessionStoreRefProp,
  spreadImagePasteRef,
  wbStrokeOverlayRef,
  whiteboardStrokeCaptureEnabled = false,
  whiteboardSessionStoreRef,
  whiteboardSelectionMoveClampRef,
  whiteboardSessionDoc = null,
  whiteboardInkRevision = 0,
  appendWhiteboardSessionCommand,
  whiteboardSessionUndo,
  whiteboardSessionRedo,
  whiteboardSessionClear,
  onWhiteboardOverlayCaps,
  onBookTextSpreadCapabilityChange,
  hideSelectionContextBar = false,
  onAnnotationToolUseOnSpread,
}: BookCanvasStageProps) {
  const spreadSessionModeEnabled = spreadSessionEditingEnabled
  const spreadScreenScale =
    effectiveSpreadScreenScale != null && effectiveSpreadScreenScale > 0
      ? effectiveSpreadScreenScale
      : 1
  const focusTransformActive = focusLayout != null
  const readerFitScale =
    spreadReaderDisplayScale != null && spreadReaderDisplayScale > 0
      ? spreadReaderDisplayScale
      : spreadDisplayScale > 0
        ? spreadDisplayScale
        : 1
  const applyResizeScale = !focusTransformActive
  const resizeScaleStyle: CSSProperties | undefined = applyResizeScale
    ? {
        transform: `scale(${readerFitScale})`,
        transformOrigin: 'center center',
      }
    : undefined
  const shapeColorResolved = shapeColor ?? '#111827'

  const eyedropperForPage = useCallback(
    (targetPage: number) =>
      onEyedropperPick
        ? (clientX: number, clientY: number) => onEyedropperPick(targetPage, clientX, clientY)
        : undefined,
    [onEyedropperPick],
  )

  const textColorResolved = textColor ?? '#111827'
  const prefetchRevision = useReaderPrefetchCacheRevision()
  /** Phase 3 â€” see `lib/books/spread-drawable-ready.ts`. */
  const leftSlotPixelsReadyRef = useRef(false)
  const rightSlotPixelsReadyRef = useRef(false)
  const spreadSlotsReportedRef = useRef(false)
  const [spreadSlotsPixelsReady, setSpreadSlotsPixelsReady] = useState(false)

  const [sharedPdf, setSharedPdf] = useState<PDFDocumentProxy | null>(null)
  const [unitPdfLoading, setUnitPdfLoading] = useState(false)
  const [unitPdfError, setUnitPdfError] = useState<string | null>(null)
  const [pdfFileEpoch, setPdfFileEpoch] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onUpdated = (event: Event) => {
      const filePath = (event as CustomEvent<{ filePath?: string }>).detail?.filePath
      if (!filePath || filePath !== selectedUnitFilePath) return
      const fileUrl = makeUnitFileUrl(filePath)
      clearPdfLoadCacheForFileUrl(fileUrl)
      invalidatePdfPageTextProbeCacheForFileUrl(fileUrl)
      setPdfFileEpoch((n) => n + 1)
    }
    window.addEventListener(SEARCHABLE_PDF_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(SEARCHABLE_PDF_UPDATED_EVENT, onUpdated)
  }, [selectedUnitFilePath, makeUnitFileUrl])

  useEffect(() => {
    if (unitPdfError) onSpreadSlotsPixelsReady?.()
  }, [unitPdfError, onSpreadSlotsPixelsReady])

  useEffect(() => {
    if (!selectedBookId) return
    preloadAllEffectPenResources()
  }, [selectedBookId])

  const onDocumentLoadSuccessRef = useRef(onDocumentLoadSuccess)
  onDocumentLoadSuccessRef.current = onDocumentLoadSuccess

  useEffect(() => {
    if (!pdfReady || !selectedUnitFilePath) {
      setSharedPdf(null)
      setUnitPdfLoading(false)
      setUnitPdfError(null)
      return
    }
    const fileUrl = makeUnitFileUrl(selectedUnitFilePath)
    let cancelled = false
    setUnitPdfLoading(true)
    setUnitPdfError(null)
    setSharedPdf(null)
    void loadCachedPdfDocument(fileUrl)
      .then(async (doc) => {
        if (cancelled) return
        let pageAspectRatio: number | undefined
        try {
          const n = doc.numPages
          if (n > 0) {
            const p = Math.min(Math.max(1, pageNumber), n)
            const page = await doc.getPage(p)
            const v = page.getViewport({ scale: 1 })
            const r = v.width / v.height
            if (Number.isFinite(r) && r > 0) pageAspectRatio = r
          }
        } catch {
          /* layout falls back to default aspect until react-pdf reports */
        }
        if (cancelled) return
        onDocumentLoadSuccessRef.current({ numPages: doc.numPages, pageAspectRatio })
        setSharedPdf(doc)
      })
      .catch((e) => {
        if (cancelled) return
        setUnitPdfError(e instanceof Error ? e.message : 'Could not open this PDF unit.')
      })
      .finally(() => {
        if (!cancelled) setUnitPdfLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Intentionally omit `onDocumentLoadSuccess` — use ref so page turns do not reload the PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when unit, worker, or searchable copy changes
  }, [pdfReady, selectedUnitFilePath, makeUnitFileUrl, pdfFileEpoch])

  const tryReportSpreadSlotsPixelsReady = useCallback(() => {
    if (spreadSlotsReportedRef.current) return
    if (exportCaptureLayoutActive) {
      if (!leftSlotPixelsReadyRef.current) return
      spreadSlotsReportedRef.current = true
      setSpreadSlotsPixelsReady(true)
      onSpreadSlotsPixelsReady?.()
      return
    }
    if (!showSpreadRightPage || spreadRightPage == null) {
      if (!leftSlotPixelsReadyRef.current) return
      spreadSlotsReportedRef.current = true
      setSpreadSlotsPixelsReady(true)
      onSpreadSlotsPixelsReady?.()
      return
    }
    if (leftSlotPixelsReadyRef.current && rightSlotPixelsReadyRef.current) {
      spreadSlotsReportedRef.current = true
      setSpreadSlotsPixelsReady(true)
      onSpreadSlotsPixelsReady?.()
    }
  }, [exportCaptureLayoutActive, showSpreadRightPage, spreadRightPage, onSpreadSlotsPixelsReady])

  const handleLeftSlotPixelsReady = useCallback(() => {
    leftSlotPixelsReadyRef.current = true
    tryReportSpreadSlotsPixelsReady()
  }, [tryReportSpreadSlotsPixelsReady])

  const handleRightSlotPixelsReady = useCallback(() => {
    rightSlotPixelsReadyRef.current = true
    tryReportSpreadSlotsPixelsReady()
  }, [tryReportSpreadSlotsPixelsReady])

  useEffect(() => {
    leftSlotPixelsReadyRef.current = false
    rightSlotPixelsReadyRef.current = false
    spreadSlotsReportedRef.current = false
    setSpreadSlotsPixelsReady(false)
  }, [spreadReportEpoch, exportCaptureLayoutActive, pageNumber, spreadRightPage])

  const useStablePageViewPool = pageViewPoolEnabled && selectedUnitId != null

  const handlePoolSlotPixelsReady = useCallback(
    (_readyPage: number, side: 'left' | 'right') => {
      if (side === 'left') {
        leftSlotPixelsReadyRef.current = true
      } else {
        rightSlotPixelsReadyRef.current = true
      }
      tryReportSpreadSlotsPixelsReady()
    },
    [tryReportSpreadSlotsPixelsReady],
  )

  /** Spread pages: side-by-side when overlap is off; slight seam overlap when enabled. */
  const gutterPullPx = effectiveSpreadGutterPullPx(spreadPageWidth, spreadGutterPullRatio)
  const spreadOverlayWidthPx = effectiveSpreadOverlayWidthPx(spreadPageWidth, spreadGutterPullRatio)
  const spreadOverlayHeightPx = pageCanvasHeightPx
  /** Hide hardcover while Focus is active so transform origin matches the page cluster used for the drag box. */
  const showBookFrameInReader =
    preferBookFrame && !exportCaptureLayoutActive && !focusTransformActive
  const readerFrameOuterBox = useMemo(() => {
    if (!showBookFrameInReader) return null
    return computeBookSpreadFrameOuterBox(spreadOverlayWidthPx, pageCanvasHeightPx)
  }, [showBookFrameInReader, spreadOverlayWidthPx, pageCanvasHeightPx])

  /** Center the spread in pageArea (no transform â€” pinch zoom clears transform on page turn). */
  const spreadReaderPositionStyle = useMemo((): CSSProperties | undefined => {
    if (focusTransformActive) return undefined
    if (!(spreadOverlayWidthPx > 0) || !(pageCanvasHeightPx > 0)) return undefined
    if (showBookFrameInReader) {
      const { xPx, yPx } = bookSpreadFrameBookBodyCenterInOuterPx(
        spreadOverlayWidthPx,
        pageCanvasHeightPx,
      )
      return {
        left: `calc(50% - ${xPx}px)`,
        top: `calc(50% - ${yPx}px)`,
      }
    }
    return {
      left: `calc(50% - ${spreadOverlayWidthPx / 2}px)`,
      top: `calc(50% - ${pageCanvasHeightPx / 2}px)`,
    }
  }, [
    focusTransformActive,
    showBookFrameInReader,
    spreadOverlayWidthPx,
    pageCanvasHeightPx,
  ])

  /**
   * Resting page-art box in pageArea (no pinch transform).
   * Board size/position follows this layout slot, not book pinch zoom.
   */
  const lessonBoardHostStyle = useMemo((): CSSProperties | undefined => {
    if (focusTransformActive) return undefined
    if (!(spreadOverlayWidthPx > 0) || !(pageCanvasHeightPx > 0)) return undefined
    if (showBookFrameInReader) {
      const outer = computeBookSpreadFrameOuterBox(spreadOverlayWidthPx, pageCanvasHeightPx)
      const pad = bookSpreadFrameShellPaddingStyle(outer.metrics)
      return {
        left: `calc(50% - ${outer.widthPx / 2}px + ${pad.paddingLeft}px)`,
        top: `calc(50% - ${outer.heightPx / 2}px + ${pad.paddingTop}px)`,
        width: spreadOverlayWidthPx,
        height: pageCanvasHeightPx,
      }
    }
    return {
      left: `calc(50% - ${spreadOverlayWidthPx / 2}px)`,
      top: `calc(50% - ${pageCanvasHeightPx / 2}px)`,
      width: spreadOverlayWidthPx,
      height: pageCanvasHeightPx,
    }
  }, [
    focusTransformActive,
    showBookFrameInReader,
    spreadOverlayWidthPx,
    pageCanvasHeightPx,
  ])

  const whiteboardSessionOpen = isWhiteboardOpen && whiteboardStorageKey != null
  const whiteboardActive = whiteboardSessionOpen && !isWhiteboardMinimized
  const bookPdfTextSelectActive =
    bookPdfTextSelectionEnabled &&
    annotationMode === 'select' &&
    !whiteboardActive &&
    !focusZoomDrawActive &&
    !exerciseBoxDrawActive
  const unitFileUrl = useMemo(
    () => (selectedUnitFilePath ? makeUnitFileUrl(selectedUnitFilePath) : null),
    [selectedUnitFilePath, makeUnitFileUrl],
  )
  const spreadPagesForTextProbe = useMemo(() => {
    const pages = [pageNumber]
    if (showSpreadRightPage && spreadRightPage != null) pages.push(spreadRightPage)
    return pages
  }, [pageNumber, showSpreadRightPage, spreadRightPage])
  const pageTextCapability = usePdfPageTextCapability(
    sharedPdf,
    unitFileUrl,
    spreadPagesForTextProbe,
    bookPdfTextSelectionEnabled,
  )
  const leftPageHasSelectableText = pageHasSelectablePdfText(pageTextCapability, pageNumber)
  const rightPageHasSelectableText =
    spreadRightPage != null && pageHasSelectablePdfText(pageTextCapability, spreadRightPage)

  useEffect(() => {
    onBookTextSpreadCapabilityChange?.({
      hasSelectable: spreadHasSelectablePdfText(
        pageTextCapability,
        pageNumber,
        showSpreadRightPage ? spreadRightPage : null,
      ),
      pending: spreadPdfTextCapabilityPending(
        pageTextCapability,
        pageNumber,
        showSpreadRightPage ? spreadRightPage : null,
      ),
    })
  }, [
    onBookTextSpreadCapabilityChange,
    pageTextCapability,
    pageNumber,
    showSpreadRightPage,
    spreadRightPage,
  ])

  const zoomSharpPrefetchPages = useMemo(() => {
    const pages = [pageNumber]
    if (showSpreadRightPage && spreadRightPage != null) pages.push(spreadRightPage)
    return pages
  }, [pageNumber, showSpreadRightPage, spreadRightPage])

  useReaderZoomSharpPrefetch({
    enabled:
      pdfReady &&
      sharedPdf != null &&
      selectedUnitId != null &&
      unitFileUrl != null &&
      !(spreadPageWidth <= 0),
    fileUrl: unitFileUrl,
    unitId: selectedUnitId,
    spreadPageWidth,
    screenScale: spreadScreenScale,
    visiblePages: zoomSharpPrefetchPages,
  })

  const lessonBoardActivePage = whiteboardSessionDoc
    ? getLessonBoardActivePage(whiteboardSessionDoc.pages, whiteboardSessionDoc.activePageId)
    : null
  const lessonBoardWideActive = lessonBoardUsesSpreadPresentation(
    lessonBoardActivePage?.orientation ?? 'standard',
  )
  const whiteboardWideSpreadPresented = whiteboardActive && lessonBoardWideActive
  const whiteboardStandardActive = whiteboardActive && !lessonBoardWideActive
  /** Clickable when the board is minimized/closed — sit above ink, under an open board. */
  const boardLinkMarkersInteractive =
    !boardLinkPlacementActive &&
    !audioPinPlacementActive &&
    !readingCheckHotspotPlacementActive &&
    !exerciseBoxDrawActive &&
    !whiteboardActive &&
    Boolean(onOpenBoardFromLink)
  const audioPinMarkersInteractive =
    !boardLinkPlacementActive &&
    !audioPinPlacementActive &&
    !readingCheckHotspotPlacementActive &&
    !exerciseBoxDrawActive &&
    !whiteboardActive &&
    Boolean(onPlayAudioPin)
  const exerciseMarkersInteractive =
    !boardLinkPlacementActive &&
    !audioPinPlacementActive &&
    !readingCheckHotspotPlacementActive &&
    !exerciseBoxDrawActive &&
    !whiteboardActive &&
    Boolean(onSelectExerciseTask)
  const readingCheckLivePinsInteractive =
    !boardLinkPlacementActive &&
    !audioPinPlacementActive &&
    !readingCheckHotspotPlacementActive &&
    !exerciseBoxDrawActive &&
    !whiteboardActive &&
    Boolean(onReadingCheckLivePinClick)
  const whiteboardInSlot = whiteboardStandardActive && whiteboardLayoutMode === 'slot'
  const whiteboardFloating =
    whiteboardStandardActive && whiteboardLayoutMode === 'floating'
  const boardOnLeft = whiteboardSlotSide === 'left'
  const whiteboardSlotPanelWidthPx = Math.max(1, spreadPageWidth - WHITEBOARD_SLOT_INSET_PX * 2)
  const whiteboardSlotPanelHeightPx = Math.max(1, pageCanvasHeightPx - WHITEBOARD_SLOT_INSET_PX * 2)
  const wideSpreadLogicalWidthPx = resolveLessonBoardWideSpreadWidthPx(
    spreadOverlayWidthPx,
    WHITEBOARD_SLOT_INSET_PX,
  )
  const widePasteImageSizingWidthPx = wideSpreadLogicalWidthPx
  const widePasteImageSizingViewportHeightPx = lessonBoardAspectHeightPx(
    widePasteImageSizingWidthPx,
    'wide',
  )
  const lessonBoardLogicalCanvasWidthPx = lessonBoardActivePage
    ? lessonBoardLogicalWidthPx(lessonBoardActivePage, {
        slotWidthPx: whiteboardSlotPanelWidthPx,
        spreadWidthPx: wideSpreadLogicalWidthPx,
      })
    : whiteboardSlotPanelWidthPx

  const lessonBoardNaturalPanelWidthPx = lessonBoardWideActive
    ? lessonBoardLogicalCanvasWidthPx
    : whiteboardSlotPanelWidthPx
  const lessonBoardNaturalPanelHeightPx = lessonBoardWideActive
    ? lessonBoardWidePanelHeightPx(
        whiteboardContentHeightPx,
        WHITEBOARD_CHROME_HEIGHT_PX,
      )
    : whiteboardSlotPanelHeightPx
  const lessonBoardWideAnchorPx = lessonBoardWideActive
    ? lessonBoardWidePanelAnchorPx(
        spreadOverlayWidthPx,
        pageCanvasHeightPx,
        lessonBoardNaturalPanelWidthPx,
        lessonBoardNaturalPanelHeightPx,
        WHITEBOARD_SLOT_INSET_PX,
      )
    : null

  const boardSlotLeftPx = boardOnLeft ? 0 : Math.max(0, Math.round(spreadPageWidth - gutterPullPx))
  const slotAnchorLeftPx = boardSlotLeftPx + WHITEBOARD_SLOT_INSET_PX
  const slotAnchorTopPx = WHITEBOARD_SLOT_INSET_PX
  const floatBoundsWidthPx = spreadOverlayWidthPx
  const floatBoundsHeightPx = pageCanvasHeightPx
  const resolvedFloatRect =
    whiteboardFloatRect ??
    defaultLessonBoardFloatRect(slotAnchorLeftPx, slotAnchorTopPx)
  const whiteboardFloatMetrics = whiteboardFloating
    ? lessonBoardFloatDisplayMetrics(
        whiteboardSlotPanelWidthPx,
        whiteboardSlotPanelHeightPx,
        whiteboardContentHeightPx,
        resolvedFloatRect.scale,
        WHITEBOARD_CHROME_HEIGHT_PX,
      )
    : null

  useEffect(() => {
    if (lessonBoardWideActive && whiteboardLayoutMode === 'floating') {
      forceDockWhiteboard()
    }
  }, [forceDockWhiteboard, lessonBoardWideActive, whiteboardLayoutMode])

  const {
    onFloatDragPointerDown,
    onFloatDragPointerMove,
    onFloatDragPointerUp,
    onFloatDragPointerCancel,
    onFloatResizePointerDown,
    onFloatResizePointerMove,
    onFloatResizePointerUp,
    onFloatResizePointerCancel,
  } = useWhiteboardFloatMotion({
    rect: resolvedFloatRect,
    naturalWidthPx: whiteboardSlotPanelWidthPx,
    naturalHeightPx: whiteboardSlotPanelHeightPx,
    boundsWidthPx: floatBoundsWidthPx,
    boundsHeightPx: floatBoundsHeightPx,
    enabled: whiteboardFloating,
    onCommitRect: commitWhiteboardFloatRect,
  })

  const whiteboardPanelWidthPx =
    whiteboardFloatMetrics?.panelWidthPx ?? lessonBoardNaturalPanelWidthPx
  const whiteboardPanelHeightPx =
    whiteboardFloatMetrics?.panelHeightPx ?? lessonBoardNaturalPanelHeightPx

  const handleFloatWhiteboard = useCallback(() => {
    floatWhiteboard(slotAnchorLeftPx, slotAnchorTopPx)
  }, [floatWhiteboard, slotAnchorLeftPx, slotAnchorTopPx])

  const renderWhiteboardPanel = () => {
    const boardBookId = lessonBoardBookId ?? selectedBookId
    const boardUnitId = lessonBoardUnitId ?? selectedUnitId
    if (!whiteboardStorageKey || !boardBookId || !boardUnitId) return null
    return (
      <InfiniteWhiteboardPanel
        key={`lesson-session-whiteboard-${boardBookId}-${boardUnitId}`}
        studentId={studentId}
        bookId={boardBookId}
        unitId={boardUnitId}
        widthPx={whiteboardPanelWidthPx}
        logicalCanvasWidthPx={lessonBoardLogicalCanvasWidthPx}
        widePasteImageSizingWidthPx={widePasteImageSizingWidthPx}
        widePasteImageSizingViewportHeightPx={widePasteImageSizingViewportHeightPx}
        viewportHeightPx={whiteboardPanelHeightPx}
        contentHeightPx={whiteboardContentHeightPx}
        storagePageKey={whiteboardStorageKey}
        surfaceStyle={LESSON_BOARD_SURFACE}
        slotSide={whiteboardSlotSide}
        layoutMode={whiteboardLayoutMode}
        floatDisplayContentHeightPx={whiteboardFloatMetrics?.displayContentHeightPx}
        onFloat={whiteboardLayoutMode === 'slot' ? handleFloatWhiteboard : undefined}
        onDock={whiteboardLayoutMode === 'floating' ? dockWhiteboardToSlot : undefined}
        onFloatDragPointerDown={onFloatDragPointerDown}
        onFloatDragPointerMove={onFloatDragPointerMove}
        onFloatDragPointerUp={onFloatDragPointerUp}
        onFloatDragPointerCancel={onFloatDragPointerCancel}
        onFloatResizePointerDown={onFloatResizePointerDown}
        onFloatResizePointerMove={onFloatResizePointerMove}
        onFloatResizePointerUp={onFloatResizePointerUp}
        onFloatResizePointerCancel={onFloatResizePointerCancel}
        wbAnnRef={wbAnnRef}
        wbStrokeOverlayRef={wbStrokeOverlayRef}
        whiteboardSessionStoreRef={whiteboardSessionStoreRef}
        selectionMoveClampRef={whiteboardSelectionMoveClampRef}
        whiteboardSessionDoc={whiteboardSessionDoc}
        whiteboardInkRevision={whiteboardInkRevision}
        appendWhiteboardSessionCommand={appendWhiteboardSessionCommand}
        whiteboardSessionUndo={whiteboardSessionUndo}
        whiteboardSessionRedo={whiteboardSessionRedo}
        whiteboardSessionClear={whiteboardSessionClear}
        wbStrokeCaptureEnabled={whiteboardStrokeCaptureEnabled}
        onWhiteboardOverlayCaps={onWhiteboardOverlayCaps}
        captureRootRef={wbCaptureRootRef}
        onCapabilitiesChange={onWhiteboardCaps}
        onEnsureRunwayBelowView={ensureWhiteboardRunwayBelowView}
        onNewLessonBoardPage={createLessonBoardPage}
        onSaveLessonBoard={saveLessonBoardNow}
        onDeleteLessonBoardPage={deleteActiveLessonBoardPage}
        canDeleteLessonBoardPage={canDeleteActiveLessonBoardPage}
        onStartBoardLinkPlacement={startBoardLinkPlacement}
        onRemoveBoardLink={removeActiveBoardPageLink}
        activeBoardPageLinkPdfPage={activeBoardPageLink?.pdfPage ?? null}
        boardLinkPlacementActive={boardLinkPlacementActive}
        boardLinkInHeader={boardLinkInHeader}
        boardFooterLabel={boardFooterLabel}
        boardBookFullTitle={boardBookFullTitle}
        boardBookAccentColor={boardBookAccentColor}
        boardShelf={boardShelf}
        onSelectBoardNotebook={onSelectBoardNotebook}
        nextUnitBoard={nextUnitBoard}
        showNextUnitBoardPrompt={showNextUnitBoardPrompt}
        onOpenNextUnitBoard={onOpenNextUnitBoard}
        onDismissNextUnitBoardPrompt={onDismissNextUnitBoardPrompt}
        readerBookPageNumber={pageNumber}
        hideSelectionContextBar={hideSelectionContextBar}
        setSlotSide={applyWhiteboardSlotSide}
        slotTravelPx={Math.max(0, Math.round(spreadPageWidth - gutterPullPx))}
        registerSlotMotion={registerWhiteboardSlotMotion}
        onMinimize={onMinimizeWhiteboard}
        suppressChrome={suppressChrome}
        deferHeaderChromeActions={whiteboardPanelAppearBlocking}
        mode={annotationMode}
        onEnterSelectMode={onEnterSelectMode}
        eyedropperVariant={eyedropperVariant}
        stickerKind={stickerKind}
        writableStickerVariant={writableStickerVariant}
        stampVariant={stampVariant}
        stampQuestionColor={stampQuestionColor}
        strokeWidthScale={strokeWidthScale}
        eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
        penStrokeWidthScale={penStrokeWidthScale}
        shapeStrokeWidthScale={shapeStrokeWidthScale}
        stampScale={stampScale}
        strokeColor={strokeColor}
        penInkColor={penInkColor}
        penInkStyle={penInkStyle}
        penStrokeProfile={penStrokeProfile}
        strokeLineDashStyle={strokeLineDashStyle}
        markerStraightStroke={markerStraightStroke}
        markerDecoratedEdge={markerDecoratedEdge}
        penAutoGroupConnected={penAutoGroupConnected}
        marqueeSelectRule={marqueeSelectRule}
        shapeColor={shapeColorResolved}
        textColor={textColorResolved}
        shapeLineDashStyle={shapeLineDashStyle}
        shapeStrokeEnabled={shapeStrokeEnabled}
        shapeFillMode={shapeFillMode}
        shapeFillColor={shapeFillColor}
        shapeRoundedCorners={shapeRoundedCorners}
        textFontSizeNorm={textFontSizeNorm}
        textFontId={textFontId}
        textFontWeight={textFontWeight}
        textVisualStyle={textVisualStyle}
        textAlign={textAlign}
        textFillColor={textFillColor}
        stickyFillColor={stickyFillColor}
        stickyFontSizeNorm={stickyFontSizeNorm}
        defaultStickyWNorm={0.22}
        defaultStickyHNorm={0.11}
        onEyedropperPick={(clientX, clientY) =>
          onEyedropperPick?.(WHITEBOARD_EYEDROPER_PAGE, clientX, clientY)
        }
      />
    )
  }

  const renderWhiteboardWideSpreadOverlay = () => {
    if (!whiteboardWideSpreadPresented || !lessonBoardWideAnchorPx) return null
    return (
      <div className="pointer-events-none absolute inset-0 z-[38]">
        <div
          ref={whiteboardPanelAnchorRef}
          className={cn(
            'pointer-events-auto absolute',
            whiteboardPanelAppearBlocking && 'pointer-events-none',
          )}
          style={{
            left: lessonBoardWideAnchorPx.leftPx,
            top: lessonBoardWideAnchorPx.topPx,
            ...whiteboardPanelAppearStyle,
          }}
          onTransitionEnd={onWhiteboardPanelTransitionEnd}
        >
          {renderWhiteboardPanel()}
        </div>
      </div>
    )
  }

  const renderWhiteboardStandardAnchor = () => {
    if (!whiteboardStandardActive) return null

    if (whiteboardFloating && whiteboardFloatMetrics) {
      return (
        <div className="pointer-events-none absolute inset-0 isolate z-[38] overflow-visible">
          <div
            ref={whiteboardPanelAnchorRef}
            className={cn(
              'pointer-events-auto absolute',
              whiteboardPanelAppearBlocking && 'pointer-events-none',
            )}
            style={{
              left: resolvedFloatRect.leftPx,
              top: resolvedFloatRect.topPx,
              width: whiteboardFloatMetrics.panelWidthPx,
              height: whiteboardFloatMetrics.panelHeightPx,
              ...whiteboardPanelAppearStyle,
            }}
            onTransitionEnd={onWhiteboardPanelTransitionEnd}
          >
            {renderWhiteboardPanel()}
          </div>
        </div>
      )
    }

    if (!whiteboardInSlot) return null

    return (
      <div
        ref={whiteboardPanelAnchorRef}
        className="pointer-events-none absolute isolate z-[38] overflow-visible"
        style={{
          left: slotAnchorLeftPx,
          top: slotAnchorTopPx,
          width: whiteboardSlotPanelWidthPx,
          height: whiteboardSlotPanelHeightPx,
          ...whiteboardPanelAppearStyle,
        }}
        onTransitionEnd={onWhiteboardPanelTransitionEnd}
      >
        <div
          className={cn(
            'h-full w-full',
            whiteboardPanelAppearBlocking ? 'pointer-events-none' : 'pointer-events-auto',
          )}
        >
          {renderWhiteboardPanel()}
        </div>
      </div>
    )
  }

  const localSpreadGridRef = useRef<HTMLDivElement | null>(null)
  const spreadGridRef = spreadTurnGridRef ?? localSpreadGridRef
  const [leftPenInkPatternOriginXPx, setLeftPenInkPatternOriginXPx] = useState(0)
  const [rightPenInkPatternOriginXPx, setRightPenInkPatternOriginXPx] = useState(0)
  const [spreadSeamNormX, setSpreadSeamNormX] = useState(0.5)
  const localSpreadSessionStoreRef = useRef<ReturnType<typeof createSpreadSessionStore> | null>(null)
  const spreadSessionStoreRef = spreadSessionStoreRefProp ?? localSpreadSessionStoreRef
  const [spreadEraserLineDraft, setSpreadEraserLineDraft] = useState<LiveEraserLineDraft | null>(null)
  const [spreadMarkerStrokeDraft, setSpreadMarkerStrokeDraft] = useState<LiveStrokeDraft | null>(null)
  const [spreadSessionDoc, setSpreadSessionDoc] = useState<SpreadSessionDocument | null>(null)
  const spreadSessionDocRef = useRef<SpreadSessionDocument | null>(null)
  const [spreadSessionReady, setSpreadSessionReady] = useState(false)
  const [spreadSessionRevision, setSpreadSessionRevision] = useState(0)
  const [spreadSessionSelectedIds, setSpreadSessionSelectedIds] = useState<string[]>([])
  const [spreadImageDragActive, setSpreadImageDragActive] = useState(false)
  const [spreadSessionNudgePreview, setSpreadSessionNudgePreview] = useState<{
    dx: number
    dy: number
  } | null>(null)
  const spreadSessionKeyRef = useRef<{ leftPage: number; rightPage: number } | null>(null)
  const spreadSelectionMoveClampRef = useRef({ widthPx: 0, heightPx: 0 })
  spreadSelectionMoveClampRef.current = {
    widthPx: spreadOverlayWidthPx,
    heightPx: spreadOverlayHeightPx,
  }
  const spreadInkLayoutRef = useRef<SpreadInkLayout>({
    spreadOverlayWidthPx: 0,
    spreadPageWidthPx: 0,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 0,
    seamNormX: 0.5,
  })
  spreadInkLayoutRef.current = {
    spreadOverlayWidthPx,
    spreadPageWidthPx: spreadPageWidth,
    leftPageOriginXPx: leftPenInkPatternOriginXPx,
    rightPageOriginXPx: rightPenInkPatternOriginXPx,
    seamNormX: spreadSeamNormX,
  }

  const spreadInkLayout = useMemo<SpreadInkLayout>(
    () => ({
      spreadOverlayWidthPx,
      spreadPageWidthPx: spreadPageWidth,
      leftPageOriginXPx: leftPenInkPatternOriginXPx,
      rightPageOriginXPx: rightPenInkPatternOriginXPx,
      seamNormX: spreadSeamNormX,
    }),
    [
      spreadOverlayWidthPx,
      spreadPageWidth,
      leftPenInkPatternOriginXPx,
      rightPenInkPatternOriginXPx,
      spreadSeamNormX,
    ],
  )

  const [spreadInkLayoutRevision, setSpreadInkLayoutRevision] = useState(0)

  const spreadSessionActive = useMemo(
    () =>
      Boolean(
        spreadSessionModeEnabled &&
          selectedBookId &&
          selectedUnitId,
      ),
    [selectedBookId, selectedUnitId, spreadSessionModeEnabled],
  )

  const sessionRightPage = spreadRightPage ?? pageNumber

  const measurePenInkPatternOrigins = useCallback(() => {
    const spread = spreadGridRef.current?.getBoundingClientRect()
    const left = leftPageCaptureRef.current?.getBoundingClientRect()
    const right = rightPageCaptureRef.current?.getBoundingClientRect()
    if (!spread || !(spreadOverlayWidthPx > 0)) return
    const scale = measuredSpreadScreenScale(spread, spreadOverlayWidthPx, spreadScreenScale)
    if (left) setLeftPenInkPatternOriginXPx((left.left - spread.left) / scale)
    if (right) {
      setRightPenInkPatternOriginXPx((right.left - spread.left) / scale)
    }
    // Seam needs both page boxes; either slot can be missing for a frame during mount/turn.
    if (left && right) {
      const seamClient = seamClientX(left, right)
      setSpreadSeamNormX((seamClient - spread.left) / scale / spreadOverlayWidthPx)
    } else if (left) {
      const syntheticRightOrigin = spreadPageWidth - gutterPullPx
      setRightPenInkPatternOriginXPx(syntheticRightOrigin)
      setSpreadSeamNormX(Math.max(0, Math.min(1, syntheticRightOrigin / spreadOverlayWidthPx)))
    }
    setSpreadInkLayoutRevision((r) => r + 1)
  }, [
    gutterPullPx,
    leftPageCaptureRef,
    rightPageCaptureRef,
    spreadScreenScale,
    spreadOverlayWidthPx,
    spreadPageWidth,
  ])

  useLayoutEffect(() => {
    if (exportCaptureLayoutActive) {
      setLeftPenInkPatternOriginXPx(0)
      setRightPenInkPatternOriginXPx(0)
      setSpreadSeamNormX(0.5)
      return
    }
    measurePenInkPatternOrigins()
    const grid = spreadGridRef.current
    if (!grid) return
    const ro = new ResizeObserver(() => measurePenInkPatternOrigins())
    ro.observe(grid)
    window.addEventListener('resize', measurePenInkPatternOrigins)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measurePenInkPatternOrigins)
    }
  }, [
    exportCaptureLayoutActive,
    measurePenInkPatternOrigins,
    spreadPageWidth,
    pageCanvasHeightPx,
    spreadScreenScale,
    focusLayout,
    showSpreadRightPage,
    spreadRightPage,
    pageNumber,
  ])

  /** Re-measure pen/marker pattern origins after focus transform applies. */
  useLayoutEffect(() => {
    if (!focusTransformActive) return
    measurePenInkPatternOrigins()
    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      measurePenInkPatternOrigins()
      innerRaf = requestAnimationFrame(measurePenInkPatternOrigins)
    })
    return () => {
      cancelAnimationFrame(outerRaf)
      if (innerRaf) cancelAnimationFrame(innerRaf)
    }
  }, [
    focusLayout,
    focusTransformActive,
    measurePenInkPatternOrigins,
  ])

  const flushSpreadSessionToPageStorage = useCallback(
    (overridePages?: { leftPage: number; rightPage: number }) => {
      const store = spreadSessionStoreRef.current
      const doc = spreadSessionDocRef.current
      const pages =
        overridePages ??
        spreadSessionKeyRef.current ??
        (spreadRightPage != null
          ? { leftPage: pageNumber, rightPage: spreadRightPage }
          : { leftPage: pageNumber, rightPage: pageNumber })
      if (!doc || !selectedBookId || !selectedUnitId || !pages) return
      flushSpreadSessionDocumentToPageStorage({
        doc,
        key: pages,
        layout: spreadInkLayoutRef.current,
        studentId,
        bookId: selectedBookId,
        unitId: selectedUnitId,
      })
      store?.markClean()
      store?.checkpointNow()
    },
    [pageNumber, selectedBookId, selectedUnitId, spreadRightPage, studentId],
  )

  const checkpointSpreadSession = useCallback(() => {
    spreadSessionStoreRef.current?.checkpointNow()
  }, [])

  useEffect(() => {
    const onFlush = () => flushSpreadSessionToPageStorage()
    window.addEventListener(SPREAD_SESSION_FLUSH_EVENT, onFlush)
    return () => window.removeEventListener(SPREAD_SESSION_FLUSH_EVENT, onFlush)
  }, [flushSpreadSessionToPageStorage])

  useSpreadSessionPersistGuards({
    enabled: spreadSessionActive,
    checkpointSpreadSession,
    flushSpreadSessionToPages: flushSpreadSessionToPageStorage,
  })

  useEffect(() => {
    if (!spreadSessionActive || !selectedBookId || !selectedUnitId) {
      if (!inkSessionReactBoundaryEnabled) setSpreadSessionDoc(null)
      spreadSessionDocRef.current = null
      setSpreadSessionReady(false)
      setSpreadSessionRevision(0)
      setSpreadSessionSelectedIds([])
      spreadSessionKeyRef.current = null
      return
    }

    const resolvedRightPage = spreadRightPage ?? pageNumber

    const store = createSpreadSessionStore(
      {
        studentId,
        bookId: selectedBookId,
        unitId: selectedUnitId,
        leftPage: pageNumber,
        rightPage: resolvedRightPage,
      },
      {
        autosaveMs: INK_SESSION_AUTOSAVE_MS,
        getSelectionMoveClamp: () => {
          const { widthPx, heightPx } = spreadSelectionMoveClampRef.current
          if (!(widthPx > 0) || !(heightPx > 0)) return null
          return { widthPx, heightPx }
        },
      },
    )
    spreadSessionStoreRef.current = store
    spreadSessionKeyRef.current = { leftPage: pageNumber, rightPage: resolvedRightPage }

    const layout = spreadInkLayoutRef.current
    const leftStored = getAnnotationsForPage(studentId, selectedBookId, selectedUnitId, pageNumber, 'pdf')
    const rightStored =
      spreadRightPage != null
        ? getAnnotationsForPage(
            studentId,
            selectedBookId,
            selectedUnitId,
            spreadRightPage,
            'pdf',
          )
        : []
    const initialCommands = store.getState().doc.commands
    let commands =
      initialCommands.length === 0
        ? hydrateSpreadSessionFromOwnerPages(leftStored, rightStored, layout)
        : mergeSpreadSessionPageOwnedFromOwnerPages(
            initialCommands,
            leftStored,
            rightStored,
            layout,
          )
    store.syncCommands(commands)
    store.markClean()
    store.checkpointNow()
    const initialState = store.getState()
    if (inkSessionReactBoundaryEnabled) {
      spreadSessionDocRef.current = initialState.doc
      setSpreadSessionReady(true)
      setSpreadSessionRevision(initialState.doc.meta.revision)
      setSpreadSessionSelectedIds(initialState.selectedIds)
      setSpreadSessionNudgePreview(initialState.nudgePreview)
    } else {
      setSpreadSessionDoc(initialState.doc)
      spreadSessionDocRef.current = initialState.doc
      setSpreadSessionSelectedIds(initialState.selectedIds)
      setSpreadSessionNudgePreview(initialState.nudgePreview)
    }
    let lastOverlayCaps = {
      canUndo: initialState.canUndo,
      canRedo: initialState.canRedo,
    }
    const unsub = inkSessionReactBoundaryEnabled
      ? subscribeInkSessionStoreUi(store, spreadSessionDocRef, (snap) => {
          setSpreadSessionRevision(snap.revision)
          setSpreadSessionSelectedIds([...snap.selectedIds])
          setSpreadSessionNudgePreview(snap.nudgePreview)
          if (
            snap.canUndo !== lastOverlayCaps.canUndo ||
            snap.canRedo !== lastOverlayCaps.canRedo
          ) {
            lastOverlayCaps = { canUndo: snap.canUndo, canRedo: snap.canRedo }
            onSpreadOverlayCaps(lastOverlayCaps)
          }
        })
      : store.subscribe((state) => {
          setSpreadSessionDoc(state.doc)
          spreadSessionDocRef.current = state.doc
          setSpreadSessionSelectedIds(state.selectedIds)
          setSpreadSessionNudgePreview(state.nudgePreview)
          if (
            state.canUndo !== lastOverlayCaps.canUndo ||
            state.canRedo !== lastOverlayCaps.canRedo
          ) {
            lastOverlayCaps = { canUndo: state.canUndo, canRedo: state.canRedo }
            onSpreadOverlayCaps(lastOverlayCaps)
          }
        })
    return () => {
      unsub()
      const doc = spreadSessionDocRef.current
      const pages = spreadSessionKeyRef.current
      if (doc && pages) {
        store.checkpointNow()
        flushSpreadSessionDocumentToPageStorage({
          doc,
          key: pages,
          layout: spreadInkLayoutRef.current,
          studentId,
          bookId: selectedBookId,
          unitId: selectedUnitId,
        })
      }
      store.destroy()
      if (spreadSessionStoreRef.current === store) spreadSessionStoreRef.current = null
      spreadSessionDocRef.current = null
      spreadSessionKeyRef.current = null
      setSpreadSessionReady(false)
      setSpreadSessionRevision(0)
      setSpreadEraserLineDraft(null)
    }
  }, [
    onSpreadOverlayCaps,
    pageNumber,
    selectedBookId,
    selectedUnitId,
    spreadRightPage,
    spreadSessionActive,
    spreadSessionStoreRef,
    studentId,
  ])

  const appendSpreadSessionCommand = useCallback(
    (cmd: AnnotationCommand) => {
      const store = spreadSessionStoreRef.current
      if (!store) return
      if (cmd.kind === 'stroke' && cmd.tool === 'eraser-line') {
        store.commitEraserLine(cmd.points, cmd.widthScale)
        return
      }
      if (penAutoGroupConnected && cmd.kind === 'stroke' && cmd.tool === 'pen') {
        store.appendPenWithAutoGroup(cmd, {
          penAutoGroupConnected: true,
          widthPx: spreadOverlayWidthPx,
          heightPx: spreadOverlayHeightPx,
        })
        return
      }
      store.appendCommand(cmd)
    },
    [penAutoGroupConnected, spreadOverlayHeightPx, spreadOverlayWidthPx],
  )

  const spreadSessionUndo = useCallback(() => spreadSessionStoreRef.current?.undo() ?? false, [])

  const spreadSessionRedo = useCallback(() => spreadSessionStoreRef.current?.redo() ?? false, [])

  const spreadSessionClear = useCallback(() => {
    spreadSessionStoreRef.current?.clearCommands()
  }, [])

  const spreadInkDelegated =
    spreadSessionModeEnabled &&
    !whiteboardActive &&
    !exportCaptureLayoutActive &&
    selectedBookId != null &&
    selectedUnitId != null

  const spreadSessionLive = inkSessionReactBoundaryEnabled
    ? spreadSessionReady
    : spreadSessionDoc != null

  const spreadImageDropEnabled =
    spreadInkDelegated && spreadSessionLive && !whiteboardActive

  const commitSpreadImageFromResolution = useCallback(
    async (
      resolution: PastedBoardImageResolution,
      anchorNorm: { x: number; y: number } | null,
    ): Promise<PasteImageOutcome> => {
      const built = await buildImageCommandFromFile(resolution, {
        widthPx: spreadOverlayWidthPx,
        heightPx: spreadOverlayHeightPx,
        viewportHeightPx: spreadOverlayHeightPx,
        scrollTopPx: 0,
        anchorNorm,
      })
      if (!built) {
        return { ok: false }
      }
      appendSpreadSessionCommand(built.cmd)
      spreadSessionStoreRef.current?.setSelectedIds([built.cmd.id])
      registerPasteRevealIds([built.cmd.id])
      onEnterSelectMode?.()
      return built.outcome
    },
    [
      appendSpreadSessionCommand,
      onEnterSelectMode,
      spreadOverlayHeightPx,
      spreadOverlayWidthPx,
      spreadSessionStoreRef,
    ],
  )

  const commitSpreadImageDrop = useCallback(
    (clientX: number, clientY: number, dataTransfer: DataTransfer) => {
      const anchorRect =
        spreadGridRef.current?.getBoundingClientRect() ??
        pageAreaRef.current?.getBoundingClientRect()
      if (!anchorRect) return

      const anchorNorm = boardPasteAnchorFromElementRect(clientX, clientY, anchorRect)
      void resolveDroppedBoardImage(dataTransfer).then(async (resolution) => {
        if (!resolution) {
          toast.error('Only pictures (PNG, JPEG, GIF, WebP) can be dropped here.')
          return
        }
        const outcome = await commitSpreadImageFromResolution(resolution, anchorNorm)
        if (!outcome.ok) {
          toast.error('Could not add that picture â€” try a smaller file.')
          return
        }
        const kind = pasteImageOutcomeToastKind(outcome)
        toast.success(kind === 'gif' ? 'GIF added to book' : 'Picture added to book')
      })
    },
    [commitSpreadImageFromResolution, pageAreaRef, spreadGridRef],
  )

  useEffect(() => {
    if (!spreadImagePasteRef) return
    if (!spreadImageDropEnabled) {
      spreadImagePasteRef.current = null
      return
    }
    spreadImagePasteRef.current = {
      pasteImageFromSystemClipboard: async () => {
        const resolution = await resolvePastedBoardImageFromNavigatorClipboard()
        if (!resolution) {
          return { ok: false }
        }
        const outcome = await commitSpreadImageFromResolution(resolution, { x: 0.5, y: 0.5 })
        if (outcome.ok) {
          const kind = pasteImageOutcomeToastKind(outcome)
          toast.success(kind === 'gif' ? 'GIF added to book' : 'Picture added to book')
        } else {
          toast.error('Could not add that picture â€” try a smaller file.')
        }
        return outcome
      },
    }
    return () => {
      spreadImagePasteRef.current = null
    }
  }, [commitSpreadImageFromResolution, spreadImageDropEnabled, spreadImagePasteRef])

  const handleSpreadImageDrop = useCallback(
    (event: DragEvent | ReactDragEvent<HTMLDivElement>) => {
      if (!isBoardImageDragEvent(event)) return
      preventBoardImageDragDefaults(event)
      setSpreadImageDragActive(false)
      if (!event.dataTransfer) return
      commitSpreadImageDrop(event.clientX, event.clientY, event.dataTransfer)
    },
    [commitSpreadImageDrop],
  )

  useEffect(() => {
    const element = pageAreaRef.current
    if (!element || !spreadImageDropEnabled) {
      setSpreadImageDragActive(false)
      return
    }

    const onDragEnter = (event: DragEvent) => {
      if (!isBoardImageDragEvent(event)) return
      preventBoardImageDragDefaults(event)
      setSpreadImageDragActive(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!isBoardImageDragEvent(event)) return
      preventBoardImageDragDefaults(event)
      setSpreadImageDragActive(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        element.contains(event.relatedTarget)
      ) {
        return
      }
      setSpreadImageDragActive(false)
    }
    const onDrop = (event: DragEvent) => {
      handleSpreadImageDrop(event)
    }

    const capture = { capture: true } as const
    element.addEventListener('dragenter', onDragEnter, capture)
    element.addEventListener('dragover', onDragOver, capture)
    element.addEventListener('dragleave', onDragLeave, capture)
    element.addEventListener('drop', onDrop, capture)
    return () => {
      element.removeEventListener('dragenter', onDragEnter, capture)
      element.removeEventListener('dragover', onDragOver, capture)
      element.removeEventListener('dragleave', onDragLeave, capture)
      element.removeEventListener('drop', onDrop, capture)
    }
  }, [handleSpreadImageDrop, pageAreaRef, spreadImageDropEnabled])

  const spreadImageDropSurface = spreadImageDropEnabled ? (
    <div
      aria-hidden
      className={cn(
        'absolute inset-0 z-[100]',
        spreadImageDragActive ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      onDragOver={(event) => {
        if (!isBoardImageDragEvent(event)) return
        preventBoardImageDragDefaults(event)
      }}
    />
  ) : null

  const spreadSessionOwnsPagePaint =
    spreadSessionModeEnabled &&
    spreadSessionLive &&
    selectedBookId != null &&
    selectedUnitId != null

  const spreadSessionCommandsSnapshot = useMemo((): readonly AnnotationCommand[] => {
    if (inkSessionReactBoundaryEnabled) {
      return spreadSessionStoreRef.current?.getState().doc.commands ?? []
    }
    return spreadSessionDoc?.commands ?? []
  }, [
    inkSessionReactBoundaryEnabled ? spreadSessionRevision : spreadSessionDoc,
    inkSessionReactBoundaryEnabled,
    spreadSessionDoc,
    spreadSessionRevision,
    spreadSessionStoreRef,
  ])

  const spreadSessionPaintCommandIds = useMemo(
    () => spreadSessionCommandsSnapshot.map((c) => c.id),
    [spreadSessionCommandsSnapshot],
  )

  const spreadDomToolsDelegated =
    spreadInkDelegated &&
    (annotationMode === 'text' ||
      annotationMode === 'sticky' ||
      isWritableStickerInteraction(annotationMode, stickerKind))
  const delegatePointerToSpreadPageLayer =
    spreadStrokeCaptureEnabled || spreadDomToolsDelegated

  const commitPageCanvasCommandToSpread = useCallback(
    (cmd: AnnotationCommand, ownerPage: number) => {
      if (!spreadSessionLive) return
      const side = ownerPage === pageNumber ? 'left' : 'right'
      let resolved = cmd
      if (cmd.kind === 'callout') {
        const spreadCmds = spreadSessionStoreRef.current?.getState().doc.commands ?? []
        resolved = { ...cmd, index: nextCalloutIndex(spreadCmds) }
      }
      const mapped = mapCommandPageToSpread(resolved, side, spreadInkLayout)
      appendSpreadSessionCommand(mapped)
      notifyStampPlacedFromCommand(mapped, { studentId })
    },
    [
      appendSpreadSessionCommand,
      pageNumber,
      spreadSessionLive,
      studentId,
      spreadInkLayout,
      spreadSessionStoreRef,
    ],
  )

  const setSpreadSessionSelected = useCallback((ids: string[]) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.setSelectedIds(ids)
  }, [spreadSessionModeEnabled])

  useEffect(() => {
    if (!whiteboardActive) return
    setSpreadSessionSelectedIds([])
    spreadSessionStoreRef.current?.setSelectedIds([])
  }, [whiteboardActive])

  const patchSpreadSessionCommand = useCallback(
    (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => {
      spreadSessionStoreRef.current?.patchCommands((cmds) =>
        cmds.map((c) => (c.id === id ? ({ ...c, ...partial } as AnnotationCommand) : c)),
      )
    },
    [],
  )

  const deleteSpreadSessionCommand = useCallback((id: string) => {
    const store = spreadSessionStoreRef.current
    if (!store) return
    store.patchCommands((cmds) => cmds.filter((c) => c.id !== id))
    const remaining = store.getState().selectedIds.filter((sid) => sid !== id)
    if (remaining.length !== store.getState().selectedIds.length) {
      store.setSelectedIds(remaining)
    }
  }, [])

  const patchSpreadSessionTextSelected = useCallback((partial: Partial<TextAnnotationCommand>) => {
    const store = spreadSessionStoreRef.current
    if (!store) return
    const ids = store.getState().selectedIds
    store.patchCommands((cmds) => patchSelectedTextCommands(cmds, ids, partial))
  }, [])

  const patchSpreadSessionStickySelected = useCallback((partial: Partial<StickyAnnotationCommand>) => {
    const store = spreadSessionStoreRef.current
    if (!store) return
    const ids = store.getState().selectedIds
    store.patchCommands((cmds) => patchSelectedStickyCommands(cmds, ids, partial))
  }, [])

  const patchSpreadSessionShapeSelected = useCallback((patch: ShapeSelectionPatch) => {
    const store = spreadSessionStoreRef.current
    if (!store) return
    const ids = store.getState().selectedIds
    store.patchCommands((cmds) => patchSelectedShapeCommands(cmds, ids, patch))
  }, [])

  const patchSpreadSessionStrokeSelected = useCallback((patch: InkStrokeSelectionPatch) => {
    const store = spreadSessionStoreRef.current
    if (!store) return
    const ids = store.getState().selectedIds
    store.patchCommands((cmds) => patchSelectedInkStrokeCommands(cmds, ids, patch))
  }, [])

  const toggleSpreadSessionGroupSelected = useCallback(() => {
    spreadSessionStoreRef.current?.toggleGroupSelected()
  }, [])

  const deleteSpreadSessionSelected = useCallback(() => {
    spreadSessionStoreRef.current?.deleteSelected()
  }, [])

  const duplicateSpreadSessionSelected = useCallback(() => {
    spreadSessionStoreRef.current?.duplicateSelected()
  }, [])

  const arrangeSpreadSessionSelected = useCallback(
    (axis: HorizontalAlignAxis) => {
      const store = spreadSessionStoreRef.current
      if (!store || !(spreadOverlayWidthPx > 0) || !(spreadOverlayHeightPx > 0)) return
      const ids = store.getState().selectedIds
      if (ids.length < 2) return
      store.patchCommands((cmds) =>
        alignSelectedCommands(cmds, ids, axis, spreadOverlayWidthPx, spreadOverlayHeightPx),
      )
    },
    [spreadOverlayHeightPx, spreadOverlayWidthPx],
  )

  const distributeSpreadSessionVertical = useCallback(() => {
    const store = spreadSessionStoreRef.current
    if (!store || !(spreadOverlayWidthPx > 0) || !(spreadOverlayHeightPx > 0)) return
    const ids = store.getState().selectedIds
    if (ids.length < 3) return
    store.patchCommands((cmds) =>
      distributeVerticalSpacingSelectedCommands(
        cmds,
        ids,
        spreadOverlayWidthPx,
        spreadOverlayHeightPx,
      ),
    )
  }, [spreadOverlayHeightPx, spreadOverlayWidthPx])

  const moveSpreadSessionSelected = useCallback((dx: number, dy: number) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.moveSelectedBy(dx, dy)
  }, [spreadSessionModeEnabled])

  const spreadDomConfig = useMemo((): SpreadSessionDomConfig | null => {
    if (!spreadInkDelegated || !spreadSessionLive) return null
    return {
      enabled: true,
      mode: annotationMode,
      stickerKind,
      writableStickerVariant,
      textColor: textColorResolved,
      textFontSizeNorm,
      textFontId,
      textFontWeight,
      textVisualStyle: bookTextVisualStyle,
      textAlign,
      textFillColor,
      stickyFillColor,
      stickyFontSizeNorm,
      defaultStickyWNorm: 0.22,
      defaultStickyHNorm: 0.11,
      widthPx: spreadOverlayWidthPx,
      heightPx: spreadOverlayHeightPx,
      selectEnabled: annotationMode === 'select' && !whiteboardActive,
      selectedIds: spreadSessionSelectedIds,
      onAppendCommand: appendSpreadSessionCommand,
      onPatchCommand: patchSpreadSessionCommand,
      onDeleteText: deleteSpreadSessionCommand,
      onDeleteSticky: deleteSpreadSessionCommand,
      onSelectedIdsChange: setSpreadSessionSelected,
      onPatchSelectedText: patchSpreadSessionTextSelected,
      onPatchSelectedSticky: patchSpreadSessionStickySelected,
      onPatchSelectedShape: patchSpreadSessionShapeSelected,
      onPatchSelectedStroke: patchSpreadSessionStrokeSelected,
      onToggleGroupSelected: toggleSpreadSessionGroupSelected,
      onDeleteSelected: deleteSpreadSessionSelected,
      onDuplicateSelected: duplicateSpreadSessionSelected,
      onArrangeSelected: arrangeSpreadSessionSelected,
      onDistributeVerticalSelected: distributeSpreadSessionVertical,
      onEnterSelectMode,
      onMoveSelectedBy: moveSpreadSessionSelected,
      onToolUseOnSpread: onAnnotationToolUseOnSpread,
    }
  }, [
    arrangeSpreadSessionSelected,
    distributeSpreadSessionVertical,
    annotationMode,
    onEnterSelectMode,
    moveSpreadSessionSelected,
    onAnnotationToolUseOnSpread,
    stickerKind,
    writableStickerVariant,
    appendSpreadSessionCommand,
    deleteSpreadSessionCommand,
    deleteSpreadSessionSelected,
    duplicateSpreadSessionSelected,
    patchSpreadSessionCommand,
    patchSpreadSessionShapeSelected,
    patchSpreadSessionStrokeSelected,
    patchSpreadSessionStickySelected,
    patchSpreadSessionTextSelected,
    setSpreadSessionSelected,
    spreadInkDelegated,
    spreadOverlayHeightPx,
    spreadOverlayWidthPx,
    spreadSessionLive,
    spreadSessionSelectedIds,
    stickyFillColor,
    toggleSpreadSessionGroupSelected,
    stickyFontSizeNorm,
    textColorResolved,
    textFillColor,
    textFontId,
    textFontWeight,
    textFontSizeNorm,
    bookTextVisualStyle,
    textAlign,
    whiteboardActive,
  ])

  const scaleSpreadSessionSelected = useCallback(
    (startFrame: OrientedSelectionFrame, newFrame: OrientedSelectionFrame) => {
      const store = spreadSessionStoreRef.current
      if (!store) return
      const ids = new Set(store.getState().selectedIds)
      if (ids.size === 0) return
      store.patchCommands((cmds) =>
        scaleAnnotationCommandsFromOrientedFrames(
          cmds,
          ids,
          startFrame,
          newFrame,
          spreadOverlayWidthPx,
          spreadOverlayHeightPx,
        ),
      )
    },
    [spreadOverlayWidthPx, spreadOverlayHeightPx],
  )

  const rotateSpreadSessionSelected = useCallback(
    (
      pivot: [number, number],
      deltaRad: number,
      ids: string[],
      previewBase?: readonly AnnotationCommand[] | null,
      groupRotationFrame?: OrientedSelectionFrame | null,
    ) => {
      const store = spreadSessionStoreRef.current
      if (!store || ids.length === 0 || Math.abs(deltaRad) < 1e-6) return
      const layout = { widthPx: spreadOverlayWidthPx, heightPx: spreadOverlayHeightPx }
      store.patchCommands((cmds) =>
        commitRotatedAnnotationCommands(
          cmds,
          new Set(ids),
          pivot,
          deltaRad,
          layout,
          previewBase,
          groupRotationFrame,
        ),
      )
    },
    [spreadOverlayWidthPx, spreadOverlayHeightPx],
  )

  const mirrorLeftSelectionMoveToRight = useCallback((ids: string[], dx: number, dy: number) => {
    if (spreadSessionModeEnabled && spreadSessionStoreRef.current) {
      const spreadCmdIds = new Set(
        spreadSessionStoreRef.current.getState().doc.commands.map((c) => c.id),
      )
      const spreadIds = ids.filter((id) => spreadCmdIds.has(id))
      if (spreadIds.length > 0) {
        spreadSessionStoreRef.current.moveSelectedBy(dx, dy)
      }
    }
    rightAnnRef.current?.translateByIds?.(ids, dx, dy)
  }, [rightAnnRef])

  const mirrorRightSelectionMoveToLeft = useCallback((ids: string[], dx: number, dy: number) => {
    if (spreadSessionModeEnabled && spreadSessionStoreRef.current) {
      const spreadCmdIds = new Set(
        spreadSessionStoreRef.current.getState().doc.commands.map((c) => c.id),
      )
      const spreadIds = ids.filter((id) => spreadCmdIds.has(id))
      if (spreadIds.length > 0) {
        spreadSessionStoreRef.current.moveSelectedBy(dx, dy)
      }
    }
    leftAnnRef.current?.translateByIds?.(ids, dx, dy)
  }, [leftAnnRef])

  const renderSpreadPageMarkerLayer = useCallback(
    (side: 'left' | 'right') => {
      if (spreadMarkerSpreadOverlayFallbackEnabled) return null
      if (!spreadSessionModeEnabled || !spreadSessionLive || !spreadInkDelegated) return null
      return (
        <BookSpreadPageMarkerLayer
          side={side}
          widthPx={spreadPageWidth}
          heightPx={pageCanvasHeightPx}
          commands={spreadSessionCommandsSnapshot}
          layout={spreadInkLayout}
          layoutMeasureRevision={spreadInkLayoutRevision}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          trailingMarkerStrokeDraft={spreadMarkerStrokeDraft}
        />
      )
    },
    [
      spreadSessionModeEnabled,
      spreadSessionLive,
      spreadInkDelegated,
      spreadPageWidth,
      pageCanvasHeightPx,
      spreadSessionCommandsSnapshot,
      spreadMarkerStrokeDraft,
      spreadInkLayout,
      spreadInkLayoutRevision,
      leftPageCaptureRef,
      rightPageCaptureRef,
    ],
  )

  const renderPoolPageChrome = useCallback(
    ({ pageNumber: poolPage, slotRole }: PageViewPoolRenderContext) => {
      if (bookSpreadHardcoverGutterOnlyForFrameTuning) return null
      if (!selectedBookId || !selectedUnitId) return null
      const isLeft = slotRole === 'left'
      const isRight = slotRole === 'right'
      return (
        <>
          {slotRole === 'left' ? renderSpreadPageMarkerLayer('left') : null}
          {slotRole === 'right' ? renderSpreadPageMarkerLayer('right') : null}
          <BookPageAnnotationLayer
          ref={isLeft ? leftAnnRef : isRight ? rightAnnRef : undefined}
          studentId={studentId}
          bookId={selectedBookId}
          unitId={selectedUnitId}
          pageNumber={poolPage}
          widthPx={spreadPageWidth}
          heightPx={pageCanvasHeightPx}
          mode={annotationMode}
          eyedropperVariant={eyedropperVariant}
          stickerKind={stickerKind}
          writableStickerVariant={writableStickerVariant}
          stampVariant={stampVariant}
          stampQuestionColor={stampQuestionColor}
          strokeWidthScale={strokeWidthScale}
          eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
          penStrokeWidthScale={penStrokeWidthScale}
          shapeStrokeWidthScale={shapeStrokeWidthScale}
          stampScale={stampScale}
          strokeColor={strokeColor}
          penInkColor={penInkColor}
          penInkStyle={penInkStyle}
          penStrokeProfile={penStrokeProfile}
          penInkPatternOriginXPx={isLeft ? leftPenInkPatternOriginXPx : isRight ? rightPenInkPatternOriginXPx : 0}
          strokeLineDashStyle={strokeLineDashStyle}
          markerStraightStroke={markerStraightStroke}
          markerDecoratedEdge={markerDecoratedEdge}
          penAutoGroupConnected={penAutoGroupConnected}
          marqueeSelectRule={marqueeSelectRule}
          shapeColor={shapeColorResolved}
          textColor={textColorResolved}
          shapeLineDashStyle={shapeLineDashStyle}
          shapeStrokeEnabled={shapeStrokeEnabled}
          shapeFillMode={shapeFillMode}
          shapeFillColor={shapeFillColor}
        shapeRoundedCorners={shapeRoundedCorners}
          textFontSizeNorm={textFontSizeNorm}
          textFontId={textFontId}
          textFontWeight={textFontWeight}
          textVisualStyle={bookTextVisualStyle}
          textAlign={textAlign}
          textFillColor={textFillColor}
          stickyFillColor={stickyFillColor}
          stickyFontSizeNorm={stickyFontSizeNorm}
          defaultStickyWNorm={0.22}
          defaultStickyHNorm={0.11}
          onPointerSessionStart={() => setAnnotationTargetPage(poolPage)}
          onEyedropperPick={eyedropperForPage(poolPage)}
          onCapabilitiesChange={isLeft ? onLeftAnnotationCaps : isRight ? onRightAnnotationCaps : undefined}
          delegatePointerToSpread={delegatePointerToSpreadPageLayer}
          spreadInkDelegated={spreadInkDelegated}
          spreadSessionOwnsPagePaint={spreadSessionOwnsPagePaint}
          spreadSessionPaintCommandIds={spreadSessionPaintCommandIds}
          onSelectionMoveCommitted={
            isLeft ? mirrorLeftSelectionMoveToRight : isRight ? mirrorRightSelectionMoveToLeft : undefined
          }
          onSpreadCanvasCommandCommit={
            spreadSessionLive ? commitPageCanvasCommandToSpread : undefined
          }
          pdfTextRoutingEnabled={bookPdfTextSelectActive}
        />
        </>
      )
    },
    [
      annotationMode,
      commitPageCanvasCommandToSpread,
      renderSpreadPageMarkerLayer,
      spreadInkDelegated,
      spreadSessionLive,
      spreadSessionOwnsPagePaint,
      spreadSessionPaintCommandIds,
      eyedropperForPage,
      eyedropperVariant,
      eraserLineStrokeWidthScale,
      leftAnnRef,
      leftPenInkPatternOriginXPx,
      marqueeSelectRule,
      markerDecoratedEdge,
      markerStraightStroke,
      mirrorLeftSelectionMoveToRight,
      mirrorRightSelectionMoveToLeft,
      onLeftAnnotationCaps,
      onRightAnnotationCaps,
      pageCanvasHeightPx,
      penAutoGroupConnected,
      penInkColor,
      penInkStyle,
      penStrokeProfile,
      penStrokeWidthScale,
      rightAnnRef,
      rightPenInkPatternOriginXPx,
      selectedBookId,
      selectedUnitId,
      setAnnotationTargetPage,
      shapeColorResolved,
      shapeFillColor,
      shapeFillMode,
      shapeRoundedCorners,
      shapeLineDashStyle,
      shapeStrokeEnabled,
      shapeStrokeWidthScale,
      spreadPageWidth,
      delegatePointerToSpreadPageLayer,
      stampQuestionColor,
      stampScale,
      stampVariant,
      stickyFillColor,
      stickyFontSizeNorm,
      strokeColor,
      strokeLineDashStyle,
      strokeWidthScale,
      studentId,
      textColorResolved,
      textFillColor,
      textFontSizeNorm,
      textFontId,
      textFontWeight,
      bookTextVisualStyle,
    ],
  )

  const spreadSessionLayerInkProps = useMemo(
    () =>
      inkSessionReactBoundaryEnabled
        ? {
            sessionStoreRef: spreadSessionStoreRef,
            commandsRevision: spreadSessionRevision,
          }
        : { commands: [...spreadSessionCommandsSnapshot] },
    [
      spreadSessionCommandsSnapshot,
      spreadSessionRevision,
      spreadSessionStoreRef,
    ],
  )

  const spreadStageOverlays = bookSpreadHardcoverGutterOnlyForFrameTuning ? null : (
    <>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-[90] rounded-md ring-2 ring-inset ring-sky-400 transition-opacity',
          spreadImageDragActive ? 'opacity-100' : 'opacity-0',
        )}
      />
      {spreadMarkerSpreadOverlayFallbackEnabled &&
      spreadSessionModeEnabled &&
      spreadSessionLive &&
      spreadInkDelegated ? (
        <BookSpreadMarkerSpreadOverlay
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          spreadPageWidthPx={spreadPageWidth}
          pageCanvasHeightPx={pageCanvasHeightPx}
          layout={spreadInkLayout}
          layoutMeasureRevision={spreadInkLayoutRevision}
          commands={spreadSessionCommandsSnapshot}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          trailingMarkerStrokeDraft={spreadMarkerStrokeDraft}
        />
      ) : null}
      {spreadSessionModeEnabled && spreadSessionLive ? (
        <BookSpreadSessionLayer
          widthPx={spreadOverlayWidthPx}
          heightPx={spreadOverlayHeightPx}
          {...spreadSessionLayerInkProps}
          trailingEraserLineDraft={spreadEraserLineDraft}
          selectEnabled={annotationMode === 'select' && !whiteboardActive}
          hideSelectionContextBar={hideSelectionContextBar}
          pdfTextRoutingEnabled={bookPdfTextSelectActive}
          lessonBoardObscures={whiteboardActive}
          selectedIds={spreadSessionSelectedIds}
          nudgePreview={spreadSessionNudgePreview}
          onSelectedIdsChange={setSpreadSessionSelected}
          onMoveSelectedBy={moveSpreadSessionSelected}
          onScaleSelectedBy={scaleSpreadSessionSelected}
          onRotateSelectedBy={rotateSpreadSessionSelected}
          domConfig={spreadDomConfig}
        />
      ) : null}
      {selectedBookId && selectedUnitId && onPlaceBoardLink && onOpenBoardFromLink ? (
        <BoardPageLinkMarkers
          pageNumber={pageNumber}
          spreadRightPage={spreadRightPage}
          showSpreadRightPage={showSpreadRightPage}
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          spreadPageWidthPx={spreadPageWidth}
          pageCanvasHeightPx={pageCanvasHeightPx}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          links={lessonBoardPageLinks}
          boardPages={whiteboardSessionDoc?.pages ?? []}
          placementActive={boardLinkPlacementActive}
          markersInteractive={boardLinkMarkersInteractive}
          onPlaceLink={onPlaceBoardLink}
          onOpenLink={onOpenBoardFromLink}
        />
      ) : null}
      {selectedBookId && selectedUnitId && onPlaceAudioPin && onPlayAudioPin ? (
        <BookAudioPinMarkers
          pageNumber={pageNumber}
          spreadRightPage={spreadRightPage}
          showSpreadRightPage={showSpreadRightPage}
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          spreadPageWidthPx={spreadPageWidth}
          pageCanvasHeightPx={pageCanvasHeightPx}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          pins={audioPins}
          tracks={audioTracks}
          placementActive={audioPinPlacementActive}
          markersInteractive={audioPinMarkersInteractive}
          playingTrackId={audioPlayingTrackId}
          isPlaying={audioIsPlaying}
          onPlacePin={onPlaceAudioPin}
          onPlayPin={onPlayAudioPin}
          onRemovePin={onRemoveAudioPin}
          onMovePin={onMoveAudioPin ?? (() => {})}
        />
      ) : null}
      {selectedBookId && selectedUnitId && (onPlaceReadingCheckHotspot || readingCheckLivePins.length > 0) ? (
        <ReadingCheckHotspotPlacementLayer
          pageNumber={pageNumber}
          spreadRightPage={spreadRightPage}
          showSpreadRightPage={showSpreadRightPage}
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          spreadPageWidthPx={spreadPageWidth}
          pageCanvasHeightPx={pageCanvasHeightPx}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          placementActive={readingCheckHotspotPlacementActive}
          previewPdfPage={readingCheckHotspotPreviewPdfPage}
          previewCenter={readingCheckHotspotPreviewCenter}
          previewLabel={readingCheckHotspotPreviewLabel}
          onPlace={onPlaceReadingCheckHotspot}
          onPreviewClick={onReadingCheckHotspotPreviewClick}
          livePins={readingCheckLivePins}
          livePinsInteractive={readingCheckLivePinsInteractive}
          onLivePinClick={onReadingCheckLivePinClick}
        />
      ) : null}
      {selectedBookId && selectedUnitId ? (
        <BookExerciseTaskMarkers
          pageNumber={pageNumber}
          spreadRightPage={spreadRightPage}
          showSpreadRightPage={showSpreadRightPage}
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          spreadPageWidthPx={spreadPageWidth}
          pageCanvasHeightPx={pageCanvasHeightPx}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          tasks={exerciseTasks}
          selectedTaskId={selectedExerciseTaskId}
          markersInteractive={exerciseMarkersInteractive}
          onSelectTask={onSelectExerciseTask}
          onRemoveTask={onRemoveExerciseTask}
          onMoveTask={onMoveExerciseTask}
        />
      ) : null}
      {!whiteboardActive && selectedBookId && selectedUnitId ? (
        <BookSpreadStrokeOverlay
          ref={spreadStrokeOverlayRef}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          leftAnnRef={leftAnnRef}
          rightAnnRef={rightAnnRef}
          annotationMode={annotationMode}
          strokeWidthScale={strokeWidthScale}
          eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
          penStrokeWidthScale={penStrokeWidthScale}
          strokeColor={strokeColor}
          penInkColor={penInkColor}
          penInkStyle={penInkStyle}
          penStrokeProfile={penStrokeProfile}
          strokeLineDashStyle={strokeLineDashStyle}
          markerStraightStroke={markerStraightStroke}
          markerDecoratedEdge={markerDecoratedEdge}
          shapeColor={shapeColorResolved}
          shapeStrokeWidthScale={shapeStrokeWidthScale}
          shapeLineDashStyle={shapeLineDashStyle}
          shapeStrokeEnabled={shapeStrokeEnabled}
          shapeFillMode={shapeFillMode}
          shapeFillColor={shapeFillColor}
        shapeRoundedCorners={shapeRoundedCorners}
          pageNumberLeft={pageNumber}
          pageNumberRight={sessionRightPage}
          annotationTargetPage={annotationTargetPage}
          setAnnotationTargetPage={setAnnotationTargetPage}
          onCapabilitiesChange={onSpreadOverlayCaps}
          captureEnabled={spreadStrokeCaptureEnabled}
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          spreadOverlayHeightPx={spreadOverlayHeightPx}
          spreadPageWidthPx={spreadPageWidth}
          leftPenInkPatternOriginXPx={leftPenInkPatternOriginXPx}
          rightPenInkPatternOriginXPx={rightPenInkPatternOriginXPx}
          spreadSeamNormX={spreadSeamNormX}
          spreadSessionMode={spreadSessionModeEnabled}
          onSpreadSessionAppendCommand={appendSpreadSessionCommand}
          spreadSessionUndo={spreadSessionUndo}
          spreadSessionRedo={spreadSessionRedo}
          spreadSessionClear={spreadSessionClear}
        onSpreadEraserLineDraftChange={setSpreadEraserLineDraft}
        onSpreadMarkerStrokeDraftChange={setSpreadMarkerStrokeDraft}
        onAnnotationToolUseOnSpread={onAnnotationToolUseOnSpread}
      />
      ) : null}
      {spreadImageDropSurface}
    </>
  )

  const lessonBoardChrome =
    !exportCaptureLayoutActive &&
    !bookSpreadHardcoverGutterOnlyForFrameTuning &&
    lessonBoardHostStyle ? (
      <div
        data-lesson-board-chrome=""
        className="pointer-events-none absolute shrink-0 leading-none z-[38]"
        style={lessonBoardHostStyle}
      >
        {renderWhiteboardStandardAnchor()}
        {renderWhiteboardWideSpreadOverlay()}
      </div>
    ) : null

  const poolStageCommonProps = {
    anchorPage: pageNumber,
    spreadRightPage: spreadRightPage ?? null,
    visiblePages,
    readerBounds,
    unitId: selectedUnitId!,
    spreadPageWidth,
    pageCanvasHeightPx,
    gutterPullPx,
    pdf: sharedPdf!,
    PdfPage,
    prefetchRevision,
    confirmSlotPixelsReady: confirmSpreadSlotPixels,
    onPdfPageLoadSuccess,
    onSlotPixelsReady: handlePoolSlotPixelsReady,
    leftCaptureRef: leftPageCaptureRef,
    rightCaptureRef: rightPageCaptureRef,
    renderPageChrome: renderPoolPageChrome,
    spreadOverlayWidthPx,
    showSpreadRightPage,
    showBookFrame: showBookFrameInReader,
    dimBook: whiteboardWideSpreadPresented,
    bookTextSelectActive: bookPdfTextSelectActive,
    pageTextCapability,
    screenScale: spreadScreenScale,
  } as const

  const stampIndicatorActive = isQuickStickerInteraction(annotationMode, stickerKind)
  const stampIndicatorShown = useStampVariantIndicator(
    stampIndicatorActive,
    stampVariant,
    stampIndicatorPulseEpoch,
  )

  return (
    <>
      <div
        ref={pageAreaRef}
        className={cn(
          'absolute inset-0 overscroll-none',
          pinchZoomActive || applyResizeScale ? 'overflow-visible' : 'overflow-hidden',
          spreadStrokeCaptureEnabled && 'touch-none',
        )}
        style={spreadStrokeCaptureEnabled ? { touchAction: 'none' } : undefined}
      >
        {showSpreadLoadingHold ? (
          <div
            className="absolute inset-0 z-[19] flex flex-col items-center justify-center gap-2 bg-[var(--surface-2)] text-center"
            aria-busy="true"
            aria-live="polite"
          >
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">Loading pagesâ€¦</p>
          </div>
        ) : null}
        {!hasCurriculumOrHistory ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/92 p-6 text-center backdrop-blur-sm">
              <p className="text-base font-semibold text-foreground">No curriculum assigned yet for this student.</p>
              <p className="mt-2 text-sm text-muted-foreground">Assign a curriculum book first in the teacher plan screen.</p>
              <Button asChild className="mt-4">
                <Link href={`/students/${studentId}?tab=classes`}>Open class prep</Link>
              </Button>
            </div>
          </div>
        ) : loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading book...</p>
        ) : error ? (
          <p className="p-6 text-sm text-[var(--brand-red)]">{error}</p>
        ) : !hasResolvedUnit ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/92 p-6 text-center backdrop-blur-sm">
              <p className="text-base font-semibold text-foreground">Assigned book has no units.</p>
              <p className="mt-2 text-sm text-muted-foreground">Add unit PDF files to this book folder in `book-library` and try again.</p>
            </div>
          </div>
        ) : !pdfReady ? (
          <p className="p-6 text-sm text-muted-foreground">Preparing PDF viewer...</p>
        ) : unitPdfLoading || !sharedPdf ? (
          <p className="p-6 text-sm text-muted-foreground">Loading PDF...</p>
        ) : unitPdfError ? (
          <p className="p-6 text-sm text-[var(--brand-red)]">{unitPdfError}</p>
        ) : (
          <div
            className={cn(
              'absolute inset-0 min-h-0 min-w-0',
              applyResizeScale &&
                spreadFitMotionActive &&
                `transition-transform ${BOOK_WORKSPACE_RAIL_MOTION_TW}`,
            )}
            style={resizeScaleStyle}
          >
            <div
              ref={pinchSpreadRef}
              className={cn(
                'absolute shrink-0 leading-none',
                focusTransformActive && 'left-0 top-0',
              )}
              style={
                focusTransformActive && focusLayout
                  ? {
                      width: spreadOverlayWidthPx,
                      height: pageCanvasHeightPx,
                      transform: `translate(${focusLayout.translateX}px, ${focusLayout.translateY}px) scale(${focusLayout.scale})`,
                      transformOrigin: '0 0',
                    }
                  : spreadReaderPositionStyle
              }
            >
              {exportCaptureLayoutActive ? (
                useStablePageViewPool ? (
                  <SpreadStage
                    {...poolStageCommonProps}
                    gridRef={spreadGridRef}
                    turnSlide={turnSlide}
                    onTurnSlideComplete={onTurnSlideComplete}
                  />
                ) : (
                <div className="flex w-max max-w-full items-start justify-center leading-none">
                  {selectedUnitId ? (
                    <ReaderPageSlot
                      key={`slot-p-${pageNumber}`}
                      unitId={selectedUnitId}
                      pageNumber={pageNumber}
                      spreadPageWidth={spreadPageWidth}
                      pageCanvasHeightPx={pageCanvasHeightPx}
                      pdf={sharedPdf}
                      PdfPage={PdfPage}
                      onPdfPageLoadSuccess={onPdfPageLoadSuccess}
                      prefetchRevision={prefetchRevision}
                      captureRef={leftPageCaptureRef}
                      onSlotPixelsReady={handleLeftSlotPixelsReady}
                      confirmSlotPixelsReady={confirmSpreadSlotPixels}
                      pageBulgeSide={showBookFrameInReader ? 'left' : undefined}
                      bookTextSelectActive={bookPdfTextSelectActive}
                      pageHasSelectableText={leftPageHasSelectableText}
                      screenScale={spreadScreenScale}
                    >
                      {selectedBookId ? (
                        <BookPageAnnotationLayer
                          ref={leftAnnRef}
                          studentId={studentId}
                          bookId={selectedBookId}
                          unitId={selectedUnitId}
                          pageNumber={pageNumber}
                          widthPx={spreadPageWidth}
                          heightPx={pageCanvasHeightPx}
                          mode={annotationMode}
                          eyedropperVariant={eyedropperVariant}
                          stickerKind={stickerKind}
                          writableStickerVariant={writableStickerVariant}
                          stampVariant={stampVariant}
                          stampQuestionColor={stampQuestionColor}
                          strokeWidthScale={strokeWidthScale}
                          eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                          penStrokeWidthScale={penStrokeWidthScale}
                          shapeStrokeWidthScale={shapeStrokeWidthScale}
                          stampScale={stampScale}
                          strokeColor={strokeColor}
                          penInkColor={penInkColor}
                          penInkStyle={penInkStyle}
                          penStrokeProfile={penStrokeProfile}
                          strokeLineDashStyle={strokeLineDashStyle}
                          markerStraightStroke={markerStraightStroke}
                          markerDecoratedEdge={markerDecoratedEdge}
                          penAutoGroupConnected={penAutoGroupConnected}
                          marqueeSelectRule={marqueeSelectRule}
                          shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                          shapeLineDashStyle={shapeLineDashStyle}
                          shapeStrokeEnabled={shapeStrokeEnabled}
                          shapeFillMode={shapeFillMode}
                          shapeFillColor={shapeFillColor}
        shapeRoundedCorners={shapeRoundedCorners}
                          textFontSizeNorm={textFontSizeNorm}
                          textFontId={textFontId}
                          textFontWeight={textFontWeight}
                          textVisualStyle={bookTextVisualStyle}
                          textAlign={textAlign}
                          textFillColor={textFillColor}
                          stickyFillColor={stickyFillColor}
                          stickyFontSizeNorm={stickyFontSizeNorm}
                          defaultStickyWNorm={0.22}
                          defaultStickyHNorm={0.11}
                          onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                          onEyedropperPick={eyedropperForPage(pageNumber)}
                          onCapabilitiesChange={onLeftAnnotationCaps}
                          spreadInkDelegated={spreadInkDelegated}
          spreadSessionOwnsPagePaint={spreadSessionOwnsPagePaint}
          spreadSessionPaintCommandIds={spreadSessionPaintCommandIds}
                          pdfTextRoutingEnabled={bookPdfTextSelectActive}
                        />
                      ) : null}
                    </ReaderPageSlot>
                  ) : (
                    <div
                      ref={leftPageCaptureRef}
                      className="relative inline-block bg-transparent"
                      style={{ width: spreadPageWidth, minHeight: pageCanvasHeightPx }}
                    >
                      {!bookSpreadPageArtHiddenForFrameTuning ? (
                        <PdfPage
                          key={`p-${pageNumber}`}
                          pdf={sharedPdf}
                          pageNumber={pageNumber}
                          width={spreadPageWidth}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          onLoadSuccess={onPdfPageLoadSuccess}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
                )
              ) : useStablePageViewPool ? (
                <SpreadStage
                  {...poolStageCommonProps}
                  gridRef={spreadGridRef}
                  elevatedSlot={whiteboardInSlot ? (boardOnLeft ? 'right' : 'left') : null}
                  turnSlide={turnSlide}
                  onTurnSlideComplete={onTurnSlideComplete}
                >
                  {spreadStageOverlays}
                </SpreadStage>
              ) : (
                <SpreadPageCluster
                  gridRef={spreadGridRef}
                  spreadOverlayWidthPx={spreadOverlayWidthPx}
                  pageCanvasHeightPx={pageCanvasHeightPx}
                  spreadPageWidthPx={spreadPageWidth}
                  gutterPullPx={gutterPullPx}
                  showBookFrame={showBookFrameInReader}
                  dimBook={whiteboardWideSpreadPresented}
                  leftPage={
                      selectedUnitId ? (
                        <ReaderPageSlot
                          key={`slot-l-${pageNumber}`}
                          unitId={selectedUnitId}
                          pageNumber={pageNumber}
                          spreadPageWidth={spreadPageWidth}
                          pageCanvasHeightPx={pageCanvasHeightPx}
                          pdf={sharedPdf}
                          PdfPage={PdfPage}
                          onPdfPageLoadSuccess={onPdfPageLoadSuccess}
                          prefetchRevision={prefetchRevision}
                          captureRef={leftPageCaptureRef}
                          onSlotPixelsReady={handleLeftSlotPixelsReady}
                          confirmSlotPixelsReady={confirmSpreadSlotPixels}
                          pageBulgeSide={showBookFrameInReader ? 'left' : undefined}
                          bookTextSelectActive={bookPdfTextSelectActive}
                          pageHasSelectableText={leftPageHasSelectableText}
                          screenScale={spreadScreenScale}
                        >
                          {selectedBookId ? (
                            <>
                              {renderSpreadPageMarkerLayer('left')}
                              <BookPageAnnotationLayer
                              ref={leftAnnRef}
                              studentId={studentId}
                              bookId={selectedBookId}
                              unitId={selectedUnitId}
                              pageNumber={pageNumber}
                              widthPx={spreadPageWidth}
                              heightPx={pageCanvasHeightPx}
                              mode={annotationMode}
                              eyedropperVariant={eyedropperVariant}
                              stickerKind={stickerKind}
                              writableStickerVariant={writableStickerVariant}
                              stampVariant={stampVariant}
                              stampQuestionColor={stampQuestionColor}
                              strokeWidthScale={strokeWidthScale}
                              eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                              penStrokeWidthScale={penStrokeWidthScale}
                              shapeStrokeWidthScale={shapeStrokeWidthScale}
                              stampScale={stampScale}
                              strokeColor={strokeColor}
                              penInkColor={penInkColor}
                              penInkStyle={penInkStyle}
                          penStrokeProfile={penStrokeProfile}
                              penInkPatternOriginXPx={leftPenInkPatternOriginXPx}
                              strokeLineDashStyle={strokeLineDashStyle}
                              markerStraightStroke={markerStraightStroke}
                          markerDecoratedEdge={markerDecoratedEdge}
                          penAutoGroupConnected={penAutoGroupConnected}
                          marqueeSelectRule={marqueeSelectRule}
                              shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                              shapeLineDashStyle={shapeLineDashStyle}
                              shapeStrokeEnabled={shapeStrokeEnabled}
                              shapeFillMode={shapeFillMode}
                              shapeFillColor={shapeFillColor}
        shapeRoundedCorners={shapeRoundedCorners}
                              textFontSizeNorm={textFontSizeNorm}
                              textFontId={textFontId}
                              textFontWeight={textFontWeight}
                              textVisualStyle={bookTextVisualStyle}
                              textAlign={textAlign}
                              textFillColor={textFillColor}
                              stickyFillColor={stickyFillColor}
                              stickyFontSizeNorm={stickyFontSizeNorm}
                              defaultStickyWNorm={0.22}
                              defaultStickyHNorm={0.11}
                              onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                              onEyedropperPick={eyedropperForPage(pageNumber)}
                              onCapabilitiesChange={onLeftAnnotationCaps}
                              delegatePointerToSpread={delegatePointerToSpreadPageLayer}
                              spreadInkDelegated={spreadInkDelegated}
          spreadSessionOwnsPagePaint={spreadSessionOwnsPagePaint}
          spreadSessionPaintCommandIds={spreadSessionPaintCommandIds}
                              onSelectionMoveCommitted={mirrorLeftSelectionMoveToRight}
                              onSpreadCanvasCommandCommit={
                                spreadSessionLive ? commitPageCanvasCommandToSpread : undefined
                              }
                              pdfTextRoutingEnabled={bookPdfTextSelectActive}
                            />
                            </>
                          ) : null}
                        </ReaderPageSlot>
                      ) : (
                        <div
                          ref={leftPageCaptureRef}
                          className="relative inline-block bg-transparent"
                          style={{ width: spreadPageWidth, minHeight: pageCanvasHeightPx }}
                        >
                          {!bookSpreadPageArtHiddenForFrameTuning ? (
                            <PdfPage
                              key={`l-${pageNumber}`}
                              pdf={sharedPdf}
                              pageNumber={pageNumber}
                              width={spreadPageWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              onLoadSuccess={onPdfPageLoadSuccess}
                            />
                          ) : null}
                        </div>
                      )}
                  rightPage={
                      showSpreadRightPage && spreadRightPage != null ? (
                        selectedUnitId ? (
                          <ReaderPageSlot
                            key={`slot-r-${spreadRightPage}`}
                            unitId={selectedUnitId}
                            pageNumber={spreadRightPage}
                            spreadPageWidth={spreadPageWidth}
                            pageCanvasHeightPx={pageCanvasHeightPx}
                            pdfClipLeftPx={0}
                            pdf={sharedPdf}
                            PdfPage={PdfPage}
                            onPdfPageLoadSuccess={onPdfPageLoadSuccess}
                            prefetchRevision={prefetchRevision}
                            captureRef={rightPageCaptureRef}
                            onSlotPixelsReady={handleRightSlotPixelsReady}
                            confirmSlotPixelsReady={confirmSpreadSlotPixels}
                            pageBulgeSide={showBookFrameInReader ? 'right' : undefined}
                            bookTextSelectActive={bookPdfTextSelectActive}
                            pageHasSelectableText={rightPageHasSelectableText}
                            screenScale={spreadScreenScale}
                          >
                            {selectedBookId ? (
                              <>
                                {renderSpreadPageMarkerLayer('right')}
                                <BookPageAnnotationLayer
                                ref={rightAnnRef}
                                studentId={studentId}
                                bookId={selectedBookId}
                                unitId={selectedUnitId}
                                pageNumber={spreadRightPage}
                                widthPx={spreadPageWidth}
                                heightPx={pageCanvasHeightPx}
                                mode={annotationMode}
                                eyedropperVariant={eyedropperVariant}
                                stickerKind={stickerKind}
                                writableStickerVariant={writableStickerVariant}
                                stampVariant={stampVariant}
                                stampQuestionColor={stampQuestionColor}
                                strokeWidthScale={strokeWidthScale}
                                eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                                penStrokeWidthScale={penStrokeWidthScale}
                                shapeStrokeWidthScale={shapeStrokeWidthScale}
                                stampScale={stampScale}
                                strokeColor={strokeColor}
                                penInkColor={penInkColor}
                                penInkStyle={penInkStyle}
                          penStrokeProfile={penStrokeProfile}
                                penInkPatternOriginXPx={rightPenInkPatternOriginXPx}
                                strokeLineDashStyle={strokeLineDashStyle}
                                markerStraightStroke={markerStraightStroke}
                          markerDecoratedEdge={markerDecoratedEdge}
                          penAutoGroupConnected={penAutoGroupConnected}
                          marqueeSelectRule={marqueeSelectRule}
                                shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                                shapeLineDashStyle={shapeLineDashStyle}
                                shapeStrokeEnabled={shapeStrokeEnabled}
                                shapeFillMode={shapeFillMode}
                                shapeFillColor={shapeFillColor}
        shapeRoundedCorners={shapeRoundedCorners}
                                textFontSizeNorm={textFontSizeNorm}
                                textFontId={textFontId}
                                textFontWeight={textFontWeight}
                                textVisualStyle={bookTextVisualStyle}
                                textAlign={textAlign}
                                textFillColor={textFillColor}
                                stickyFillColor={stickyFillColor}
                                stickyFontSizeNorm={stickyFontSizeNorm}
                                defaultStickyWNorm={0.22}
                                defaultStickyHNorm={0.11}
                                onPointerSessionStart={() => setAnnotationTargetPage(spreadRightPage)}
                                onEyedropperPick={
                                  spreadRightPage != null ? eyedropperForPage(spreadRightPage) : undefined
                                }
                                onCapabilitiesChange={onRightAnnotationCaps}
                                delegatePointerToSpread={delegatePointerToSpreadPageLayer}
                                spreadInkDelegated={spreadInkDelegated}
          spreadSessionOwnsPagePaint={spreadSessionOwnsPagePaint}
          spreadSessionPaintCommandIds={spreadSessionPaintCommandIds}
                                onSelectionMoveCommitted={mirrorRightSelectionMoveToLeft}
                                onSpreadCanvasCommandCommit={
                                  spreadSessionLive ? commitPageCanvasCommandToSpread : undefined
                                }
                                pdfTextRoutingEnabled={bookPdfTextSelectActive}
                              />
                              </>
                            ) : null}
                          </ReaderPageSlot>
                        ) : (
                          <div
                            ref={rightPageCaptureRef}
                            className="relative inline-block bg-transparent"
                            style={{ width: spreadPageWidth, minHeight: pageCanvasHeightPx }}
                          >
                            {!bookSpreadPageArtHiddenForFrameTuning ? (
                              <PdfPage
                                key={`r-${spreadRightPage}`}
                                pdf={sharedPdf}
                                pageNumber={spreadRightPage}
                                width={spreadPageWidth}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                onLoadSuccess={onPdfPageLoadSuccess}
                              />
                            ) : null}
                          </div>
                        )
                      ) : (
                        <div aria-hidden style={{ width: spreadPageWidth, height: pageCanvasHeightPx }} />
                      )}
                >
                    <div
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute inset-0 z-[90] rounded-md ring-2 ring-inset ring-sky-400 transition-opacity',
                        spreadImageDragActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {!bookSpreadHardcoverGutterOnlyForFrameTuning && spreadSessionModeEnabled && spreadSessionLive ? (
                      <BookSpreadSessionLayer
                        widthPx={spreadOverlayWidthPx}
                        heightPx={spreadOverlayHeightPx}
                        {...spreadSessionLayerInkProps}
                        trailingEraserLineDraft={spreadEraserLineDraft}
                        selectEnabled={annotationMode === 'select' && !whiteboardActive}
                        hideSelectionContextBar={hideSelectionContextBar}
                        pdfTextRoutingEnabled={bookPdfTextSelectActive}
                        lessonBoardObscures={whiteboardActive}
                        selectedIds={spreadSessionSelectedIds}
                        nudgePreview={spreadSessionNudgePreview}
                        onSelectedIdsChange={setSpreadSessionSelected}
                        onMoveSelectedBy={moveSpreadSessionSelected}
                        onScaleSelectedBy={scaleSpreadSessionSelected}
                        onRotateSelectedBy={rotateSpreadSessionSelected}
                        domConfig={spreadDomConfig}
                      />
                    ) : null}
                    {!bookSpreadHardcoverGutterOnlyForFrameTuning && !whiteboardActive && selectedBookId && selectedUnitId ? (
                      <BookSpreadStrokeOverlay
                        ref={spreadStrokeOverlayRef}
                        leftPageCaptureRef={leftPageCaptureRef}
                        rightPageCaptureRef={rightPageCaptureRef}
                        leftAnnRef={leftAnnRef}
                        rightAnnRef={rightAnnRef}
                        annotationMode={annotationMode}
                        strokeWidthScale={strokeWidthScale}
                        eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                        penStrokeWidthScale={penStrokeWidthScale}
                        strokeColor={strokeColor}
                        penInkColor={penInkColor}
                        penInkStyle={penInkStyle}
                        penStrokeProfile={penStrokeProfile}
                        strokeLineDashStyle={strokeLineDashStyle}
                        markerStraightStroke={markerStraightStroke}
                        markerDecoratedEdge={markerDecoratedEdge}
                        shapeColor={shapeColorResolved}
                        shapeStrokeWidthScale={shapeStrokeWidthScale}
                        shapeLineDashStyle={shapeLineDashStyle}
                        shapeStrokeEnabled={shapeStrokeEnabled}
                        shapeFillMode={shapeFillMode}
                        shapeFillColor={shapeFillColor}
        shapeRoundedCorners={shapeRoundedCorners}
                        pageNumberLeft={pageNumber}
                        pageNumberRight={sessionRightPage}
                        annotationTargetPage={annotationTargetPage}
                        setAnnotationTargetPage={setAnnotationTargetPage}
                        onCapabilitiesChange={onSpreadOverlayCaps}
                        captureEnabled={spreadStrokeCaptureEnabled}
                        spreadOverlayWidthPx={spreadOverlayWidthPx}
                        spreadOverlayHeightPx={spreadOverlayHeightPx}
                        spreadPageWidthPx={spreadPageWidth}
                        leftPenInkPatternOriginXPx={leftPenInkPatternOriginXPx}
                        rightPenInkPatternOriginXPx={rightPenInkPatternOriginXPx}
                        spreadSeamNormX={spreadSeamNormX}
                        spreadSessionMode={spreadSessionModeEnabled}
                        onSpreadSessionAppendCommand={appendSpreadSessionCommand}
                        spreadSessionUndo={spreadSessionUndo}
                        spreadSessionRedo={spreadSessionRedo}
                        spreadSessionClear={spreadSessionClear}
                        onSpreadEraserLineDraftChange={setSpreadEraserLineDraft}
                        onSpreadMarkerStrokeDraftChange={setSpreadMarkerStrokeDraft}
                        onAnnotationToolUseOnSpread={onAnnotationToolUseOnSpread}
                      />
                    ) : null}
                    {spreadImageDropSurface}
                </SpreadPageCluster>
              )}
            </div>
            {lessonBoardChrome}
          </div>
        )}
        <BookCaptureRegionOverlay
          open={regionSelectOpen}
          onCancel={() => setRegionSelectOpen(false)}
          onConfirm={(rect) => {
            setRegionSelectOpen(false)
            void runImageCapture({ kind: 'region', regionCss: rect })
          }}
        />
        {focusLayout ? <BookFocusHoleFrame holeRect={focusLayout.holeRect} /> : null}
        {focusZoomDrawActive && onFocusDrawCancel && onFocusDrawConfirm ? (
          <BookFocusZoomDrawOverlay
            open={focusZoomDrawActive}
            spreadGridRef={spreadGridRef}
            onCancel={onFocusDrawCancel}
            onConfirm={onFocusDrawConfirm}
          />
        ) : null}
        {exerciseBoxDrawActive && onPlaceExerciseBox && onCancelExerciseBoxDraw ? (
          <BookExerciseBoxDrawOverlay
            open={exerciseBoxDrawActive}
            pageNumber={pageNumber}
            spreadRightPage={spreadRightPage}
            showSpreadRightPage={showSpreadRightPage}
            leftPageCaptureRef={leftPageCaptureRef}
            rightPageCaptureRef={rightPageCaptureRef}
            onCancel={onCancelExerciseBoxDraw}
            onConfirm={onPlaceExerciseBox}
          />
        ) : null}
        {pdfExporting ? (
          <div className="absolute inset-0 z-[88] flex flex-col items-center justify-center gap-2 bg-black/55 px-4 text-center text-sm text-white backdrop-blur-[2px]">
            <p>{pdfProgressLabel ?? 'Exportingâ€¦'}</p>
          </div>
        ) : null}
        <StampVariantIndicator
          shown={stampIndicatorShown}
          stampVariant={stampVariant}
          stampQuestionColor={stampQuestionColor}
        />
      </div>
    </>
  )
}
