import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { inkSessionPageLayerDemotionEnabled } from '@/lib/books/feature-flags'
import {
  pageLayerCommandsExcludingSpreadSessionIds,
  pageLayerCommandsWhenSpreadDelegated,
} from '@/lib/books/ink-session-page-layer'
import { legacyStorageCommandsWithoutDelegatedInk } from '@/lib/books/whiteboard-session-hydrate'

export type PageLayerPersistContext = {
  spreadInkDelegated?: boolean
  spreadSessionOwnsPagePaint?: boolean
  spreadSessionPaintCommandIds?: readonly string[]
  whiteboardInkDelegated?: boolean
  whiteboardPenInkDelegated?: boolean
}

/**
 * R6 — page layer demotes session-owned rows for in-memory paint only.
 * Spread/board session stores own commits; storage updates on session flush/teardown only.
 * Callers must not write demoted output as a full storage replace (wipes text/ink).
 */
export function pageLayerCommandsForPersist(
  commands: readonly AnnotationCommand[],
  ctx: PageLayerPersistContext,
): AnnotationCommand[] {
  if (!inkSessionPageLayerDemotionEnabled) return [...commands]

  if (ctx.spreadInkDelegated) {
    return pageLayerCommandsWhenSpreadDelegated(commands, true)
  }

  if (
    ctx.spreadSessionOwnsPagePaint &&
    ctx.spreadSessionPaintCommandIds &&
    ctx.spreadSessionPaintCommandIds.length > 0
  ) {
    return pageLayerCommandsExcludingSpreadSessionIds(commands, ctx.spreadSessionPaintCommandIds)
  }

  if (ctx.whiteboardInkDelegated || ctx.whiteboardPenInkDelegated) {
    return legacyStorageCommandsWithoutDelegatedInk(commands)
  }

  return [...commands]
}

/** Same rules as persist for in-memory paint — callers must not write demoted rows back to storage. */
export function pageLayerCommandsForLoad(
  commands: readonly AnnotationCommand[],
  ctx: PageLayerPersistContext,
): AnnotationCommand[] {
  return pageLayerCommandsForPersist(commands, ctx)
}
