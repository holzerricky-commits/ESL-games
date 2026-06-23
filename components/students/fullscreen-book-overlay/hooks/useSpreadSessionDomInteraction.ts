'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type {  AnnotationCommand,
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import type { TextAnnotationVisualStyle } from '@/lib/books/annotation-command-types'
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

export type SpreadSessionDomConfig = {
  enabled: boolean
  mode: BookAnnotationInteractionMode
  stickerKind?: StickerKind
  writableStickerVariant?: WritableStickerVariant
  textColor: string
  textFontSizeNorm: number
  textFontId: AnnotationTextFontId
  textVisualStyle: TextAnnotationVisualStyle
  textFillColor: string
  stickyFillColor: string
  stickyFontSizeNorm: number
  defaultStickyWNorm: number
  defaultStickyHNorm: number
  commands: readonly AnnotationCommand[]
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
  /** Filled in by BookSpreadSessionLayer (spread-normalized pointer mapping). */
  toNorm?: ToNormFromElement
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
  const hoverPreviewEnabled = toolPointerEnabled && editingId == null

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
      const nextId = resolveTextToolHoverTargetId(
        config.commands,
        p[0],
        p[1],
        config.widthPx,
        config.heightPx,
        textToolHoverKind,
        dead,
      )
      setHoverTargetId((prev) => (prev === nextId ? prev : nextId))
    },
    [config, hoverPreviewEnabled, textToolHoverKind],
  )

  const clearToolHover = useCallback(() => {
    setHoverTargetId(null)
  }, [])

  const onToolPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!hoverPreviewEnabled) return
      updateHoverTarget(e.clientX, e.clientY)
    },
    [hoverPreviewEnabled, updateHoverTarget],
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

  const textToolCursor = textToolPlacementCursor(
    hoverTargetId,
    isTextTool,
    isWritableTool,
    editingId,
  )

  const patchCommand = useCallback(
    (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => {
      config?.onPatchCommand(id, partial)
    },
    [config],
  )

  const clearActiveEdit = useCallback(() => {
    suppressNextPlacementRef.current = true
    setSelectTextEditActive(false)
    endBookOverlayAnnotationEditingFocus(overlayRef.current)
    clearTypingEditState(setFocusNewId, setEditingId, setEditingTextDraft)
  }, [])

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
      if (editingId === id) {
        clearActiveEdit()
      }
    },
    [clearActiveEdit, config, editingId],
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
        setSelectTextEditActive(false)
        endBookOverlayAnnotationEditingFocus(overlayRef.current)
        setFocusNewId(null)
        setEditingTextDraft(null)
        setBookOverlayAnnotationEditSessionId(null)
        setEditingId(null)
        return
      }
      beginEditForId(id)
    },
    [beginEditForId],
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

      /** Dismiss only on genuine click-away — not when coords still hit the active label. */
      if (
        activeEditId != null &&
        typingHitId !== activeEditId &&
        !isPointerOnAnnotationTextarea(e.target, activeEditId) &&
        !isPointerOnAnnotationLabelShell(e.target, activeEditId)
      ) {
        clearActiveEdit()
      }

      if (
        editingId != null &&
        editingId !== textHitId &&
        editingId !== stickyHitId
      ) {
        clearActiveEdit()
      }

      setHoverTargetId(null)

      if (textHitId) {
        if (isAnnotationTextFieldFocused(textHitId)) {
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
          /** suppressNextPlacement only blocks new empty placement — not reopening existing labels. */
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
        const cmd: TextAnnotationCommand = {
          kind: 'text',
          id,
          x: tap0[0],
          y: tap0[1],
          yAnchor: 'top',
          text: '',
          fontSizeNorm: config.textFontSizeNorm,
          fontId: config.textFontId,
          color: config.textColor,
          ...(config.textVisualStyle === 'filled'
            ? { visualStyle: 'filled' as const, fillColor: config.textFillColor }
            : {}),
        }
        config.onAppendCommand(cmd)
        queueMicrotask(() => beginEditForId(id))
      } else if (tapMode === 'sticky') {
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
      clearActiveEdit()
    }

    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  }, [clearActiveEdit, editingId])

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
  }
}
