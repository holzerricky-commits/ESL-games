'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import {
  clearAnnotationCanvas,
  drawStrokePath,
  applyAnnotationCanvasDpr,
  replayInkSlice,
  replayMarkerSlice,
} from '@/lib/books/annotation-draw'
import {
  buildAnnotationRenderSlices,
  draftOverlayZIndex,
} from '@/lib/books/annotation-render-slices'
import {
  isInkSessionDelegatedCanvasCommand,
  isSpreadSessionOwnedCommand,
  pageLayerCommandsExcludingSpreadSessionIds,
  pageLayerCommandsWhenSpreadDelegated,
  pageLayerCanvasCommandsWhenWhiteboardInkDelegated,
} from '@/lib/books/ink-session-page-layer'
import {
  eraserLineTrailingForReplay,
  strokeToolSkipsCommittedReplayOnLivePaint,
  type AnnotationPaintOptions,
} from '@/lib/books/annotation-live-paint'
import { subscribeBrushPatternTileLoads } from '@/lib/books/brush-pattern-loader'
import { attachPenInkPatternPhase, type PenInkPatternOrigin } from '@/lib/books/pen-ink'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import {
  DEFAULT_STAMP_QUESTION_COLOR,
  DEFAULT_TEXT_FILL_COLOR,
  stampColorForVariant,
} from '@/lib/books/annotation-palettes'
import { drawTwoPointShapePreview } from '@/lib/books/two-point-shape-preview'
import {
  shapeFillAlphaForMode,
  type AnnotationCommand,
  type ArrowAnnotationCommand,
  type EllipseAnnotationCommand,
  type FlashcardAnnotationCommand,
  type ImageAnnotationCommand,
  type LineAnnotationCommand,
  type RectAnnotationCommand,
  type TriangleAnnotationCommand,
  type StampVariant,
  type StrokeAnnotationCommand,
  type StickyAnnotationCommand,
  type TextAnnotationCommand,
  type TextAnnotationVisualStyle,
  type AnnotationLineDashStyle,
  type ShapeFillMode,
  type StrokeTool,
} from '@/lib/books/annotation-command-types'
import { mergeWhiteboardLegacyWithSession } from '@/lib/books/whiteboard-session-persist'
import { inkSessionPageLayerDemotionEnabled } from '@/lib/books/feature-flags'
import {
  pageLayerCommandsForLoad,
  pageLayerCommandsForPersist,
} from '@/lib/books/ink-session-page-persist'
import {
  downscaleImageFile,
  resolvePastedBoardImage,
  resolvePastedBoardImageFromNavigatorClipboard,
  type PasteImageOutcome,
  type PastedBoardImageResolution,
} from '@/lib/books/clipboard-image'
import { buildImageCommandFromEncoded } from '@/lib/books/board-image-commit'
import { fetchBoardImageAsFile } from '@/lib/board-image-import-client'
import {
  fitFlashcardNormBox,
  FLASHCARD_PLACEHOLDER_ZH,
} from '@/lib/lesson-board/lesson-board-flashcard-layout'
import {
  readPlainTextFromNavigatorClipboard,
  sanitizePastedPlainText,
  textPasteNormPoint,
} from '@/lib/books/clipboard-text'
import {
  getBoardPasteAnchorNorm,
  pasteOffsetForAnchor,
} from '@/lib/books/board-paste-placement'
import { registerPasteRevealIds } from '@/lib/books/board-paste-reveal'
import { notifyStampPlaced } from '@/lib/books/notify-stamp-placed'
import {
  getAnnotationsForPage,
  getAnnotationsForStorageKey,
  setAnnotationsForPage,
  setAnnotationsForStorageKey,
} from '@/lib/books/annotation-storage'
import {
  strokeWidthScaleForStrokeTool,
} from '@/lib/books/annotation-stroke-utils'
import {
  effectiveStrokeToolForPointer,
  isAnnotationPointerDownAccepted,
} from '@/lib/books/pen-barrel-button'
import {
  buildHoldMarkerLineStrokeCommand,
  buildHoldShapeCommand,
} from '@/lib/books/hold-shape-commit'
import {
  createStrokeHoldStraightTracker,
  resetStrokeHoldStraightTracker,
  feedStrokeHoldStraightMove,
} from '@/lib/books/stroke-hold-straight'
import {
  extendStrokeDraftFromMove,
  finalizeStrokeDraftEndPoint,
  shouldUseStraightStrokeLine,
  type StraightStrokeAxis,
} from '@/lib/books/stroke-straight-line'
import {
  recognizeHoldShapeFromStroke,
  snapHoldShapeDraftOnActivate,
  updateHoldShapeDraftAtPointer,
  type HoldShapeDraft,
} from '@/lib/books/stroke-shape-recognition'
import { roundedCornersFieldForCommit } from '@/lib/books/shape-rounded-corners'
import { coalescedPointerEvents } from '@/lib/books/stroke-pointer-samples'
import { ensureStrokeCommitPoints } from '@/lib/books/stroke-tap-dot'
import { resolveAnnotationToolCursor } from '@/lib/books/annotation-tool-cursor'
import {
  annotationIdsInMarquee,
  hitTestAnnotationIndex,
  hitTestTextAnnotationIndex,
  hitTestSelectedAnnotationIndex,
  normalizeMarqueeRect,
  resolveMarqueeSelectMode,
  resolveSelectionHandleFrame,
  selectionOutlineFramesForChrome,
  selectionIdsMatch,
  resolveSelectClickTargetIds,
  translateAnnotationCommands,
  filterUnlockedTransformIds,
  selectAllCommandIds,
  type GroupSelectionChrome,
  type MarqueeSelectMode,
  type MarqueeSelectRule,
  type NormRect,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'
import { alignSelectedCommands, type HorizontalAlignAxis } from '@/lib/books/annotation-align'
import { moveCommandsInStack } from '@/lib/books/annotation-layer-order'
import {
  autoGroupPenStrokeAfterCommit,
  lockPenFigureAutoJoinOnCommands,
  stampPenStrokeOnCommit,
} from '@/lib/books/annotation-pen-auto-group'
import {
  applySelectionChange,
  selectNextStackId,
  selectionChangeModeFromPointerKeys,
  type SelectionChangeMode,
} from '@/lib/books/annotation-selection-ops'
import {
  assignFigureGroupId,
  clearFigureGroupId,
  newFigureGroupId,
  shouldToggleSelectionToUngroup,
} from '@/lib/books/annotation-figure-group'
import {
  duplicateCommandsForPaste,
  getAnnotationClipboard,
  hasAnnotationClipboard,
  setAnnotationClipboard,
} from '@/lib/books/annotation-clipboard'
import { cursorForRotationHandle } from '@/lib/books/annotation-selection-chrome'
import {
  angleFromPivotToPoint,
  commitRotatedAnnotationCommands,
  committedRotationFrameFromGesture,
  hitTestRotationHandleForFrame,
  isRotateCommitOverlaySynced,
  prepareRotationGestureState,
  mergeRotatedCommandOverlay,
  rotateAnnotationCommands,
  rotatedCommandsFromCommitOverlay,
  rotatableIdsInSelection,
  selectionHasRotatableShapes,
} from '@/lib/books/annotation-rotation'
import {
  clampSelectionMoveDelta,
  cursorForScaleHandleOnFrame,
  hitTestScaleHandleForFrame,
  resizeOrientedFrameFromHandle,
  scaleAnnotationCommandsFromOrientedFrames,
  type ScaleHandleId,
} from '@/lib/books/annotation-scale'
import { resolveSelectMoveIdsForDrag } from '@/lib/books/ink-session-select-move'
import {
  commitBookOverlayTypingTarget,
  endBookOverlayAnnotationEditingFocus,
  isAnnotationTextFieldFocused,
  setBookOverlayAnnotationEditSessionId,
} from '@/lib/books/book-overlay-keyboard-guards'
import { shouldDismissBookOverlayAnnotationEditOnPointerDown } from '@/lib/books/book-overlay-typing-dismiss'
import {
  isQuickStickerInteraction,
  isWritableStickerInteraction,
} from '@/lib/books/sticker-tool'
import {
  defaultWritableStickerFill,
  defaultWritableStickerSize,
} from '@/lib/books/writable-sticker-visuals'
import {
  textLabelAlignOrDefault,
  textLabelPlacementFromClick,
} from '@/lib/books/text-label-layout'
import {
  resolveTextToolHoverTargetId,
  textToolEditingOutlineFrames,
  textToolHoverOutlineFrames,
  textToolPlacementCursor,
} from '@/lib/books/text-tool-hover'
import type { PenStrokeProfile } from '@/lib/books/pen-stroke-profile'
import { useLessonCoachSyncActions } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { cn } from '@/lib/utils'
import {
  DOM_ABOVE_INK_SESSION_Z_BOOST,
  MARQUEE_MIN_AREA,
  TAP_MOVE_EPS,
  TWO_POINT_EPS,
  sliceStackZ,
} from '@/components/students/book-page-annotation-layer/constants'
import {
  activeLiveStrokeDraftForPaint,
  canIncrementallyAppendDraftSegment,
  clamp01,
  cloneCommandStack,
  eraserDeadIndicesKey,
  incrementalDraftSegmentPoints,
  liveStrokeDrawOptions,
  newAnnotationId,
  nextCalloutIndex,
  normalizeRect,
  sizeAnnotationPageCanvas,
} from '@/components/students/book-page-annotation-layer/helpers'
import type {
  BookPageAnnotationHandle,
  BookPageAnnotationLayerProps,
  IncrementalDraftState,
  LiveEraserLineDraft,
  LiveStrokeDraft,
  LiveTwoPointDraft,
  TapMode,
  TwoPointDraft,
} from '@/components/students/book-page-annotation-layer/types'
import type { BookPageAnnotationLayerViewProps } from '@/components/students/book-page-annotation-layer/BookPageAnnotationLayerView'
import { useBoardPasteReveal } from '@/components/students/book-page-annotation-layer/hooks/useBoardPasteReveal'
import { useInkSessionSelectionInteraction } from '@/components/students/ink-session-selection/useInkSessionSelectionInteraction'

function pageLocalSelectedIds(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  sessionOwnsCanvasInk: boolean,
): string[] {
  if (!sessionOwnsCanvasInk) return [...selectedIds]
  return selectedIds.filter((id) => {
    const cmd = commands.find((c) => c.id === id)
    return cmd != null && !isSpreadSessionOwnedCommand(cmd)
  })
}

const EMPTY_SPREAD_SESSION_PAINT_COMMAND_IDS: readonly string[] = []

export function useBookPageAnnotationLayer(
  props: BookPageAnnotationLayerProps,
  ref: Ref<BookPageAnnotationHandle>,
): BookPageAnnotationLayerViewProps | null {
  const {
      studentId,
      bookId,
      unitId,
      pageNumber,
      storageChannel = 'pdf',
      storagePageKey,
      widthPx,
      heightPx,
      mode,
      eyedropperVariant = 'sample',
      stickerKind = 'quick',
      writableStickerVariant = 'note',
      stampVariant,
      stampQuestionColor = DEFAULT_STAMP_QUESTION_COLOR,
      strokeWidthScale,
      eraserLineStrokeWidthScale,
      penStrokeWidthScale,
      shapeStrokeWidthScale,
      stampScale,
      strokeColor,
      penInkColor,
      penInkStyle,
      penStrokeProfile,
      penInkPatternOriginXPx = 0,
      penInkPatternOriginYPx = 0,
      strokeLineDashStyle = 'solid',
      markerStraightStroke = false,
      markerDecoratedEdge = false,
      penAutoGroupConnected = true,
      marqueeSelectRule = 'follow-drag',
      shapeColor,
      textColor,
      shapeLineDashStyle = 'solid',
      shapeStrokeEnabled = true,
      shapeFillMode = 'none',
      shapeFillColor = '#eab308',
      shapeRoundedCorners = true,
      textFontSizeNorm,
      textFontId,
      stickyFontSizeNorm,
      textVisualStyle = 'plain',
      textAlign = 'left',
      textFillColor = DEFAULT_TEXT_FILL_COLOR,
      stickyFillColor = '#fef3c7',
      defaultStickyWNorm,
      defaultStickyHNorm,
      onPointerSessionStart,
      onEyedropperPick,
      onCapabilitiesChange,
      delegatePointerToSpread = false,
      delegatePointerToWhiteboardPen = false,
      spreadInkDelegated = false,
      spreadSessionOwnsPagePaint = false,
      spreadSessionPaintCommandIds = EMPTY_SPREAD_SESSION_PAINT_COMMAND_IDS,
      whiteboardPenInkDelegated = false,
      whiteboardInkDelegated = false,
      whiteboardSessionStoreRef,
      onSelectionMoveCommitted,
      onSpreadCanvasCommandCommit,
      getImagePastePlacement,
      onImagePasted,
      onTextPasted,
      pdfTextRoutingEnabled = false,
  } = props

    const isSelect = mode === 'select'
    const pageSelectViaSessionLayer = (spreadInkDelegated || whiteboardInkDelegated) && isSelect
    const { pasteRevealIds, pasteRevealTick } = useBoardPasteReveal()
    const { setAnnotationGestureActive } = useLessonCoachSyncActions()
    const overlayRef = useRef<HTMLDivElement | null>(null)
    const paintRef = useRef<
      (
        draftStroke: StrokeAnnotationCommand | null,
        twoDraft: TwoPointDraft | null,
        options?: AnnotationPaintOptions,
      ) => void
    >(() => {})
    const inkSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
    const markerSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
    const draftInkCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const draftMarkerCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const [commands, setCommands] = useState<AnnotationCommand[]>([])
    const commandsRef = useRef<AnnotationCommand[]>([])
    const redoStackRef = useRef<AnnotationCommand[]>([])
    const snapshotUndoRef = useRef<AnnotationCommand[][]>([])
    const snapshotRedoRef = useRef<AnnotationCommand[][]>([])
    const draftStrokeRef = useRef<StrokeAnnotationCommand | null>(null)
    const liveEraserLineDraftRef = useRef<LiveEraserLineDraft | null>(null)
    const liveSpreadStrokeDraftRef = useRef<LiveStrokeDraft | null>(null)
    const twoDraftRef = useRef<TwoPointDraft | null>(null)
    const tapStartRef = useRef<[number, number] | null>(null)
    const tapStartClientRef = useRef<[number, number] | null>(null)
    const gestureRef = useRef<'stroke' | 'two' | 'tap' | null>(null)
    const straightStrokeAxisRef = useRef<StraightStrokeAxis | null>(null)
    const holdStraightRef = useRef(createStrokeHoldStraightTracker())
    const holdShapeDraftRef = useRef<HoldShapeDraft | null>(null)
    const applyHoldSnapRef = useRef<() => void>(() => {})
    const tapModeRef = useRef<TapMode | null>(null)
    const [focusNewId, setFocusNewId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [groupSelectionChrome, setGroupSelectionChrome] =
      useState<GroupSelectionChrome>('union')
    const groupSelectionChromeRef = useRef<GroupSelectionChrome>('union')
    groupSelectionChromeRef.current = groupSelectionChrome
    const [editingId, setEditingId] = useState<string | null>(null)
    const [selectTextEditActive, setSelectTextEditActive] = useState(false)
    const dismissedTextEditIdRef = useRef<string | null>(null)
    const [textToolHoverTargetId, setTextToolHoverTargetId] = useState<string | null>(null)
    const [editingTextDraft, setEditingTextDraft] = useState<string | null>(null)
    const [rotateCommitOverlay, setRotateCommitOverlay] = useState<AnnotationCommand[] | null>(null)
    const [rotateCommitFrame, setRotateCommitFrame] = useState<OrientedSelectionFrame | null>(null)
    const selectedIdsRef = useRef<string[]>([])
    selectedIdsRef.current = selectedIds
    /** Bumped when live eraser preview dead indices change so DOM text/stickies hide in sync with canvas. */
    const [erasePreviewEpoch, setErasePreviewEpoch] = useState(0)
    const erasePreviewDeadKeyRef = useRef<string | null>(null)
    const incrementalDraftStateRef = useRef<IncrementalDraftState | null>(null)
    const zoomRepaintRevision = useBrowserZoomRepaintRevision()

    const onCapabilitiesChangeRef = useRef(onCapabilitiesChange)
    onCapabilitiesChangeRef.current = onCapabilitiesChange

    const penInkPatternOrigin = useMemo<PenInkPatternOrigin>(
      () => ({ x: penInkPatternOriginXPx, y: penInkPatternOriginYPx }),
      [penInkPatternOriginXPx, penInkPatternOriginYPx],
    )

    const strokeDrawOptions = useMemo(
      () => ({ pagePatternOrigin: penInkPatternOrigin }),
      [penInkPatternOrigin],
    )

    commandsRef.current = commands

    const spreadSessionCommandIdSet = useMemo(
      () => new Set(spreadSessionPaintCommandIds),
      [spreadSessionPaintCommandIds],
    )

    const canvasPaintCommands = useMemo(() => {
      if (spreadSessionOwnsPagePaint) {
        return pageLayerCommandsExcludingSpreadSessionIds(commands, spreadSessionPaintCommandIds)
      }
      if (spreadInkDelegated) {
        return pageLayerCommandsWhenSpreadDelegated(commands, true)
      }
      if (whiteboardInkDelegated || whiteboardPenInkDelegated) {
        return pageLayerCanvasCommandsWhenWhiteboardInkDelegated(commands, true)
      }
      return [...commands]
    }, [
      commands,
      spreadInkDelegated,
      spreadSessionOwnsPagePaint,
      spreadSessionPaintCommandIds,
      whiteboardInkDelegated,
      whiteboardPenInkDelegated,
    ])

    const pageLayerPersistCtx = useMemo(
      () => ({
        spreadInkDelegated,
        spreadSessionOwnsPagePaint,
        spreadSessionPaintCommandIds,
        whiteboardInkDelegated,
        whiteboardPenInkDelegated,
      }),
      [
        spreadInkDelegated,
        spreadSessionOwnsPagePaint,
        spreadSessionPaintCommandIds,
        whiteboardInkDelegated,
        whiteboardPenInkDelegated,
      ],
    )

    /** Phase 5: canvas ink commits only on session layer when delegated (no full page replay). */
    const sessionOwnsCanvasInk =
      spreadInkDelegated || whiteboardInkDelegated || whiteboardPenInkDelegated

    const pushUndoSnapshot = useCallback(() => {
      snapshotUndoRef.current.push(cloneCommandStack(commandsRef.current))
      snapshotRedoRef.current = []
      redoStackRef.current = []
    }, [])

    const emitCapabilities = useCallback(() => {
      onCapabilitiesChangeRef.current?.({
        canUndo: snapshotUndoRef.current.length > 0 || commandsRef.current.length > 0,
        canRedo: snapshotRedoRef.current.length > 0 || redoStackRef.current.length > 0,
      })
    }, [])

    const resolvedStoragePageKey = storagePageKey?.trim() || undefined

    useEffect(() => {
      const raw = resolvedStoragePageKey
        ? getAnnotationsForStorageKey(studentId, bookId, unitId, resolvedStoragePageKey)
        : getAnnotationsForPage(studentId, bookId, unitId, pageNumber, storageChannel)
      // Demote for in-memory paint only — never write demoted rows back.
      // Writing stripped text/sticky/stamp here wiped flush projections on page turn.
      const loaded = pageLayerCommandsForLoad(
        raw.filter((c) => c.kind !== 'text' || c.text.trim().length > 0),
        pageLayerPersistCtx,
      )
      setCommands(loaded)
      redoStackRef.current = []
      snapshotUndoRef.current = []
      snapshotRedoRef.current = []
      commandsRef.current = loaded
      liveEraserLineDraftRef.current = null
      liveSpreadStrokeDraftRef.current = null
      erasePreviewDeadKeyRef.current = null
      setFocusNewId(null)
      queueMicrotask(emitCapabilities)
    }, [studentId, bookId, unitId, pageNumber, storageChannel, resolvedStoragePageKey, emitCapabilities, pageLayerPersistCtx])

    const persist = useCallback(
      (next: AnnotationCommand[]) => {
        commandsRef.current = next
        // Session flush owns storage projection; demoted page-layer saves would wipe text/ink.
        if (
          inkSessionPageLayerDemotionEnabled &&
          (pageLayerPersistCtx.spreadInkDelegated ||
            pageLayerPersistCtx.whiteboardInkDelegated ||
            pageLayerPersistCtx.whiteboardPenInkDelegated)
        ) {
          emitCapabilities()
          return
        }
        let toSave = pageLayerCommandsForPersist(next, pageLayerPersistCtx)
        if (
          !inkSessionPageLayerDemotionEnabled &&
          whiteboardInkDelegated &&
          whiteboardSessionStoreRef?.current &&
          resolvedStoragePageKey
        ) {
          toSave = mergeWhiteboardLegacyWithSession(
            next,
            whiteboardSessionStoreRef.current.getState().doc.commands,
          )
        }
        if (resolvedStoragePageKey) {
          setAnnotationsForStorageKey(studentId, bookId, unitId, resolvedStoragePageKey, toSave)
        } else {
          setAnnotationsForPage(studentId, bookId, unitId, pageNumber, toSave, storageChannel)
        }
        emitCapabilities()
      },
      [
        studentId,
        bookId,
        unitId,
        pageNumber,
        storageChannel,
        resolvedStoragePageKey,
        emitCapabilities,
        whiteboardInkDelegated,
        whiteboardSessionStoreRef,
        pageLayerPersistCtx,
      ],
    )

    const patchCommand = useCallback(
      (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => {
        const next = commandsRef.current.map((c) => (c.id === id ? ({ ...c, ...partial } as AnnotationCommand) : c))
        setCommands(next)
        persist(next)
      },
      [persist],
    )

    const deleteStickyCommand = useCallback(
      (id: string) => {
        const next = commandsRef.current.filter((c) => c.id !== id)
        redoStackRef.current = []
        setCommands(next)
        persist(next)
      },
      [persist],
    )

    const deleteTextCommand = useCallback(
      (id: string) => {
        const next = commandsRef.current.filter((c) => c.id !== id)
        redoStackRef.current = []
        setCommands(next)
        persist(next)
        setFocusNewId((prev) => (prev === id ? null : prev))
        setSelectedIds((prev) => prev.filter((x) => x !== id))
        setEditingId((prev) => (prev === id ? null : prev))
      },
      [persist],
    )

    const clampMoveDeltaForSelection = useCallback(
      (dx: number, dy: number, ids?: readonly string[]) => {
        const useIds = ids ?? selectedIdsRef.current
        const trailing = eraserLineTrailingForReplay(
          draftStrokeRef.current,
          liveEraserLineDraftRef.current,
        )
        const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
        return clampSelectionMoveDelta(
          commandsRef.current,
          useIds,
          dx,
          dy,
          widthPx,
          heightPx,
          { deadIndices: dead },
        )
      },
      [widthPx, heightPx],
    )

    const commandsForSelectionChrome = useMemo(() => {
      const base = sessionOwnsCanvasInk ? canvasPaintCommands : commands
      return mergeRotatedCommandOverlay(base, rotateCommitOverlay)
    }, [canvasPaintCommands, commands, rotateCommitOverlay, sessionOwnsCanvasInk])

    const deadIndicesForInteraction = useMemo(() => {
      const trailing = eraserLineTrailingForReplay(
        draftStrokeRef.current,
        liveEraserLineDraftRef.current,
      )
      return computeEraserLineDeadIndices(commands, trailing)
    }, [commands, erasePreviewEpoch])

    const pageToNorm = useCallback(
      (el: HTMLDivElement, clientX: number, clientY: number): [number, number] | null => {
        const target = overlayRef.current ?? el
        const r = target.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return null
        const nx = (clientX - r.left) / r.width
        const ny = (clientY - r.top) / r.height
        return [clamp01(nx), clamp01(ny)]
      },
      [],
    )

    const resolveClickTargetForSelection = useCallback(
      (cmd: AnnotationCommand) => {
        const trailing = eraserLineTrailingForReplay(
          draftStrokeRef.current,
          liveEraserLineDraftRef.current,
        )
        const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
        return resolveSelectClickTargetIds(commandsRef.current, cmd, widthPx, heightPx, dead)
      },
      [widthPx, heightPx],
    )

    const selectMoveIdsForDrag = useCallback(
      (hitCmd: AnnotationCommand, dragSelectionIds?: readonly string[]) =>
        resolveSelectMoveIdsForDrag(
          hitCmd,
          dragSelectionIds ?? selectedIdsRef.current,
          groupSelectionChromeRef.current,
        ),
      [],
    )

    const selectionChromeEnabled = isSelect || selectedIds.length > 0

    const selection = useInkSessionSelectionInteraction(
      {
        enabled: selectionChromeEnabled,
        pointerEnabled: true,
        hoverEnabled: selectionChromeEnabled,
        hitTestCommands: commandsForSelectionChrome,
        paintCommands: canvasPaintCommands,
        selectedIds,
        widthPx,
        heightPx,
        deadIndices: deadIndicesForInteraction,
        groupSelectionChrome,
        marqueeSelectRule,
        editingId,
        rotateCommitFrame,
        clearSelectionOnEmptyClick: true,
        onSelectedIdsChange: setSelectedIds,
        onGroupChromeReset: () => setGroupSelectionChrome('union'),
        onClearEditing: () => {
          endBookOverlayAnnotationEditingFocus(overlayRef.current)
          setBookOverlayAnnotationEditSessionId(null)
          setFocusNewId(null)
          setEditingId(null)
          setEditingTextDraft(null)
          setSelectTextEditActive(false)
        },
        acceptPointerDown: isAnnotationPointerDownAccepted,
        resolveClickTargetIds: resolveClickTargetForSelection,
        selectMoveIdsForDrag,
        clampMoveDelta: clampMoveDeltaForSelection,
        pdfTextRoutingEnabled:
          pdfTextRoutingEnabled && isSelect && !pageSelectViaSessionLayer,
        onGestureLiveChange: () => paintRef.current(null, null),
        onMoveCommitted: (dx, dy, moveIds) => {
          if (dx === 0 && dy === 0) return
          const { dx: cdx, dy: cdy } = clampMoveDeltaForSelection(dx, dy, moveIds)
          if (cdx === 0 && cdy === 0) return
          pushUndoSnapshot()
          const next = translateAnnotationCommands(
            commandsRef.current,
            new Set(moveIds),
            cdx,
            cdy,
          )
          setCommands(next)
          persist(next)
          onSelectionMoveCommitted?.([...moveIds], cdx, cdy)
        },
        onScaleCommitted: (startFrame, newFrame) => {
          pushUndoSnapshot()
          const ids = new Set(selectedIdsRef.current)
          const next = scaleAnnotationCommandsFromOrientedFrames(
            commandsRef.current,
            ids,
            startFrame,
            newFrame,
            widthPx,
            heightPx,
          )
          setCommands(next)
          persist(next)
        },
        onRotateCommitted: ({
          pivot,
          deltaRad,
          ids,
          previewBase,
          rotationStartFrame,
        }) => {
          if (Math.abs(deltaRad) < 1e-6 || ids.length === 0) return
          pushUndoSnapshot()
          const next = commitRotatedAnnotationCommands(
            commandsRef.current,
            new Set(ids),
            pivot,
            deltaRad,
            { widthPx, heightPx },
            previewBase,
            rotationStartFrame,
          )
          setRotateCommitOverlay(rotatedCommandsFromCommitOverlay(next, ids))
          setRotateCommitFrame(
            committedRotationFrameFromGesture(rotationStartFrame, deltaRad, ids.length),
          )
          setCommands(next)
          persist(next)
        },
      },
      pageToNorm,
    )

    const {
      displayCommands: paintedCommands,
      chrome: selectionChrome,
      marqueeRect,
      marqueeMode,
      selectDragLive,
      selectScaleLiveFrame,
      selectRotationLiveDelta,
      effectiveCursor: selectionCursor,
      selectionInteractionCommandsRef,
      selectionInteractionFrameRef,
      selectionInteractionUnionRef,
      selectionInteractionDeadRef,
      selectGestureRef,
      selectMoveIdsRef,
      selectScaleIdsRef,
      selectScaleStartFrameRef,
      selectScaleHandleRef,
      selectScaleLiveFrameRef,
      selectRotateIdsRef,
      selectRotationPivotRef,
      selectRotationStartAngleRef,
      selectRotationBaseCommandsRef,
      selectRotationStartFrameRef,
      selectRotationLiveDeltaRef,
      selectAnchorRef,
      selectDragLiveRef,
      beginSelectMove,
      resetSelectGesture,
      clearSelectDragLive,
      clearSelectScaleLive,
      clearSelectionHover,
      setSelectDragLive,
      setHoverTargetIds,
      onPointerDown: onSelectPointerDown,
      onPointerMove: onSelectPointerMove,
      onPointerUp: onSelectPointerUp,
      onPointerCancel: onSelectPointerCancel,
      updateSelectionHover,
      isPointerOverSelected,
    } = selection

    const {
      selectionOutlineFramesList,
      hoverOutlineFramesList,
      showScaleHandles,
      showRotationHandle,
      selectionHandleFrame,
      showUnionOutline,
    } = selectionChrome

    const paint = useCallback(
      (
        draftStroke: StrokeAnnotationCommand | null,
        twoDraft: TwoPointDraft | null,
        options?: AnnotationPaintOptions,
      ) => {
        if (widthPx <= 0 || heightPx <= 0) return
        const trailing = eraserLineTrailingForReplay(draftStroke, liveEraserLineDraftRef.current)
        const internalDrag = selectDragLiveRef.current
        const replayCommitted = !options?.skipCommittedReplay

        if (replayCommitted) {
          const rotDelta = selectRotationLiveDeltaRef.current
          const rotPivot = selectRotationPivotRef.current
          const rotBase = selectRotationBaseCommandsRef.current
          const rotIds = selectRotateIdsRef.current
          const scaleStartFrame = selectScaleStartFrameRef.current
          const scaleLiveFrame = selectScaleLiveFrameRef.current
          const moveIds = internalDrag ? selectMoveIdsRef.current : []
          let painted: AnnotationCommand[] =
            rotDelta != null && rotPivot && rotBase && rotIds.length > 0
              ? rotateAnnotationCommands(
                  rotBase,
                  new Set(rotIds),
                  rotPivot,
                  rotDelta,
                  { widthPx, heightPx },
                  selectRotationStartFrameRef.current,
                )
              : scaleLiveFrame && scaleStartFrame
                ? scaleAnnotationCommandsFromOrientedFrames(
                    canvasPaintCommands,
                    new Set(selectScaleIdsRef.current),
                    scaleStartFrame,
                    scaleLiveFrame,
                    widthPx,
                    heightPx,
                  )
                : internalDrag && moveIds.length > 0
                  ? translateAnnotationCommands(
                      canvasPaintCommands,
                      new Set(moveIds),
                      internalDrag.dx,
                      internalDrag.dy,
                    )
                  : canvasPaintCommands
          const dead = computeEraserLineDeadIndices(painted, trailing)
          const slices = buildAnnotationRenderSlices(painted, dead)

          let inkIdx = 0
          let markerIdx = 0
          for (const slice of slices) {
            if (slice.kind === 'ink') {
              const el = inkSliceRefs.current[inkIdx++]
              const inkCtx = el?.getContext('2d', { alpha: true })
              if (!inkCtx) continue
              replayInkSlice(inkCtx, painted, slice.indices, widthPx, heightPx, penInkPatternOrigin)
            } else if (slice.kind === 'marker') {
              const el = markerSliceRefs.current[markerIdx++]
              const markerCtx = el?.getContext('2d', { alpha: true })
              if (!markerCtx) continue
              replayMarkerSlice(markerCtx, painted, slice.indices, widthPx, heightPx, strokeDrawOptions)
            }
          }

          const deadKey = trailing ? eraserDeadIndicesKey(dead) : null
          if (erasePreviewDeadKeyRef.current !== deadKey) {
            erasePreviewDeadKeyRef.current = deadKey
            setErasePreviewEpoch((n) => n + 1)
          }
        }

        const draftInkEl = draftInkCanvasRef.current
        const draftMarkerEl = draftMarkerCanvasRef.current
        if (draftInkEl && draftMarkerEl) {
          const draftInkCtx = draftInkEl.getContext('2d', { alpha: true })
          const draftMarkerCtx = draftMarkerEl.getContext('2d', { alpha: true })
          if (draftInkCtx && draftMarkerCtx) {
            const liveSpread = liveSpreadStrokeDraftRef.current
            const active = activeLiveStrokeDraftForPaint(draftStroke, liveSpread)
            const prevIncremental = incrementalDraftStateRef.current
            const canIncremental = active
              ? canIncrementallyAppendDraftSegment(prevIncremental, active, twoDraft)
              : false

            if (canIncremental && active && prevIncremental) {
              const ctx = active.draft.tool === 'marker' ? draftMarkerCtx : draftInkCtx
              applyAnnotationCanvasDpr(ctx)
              const segPoints = incrementalDraftSegmentPoints(active.draft.points, prevIncremental.pointsLength)
              drawStrokePath(
                ctx,
                { ...active.draft, points: segPoints },
                widthPx,
                heightPx,
                liveStrokeDrawOptions(active.draft, strokeDrawOptions),
              )
            } else {
              clearAnnotationCanvas(draftInkCtx)
              clearAnnotationCanvas(draftMarkerCtx)
              applyAnnotationCanvasDpr(draftInkCtx)
              applyAnnotationCanvasDpr(draftMarkerCtx)
              if (active) {
                const ctx = active.draft.tool === 'marker' ? draftMarkerCtx : draftInkCtx
                drawStrokePath(
                  ctx,
                  active.draft,
                  widthPx,
                  heightPx,
                  liveStrokeDrawOptions(active.draft, strokeDrawOptions),
                )
              }
              if (twoDraft) {
                drawTwoPointShapePreview(draftInkCtx, twoDraft, widthPx, heightPx, {
                  shapeColor,
                  shapeStrokeWidthScale,
                  shapeLineDashStyle,
                  shapeStrokeEnabled,
                  shapeFillMode,
                  shapeFillColor,
                  shapeRoundedCorners,
                })
              }
            }

            if (active && (active.draft.tool === 'pen' || active.draft.tool === 'marker') && !twoDraft) {
              incrementalDraftStateRef.current = {
                source: active.source,
                tool: active.draft.tool,
                pointsLength: active.draft.points.length,
              }
            } else {
              incrementalDraftStateRef.current = null
            }
          }
        }
      },
      [
        canvasPaintCommands,
        widthPx,
        heightPx,
        penInkPatternOrigin,
        shapeColor,
        shapeStrokeWidthScale,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
        strokeDrawOptions,
      ],
    )

    useEffect(() => {
      paintRef.current = paint
    }, [paint])

    const syncHoldShapePreview = () => {
      const hold = holdShapeDraftRef.current
      const strokeDraft = draftStrokeRef.current
      if (!hold) return
      const markerLinePreview =
        strokeDraft != null
          ? buildHoldMarkerLineStrokeCommand(hold, strokeDraft, 'hold-preview')
          : null
      const draftInkEl = draftInkCanvasRef.current
      const draftMarkerEl = draftMarkerCanvasRef.current
      if (markerLinePreview) {
        twoDraftRef.current = null
        if (!draftInkEl || !draftMarkerEl || widthPx <= 0 || heightPx <= 0) {
          paint(null, null, { skipCommittedReplay: true })
          return
        }
        const draftInkCtx = draftInkEl.getContext('2d', { alpha: true })
        const draftMarkerCtx = draftMarkerEl.getContext('2d', { alpha: true })
        if (!draftInkCtx || !draftMarkerCtx) {
          paint(null, null, { skipCommittedReplay: true })
          return
        }
        clearAnnotationCanvas(draftInkCtx)
        clearAnnotationCanvas(draftMarkerCtx)
        applyAnnotationCanvasDpr(draftMarkerCtx)
        drawStrokePath(
          draftMarkerCtx,
          markerLinePreview,
          widthPx,
          heightPx,
        )
        return
      }
      twoDraftRef.current = {
        kind: hold.kind,
        anchor: hold.anchor,
        current: hold.current,
      }
      if (!draftInkEl || !draftMarkerEl || widthPx <= 0 || heightPx <= 0) {
        paint(null, twoDraftRef.current, { skipCommittedReplay: true })
        return
      }
      const draftInkCtx = draftInkEl.getContext('2d', { alpha: true })
      const draftMarkerCtx = draftMarkerEl.getContext('2d', { alpha: true })
      if (!draftInkCtx || !draftMarkerCtx) {
        paint(null, twoDraftRef.current, { skipCommittedReplay: true })
        return
      }
      clearAnnotationCanvas(draftInkCtx)
      clearAnnotationCanvas(draftMarkerCtx)
      applyAnnotationCanvasDpr(draftInkCtx)
      drawTwoPointShapePreview(draftInkCtx, twoDraftRef.current, widthPx, heightPx, {
        shapeColor: strokeDraft?.color ?? penInkColor ?? shapeColor,
        shapeStrokeWidthScale: strokeDraft?.widthScale ?? penStrokeWidthScale ?? shapeStrokeWidthScale,
        shapeLineDashStyle: strokeDraft?.lineDashStyle ?? shapeLineDashStyle,
        shapeStrokeEnabled: true,
        shapeFillMode,
        shapeFillColor,
        shapeRoundedCorners,
      })
    }

    applyHoldSnapRef.current = () => {
      const draft = draftStrokeRef.current
      if (!draft || gestureRef.current !== 'stroke') return
      const tracker = holdStraightRef.current
      if (!tracker.holdStraightActive || !tracker.lastSample) return
      const canSnap =
        (draft.tool === 'pen' || draft.tool === 'marker') &&
        shouldUseStraightStrokeLine({
          tool: draft.tool,
          shiftKey: false,
          straightFromHold: true,
          markerStraightStrokeEnabled: markerStraightStroke,
          penInkStyle: draft.tool === 'pen' ? penInkStyle : undefined,
        })
      if (!canSnap) return

      const recognized = recognizeHoldShapeFromStroke(draft.points)
      if (!recognized) return

      snapHoldShapeDraftOnActivate(recognized, tracker.lastSample)
      holdShapeDraftRef.current = recognized
      syncHoldShapePreview()
    }

    function commitHoldShape(hold: HoldShapeDraft, strokeDraft: StrokeAnnotationCommand): void {
      if (sessionOwnsCanvasInk) return
      const cmd = buildHoldShapeCommand(hold, strokeDraft, {
        shapeColor,
        shapeStrokeWidthScale,
        shapeLineDashStyle,
        shapeStrokeEnabled,
        shapeFillMode,
        shapeFillColor,
        shapeRoundedCorners,
      })
      if (!cmd) return
      const next = [...commandsRef.current, cmd]
      setCommands(next)
      persist(next)
    }

    const appendWhiteboardCommands = useCallback(
      (cmds: AnnotationCommand[], selectIds: string[]): void => {
        if (whiteboardInkDelegated && whiteboardSessionStoreRef?.current) {
          whiteboardSessionStoreRef.current.patchCommands((existing) => [...existing, ...cmds])
          whiteboardSessionStoreRef.current.setSelectedIds(selectIds)
          return
        }
        pushUndoSnapshot()
        const next = [...commandsRef.current, ...cmds]
        setCommands(next)
        persist(next)
        setSelectedIds(selectIds)
        setEditingId(null)
      },
      [
        persist,
        pushUndoSnapshot,
        whiteboardInkDelegated,
        whiteboardSessionStoreRef,
      ],
    )

    const resolvePasteAnchorNorm = useCallback((): { x: number; y: number } | null => {
      const placement = getImagePastePlacement?.()
      return placement?.anchorNorm ?? getBoardPasteAnchorNorm()
    }, [getImagePastePlacement])

    const resolvePasteDuplicateOffset = useCallback(
      (source: readonly AnnotationCommand[]): [number, number] => {
        const anchor = resolvePasteAnchorNorm()
        if (!anchor || !(widthPx > 0) || !(heightPx > 0)) return [0.02, 0.02]
        return pasteOffsetForAnchor(source, anchor, widthPx, heightPx)
      },
      [heightPx, resolvePasteAnchorNorm, widthPx],
    )

    const commitFlashcardFromEncoded = useCallback(
      (
        encoded: { dataUrl: string; naturalWidth: number; naturalHeight: number },
        english: string,
        chinese: string,
        options?: { notify?: boolean },
      ): boolean => {
        if (storageChannel !== 'whiteboard') return false
        const en = english.trim()
        if (!en) return false

        const placement = getImagePastePlacement?.()
        const scrollTopPx = placement?.scrollTopPx ?? 0
        const viewportHeightPx = placement?.viewportHeightPx ?? heightPx
        const anchorNorm = resolvePasteAnchorNorm()
        const cardBox = fitFlashcardNormBox(
          encoded.naturalWidth,
          encoded.naturalHeight,
          widthPx,
          heightPx,
          viewportHeightPx,
          scrollTopPx,
          anchorNorm,
        )

        const flashcardCmd: FlashcardAnnotationCommand = {
          kind: 'flashcard',
          id: newAnnotationId(),
          x: cardBox.x,
          y: cardBox.y,
          w: cardBox.w,
          h: cardBox.h,
          src: encoded.dataUrl,
          english: en,
          chinese: chinese.trim() || FLASHCARD_PLACEHOLDER_ZH,
          alt: en,
        }

        appendWhiteboardCommands([flashcardCmd], [flashcardCmd.id])
        registerPasteRevealIds([flashcardCmd.id])
        if (options?.notify !== false) onImagePasted?.()
        return true
      },
      [
        appendWhiteboardCommands,
        getImagePastePlacement,
        heightPx,
        onImagePasted,
        resolvePasteAnchorNorm,
        storageChannel,
        widthPx,
      ],
    )

    const commitImageFromEncoded = useCallback(
      (
        encoded: { dataUrl: string; naturalWidth: number; naturalHeight: number },
        alt: string,
        options?: { notify?: boolean },
      ): boolean => {
        if (storageChannel !== 'whiteboard') return false

        const placement = getImagePastePlacement?.()
        const scrollTopPx = placement?.scrollTopPx ?? 0
        const viewportHeightPx = placement?.viewportHeightPx ?? heightPx
        const anchorNorm = resolvePasteAnchorNorm()
        const cmd = buildImageCommandFromEncoded(
          encoded,
          {
            widthPx,
            heightPx,
            viewportHeightPx,
            scrollTopPx,
            anchorNorm,
            sizingWidthPx: placement?.sizingWidthPx,
            sizingViewportHeightPx: placement?.sizingViewportHeightPx,
          },
          alt,
        )

        if (whiteboardInkDelegated && whiteboardSessionStoreRef?.current) {
          whiteboardSessionStoreRef.current.appendCommand(cmd)
          whiteboardSessionStoreRef.current.setSelectedIds([cmd.id])
        } else {
          pushUndoSnapshot()
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
          setSelectedIds([cmd.id])
          setEditingId(null)
        }

        registerPasteRevealIds([cmd.id])
        if (options?.notify !== false) onImagePasted?.()
        return true
      },
      [
        getImagePastePlacement,
        heightPx,
        onImagePasted,
        persist,
        pushUndoSnapshot,
        resolvePasteAnchorNorm,
        storageChannel,
        whiteboardInkDelegated,
        whiteboardSessionStoreRef,
        widthPx,
      ],
    )

    const commitPastedImageFromResolution = useCallback(
      async (resolution: PastedBoardImageResolution): Promise<PasteImageOutcome> => {
        if (storageChannel !== 'whiteboard') return { ok: false }
        const encoded = await downscaleImageFile(resolution.file)
        if (!encoded) return { ok: false }
        const ok = commitImageFromEncoded(encoded, 'Pasted image', { notify: false })
        return {
          ok,
          animated: resolution.animated,
          usedFrozenRasterFallback: resolution.usedFrozenRasterFallback,
        }
      },
      [commitImageFromEncoded, storageChannel],
    )

    const commitPastedImageFromFile = useCallback(
      async (file: File): Promise<PasteImageOutcome> => {
        return commitPastedImageFromResolution({
          file,
          animated: file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'),
        })
      },
      [commitPastedImageFromResolution],
    )

    const commitImageFromSearchUrl = useCallback(
      async (sourceUrl: string, alt?: string): Promise<boolean> => {
        if (storageChannel !== 'whiteboard') return false
        const file = await fetchBoardImageAsFile(sourceUrl)
        if (!file) return false
        const encoded = await downscaleImageFile(file)
        if (!encoded) return false
        const label = alt?.trim() || 'Picture'
        return commitImageFromEncoded(encoded, label, { notify: false })
      },
      [commitImageFromEncoded, storageChannel],
    )

    const commitFlashcardFromSearchUrl = useCallback(
      async (
        sourceUrl: string,
        english: string,
        chinese?: string,
      ): Promise<boolean> => {
        if (storageChannel !== 'whiteboard') return false
        const file = await fetchBoardImageAsFile(sourceUrl)
        if (!file) return false
        const encoded = await downscaleImageFile(file)
        if (!encoded) return false
        return commitFlashcardFromEncoded(encoded, english, chinese ?? FLASHCARD_PLACEHOLDER_ZH, {
          notify: false,
        })
      },
      [commitFlashcardFromEncoded, storageChannel],
    )

    const commitPastedPlainText = useCallback(
      (rawText: string): boolean => {
        if (storageChannel !== 'whiteboard') return false
        const text = sanitizePastedPlainText(rawText)
        if (!text) return false

        const pasteViewport = getImagePastePlacement?.()
        const scrollTopPx = pasteViewport?.scrollTopPx ?? 0
        const viewportHeightPx = pasteViewport?.viewportHeightPx ?? heightPx
        const anchorNorm = resolvePasteAnchorNorm()
        const point = textPasteNormPoint(heightPx, viewportHeightPx, scrollTopPx, anchorNorm)
        const align = textLabelAlignOrDefault(textAlign)
        const variant = textVisualStyle === 'filled' ? 'filled' : 'plain'
        const placement = textLabelPlacementFromClick({
          clickX: point.x,
          clickY: point.y,
          align,
          widthPx,
          heightPx: viewportHeightPx,
          variant,
          fontSizeNorm: textFontSizeNorm,
        })

        const cmd: TextAnnotationCommand = {
          kind: 'text',
          id: newAnnotationId(),
          x: placement.x,
          y: placement.y,
          yAnchor: placement.yAnchor,
          text,
          fontSizeNorm: textFontSizeNorm,
          fontId: textFontId,
          color: textColor,
          ...(textAlign !== 'left' ? { textAlign } : {}),
          ...(textVisualStyle === 'filled'
            ? { visualStyle: 'filled' as const, fillColor: textFillColor }
            : {}),
        }

        if (whiteboardInkDelegated && whiteboardSessionStoreRef?.current) {
          whiteboardSessionStoreRef.current.appendCommand(cmd)
          whiteboardSessionStoreRef.current.setSelectedIds([cmd.id])
        } else {
          pushUndoSnapshot()
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
          setSelectedIds([cmd.id])
          setEditingId(null)
        }

        registerPasteRevealIds([cmd.id])
        onTextPasted?.()
        return true
      },
      [
        getImagePastePlacement,
        heightPx,
        onTextPasted,
        persist,
        pushUndoSnapshot,
        resolvePasteAnchorNorm,
        storageChannel,
        textAlign,
        textColor,
        textFillColor,
        textFontId,
        textFontSizeNorm,
        textVisualStyle,
        whiteboardInkDelegated,
        whiteboardSessionStoreRef,
      ],
    )

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          const snapshot = snapshotUndoRef.current
          if (snapshot.length > 0) {
            const prev = snapshot.pop()!
            snapshotRedoRef.current.push(cloneCommandStack(commandsRef.current))
            setCommands(prev)
            persist(prev)
            return
          }
          const stack = commandsRef.current
          if (stack.length === 0) return
          const popped = stack[stack.length - 1]
          const next = stack.slice(0, -1)
          redoStackRef.current.push(popped)
          setCommands(next)
          persist(next)
        },
        redo: () => {
          const snapRedo = snapshotRedoRef.current
          if (snapRedo.length > 0) {
            const next = snapRedo.pop()!
            snapshotUndoRef.current.push(cloneCommandStack(commandsRef.current))
            setCommands(next)
            persist(next)
            return
          }
          const tail = redoStackRef.current.pop()
          if (!tail) return
          const next = [...commandsRef.current, tail]
          setCommands(next)
          persist(next)
        },
        clear: () => {
          snapshotUndoRef.current = []
          snapshotRedoRef.current = []
          redoStackRef.current = []
          liveEraserLineDraftRef.current = null
          liveSpreadStrokeDraftRef.current = null
          setCommands([])
          persist([])
        },
        appendCommand: (cmd: AnnotationCommand) => {
          if (sessionOwnsCanvasInk && isInkSessionDelegatedCanvasCommand(cmd)) return
          redoStackRef.current = []
          const stamped =
            cmd.kind === 'stroke' && cmd.tool === 'pen' ? stampPenStrokeOnCommit(cmd) : cmd
          let next = [...commandsRef.current, stamped]
          if (penAutoGroupConnected && stamped.kind === 'stroke' && stamped.tool === 'pen') {
            const trailing = eraserLineTrailingForReplay(
              draftStrokeRef.current,
              liveEraserLineDraftRef.current,
            )
            const dead = computeEraserLineDeadIndices(next, trailing)
            next = autoGroupPenStrokeAfterCommit(next, stamped.id, widthPx, heightPx, dead)
          }
          setCommands(next)
          persist(next)
        },
        lockPenFigureAutoJoin: () => {
          const next = lockPenFigureAutoJoinOnCommands(commandsRef.current)
          if (next === commandsRef.current) return
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
        },
        removeCommandById: (id: string) => {
          const prev = commandsRef.current
          const next = prev.filter((c) => c.id !== id)
          if (next.length === prev.length) return
          redoStackRef.current = []
          setCommands(next)
          persist(next)
        },
        setLiveEraserLineDraft: (draft: LiveEraserLineDraft | null) => {
          liveEraserLineDraftRef.current = draft
          paint(draftStrokeRef.current, twoDraftRef.current)
        },
        setLiveStrokeDraft: (draft: LiveStrokeDraft | null) => {
          liveSpreadStrokeDraftRef.current = draft
          paint(draftStrokeRef.current, twoDraftRef.current, { skipCommittedReplay: true })
        },
        setLiveTwoPointDraft: (draft: LiveTwoPointDraft | null) => {
          twoDraftRef.current = draft
          paint(draftStrokeRef.current, twoDraftRef.current)
        },
        getSelectedIds: () => [...selectedIdsRef.current],
        setSelectedIds: (ids: string[]) => {
          const liveIds = new Set(commandsRef.current.map((c) => c.id))
          const unique = [...new Set(ids)].filter((id) => liveIds.has(id))
          setSelectedIds(unique)
          setEditingId(null)
        },
        translateByIds: (ids: string[], dx: number, dy: number) => {
          if (dx === 0 && dy === 0) return false
          const targetIds = new Set(ids)
          if (targetIds.size === 0) return false
          const { dx: cdx, dy: cdy } = clampMoveDeltaForSelection(dx, dy, ids)
          if (cdx === 0 && cdy === 0) return false
          const next = translateAnnotationCommands(commandsRef.current, targetIds, cdx, cdy)
          if (next === commandsRef.current) return false
          setCommands(next)
          persist(next)
          return true
        },
        moveSelectedBy: (dx: number, dy: number) => {
          if (dx === 0 && dy === 0) return false
          const ids = pageLocalSelectedIds(
            commandsRef.current,
            selectedIdsRef.current,
            sessionOwnsCanvasInk,
          )
          const transformable = filterUnlockedTransformIds(commandsRef.current, ids)
          if (transformable.length === 0) return false
          const { dx: cdx, dy: cdy } = clampMoveDeltaForSelection(dx, dy, transformable)
          if (cdx === 0 && cdy === 0) return false
          pushUndoSnapshot()
          const targetIds = new Set(transformable)
          const next = translateAnnotationCommands(commandsRef.current, targetIds, cdx, cdy)
          if (next === commandsRef.current) return false
          setCommands(next)
          persist(next)
          onSelectionMoveCommitted?.(transformable, cdx, cdy)
          return true
        },
        alignSelected: (axis: HorizontalAlignAxis) => {
          const ids = pageLocalSelectedIds(
            commandsRef.current,
            selectedIdsRef.current,
            sessionOwnsCanvasInk,
          )
          if (ids.length < 2) return false
          if (!(widthPx > 0) || !(heightPx > 0)) return false
          const next = alignSelectedCommands(
            commandsRef.current,
            ids,
            axis,
            widthPx,
            heightPx,
          )
          if (next === commandsRef.current) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          return true
        },
        setNudgePreview: (dx: number, dy: number) => {
          if (dx === 0 && dy === 0) {
            clearSelectDragLive()
            if (selectGestureRef.current !== 'move') {
              selectMoveIdsRef.current = []
            }
          } else {
            const { dx: cdx, dy: cdy } = clampMoveDeltaForSelection(dx, dy)
            setSelectDragLive({ dx: cdx, dy: cdy })
            selectMoveIdsRef.current = [...selectedIdsRef.current]
          }
          paint(null, null)
        },
        commitNudgePreview: () => {
          const live = selectDragLiveRef.current
          if (!live || (live.dx === 0 && live.dy === 0)) return false
          const dx = live.dx
          const dy = live.dy
          clearSelectDragLive()
          if (selectGestureRef.current !== 'move') {
            selectMoveIdsRef.current = []
          }
          const ids = pageLocalSelectedIds(
            commandsRef.current,
            selectedIdsRef.current,
            sessionOwnsCanvasInk,
          )
          if (ids.length === 0) {
            paint(null, null)
            return false
          }
          pushUndoSnapshot()
          const targetIds = new Set(ids)
          const next = translateAnnotationCommands(commandsRef.current, targetIds, dx, dy)
          if (next === commandsRef.current) {
            paint(null, null)
            return false
          }
          setCommands(next)
          persist(next)
          onSelectionMoveCommitted?.(ids, dx, dy)
          paint(null, null)
          return true
        },
        clearNudgePreview: () => {
          clearSelectDragLive()
          if (selectGestureRef.current !== 'move') {
            selectMoveIdsRef.current = []
          }
          paint(null, null)
        },
        selectAll: () => {
          const trailing = eraserLineTrailingForReplay(
            draftStrokeRef.current,
            liveEraserLineDraftRef.current,
          )
          const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
          const eligible = commandsRef.current.filter((_, i) => !dead.has(i))
          const pool = sessionOwnsCanvasInk
            ? eligible.filter((c) => !isInkSessionDelegatedCanvasCommand(c))
            : eligible
          setSelectedIds(selectAllCommandIds(pool, false))
          setEditingId(null)
        },
        selectAllIncludingLocked: () => {
          const trailing = eraserLineTrailingForReplay(
            draftStrokeRef.current,
            liveEraserLineDraftRef.current,
          )
          const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
          const eligible = commandsRef.current.filter((_, i) => !dead.has(i))
          const pool = sessionOwnsCanvasInk
            ? eligible.filter((c) => !isInkSessionDelegatedCanvasCommand(c))
            : eligible
          setSelectedIds(selectAllCommandIds(pool, true))
          setEditingId(null)
        },
        deleteSelected: () => {
          const ids = new Set(
            pageLocalSelectedIds(
              commandsRef.current,
              selectedIdsRef.current,
              sessionOwnsCanvasInk,
            ),
          )
          if (ids.size === 0) return false
          pushUndoSnapshot()
          const next = commandsRef.current.filter((c) => !ids.has(c.id))
          setCommands(next)
          persist(next)
          setSelectedIds([])
          setEditingId(null)
          return true
        },
        copySelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          const picked = commandsRef.current.filter((c) => ids.has(c.id))
          setAnnotationClipboard(picked)
          return true
        },
        pasteFromClipboard: () => {
          if (!hasAnnotationClipboard()) return false
          pushUndoSnapshot()
          const source = getAnnotationClipboard()
          const dupes = duplicateCommandsForPaste(source, resolvePasteDuplicateOffset(source))
          const next = [...commandsRef.current, ...dupes]
          setCommands(next)
          persist(next)
          setSelectedIds(dupes.map((c) => c.id))
          setEditingId(null)
          registerPasteRevealIds(dupes.map((c) => c.id))
          return true
        },
        pasteImageFromClipboardFile: (file: File) => commitPastedImageFromFile(file),
        pasteImageFromClipboardData: async (clipboard: DataTransfer) => {
          const resolution = await resolvePastedBoardImage(clipboard)
          if (!resolution) return { ok: false }
          return commitPastedImageFromResolution(resolution)
        },
        pasteImageFromResolution: (resolution: PastedBoardImageResolution) =>
          commitPastedImageFromResolution(resolution),
        insertImageFromSearchUrl: (url: string, alt?: string) => commitImageFromSearchUrl(url, alt),
        insertFlashcardFromSearchUrl: (url: string, english: string, chinese?: string) =>
          commitFlashcardFromSearchUrl(url, english, chinese),
        pasteImageFromSystemClipboard: async () => {
          const resolution = await resolvePastedBoardImageFromNavigatorClipboard()
          if (!resolution) return { ok: false }
          return commitPastedImageFromResolution(resolution)
        },
        pasteTextFromSystemClipboard: async () => {
          const text = await readPlainTextFromNavigatorClipboard()
          if (!text) return false
          return commitPastedPlainText(text)
        },
        pasteTextFromClipboardString: (raw: string) => commitPastedPlainText(raw),
        groupSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          const groupId = newFigureGroupId()
          const { commands: next, affectedIds } = assignFigureGroupId(
            commandsRef.current,
            ids,
            groupId,
          )
          if (affectedIds.length === 0) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          setSelectedIds(affectedIds)
          setEditingId(null)
          return true
        },
        ungroupSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          const { commands: next, affectedIds } = clearFigureGroupId(commandsRef.current, ids)
          if (affectedIds.length === 0) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          setSelectedIds(affectedIds)
          setEditingId(null)
          return true
        },
        removeFromGroupSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          const { commands: next, affectedIds } = clearFigureGroupId(commandsRef.current, ids)
          if (affectedIds.length === 0) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          setSelectedIds(affectedIds)
          setEditingId(null)
          return true
        },
        toggleGroupSelected: () => {
          const ids = selectedIdsRef.current
          if (ids.length === 0) return false
          if (shouldToggleSelectionToUngroup(commandsRef.current, ids)) {
            const idSet = new Set(ids)
            const { commands: next, affectedIds } = clearFigureGroupId(commandsRef.current, idSet)
            if (affectedIds.length === 0) return false
            pushUndoSnapshot()
            setCommands(next)
            persist(next)
            setSelectedIds(affectedIds)
            setEditingId(null)
            return true
          }
          const groupId = newFigureGroupId()
          const { commands: next, affectedIds } = assignFigureGroupId(
            commandsRef.current,
            new Set(ids),
            groupId,
          )
          if (affectedIds.length === 0) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          setSelectedIds(affectedIds)
          setEditingId(null)
          return true
        },
        deselectAll: () => {
          clearSelectionState()
        },
        duplicateSelected: () => {
          const ids = new Set(selectedIdsRef.current)
          if (ids.size === 0) return false
          pushUndoSnapshot()
          const picked = commandsRef.current.filter((c) => ids.has(c.id))
          const dupes = duplicateCommandsForPaste(picked, resolvePasteDuplicateOffset(picked))
          const next = [...commandsRef.current, ...dupes]
          setCommands(next)
          persist(next)
          setSelectedIds(dupes.map((c) => c.id))
          setEditingId(null)
          return true
        },
        moveSelectedForward: () => {
          const ids = pageLocalSelectedIds(
            commandsRef.current,
            selectedIdsRef.current,
            sessionOwnsCanvasInk,
          )
          if (ids.length === 0) return false
          const next = moveCommandsInStack(commandsRef.current, ids, 1)
          const unchanged =
            next.length === commandsRef.current.length &&
            next.every((c, i) => c.id === commandsRef.current[i]!.id)
          if (unchanged) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          return true
        },
        moveSelectedBackward: () => {
          const ids = pageLocalSelectedIds(
            commandsRef.current,
            selectedIdsRef.current,
            sessionOwnsCanvasInk,
          )
          if (ids.length === 0) return false
          const next = moveCommandsInStack(commandsRef.current, ids, -1)
          const unchanged =
            next.length === commandsRef.current.length &&
            next.every((c, i) => c.id === commandsRef.current[i]!.id)
          if (unchanged) return false
          pushUndoSnapshot()
          setCommands(next)
          persist(next)
          return true
        },
        selectNextInStack: (direction: 1 | -1) => {
          const dead = computeEraserLineDeadIndices(
            commandsRef.current,
            eraserLineTrailingForReplay(draftStrokeRef.current, liveEraserLineDraftRef.current),
          )
          const nextId = selectNextStackId(commandsRef.current, selectedIdsRef.current, direction, dead)
          if (!nextId) return
          setSelectedIds([nextId])
          setEditingId(null)
        },
      }),
      [clampMoveDeltaForSelection, commitFlashcardFromSearchUrl, commitImageFromSearchUrl, commitPastedImageFromFile, commitPastedImageFromResolution, commitPastedPlainText, heightPx, onSelectionMoveCommitted, persist, paint, pushUndoSnapshot, resolvePasteDuplicateOffset, sessionOwnsCanvasInk, widthPx],
    )

    useLayoutEffect(() => {
      if (widthPx <= 0 || heightPx <= 0) return
      const trailing = eraserLineTrailingForReplay(
        draftStrokeRef.current,
        liveEraserLineDraftRef.current,
      )
      const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
      const slices = buildAnnotationRenderSlices(commandsRef.current, dead)
      const inkCount = slices.filter((s) => s.kind === 'ink').length
      const markerCount = slices.filter((s) => s.kind === 'marker').length
      while (inkSliceRefs.current.length < inkCount) inkSliceRefs.current.push(null)
      while (markerSliceRefs.current.length < markerCount) markerSliceRefs.current.push(null)
      inkSliceRefs.current.length = inkCount
      markerSliceRefs.current.length = markerCount
      for (const el of inkSliceRefs.current) {
        if (el) sizeAnnotationPageCanvas(el, widthPx, heightPx)
      }
      for (const el of markerSliceRefs.current) {
        if (el) sizeAnnotationPageCanvas(el, widthPx, heightPx)
      }
      const draftInk = draftInkCanvasRef.current
      const draftMarker = draftMarkerCanvasRef.current
      if (draftInk) sizeAnnotationPageCanvas(draftInk, widthPx, heightPx)
      if (draftMarker) sizeAnnotationPageCanvas(draftMarker, widthPx, heightPx)
      paint(draftStrokeRef.current, twoDraftRef.current)
    }, [
      widthPx,
      heightPx,
      commands,
      paint,
      mode,
      strokeColor,
      strokeWidthScale,
      strokeLineDashStyle,
      penInkPatternOrigin,
      strokeDrawOptions,
      selectedIds,
      selectDragLive,
      selectScaleLiveFrame,
      selectRotationLiveDelta,
      zoomRepaintRevision,
      pasteRevealTick,
    ])

    useEffect(() => {
      if (!rotateCommitOverlay) return
      if (isRotateCommitOverlaySynced(rotateCommitOverlay, commands)) {
        setRotateCommitOverlay(null)
      }
    }, [commands, rotateCommitOverlay])

    useEffect(() => {
      setRotateCommitFrame(null)
    }, [selectedIds])

    function applyPenAutoGroupAfterAppend(
      commands: AnnotationCommand[],
      strokeId: string,
    ): AnnotationCommand[] {
      if (!penAutoGroupConnected) return commands
      const trailing = eraserLineTrailingForReplay(
        draftStrokeRef.current,
        liveEraserLineDraftRef.current,
      )
      const dead = computeEraserLineDeadIndices(commands, trailing)
      return autoGroupPenStrokeAfterCommit(commands, strokeId, widthPx, heightPx, dead)
    }

    function enterGroupStrokeEditMode(
      targetIds: string[],
      hitCmd: AnnotationCommand,
    ): void {
      setEditingId(null)
      setSelectedIds(targetIds)
      setGroupSelectionChrome('perStroke')
      resetSelectGesture()
      selectMoveIdsRef.current =
        hitCmd.kind === 'stroke' && (hitCmd.tool === 'pen' || hitCmd.tool === 'marker')
          ? [hitCmd.id]
          : [...targetIds]
    }

    function onSelectDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
      e.preventDefault()
      e.stopPropagation()
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return
      const dead = pointerHitDeadIndices()
      const idx = hitTestAnnotationIndex(commandsRef.current, p[0], p[1], widthPx, heightPx, dead)
      if (idx == null) return
      const cmd = commandsRef.current[idx]!
      if (cmd.kind === 'text' || cmd.kind === 'sticky') {
        if (!isSelect) return
        setSelectedIds([cmd.id])
        setSelectTextEditActive(true)
        setEditingId(cmd.id)
        return
      }
      if (!isSelect) return
      if (cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')) {
        const targetIds = resolveClickTargetForSelection(cmd)
        if (targetIds.length > 1) {
          enterGroupStrokeEditMode(targetIds, cmd)
        }
      }
    }

    useEffect(
      () =>
        subscribeBrushPatternTileLoads(() => {
          paint(draftStrokeRef.current, twoDraftRef.current)
        }),
      [paint],
    )

    function clientToNorm(clientX: number, clientY: number): [number, number] | null {
      const el = overlayRef.current
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      const nx = (clientX - r.left) / r.width
      const ny = (clientY - r.top) / r.height
      return [clamp01(nx), clamp01(ny)]
    }

    function pointerHitDeadIndices(): Set<number> {
      const trailing = eraserLineTrailingForReplay(
        draftStrokeRef.current,
        liveEraserLineDraftRef.current,
      )
      return computeEraserLineDeadIndices(commandsRef.current, trailing)
    }

    function clearSelectionState(): void {
      setSelectedIds([])
      setGroupSelectionChrome('union')
      setEditingId(null)
      resetSelectGesture()
      clearSelectionHover()
    }

    const strokeWidthForTool = useCallback(
      (tool: StrokeAnnotationCommand['tool']) =>
        strokeWidthScaleForStrokeTool(tool, {
          strokeWidthScale,
          eraserLineStrokeWidthScale,
          penStrokeWidthScale,
        }),
      [eraserLineStrokeWidthScale, penStrokeWidthScale, strokeWidthScale],
    )
    const isTwoPointTool =
      mode === 'line' || mode === 'rect' || mode === 'ellipse' || mode === 'triangle' || mode === 'arrow'
    const isTapTool =
      mode === 'stamp' ||
      mode === 'sticker' ||
      mode === 'callout' ||
      mode === 'text' ||
      mode === 'sticky' ||
      mode === 'eyedropper'
    const writableDomTool =
      mode === 'sticky' || isWritableStickerInteraction(mode, stickerKind)
    const textToolHoverViaSessionLayer =
      (spreadInkDelegated || whiteboardInkDelegated) && (mode === 'text' || writableDomTool)

    useEffect(() => {
      if (editingId != null) setTextToolHoverTargetId(null)
    }, [editingId])

    useEffect(() => {
      if (textToolHoverViaSessionLayer) return
      setBookOverlayAnnotationEditSessionId(editingId)
      if (!editingId) {
        endBookOverlayAnnotationEditingFocus(overlayRef.current)
      }
      return () => setBookOverlayAnnotationEditSessionId(null)
    }, [editingId, textToolHoverViaSessionLayer])

    useEffect(() => {
      if (!editingId || textToolHoverViaSessionLayer) return

      const onDocumentPointerDown = (e: PointerEvent) => {
        const target = e.target
        if (!(target instanceof Node)) return
        if (
          !shouldDismissBookOverlayAnnotationEditOnPointerDown(target, {
            overlayRoot: overlayRef.current,
            editingId,
          })
        ) {
          return
        }
        commitBookOverlayTypingTarget()
        dismissedTextEditIdRef.current = editingId
        setFocusNewId(null)
        setSelectTextEditActive(false)
        setEditingId(null)
      }

      document.addEventListener('pointerdown', onDocumentPointerDown, true)
      return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    }, [editingId, textToolHoverViaSessionLayer])

    useEffect(() => {
      if (editingId == null) setEditingTextDraft(null)
    }, [editingId])

    const onEditingTextDraftChange = useCallback((text: string | null) => {
      setEditingTextDraft(text)
    }, [])

    const handleEditingIdChange = useCallback((id: string | null) => {
      if (id === null) {
        setSelectTextEditActive(false)
        endBookOverlayAnnotationEditingFocus(overlayRef.current)
        setFocusNewId(null)
        setEditingTextDraft(null)
        setBookOverlayAnnotationEditSessionId(null)
        setEditingId(null)
        return
      }
      setBookOverlayAnnotationEditSessionId(id)
      setEditingId(id)
      setFocusNewId(id)
    }, [])

    function makeStrokeDraft(tool: StrokeTool, p: [number, number]): StrokeAnnotationCommand {
      const base: StrokeAnnotationCommand = {
        kind: 'stroke',
        id: newAnnotationId(),
        tool,
        points: [p],
        widthScale: strokeWidthForTool(tool),
      }
      if (tool === 'pen') {
        const inkColor = strokeColor ?? penInkColor
        if (inkColor) base.color = inkColor
        base.lineDashStyle = strokeLineDashStyle
        if (penInkStyle && penInkStyle !== 'solid') {
          base.penInkStyle = penInkStyle
          attachPenInkPatternPhase(base, penInkStyle)
        }
        if (penStrokeProfile) base.penStrokeProfile = penStrokeProfile
      } else if (tool === 'marker' && strokeColor) {
        base.color = strokeColor
        base.lineDashStyle = strokeLineDashStyle
        if (markerDecoratedEdge) base.markerDecoratedEdge = true
      }
      return base
    }

    function commitDraftStroke(draft: StrokeAnnotationCommand): void {
      if (sessionOwnsCanvasInk) return
      const commitPoints = ensureStrokeCommitPoints(draft.points)
      if (commitPoints.length < 2) return
      const cmd: StrokeAnnotationCommand =
        draft.tool === 'pen'
          ? stampPenStrokeOnCommit({ ...draft, points: commitPoints })
          : { ...draft, points: commitPoints }
      let next = [...commandsRef.current, cmd]
      if (cmd.tool === 'pen') {
        next = applyPenAutoGroupAfterAppend(next, cmd.id)
      }
      setCommands(next)
      persist(next)
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (isSelect) return
      if (!isAnnotationPointerDownAccepted(e)) return
      const p = clientToNorm(e.clientX, e.clientY)
      if (!p) return

      if (
        mode === 'text' &&
        editingId != null &&
        shouldDismissBookOverlayAnnotationEditOnPointerDown(e.target, { editingId })
      ) {
        dismissedTextEditIdRef.current = editingId
        handleEditingIdChange(null)
      }

      if (selectedIdsRef.current.length > 0) {
        if (isPointerOverSelected(p)) {
          setEditingId(null)
          const hitIdx = hitTestSelectedAnnotationIndex(
            commandsRef.current,
            selectedIdsRef.current,
            p[0],
            p[1],
            widthPx,
            heightPx,
            pointerHitDeadIndices(),
          )
          const hitCmd = hitIdx != null ? commandsRef.current[hitIdx] : null
          beginSelectMove(
            e,
            p,
            hitCmd != null ? selectMoveIdsForDrag(hitCmd, selectedIdsRef.current) : undefined,
          )
          return
        }
        clearSelectionState()
      }

      onPointerSessionStart?.()

      const strokeTool = effectiveStrokeToolForPointer(mode, e)

      if (strokeTool) {
        if (sessionOwnsCanvasInk) return
        setAnnotationGestureActive(true)
        gestureRef.current = 'stroke'
        straightStrokeAxisRef.current = null
        holdShapeDraftRef.current = null
        resetStrokeHoldStraightTracker(holdStraightRef.current)
        redoStackRef.current = []
        draftStrokeRef.current = makeStrokeDraft(strokeTool, p)
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(draftStrokeRef.current, null, {
          skipCommittedReplay: strokeToolSkipsCommittedReplayOnLivePaint(strokeTool),
        })
        emitCapabilities()
        return
      }

      if (isTwoPointTool) {
        if (sessionOwnsCanvasInk) return
        setAnnotationGestureActive(true)
        gestureRef.current = 'two'
        redoStackRef.current = []
        twoDraftRef.current = {
          kind: mode,
          anchor: p,
          current: p,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        paint(null, twoDraftRef.current, { skipCommittedReplay: true })
        emitCapabilities()
        return
      }

      if (isTapTool) {
        if (spreadInkDelegated && (mode === 'text' || writableDomTool)) return
        if (whiteboardInkDelegated && (mode === 'text' || writableDomTool)) return
        if (mode === 'text') {
          const trailing = eraserLineTrailingForReplay(
            draftStrokeRef.current,
            liveEraserLineDraftRef.current,
          )
          const dead = computeEraserLineDeadIndices(commandsRef.current, trailing)
          const hitIdx = hitTestTextAnnotationIndex(
            commandsRef.current,
            p[0],
            p[1],
            widthPx,
            heightPx,
            dead,
          )
          if (hitIdx != null && commandsRef.current[hitIdx]?.kind === 'text') {
            const hitId = commandsRef.current[hitIdx]!.id
            if (isAnnotationTextFieldFocused(hitId)) {
              dismissedTextEditIdRef.current = null
              return
            }
            if (hitId === dismissedTextEditIdRef.current) {
              dismissedTextEditIdRef.current = null
              return
            }
            if (commitBookOverlayTypingTarget()) {
              setFocusNewId(null)
              setEditingId(null)
            }
            setEditingId(hitId)
            setFocusNewId(hitId)
            dismissedTextEditIdRef.current = null
            return
          }
          dismissedTextEditIdRef.current = null
          if (editingId != null || commitBookOverlayTypingTarget()) {
            setFocusNewId(null)
            setEditingId(null)
          }
        }
        gestureRef.current = 'tap'
        if (mode === 'sticker') {
          tapModeRef.current = isQuickStickerInteraction(mode, stickerKind) ? 'stamp' : 'sticky'
        } else {
          tapModeRef.current = mode as TapMode
        }
        tapStartRef.current = p
        tapStartClientRef.current = [e.clientX, e.clientY]
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return

      if (gestureRef.current !== 'stroke' && gestureRef.current !== 'two') return

      const draft = draftStrokeRef.current
      if (draft) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) return
        const nextTool = effectiveStrokeToolForPointer(mode, e)
        if (nextTool !== draft.tool) {
          commitDraftStroke(draft)
          straightStrokeAxisRef.current = null
          if (nextTool) {
            draftStrokeRef.current = makeStrokeDraft(nextTool, p)
            paint(draftStrokeRef.current, null, {
              skipCommittedReplay: strokeToolSkipsCommittedReplayOnLivePaint(nextTool),
            })
          } else {
            draftStrokeRef.current = null
            gestureRef.current = null
            paint(null, null)
          }
          return
        }
        const samples: [number, number][] = []
        for (const ev of coalescedPointerEvents(e.nativeEvent)) {
          const sp = clientToNorm(ev.clientX, ev.clientY)
          if (sp) samples.push(sp)
        }
        if (samples.length === 0) return
        const lastSample = samples[samples.length - 1]!
        const holdShape = holdShapeDraftRef.current
        if (holdShape) {
          updateHoldShapeDraftAtPointer(holdShape, lastSample)
          syncHoldShapePreview()
          return
        }

        feedStrokeHoldStraightMove(
          holdStraightRef.current,
          samples,
          draft.points[0],
          () => applyHoldSnapRef.current(),
        )
        straightStrokeAxisRef.current = extendStrokeDraftFromMove(draft, samples, {
          shiftKey: e.shiftKey,
          straightFromHold: false,
          markerStraightStrokeEnabled: markerStraightStroke,
          penInkStyle: draft.tool === 'pen' ? penInkStyle : undefined,
          straightStrokeAxis: straightStrokeAxisRef.current,
        })
        paint(draft, null, {
          skipCommittedReplay: strokeToolSkipsCommittedReplayOnLivePaint(draft.tool),
        })
        return
      }

      const td = twoDraftRef.current
      if (td) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) return
        td.current = p
        paint(null, td, { skipCommittedReplay: true })
      }
    }

    function commitTwoPoint(): void {
      if (sessionOwnsCanvasInk) return
      const td = twoDraftRef.current
      twoDraftRef.current = null
      if (!td) return
      const dx = td.current[0] - td.anchor[0]
      const dy = td.current[1] - td.anchor[1]
      const dist = Math.hypot(dx, dy)
      const id = newAnnotationId()
      let cmd: AnnotationCommand | null = null
      if (td.kind === 'line' || td.kind === 'arrow') {
        if (dist < TWO_POINT_EPS) return
        if (td.kind === 'line') {
          cmd = {
            kind: 'line',
            id,
            a: td.anchor,
            b: td.current,
            color: shapeColor,
            widthScale: shapeStrokeWidthScale,
            lineDashStyle: shapeLineDashStyle,
          } satisfies LineAnnotationCommand
        } else {
          cmd = {
            kind: 'arrow',
            id,
            from: td.anchor,
            to: td.current,
            color: shapeColor,
            widthScale: shapeStrokeWidthScale,
            lineDashStyle: shapeLineDashStyle,
          } satisfies ArrowAnnotationCommand
        }
      } else {
        const { x, y, w, h } = normalizeRect(td.anchor, td.current)
        if (w < TWO_POINT_EPS || h < TWO_POINT_EPS) return
        let strokeOn = shapeStrokeEnabled
        let fillAlpha = shapeFillAlphaForMode(shapeFillMode)
        let fillOn = fillAlpha != null
        if (!strokeOn && !fillOn) {
          strokeOn = true
        }
        if (td.kind === 'rect') {
          cmd = {
            kind: 'rect',
            id,
            x,
            y,
            w,
            h,
            strokeColor: shapeColor,
            strokeWidthScale: shapeStrokeWidthScale,
            strokeVisible: strokeOn,
            fillVisible: fillOn,
            lineDashStyle: shapeLineDashStyle,
            ...(fillOn && fillAlpha != null ? { fillColor: shapeFillColor, fillAlpha } : {}),
            ...roundedCornersFieldForCommit(shapeRoundedCorners),
          } satisfies RectAnnotationCommand
        } else if (td.kind === 'ellipse') {
          cmd = {
            kind: 'ellipse',
            id,
            x,
            y,
            w,
            h,
            strokeColor: shapeColor,
            strokeWidthScale: shapeStrokeWidthScale,
            strokeVisible: strokeOn,
            fillVisible: fillOn,
            lineDashStyle: shapeLineDashStyle,
            ...(fillOn && fillAlpha != null ? { fillColor: shapeFillColor, fillAlpha } : {}),
          } satisfies EllipseAnnotationCommand
        } else {
          cmd = {
            kind: 'triangle',
            id,
            x,
            y,
            w,
            h,
            strokeColor: shapeColor,
            strokeWidthScale: shapeStrokeWidthScale,
            strokeVisible: strokeOn,
            fillVisible: fillOn,
            lineDashStyle: shapeLineDashStyle,
            ...(fillOn && fillAlpha != null ? { fillColor: shapeFillColor, fillAlpha } : {}),
            ...roundedCornersFieldForCommit(shapeRoundedCorners),
          } satisfies TriangleAnnotationCommand
        }
      }
      if (!cmd) return
      const next = [...commandsRef.current, cmd]
      setCommands(next)
      persist(next)
    }

    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      /** Same-gesture dismiss guard only — do not block the next click-to-edit. */
      dismissedTextEditIdRef.current = null

      const gesture = gestureRef.current
      gestureRef.current = null
      if (gesture === 'stroke' || gesture === 'two') {
        setAnnotationGestureActive(false)
      }

      const draft = draftStrokeRef.current
      const holdShape = holdShapeDraftRef.current
      if (gesture === 'stroke' && holdShape && draft) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (p && holdShape.kind === 'line') updateHoldShapeDraftAtPointer(holdShape, p)
        commitHoldShape(holdShape, draft)
      } else if (draft && gesture === 'stroke') {
        const p = clientToNorm(e.clientX, e.clientY)
        if (p) {
          finalizeStrokeDraftEndPoint(draft, p, {
            shiftKey: e.shiftKey,
            straightFromHold: false,
            markerStraightStrokeEnabled: markerStraightStroke,
            penInkStyle: draft.tool === 'pen' ? penInkStyle : undefined,
            straightStrokeAxis: straightStrokeAxisRef.current,
          })
        }
      }
      straightStrokeAxisRef.current = null
      holdShapeDraftRef.current = null
      twoDraftRef.current = null
      resetStrokeHoldStraightTracker(holdStraightRef.current)
      draftStrokeRef.current = null
      if (draft && gesture === 'stroke' && !holdShape && draft.points.length >= 1) {
        commitDraftStroke(draft)
      }

      if (gesture === 'two' && twoDraftRef.current) {
        commitTwoPoint()
      } else {
        twoDraftRef.current = null
      }

      const tap0 = tapStartRef.current
      tapStartRef.current = null
      const tapClient0 = tapStartClientRef.current
      tapStartClientRef.current = null
      const tapMode = tapModeRef.current
      tapModeRef.current = null
      if (tap0 && gesture === 'tap' && tapMode) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (!p) {
          paint(null, null)
          return
        }
        const dx = p[0] - tap0[0]
        const dy = p[1] - tap0[1]
        if (dx * dx + dy * dy > TAP_MOVE_EPS * TAP_MOVE_EPS) {
          paint(null, null)
          return
        }
        redoStackRef.current = []
        const at = tap0
        const id = newAnnotationId()
        if (tapMode === 'stamp') {
          const cmd: AnnotationCommand = {
            kind: 'stamp',
            id,
            variant: stampVariant,
            center: at,
            color: stampColorForVariant(stampVariant, stampQuestionColor),
            scale: stampScale,
          }
          if (onSpreadCanvasCommandCommit) {
            onSpreadCanvasCommandCommit(cmd, pageNumber)
            return
          }
          if (whiteboardInkDelegated && whiteboardSessionStoreRef?.current) {
            whiteboardSessionStoreRef.current.appendCommand(cmd)
            notifyStampPlaced(
              { id, variant: stampVariant, center: at },
              { studentId },
            )
            return
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
          notifyStampPlaced(
            { id, variant: stampVariant, center: at },
            { studentId },
          )
        } else if (tapMode === 'callout') {
          const sessionCmds =
            whiteboardInkDelegated && whiteboardSessionStoreRef?.current
              ? whiteboardSessionStoreRef.current.getState().doc.commands
              : commandsRef.current
          const cmd: AnnotationCommand = {
            kind: 'callout',
            id,
            index: nextCalloutIndex(sessionCmds),
            center: at,
            color: shapeColor,
            scale: stampScale,
          }
          if (onSpreadCanvasCommandCommit) {
            onSpreadCanvasCommandCommit(cmd, pageNumber)
            return
          }
          if (whiteboardInkDelegated && whiteboardSessionStoreRef?.current) {
            whiteboardSessionStoreRef.current.appendCommand(cmd)
            return
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
        } else if (tapMode === 'text') {
          if (spreadInkDelegated || whiteboardInkDelegated) return
          const align = textLabelAlignOrDefault(textAlign)
          const variant = textVisualStyle === 'filled' ? 'filled' : 'plain'
          const placement = textLabelPlacementFromClick({
            clickX: at[0],
            clickY: at[1],
            align,
            widthPx,
            heightPx,
            variant,
            fontSizeNorm: textFontSizeNorm,
          })
          const cmd: TextAnnotationCommand = {
            kind: 'text',
            id,
            x: placement.x,
            y: placement.y,
            yAnchor: placement.yAnchor,
            text: '',
            fontSizeNorm: textFontSizeNorm,
            fontId: textFontId,
            color: textColor,
            ...(textAlign !== 'left' ? { textAlign } : {}),
            ...(textVisualStyle === 'filled'
              ? { visualStyle: 'filled' as const, fillColor: textFillColor }
              : {}),
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
          queueMicrotask(() => {
            setEditingId(id)
            setFocusNewId(id)
          })
        } else if (tapMode === 'eyedropper') {
          const [sampleClientX, sampleClientY] = tapClient0 ?? [e.clientX, e.clientY]
          onEyedropperPick?.(sampleClientX, sampleClientY)
        } else if (tapMode === 'sticky') {
          if (spreadInkDelegated || whiteboardInkDelegated) return
          const size = defaultWritableStickerSize(writableStickerVariant)
          const w = size.wNorm
          const h = size.hNorm
          let sx = at[0] - w / 2
          let sy = at[1] - h / 2
          sx = clamp01(sx)
          sy = clamp01(sy)
          if (sx + w > 1) sx = Math.max(0, 1 - w)
          if (sy + h > 1) sy = Math.max(0, 1 - h)
          const cmd: StickyAnnotationCommand = {
            kind: 'sticky',
            id,
            x: sx,
            y: sy,
            w,
            h,
            text: '',
            fontSizeNorm: stickyFontSizeNorm,
            fontId: textFontId,
            fillColor: defaultWritableStickerFill(writableStickerVariant, stickyFillColor),
            writableVariant: writableStickerVariant,
          }
          const next = [...commandsRef.current, cmd]
          setCommands(next)
          persist(next)
          setFocusNewId(id)
        }
        emitCapabilities()
      }

      paint(null, null)
    }

    function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (gestureRef.current === 'stroke' || gestureRef.current === 'two') {
        setAnnotationGestureActive(false)
      }
      gestureRef.current = null
      straightStrokeAxisRef.current = null
      holdShapeDraftRef.current = null
      resetStrokeHoldStraightTracker(holdStraightRef.current)
      draftStrokeRef.current = null
      twoDraftRef.current = null
      tapStartRef.current = null
      tapStartClientRef.current = null
      tapModeRef.current = null
      paint(null, null)
    }

    function pointerUsesSelectInteraction(e: React.PointerEvent): boolean {
      return isSelect || e.ctrlKey
    }

    function overlayPointerHitsAnnotation(clientX: number, clientY: number): boolean {
      const p = clientToNorm(clientX, clientY)
      if (!p) return false
      return (
        hitTestAnnotationIndex(
          commandsRef.current,
          p[0],
          p[1],
          widthPx,
          heightPx,
          pointerHitDeadIndices(),
        ) != null
      )
    }

    function onOverlayPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (pointerUsesSelectInteraction(e)) {
        onSelectPointerDown(e)
        return
      }
      const pageTextOrWritableTool =
        (mode === 'text' || writableDomTool) && !textToolHoverViaSessionLayer
      if (
        !pageTextOrWritableTool &&
        overlayPointerHitsAnnotation(e.clientX, e.clientY)
      ) {
        onSelectPointerDown(e)
        return
      }
      onPointerDown(e)
    }

    function onOverlayPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (selectGestureRef.current) {
        onSelectPointerMove(e)
        return
      }
      if (
        !pointerUsesSelectInteraction(e) &&
        (gestureRef.current === 'stroke' || gestureRef.current === 'two')
      ) {
        onPointerMove(e)
        return
      }
      if (
        mode === 'text' &&
        !textToolHoverViaSessionLayer &&
        !pointerUsesSelectInteraction(e) &&
        !selectGestureRef.current &&
        gestureRef.current !== 'stroke' &&
        gestureRef.current !== 'two'
      ) {
        const p = clientToNorm(e.clientX, e.clientY)
        if (p) {
          const hitId = resolveTextToolHoverTargetId(
            commandsRef.current,
            p[0],
            p[1],
            widthPx,
            heightPx,
            'text',
            deadIndicesForInteraction,
          )
          const nextId = hitId != null && hitId === editingId ? null : hitId
          setTextToolHoverTargetId((prev) => (prev === nextId ? prev : nextId))
        } else {
          setTextToolHoverTargetId(null)
        }
        return
      }
      if (pointerUsesSelectInteraction(e) || selectedIdsRef.current.length > 0) {
        updateSelectionHover(e)
      }
    }

    function onOverlayPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      if (selectGestureRef.current) {
        onSelectPointerUp(e)
        return
      }
      onPointerUp(e)
    }

    function onOverlayPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
      if (selectGestureRef.current) {
        onSelectPointerCancel(e)
        return
      }
      onPointerCancel(e)
    }

    const overlayCursor = useMemo(
      () =>
        resolveAnnotationToolCursor(
          mode,
          {
            strokeWidthScale,
            eraserLineStrokeWidthScale,
            penStrokeWidthScale,
          },
          {
            color: strokeColor,
            penStrokeProfile: penStrokeProfile as PenStrokeProfile | undefined,
            eyedropperVariant,
          },
        ),
      [
        mode,
        strokeWidthScale,
        eraserLineStrokeWidthScale,
        penStrokeWidthScale,
        strokeColor,
        penStrokeProfile,
        eyedropperVariant,
      ],
    )

    const hasSelection = selectedIds.length > 0
    const selectionOwnedBySessionLayer =
      sessionOwnsCanvasInk &&
      hasSelection &&
      selectedIds.every((id) => {
        const cmd = commands.find((c) => c.id === id)
        return (
          cmd != null &&
          isInkSessionDelegatedCanvasCommand(cmd) &&
          spreadSessionCommandIdSet.has(id)
        )
      })
    const showSelectionChrome = (isSelect || hasSelection) && !selectionOwnedBySessionLayer

    const textToolHoverFrames = useMemo(
      () =>
        mode === 'text' && textToolHoverTargetId && !textToolHoverViaSessionLayer
          ? textToolHoverOutlineFrames(commands, textToolHoverTargetId, widthPx, heightPx)
          : [],
      [mode, textToolHoverTargetId, textToolHoverViaSessionLayer, commands, widthPx, heightPx],
    )

    const textToolEditingFrames = useMemo(
      () =>
        (mode === 'text' || writableDomTool) && editingId && !textToolHoverViaSessionLayer
          ? textToolEditingOutlineFrames(
              commands,
              editingId,
              widthPx,
              heightPx,
              editingTextDraft,
            )
          : [],
      [
        mode,
        writableDomTool,
        editingId,
        textToolHoverViaSessionLayer,
        commands,
        widthPx,
        heightPx,
        editingTextDraft,
      ],
    )

    const effectiveOverlayCursor: CSSProperties['cursor'] =
      isSelect || hasSelection
        ? selectionCursor
        : mode === 'text' && !textToolHoverViaSessionLayer
          ? textToolPlacementCursor(textToolHoverTargetId, true, false, editingId)
          : (overlayCursor ?? 'crosshair')

    const overlayClass = cn('absolute inset-0 touch-none')

    if (widthPx <= 0 || heightPx <= 0) return null

    const trailingEraser = eraserLineTrailingForReplay(
      draftStrokeRef.current,
      liveEraserLineDraftRef.current,
    )
    const deadIndices = deadIndicesForInteraction
    void erasePreviewEpoch
    const renderSlices = buildAnnotationRenderSlices(paintedCommands, deadIndices)
    const cmdCount = paintedCommands.length
    const draftZ = sliceStackZ(draftOverlayZIndex(cmdCount))
    const selectChromeZ = draftZ + 1
    const pointerOverlayZ = draftZ + 2
    const domZBoost = sessionOwnsCanvasInk ? DOM_ABOVE_INK_SESSION_Z_BOOST : 0
    /** Let stickies / text fields receive clicks when editing; text tool uses overlay hit-testing. */
    const canvasSelectViaSessionLayer =
      (spreadInkDelegated || whiteboardInkDelegated) && isSelect
    /** Book spread + whiteboard: text/sticky placement + edit live on BookSpreadSessionLayer. */
    const domToolsViaSessionLayer = textToolHoverViaSessionLayer
    const pointerEventsOnOverlay =
      !delegatePointerToSpread &&
      !delegatePointerToWhiteboardPen &&
      !canvasSelectViaSessionLayer &&
      !domToolsViaSessionLayer &&
      !writableDomTool &&
      !(isSelect && editingId != null)

    const textToolActive = mode === 'text' || writableDomTool
    const textInputEnabled =
      (textToolActive && editingId != null) || selectTextEditActive

    return {
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
      onPointerLeave: () => {
        clearSelectionHover()
        setTextToolHoverTargetId(null)
      },
      textToolHoverFrames,
      textToolEditingFrames,
      textToolActive,
      textInputEnabled,
      onEditingTextDraftChange,
      pasteRevealIds: storageChannel === 'whiteboard' ? pasteRevealIds : undefined,
    }
}
