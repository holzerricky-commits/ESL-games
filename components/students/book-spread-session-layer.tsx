'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import type { LiveEraserLineDraft, LiveStrokeDraft } from '@/components/students/book-page-annotation-layer'
import type { MutableRefObject } from 'react'
import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { eraserLineTrailingForReplay } from '@/lib/books/annotation-live-paint'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import { buildAnnotationRenderSlices } from '@/lib/books/annotation-render-slices'
import type { InkSessionNudgePreview } from '@/lib/books/ink-session-store'
import {
  resolveSelectClickTargetIds,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'
import { clampSelectionMoveDelta } from '@/lib/books/annotation-scale'
import { isWritableStickerInteraction } from '@/lib/books/sticker-tool'
import {
  commitRotatedAnnotationCommands,
  committedRotationFrameFromGesture,
  isRotateCommitOverlaySynced,
  mergeRotatedCommandOverlay,
  rotatedCommandsFromCommitOverlay,
} from '@/lib/books/annotation-rotation'
import {
  SELECTION_MARQUEE_CROSSING_CLASS,
  SELECTION_MARQUEE_WINDOW_CLASS,
} from '@/lib/books/annotation-selection-chrome'
import { SelectionBoundsChrome } from '@/components/students/selection-bounds-chrome'
import { useInkSessionCanvasPaint } from '@/components/students/ink-session-selection/useInkSessionCanvasPaint'
import { useInkSessionSelectionInteraction } from '@/components/students/ink-session-selection/useInkSessionSelectionInteraction'
import {
  clientToWhiteboardDocumentNorm,
  clientToWhiteboardDocumentNormFromContent,
  clientToWhiteboardDocumentNormFromScrollport,
  isWhiteboardDocumentScrollPaint,
  isWhiteboardViewportInkActive,
  projectCommandsForWhiteboardViewport,
  type WhiteboardViewportInkConfig,
} from '@/lib/books/whiteboard-viewport-ink'
import { BookPageAnnotationDomLayer } from '@/components/students/book-page-annotation-dom-layer'
import { BookOverlayFocusSink } from '@/components/students/book-overlay-focus-sink'
import {
  DOM_ABOVE_INK_SESSION_Z_BOOST,
  sliceStackZ,
} from '@/components/students/book-page-annotation-layer/constants'
import {
  type SpreadSessionDomConfig,
  useSpreadSessionDomInteraction,
} from '@/components/students/fullscreen-book-overlay/hooks/useSpreadSessionDomInteraction'
import { cn } from '@/lib/utils'

type BookSpreadSessionLayerProps = {
  widthPx: number
  heightPx: number
  commands: AnnotationCommand[]
  /** When set, `commands` are document-space; tall runway uses scroll paint, not viewport projection. */
  viewportInk?: WhiteboardViewportInkConfig
  /** Scroll container for pointer → document coords when painting the full runway. */
  scrollportRef?: MutableRefObject<HTMLElement | null>
  /** Tall content root — preferred for pointer mapping (moves with scroll). */
  contentCaptureRef?: MutableRefObject<HTMLElement | null>
  trailingEraserLineDraft?: LiveEraserLineDraft | null
  /** Whiteboard live highlighter; book spread uses per-page multiply layers. */
  trailingMarkerStrokeDraft?: LiveStrokeDraft | null
  selectEnabled?: boolean
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  onMoveSelectedBy?: (dx: number, dy: number) => void
  onScaleSelectedBy?: (startFrame: OrientedSelectionFrame, newFrame: OrientedSelectionFrame) => void
  onRotateSelectedBy?: (
    pivot: [number, number],
    deltaRad: number,
    ids: string[],
    previewBase?: readonly AnnotationCommand[] | null,
    groupRotationFrame?: OrientedSelectionFrame | null,
  ) => void
  /** Live keyboard nudge (committed by store / page layer on keyup). */
  nudgePreview?: InkSessionNudgePreview | null
  /** Book spread: text/sticky on session layer (omit on whiteboard until parity). */
  domConfig?: SpreadSessionDomConfig | null
}

export function BookSpreadSessionLayer({
  widthPx,
  heightPx,
  commands,
  viewportInk,
  scrollportRef,
  contentCaptureRef,
  trailingEraserLineDraft = null,
  trailingMarkerStrokeDraft = null,
  selectEnabled = false,
  selectedIds = [],
  onSelectedIdsChange,
  onMoveSelectedBy,
  onScaleSelectedBy,
  onRotateSelectedBy,
  nudgePreview = null,
  domConfig = null,
}: BookSpreadSessionLayerProps) {
  const documentScrollPaint = Boolean(
    viewportInk && isWhiteboardDocumentScrollPaint(viewportInk, heightPx),
  )
  const tallRunwayDocumentLayout = Boolean(
    viewportInk && isWhiteboardViewportInkActive(viewportInk),
  )
  const useDocumentCanvasLayout = documentScrollPaint || tallRunwayDocumentLayout
  const [rotateCommitOverlay, setRotateCommitOverlay] = useState<AnnotationCommand[] | null>(null)
  const [rotateCommitFrame, setRotateCommitFrame] = useState<OrientedSelectionFrame | null>(null)
  const effectiveCommands = useMemo(
    () => mergeRotatedCommandOverlay(commands, rotateCommitOverlay),
    [commands, rotateCommitOverlay],
  )
  useEffect(() => {
    if (!rotateCommitOverlay) return
    if (isRotateCommitOverlaySynced(rotateCommitOverlay, commands)) {
      setRotateCommitOverlay(null)
    }
  }, [commands, rotateCommitOverlay])

  useEffect(() => {
    setRotateCommitFrame(null)
  }, [selectedIds])
  /** Paint may viewport-project only for short-canvas fallback; tall runway always document-space. */
  const paintCommands = useMemo(
    () =>
      viewportInk && !documentScrollPaint && !tallRunwayDocumentLayout
        ? projectCommandsForWhiteboardViewport(effectiveCommands, viewportInk)
        : effectiveCommands,
    [effectiveCommands, documentScrollPaint, viewportInk, tallRunwayDocumentLayout],
  )
  /** Hit-test / bounds / rotate always use document-space commands when on a lesson board. */
  const selectCommands = viewportInk ? effectiveCommands : paintCommands
  /** Book spread: multiply highlighter above each PDF; whiteboard uses this layer. */
  const markersOnSessionLayer = Boolean(viewportInk)
  const zoomRepaintRevision = useBrowserZoomRepaintRevision()
  const [repaintEpoch, setRepaintEpoch] = useState(0)

  const trailingEraser = useMemo(
    () => eraserLineTrailingForReplay(null, trailingEraserLineDraft),
    [trailingEraserLineDraft],
  )
  const deadIndices = useMemo(
    () => computeEraserLineDeadIndices(selectCommands, trailingEraser),
    [selectCommands, trailingEraser],
  )
  const deadKey = useMemo(() => [...deadIndices].sort((a, b) => a - b).join(','), [deadIndices])

  const toNorm = useCallback(
    (el: HTMLDivElement, clientX: number, clientY: number): [number, number] | null => {
      if (viewportInk) {
        const contentEl = contentCaptureRef?.current
        if (contentEl) {
          return clientToWhiteboardDocumentNormFromContent(
            viewportInk,
            contentEl.getBoundingClientRect(),
            clientX,
            clientY,
          )
        }
        const scrollport = scrollportRef?.current
        if (scrollport && isWhiteboardViewportInkActive(viewportInk)) {
          return clientToWhiteboardDocumentNormFromScrollport(
            viewportInk,
            scrollport.getBoundingClientRect(),
            clientX,
            clientY,
          )
        }
      }
      const r = el.getBoundingClientRect()
      if (!(r.width > 0) || !(r.height > 0)) return null
      if (viewportInk) {
        return clientToWhiteboardDocumentNorm(viewportInk, r, clientX, clientY)
      }
      const nx = (clientX - r.left) / r.width
      const ny = (clientY - r.top) / r.height
      return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))]
    },
    [contentCaptureRef, scrollportRef, viewportInk],
  )

  const resolveClickTarget = useCallback(
    (cmd: AnnotationCommand) =>
      resolveSelectClickTargetIds(selectCommands, cmd, widthPx, heightPx, deadIndices),
    [deadIndices, heightPx, selectCommands, widthPx],
  )

  const domConfigWithNorm = useMemo(
    () => (domConfig ? { ...domConfig, toNorm } : null),
    [domConfig, toNorm],
  )
  const dom = useSpreadSessionDomInteraction(domConfigWithNorm)

  const selection = useInkSessionSelectionInteraction(
    {
      enabled: selectEnabled,
      hitTestCommands: selectCommands,
      paintCommands,
      selectedIds,
      widthPx,
      heightPx,
      deadIndices,
      editingId: dom.editingId,
      onClearEditing: dom.clearActiveEdit,
      rotateCommitFrame,
      nudgePreview,
      clearSelectionOnEmptyClick: false,
      marqueeSelectRule: 'follow-drag',
      onSelectedIdsChange: (ids) => onSelectedIdsChange?.(ids),
      onMoveCommitted: (dx, dy) => onMoveSelectedBy?.(dx, dy),
      onScaleCommitted: (start, end) => onScaleSelectedBy?.(start, end),
      onScaleCommitFrame: (frame) => setRotateCommitFrame(frame),
      onRotateCommitted: ({
        pivot,
        deltaRad,
        ids,
        previewBase,
        rotationStartFrame,
      }) => {
        const committed = commitRotatedAnnotationCommands(
          selectCommands,
          new Set(ids),
          pivot,
          deltaRad,
          { widthPx, heightPx },
          previewBase,
          rotationStartFrame,
        )
        setRotateCommitOverlay(rotatedCommandsFromCommitOverlay(committed, ids))
        setRotateCommitFrame(
          committedRotationFrameFromGesture(rotationStartFrame, deltaRad, ids.length),
        )
        onRotateSelectedBy?.(pivot, deltaRad, ids, previewBase, rotationStartFrame)
      },
      onRotateCommitRepaint: () => setRepaintEpoch((n) => n + 1),
      resolveClickTargetIds: resolveClickTarget,
      clampMoveDelta: (dx, dy, moveIds) =>
        clampSelectionMoveDelta(selectCommands, moveIds, dx, dy, widthPx, heightPx, {
          deadIndices,
        }),
    },
    toNorm,
  )

  const {
    displayCommands: paintDisplayCommands,
    chrome,
    marqueeRect,
    marqueeMode,
    selectScaleLiveFrame,
    selectDragLive,
    effectiveCursor,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    clearSelectionHover,
  } = selection

  const {
    selectionOutlineFramesList,
    hoverOutlineFramesList,
    selectionHandleFrame,
    showScaleHandles,
    showUnionOutline,
    showRotationHandle,
  } = chrome

  const { inkSliceRefs, markerSliceRefs, trailingMarkerCanvasRef } = useInkSessionCanvasPaint({
    widthPx,
    heightPx,
    paintDisplayCommands,
    deadIndices,
    deadKey,
    markersOnSessionLayer,
    trailingMarkerStrokeDraft,
    selectScaleLiveFrame,
    selectDragLive,
    zoomRepaintRevision,
    repaintEpoch,
  })

  const renderSlices = buildAnnotationRenderSlices(selectCommands, deadIndices)
  let inkIdx = 0
  let markerIdx = 0
  const domZBoost = domConfig?.enabled ? DOM_ABOVE_INK_SESSION_Z_BOOST : 0
  const domMode = domConfig?.mode
  const domTextTool = domMode === 'text'
  const domWritableStickerTool =
    domMode === 'sticky' ||
    (domMode === 'sticker' && isWritableStickerInteraction(domMode, domConfig?.stickerKind ?? 'writable'))

  const hasSelection = selectedIds.length > 0
  const showTextToolHover = dom.textToolHoverFrames.length > 0 && !selectEnabled
  const showTextToolEditing =
    dom.textToolEditingFrames.length > 0 && dom.toolPointerEnabled && !selectEnabled
  /** Outlines stay visible after Ctrl+A etc. even when another tool is active. */
  const showSelectionVisual =
    hasSelection ||
    hoverOutlineFramesList.length > 0 ||
    showTextToolHover ||
    showTextToolEditing ||
    (selectEnabled && marqueeRect != null)
  const interactPointerActive = selectEnabled || dom.toolPointerEnabled
  /** Lift ink + chrome above live-draw overlay when something is selected (still pass-through unless select tool). */
  const elevateForSelectionChrome = selectEnabled || hasSelection || dom.toolPointerEnabled

  return (
    <div
      ref={dom.overlayRef}
      className={cn(
        'absolute inset-0 touch-none',
        elevateForSelectionChrome ? 'z-[40]' : 'z-[24]',
      )}
      style={{
        width: widthPx > 0 ? widthPx : undefined,
        height: heightPx > 0 ? heightPx : undefined,
        pointerEvents: interactPointerActive ? 'auto' : 'none',
        cursor: selectEnabled
          ? effectiveCursor
          : dom.toolPointerEnabled
            ? dom.textToolCursor
            : undefined,
      }}
      aria-hidden={!domConfig?.enabled}
      onPointerDown={selectEnabled ? onPointerDown : dom.toolPointerEnabled ? dom.onToolPointerDown : undefined}
      onPointerMove={
        selectEnabled ? onPointerMove : dom.toolPointerEnabled ? dom.onToolPointerMove : undefined
      }
      onPointerUp={selectEnabled ? onPointerUp : dom.toolPointerEnabled ? dom.onToolPointerUp : undefined}
      onPointerCancel={
        selectEnabled ? onPointerCancel : dom.toolPointerEnabled ? dom.onToolPointerCancel : undefined
      }
      onPointerLeave={
        selectEnabled ? clearSelectionHover : dom.toolPointerEnabled ? dom.clearToolHover : undefined
      }
      onDoubleClick={
        domConfig?.enabled && selectEnabled ? dom.onSelectDoubleClick : undefined
      }
    >
      <BookOverlayFocusSink />
      {renderSlices.map((slice) => {
        if (slice.kind === 'ink') {
          const idx = inkIdx++
          return (
            <canvas
              key={`spread-ink-${slice.zIndex}`}
              ref={(el) => {
                inkSliceRefs.current[idx] = el
              }}
              className={cn(
                'pointer-events-none absolute',
                useDocumentCanvasLayout ? 'left-0 top-0' : 'inset-0',
              )}
            />
          )
        }
        if (slice.kind === 'marker' && markersOnSessionLayer) {
          const idx = markerIdx++
          return (
            <canvas
              key={`spread-marker-${slice.zIndex}`}
              ref={(el) => {
                markerSliceRefs.current[idx] = el
              }}
              className={cn(
                'pointer-events-none absolute',
                useDocumentCanvasLayout ? 'left-0 top-0' : 'inset-0',
              )}
              style={{ mixBlendMode: 'multiply' }}
            />
          )
        }
        if (slice.kind === 'dom' && domConfig?.enabled) {
          const sliceCommands = slice.indices.map((i) => selectCommands[i]!)
          return (
            <BookPageAnnotationDomLayer
              key={`spread-dom-${slice.zIndex}`}
              widthPx={widthPx}
              heightPx={heightPx}
              zIndex={sliceStackZ(slice.zIndex) + domZBoost}
              defaultTextFontId={domConfig.textFontId}
              commands={sliceCommands}
              onUpdateCommand={dom.patchCommand}
              onDeleteSticky={dom.deleteStickyCommand}
              onDeleteText={dom.deleteTextCommand}
              focusNewId={dom.focusNewId}
              onConsumedFocusNew={() => dom.setFocusNewId(null)}
              selectMode={selectEnabled}
              textToolActive={domTextTool || domWritableStickerTool}
              textInputEnabled={dom.textInputEnabled}
              editingId={dom.editingId}
              onEditingIdChange={dom.setEditingId}
              onEditingTextDraftChange={dom.onEditingTextDraftChange}
              coachField={viewportInk ? 'whiteboard' : 'label'}
            />
          )
        }
        return null
      })}
      {markersOnSessionLayer &&
      trailingMarkerStrokeDraft &&
      trailingMarkerStrokeDraft.points.length >= 1 ? (
        <canvas
          key="spread-marker-trailing"
          ref={trailingMarkerCanvasRef}
          className={cn(
            'pointer-events-none absolute',
            useDocumentCanvasLayout ? 'left-0 top-0' : 'inset-0',
          )}
          style={{ mixBlendMode: 'multiply', zIndex: paintCommands.length + 2 }}
        />
      ) : null}
      {showSelectionVisual ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {selectEnabled && marqueeRect ? (
            <div
              className={cn(
                'absolute box-border',
                marqueeMode === 'window'
                  ? SELECTION_MARQUEE_WINDOW_CLASS
                  : SELECTION_MARQUEE_CROSSING_CLASS,
              )}
              style={{
                left: `${marqueeRect.x * 100}%`,
                top: `${marqueeRect.y * 100}%`,
                width: `${marqueeRect.w * 100}%`,
                height: `${marqueeRect.h * 100}%`,
              }}
            />
          ) : null}
          {hasSelection ? (
            <SelectionBoundsChrome
              outlineFrames={selectionOutlineFramesList}
              handleFrame={selectionHandleFrame}
              showHandles={showScaleHandles}
              showUnionOutline={showUnionOutline}
              showRotationHandle={showRotationHandle}
              layoutWidthPx={widthPx}
              layoutHeightPx={heightPx}
            />
          ) : null}
          {hoverOutlineFramesList.length > 0 ? (
            <SelectionBoundsChrome
              outlineFrames={hoverOutlineFramesList}
              handleFrame={null}
              showHandles={false}
              variant="hover"
              layoutWidthPx={widthPx}
              layoutHeightPx={heightPx}
            />
          ) : null}
          {showTextToolHover ? (
            <SelectionBoundsChrome
              outlineFrames={dom.textToolHoverFrames}
              handleFrame={null}
              showHandles={false}
              variant="hover"
              layoutWidthPx={widthPx}
              layoutHeightPx={heightPx}
            />
          ) : null}
          {showTextToolEditing ? (
            <SelectionBoundsChrome
              outlineFrames={dom.textToolEditingFrames}
              handleFrame={null}
              showHandles={false}
              variant="selection"
              layoutWidthPx={widthPx}
              layoutHeightPx={heightPx}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
