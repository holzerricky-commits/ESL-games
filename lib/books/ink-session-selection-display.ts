import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  rotateAnnotationCommands,
} from '@/lib/books/annotation-rotation'
import {
  scaleAnnotationCommandsFromOrientedFrames,
  unionSelectionBounds,
} from '@/lib/books/annotation-scale'
import type { GroupSelectionChrome } from '@/lib/books/annotation-select'
import {
  filterUnlockedTransformIds,
  resolveSelectionHandleFrame,
  selectionOutlineFramesForChrome,
  translateAnnotationCommands,
  type NormRect,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'
import { selectionHasRotatableShapes } from '@/lib/books/annotation-rotation'

export type InkSessionSelectionLivePreviewRefs = {
  selectRotationLiveDelta: number | null
  selectRotateIds: readonly string[]
  selectRotationPivot: [number, number] | null
  selectRotationBaseCommands: readonly AnnotationCommand[] | null
  selectRotationStartFrame: OrientedSelectionFrame | null
  selectScaleStartFrame: OrientedSelectionFrame | null
  selectScaleLiveFrame: OrientedSelectionFrame | null
  selectScaleIds: readonly string[]
  selectDragLive: { dx: number; dy: number } | null
  selectMoveIds: readonly string[]
}

/** Apply live move / scale / rotate preview on top of base commands. */
export function applyInkSessionSelectionLivePreview(
  baseCommands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
  refs: InkSessionSelectionLivePreviewRefs,
  options?: {
    nudgePreview?: { dx: number; dy: number } | null
    /** When paint space differs from hit-test space, merge rotated ids into paint list. */
    mergeRotatedInto?: readonly AnnotationCommand[]
  },
): AnnotationCommand[] {
  const {
    selectRotationLiveDelta,
    selectRotateIds,
    selectRotationPivot,
    selectRotationBaseCommands,
    selectRotationStartFrame,
    selectScaleStartFrame,
    selectScaleLiveFrame,
    selectScaleIds,
    selectDragLive,
    selectMoveIds,
  } = refs

  if (
    selectRotationLiveDelta != null &&
    selectRotationPivot &&
    selectRotationBaseCommands
  ) {
    const rotated = rotateAnnotationCommands(
      selectRotationBaseCommands,
      new Set(selectRotateIds),
      selectRotationPivot,
      selectRotationLiveDelta,
      { widthPx, heightPx },
      selectRotationStartFrame,
    )
    if (!options?.mergeRotatedInto || options.mergeRotatedInto === baseCommands) {
      return rotated
    }
    const byId = new Map(rotated.map((c) => [c.id, c]))
    return options.mergeRotatedInto.map((c) => byId.get(c.id) ?? c)
  }

  if (selectScaleLiveFrame && selectScaleStartFrame && selectScaleIds.length > 0) {
    return scaleAnnotationCommandsFromOrientedFrames(
      baseCommands as AnnotationCommand[],
      new Set(selectScaleIds),
      selectScaleStartFrame,
      selectScaleLiveFrame,
      widthPx,
      heightPx,
    )
  }

  if (selectDragLive && selectMoveIds.length > 0) {
    return translateAnnotationCommands(
      baseCommands as AnnotationCommand[],
      new Set(selectMoveIds),
      selectDragLive.dx,
      selectDragLive.dy,
    )
  }

  if (options?.nudgePreview && selectedIds.length > 0) {
    return translateAnnotationCommands(
      baseCommands as AnnotationCommand[],
      new Set(selectedIds),
      options.nudgePreview.dx,
      options.nudgePreview.dy,
    )
  }

  return baseCommands as AnnotationCommand[]
}

export type InkSessionSelectionChromeInput = {
  displayCommands: readonly AnnotationCommand[]
  selectedIds: readonly string[]
  widthPx: number
  heightPx: number
  enabled: boolean
  editingId?: string | null
  marqueeRect: NormRect | null
  groupSelectionChrome?: GroupSelectionChrome
  deadIndices?: ReadonlySet<number>
  selectRotationLiveDelta: number | null
  selectRotationStartFrame: OrientedSelectionFrame | null
  rotateCommitFrame: OrientedSelectionFrame | null
  selectScaleLiveFrame: OrientedSelectionFrame | null
  hoverTargetIds: readonly string[]
}

export type InkSessionSelectionChromeState = {
  selectionOutlineFramesList: OrientedSelectionFrame[]
  hoverOutlineFramesList: OrientedSelectionFrame[]
  selectionUnionBounds: NormRect | null
  showScaleHandles: boolean
  showRotationHandle: boolean
  selectionHandleFrame: OrientedSelectionFrame | null
  showUnionOutline: boolean
}

export function computeInkSessionSelectionChrome(
  input: InkSessionSelectionChromeInput,
): InkSessionSelectionChromeState {
  const {
    displayCommands,
    selectedIds,
    widthPx,
    heightPx,
    enabled,
    editingId = null,
    marqueeRect,
    groupSelectionChrome = 'union',
    deadIndices,
    selectRotationLiveDelta,
    selectRotationStartFrame,
    rotateCommitFrame,
    selectScaleLiveFrame,
    hoverTargetIds,
  } = input

  const transformableSelectedIds = filterUnlockedTransformIds(displayCommands, selectedIds)
  const hasTransformableSelection = transformableSelectedIds.length > 0
  /** Outlines stay when another tool is active (e.g. Type after submit); handles only in Move. */
  const chromeActive = editingId == null && (enabled || hasTransformableSelection)
  const hoverUnlockedIds = filterUnlockedTransformIds(displayCommands, hoverTargetIds)

  const selectionOutlineFramesList =
    chromeActive && hasTransformableSelection && !marqueeRect
      ? selectionOutlineFramesForChrome(
          displayCommands,
          transformableSelectedIds,
          widthPx,
          heightPx,
          groupSelectionChrome,
          deadIndices,
          selectRotationLiveDelta,
          selectRotationStartFrame,
          rotateCommitFrame,
        )
      : []

  const hoverOutlineFramesList =
    chromeActive && hoverUnlockedIds.length > 0 && !marqueeRect
      ? selectionOutlineFramesForChrome(
          displayCommands,
          hoverUnlockedIds,
          widthPx,
          heightPx,
          'union',
          deadIndices,
        )
      : []

  const selectionUnionBounds =
    chromeActive && hasTransformableSelection && !marqueeRect
      ? unionSelectionBounds(
          displayCommands,
          transformableSelectedIds,
          widthPx,
          heightPx,
          deadIndices,
        )
      : null

  const showScaleHandles =
    enabled && hasTransformableSelection && !marqueeRect && selectionUnionBounds != null

  const showRotationHandle =
    showScaleHandles &&
    selectionHasRotatableShapes(displayCommands, transformableSelectedIds)

  const selectionHandleFrame =
    selectScaleLiveFrame ??
    (showScaleHandles && selectionUnionBounds
      ? resolveSelectionHandleFrame(
          displayCommands,
          transformableSelectedIds,
          widthPx,
          heightPx,
          selectionUnionBounds,
          selectRotationLiveDelta,
          selectRotationStartFrame,
          rotateCommitFrame,
        )
      : null)

  const showUnionOutline =
    showScaleHandles &&
    selectionOutlineFramesList.length > 1 &&
    selectionHandleFrame != null

  return {
    selectionOutlineFramesList,
    hoverOutlineFramesList,
    selectionUnionBounds,
    showScaleHandles,
    showRotationHandle,
    selectionHandleFrame,
    showUnionOutline,
  }
}
