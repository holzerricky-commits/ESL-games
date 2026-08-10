import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  compactLegacyEraserLineScene,
  computeEraserLineDeadIndices,
  sceneHasStoredEraserLineCommands as geometryHasStoredEraserLineCommands,
} from '@/lib/books/annotation-geometry'
import { selectAllCommandIds } from '@/lib/books/annotation-select'
import { canIncrementallyAppendSpreadSessionCommands } from '@/lib/books/spread-session-incremental-paint'

/** Feature flag — see `docs/INK_ENGINE_V2.md`. All v2 runtime paths gate on this. */
export { inkEngineV2Enabled } from '@/lib/books/feature-flags'

/**
 * Visible scene: authoritative command list for v2 (no hide-in-place eraser model).
 * Undo history is separate and not part of this type.
 */
export type InkEngineV2Scene = {
  readonly commands: readonly AnnotationCommand[]
}

/** Operation undo entries (R1+). History stack only — not the live scene. */
export type InkEngineV2HistoryAppend = { readonly type: 'append'; readonly commands: readonly AnnotationCommand[] }
export type InkEngineV2HistoryDelete = { readonly type: 'delete'; readonly commands: readonly AnnotationCommand[] }
export type InkEngineV2HistoryPatch = {
  readonly type: 'patch'
  readonly ids: readonly string[]
  readonly before: readonly AnnotationCommand[]
  readonly after: readonly AnnotationCommand[]
}
export type InkEngineV2HistoryBatch = {
  readonly type: 'batch'
  readonly entries: readonly InkEngineV2HistoryEntry[]
}
export type InkEngineV2HistoryEntry =
  | InkEngineV2HistoryAppend
  | InkEngineV2HistoryDelete
  | InkEngineV2HistoryPatch
  | InkEngineV2HistoryBatch

export type InkEngineV2SceneInvariantViolation = {
  readonly code:
    | 'stored_eraser_line_command'
    | 'select_all_not_subset_of_visible'
    | 'select_all_mismatch'
    | 'hidden_commands_in_scene'
  readonly message: string
}

export type InkEngineV2PaintContext = {
  /** Transient stamp/paste overlay — must not force committed full replay in v2. */
  readonly overlayAnimationActive?: boolean
  readonly canvasResized?: boolean
  readonly selectionTransformActive?: boolean
}

/** v2 scene must not persist eraser-line strokes as permanent geometry metadata. */
export function sceneHasStoredEraserLineCommands(commands: readonly AnnotationCommand[]): boolean {
  return geometryHasStoredEraserLineCommands(commands)
}

export { compactLegacyEraserLineScene } from '@/lib/books/annotation-geometry'

/** Every selected id must exist in the visible scene command list. */
export function selectAllIdsSubsetOfVisibleScene(
  scene: InkEngineV2Scene,
  selectedIds: readonly string[],
): boolean {
  if (selectedIds.length === 0) return true
  const visible = new Set(scene.commands.map((c) => c.id))
  return selectedIds.every((id) => visible.has(id))
}

/** Select-all in v2 equals all visible command ids (respecting lock filter). */
export function expectedSelectAllIds(
  scene: InkEngineV2Scene,
  includeLocked: boolean,
): string[] {
  return selectAllCommandIds([...scene.commands], includeLocked)
}

export function selectAllMatchesVisibleScene(
  scene: InkEngineV2Scene,
  selectedIds: readonly string[],
  includeLocked: boolean,
): boolean {
  const expected = expectedSelectAllIds(scene, includeLocked)
  if (expected.length !== selectedIds.length) return false
  const picked = new Set(selectedIds)
  return expected.every((id) => picked.has(id))
}

/**
 * Legacy model: commands hidden by eraser-line but still present in the array.
 * v2 scenes must have zero hidden commands.
 */
export function hiddenCommandIndicesLegacy(commands: readonly AnnotationCommand[]): ReadonlySet<number> {
  return computeEraserLineDeadIndices([...commands])
}

export function sceneHasHiddenCommandsLegacy(commands: readonly AnnotationCommand[]): boolean {
  return hiddenCommandIndicesLegacy(commands).size > 0
}

/**
 * Whether committed ink paint may append only the new command (v2 rules).
 * Unlike legacy `useInkSessionCanvasPaint`, eraser dead indices are NOT a gate.
 */
export function v2IncrementalCommittedPaintAllowed(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
  ctx: InkEngineV2PaintContext = {},
): boolean {
  if (ctx.overlayAnimationActive) return false
  if (ctx.canvasResized) return false
  if (ctx.selectionTransformActive) return false
  return canIncrementallyAppendSpreadSessionCommands(prev, next)
}

export function collectInkEngineV2SceneInvariantViolations(scene: InkEngineV2Scene): InkEngineV2SceneInvariantViolation[] {
  const out: InkEngineV2SceneInvariantViolation[] = []

  if (sceneHasStoredEraserLineCommands(scene.commands)) {
    out.push({
      code: 'stored_eraser_line_command',
      message: 'v2 scene must not store eraser-line strokes as permanent commands',
    })
  }

  if (sceneHasHiddenCommandsLegacy(scene.commands)) {
    out.push({
      code: 'hidden_commands_in_scene',
      message: 'v2 scene must not contain commands hidden by legacy eraser-line dead indices',
    })
  }

  return out
}

export function assertInkEngineV2SceneInvariants(scene: InkEngineV2Scene): void {
  const violations = collectInkEngineV2SceneInvariantViolations(scene)
  if (violations.length === 0) return
  const detail = violations.map((v) => `${v.code}: ${v.message}`).join('; ')
  throw new Error(`InkEngineV2 scene invariant violation: ${detail}`)
}

/** Spread-session-style selectAll (legacy): all commands, ignores eraser-line dead indices. */
export function legacySpreadSessionSelectAllIds(commands: readonly AnnotationCommand[]): string[] {
  return selectAllCommandIds([...commands], false)
}
