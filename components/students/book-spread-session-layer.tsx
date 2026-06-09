'use client'

import type { CSSProperties } from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import type { LiveEraserLineDraft, LiveStrokeDraft } from '@/components/students/book-page-annotation-layer'
import type { MutableRefObject } from 'react'
import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { eraserLineTrailingForReplay } from '@/lib/books/annotation-live-paint'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import {
  applyAnnotationCanvasDpr,
  clearAnnotationCanvas,
  drawAnnotationCommand,
  drawStrokePath,
  isMarkerStrokeCommand,
  replayInkSlice,
  replayMarkerSlice,
} from '@/lib/books/annotation-draw'
import { buildAnnotationRenderSlices } from '@/lib/books/annotation-render-slices'
import { resolvePenMarkerSelectionIds } from '@/lib/books/annotation-connected-strokes'
import { applySelectionChange, selectionChangeModeFromPointerKeys } from '@/lib/books/annotation-selection-ops'
import {
  annotationIdsInMarquee,
  hitTestAnnotationIndex,
  hitTestSelectedAnnotationIndex,
  normalizeMarqueeRect,
  resolveMarqueeSelectMode,
  resolveSelectionHandleFrame,
  rotationStartFrameForGesture,
  selectionOutlineFramesForChrome,
  snapshotRotationBaseCommands,
  type NormRect,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'
import {
  angleFromPivotToPoint,
  hitTestRotationHandleForFrame,
  rotateAnnotationCommands,
  rotatableIdsInSelection,
  selectionHasRotatableShapes,
  selectionPivotFromBounds,
} from '@/lib/books/annotation-rotation'
import {
  cursorForScaleHandle,
  hitTestScaleHandleForFrame,
  resizeBoundsFromHandle,
  scaleAnnotationCommands,
  unionSelectionBounds,
  type ScaleHandleId,
} from '@/lib/books/annotation-scale'
import {
  cursorForRotationHandle,
  SELECTION_MARQUEE_CROSSING_CLASS,
  SELECTION_MARQUEE_WINDOW_CLASS,
} from '@/lib/books/annotation-selection-chrome'
import { SelectionBoundsChrome } from '@/components/students/selection-bounds-chrome'
import { canIncrementallyAppendSpreadSessionCommands } from '@/lib/books/spread-session-incremental-paint'
import {
  clientToWhiteboardDocumentNorm,
  clientToWhiteboardDocumentNormFromContent,
  clientToWhiteboardDocumentNormFromScrollport,
  isWhiteboardDocumentScrollPaint,
  isWhiteboardViewportInkActive,
  projectCommandsForWhiteboardViewport,
  type WhiteboardViewportInkConfig,
} from '@/lib/books/whiteboard-viewport-ink'
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
  onScaleSelectedBy?: (startBounds: NormRect, newBounds: NormRect) => void
  onRotateSelectedBy?: (
    pivot: [number, number],
    deltaRad: number,
    ids: string[],
    previewBase?: readonly AnnotationCommand[] | null,
  ) => void
}

function sizeCanvas(el: HTMLCanvasElement, widthPx: number, heightPx: number): boolean {
  const dpr = window.devicePixelRatio || 1
  const nextW = Math.max(1, Math.floor(widthPx * dpr))
  const nextH = Math.max(1, Math.floor(heightPx * dpr))
  const resized = el.width !== nextW || el.height !== nextH
  if (resized) {
    el.width = nextW
    el.height = nextH
  }
  el.style.width = `${widthPx}px`
  el.style.height = `${heightPx}px`
  return resized
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
}: BookSpreadSessionLayerProps) {
  const documentScrollPaint = Boolean(
    viewportInk && isWhiteboardDocumentScrollPaint(viewportInk, heightPx),
  )
  const tallRunwayDocumentLayout = Boolean(
    viewportInk && isWhiteboardViewportInkActive(viewportInk),
  )
  const useDocumentCanvasLayout = documentScrollPaint || tallRunwayDocumentLayout
  const paintCommands = useMemo(
    () =>
      viewportInk && !documentScrollPaint
        ? projectCommandsForWhiteboardViewport(commands, viewportInk)
        : commands,
    [commands, documentScrollPaint, viewportInk],
  )
  /** Book spread: multiply highlighter above each PDF; whiteboard uses this layer. */
  const markersOnSessionLayer = Boolean(viewportInk)
  const inkSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const markerSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const trailingMarkerCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const zoomRepaintRevision = useBrowserZoomRepaintRevision()
  const paintedCommandsRef = useRef<readonly AnnotationCommand[]>([])
  const paintedDeadKeyRef = useRef('')
  const selectGestureRef = useRef<'marquee' | 'move' | 'scale' | 'rotate' | null>(null)
  const dragAnchorRef = useRef<[number, number] | null>(null)
  const marqueeAnchorRef = useRef<[number, number] | null>(null)
  const marqueeSelModeRef = useRef<ReturnType<typeof selectionChangeModeFromPointerKeys>>('replace')
  const marqueeRectRef = useRef<NormRect | null>(null)
  const [marqueeRect, setMarqueeRect] = useState<NormRect | null>(null)
  const [marqueeMode, setMarqueeMode] = useState<'window' | 'crossing' | null>(null)
  const selectScaleStartBoundsRef = useRef<NormRect | null>(null)
  const selectScaleHandleRef = useRef<ScaleHandleId | null>(null)
  const selectScaleLiveBoundsRef = useRef<NormRect | null>(null)
  const [selectScaleLiveBounds, setSelectScaleLiveBounds] = useState<NormRect | null>(null)
  const [selectRotationLiveDelta, setSelectRotationLiveDelta] = useState<number | null>(null)
  const selectRotateIdsRef = useRef<string[]>([])
  const selectRotationPivotRef = useRef<[number, number] | null>(null)
  const selectRotationStartAngleRef = useRef<number | null>(null)
  const selectRotationBaseCommandsRef = useRef<AnnotationCommand[] | null>(null)
  const selectRotationStartFrameRef = useRef<OrientedSelectionFrame | null>(null)
  const selectRotationLiveDeltaRef = useRef<number | null>(null)
  const [hoveredScaleHandle, setHoveredScaleHandle] = useState<ScaleHandleId | null>(null)
  const [hoveredRotationHandle, setHoveredRotationHandle] = useState(false)
  const [pointerOverSelection, setPointerOverSelection] = useState(false)
  const [activeGesture, setActiveGesture] = useState<'marquee' | 'move' | 'scale' | 'rotate' | null>(
    null,
  )

  const trailingEraser = useMemo(
    () => eraserLineTrailingForReplay(null, trailingEraserLineDraft),
    [trailingEraserLineDraft],
  )
  const deadIndices = useMemo(
    () => computeEraserLineDeadIndices(paintCommands, trailingEraser),
    [paintCommands, trailingEraser],
  )
  const deadKey = useMemo(() => [...deadIndices].sort((a, b) => a - b).join(','), [deadIndices])

  const displayCommands = useMemo(() => {
    if (
      selectRotationLiveDelta != null &&
      selectRotationPivotRef.current &&
      selectRotationBaseCommandsRef.current
    ) {
      return rotateAnnotationCommands(
        selectRotationBaseCommandsRef.current,
        new Set(selectRotateIdsRef.current),
        selectRotationPivotRef.current,
        selectRotationLiveDelta,
        { widthPx, heightPx },
      )
    }
    const scaleStart = selectScaleStartBoundsRef.current
    if (selectScaleLiveBounds && scaleStart && selectedIds.length > 0) {
      return scaleAnnotationCommands(paintCommands, new Set(selectedIds), scaleStart, selectScaleLiveBounds)
    }
    return paintCommands
  }, [paintCommands, selectedIds, selectScaleLiveBounds, selectRotationLiveDelta])

  const selectionOutlineFramesList = selectionOutlineFramesForChrome(
    displayCommands,
    selectedIds,
    widthPx,
    heightPx,
    'union',
    deadIndices,
    selectRotationLiveDelta,
    selectRotationStartFrameRef.current,
  )

  const selectionUnionBounds =
    selectEnabled && selectedIds.length > 0 && !marqueeRect
      ? selectScaleLiveBounds ??
        unionSelectionBounds(displayCommands, selectedIds, widthPx, heightPx, deadIndices)
      : null

  const showScaleHandles =
    selectEnabled && selectedIds.length > 0 && !marqueeRect && selectionUnionBounds != null

  const showRotationHandle =
    showScaleHandles && selectionHasRotatableShapes(displayCommands, selectedIds)

  const selectionHandleFrame =
    showScaleHandles && selectionUnionBounds
      ? resolveSelectionHandleFrame(
          displayCommands,
          selectedIds,
          widthPx,
          heightPx,
          selectionUnionBounds,
          selectRotationLiveDelta,
          selectRotationStartFrameRef.current,
        )
      : null

  function clearSelectScaleLive(): void {
    selectScaleStartBoundsRef.current = null
    selectScaleHandleRef.current = null
    selectScaleLiveBoundsRef.current = null
    setSelectScaleLiveBounds(null)
  }

  function clearSelectRotationLive(): void {
    selectRotateIdsRef.current = []
    selectRotationPivotRef.current = null
    selectRotationStartAngleRef.current = null
    selectRotationBaseCommandsRef.current = null
    selectRotationStartFrameRef.current = null
    selectRotationLiveDeltaRef.current = null
    setSelectRotationLiveDelta(null)
  }

  function clearSelectionHover(): void {
    setHoveredScaleHandle(null)
    setPointerOverSelection(false)
  }

  function resetSelectGesture(): void {
    selectGestureRef.current = null
    setActiveGesture(null)
    dragAnchorRef.current = null
    marqueeAnchorRef.current = null
    marqueeRectRef.current = null
    setMarqueeRect(null)
    setMarqueeMode(null)
    clearSelectScaleLive()
    clearSelectRotationLive()
    clearSelectionHover()
  }

  useLayoutEffect(() => {
    if (!(widthPx > 0) || !(heightPx > 0)) return

    const slices = buildAnnotationRenderSlices(displayCommands, deadIndices)
    const inkCount = slices.filter((s) => s.kind === 'ink').length
    const markerCount = markersOnSessionLayer ? slices.filter((s) => s.kind === 'marker').length : 0

    while (inkSliceRefs.current.length < inkCount) inkSliceRefs.current.push(null)
    while (markerSliceRefs.current.length < markerCount) markerSliceRefs.current.push(null)
    inkSliceRefs.current.length = inkCount
    markerSliceRefs.current.length = markerCount

    let canvasResized = false
    for (const el of inkSliceRefs.current) {
      if (el) canvasResized = sizeCanvas(el, widthPx, heightPx) || canvasResized
    }
    if (markersOnSessionLayer) {
      for (const el of markerSliceRefs.current) {
        if (el) canvasResized = sizeCanvas(el, widthPx, heightPx) || canvasResized
      }
      const trailMarkerEl = trailingMarkerCanvasRef.current
      if (trailMarkerEl) canvasResized = sizeCanvas(trailMarkerEl, widthPx, heightPx) || canvasResized
    }

    const prev = paintedCommandsRef.current
    const prevDeadKey = paintedDeadKeyRef.current
    const canAppend =
      selectScaleLiveBounds == null &&
      !canvasResized &&
      deadIndices.size === 0 &&
      deadKey === prevDeadKey &&
      canIncrementallyAppendSpreadSessionCommands(prev, displayCommands)

    if (canAppend) {
      const cmd = displayCommands[displayCommands.length - 1]!
      const lastSlice = slices[slices.length - 1]
      if (
        markersOnSessionLayer &&
        lastSlice?.kind === 'marker' &&
        isMarkerStrokeCommand(cmd) &&
        lastSlice.indices[0] === displayCommands.length - 1
      ) {
        const markerIdx = markerCount - 1
        const el = markerSliceRefs.current[markerIdx]
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) {
          applyAnnotationCanvasDpr(ctx)
          drawAnnotationCommand(ctx, cmd, widthPx, heightPx)
        }
      } else if (lastSlice?.kind === 'ink' && !isMarkerStrokeCommand(cmd)) {
        const inkIdx = inkCount - 1
        const el = inkSliceRefs.current[inkIdx]
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) {
          applyAnnotationCanvasDpr(ctx)
          drawAnnotationCommand(ctx, cmd, widthPx, heightPx)
        }
      } else {
        replayAllSlices()
      }
    } else {
      replayAllSlices()
    }

    function replayAllSlices(): void {
      let inkIdx = 0
      let markerIdx = 0
      for (const slice of slices) {
        if (slice.kind === 'ink') {
          const el = inkSliceRefs.current[inkIdx++]
          const inkCtx = el?.getContext('2d', { alpha: true })
          if (!inkCtx) continue
          replayInkSlice(inkCtx, displayCommands, slice.indices, widthPx, heightPx)
        } else if (slice.kind === 'marker' && markersOnSessionLayer) {
          const el = markerSliceRefs.current[markerIdx++]
          const markerCtx = el?.getContext('2d', { alpha: true })
          if (!markerCtx) continue
          replayMarkerSlice(markerCtx, displayCommands, slice.indices, widthPx, heightPx)
        }
      }
      for (let i = inkIdx; i < inkSliceRefs.current.length; i++) {
        const el = inkSliceRefs.current[i]
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) clearAnnotationCanvas(ctx)
      }
      for (let i = markerIdx; i < markerSliceRefs.current.length; i++) {
        const el = markerSliceRefs.current[i]
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) clearAnnotationCanvas(ctx)
      }
      if (markersOnSessionLayer) paintTrailingMarkerDraft()
    }

    function paintTrailingMarkerDraft(): void {
      const el = trailingMarkerCanvasRef.current
      const ctx = el?.getContext('2d', { alpha: true })
      if (!ctx) return
      clearAnnotationCanvas(ctx)
      const trail = trailingMarkerStrokeDraft
      if (!trail || trail.tool !== 'marker' || trail.points.length < 1) return
      applyAnnotationCanvasDpr(ctx)
      const trailCmd: StrokeAnnotationCommand = {
        kind: 'stroke',
        id: '__trailing_marker__',
        tool: 'marker',
        points: trail.points.map((p) => [p[0], p[1]] as [number, number]),
        ...(trail.widthScale != null ? { widthScale: trail.widthScale } : {}),
        ...(trail.color ? { color: trail.color } : {}),
        ...(trail.lineDashStyle ? { lineDashStyle: trail.lineDashStyle } : {}),
        ...(trail.markerDecoratedEdge ? { markerDecoratedEdge: true } : {}),
      }
      drawStrokePath(ctx, trailCmd, widthPx, heightPx)
    }

    paintedCommandsRef.current = displayCommands
    paintedDeadKeyRef.current = deadKey
    if (markersOnSessionLayer) paintTrailingMarkerDraft()
  }, [
    displayCommands,
    deadIndices,
    deadKey,
    heightPx,
    widthPx,
    zoomRepaintRevision,
    markersOnSessionLayer,
    trailingMarkerStrokeDraft,
    selectScaleLiveBounds,
  ])

  const toNorm = (el: HTMLDivElement, clientX: number, clientY: number): [number, number] | null => {
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
  }

  function isPointerOverSelected(p: [number, number]): boolean {
    if (selectedIds.length === 0) return false
    return (
      hitTestSelectedAnnotationIndex(
        paintCommands,
        selectedIds,
        p[0],
        p[1],
        widthPx,
        heightPx,
        deadIndices,
      ) != null
    )
  }

  function updateSelectionHover(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) return
    const p = toNorm(e.currentTarget, e.clientX, e.clientY)
    if (!p) return

    if (selectedIds.length > 0 && !marqueeRect) {
      const union = unionSelectionBounds(paintCommands, selectedIds, widthPx, heightPx, deadIndices)
      if (union) {
        const handleFrame = resolveSelectionHandleFrame(
          paintCommands,
          selectedIds,
          widthPx,
          heightPx,
          union,
          null,
          null,
        )
        const onRotation =
          handleFrame != null &&
          selectionHasRotatableShapes(paintCommands, selectedIds) &&
          hitTestRotationHandleForFrame(p, handleFrame, widthPx, heightPx)
        if (onRotation !== hoveredRotationHandle) setHoveredRotationHandle(onRotation)
        if (onRotation) {
          if (hoveredScaleHandle) setHoveredScaleHandle(null)
          if (pointerOverSelection) setPointerOverSelection(false)
          return
        }
        const handle =
          handleFrame && hitTestScaleHandleForFrame(p, handleFrame, widthPx, heightPx)
        if (handle !== hoveredScaleHandle) setHoveredScaleHandle(handle)
        if (handle) {
          if (hoveredRotationHandle) setHoveredRotationHandle(false)
          if (pointerOverSelection) setPointerOverSelection(false)
          return
        }
      }
    }

    if (hoveredRotationHandle) setHoveredRotationHandle(false)
    if (hoveredScaleHandle) setHoveredScaleHandle(null)

    if (selectedIds.length === 0) {
      if (pointerOverSelection) setPointerOverSelection(false)
      return
    }
    const over = isPointerOverSelected(p)
    if (over !== pointerOverSelection) setPointerOverSelection(over)
  }

  const effectiveCursor: CSSProperties['cursor'] =
    activeGesture === 'rotate' || selectRotationLiveDelta != null
      ? cursorForRotationHandle(true)
      : activeGesture === 'move'
        ? 'grabbing'
        : activeGesture === 'scale' && selectScaleHandleRef.current
          ? cursorForScaleHandle(selectScaleHandleRef.current)
          : hoveredRotationHandle
            ? cursorForRotationHandle(false)
            : hoveredScaleHandle
              ? cursorForScaleHandle(hoveredScaleHandle)
              : pointerOverSelection && selectedIds.length > 0
                ? 'grab'
                : 'default'

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectEnabled) return
    const p = toNorm(e.currentTarget, e.clientX, e.clientY)
    if (!p) return

    if (selectedIds.length > 0) {
      const union = unionSelectionBounds(paintCommands, selectedIds, widthPx, heightPx, deadIndices)
      if (union) {
        const handleFrame = resolveSelectionHandleFrame(
          paintCommands,
          selectedIds,
          widthPx,
          heightPx,
          union,
          null,
          null,
        )
        if (
          handleFrame &&
          selectionHasRotatableShapes(paintCommands, selectedIds) &&
          hitTestRotationHandleForFrame(p, handleFrame, widthPx, heightPx)
        ) {
          clearSelectScaleLive()
          const pivot = selectionPivotFromBounds(union)
          const rotIds = rotatableIdsInSelection(paintCommands, selectedIds)
          selectRotateIdsRef.current = rotIds
          selectRotationPivotRef.current = pivot
          selectRotationStartAngleRef.current = angleFromPivotToPoint(pivot, p)
          selectRotationBaseCommandsRef.current = snapshotRotationBaseCommands(
            paintCommands,
            rotIds,
            widthPx,
            heightPx,
          )
          selectRotationStartFrameRef.current = rotationStartFrameForGesture(
            selectRotationBaseCommandsRef.current,
            selectedIds,
            union,
            widthPx,
            heightPx,
          )
          selectRotationLiveDeltaRef.current = 0
          setSelectRotationLiveDelta(0)
          selectGestureRef.current = 'rotate'
          setActiveGesture('rotate')
          dragAnchorRef.current = null
          marqueeAnchorRef.current = null
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
        const handle =
          handleFrame && hitTestScaleHandleForFrame(p, handleFrame, widthPx, heightPx)
        if (handle) {
          clearSelectRotationLive()
          selectScaleStartBoundsRef.current = union
          selectScaleHandleRef.current = handle
          selectScaleLiveBoundsRef.current = union
          setSelectScaleLiveBounds(union)
          selectGestureRef.current = 'scale'
          setActiveGesture('scale')
          dragAnchorRef.current = null
          marqueeAnchorRef.current = null
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
      }
    }

    const idx = hitTestAnnotationIndex(paintCommands, p[0], p[1], widthPx, heightPx, deadIndices)
    if (idx == null) {
      clearSelectScaleLive()
      clearSelectRotationLive()
      marqueeAnchorRef.current = p
      marqueeSelModeRef.current = selectionChangeModeFromPointerKeys(e)
      marqueeRectRef.current = normalizeMarqueeRect(p, p)
      setMarqueeRect(marqueeRectRef.current)
      setMarqueeMode(resolveMarqueeSelectMode(p, p, 'follow-drag'))
      selectGestureRef.current = 'marquee'
      setActiveGesture('marquee')
      e.currentTarget.setPointerCapture(e.pointerId)
      dragAnchorRef.current = null
      return
    }
    const cmd = paintCommands[idx]
    const id = cmd?.id
    if (!id || !cmd) return
    const targetIds =
      cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')
        ? resolvePenMarkerSelectionIds(paintCommands, id, widthPx, heightPx, deadIndices)
        : [id]
    const selMode = selectionChangeModeFromPointerKeys(e)
    const fullySelected = targetIds.every((tid) => selectedIds.includes(tid))
    if (selMode === 'replace' && fullySelected) {
      clearSelectScaleLive()
      clearSelectRotationLive()
      dragAnchorRef.current = p
      selectGestureRef.current = 'move'
      setActiveGesture('move')
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    const nextIds = applySelectionChange(selectedIds, targetIds, selMode)
    onSelectedIdsChange?.(nextIds)
    const canStartDrag =
      selMode === 'replace' &&
      targetIds.length > 0 &&
      targetIds.every((tid) => nextIds.includes(tid))
    if (!canStartDrag) {
      dragAnchorRef.current = null
      selectGestureRef.current = null
      return
    }
    clearSelectScaleLive()
    clearSelectRotationLive()
    dragAnchorRef.current = p
    selectGestureRef.current = 'move'
    setActiveGesture('move')
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectEnabled) return
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
      updateSelectionHover(e)
      return
    }
    const p = toNorm(e.currentTarget, e.clientX, e.clientY)
    if (!p) return

    if (selectGestureRef.current === 'scale') {
      const start = selectScaleStartBoundsRef.current
      const handle = selectScaleHandleRef.current
      if (!start || !handle) return
      const next = resizeBoundsFromHandle(start, handle, p, { uniform: !e.shiftKey })
      selectScaleLiveBoundsRef.current = next
      setSelectScaleLiveBounds(next)
      return
    }

    if (selectGestureRef.current === 'rotate') {
      const pivot = selectRotationPivotRef.current
      const startAngle = selectRotationStartAngleRef.current
      if (pivot == null || startAngle == null) return
      const delta = angleFromPivotToPoint(pivot, p) - startAngle
      selectRotationLiveDeltaRef.current = delta
      setSelectRotationLiveDelta(delta)
      return
    }

    const marqueeAnchor = marqueeAnchorRef.current
    if (marqueeAnchor) {
      marqueeRectRef.current = normalizeMarqueeRect(marqueeAnchor, p)
      setMarqueeRect(marqueeRectRef.current)
      setMarqueeMode(resolveMarqueeSelectMode(marqueeAnchor, p, 'follow-drag'))
      return
    }

    const anchor = dragAnchorRef.current
    if (!anchor) return
    const dx = p[0] - anchor[0]
    const dy = p[1] - anchor[1]
    if (dx === 0 && dy === 0) return
    dragAnchorRef.current = p
    onMoveSelectedBy?.(dx, dy)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (selectGestureRef.current === 'scale') {
      const start = selectScaleStartBoundsRef.current
      const live = selectScaleLiveBoundsRef.current
      if (start && live && onScaleSelectedBy) {
        onScaleSelectedBy(start, live)
      }
      resetSelectGesture()
      return
    }

    if (selectGestureRef.current === 'rotate') {
      const pivot = selectRotationPivotRef.current
      const delta = selectRotationLiveDeltaRef.current
      const rotIds = [...selectRotateIdsRef.current]
      const previewBase = selectRotationBaseCommandsRef.current
      if (pivot && delta != null && Math.abs(delta) > 1e-6 && rotIds.length > 0) {
        onRotateSelectedBy?.(pivot, delta, rotIds, previewBase)
      }
      resetSelectGesture()
      return
    }

    const marqueeAnchor = marqueeAnchorRef.current
    if (marqueeAnchor) {
      const p = toNorm(e.currentTarget, e.clientX, e.clientY)
      const rect = p ? normalizeMarqueeRect(marqueeAnchor, p) : marqueeRectRef.current
      if (rect && rect.w * rect.h >= 0.00004) {
        const mode = p ? resolveMarqueeSelectMode(marqueeAnchor, p, 'follow-drag') : 'crossing'
        const hits = annotationIdsInMarquee(paintCommands, rect, widthPx, heightPx, mode, deadIndices)
        onSelectedIdsChange?.(applySelectionChange(selectedIds, hits, marqueeSelModeRef.current))
      } else if (marqueeSelModeRef.current === 'replace') {
        onSelectedIdsChange?.([])
      }
    }
    resetSelectGesture()
  }

  const renderSlices = buildAnnotationRenderSlices(commands, deadIndices)
  let inkIdx = 0
  let markerIdx = 0

  return (
    <div
      className={cn(
        'absolute inset-0 touch-none',
        selectEnabled ? 'z-[35] pointer-events-auto' : 'z-[24] pointer-events-none',
      )}
      style={selectEnabled ? { cursor: effectiveCursor } : undefined}
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={clearSelectionHover}
    >
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
      {selectEnabled && selectedIds.length > 0 ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
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
            showRotationHandle={showRotationHandle}
            layoutWidthPx={widthPx}
            layoutHeightPx={heightPx}
          />
        </div>
      ) : null}
    </div>
  )
}
