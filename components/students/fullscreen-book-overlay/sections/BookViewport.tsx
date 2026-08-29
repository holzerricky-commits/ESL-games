import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import {
  BookOpen,
  Columns2,
  ChevronLeft,
  ChevronRight,
  Expand,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Minus,
  PanelTop,
  Plus,
  Redo2,
  ScanSearch,
  Shrink,
  Trash2,
  Undo2,
  ZoomOut,
} from 'lucide-react'
import { BookCaptureMenu } from '@/components/students/book-capture-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BOOK_BOTTOM_CHROME_HEIGHT,
  BOOK_OVERLAY_GLASS_CHROME,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH,
} from '@/components/students/fullscreen-book-overlay/constants'
import type { WhiteboardLayoutMode } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardPlacement'
import type { BookCaptureFormat } from '@/lib/books/book-capture'
import { BOOK_OVERLAY_SHORTCUT_LABELS as SC } from '@/lib/books/book-overlay-keyboard-shortcuts'
import { bookPageNavigationChromeEnabled, bookPinchZoomEnabled } from '@/lib/books/feature-flags'
import {
  BOOK_PINCH_ZOOM_MAX_SCALE,
  BOOK_PINCH_ZOOM_MIN_SCALE,
} from '@/lib/books/pinch-zoom-transform'
import { cn } from '@/lib/utils'
import {
  getEffectivePageTotal,
  mapPdfSpreadToDisplayLabel,
  type PageNumberingMode,
} from '@/lib/books/page-numbering'
import type { BookLibraryPayload } from '@/lib/books/types'

type AnnotationCapabilities = { canUndo: boolean; canRedo: boolean }

interface BookBottomChromeProps {
  hasResolvedUnit: boolean
  numPages: number | null
  suppressChrome: boolean
  visiblePages: number[]
  pageNumber: number
  goToAdjacentPage: (delta: -1 | 1) => void
  pageJumpDraft: string
  setPageJumpDraft: (v: string) => void
  setPageJumpFocused: (v: boolean) => void
  spreadRightPage: number | null
  selectedBook: BookLibraryPayload['books'][number] | null
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null
  numberingMode: PageNumberingMode
  commitPageJump: () => void
  printedJumpBounds: { usePrinted: boolean; min: number; max: number }
  unitPageBounds: { min: number; max: number }
  toolbarCaps: AnnotationCapabilities
  isWhiteboardOpen: boolean
  isWhiteboardSessionOpen: boolean
  isWhiteboardMinimized: boolean
  whiteboardLayoutMode: WhiteboardLayoutMode
  onMinimizeWhiteboard: () => void
  onExpandWhiteboard: () => void
  onFloatWhiteboard: () => void
  onDockWhiteboard: () => void
  bookFocusZoomEnabled: boolean
  focusZoomActive: boolean
  focusZoomDrawActive: boolean
  onFocusZoomDraw: () => void
  pinchZoomActive: boolean
  pinchZoomScale: number
  onStepPinchZoom: (direction: 1 | -1) => void
  onResetZoom: () => void
  showBookFrame: boolean
  onToggleBookFrame: () => void
  /** Spread teach view vs Overview multi-page grid. */
  readerLayoutMode?: 'spread' | 'pageGrid'
  onEnterPageGridOverview?: () => void
  onExitPageGridOverview?: () => void
  pdfReady: boolean
  captureBusy: boolean
  captureFormat: BookCaptureFormat
  setCaptureFormat: (v: BookCaptureFormat) => void
  jpegQuality: number
  setJpegQuality: (v: number) => void
  hideChromeForCapture: boolean
  setHideChromeForCapture: (v: boolean) => void
  watermarkEnabled: boolean
  setWatermarkEnabled: (v: boolean) => void
  studentName?: string
  runImageCapture: (args: { kind: 'full' | 'page' | 'region'; regionCss?: DOMRect }) => Promise<void>
  setRegionSelectOpen: (v: boolean) => void
  copyLastCaptureToClipboard: () => Promise<void>
  hasLastImageCapture: boolean
  onExportPdfPacket: () => void
  getActiveAnnotationRef: () => {
    current: { undo: () => void; redo: () => void; clear: () => void } | null
  }
  browserFullscreenSupported?: boolean
  isBrowserFullscreen?: boolean
  onToggleBrowserFullscreen?: () => void
  /** When true, controls float as separate clusters; when false, one solid bottom bar. */
  floatingChrome?: boolean
  onFloatingChromeChange?: (floating: boolean) => void
  /** Left edge of the book desk (left strip + any open list). */
  deskLeft?: string
}

function ChromeIconButton({
  label,
  title,
  disabled,
  active,
  onClick,
  children,
}: {
  label: string
  title?: string
  disabled?: boolean
  active?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-7 w-7 shrink-0 rounded-full text-white hover:bg-white/15',
        active && 'bg-white/15 text-white',
      )}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function ChromeCluster({
  label,
  children,
  floating,
}: {
  label: string
  children: ReactNode
  floating: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        floating && cn('rounded-full px-1.5 py-0.5 text-white', BOOK_OVERLAY_GLASS_CHROME),
      )}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  )
}

/** Bottom bar — history, page jump, zoom + layout. Can toggle to floating clusters. */
export function BookBottomChrome({
  hasResolvedUnit,
  numPages,
  suppressChrome,
  visiblePages,
  pageNumber,
  goToAdjacentPage,
  pageJumpDraft,
  setPageJumpDraft,
  setPageJumpFocused,
  spreadRightPage,
  selectedBook,
  selectedUnit,
  numberingMode,
  commitPageJump,
  printedJumpBounds,
  unitPageBounds,
  toolbarCaps,
  isWhiteboardOpen,
  isWhiteboardSessionOpen,
  isWhiteboardMinimized,
  whiteboardLayoutMode,
  onMinimizeWhiteboard,
  onExpandWhiteboard,
  onFloatWhiteboard,
  onDockWhiteboard,
  bookFocusZoomEnabled,
  focusZoomActive,
  focusZoomDrawActive,
  onFocusZoomDraw,
  pinchZoomActive,
  pinchZoomScale,
  onStepPinchZoom,
  onResetZoom,
  showBookFrame,
  onToggleBookFrame,
  readerLayoutMode = 'spread',
  onEnterPageGridOverview,
  onExitPageGridOverview,
  pdfReady,
  captureBusy,
  captureFormat,
  setCaptureFormat,
  jpegQuality,
  setJpegQuality,
  hideChromeForCapture,
  setHideChromeForCapture,
  watermarkEnabled,
  setWatermarkEnabled,
  studentName,
  runImageCapture,
  setRegionSelectOpen,
  copyLastCaptureToClipboard,
  hasLastImageCapture,
  onExportPdfPacket,
  getActiveAnnotationRef,
  browserFullscreenSupported = false,
  isBrowserFullscreen = false,
  onToggleBrowserFullscreen,
  floatingChrome = true,
  onFloatingChromeChange,
  deskLeft = BOOK_WORKSPACE_LEFT_BAR_WIDTH,
}: BookBottomChromeProps) {
  const [uncontrolledFloatingChrome, setUncontrolledFloatingChrome] = useState(true)
  const floating =
    onFloatingChromeChange != null ? floatingChrome : uncontrolledFloatingChrome
  const setFloating = onFloatingChromeChange ?? setUncontrolledFloatingChrome

  if (!bookPageNavigationChromeEnabled) return null
  if (!hasResolvedUnit || numPages == null) return null

  const spreadLabel = mapPdfSpreadToDisplayLabel(
    pageNumber,
    spreadRightPage,
    selectedBook,
    selectedUnit,
    numPages,
    numberingMode,
  )
  const pageTotal = getEffectivePageTotal(selectedBook, selectedUnit, numPages)
  const focusToolActive = focusZoomActive || focusZoomDrawActive
  const canResetZoom = pinchZoomActive || focusZoomActive || focusZoomDrawActive
  const boardVisible = isWhiteboardSessionOpen && !isWhiteboardMinimized
  const boardFloating = boardVisible && whiteboardLayoutMode === 'floating'
  const zoomPercent = Math.round(pinchZoomScale * 100)
  const overviewActive = readerLayoutMode === 'pageGrid'
  const canZoomOut =
    bookPinchZoomEnabled &&
    !overviewActive &&
    !focusToolActive &&
    pinchZoomScale > BOOK_PINCH_ZOOM_MIN_SCALE + 1e-6
  const canZoomIn =
    bookPinchZoomEnabled &&
    !overviewActive &&
    !focusToolActive &&
    pinchZoomScale < BOOK_PINCH_ZOOM_MAX_SCALE - 1e-6

  const historyCluster = (
    <ChromeCluster label="Undo and redo" floating={floating}>
      <ChromeIconButton
        label={isWhiteboardOpen ? 'Undo whiteboard' : 'Undo annotation'}
        disabled={overviewActive || !toolbarCaps.canUndo}
        onClick={() => getActiveAnnotationRef().current?.undo()}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </ChromeIconButton>
      <ChromeIconButton
        label={isWhiteboardOpen ? 'Redo whiteboard' : 'Redo annotation'}
        disabled={overviewActive || !toolbarCaps.canRedo}
        onClick={() => getActiveAnnotationRef().current?.redo()}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </ChromeIconButton>
      <ChromeIconButton
        label={isWhiteboardOpen ? 'Clear whiteboard for this page' : 'Clear all ink on this page'}
        disabled={overviewActive}
        onClick={() => getActiveAnnotationRef().current?.clear()}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </ChromeIconButton>
    </ChromeCluster>
  )

  const navCluster = (
    <ChromeCluster label="Page navigation" floating={floating}>
      <ChromeIconButton
        label="Previous spread"
        disabled={
          overviewActive ||
          !visiblePages.length ||
          pageNumber === (visiblePages[0] ?? pageNumber)
        }
        onClick={() => goToAdjacentPage(-1)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </ChromeIconButton>
      <Input
        type="text"
        inputMode="numeric"
        value={pageJumpDraft}
        onChange={(e) => setPageJumpDraft(e.target.value)}
        onFocus={(e) => {
          const input = e.currentTarget
          setPageJumpFocused(true)
          setPageJumpDraft(spreadLabel)
          requestAnimationFrame(() => input.select())
        }}
        onClick={(e) => {
          e.currentTarget.select()
        }}
        onBlur={() => {
          setPageJumpFocused(false)
          commitPageJump()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        aria-label={printedJumpBounds.usePrinted ? 'Go to printed page' : 'Go to PDF page'}
        aria-valuemin={printedJumpBounds.usePrinted ? printedJumpBounds.min : 1}
        aria-valuemax={
          printedJumpBounds.usePrinted
            ? printedJumpBounds.max
            : Math.min(numPages ?? 1, unitPageBounds.max)
        }
        className="h-7 min-w-[3.25rem] max-w-[5rem] border-0 bg-transparent px-1 text-center text-[10px] font-medium text-white shadow-none focus-visible:ring-2 focus-visible:ring-white/35"
      />
      <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/50">
        / {pageTotal}
      </span>
      <ChromeIconButton
        label="Next spread"
        disabled={
          overviewActive ||
          !visiblePages.length ||
          pageNumber === (visiblePages[visiblePages.length - 1] ?? pageNumber)
        }
        onClick={() => goToAdjacentPage(1)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </ChromeIconButton>
    </ChromeCluster>
  )

  const viewCluster = (
    <ChromeCluster label="Zoom and layout" floating={floating}>
      {bookFocusZoomEnabled ? (
        <ChromeIconButton
          label="Focus zoom"
          title="Focus — drag a box to zoom in"
          active={focusToolActive}
          disabled={overviewActive}
          onClick={onFocusZoomDraw}
        >
          <ScanSearch className="h-3.5 w-3.5" />
        </ChromeIconButton>
      ) : null}
      {bookPinchZoomEnabled ? (
        <>
          <ChromeIconButton
            label="Zoom out"
            disabled={!canZoomOut}
            onClick={() => onStepPinchZoom(-1)}
          >
            <Minus className="h-3.5 w-3.5" />
          </ChromeIconButton>
          <button
            type="button"
            className="min-w-[2.75rem] rounded-full px-1 text-center text-[10px] font-medium tabular-nums text-white/85 hover:bg-white/10 disabled:opacity-40"
            disabled={overviewActive || !canResetZoom}
            title="Reset zoom to fit the spread"
            aria-label={`Zoom ${zoomPercent} percent. Click to fit spread.`}
            onClick={onResetZoom}
          >
            {zoomPercent}%
          </button>
          <ChromeIconButton
            label="Zoom in"
            disabled={!canZoomIn}
            onClick={() => onStepPinchZoom(1)}
          >
            <Plus className="h-3.5 w-3.5" />
          </ChromeIconButton>
        </>
      ) : (
        <ChromeIconButton
          label="Fit spread"
          title="Reset zoom to fit the spread"
          disabled={overviewActive || !canResetZoom}
          onClick={onResetZoom}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </ChromeIconButton>
      )}
      <ChromeIconButton
        label={overviewActive ? 'Exit overview' : 'Overview'}
        title={
          overviewActive
            ? 'Back to two-page book view'
            : 'Overview — many pages for retelling'
        }
        active={overviewActive}
        onClick={() => {
          if (overviewActive) onExitPageGridOverview?.()
          else onEnterPageGridOverview?.()
        }}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </ChromeIconButton>
      <ChromeIconButton
        label={showBookFrame ? 'Plain pages' : 'Book look'}
        title={
          showBookFrame
            ? 'Plain pages — hide covers, stacks, curves, and shadows'
            : 'Book look — covers, stacked edges, and page curves'
        }
        active={showBookFrame && !overviewActive}
        disabled={overviewActive}
        onClick={onToggleBookFrame}
      >
        <BookOpen className="h-3.5 w-3.5" />
      </ChromeIconButton>
      {isWhiteboardSessionOpen ? (
        <>
          <ChromeIconButton
            label={isWhiteboardMinimized ? 'Show lesson board' : 'Hide lesson board'}
            title={isWhiteboardMinimized ? 'Restore lesson board' : 'Minimize lesson board'}
            active={!isWhiteboardMinimized}
            onClick={isWhiteboardMinimized ? onExpandWhiteboard : onMinimizeWhiteboard}
          >
            {isWhiteboardMinimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </ChromeIconButton>
          {boardVisible ? (
            <ChromeIconButton
              label={boardFloating ? 'Dock lesson board' : 'Float lesson board'}
              title={boardFloating ? 'Dock board beside the book' : 'Float board over the book'}
              active={boardFloating}
              onClick={boardFloating ? onDockWhiteboard : onFloatWhiteboard}
            >
              <Columns2 className="h-3.5 w-3.5" />
            </ChromeIconButton>
          ) : null}
        </>
      ) : null}
      <BookCaptureMenu
        disabled={!pdfReady || overviewActive}
        busy={captureBusy}
        captureFormat={captureFormat}
        onCaptureFormatChange={setCaptureFormat}
        jpegQuality={jpegQuality}
        onJpegQualityChange={setJpegQuality}
        hideChromeForCapture={hideChromeForCapture}
        onHideChromeForCaptureChange={setHideChromeForCapture}
        watermarkEnabled={watermarkEnabled}
        onWatermarkEnabledChange={setWatermarkEnabled}
        studentDisplayName={studentName}
        onSaveFullStage={() => void runImageCapture({ kind: 'full' })}
        onSaveCurrentPage={() => void runImageCapture({ kind: 'page' })}
        onSelectRegion={() => setRegionSelectOpen(true)}
        onCopyLastCapture={() => void copyLastCaptureToClipboard()}
        canCopyLast={hasLastImageCapture}
        onExportPdfPacket={onExportPdfPacket}
        contentSide="top"
        triggerClassName="h-7 w-7 border-0 bg-transparent text-white shadow-none backdrop-blur-0 hover:bg-white/15"
      />
      {browserFullscreenSupported && onToggleBrowserFullscreen ? (
        <ChromeIconButton
          label={isBrowserFullscreen ? 'Exit browser full screen' : 'Browser full screen'}
          title={
            isBrowserFullscreen
              ? `Exit browser full screen (${SC.browserFullscreen})`
              : `Hide browser tabs and use the whole screen (${SC.browserFullscreen})`
          }
          active={isBrowserFullscreen}
          onClick={onToggleBrowserFullscreen}
        >
          {isBrowserFullscreen ? (
            <Shrink className="h-3.5 w-3.5" />
          ) : (
            <Expand className="h-3.5 w-3.5" />
          )}
        </ChromeIconButton>
      ) : null}
      <ChromeIconButton
        label={floating ? 'Dock bottom controls' : 'Float bottom controls'}
        title={
          floating
            ? 'Join bottom controls into one bar'
            : 'Split bottom controls into floating groups'
        }
        active={floating}
        onClick={() => setFloating(!floating)}
      >
        <PanelTop className="h-3.5 w-3.5" />
      </ChromeIconButton>
    </ChromeCluster>
  )

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[56]',
        floating
          ? 'bottom-3 left-[var(--book-workspace-left-inset)] right-3 flex items-end justify-between gap-2 px-1'
          : 'bottom-0 left-[var(--book-workspace-left-inset)] right-0',
        suppressChrome && 'invisible opacity-0',
      )}
      style={
        {
          '--book-workspace-left-inset': deskLeft,
          '--book-bottom-chrome-height': BOOK_BOTTOM_CHROME_HEIGHT,
        } as CSSProperties
      }
    >
      {floating ? (
        <>
          <div className="pointer-events-auto flex items-center gap-2">{historyCluster}</div>
          <div className="pointer-events-auto flex items-center gap-2">{navCluster}</div>
          <div className="pointer-events-auto flex items-center gap-2">{viewCluster}</div>
        </>
      ) : (
        <div
          className={cn(
            'pointer-events-auto flex h-[var(--book-bottom-chrome-height)] w-full items-center justify-between gap-3 border-t border-white/[0.08] bg-[var(--book-reading-mat)] px-3 text-white',
            suppressChrome && 'pointer-events-none invisible opacity-0',
          )}
          role="toolbar"
          aria-label="Book controls"
        >
          <div className="flex min-w-0 flex-1 items-center justify-start">{historyCluster}</div>
          <div className="flex shrink-0 items-center justify-center">{navCluster}</div>
          <div className="flex min-w-0 flex-1 items-center justify-end">{viewCluster}</div>
        </div>
      )}
    </div>
  )
}

/** @deprecated Use BookBottomChrome — kept for imports during transition. */
export const BookPageNavigation = BookBottomChrome
