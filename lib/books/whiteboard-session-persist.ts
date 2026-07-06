import {
  getAnnotationsForStorageKey,
  setAnnotationsForStorageKey,
} from '@/lib/books/annotation-storage'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  hydrateWhiteboardSessionFromLegacyStorage,
  legacyStorageCommandsWithoutDelegatedInk,
} from '@/lib/books/whiteboard-session-hydrate'
import { isWhiteboardDelegatedCanvasCommand } from '@/lib/books/ink-session-page-layer'
import {
  saveWhiteboardSessionCheckpoint,
  type WhiteboardSessionStorageAdapter,
} from '@/lib/books/whiteboard-session-storage'
import {
  syncLessonBoardActivePageToCommands,
  syncLessonBoardCommandsToActivePage,
} from '@/lib/books/lesson-board-types'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'

export type FlushWhiteboardSessionToLegacyParams = {
  doc: WhiteboardSessionDocument
  studentId: string
  bookId: string
  unitId: string
  storagePageKey: string
}

/** Tier B: persist whiteboard session doc to `bookWhiteboardInkSessionV1`. */
export function checkpointWhiteboardSessionDocument(
  doc: WhiteboardSessionDocument,
  storage?: WhiteboardSessionStorageAdapter,
): void {
  saveWhiteboardSessionCheckpoint(doc, storage)
}

/**
 * Tier C: merge session pen ink into legacy whiteboard storage (text/sticky/marker stay on page layer).
 */
export function flushWhiteboardSessionDocumentToLegacyStorage({
  doc,
  studentId,
  bookId,
  unitId,
  storagePageKey,
}: FlushWhiteboardSessionToLegacyParams): void {
  const key = storagePageKey.trim()
  if (!key) return
  const existing = getAnnotationsForStorageKey(studentId, bookId, unitId, key)
  const withoutDelegatedInk = legacyStorageCommandsWithoutDelegatedInk(existing)
  const merged = mergeWhiteboardLegacyWithSession(withoutDelegatedInk, doc.commands)
  setAnnotationsForStorageKey(studentId, bookId, unitId, key, merged)
}

export function mergeWhiteboardLegacyWithSession(
  pageLayerCommands: readonly AnnotationCommand[],
  sessionCommands: readonly AnnotationCommand[],
): AnnotationCommand[] {
  const pageLayerOnly = pageLayerCommands.filter((c) => !isWhiteboardDelegatedCanvasCommand(c))
  if (sessionCommands.length === 0) return pageLayerOnly
  return [...pageLayerOnly, ...sessionCommands]
}

export function resolveWhiteboardSessionCommandsOnMount(
  sessionCommands: readonly AnnotationCommand[],
  legacyCommands: readonly AnnotationCommand[],
): AnnotationCommand[] {
  const fromLegacy = hydrateWhiteboardSessionFromLegacyStorage(legacyCommands)
  if (sessionCommands.length === 0) return fromLegacy
  if (fromLegacy.length === 0) return [...sessionCommands]
  const byId = new Map<string, AnnotationCommand>()
  for (const cmd of fromLegacy) byId.set(cmd.id, cmd)
  for (const cmd of sessionCommands) byId.set(cmd.id, cmd)
  return [...byId.values()]
}

/** Merge legacy page-layer ink into the active lesson-board page (root + `pages[]`). */
export function mergeLegacyInkIntoLessonBoardSession(
  doc: WhiteboardSessionDocument,
  legacyCommands: readonly AnnotationCommand[],
): WhiteboardSessionDocument {
  const synced = syncLessonBoardActivePageToCommands(doc)
  const mergedCommands = resolveWhiteboardSessionCommandsOnMount(synced.commands, legacyCommands)
  return syncLessonBoardCommandsToActivePage({ ...synced, commands: mergedCommands })
}

export function lessonBoardSessionInkChanged(
  before: WhiteboardSessionDocument,
  after: WhiteboardSessionDocument,
): boolean {
  if (before.pages.length !== after.pages.length) return true
  if (before.activePageId !== after.activePageId) return true
  if (before.commands.length !== after.commands.length) return true
  for (let i = 0; i < before.pages.length; i++) {
    if ((before.pages[i]?.commands.length ?? 0) !== (after.pages[i]?.commands.length ?? 0)) {
      return true
    }
  }
  return false
}
