'use client'

import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type { CSSProperties, ClipboardEvent, DragEvent, MutableRefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LiveEraserLineDraft, LiveStrokeDraft } from '@/components/students/book-page-annotation-layer'
import { BookSpreadSessionLayer } from '@/components/students/book-spread-session-layer'
import { BookSpreadStrokeOverlay } from '@/components/students/book-spread-stroke-overlay'
import {
  BookPageAnnotationLayer,
  type AnnotationCapabilities,
  type BookPageAnnotationHandle,
} from '@/components/students/book-page-annotation-layer'
import type { BookPageAnnotationLayerProps } from '@/components/students/book-page-annotation-layer'
import { inkSessionReactBoundaryEnabled, whiteboardInkSessionEnabled } from '@/lib/books/feature-flags'
import { lessonBoardAllowsRunwayGrowth, type LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import type { WhiteboardSessionStore } from '@/lib/books/whiteboard-session-store'
import {
  lessonBoardActivePageSummary,
  lessonBoardPageStorageKey,
} from '@/lib/books/lesson-board-session-ops'
import { WHITEBOARD_EYEDROPER_PAGE } from '@/lib/books/whiteboard-storage'
import {
  buildWhiteboardViewportInkConfig,
  resolveLessonBoardPaintHeightPx,
} from '@/lib/books/lesson-board-ink-layout'
import {
  isWhiteboardViewportInkActive,
  type WhiteboardViewportInkConfig,
} from '@/lib/books/whiteboard-viewport-ink'
import { notifyStampPlacedFromCommand } from '@/lib/books/notify-stamp-placed'
import { alignSelectedCommands, distributeVerticalSpacingSelectedCommands, type HorizontalAlignAxis } from '@/lib/books/annotation-align'
import {
  patchSelectedImageCommands,
  patchSelectedInkStrokeCommands,
  patchSelectedShapeCommands,
  patchSelectedStickyCommands,
  patchSelectedTextCommands,
  type ImageSelectionPatch,
  type InkStrokeSelectionPatch,
  type ShapeSelectionPatch,
} from '@/lib/books/patch-selected-commands'
import {
  isSessionTapCanvasToolInteraction,
  isWritableStickerInteraction,
} from '@/lib/books/sticker-tool'
import { commitRotatedAnnotationCommands } from '@/lib/books/annotation-rotation'
import { scaleAnnotationCommandsFromOrientedFrames } from '@/lib/books/annotation-scale'
import type { NormRect, OrientedSelectionFrame } from '@/lib/books/annotation-select'
import type { SelectionMoveClampContext } from '@/lib/books/annotation-scale'
import { cn } from '@/lib/utils'
import {
  boardPasteAnchorFromElementRect,
  setBoardPasteAnchorNorm,
  shouldSkipBoardPasteAnchorPointerEvent,
} from '@/lib/books/board-paste-placement'
import {
  WHITEBOARD_CHROME_HEIGHT_PX,
  WHITEBOARD_FOOTER_HEIGHT_PX,
  WHITEBOARD_PANEL_CHROME,
} from '../constants'
import type { WhiteboardLayoutMode, WhiteboardSlotSide } from '../hooks/useWhiteboardPlacement'
import { useWhiteboardSlotMotion } from '../hooks/useWhiteboardSlotMotion'
import type { WhiteboardSlotMotionApi } from '../hooks/useWhiteboardSlotMotion'
import { WhiteboardHeader } from './WhiteboardChrome'
import { LessonBoardFooter } from './LessonBoardFooter'
import { LessonBoardNextUnitPrompt } from './LessonBoardNextUnitPrompt'
import type { SpreadSessionDomConfig } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadSessionDomInteraction'
import type {
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import {
  extractImageUrlFromPlainText,
  pasteImageOutcomeToastKind,
  type PasteImageOutcome,
} from '@/lib/books/clipboard-image'
import {
  isBoardImageDragEvent,
  preventBoardImageDragDefaults,
  resolveDroppedBoardImage,
} from '@/lib/books/board-image-drop'
import {
  readPlainTextFromClipboardData,
  shouldDeferClipboardPasteToBrowser,
} from '@/lib/books/clipboard-text'
import { toast } from 'sonner'
import { BoardImageSearchPanel } from '@/components/students/lesson-board/BoardImageSearchPanel'
import { useBoardImageSearchInsert } from '@/components/students/lesson-board/use-board-image-search-insert'

const SCROLLBAR_HIDDEN =
  'overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'

type LayerProps = Pick<
  BookPageAnnotationLayerProps,
  | 'studentId'
  | 'bookId'
  | 'unitId'
  | 'mode'
  | 'eyedropperVariant'
  | 'stickerKind'
  | 'writableStickerVariant'
  | 'stampVariant'
  | 'stampQuestionColor'
  | 'strokeWidthScale'
  | 'eraserLineStrokeWidthScale'
  | 'penStrokeWidthScale'
  | 'shapeStrokeWidthScale'
  | 'stampScale'
  | 'strokeColor'
  | 'penInkColor'
  | 'penInkStyle'
  | 'penStrokeProfile'
  | 'strokeLineDashStyle'
  | 'markerStraightStroke'
  | 'markerDecoratedEdge'
  | 'penAutoGroupConnected'
  | 'marqueeSelectRule'
  | 'shapeColor'
  | 'textColor'
  | 'shapeLineDashStyle'
  | 'shapeStrokeEnabled'
  | 'shapeFillMode'
  | 'shapeFillColor'
  | 'shapeRoundedCorners'
  | 'textFontSizeNorm'
  | 'textFontId'
  | 'textFontWeight'
  | 'textVisualStyle'
  | 'textAlign'
  | 'textFillColor'
  | 'stickyFillColor'
  | 'stickyFontSizeNorm'
  | 'defaultStickyWNorm'
  | 'defaultStickyHNorm'
>

export interface InfiniteWhiteboardPanelProps extends LayerProps {
  widthPx: number
  /** Ink coordinate width; defaults to panel width when omitted. */
  logicalCanvasWidthPx?: number
  /** Wide-board width used for paste sizing on standard notebook pages. */
  widePasteImageSizingWidthPx?: number
  /** Wide-board viewport height used for paste sizing on standard notebook pages. */
  widePasteImageSizingViewportHeightPx?: number
  viewportHeightPx: number
  contentHeightPx: number
  storagePageKey: string
  surfaceStyle: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'>
  slotSide: WhiteboardSlotSide
  layoutMode?: WhiteboardLayoutMode
  /** Scaled content height for ink paint when floating. */
  floatDisplayContentHeightPx?: number
  onFloat?: () => void
  onDock?: () => void
  onFloatDragPointerDown?: (e: React.PointerEvent) => void
  onFloatDragPointerMove?: (e: React.PointerEvent) => void
  onFloatDragPointerUp?: (e: React.PointerEvent) => void
  onFloatDragPointerCancel?: () => void
  onFloatResizePointerDown?: (e: React.PointerEvent) => void
  onFloatResizePointerMove?: (e: React.PointerEvent) => void
  onFloatResizePointerUp?: (e: React.PointerEvent) => void
  onFloatResizePointerCancel?: () => void
  setSlotSide: (side: WhiteboardSlotSide) => void
  slotTravelPx: number
  registerSlotMotion?: (api: WhiteboardSlotMotionApi | null) => void
  onMinimize: () => void
  suppressChrome?: boolean
  /** Hide header controls until open flight finishes (bar stays full height). */
  deferHeaderChromeActions?: boolean
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  wbStrokeOverlayRef?: MutableRefObject<BookPageAnnotationHandle | null>
  whiteboardSessionStoreRef?: MutableRefObject<WhiteboardSessionStore | null>
  selectionMoveClampRef?: MutableRefObject<SelectionMoveClampContext | null>
  whiteboardSessionDoc?: WhiteboardSessionDocument | null
  whiteboardInkRevision?: number
  appendWhiteboardSessionCommand?: (cmd: AnnotationCommand) => void
  whiteboardSessionUndo?: () => boolean
  whiteboardSessionRedo?: () => boolean
  whiteboardSessionClear?: () => void
  wbStrokeCaptureEnabled?: boolean
  onWhiteboardOverlayCaps?: (caps: AnnotationCapabilities) => void
  hideSelectionContextBar?: boolean
  captureRootRef: MutableRefObject<HTMLDivElement | null>
  onCapabilitiesChange: (caps: AnnotationCapabilities) => void
  onEyedropperPick: (clientX: number, clientY: number) => void
  /** Keep ~one clean screen below the current scroll view (standard pages). */
  onEnsureRunwayBelowView?: (scrollTopPx: number) => void
  onNewLessonBoardPage?: (orientation: LessonBoardPageOrientation) => void
  onSaveLessonBoard?: () => void
  onDeleteLessonBoardPage?: () => void
  canDeleteLessonBoardPage?: boolean
  onStartBoardLinkPlacement?: () => void
  onRemoveBoardLink?: () => void
  activeBoardPageLinkPdfPage?: number | null
  boardLinkPlacementActive?: boolean
  /** Prep mode: keep link-to-book as a header icon. */
  boardLinkInHeader?: boolean
  /** After finishing a writable sticker, switch to Move. */
  onEnterSelectMode?: () => void
  className?: string
  boardFooterLabel?: string
  boardBookFullTitle?: string
  boardBookAccentColor?: string
  boardShelf?: import('@/lib/books/lesson-board-nav').LessonBoardShelfEntry[]
  onSelectBoardNotebook?: (next: { bookId: string; unitId: string }) => void
  /** Soft near-end / Boards shortcut: existing next unit only. */
  nextUnitBoard?: { id: string; title: string } | null
  showNextUnitBoardPrompt?: boolean
  onOpenNextUnitBoard?: () => void
  onDismissNextUnitBoardPrompt?: () => void
  /** Current PDF page — stamped as bookPageHint when the board page is edited. */
  readerBookPageNumber?: number
}

export function InfiniteWhiteboardPanel({
  widthPx,
  logicalCanvasWidthPx: logicalCanvasWidthPxProp,
  widePasteImageSizingWidthPx,
  widePasteImageSizingViewportHeightPx,
  viewportHeightPx,
  contentHeightPx,
  storagePageKey,
  surfaceStyle,
  slotSide,
  layoutMode = 'slot',
  floatDisplayContentHeightPx,
  onFloat,
  onDock,
  onFloatDragPointerDown,
  onFloatDragPointerMove,
  onFloatDragPointerUp,
  onFloatDragPointerCancel,
  onFloatResizePointerDown,
  onFloatResizePointerMove,
  onFloatResizePointerUp,
  onFloatResizePointerCancel,
  setSlotSide,
  slotTravelPx,
  registerSlotMotion,
  onMinimize,
  suppressChrome = false,
  deferHeaderChromeActions = false,
  wbAnnRef,
  wbStrokeOverlayRef,
  whiteboardSessionStoreRef,
  selectionMoveClampRef,
  whiteboardSessionDoc = null,
  whiteboardInkRevision = 0,
  appendWhiteboardSessionCommand,
  whiteboardSessionUndo,
  whiteboardSessionRedo,
  whiteboardSessionClear,
  wbStrokeCaptureEnabled = false,
  onWhiteboardOverlayCaps,
  hideSelectionContextBar = false,
  captureRootRef,
  onCapabilitiesChange,
  onEyedropperPick,
  onEnsureRunwayBelowView,
  onNewLessonBoardPage,
  onSaveLessonBoard,
  onDeleteLessonBoardPage,
  canDeleteLessonBoardPage,
  onStartBoardLinkPlacement,
  onRemoveBoardLink,
  activeBoardPageLinkPdfPage,
  boardLinkPlacementActive,
  boardLinkInHeader = false,
  onEnterSelectMode,
  className,
  boardFooterLabel,
  boardBookFullTitle,
  boardBookAccentColor,
  boardShelf,
  onSelectBoardNotebook,
  nextUnitBoard = null,
  showNextUnitBoardPrompt = false,
  onOpenNextUnitBoard,
  onDismissNextUnitBoardPrompt,
  readerBookPageNumber,
  studentId,
  bookId,
  unitId,
  mode,
  shapeColor,
  ...layerProps
}: InfiniteWhiteboardPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const wbInkLayerRef = useRef<HTMLDivElement | null>(null)
  const wbContentCaptureRef = useRef<HTMLDivElement | null>(null)
  const pasteAnchorNormRef = useRef<{ x: number; y: number } | null>(null)
  const [scrollTopPx, setScrollTopPx] = useState(0)
  const [imageDragActive, setImageDragActive] = useState(false)
  const [wbEraserLineDraft, setWbEraserLineDraft] = useState<LiveEraserLineDraft | null>(null)
  const [wbMarkerStrokeDraft, setWbMarkerStrokeDraft] = useState<LiveStrokeDraft | null>(null)
  const [wbSessionSelectedIds, setWbSessionSelectedIds] = useState<string[]>([])
  const [wbSessionNudgePreview, setWbSessionNudgePreview] = useState<{
    dx: number
    dy: number
  } | null>(null)

  const handleInsertSearchImage = useBoardImageSearchInsert({ studentId, wbAnnRef })

  const setWbSessionSelected = useCallback(
    (ids: string[]) => {
      whiteboardSessionStoreRef?.current?.setSelectedIds(ids)
    },
    [whiteboardSessionStoreRef],
  )

  const moveWbSessionSelected = useCallback(
    (dx: number, dy: number) => {
      whiteboardSessionStoreRef?.current?.moveSelectedBy(dx, dy)
      wbAnnRef.current?.moveSelectedBy?.(dx, dy)
    },
    [wbAnnRef, whiteboardSessionStoreRef],
  )

  const panelWidthPx = widthPx
  const canvasViewportHeightPx = Math.max(1, viewportHeightPx - WHITEBOARD_CHROME_HEIGHT_PX)
  const isFloatingLayout = layoutMode === 'floating'
  const paintWidthPx = panelWidthPx
  const paintContentHeightPx =
    isFloatingLayout && floatDisplayContentHeightPx != null
      ? floatDisplayContentHeightPx
      : contentHeightPx

  const whiteboardSessionActive = Boolean(whiteboardInkSessionEnabled && whiteboardSessionDoc)
  const lessonBoardActivePageId = whiteboardSessionDoc?.activePageId ?? ''

  useEffect(() => {
    if (!whiteboardSessionActive) {
      setWbSessionSelectedIds([])
      setWbSessionNudgePreview(null)
      return
    }
    const store = whiteboardSessionStoreRef?.current
    if (!store) return
    const initial = store.getState()
    setWbSessionSelectedIds(initial.selectedIds)
    setWbSessionNudgePreview(initial.nudgePreview)
    return store.subscribe((state) => {
      setWbSessionSelectedIds(state.selectedIds)
      setWbSessionNudgePreview(state.nudgePreview)
    })
  }, [
    whiteboardSessionActive,
    whiteboardSessionStoreRef,
    lessonBoardActivePageId,
    whiteboardSessionDoc?.meta.revision,
  ])

  const [measuredContentHeightPx, setMeasuredContentHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    setMeasuredContentHeightPx(null)
  }, [lessonBoardActivePageId, paintContentHeightPx, paintWidthPx, layoutMode])

  useLayoutEffect(() => {
    const el = wbContentCaptureRef.current
    if (!el) return
    const measure = () => {
      const next = el.offsetHeight
      if (next > 0) setMeasuredContentHeightPx(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [lessonBoardActivePageId, paintContentHeightPx, paintWidthPx, layoutMode])

  const effectivePaintContentHeightPx = resolveLessonBoardPaintHeightPx(
    paintContentHeightPx,
    measuredContentHeightPx,
  )

  useLayoutEffect(() => {
    if (!selectionMoveClampRef) return
    if (!(paintWidthPx > 0) || !(effectivePaintContentHeightPx > 0)) {
      selectionMoveClampRef.current = null
      return
    }
    selectionMoveClampRef.current = {
      widthPx: paintWidthPx,
      heightPx: effectivePaintContentHeightPx,
    }
  }, [selectionMoveClampRef, paintWidthPx, effectivePaintContentHeightPx])

  const rotateWbSessionSelected = useCallback(
    (
      pivot: [number, number],
      deltaRad: number,
      ids: string[],
      previewBase?: readonly AnnotationCommand[] | null,
      groupRotationFrame?: OrientedSelectionFrame | null,
    ) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store || ids.length === 0 || Math.abs(deltaRad) < 1e-6) return
      const layout = { widthPx: paintWidthPx, heightPx: effectivePaintContentHeightPx }
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
    [effectivePaintContentHeightPx, paintWidthPx, whiteboardSessionStoreRef],
  )

  const scaleWbSessionSelected = useCallback(
    (startFrame: OrientedSelectionFrame, newFrame: OrientedSelectionFrame) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      const ids = new Set(store.getState().selectedIds)
      if (ids.size === 0) return
      store.patchCommands((cmds) =>
        scaleAnnotationCommandsFromOrientedFrames(
          cmds,
          ids,
          startFrame,
          newFrame,
          paintWidthPx,
          effectivePaintContentHeightPx,
        ),
      )
    },
    [effectivePaintContentHeightPx, paintWidthPx, whiteboardSessionStoreRef],
  )

  const penAutoGroupConnected = layerProps.penAutoGroupConnected !== false

  const appendWhiteboardSessionCommandWithAutoGroup = useCallback(
    (cmd: AnnotationCommand) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      if (cmd.kind === 'stroke' && cmd.tool === 'eraser-line') {
        store.commitEraserLine(cmd.points, cmd.widthScale)
        notifyStampPlacedFromCommand(cmd, { studentId })
      } else if (penAutoGroupConnected && cmd.kind === 'stroke' && cmd.tool === 'pen') {
        store.appendPenWithAutoGroup(cmd, {
          penAutoGroupConnected: true,
          widthPx: paintWidthPx,
          heightPx: effectivePaintContentHeightPx,
        })
        notifyStampPlacedFromCommand(cmd, { studentId })
      } else {
        store.appendCommand(cmd)
        notifyStampPlacedFromCommand(cmd, { studentId })
      }
      const hint = readerBookPageNumber
      const pageId = whiteboardSessionDoc?.activePageId
      if (pageId && typeof hint === 'number' && hint >= 1) {
        store.setLessonBoardPageBookPageHint(pageId, hint)
      }
    },
    [
      effectivePaintContentHeightPx,
      paintWidthPx,
      penAutoGroupConnected,
      readerBookPageNumber,
      studentId,
      whiteboardSessionDoc?.activePageId,
      whiteboardSessionStoreRef,
    ],
  )

  const lessonBoardPageNav = whiteboardSessionDoc
    ? lessonBoardActivePageSummary(whiteboardSessionDoc)
    : { index: 0, total: 1, page: null }
  const resolvedPageStorageKey = lessonBoardActivePageId
    ? lessonBoardPageStorageKey(storagePageKey, lessonBoardActivePageId)
    : storagePageKey

  const whiteboardInkDelegated = whiteboardSessionActive
  const wbDomToolsActive =
    whiteboardInkDelegated &&
    (mode === 'text' || isWritableStickerInteraction(mode, layerProps.stickerKind ?? 'quick'))
  const wbTapToolsActive =
    whiteboardInkDelegated &&
    isSessionTapCanvasToolInteraction(mode, layerProps.stickerKind ?? 'quick')

  const patchWhiteboardSessionDomCommand = useCallback(
    (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => {
      whiteboardSessionStoreRef?.current?.patchCommands((cmds) =>
        cmds.map((c) => (c.id === id ? ({ ...c, ...partial } as AnnotationCommand) : c)),
      )
    },
    [whiteboardSessionStoreRef],
  )

  const deleteWhiteboardSessionDomCommand = useCallback(
    (id: string) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      store.patchCommands((cmds) => cmds.filter((c) => c.id !== id))
      const remaining = store.getState().selectedIds.filter((sid) => sid !== id)
      if (remaining.length !== store.getState().selectedIds.length) {
        store.setSelectedIds(remaining)
      }
    },
    [whiteboardSessionStoreRef],
  )

  const patchWhiteboardSessionTextSelected = useCallback(
    (partial: Partial<TextAnnotationCommand>) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      const ids = store.getState().selectedIds
      store.patchCommands((cmds) => patchSelectedTextCommands(cmds, ids, partial))
    },
    [whiteboardSessionStoreRef],
  )

  const patchWhiteboardSessionStickySelected = useCallback(
    (partial: Partial<StickyAnnotationCommand>) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      const ids = store.getState().selectedIds
      store.patchCommands((cmds) => patchSelectedStickyCommands(cmds, ids, partial))
    },
    [whiteboardSessionStoreRef],
  )

  const patchWhiteboardSessionShapeSelected = useCallback(
    (patch: ShapeSelectionPatch) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      const ids = store.getState().selectedIds
      store.patchCommands((cmds) => patchSelectedShapeCommands(cmds, ids, patch))
    },
    [whiteboardSessionStoreRef],
  )

  const patchWhiteboardSessionImageSelected = useCallback(
    (patch: ImageSelectionPatch) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      const ids = store.getState().selectedIds
      store.patchCommands((cmds) => patchSelectedImageCommands(cmds, ids, patch))
    },
    [whiteboardSessionStoreRef],
  )

  const patchWhiteboardSessionStrokeSelected = useCallback(
    (patch: InkStrokeSelectionPatch) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      const ids = store.getState().selectedIds
      store.patchCommands((cmds) => patchSelectedInkStrokeCommands(cmds, ids, patch))
    },
    [whiteboardSessionStoreRef],
  )

  const toggleWhiteboardSessionGroupSelected = useCallback(() => {
    whiteboardSessionStoreRef?.current?.toggleGroupSelected()
  }, [whiteboardSessionStoreRef])

  const deleteWhiteboardSessionSelected = useCallback(() => {
    whiteboardSessionStoreRef?.current?.deleteSelected()
  }, [whiteboardSessionStoreRef])

  const duplicateWhiteboardSessionSelected = useCallback(() => {
    whiteboardSessionStoreRef?.current?.duplicateSelected()
  }, [whiteboardSessionStoreRef])

  const arrangeWhiteboardSessionSelected = useCallback(
    (axis: HorizontalAlignAxis) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store || !(paintWidthPx > 0) || !(effectivePaintContentHeightPx > 0)) return
      const ids = store.getState().selectedIds
      if (ids.length < 2) return
      store.patchCommands((cmds) =>
        alignSelectedCommands(cmds, ids, axis, paintWidthPx, effectivePaintContentHeightPx),
      )
    },
    [effectivePaintContentHeightPx, paintWidthPx, whiteboardSessionStoreRef],
  )

  const distributeWhiteboardSessionVertical = useCallback(() => {
    const store = whiteboardSessionStoreRef?.current
    if (!store || !(paintWidthPx > 0) || !(effectivePaintContentHeightPx > 0)) return
    const ids = store.getState().selectedIds
    if (ids.length < 3) return
    store.patchCommands((cmds) =>
      distributeVerticalSpacingSelectedCommands(
        cmds,
        ids,
        paintWidthPx,
        effectivePaintContentHeightPx,
      ),
    )
  }, [effectivePaintContentHeightPx, paintWidthPx, whiteboardSessionStoreRef])

  const moveWhiteboardSessionSelectedForward = useCallback(() => {
    whiteboardSessionStoreRef?.current?.moveSelectedForward()
  }, [whiteboardSessionStoreRef])

  const moveWhiteboardSessionSelectedBackward = useCallback(() => {
    whiteboardSessionStoreRef?.current?.moveSelectedBackward()
  }, [whiteboardSessionStoreRef])

  const getImagePastePlacement = useCallback(
    () => {
      const orientation = lessonBoardPageNav.page?.orientation ?? 'standard'
      const useWideSizing =
        orientation === 'standard' &&
        widePasteImageSizingWidthPx != null &&
        widePasteImageSizingWidthPx > 0
      return {
        scrollTopPx: scrollRef.current?.scrollTop ?? scrollTopPx,
        viewportHeightPx: canvasViewportHeightPx,
        anchorNorm: pasteAnchorNormRef.current,
        ...(useWideSizing
          ? {
              sizingWidthPx: widePasteImageSizingWidthPx,
              sizingViewportHeightPx: widePasteImageSizingViewportHeightPx,
            }
          : {}),
      }
    },
    [
      canvasViewportHeightPx,
      lessonBoardPageNav.page?.orientation,
      scrollTopPx,
      widePasteImageSizingViewportHeightPx,
      widePasteImageSizingWidthPx,
    ],
  )

  useEffect(() => {
    const el = wbContentCaptureRef.current
    if (!el) return

    const onCapturePointerDown = (event: PointerEvent) => {
      if (shouldSkipBoardPasteAnchorPointerEvent(event)) return
      const anchor = boardPasteAnchorFromElementRect(event.clientX, event.clientY, el.getBoundingClientRect())
      if (!anchor) return
      pasteAnchorNormRef.current = anchor
      setBoardPasteAnchorNorm(anchor)
    }

    el.addEventListener('pointerdown', onCapturePointerDown, true)
    return () => {
      el.removeEventListener('pointerdown', onCapturePointerDown, true)
      pasteAnchorNormRef.current = null
      setBoardPasteAnchorNorm(null)
    }
  }, [effectivePaintContentHeightPx, paintWidthPx])

  const showPasteImageOutcomeToast = useCallback((outcome: PasteImageOutcome) => {
    const kind = pasteImageOutcomeToastKind(outcome)
    if (kind === 'gif') toast.success('GIF pasted')
    else if (kind === 'frozen-fallback') {
      toast.warning(
        'Picture pasted as still image — try GIF search on the board for animation.',
      )
    } else if (kind === 'picture') toast.success('Picture pasted')
  }, [])

  const handleTextPasted = useCallback(() => {
    toast.success('Text pasted')
  }, [])

  const handleWhiteboardPaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      if (shouldDeferClipboardPasteToBrowser()) return

      const hasImageItem = Array.from(e.clipboardData.items).some((item) =>
        item.type.startsWith('image/'),
      )
      const hasGifFile = e.clipboardData.files?.length
        ? Array.from(e.clipboardData.files).some((f) =>
            f.name.toLowerCase().endsWith('.gif'),
          )
        : false

      if (hasImageItem || hasGifFile) {
        e.preventDefault()
        void wbAnnRef.current?.pasteImageFromClipboardData?.(e.clipboardData).then((outcome) => {
          if (outcome.ok) {
            onEnterSelectMode?.()
            showPasteImageOutcomeToast(outcome)
          } else {
            toast.error(
              'Could not paste image — try a smaller GIF (max 8 MB) or use GIF search on the board.',
            )
          }
        })
        return
      }

      const imageUrl = extractImageUrlFromPlainText(e.clipboardData.getData('text/plain') ?? '')
      if (imageUrl) {
        e.preventDefault()
        void wbAnnRef.current?.insertImageFromSearchUrl?.(imageUrl).then((ok) => {
          if (ok) {
            const isGifUrl =
              imageUrl.toLowerCase().includes('.gif') ||
              imageUrl.toLowerCase().includes('giphy') ||
              imageUrl.toLowerCase().includes('tenor')
            toast.success(isGifUrl ? 'GIF pasted' : 'Picture pasted')
          } else {
            toast.error('Could not paste image from that link.')
          }
        })
        return
      }

      const text = readPlainTextFromClipboardData(e.clipboardData)
      if (!text) return
      e.preventDefault()
      if (!wbAnnRef.current?.pasteTextFromClipboardString?.(text)) {
        toast.error('Could not paste text.')
      }
    },
    [onEnterSelectMode, showPasteImageOutcomeToast, wbAnnRef],
  )

  const handleWhiteboardImageDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      if (!isBoardImageDragEvent(event)) return
      preventBoardImageDragDefaults(event)
      setImageDragActive(false)

      const content = wbContentCaptureRef.current
      if (content) {
        const anchor = boardPasteAnchorFromElementRect(
          event.clientX,
          event.clientY,
          content.getBoundingClientRect(),
        )
        if (anchor) {
          pasteAnchorNormRef.current = anchor
          setBoardPasteAnchorNorm(anchor)
        }
      }

      const resolution = await resolveDroppedBoardImage(event.dataTransfer)
      if (!resolution) {
        toast.error('Only pictures (PNG, JPEG, GIF, WebP) can be dropped here.')
        return
      }
      const outcome = await wbAnnRef.current?.pasteImageFromResolution?.(resolution)
      if (outcome?.ok) {
        onEnterSelectMode?.()
        showPasteImageOutcomeToast(outcome)
      } else {
        toast.error('Could not add that picture — try a smaller file.')
      }
    },
    [onEnterSelectMode, showPasteImageOutcomeToast, wbAnnRef],
  )

  const whiteboardDomConfig = useMemo((): SpreadSessionDomConfig | null => {
    if (!whiteboardInkDelegated || !whiteboardSessionDoc) return null
    return {
      enabled: true,
      mode,
      stickerKind: layerProps.stickerKind ?? 'quick',
      writableStickerVariant: layerProps.writableStickerVariant ?? 'note',
      textColor: layerProps.textColor ?? '#111827',
      textFontSizeNorm: layerProps.textFontSizeNorm,
      textFontId: layerProps.textFontId,
      textFontWeight: layerProps.textFontWeight ?? 'regular',
      textVisualStyle: layerProps.textVisualStyle ?? 'plain',
      textAlign: layerProps.textAlign ?? 'left',
      textFillColor: layerProps.textFillColor ?? '#ffffff',
      stickyFillColor: layerProps.stickyFillColor ?? '#fef3c7',
      stickyFontSizeNorm: layerProps.stickyFontSizeNorm,
      defaultStickyWNorm: layerProps.defaultStickyWNorm ?? 0.22,
      defaultStickyHNorm: layerProps.defaultStickyHNorm ?? 0.11,
      widthPx: paintWidthPx,
      heightPx: effectivePaintContentHeightPx,
      selectEnabled: mode === 'select',
      selectedIds: wbSessionSelectedIds,
      onAppendCommand: appendWhiteboardSessionCommandWithAutoGroup,
      onPatchCommand: patchWhiteboardSessionDomCommand,
      onDeleteText: deleteWhiteboardSessionDomCommand,
      onDeleteSticky: deleteWhiteboardSessionDomCommand,
      onSelectedIdsChange: setWbSessionSelected,
      onPatchSelectedText: patchWhiteboardSessionTextSelected,
      onPatchSelectedSticky: patchWhiteboardSessionStickySelected,
      onPatchSelectedShape: patchWhiteboardSessionShapeSelected,
      onPatchSelectedImage: patchWhiteboardSessionImageSelected,
      onPatchSelectedStroke: patchWhiteboardSessionStrokeSelected,
      onMoveSelectedForward: moveWhiteboardSessionSelectedForward,
      onMoveSelectedBackward: moveWhiteboardSessionSelectedBackward,
      onToggleGroupSelected: toggleWhiteboardSessionGroupSelected,
      onDeleteSelected: deleteWhiteboardSessionSelected,
      onDuplicateSelected: duplicateWhiteboardSessionSelected,
      onArrangeSelected: arrangeWhiteboardSessionSelected,
      onDistributeVerticalSelected: distributeWhiteboardSessionVertical,
      onEnterSelectMode,
      onMoveSelectedBy: moveWbSessionSelected,
    }
  }, [
    arrangeWhiteboardSessionSelected,
    distributeWhiteboardSessionVertical,
    onEnterSelectMode,
    moveWbSessionSelected,
    appendWhiteboardSessionCommandWithAutoGroup,
    deleteWhiteboardSessionDomCommand,
    deleteWhiteboardSessionSelected,
    duplicateWhiteboardSessionSelected,
    effectivePaintContentHeightPx,
    layerProps.defaultStickyHNorm,
    layerProps.defaultStickyWNorm,
    layerProps.stickyFillColor,
    layerProps.stickyFontSizeNorm,
    layerProps.textColor,
    layerProps.textFillColor,
    layerProps.textFontId,
    layerProps.textFontWeight,
    layerProps.textFontSizeNorm,
    layerProps.textVisualStyle,
    layerProps.textAlign,
    mode,
    paintWidthPx,
    patchWhiteboardSessionDomCommand,
    patchWhiteboardSessionImageSelected,
    patchWhiteboardSessionShapeSelected,
    patchWhiteboardSessionStrokeSelected,
    patchWhiteboardSessionStickySelected,
    patchWhiteboardSessionTextSelected,
    moveWhiteboardSessionSelectedForward,
    moveWhiteboardSessionSelectedBackward,
    setWbSessionSelected,
    toggleWhiteboardSessionGroupSelected,
    wbSessionSelectedIds,
    whiteboardInkDelegated,
    whiteboardSessionDoc,
  ])

  const whiteboardSessionLayerInkProps = useMemo(
    () =>
      inkSessionReactBoundaryEnabled && whiteboardSessionStoreRef
        ? {
            sessionStoreRef: whiteboardSessionStoreRef,
            commandsRevision: whiteboardInkRevision,
          }
        : { commands: whiteboardSessionDoc?.commands ?? [] },
    [whiteboardInkRevision, whiteboardSessionDoc, whiteboardSessionStoreRef],
  )

  const activePageOrientation = lessonBoardPageNav.page?.orientation ?? 'standard'
  const slotDragEnabled = layoutMode === 'slot' && activePageOrientation !== 'wide'
  const floatDragEnabled = layoutMode === 'floating' && activePageOrientation !== 'wide'
  const handlePrevLessonBoardPage = useCallback(() => {
    whiteboardSessionStoreRef?.current?.goToAdjacentLessonBoardPage(-1)
  }, [whiteboardSessionStoreRef])

  const handleNextLessonBoardPage = useCallback(() => {
    whiteboardSessionStoreRef?.current?.goToAdjacentLessonBoardPage(1)
  }, [whiteboardSessionStoreRef])

  const viewportInk: WhiteboardViewportInkConfig | undefined = useMemo(() => {
    if (!whiteboardSessionActive) return undefined
    return buildWhiteboardViewportInkConfig(
      effectivePaintContentHeightPx,
      canvasViewportHeightPx,
      scrollTopPx,
    )
  }, [
    canvasViewportHeightPx,
    effectivePaintContentHeightPx,
    scrollTopPx,
    whiteboardSessionActive,
  ])

  /** Session ink stack (spread overlay + session layer) — always on for lesson board pages. */
  const useLessonBoardSessionInk = whiteboardSessionActive && viewportInk != null
  const boardScrollable =
    viewportInk != null && isWhiteboardViewportInkActive(viewportInk)
  const wideFixedCanvas = activePageOrientation === 'wide'

  const {
    panelRef,
    panelMotionStyle,
    onSlotDragPointerDown,
    onSlotDragPointerMove,
    onSlotDragPointerUp,
    onSlotDragPointerCancel,
    moveTo,
  } = useWhiteboardSlotMotion({
    slotSide,
    commitSlotSide: setSlotSide,
    slotTravelPx,
    enabled: slotDragEnabled,
    registerMotionApi: registerSlotMotion,
  })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = 0
    setScrollTopPx(0)
  }, [lessonBoardActivePageId])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const top = el.scrollTop
      setScrollTopPx(top)
      if (
        onEnsureRunwayBelowView &&
        lessonBoardAllowsRunwayGrowth(activePageOrientation)
      ) {
        onEnsureRunwayBelowView(top)
      }
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [activePageOrientation, lessonBoardActivePageId, onEnsureRunwayBelowView])

  return (
    <div
      ref={panelRef}
      className={cn(
        'group relative z-10 flex shrink-0 flex-col',
        WHITEBOARD_PANEL_CHROME,
        'isolate',
        className,
      )}
      style={{
        width: panelWidthPx,
        height: viewportHeightPx,
        ...panelMotionStyle,
      }}
      data-whiteboard-slot={slotSide}
      data-whiteboard-layout={layoutMode}
    >
      <WhiteboardHeader
        suppressChrome={suppressChrome}
        deferChromeActions={deferHeaderChromeActions}
        layoutMode={layoutMode}
        pageOrientation={activePageOrientation}
        onFloat={onFloat}
        onDock={onDock}
        swapSlotSide={() => moveTo(slotSide === 'left' ? 'right' : 'left')}
        onMinimize={onMinimize}
        slotDragEnabled={slotDragEnabled}
        floatDragEnabled={floatDragEnabled}
        onSlotDragPointerDown={onSlotDragPointerDown}
        onSlotDragPointerMove={onSlotDragPointerMove}
        onSlotDragPointerUp={onSlotDragPointerUp}
        onSlotDragPointerCancel={onSlotDragPointerCancel}
        onFloatDragPointerDown={onFloatDragPointerDown}
        onFloatDragPointerMove={onFloatDragPointerMove}
        onFloatDragPointerUp={onFloatDragPointerUp}
        onFloatDragPointerCancel={onFloatDragPointerCancel}
        onSaveLessonBoard={whiteboardSessionActive ? onSaveLessonBoard : undefined}
        onDeleteLessonBoardPage={whiteboardSessionActive ? onDeleteLessonBoardPage : undefined}
        canDeleteLessonBoardPage={whiteboardSessionActive ? canDeleteLessonBoardPage : false}
        onStartBoardLinkPlacement={whiteboardSessionActive ? onStartBoardLinkPlacement : undefined}
        onRemoveBoardLink={whiteboardSessionActive ? onRemoveBoardLink : undefined}
        activeBoardPageLinkPdfPage={whiteboardSessionActive ? activeBoardPageLinkPdfPage : null}
        boardLinkPlacementActive={whiteboardSessionActive ? boardLinkPlacementActive : false}
        boardLinkInHeader={boardLinkInHeader}
        imageSearchControl={
          <BoardImageSearchPanel
            onInsertImage={handleInsertSearchImage}
            disabled={deferHeaderChromeActions}
            compact={activePageOrientation !== 'wide'}
          />
        }
        boardFooterLabel={boardFooterLabel}
        boardBookFullTitle={boardBookFullTitle}
        boardBookAccentColor={boardBookAccentColor}
        boardShelf={boardShelf}
        boardActiveBookId={bookId}
        boardActiveUnitId={unitId}
        onSelectBoardNotebook={onSelectBoardNotebook}
        nextUnitBoard={nextUnitBoard}
        onOpenNextUnitBoard={onOpenNextUnitBoard}
      />

      <div
        ref={(node) => {
          scrollRef.current = node
          captureRootRef.current = node
        }}
        tabIndex={-1}
        onPaste={handleWhiteboardPaste}
        onDragEnter={(event) => {
          if (!isBoardImageDragEvent(event)) return
          preventBoardImageDragDefaults(event)
          setImageDragActive(true)
        }}
        onDragOver={(event) => {
          if (!isBoardImageDragEvent(event)) return
          preventBoardImageDragDefaults(event)
        }}
        onDragLeave={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return
          }
          setImageDragActive(false)
        }}
        onDrop={(event) => void handleWhiteboardImageDrop(event)}
        onPointerDown={(event) => {
          if (event.button === 0) {
            scrollRef.current?.focus({ preventScroll: true })
          }
        }}
        className={cn(
          'relative z-0 min-h-0 flex-1 overflow-x-hidden outline-none',
          wideFixedCanvas || !boardScrollable ? 'overflow-y-hidden' : SCROLLBAR_HIDDEN,
          imageDragActive && 'ring-2 ring-inset ring-sky-400',
        )}
        style={{
          height: canvasViewportHeightPx,
          backgroundColor: surfaceStyle.backgroundColor,
        }}
      >
        <div
          ref={wbContentCaptureRef}
          className="relative"
          style={{
            width: paintWidthPx,
            minHeight: paintContentHeightPx,
            height: paintContentHeightPx,
            ...surfaceStyle,
          }}
          data-whiteboard-content=""
          data-lesson-board-orientation={activePageOrientation}
        >
          {useLessonBoardSessionInk && whiteboardSessionDoc ? (
            <div
              ref={wbInkLayerRef}
              className={cn(
                'absolute inset-0',
                mode === 'select' || wbDomToolsActive ? 'z-[40]' : 'z-[25]',
                wbStrokeCaptureEnabled
                  ? 'touch-none pointer-events-auto'
                  : mode === 'select' || wbDomToolsActive
                    ? 'pointer-events-auto'
                    : 'pointer-events-none',
              )}
              style={{
                touchAction: wbStrokeCaptureEnabled ? 'none' : undefined,
              }}
            >
              <BookSpreadSessionLayer
                widthPx={paintWidthPx}
                heightPx={effectivePaintContentHeightPx}
                {...whiteboardSessionLayerInkProps}
                viewportInk={viewportInk}
                scrollportRef={scrollRef}
                contentCaptureRef={wbContentCaptureRef}
                trailingEraserLineDraft={wbEraserLineDraft}
                trailingMarkerStrokeDraft={wbMarkerStrokeDraft}
                selectEnabled={mode === 'select'}
                hideSelectionContextBar={hideSelectionContextBar}
                selectedIds={wbSessionSelectedIds}
                nudgePreview={wbSessionNudgePreview}
                onSelectedIdsChange={setWbSessionSelected}
                onMoveSelectedBy={moveWbSessionSelected}
                onScaleSelectedBy={scaleWbSessionSelected}
                onRotateSelectedBy={rotateWbSessionSelected}
                domConfig={whiteboardDomConfig}
              />
              <BookSpreadStrokeOverlay
                ref={wbStrokeOverlayRef}
                leftPageCaptureRef={wbInkLayerRef}
                rightPageCaptureRef={wbInkLayerRef}
                leftAnnRef={wbAnnRef}
                rightAnnRef={wbAnnRef}
                annotationMode={mode}
                strokeWidthScale={layerProps.strokeWidthScale}
                eraserLineStrokeWidthScale={layerProps.eraserLineStrokeWidthScale}
                penStrokeWidthScale={layerProps.penStrokeWidthScale}
                strokeColor={layerProps.strokeColor}
                penInkColor={layerProps.penInkColor}
                penInkStyle={layerProps.penInkStyle}
                penStrokeProfile={layerProps.penStrokeProfile}
                strokeLineDashStyle={layerProps.strokeLineDashStyle}
                markerStraightStroke={layerProps.markerStraightStroke}
                markerDecoratedEdge={layerProps.markerDecoratedEdge}
                shapeColor={shapeColor}
                shapeStrokeWidthScale={layerProps.shapeStrokeWidthScale}
                shapeLineDashStyle={layerProps.shapeLineDashStyle}
                shapeStrokeEnabled={layerProps.shapeStrokeEnabled}
                shapeFillMode={layerProps.shapeFillMode}
                shapeFillColor={layerProps.shapeFillColor}
                shapeRoundedCorners={layerProps.shapeRoundedCorners}
                pageNumberLeft={WHITEBOARD_EYEDROPER_PAGE}
                pageNumberRight={WHITEBOARD_EYEDROPER_PAGE}
                annotationTargetPage={WHITEBOARD_EYEDROPER_PAGE}
                setAnnotationTargetPage={() => {}}
                onCapabilitiesChange={onWhiteboardOverlayCaps ?? onCapabilitiesChange}
                captureEnabled={wbStrokeCaptureEnabled}
                spreadOverlayWidthPx={paintWidthPx}
                spreadOverlayHeightPx={effectivePaintContentHeightPx}
                spreadCanvasHeightPx={effectivePaintContentHeightPx}
                whiteboardViewportInk={viewportInk}
                whiteboardScrollportRef={scrollRef}
                whiteboardContentCaptureRef={wbContentCaptureRef}
                spreadPageWidthPx={panelWidthPx}
                leftPenInkPatternOriginXPx={0}
                rightPenInkPatternOriginXPx={0}
                spreadSeamNormX={1}
                spreadSessionMode
                onSpreadSessionAppendCommand={appendWhiteboardSessionCommandWithAutoGroup}
                spreadSessionUndo={whiteboardSessionUndo}
                spreadSessionRedo={whiteboardSessionRedo}
                spreadSessionClear={whiteboardSessionClear}
                onSpreadEraserLineDraftChange={setWbEraserLineDraft}
                onSpreadMarkerStrokeDraftChange={setWbMarkerStrokeDraft}
              />
            </div>
          ) : null}
          <div
            className={
              useLessonBoardSessionInk && whiteboardInkDelegated
                ? wbTapToolsActive
                  ? 'pointer-events-auto absolute inset-0 z-[40]'
                  : 'pointer-events-none absolute inset-0 z-[32]'
                : useLessonBoardSessionInk
                  ? 'absolute inset-0 z-[20]'
                  : 'relative h-full w-full'
            }
          >
            <BookPageAnnotationLayer
              key={lessonBoardActivePageId || 'wb-page-default'}
              ref={wbAnnRef}
              {...layerProps}
              studentId={studentId}
              bookId={bookId}
              unitId={unitId}
              mode={mode}
              shapeColor={shapeColor}
              pageNumber={WHITEBOARD_EYEDROPER_PAGE}
              storageChannel="whiteboard"
              storagePageKey={resolvedPageStorageKey}
              widthPx={paintWidthPx}
              heightPx={effectivePaintContentHeightPx}
              delegatePointerToWhiteboardPen={wbStrokeCaptureEnabled}
              whiteboardInkDelegated={whiteboardInkDelegated}
              whiteboardSessionStoreRef={whiteboardSessionStoreRef}
              getImagePastePlacement={getImagePastePlacement}
              onTextPasted={handleTextPasted}
              onEyedropperPick={onEyedropperPick}
              onCapabilitiesChange={onCapabilitiesChange}
            />
          </div>
        </div>
      </div>

      {showNextUnitBoardPrompt && nextUnitBoard && onOpenNextUnitBoard && onDismissNextUnitBoardPrompt ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2"
          style={{ bottom: WHITEBOARD_FOOTER_HEIGHT_PX + 8 }}
        >
          <LessonBoardNextUnitPrompt
            nextUnitTitle={nextUnitBoard.title}
            onOpen={onOpenNextUnitBoard}
            onDismiss={onDismissNextUnitBoardPrompt}
          />
        </div>
      ) : null}

      <LessonBoardFooter
        suppressChrome={suppressChrome}
        deferChromeActions={deferHeaderChromeActions}
        pageOrientation={activePageOrientation}
        lessonBoardPageIndex={lessonBoardPageNav.index}
        lessonBoardPageCount={lessonBoardPageNav.total}
        onNewLessonBoardPage={whiteboardSessionActive ? onNewLessonBoardPage : undefined}
        onPrevLessonBoardPage={whiteboardSessionActive ? handlePrevLessonBoardPage : undefined}
        onNextLessonBoardPage={whiteboardSessionActive ? handleNextLessonBoardPage : undefined}
      />

      {layoutMode === 'floating' && floatDragEnabled ? (
        <div
          role="separator"
          aria-label="Resize floating board"
          title="Resize board"
          className={cn(
            'absolute bottom-0 right-0 z-30 h-4 w-4 cursor-nwse-resize touch-none',
            'rounded-br-lg border-b-[3px] border-r-[3px] border-[#D1D5DB]',
          )}
          onPointerDown={onFloatResizePointerDown}
          onPointerMove={onFloatResizePointerMove}
          onPointerUp={onFloatResizePointerUp}
          onPointerCancel={onFloatResizePointerCancel}
        />
      ) : null}
    </div>
  )
}
