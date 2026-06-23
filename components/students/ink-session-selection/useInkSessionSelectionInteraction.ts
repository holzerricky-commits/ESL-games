'use client'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { MARQUEE_MIN_AREA } from '@/components/students/book-page-annotation-layer/constants'
import {
  annotationIdsInMarquee,
  hitTestAnnotationIndex,
  hitTestSelectedAnnotationIndex,
  normalizeMarqueeRect,
  resolveMarqueeSelectMode,
  selectionIdsMatch,
  type GroupSelectionChrome,
  type MarqueeSelectRule,
  type NormRect,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'
import {
  applySelectionChange,
  selectionChangeModeFromPointerKeys,
  type SelectionChangeMode,
} from '@/lib/books/annotation-selection-ops'
import { clampSelectionMoveDelta } from '@/lib/books/annotation-scale'
import {
  angleFromPivotToPoint,
  hitTestRotationHandleForFrame,
  prepareRotationGestureState,
  rotatableIdsInSelection,
  selectionHasRotatableShapes,
} from '@/lib/books/annotation-rotation'
import {
  cursorForScaleHandleOnFrame,
  hitTestScaleHandleForFrame,
  resizeOrientedFrameFromHandle,
  type ScaleHandleId,
} from '@/lib/books/annotation-scale'
import {
  cursorForRotationHandle,
} from '@/lib/books/annotation-selection-chrome'
import {
  applyInkSessionSelectionLivePreview,
  computeInkSessionSelectionChrome,
} from '@/lib/books/ink-session-selection-display'

export type InkSessionSelectionGesture = 'marquee' | 'move' | 'scale' | 'rotate' | null

export type InkSessionRotateCommitParams = {
  pivot: [number, number]
  deltaRad: number
  ids: string[]
  previewBase: readonly AnnotationCommand[] | null
  rotationStartFrame: OrientedSelectionFrame | null
}

export type UseInkSessionSelectionInteractionOptions = {
  /** Select-tool chrome: handles, union bounds, marquee styling. */
  enabled: boolean
  /** Pointer down/move/up handling; defaults to `enabled`. */
  pointerEnabled?: boolean
  /** Hover outlines and handle hit-testing; defaults to `enabled`. */
  hoverEnabled?: boolean
  /** Commands used for hit-testing and rotation base (document space). */
  hitTestCommands: readonly AnnotationCommand[]
  /** Commands painted on canvas; defaults to hitTestCommands. */
  paintCommands?: readonly AnnotationCommand[]
  selectedIds: readonly string[]
  widthPx: number
  heightPx: number
  deadIndices?: ReadonlySet<number>
  groupSelectionChrome?: GroupSelectionChrome
  marqueeSelectRule?: MarqueeSelectRule
  editingId?: string | null
  rotateCommitFrame?: OrientedSelectionFrame | null
  nudgePreview?: { dx: number; dy: number } | null
  /** Clear selection when clicking empty canvas in replace mode (page layer). */
  clearSelectionOnEmptyClick?: boolean
  onSelectedIdsChange: (ids: string[]) => void
  onMoveCommitted: (dx: number, dy: number, moveIds: readonly string[]) => void
  onScaleCommitted: (start: OrientedSelectionFrame, end: OrientedSelectionFrame) => void
  onRotateCommitted: (params: InkSessionRotateCommitParams) => void
  /** Called after live gesture state changes (page layer repaint). */
  onGestureLiveChange?: () => void
  /** Reset group chrome to union after selection changes. */
  onGroupChromeReset?: () => void
  onClearEditing?: () => void
  resolveClickTargetIds: (cmd: AnnotationCommand) => string[]
  selectMoveIdsForDrag?: (hitCmd: AnnotationCommand) => string[]
  acceptPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => boolean
  clampMoveDelta?: (
    dx: number,
    dy: number,
    moveIds: readonly string[],
  ) => { dx: number; dy: number }
  /** Spread layer sets rotate commit frame after scale-with-rotation. */
  onScaleCommitFrame?: (frame: OrientedSelectionFrame) => void
  /** Spread layer bumps repaint after rotate commit overlay. */
  onRotateCommitRepaint?: () => void
}

export type ToNormFromElement = (
  el: HTMLDivElement,
  clientX: number,
  clientY: number,
) => [number, number] | null

export function useInkSessionSelectionInteraction(
  options: UseInkSessionSelectionInteractionOptions,
  toNorm: ToNormFromElement,
) {
  const {
    enabled,
    pointerEnabled: pointerEnabledOption,
    hoverEnabled: hoverEnabledOption,
    hitTestCommands,
    paintCommands: paintCommandsProp,
    selectedIds,
    widthPx,
    heightPx,
    deadIndices = new Set<number>(),
    groupSelectionChrome = 'union',
    marqueeSelectRule = 'follow-drag',
    editingId = null,
    rotateCommitFrame = null,
    nudgePreview = null,
    clearSelectionOnEmptyClick = false,
    onSelectedIdsChange,
    onMoveCommitted,
    onScaleCommitted,
    onRotateCommitted,
    onGestureLiveChange,
    onGroupChromeReset,
    onClearEditing,
    resolveClickTargetIds,
    selectMoveIdsForDrag,
    acceptPointerDown,
    clampMoveDelta,
    onScaleCommitFrame,
    onRotateCommitRepaint,
  } = options

  const paintCommands = paintCommandsProp ?? hitTestCommands
  const pointerEnabled = pointerEnabledOption ?? enabled
  const hoverEnabled = hoverEnabledOption ?? enabled
  const deadIndicesSet = useMemo(() => new Set(deadIndices), [deadIndices])

  const selectedIdsRef = useRef<string[]>([...selectedIds])
  selectedIdsRef.current = [...selectedIds]

  const selectGestureRef = useRef<InkSessionSelectionGesture>(null)
  const [activeGesture, setActiveGesture] = useState<InkSessionSelectionGesture>(null)
  const selectAnchorRef = useRef<[number, number] | null>(null)
  const marqueeSelModeRef = useRef<SelectionChangeMode>('replace')
  const [marqueeRect, setMarqueeRect] = useState<NormRect | null>(null)
  const [marqueeMode, setMarqueeMode] = useState<'window' | 'crossing' | null>(null)

  const selectMoveIdsRef = useRef<string[]>([])
  const selectScaleIdsRef = useRef<string[]>([])
  const selectScaleStartFrameRef = useRef<OrientedSelectionFrame | null>(null)
  const selectScaleHandleRef = useRef<ScaleHandleId | null>(null)
  const selectScaleLiveFrameRef = useRef<OrientedSelectionFrame | null>(null)
  const [selectScaleLiveFrame, setSelectScaleLiveFrame] = useState<OrientedSelectionFrame | null>(
    null,
  )

  const selectRotateIdsRef = useRef<string[]>([])
  const selectRotationPivotRef = useRef<[number, number] | null>(null)
  const selectRotationStartAngleRef = useRef<number | null>(null)
  const selectRotationBaseCommandsRef = useRef<AnnotationCommand[] | null>(null)
  const selectRotationStartFrameRef = useRef<OrientedSelectionFrame | null>(null)
  const selectRotationLiveDeltaRef = useRef<number | null>(null)
  const [selectRotationLiveDelta, setSelectRotationLiveDelta] = useState<number | null>(null)

  const [selectDragLive, setSelectDragLive] = useState<{ dx: number; dy: number } | null>(null)
  const selectDragLiveRef = useRef<{ dx: number; dy: number } | null>(null)
  selectDragLiveRef.current = selectDragLive
  selectScaleLiveFrameRef.current = selectScaleLiveFrame
  selectRotationLiveDeltaRef.current = selectRotationLiveDelta

  const [hoveredScaleHandle, setHoveredScaleHandle] = useState<ScaleHandleId | null>(null)
  const [hoveredRotationHandle, setHoveredRotationHandle] = useState(false)
  const [pointerOverSelection, setPointerOverSelection] = useState(false)
  const [hoverTargetIds, setHoverTargetIds] = useState<string[]>([])

  const clearSelectScaleLive = useCallback(() => {
    selectScaleStartFrameRef.current = null
    selectScaleHandleRef.current = null
    selectScaleLiveFrameRef.current = null
    setSelectScaleLiveFrame(null)
  }, [])

  const clearSelectRotationLive = useCallback(() => {
    selectRotateIdsRef.current = []
    selectRotationPivotRef.current = null
    selectRotationStartAngleRef.current = null
    selectRotationBaseCommandsRef.current = null
    selectRotationStartFrameRef.current = null
    selectRotationLiveDeltaRef.current = null
    setSelectRotationLiveDelta(null)
  }, [])

  const clearSelectDragLive = useCallback(() => {
    selectDragLiveRef.current = null
    setSelectDragLive(null)
  }, [])

  const clearSelectionHover = useCallback(() => {
    setHoveredScaleHandle(null)
    setHoveredRotationHandle(false)
    setPointerOverSelection(false)
    setHoverTargetIds([])
  }, [])

  const resetSelectGesture = useCallback(() => {
    selectGestureRef.current = null
    setActiveGesture(null)
    selectAnchorRef.current = null
    setMarqueeRect(null)
    setMarqueeMode(null)
    clearSelectScaleLive()
    clearSelectRotationLive()
    clearSelectDragLive()
    clearSelectionHover()
  }, [
    clearSelectDragLive,
    clearSelectRotationLive,
    clearSelectScaleLive,
    clearSelectionHover,
  ])

  const setHoverTargetIdsIfChanged = useCallback((next: string[]) => {
    setHoverTargetIds((prev) => (selectionIdsMatch(prev, next) ? prev : next))
  }, [])

  const notifyLiveChange = useCallback(() => {
    onGestureLiveChange?.()
  }, [onGestureLiveChange])

  const defaultClampMoveDelta = useCallback(
    (dx: number, dy: number, moveIds: readonly string[]) =>
      clampSelectionMoveDelta(
        hitTestCommands as AnnotationCommand[],
        moveIds,
        dx,
        dy,
        widthPx,
        heightPx,
        { deadIndices: deadIndicesSet },
      ),
    [deadIndices, hitTestCommands, heightPx, widthPx],
  )

  const clampMove = clampMoveDelta ?? defaultClampMoveDelta

  const livePreviewRefs = useMemo(
    () => ({
      selectRotationLiveDelta,
      selectRotateIds: selectRotateIdsRef.current,
      selectRotationPivot: selectRotationPivotRef.current,
      selectRotationBaseCommands: selectRotationBaseCommandsRef.current,
      selectRotationStartFrame: selectRotationStartFrameRef.current,
      selectScaleStartFrame: selectScaleStartFrameRef.current,
      selectScaleLiveFrame: selectScaleLiveFrameRef.current,
      selectScaleIds: selectScaleIdsRef.current.length > 0
        ? selectScaleIdsRef.current
        : selectedIds,
      selectDragLive,
      selectMoveIds:
        selectMoveIdsRef.current.length > 0
          ? selectMoveIdsRef.current
          : selectedIds,
    }),
    [
      selectDragLive,
      selectRotationLiveDelta,
      selectScaleLiveFrame,
      selectedIds,
    ],
  )

  const displayCommands = useMemo(
    () =>
      applyInkSessionSelectionLivePreview(
        paintCommands,
        selectedIds,
        widthPx,
        heightPx,
        livePreviewRefs,
        {
          nudgePreview,
          mergeRotatedInto:
            paintCommands !== hitTestCommands ? paintCommands : undefined,
        },
      ),
    [
      hitTestCommands,
      livePreviewRefs,
      nudgePreview,
      paintCommands,
      selectedIds,
      widthPx,
      heightPx,
    ],
  )

  const chrome = useMemo(
    () =>
      computeInkSessionSelectionChrome({
        displayCommands,
        selectedIds,
        widthPx,
        heightPx,
        enabled,
        editingId,
        marqueeRect,
        groupSelectionChrome,
        deadIndices,
        selectRotationLiveDelta,
        selectRotationStartFrame: selectRotationStartFrameRef.current,
        rotateCommitFrame,
        selectScaleLiveFrame,
        hoverTargetIds,
      }),
    [
      deadIndices,
      displayCommands,
      editingId,
      enabled,
      groupSelectionChrome,
      heightPx,
      hoverTargetIds,
      marqueeRect,
      rotateCommitFrame,
      selectRotationLiveDelta,
      selectScaleLiveFrame,
      selectedIds,
      widthPx,
    ],
  )

  const selectionInteractionCommandsRef = useRef<AnnotationCommand[]>([])
  const selectionInteractionFrameRef = useRef<OrientedSelectionFrame | null>(null)
  const selectionInteractionUnionRef = useRef<NormRect | null>(null)
  const selectionInteractionDeadRef = useRef<Set<number>>(deadIndicesSet)

  selectionInteractionCommandsRef.current = displayCommands as AnnotationCommand[]
  selectionInteractionFrameRef.current = chrome.selectionHandleFrame
  selectionInteractionUnionRef.current = chrome.selectionUnionBounds
  selectionInteractionDeadRef.current = deadIndicesSet

  const beginSelectMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, p: [number, number], moveIds?: string[]) => {
      clearSelectScaleLive()
      clearSelectRotationLive()
      selectMoveIdsRef.current = moveIds ?? [...selectedIdsRef.current]
      selectGestureRef.current = 'move'
      setActiveGesture('move')
      selectAnchorRef.current = p
      selectDragLiveRef.current = { dx: 0, dy: 0 }
      setSelectDragLive({ dx: 0, dy: 0 })
      setMarqueeRect(null)
      e.currentTarget.setPointerCapture(e.pointerId)
      notifyLiveChange()
    },
    [clearSelectRotationLive, clearSelectScaleLive, notifyLiveChange],
  )

  const beginSelectScale = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      handle: ScaleHandleId,
      startFrame: OrientedSelectionFrame,
    ) => {
      clearSelectRotationLive()
      clearSelectDragLive()
      setMarqueeRect(null)
      setMarqueeMode(null)
      selectScaleIdsRef.current = [...selectedIdsRef.current]
      const frameCopy: OrientedSelectionFrame = {
        rect: { ...startFrame.rect },
        rotationDeg: startFrame.rotationDeg,
      }
      selectScaleStartFrameRef.current = frameCopy
      selectScaleHandleRef.current = handle
      selectScaleLiveFrameRef.current = frameCopy
      setSelectScaleLiveFrame(frameCopy)
      selectGestureRef.current = 'scale'
      setActiveGesture('scale')
      selectAnchorRef.current = null
      e.currentTarget.setPointerCapture(e.pointerId)
      notifyLiveChange()
    },
    [clearSelectDragLive, clearSelectRotationLive, notifyLiveChange],
  )

  const beginSelectRotate = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      handleFrame: OrientedSelectionFrame,
      p: [number, number],
    ) => {
      clearSelectScaleLive()
      clearSelectDragLive()
      setMarqueeRect(null)
      setMarqueeMode(null)
      const rotIds = rotatableIdsInSelection(
        hitTestCommands as AnnotationCommand[],
        selectedIdsRef.current,
      )
      const prepared = prepareRotationGestureState(
        hitTestCommands as AnnotationCommand[],
        rotIds,
        handleFrame,
        { widthPx, heightPx },
      )
      selectRotateIdsRef.current = rotIds
      selectRotationPivotRef.current = prepared.pivot
      selectRotationStartAngleRef.current = angleFromPivotToPoint(prepared.pivot, p)
      selectRotationBaseCommandsRef.current = prepared.baseCommands
      selectRotationStartFrameRef.current = prepared.startFrame
      selectRotationLiveDeltaRef.current = 0
      setSelectRotationLiveDelta(0)
      selectGestureRef.current = 'rotate'
      setActiveGesture('rotate')
      selectAnchorRef.current = null
      e.currentTarget.setPointerCapture(e.pointerId)
      notifyLiveChange()
    },
    [
      clearSelectDragLive,
      clearSelectScaleLive,
      heightPx,
      hitTestCommands,
      notifyLiveChange,
      widthPx,
    ],
  )

  const isPointerOverSelected = useCallback(
    (p: [number, number]) => {
      if (selectedIdsRef.current.length === 0) return false
      return (
        hitTestSelectedAnnotationIndex(
          selectionInteractionCommandsRef.current,
          selectedIdsRef.current,
          p[0],
          p[1],
          widthPx,
          heightPx,
          selectionInteractionDeadRef.current,
        ) != null
      )
    },
    [heightPx, widthPx],
  )

  const updateSelectionHover = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) return
      const p = toNorm(e.currentTarget, e.clientX, e.clientY)
      if (!p) return

      if (
        hoverEnabled &&
        editingId == null &&
        selectedIdsRef.current.length > 0 &&
        !marqueeRect &&
        selectionInteractionFrameRef.current
      ) {
        const handleFrame = selectionInteractionFrameRef.current
        const interactionCommands = selectionInteractionCommandsRef.current
        const onRotation =
          selectionHasRotatableShapes(interactionCommands, selectedIdsRef.current) &&
          hitTestRotationHandleForFrame(p, handleFrame, widthPx, heightPx)
        if (onRotation !== hoveredRotationHandle) setHoveredRotationHandle(onRotation)
        if (onRotation) {
          if (hoveredScaleHandle) setHoveredScaleHandle(null)
          if (pointerOverSelection) setPointerOverSelection(false)
          return
        }
        const handle = hitTestScaleHandleForFrame(p, handleFrame, widthPx, heightPx)
        if (handle !== hoveredScaleHandle) setHoveredScaleHandle(handle)
        if (handle) {
          if (hoveredRotationHandle) setHoveredRotationHandle(false)
          if (pointerOverSelection) setPointerOverSelection(false)
          return
        }
      }

      if (hoveredRotationHandle) setHoveredRotationHandle(false)
      if (hoveredScaleHandle) setHoveredScaleHandle(null)

      if (hoverEnabled && editingId == null && !marqueeRect) {
        const idx = hitTestAnnotationIndex(
          hitTestCommands as AnnotationCommand[],
          p[0],
          p[1],
          widthPx,
          heightPx,
          deadIndicesSet,
        )
        if (idx == null) {
          if (hoverTargetIds.length > 0) setHoverTargetIds([])
        } else {
          const cmd = hitTestCommands[idx]!
          const targetIds = resolveClickTargetIds(cmd)
          if (selectionIdsMatch(targetIds, selectedIdsRef.current)) {
            if (hoverTargetIds.length > 0) setHoverTargetIds([])
          } else {
            setHoverTargetIdsIfChanged(targetIds)
          }
        }
      } else if (hoverTargetIds.length > 0) {
        setHoverTargetIds([])
      }

      if (selectedIdsRef.current.length === 0) {
        if (pointerOverSelection) setPointerOverSelection(false)
        return
      }
      const over = isPointerOverSelected(p)
      if (over !== pointerOverSelection) setPointerOverSelection(over)
    },
    [
      deadIndices,
      editingId,
      hoverEnabled,
      heightPx,
      hitTestCommands,
      hoveredRotationHandle,
      hoveredScaleHandle,
      isPointerOverSelected,
      marqueeRect,
      pointerOverSelection,
      resolveClickTargetIds,
      setHoverTargetIdsIfChanged,
      toNorm,
      hoverTargetIds.length,
      widthPx,
    ],
  )

  const effectiveCursor: CSSProperties['cursor'] = useMemo(() => {
    if (activeGesture === 'rotate' || selectRotationLiveDelta != null) {
      return cursorForRotationHandle(true)
    }
    if (activeGesture === 'move') return 'grabbing'
    if (
      activeGesture === 'scale' &&
      selectScaleHandleRef.current &&
      chrome.selectionHandleFrame
    ) {
      return cursorForScaleHandleOnFrame(
        selectScaleHandleRef.current,
        chrome.selectionHandleFrame,
        widthPx,
        heightPx,
      )
    }
    if (hoveredRotationHandle) return cursorForRotationHandle(false)
    if (hoveredScaleHandle && chrome.selectionHandleFrame) {
      return cursorForScaleHandleOnFrame(
        hoveredScaleHandle,
        chrome.selectionHandleFrame,
        widthPx,
        heightPx,
      )
    }
    if (
      (pointerOverSelection && selectedIds.length > 0) ||
      (hoverTargetIds.length > 0 && !marqueeRect)
    ) {
      return 'move'
    }
    return 'default'
  }, [
    activeGesture,
    chrome.selectionHandleFrame,
    heightPx,
    hoveredRotationHandle,
    hoveredScaleHandle,
    hoverTargetIds.length,
    marqueeRect,
    pointerOverSelection,
    selectRotationLiveDelta,
    selectedIds.length,
    widthPx,
  ])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerEnabled) return
      if (acceptPointerDown && !acceptPointerDown(e)) return
      onClearEditing?.()
      if (e.button === 0) e.preventDefault()
      setHoverTargetIds([])
      const p = toNorm(e.currentTarget, e.clientX, e.clientY)
      if (!p) return

      const selMode = selectionChangeModeFromPointerKeys(e)

      if (editingId == null && selectedIdsRef.current.length > 0) {
        const union = selectionInteractionUnionRef.current
        const handleFrame = selectionInteractionFrameRef.current
        const interactionCommands = selectionInteractionCommandsRef.current
        if (union && handleFrame) {
          if (
            selectionHasRotatableShapes(interactionCommands, selectedIdsRef.current) &&
            hitTestRotationHandleForFrame(p, handleFrame, widthPx, heightPx)
          ) {
            beginSelectRotate(e, handleFrame, p)
            return
          }
          const handle = hitTestScaleHandleForFrame(p, handleFrame, widthPx, heightPx)
          if (handle) {
            beginSelectScale(e, handle, handleFrame)
            return
          }
        }
      }

      const idx = hitTestAnnotationIndex(
        hitTestCommands as AnnotationCommand[],
        p[0],
        p[1],
        widthPx,
        heightPx,
        deadIndicesSet,
      )

      if (idx != null) {
        const cmd = hitTestCommands[idx]!
        const targetIds = resolveClickTargetIds(cmd)
        const fullySelected = targetIds.every((id) => selectedIdsRef.current.includes(id))

        if (selMode === 'replace' && fullySelected) {
          const moveIds = selectMoveIdsForDrag?.(cmd) ?? [...selectedIdsRef.current]
          beginSelectMove(e, p, moveIds)
          return
        }

        const nextIds = applySelectionChange(selectedIdsRef.current, targetIds, selMode)
        onSelectedIdsChange(nextIds)
        onGroupChromeReset?.()

        if (selMode === 'shiftClick' || selMode === 'subtract') return
        if (selMode === 'toggle' && fullySelected) return
        if (nextIds.length === 0) return

        const moveIds = selectMoveIdsForDrag?.(cmd) ?? [...selectedIdsRef.current]
        beginSelectMove(e, p, moveIds)
        return
      }

      if (clearSelectionOnEmptyClick && selMode === 'replace') {
        onSelectedIdsChange([])
        onGroupChromeReset?.()
      }

      marqueeSelModeRef.current = selMode === 'shiftClick' ? 'add' : selMode
      selectGestureRef.current = 'marquee'
      setActiveGesture('marquee')
      selectAnchorRef.current = p
      setMarqueeRect(normalizeMarqueeRect(p, p))
      setMarqueeMode(resolveMarqueeSelectMode(p, p, marqueeSelectRule))
      clearSelectDragLive()
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [
      acceptPointerDown,
      beginSelectMove,
      beginSelectRotate,
      beginSelectScale,
      clearSelectDragLive,
      clearSelectionOnEmptyClick,
      deadIndices,
      editingId,
      pointerEnabled,
      heightPx,
      hitTestCommands,
      marqueeSelectRule,
      onClearEditing,
      onGroupChromeReset,
      onSelectedIdsChange,
      resolveClickTargetIds,
      selectMoveIdsForDrag,
      toNorm,
      widthPx,
    ],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerEnabled) return
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        updateSelectionHover(e)
        return
      }
      const p = toNorm(e.currentTarget, e.clientX, e.clientY)
      if (!p) return

      if (selectGestureRef.current === 'scale') {
        const startFrame = selectScaleStartFrameRef.current
        const handle = selectScaleHandleRef.current
        if (!startFrame || !handle) return
        const nextFrame = resizeOrientedFrameFromHandle(
          startFrame,
          handle,
          p,
          widthPx,
          heightPx,
          { uniform: !e.shiftKey },
        )
        selectScaleLiveFrameRef.current = nextFrame
        setSelectScaleLiveFrame(nextFrame)
        notifyLiveChange()
        return
      }

      if (selectGestureRef.current === 'rotate') {
        const pivot = selectRotationPivotRef.current
        const startAngle = selectRotationStartAngleRef.current
        if (pivot == null || startAngle == null) return
        const delta = angleFromPivotToPoint(pivot, p) - startAngle
        selectRotationLiveDeltaRef.current = delta
        setSelectRotationLiveDelta(delta)
        notifyLiveChange()
        return
      }

      const anchor = selectAnchorRef.current
      if (!anchor) return

      if (selectGestureRef.current === 'marquee') {
        setMarqueeRect(normalizeMarqueeRect(anchor, p))
        setMarqueeMode(resolveMarqueeSelectMode(anchor, p, marqueeSelectRule))
        return
      }

      if (selectGestureRef.current === 'move') {
        const { dx, dy } = clampMove(
          p[0] - anchor[0],
          p[1] - anchor[1],
          selectMoveIdsRef.current,
        )
        const live = { dx, dy }
        selectDragLiveRef.current = live
        setSelectDragLive(live)
        notifyLiveChange()
      }
    },
    [
      clampMove,
      pointerEnabled,
      heightPx,
      marqueeSelectRule,
      notifyLiveChange,
      toNorm,
      updateSelectionHover,
      widthPx,
    ],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      const gesture = selectGestureRef.current
      selectGestureRef.current = null
      setActiveGesture(null)
      const anchor = selectAnchorRef.current
      selectAnchorRef.current = null

      if (gesture === 'marquee' && anchor) {
        const p = toNorm(e.currentTarget, e.clientX, e.clientY)
        const rect = p ? normalizeMarqueeRect(anchor, p) : marqueeRect
        const mode = p
          ? resolveMarqueeSelectMode(anchor, p, marqueeSelectRule)
          : marqueeMode ?? 'crossing'
        setMarqueeRect(null)
        setMarqueeMode(null)
        if (rect && rect.w * rect.h >= MARQUEE_MIN_AREA) {
          const hits = annotationIdsInMarquee(
            hitTestCommands as AnnotationCommand[],
            rect,
            widthPx,
            heightPx,
            mode,
            deadIndicesSet,
          )
          onSelectedIdsChange(
            applySelectionChange(selectedIdsRef.current, hits, marqueeSelModeRef.current),
          )
          onGroupChromeReset?.()
        } else if (marqueeSelModeRef.current === 'replace') {
          onSelectedIdsChange([])
          onGroupChromeReset?.()
        }
        clearSelectionHover()
        return
      }

      if (gesture === 'move') {
        const live = selectDragLiveRef.current
        clearSelectDragLive()
        if (live && (live.dx !== 0 || live.dy !== 0)) {
          onMoveCommitted(live.dx, live.dy, selectMoveIdsRef.current)
        } else {
          notifyLiveChange()
        }
        return
      }

      if (gesture === 'scale') {
        const startFrame = selectScaleStartFrameRef.current
        const liveFrame = selectScaleLiveFrameRef.current
        clearSelectScaleLive()
        if (
          startFrame &&
          liveFrame &&
          (Math.abs(startFrame.rect.w - liveFrame.rect.w) > 1e-6 ||
            Math.abs(startFrame.rect.h - liveFrame.rect.h) > 1e-6 ||
            Math.abs(startFrame.rect.x - liveFrame.rect.x) > 1e-6 ||
            Math.abs(startFrame.rect.y - liveFrame.rect.y) > 1e-6)
        ) {
          onScaleCommitted(startFrame, liveFrame)
          if (Math.abs(liveFrame.rotationDeg) > 1e-6) {
            onScaleCommitFrame?.(liveFrame)
          }
        } else {
          notifyLiveChange()
        }
        return
      }

      if (gesture === 'rotate') {
        const pivot = selectRotationPivotRef.current
        const delta = selectRotationLiveDeltaRef.current
        const rotIds = [...selectRotateIdsRef.current]
        const previewBase = selectRotationBaseCommandsRef.current
        if (pivot && delta != null && Math.abs(delta) > 1e-6 && rotIds.length > 0) {
          onRotateCommitted({
            pivot,
            deltaRad: delta,
            ids: rotIds,
            previewBase,
            rotationStartFrame: selectRotationStartFrameRef.current,
          })
          onRotateCommitRepaint?.()
        }
        clearSelectRotationLive()
        notifyLiveChange()
      }
    },
    [
      clearSelectDragLive,
      clearSelectRotationLive,
      clearSelectScaleLive,
      clearSelectionHover,
      deadIndices,
      heightPx,
      hitTestCommands,
      marqueeMode,
      marqueeRect,
      marqueeSelectRule,
      notifyLiveChange,
      onGroupChromeReset,
      onMoveCommitted,
      onRotateCommitRepaint,
      onRotateCommitted,
      onScaleCommitFrame,
      onScaleCommitted,
      onSelectedIdsChange,
      toNorm,
      widthPx,
    ],
  )

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      resetSelectGesture()
      notifyLiveChange()
    },
    [notifyLiveChange, resetSelectGesture],
  )

  return {
    displayCommands,
    chrome,
    marqueeRect,
    marqueeMode,
    selectDragLive,
    selectScaleLiveFrame,
    selectRotationLiveDelta,
    activeGesture,
    effectiveCursor,
    selectionInteractionCommandsRef,
    selectionInteractionFrameRef,
    selectionInteractionUnionRef,
    selectionInteractionDeadRef,
    clearSelectScaleLive,
    clearSelectRotationLive,
    clearSelectDragLive,
    clearSelectionHover,
    resetSelectGesture,
    setSelectDragLive,
    setHoverTargetIds,
    beginSelectMove,
    beginSelectScale,
    beginSelectRotate,
    updateSelectionHover,
    isPointerOverSelected,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
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
  }
}
