import type { CSSProperties } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { textLabelChromeBounds } from '@/lib/books/text-label-chrome-bounds'
import {
  getAnnotationBounds,
  hitTestStickyAnnotationIndex,
  hitTestTextAnnotationIndex,
  orientedSelectionFrameForCommand,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'

export type TextToolHoverKind = 'text' | 'writable'

/** Same hit rules as click-to-edit for the active text/sticky tool. */
export function resolveTextToolHoverTargetId(
  commands: readonly AnnotationCommand[],
  nx: number,
  ny: number,
  widthPx: number,
  heightPx: number,
  tool: TextToolHoverKind,
  skipIndices?: ReadonlySet<number>,
): string | null {
  const list = [...commands]
  if (tool === 'text') {
    const hitIdx = hitTestTextAnnotationIndex(list, nx, ny, widthPx, heightPx, skipIndices)
    const cmd = hitIdx != null ? commands[hitIdx] : null
    return cmd?.kind === 'text' ? cmd.id : null
  }
  const hitIdx = hitTestStickyAnnotationIndex(list, nx, ny, widthPx, heightPx, skipIndices)
  const cmd = hitIdx != null ? commands[hitIdx] : null
  return cmd?.kind === 'sticky' ? cmd.id : null
}

export type TextToolOutlineMode = 'hover' | 'edit'

function textToolOutlineFrameForCommand(
  cmd: AnnotationCommand,
  widthPx: number,
  heightPx: number,
  mode: TextToolOutlineMode,
  liveText?: string | null,
): OrientedSelectionFrame | null {
  if (cmd.kind === 'text') {
    const rect = textLabelChromeBounds(cmd, widthPx, heightPx, {
      mode,
      liveText: mode === 'edit' ? liveText : undefined,
    })
    return rect ? { rect, rotationDeg: 0 } : null
  }
  if (cmd.kind === 'sticky') {
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    return bounds && bounds.w > 0 && bounds.h > 0 ? { rect: bounds, rotationDeg: 0 } : null
  }
  return orientedSelectionFrameForCommand(cmd, widthPx, heightPx)
}

/** Dashed hover chrome — tight on text labels, full sticker box on stickies. */
export function textToolHoverOutlineFrames(
  commands: readonly AnnotationCommand[],
  hoverTargetId: string | null,
  widthPx: number,
  heightPx: number,
): OrientedSelectionFrame[] {
  if (!hoverTargetId) return []
  const cmd = commands.find((c) => c.id === hoverTargetId)
  if (!cmd) return []
  const frame = textToolOutlineFrameForCommand(cmd, widthPx, heightPx, 'hover')
  return frame ? [frame] : []
}

/**
 * No solid edit ring while typing — WYSIWYG caret + ink only (Figma / Excalidraw pattern).
 * Hover dashed chrome remains via {@link textToolHoverOutlineFrames}.
 */
export function textToolEditingOutlineFrames(
  _commands: readonly AnnotationCommand[],
  _editingId: string | null,
  _widthPx: number,
  _heightPx: number,
  _editingTextDraft?: string | null,
): OrientedSelectionFrame[] {
  return []
}

export function textToolPlacementCursor(
  hoverTargetId: string | null,
  isTextTool: boolean,
  isWritableTool: boolean,
  editingId?: string | null,
  /** When hovering a selected label that can be grabbed while the Type tool stays active. */
  grabHoverTargetId?: string | null,
  /** Dragging that label. */
  grabbing?: boolean,
): CSSProperties['cursor'] | undefined {
  if (!isTextTool && !isWritableTool) return undefined
  if (isTextTool) {
    if (editingId) return 'text'
    if (grabbing) return 'grabbing'
    if (hoverTargetId && grabHoverTargetId != null && hoverTargetId === grabHoverTargetId) {
      return 'grab'
    }
    return 'text'
  }
  if (editingId) return 'text'
  /** Writable tool: crosshair to place; I-beam over an existing note. */
  return hoverTargetId ? 'text' : 'crosshair'
}

/** @internal test helper */
export function normPointHitsTextToolTarget(
  commands: readonly AnnotationCommand[],
  nx: number,
  ny: number,
  widthPx: number,
  heightPx: number,
  tool: TextToolHoverKind,
): boolean {
  return resolveTextToolHoverTargetId(commands, nx, ny, widthPx, heightPx, tool) != null
}
