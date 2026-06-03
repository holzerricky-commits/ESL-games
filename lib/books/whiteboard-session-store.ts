import { createInkSessionStore, type InkSessionStore } from '@/lib/books/ink-session-store'
import { INK_SESSION_AUTOSAVE_MS } from '@/lib/books/ink-session-persist-config'
import {
  loadWhiteboardSession,
  saveWhiteboardSessionCheckpoint,
  type WhiteboardSessionStorageAdapter,
} from '@/lib/books/whiteboard-session-storage'
import type { WhiteboardSessionDocument, WhiteboardSessionKey } from '@/lib/books/whiteboard-session-types'

export type WhiteboardSessionStore = InkSessionStore<WhiteboardSessionDocument>

export type CreateWhiteboardSessionStoreOptions = {
  storage?: WhiteboardSessionStorageAdapter
  autosaveMs?: number
  now?: () => number
}

export function createWhiteboardSessionStore(
  key: WhiteboardSessionKey,
  options: CreateWhiteboardSessionStoreOptions = {},
): WhiteboardSessionStore {
  const storage = options.storage
  return createInkSessionStore<WhiteboardSessionDocument>({
    loadInitialDoc: () => loadWhiteboardSession(key, storage),
    saveCheckpoint: (doc) => saveWhiteboardSessionCheckpoint(doc, storage),
    autosaveMs: options.autosaveMs ?? INK_SESSION_AUTOSAVE_MS,
    persistEnabled: true,
    now: options.now,
  })
}
