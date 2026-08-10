'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type {  AnnotationCommand,
  StickyAnnotationCommand,
  TextAnnotationAlign,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import type { TextAnnotationVisualStyle } from '@/lib/books/annotation-command-types'
import type { InkStrokeSelectionPatch, ImageSelectionPatch, ShapeSelectionPatch } from '@/lib/books/patch-selected-commands'
import type { HorizontalAlignAxis } from '@/lib/books/annotation-align'
import { hitTestAnnotationIndex, hitTestTextAnnotationIndex } from '@/lib/books/annotation-select'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import { eraserLineTrailingForReplay } from '@/lib/books/annotation-live-paint'
import {
  endBookOverlayAnnotationEditingFocus,
  isAnnotationTextFieldFocused,
  scheduleBookOverlayAnnotationFieldFocus,
  setBookOverlayAnnotationEditSessionId,
} from '@/lib/books/book-overlay-keyboard-guards'
import {
  isPointerOnAnnotationLabelShell,
  isPointerOnAnnotationTextarea,
  shouldDismissBookOverlayAnnotationEditOnPointerDown,
} from '@/lib/books/book-overlay-typing-dismiss'
import {
  resolveTextToolHoverTargetId,
  textToolEditingOutlineFrames,
  textToolHoverOutlineFrames,
  textToolPlacementCursor,
  type TextToolHoverKind,
} from '@/lib/books/text-tool-hover'
import { TAP_MOVE_EPS } from '@/components/students/book-page-annotation-layer/constants'
import { clamp01, newAnnotationId } from '@/components/students/book-page-annotation-layer/helpers'
import type { ToNormFromElement } from '@/components/students/ink-session-selection/useInkSessionSelectionInteraction'
import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import {
  isQuickStickerInteraction,
  isWritableStickerInteraction,
  type StickerKind,
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
  shouldResetSuppressNextPlacementOnDomToolEntry,
  suppressNextPlacementAfterCanvasClickAwayDismiss,
  suppressNextPlacementAfterOutsideDismiss,
} from '@/lib/books/spread-dom-placement-suppress'

export type SpreadSessionDomConfig = {
  enabled: boolean
  mode: BookAnnotationInteractionMode
  stickerKind?: StickerKind
  writableStickerVariant?: WritableStickerVariant
  textColor: string
  textFontSizeNorm: number
  textFontId: AnnotationTextFontId
  textVisualStyle: TextAnnotationVisualStyle
  textAlign: TextAnnotationAlign
  textFillColor: string
  stickyFillColor: string
  stickyFontSizeNorm: number
  defaultStickyWNorm: number
  defaultStickyHNorm: number
  /** Injected by session layer when using R4 store boundary; omit from parent config. */
  commands?: readonly AnnotationCommand[]
  widthPx: number
  heightPx: number
  selectEnabled: boolean
  selectedIds: readonly string[]
  onAppendCommand: (cmd: AnnotationCommand) => void
  onPatchCommand: (
    id: string,
    partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>,
  ) => void
  onDeleteText: (id: string) => void
  onDeleteSticky: (id: string) => void
  onSelectedIdsChange?: (ids: string[]) => void
  onPatchSelectedText?: (partial: Partial<TextAnnotationCommand>) => void
  onPatchSelectedSticky?: (partial: Partial<StickyAnnotationCommand>) => void
  onPatchSelectedShape?: (patch: ShapeSelectionPatch) => void
  onPatchSelectedImage?: (patch: ImageSelectionPatch) => void
  onPatchSelectedStroke?: (patch: InkStrokeSelectionPatch) => void
  onMoveSelectedForward?: () => void
  onMoveSelectedBackward?: () => void
  onToggleGroupSelected?: () => void
  onDeleteSelected?: () => void
  onDuplicateSelected?: () => void
  onArrangeSelected?: (axis: HorizontalAlignAxis) => void
  onDistributeVerticalSelected?: () => void
  /** After finishing a writable sticker, switch to Move so it can be adjusted. */
  onEnterSelectMode?: () => void
  /** Move the current selection (used by Type tool drag after submit). */
  onMoveSelectedBy?: (dx: number, dy: number) => void
  /** Filled in by BookSpreadSessionLayer (spread-normalized pointer mapping). */
  toNorm?: ToNormFromElement
  /** Close rail tool settings when the user starts using the active tool on the spread. */
  onToolUseOnSpread?: () => void
}

function clearTypingEditState(
  setFocusNewId: (id: string | null) => void,
  setEditingId: (id: string | null) => void,
  setEditingTextDraft: (text: string | null) => void,
) {
  setFocusNewId(null)
  setEditingId(null)
  setEditingTextDraft(null)
  setBookOverlayAnnotationEditSessionId(null)
}

function selectAnnotationAfterEditEnd(
  config: SpreadSessionDomConfig | null,
  endedId: string | null,
) {
  if (!endedId || !config) return
  const cmd = config.commands.find((c) => c.id === endedId)
  if (cmd?.kind === 'text') {
    // Keep Type tool: select so the hand can grab/move; empty discard stays unselected.
    const liveField =
      typeof document !== 'undefined'
        ? document.querySelector(`textarea[data-annotation-id="${endedId}"]`)
        : null
    const liveText =
      liveField instanceof HTMLTextAreaElement ? liveField.value : cmd.text
    if (!liveText.trim()) return
    if (config.mode !== 'text') return
    config.onSelectedIdsChange?.([endedId])
    return
  }
  if (cmd?.kind !== 'sticky') return
  // Empty writables are discarded on commit — never select / switch to Move.
  const liveField =
    typeof document !== 'undefined'
      ? document.querySelector(`textarea[data-annotation-id="${endedId}"]`)
      : null
  const liveText =
    liveField instanceof HTMLTextAreaElement ? liveField.value : cmd.text
  if (!liveText.trim()) return
  // Only auto-Move when the writable tool is still active (click-away commit),
  // not when the user already picked pen / stamp / another tool.
  const stickerKind = config.stickerKind ?? 'writable'
  const stillOnWritable =
    isWritableStickerInteraction(config.mode, stickerKind) || config.mode === 'sticky'
  if (!stillOnWritable) return
  config.onSelectedIdsChange?.([endedId])
  config.onEnterSelectMode?.()
}

export function useSpreadSessionDomInteraction(config: SpreadSessionDomConfig | null) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [focusNewId, setFocusNewId] = useState<string | null>(null)
  const [selectTextEditActive, setSelectTextEditActive] = useState(false)
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null)
  const [editingTextDraft, setEditingTextDraft] = useState<string | null>(null)
  const tapStartRef = useRef<[number, number] | null>(null)
  const tapModeRef = useRef<'text' | 'sticky' | null>(null)
  /** Open typing on pointerup — focus fails if we mount the field during pointerdown. */
  const pendingTypingEditRef = useRef<string | null>(null)
  /** Drawboard-style move of selected text while Type tool stays active. */
  const textToolDragRef = useRef<{
    ids: string[]
    lastNorm: [number, number]
    totalDx: number
    totalDy: number
    moved: boolean
  } | null>(null)
  const [textToolDragLive, setTextToolDragLive] = useState<{ dx: number; dy: number } | null>(
    null,
  )
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const suppressNextPlacementRef = useRef(false)

  const enabled = config?.enabled ?? false
  const mode = config?.mode ?? 'pen'
  const stickerKind = config?.stickerKind ?? 'writable'
  const writableStickerVariant = config?.writableStickerVariant ?? 'note'
  const isTextTool = mode === 'text'
  const isWritableTool = isWritableStickerInteraction(mode, stickerKind) || mode === 'sticky'
  const toolPointerEnabled =
    enabled && (isTextTool || isWritableTool) && !(config?.selectEnabled && editingId != null)
  const textToolHoverKind: TextToolHoverKind | null = isTextTool
    ? 'text'
    : isWritableTool
      ? 'writable'
      : null
  const hoverPreviewEnabled = toolPointerEnabled

  const updateHoverTarget = useCallback(
    (clientX: number, clientY: number) => {
      if (!config || !hoverPreviewEnabled || !textToolHoverKind) {
        setHoverTargetId(null)
        return
      }
      const toNorm = config.toNorm
      const targetEl = overlayRef.current
      if (!toNorm || !targetEl) {
        setHoverTargetId(null)
        return
      }
      const p = toNorm(targetEl, clientX, clientY)
      if (!p) {
        setHoverTargetId(null)
        return
      }
      const dead = computeEraserLineDeadIndices(config.commands, null)
      const hitId = resolveTextToolHoverTargetId(
        config.commands,
        p[0],
        p[1],
        config.widthPx,
        config.heightPx,
        textToolHoverKind,
        dead,
      )
      /** Solid edit ring covers the active field — dashed hover is for other labels only. */
      const nextId = hitId != null && hitId === editingId ? null : hitId
      setHoverTargetId((prev) => (prev === nextId ? prev : nextId))
    },
    [config, editingId, hoverPreviewEnabled, textToolHoverKind],
  )

  const clearToolHover = useCallback(() => {
    setHoverTargetId(null)
  }, [])

  const selectedTextGrabId = useMemo(() => {
    if (!isTextTool || !config || editingId) return null
    const ids = config.selectedIds
    if (ids.length !== 1) return null
    const id = ids[0]!
    const cmd = config.commands.find((c) => c.id === id)
    return cmd?.kind === 'text' ? id : null
  }, [config, editingId, isTextTool])

  const textToolCursor = textToolPlacementCursor(
    hoverTargetId,
    isTextTool,
    isWritableTool,
    editingId,
    selectedTextGrabId,
    textToolDragLive != null,
  )

  const onToolPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = textToolDragRef.current
      if (drag && config) {
        const toNorm = config.toNorm
        const targetEl = overlayRef.current ?? e.currentTarget
        if (!toNorm) return
        const p = toNorm(targetEl, e.clientX, e.clientY)
        if (!p) return
        const dx = p[0] - drag.lastNorm[0]
        const dy = p[1] - drag.lastNorm[1]
        if (dx === 0 && dy === 0) return
        drag.lastNorm = p
        drag.totalDx += dx
        drag.totalDy += dy
        if (dx * dx + dy * dy > TAP_MOVE_EPS * TAP_MOVE_EPS || drag.moved) {
          drag.moved = true
        }
        setTextToolDragLive({ dx: drag.totalDx, dy: drag.totalDy })
        return
      }
      if (!hoverPreviewEnabled) return
      updateHoverTarget(e.clientX, e.clientY)
    },
    [config, hoverPreviewEnabled, updateHoverTarget],
  )

  const textToolHoverFrames = useMemo(
    () =>
      config && hoverTargetId
        ? textToolHoverOutlineFrames(config.commands, hoverTargetId, config.widthPx, config.heightPx)
        : [],
    [config, hoverTargetId],
  )

  const textToolEditingFrames = useMemo(
    () =>
      config && editingId
        ? textToolEditingOutlineFrames(
            config.commands,
            editingId,
            config.widthPx,
            config.heightPx,
            editingTextDraft,
          )
        : [],
    [config, editingId, editingTextDraft],
  )

  const patchCommand = useCallback(
    (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => {
      config?.onPatchCommand(id, partial)
    },
    [config],
  )

  const clearActiveEdit = useCallback(
    (options?: { suppressNextPlacement?: boolean }) => {
      const endedId = editingId
      if (options?.suppressNextPlacement !== false) {
        suppressNextPlacementRef.current = true
      }
      setSelectTextEditActive(false)
      endBookOverlayAnnotationEditingFocus(overlayRef.current)
      clearTypingEditState(setFocusNewId, setEditingId, setEditingTextDraft)
      selectAnnotationAfterEditEnd(config, endedId)
    },
    [config, editingId],
  )

  const deleteTextCommand = useCallback(
    (id: string) => {
      config?.onDeleteText(id)
      if (editingId === id) {
        clearActiveEdit()
      }
    },
    [clearActiveEdit, config, editingId],
  )

  const deleteStickyCommand = useCallback(
    (id: string) => {
      config?.onDeleteSticky(id)
      // Drop from selection even if edit already ended (click-away clears edit first).
      const selected = config?.selectedIds
      if (selected?.includes(id)) {
        config.onSelectedIdsChange?.(selected.filter((sid) => sid !== id))
      }
      if (editingId === id) {
        // Discarded empty (or explicit delete) — end edit without selecting Move.
        suppressNextPlacementRef.current = true
        setSelectTextEditActive(false)
        endBookOverlayAnnotationEditingFocus(overlayRef.current)
        clearTypingEditState(setFocusNewId, setEditingId, setEditingTextDraft)
      }
    },
    [config, editingId],
  )

  const beginEditForId = useCallback((id: string) => {
    suppressNextPlacementRef.current = false
    setHoverTargetId(null)
    setSelectTextEditActive(Boolean(config?.selectEnabled))
    setEditingId(id)
    setFocusNewId(id)
    setBookOverlayAnnotationEditSessionId(id)
    scheduleBookOverlayAnnotationFieldFocus(id)
  }, [config?.selectEnabled])

  const handleEditingIdChange = useCallback(
    (id: string | null) => {
      if (id === null) {
        const endedId = editingId
        setSelectTextEditActive(false)
        endBookOverlayAnnotationEditingFocus(overlayRef.current)
        setFocusNewId(null)
        setEditingTextDraft(null)
        setBookOverlayAnnotationEditSessionId(null)
        setEditingId(null)
        selectAnnotationAfterEditEnd(config, endedId)
        return
      }
      beginEditForId(id)
    },
    [beginEditForId, config, editingId],
  )

  const onEditingTextDraftChange = useCallback((text: string | null) => {
    setEditingTextDraft(text)
  }, [])

  const onToolPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!config || !toolPointerEnabled) return

      const toNorm = config.toNorm
      const targetEl = overlayRef.current ?? e.currentTarget
      if (!toNorm) return
      const p = toNorm(targetEl, e.clientX, e.clientY)
      if (!p) return

      const dead = computeEraserLineDeadIndices(config.commands, null)

      let textHitId: string | null = null
      if (config.mode === 'text') {
        const hitIdx = hitTestTextAnnotationIndex(
          [...config.commands],
          p[0],
          p[1],
          config.widthPx,
          config.heightPx,
          dead,
        )
        const hitCmd = hitIdx != null ? config.commands[hitIdx] : null
        textHitId = hitCmd?.kind === 'text' ? hitCmd.id : null
      }

      let stickyHitId: string | null = null
      if (isWritableTool) {
        const hitIdx = hitTestAnnotationIndex(
          [...config.commands],
          p[0],
          p[1],
          config.widthPx,
          config.heightPx,
          dead,
        )
        const hitCmd = hitIdx != null ? config.commands[hitIdx] : null
        stickyHitId = hitCmd?.kind === 'sticky' ? hitCmd.id : null
      }

      const typingHitId = textHitId ?? stickyHitId
      const activeEditId = editingId

      /** Dismiss on click-away — same tap selects the label; a second tap places a new one. */
      if (
        activeEditId != null &&
        typingHitId !== activeEditId &&
        !isPointerOnAnnotationTextarea(e.target, activeEditId) &&
        !isPointerOnAnnotationLabelShell(e.target, activeEditId)
      ) {
        clearActiveEdit({
          suppressNextPlacement: suppressNextPlacementAfterCanvasClickAwayDismiss(),
        })
      }

      setHoverTargetId(null)

      if (textHitId) {
        if (isAnnotationTextFieldFocused(textHitId)) {
          return
        }
        /** Selected label after submit: grab/drag; empty click still places; double-click edits. */
        if (
          config.mode === 'text' &&
          config.selectedIds.includes(textHitId) &&
          !config.selectEnabled
        ) {
          textToolDragRef.current = {
            ids: [...config.selectedIds],
            lastNorm: p,
            totalDx: 0,
            totalDy: 0,
            moved: false,
          }
          setTextToolDragLive({ dx: 0, dy: 0 })
          pendingTypingEditRef.current = null
          tapStartRef.current = null
          tapModeRef.current = null
          config.onToolUseOnSpread?.()
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
        pendingTypingEditRef.current = textHitId
        tapStartRef.current = p
        /** No capture — retargeting pointerup to the overlay blocks label click + focus. */
        return
      }

      if (stickyHitId) {
        if (isAnnotationTextFieldFocused(stickyHitId)) {
          return
        }
        pendingTypingEditRef.current = stickyHitId
        tapStartRef.current = p
        return
      }

      pendingTypingEditRef.current = null

      if (suppressNextPlacementRef.current) {
        suppressNextPlacementRef.current = false
        return
      }

      tapModeRef.current = config.mode === 'text' ? 'text' : isWritableTool ? 'sticky' : null
      tapStartRef.current = p
      if (tapModeRef.current) {
        config.onToolUseOnSpread?.()
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [beginEditForId, clearActiveEdit, config, editingId, isWritableTool, toolPointerEnabled],
  )

  const onToolPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!config || !toolPointerEnabled) return
      const hadCapture = e.currentTarget.hasPointerCapture(e.pointerId)
      if (hadCapture) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      const drag = textToolDragRef.current
      if (drag) {
        textToolDragRef.current = null
        setTextToolDragLive(null)
        if (drag.moved && (drag.totalDx !== 0 || drag.totalDy !== 0)) {
          config.onMoveSelectedBy?.(drag.totalDx, drag.totalDy)
        }
        return
      }

      const pendingEdit = pendingTypingEditRef.current
      if (pendingEdit != null) {
        pendingTypingEditRef.current = null
        const tap0 = tapStartRef.current
        tapStartRef.current = null
        tapModeRef.current = null
        const toNorm = config.toNorm
        const targetEl = overlayRef.current ?? e.currentTarget
        if (tap0 && toNorm && targetEl) {
          const p = toNorm(targetEl, e.clientX, e.clientY)
          if (p) {
            const dx = p[0] - tap0[0]
            const dy = p[1] - tap0[1]
            if (dx * dx + dy * dy > TAP_MOVE_EPS * TAP_MOVE_EPS) {
              return
            }
          }
        }
        if (!isAnnotationTextFieldFocused(pendingEdit)) {
          /** Type / writable tool: single click opens the field (Figma-style), not select-first. */
          config.onSelectedIdsChange?.([])
          queueMicrotask(() => beginEditForId(pendingEdit))
        }
        return
      }

      if (suppressNextPlacementRef.current) {
        suppressNextPlacementRef.current = false
        tapStartRef.current = null
        tapModeRef.current = null
        return
      }
      const tap0 = tapStartRef.current
      tapStartRef.current = null
      const tapMode = tapModeRef.current
      tapModeRef.current = null
      if (!tap0 || !tapMode) return

      const toNorm = config.toNorm
      const targetEl = overlayRef.current ?? e.currentTarget
      if (!toNorm) return
      const p = toNorm(targetEl, e.clientX, e.clientY)
      if (!p) return
      const dx = p[0] - tap0[0]
      const dy = p[1] - tap0[1]
      if (dx * dx + dy * dy > TAP_MOVE_EPS * TAP_MOVE_EPS) return

      const id = newAnnotationId()
      if (tapMode === 'text') {
        config.onSelectedIdsChange?.([])
        const align = textLabelAlignOrDefault(config.textAlign)
        const variant = config.textVisualStyle === 'filled' ? 'filled' : 'plain'
        const placement = textLabelPlacementFromClick({
          clickX: tap0[0],
          clickY: tap0[1],
          align,
          widthPx: config.widthPx,
          heightPx: config.heightPx,
          variant,
          fontSizeNorm: config.textFontSizeNorm,
        })
        const cmd: TextAnnotationCommand = {
          kind: 'text',
          id,
          x: placement.x,
          y: placement.y,
          yAnchor: placement.yAnchor,
          text: '',
          fontSizeNorm: config.textFontSizeNorm,
          fontId: config.textFontId,
          color: config.textColor,
          ...(config.textAlign !== 'left' ? { textAlign: config.textAlign } : {}),
          ...(config.textVisualStyle === 'filled'
            ? { visualStyle: 'filled' as const, fillColor: config.textFillColor }
            : {}),
        }
        config.onAppendCommand(cmd)
        queueMicrotask(() => beginEditForId(id))
      } else if (tapMode === 'sticky') {
        config.onSelectedIdsChange?.([])
        const size = defaultWritableStickerSize(writableStickerVariant)
        const w = size.wNorm
        const h = size.hNorm
        let sx = tap0[0] - w / 2
        let sy = tap0[1] - h / 2
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
          fontSizeNorm: config.stickyFontSizeNorm,
          fontId: config.textFontId,
          fillColor: defaultWritableStickerFill(writableStickerVariant, config.stickyFillColor),
          writableVariant: writableStickerVariant,
        }
        config.onAppendCommand(cmd)
        queueMicrotask(() => beginEditForId(id))
      }
    },
    [beginEditForId, config, toolPointerEnabled, writableStickerVariant],
  )

  const onToolPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    textToolDragRef.current = null
    setTextToolDragLive(null)
    pendingTypingEditRef.current = null
    tapStartRef.current = null
    tapModeRef.current = null
  }, [])

  const onSelectDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!config?.enabled || !config.selectEnabled) return
      e.preventDefault()
      e.stopPropagation()
      const toNorm = config.toNorm
      if (!toNorm) return
      const el = overlayRef.current ?? e.currentTarget
      const p = toNorm(el as HTMLDivElement, e.clientX, e.clientY)
      if (!p) return
      const dead = computeEraserLineDeadIndices([...config.commands], eraserLineTrailingForReplay(null, null))
      const idx = hitTestAnnotationIndex(
        [...config.commands],
        p[0],
        p[1],
        config.widthPx,
        config.heightPx,
        dead,
      )
      if (idx == null) return
      const cmd = config.commands[idx]!
      if (cmd.kind === 'text' || cmd.kind === 'sticky') {
        config.onSelectedIdsChange?.([cmd.id])
        beginEditForId(cmd.id)
      }
    },
    [beginEditForId, config],
  )

  const onTextToolDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!config?.enabled || config.mode !== 'text' || config.selectEnabled) return
      e.preventDefault()
      e.stopPropagation()
      const toNorm = config.toNorm
      if (!toNorm) return
      const el = overlayRef.current ?? e.currentTarget
      const p = toNorm(el as HTMLDivElement, e.clientX, e.clientY)
      if (!p) return
      const dead = computeEraserLineDeadIndices([...config.commands], eraserLineTrailingForReplay(null, null))
      const hitIdx = hitTestTextAnnotationIndex(
        [...config.commands],
        p[0],
        p[1],
        config.widthPx,
        config.heightPx,
        dead,
      )
      if (hitIdx == null) return
      const cmd = config.commands[hitIdx]
      if (cmd?.kind !== 'text') return
      config.onSelectedIdsChange?.([cmd.id])
      beginEditForId(cmd.id)
    },
    [beginEditForId, config],
  )

  const onStickyToolDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!config?.enabled || config.selectEnabled || !isWritableTool) return
      e.preventDefault()
      e.stopPropagation()
      const toNorm = config.toNorm
      if (!toNorm) return
      const el = overlayRef.current ?? e.currentTarget
      const p = toNorm(el as HTMLDivElement, e.clientX, e.clientY)
      if (!p) return
      const dead = computeEraserLineDeadIndices([...config.commands], eraserLineTrailingForReplay(null, null))
      const idx = hitTestAnnotationIndex(
        [...config.commands],
        p[0],
        p[1],
        config.widthPx,
        config.heightPx,
        dead,
      )
      if (idx == null) return
      const cmd = config.commands[idx]
      if (cmd?.kind !== 'sticky') return
      config.onSelectedIdsChange?.([cmd.id])
      beginEditForId(cmd.id)
    },
    [beginEditForId, config, isWritableTool],
  )

  useEffect(() => {
    return () => setBookOverlayAnnotationEditSessionId(null)
  }, [])

  useEffect(() => {
    if (!hoverPreviewEnabled) {
      setHoverTargetId(null)
    }
  }, [hoverPreviewEnabled])

  const prevSelectEnabledRef = useRef(config?.selectEnabled ?? false)
  useEffect(() => {
    const switchedToSelect = config?.selectEnabled && !prevSelectEnabledRef.current
    if (switchedToSelect && editingId != null) {
      clearActiveEdit()
    }
    prevSelectEnabledRef.current = config?.selectEnabled ?? false
  }, [clearActiveEdit, config?.selectEnabled, editingId])

  const prevDomToolActiveRef = useRef(false)
  useEffect(() => {
    const domToolActive = isTextTool || isWritableTool
    const enteringDomTool = domToolActive && !prevDomToolActiveRef.current
    prevDomToolActiveRef.current = domToolActive
    if (shouldResetSuppressNextPlacementOnDomToolEntry(enteringDomTool)) {
      suppressNextPlacementRef.current = false
    }
    if (enteringDomTool && editingId != null && !config?.selectEnabled) {
      clearActiveEdit({ suppressNextPlacement: false })
    }
  }, [clearActiveEdit, config?.selectEnabled, editingId, isTextTool, isWritableTool])

  useEffect(() => {
    if (!editingId) return

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
      /** Canvas overlay handles dismiss + placement in one tap for text / writable tools. */
      if (
        toolPointerEnabled &&
        overlayRef.current &&
        overlayRef.current.contains(target)
      ) {
        return
      }
      clearActiveEdit({
        suppressNextPlacement: suppressNextPlacementAfterOutsideDismiss(),
      })
    }

    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  }, [clearActiveEdit, editingId, toolPointerEnabled])

  const textInputEnabled =
    (((isTextTool || isWritableTool) && editingId != null) || selectTextEditActive)

  return {
    editingId,
    setEditingId: handleEditingIdChange,
    clearActiveEdit,
    textInputEnabled,
    focusNewId,
    setFocusNewId,
    hoverTargetId,
    textToolHoverFrames,
    textToolEditingFrames,
    textToolCursor,
    textToolDragLive,
    patchCommand,
    deleteTextCommand,
    deleteStickyCommand,
    toolPointerEnabled,
    overlayRef,
    onToolPointerDown,
    onToolPointerMove,
    onToolPointerUp,
    onToolPointerCancel,
    clearToolHover,
    onEditingTextDraftChange,
    onSelectDoubleClick,
    onTextToolDoubleClick,
    onStickyToolDoubleClick,
  }
}
