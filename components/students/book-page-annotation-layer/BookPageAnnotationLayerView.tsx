'use client'

import type { CSSProperties, MutableRefObject, RefObject } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { AnnotationStorageChannel } from '@/lib/books/annotation-storage'
import type {
  MarqueeSelectMode,
  NormRect,
} from '@/lib/books/annotation-select'
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import { buildAnnotationRenderSlices } from '@/lib/books/annotation-render-slices'
import { BookPageAnnotationDomLayer } from '@/components/students/book-page-annotation-dom-layer'
import { BookOverlayFocusSink } from '@/components/students/book-overlay-focus-sink'
import { SelectionBoundsChrome } from '@/components/students/selection-bounds-chrome'
import {
  MARKER_CANVAS_BLEND,
  domSliceZBoostForCommandKind,
  pageLayerBox,
  sliceStackZ,
} from '@/components/students/book-page-annotation-layer/constants'
import {
  SELECTION_MARQUEE_CROSSING_CLASS,
  SELECTION_MARQUEE_WINDOW_CLASS,
} from '@/lib/books/annotation-selection-chrome'
import { cn } from '@/lib/utils'
import type { TextAnnotationCommand, StickyAnnotationCommand } from '@/lib/books/annotation-command-types'
import type { OrientedSelectionFrame } from '@/lib/books/annotation-select'
export interface BookPageAnnotationLayerViewProps {
  widthPx: number
  heightPx: number
  pageNumber: number
  mode: BookAnnotationInteractionMode
  storageChannel: AnnotationStorageChannel
  textFontId: AnnotationTextFontId
  renderSlices: ReturnType<typeof buildAnnotationRenderSlices>
  paintedCommands: AnnotationCommand[]
  inkSliceRefs: MutableRefObject<(HTMLCanvasElement | null)[]>
  markerSliceRefs: MutableRefObject<(HTMLCanvasElement | null)[]>
  draftInkCanvasRef: RefObject<HTMLCanvasElement | null>
  draftMarkerCanvasRef: RefObject<HTMLCanvasElement | null>
  patchCommand: (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => void
  deleteStickyCommand: (id: string) => void
  deleteTextCommand: (id: string) => void
  focusNewId: string | null
  setFocusNewId: (id: string | null | ((prev: string | null) => string | null)) => void
  isSelect: boolean
  editingId: string | null
  setEditingId: (id: string | null) => void
  handleEditingIdChange: (id: string | null) => void
  marqueeRect: NormRect | null
  marqueeMode: MarqueeSelectMode | null
  showSelectionChrome: boolean
  selectionOutlineFramesList: OrientedSelectionFrame[]
  hoverOutlineFramesList: OrientedSelectionFrame[]
  selectionHandleFrame: OrientedSelectionFrame | null
  showScaleHandles: boolean
  showUnionOutline: boolean
  showRotationHandle: boolean
  draftZ: number
  selectChromeZ: number
  pointerOverlayZ: number
  domZBoost: number
  pointerEventsOnOverlay: boolean
  overlayRef: RefObject<HTMLDivElement | null>
  overlayClass: string
  effectiveOverlayCursor: CSSProperties['cursor']
  onOverlayPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onOverlayPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onOverlayPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onOverlayPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void
  onSelectDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void
  onPointerLeave: () => void
  textToolActive: boolean
  textInputEnabled: boolean
  textToolHoverFrames: OrientedSelectionFrame[]
  textToolEditingFrames: OrientedSelectionFrame[]
  onEditingTextDraftChange?: (text: string | null) => void
  pasteRevealIds?: ReadonlySet<string>
}

export function BookPageAnnotationLayerView({
  widthPx,
  heightPx,
  pageNumber,
  mode,
  storageChannel,
  textFontId,
  renderSlices,
  paintedCommands,
  inkSliceRefs,
  markerSliceRefs,
  draftInkCanvasRef,
  draftMarkerCanvasRef,
  patchCommand,
  deleteStickyCommand,
  deleteTextCommand,
  focusNewId,
  setFocusNewId,
  isSelect,
  editingId,
  setEditingId,
  handleEditingIdChange,
  marqueeRect,
  marqueeMode,
  showSelectionChrome,
  selectionOutlineFramesList,
  hoverOutlineFramesList,
  selectionHandleFrame,
  showScaleHandles,
  showUnionOutline,
  showRotationHandle,
  draftZ,
  selectChromeZ,
  pointerOverlayZ,
  domZBoost,
  pointerEventsOnOverlay,
  overlayRef,
  overlayClass,
  effectiveOverlayCursor,
  onOverlayPointerDown,
  onOverlayPointerMove,
  onOverlayPointerUp,
  onOverlayPointerCancel,
  onSelectDoubleClick,
  onPointerLeave,
  textToolActive,
  textInputEnabled,
  textToolHoverFrames,
  textToolEditingFrames,
  onEditingTextDraftChange,
  pasteRevealIds,
}: BookPageAnnotationLayerViewProps) {
  let inkSliceIdx = 0
  let markerSliceIdx = 0
  const pageBox = (zIndex: number): CSSProperties => pageLayerBox(widthPx, heightPx, zIndex)

  return (
    <div className="absolute inset-0">
      {renderSlices.map((slice) => {
        if (slice.kind === 'ink') {
          const idx = inkSliceIdx++
          const isFirstInk = idx === 0
          const z = sliceStackZ(slice.zIndex)
          return (
            <canvas
              key={`ink-${slice.zIndex}-${slice.indices.join(',')}`}
              ref={(el) => {
                inkSliceRefs.current[idx] = el
              }}
              role={isFirstInk ? 'img' : undefined}
              aria-label={isFirstInk ? `Annotations for page ${pageNumber}` : undefined}
              className="pointer-events-none"
              style={pageBox(z)}
            />
          )
        }
        if (slice.kind === 'marker') {
          const idx = markerSliceIdx++
          const z = sliceStackZ(slice.zIndex)
          return (
            <canvas
              key={`marker-${slice.zIndex}-${slice.indices.join(',')}`}
              ref={(el) => {
                markerSliceRefs.current[idx] = el
              }}
              aria-hidden
              className="pointer-events-none"
              style={{ ...pageBox(z), ...MARKER_CANVAS_BLEND }}
            />
          )
        }
        const sliceCommands = slice.indices.map((i) => paintedCommands[i]!)
        const sliceCmd = sliceCommands[0]!
        return (
          <BookPageAnnotationDomLayer
            key={`dom-${slice.zIndex}`}
            widthPx={widthPx}
            heightPx={heightPx}
            zIndex={
              sliceStackZ(slice.zIndex) +
              domSliceZBoostForCommandKind(sliceCmd.kind, domZBoost > 0)
            }
            defaultTextFontId={textFontId}
            commands={sliceCommands}
            onUpdateCommand={patchCommand}
            onDeleteSticky={deleteStickyCommand}
            onDeleteText={deleteTextCommand}
            focusNewId={focusNewId}
            onConsumedFocusNew={() => setFocusNewId(null)}
            selectMode={isSelect}
            textToolActive={textToolActive}
            textInputEnabled={textInputEnabled}
            editingId={editingId}
            onEditingIdChange={handleEditingIdChange}
            onEditingTextDraftChange={onEditingTextDraftChange}
            coachField={storageChannel === 'whiteboard' ? 'whiteboard' : 'label'}
            pasteRevealIds={pasteRevealIds}
          />
        )
      })}
      <canvas
        ref={draftInkCanvasRef}
        aria-hidden
        className="pointer-events-none"
        style={pageBox(draftZ)}
      />
      <canvas
        ref={draftMarkerCanvasRef}
        aria-hidden
        className="pointer-events-none"
        style={{ ...pageBox(draftZ), ...MARKER_CANVAS_BLEND }}
      />
      {showSelectionChrome || textToolHoverFrames.length > 0 || textToolEditingFrames.length > 0 ? (
        <div
          className="pointer-events-none"
          style={{ ...pageBox(selectChromeZ + domZBoost) }}
          aria-hidden
        >
          {showSelectionChrome ? (
            <>
              {marqueeRect ? (
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
          <SelectionBoundsChrome
            outlineFrames={selectionOutlineFramesList}
            handleFrame={selectionHandleFrame}
            showHandles={showScaleHandles}
            showUnionOutline={showUnionOutline}
            showRotationHandle={showRotationHandle}
            layoutWidthPx={widthPx}
            layoutHeightPx={heightPx}
          />
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
            </>
          ) : null}
          {textToolHoverFrames.length > 0 ? (
            <SelectionBoundsChrome
              outlineFrames={textToolHoverFrames}
              handleFrame={null}
              showHandles={false}
              variant="hover"
              layoutWidthPx={widthPx}
              layoutHeightPx={heightPx}
            />
          ) : null}
          {textToolEditingFrames.length > 0 ? (
            <SelectionBoundsChrome
              outlineFrames={textToolEditingFrames}
              handleFrame={null}
              showHandles={false}
              variant="selection"
              layoutWidthPx={widthPx}
              layoutHeightPx={heightPx}
            />
          ) : null}
        </div>
      ) : null}
      <div
        ref={overlayRef}
        role="presentation"
        className={overlayClass}
        style={{
          ...pageBox(pointerOverlayZ + domZBoost),
          cursor: effectiveOverlayCursor,
          pointerEvents: pointerEventsOnOverlay ? 'auto' : 'none',
        }}
        onPointerDown={onOverlayPointerDown}
        onPointerMove={onOverlayPointerMove}
        onPointerUp={onOverlayPointerUp}
        onPointerCancel={onOverlayPointerCancel}
        onDoubleClick={isSelect ? onSelectDoubleClick : undefined}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => {
          if ((e.nativeEvent as PointerEvent).pointerType === 'pen') e.preventDefault()
        }}
      >
        <BookOverlayFocusSink />
      </div>
    </div>
  )
}
