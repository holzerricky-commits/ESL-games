import { INK_SESSION_AUTOSAVE_MS } from '@/lib/books/ink-session-persist-config'
import {
  createInkSessionStore,
  type CreateInkSessionStoreOptions,
  type InkSessionStore,
} from '@/lib/books/ink-session-store'
import type { SelectionMoveClampContext } from '@/lib/books/annotation-scale'
import type { SpreadSessionCommand, SpreadSessionDocument, SpreadSessionKey } from '@/lib/books/spread-session-types'
import { loadSpreadSession, saveSpreadSessionCheckpoint, type SpreadSessionStorageAdapter } from '@/lib/books/spread-session-storage'

export type SpreadSessionStore = InkSessionStore<SpreadSessionDocument>

export type CreateSpreadSessionStoreOptions = {
  storage?: SpreadSessionStorageAdapter
  autosaveMs?: number
  now?: () => number
  getSelectionMoveClamp?: () => SelectionMoveClampContext | null
}

export function createSpreadSessionStore(
  key: SpreadSessionKey,
  options: CreateSpreadSessionStoreOptions = {},
): SpreadSessionStore {
  const storage = options.storage
  const inkOptions: CreateInkSessionStoreOptions<SpreadSessionDocument> = {
    loadInitialDoc: () => loadSpreadSession(key, storage),
    saveCheckpoint: (doc) => saveSpreadSessionCheckpoint(doc, storage),
    autosaveMs: options.autosaveMs ?? INK_SESSION_AUTOSAVE_MS,
    persistEnabled: true,
    now: options.now,
    getSelectionMoveClamp: options.getSelectionMoveClamp,
  }
  return createInkSessionStore(inkOptions)
}

export type { SpreadSessionCommand }
