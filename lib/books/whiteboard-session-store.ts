import { createInkSessionStore, type InkSessionStore } from '@/lib/books/ink-session-store'
import type { SelectionMoveClampContext } from '@/lib/books/annotation-scale'
import { INK_SESSION_AUTOSAVE_MS } from '@/lib/books/ink-session-persist-config'
import {
  appendLessonBoardPage,
  deleteLessonBoardPage,
  extendLessonBoardActivePageContentHeight,
  goToAdjacentLessonBoardPage,
  setLessonBoardActivePageContentHeight,
  setLessonBoardActivePageId,
  setLessonBoardPageBookPageHint,
  setLessonBoardPageTitle,
} from '@/lib/books/lesson-board-session-ops'
import {
  prepareLessonBoardSessionForPersist,
  syncLessonBoardCommandsToActivePage,
} from '@/lib/books/lesson-board-types'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  loadWhiteboardSessionBestMatch,
  saveWhiteboardSessionCheckpoint,
  type WhiteboardSessionStorageAdapter,
} from '@/lib/books/whiteboard-session-storage'
import type { LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import type { WhiteboardSessionDocument, WhiteboardSessionKey } from '@/lib/books/whiteboard-session-types'

export type WhiteboardSessionStore = InkSessionStore<WhiteboardSessionDocument> & {
  appendLessonBoardPage: (options?: {
    orientation?: LessonBoardPageOrientation
    bookPageHint?: number
    viewportHeightPx?: number
    slotWidthPx?: number
    spreadWidthPx?: number
  }) => void
  setActiveLessonBoardPage: (pageId: string) => boolean
  goToAdjacentLessonBoardPage: (delta: -1 | 1) => boolean
  setActiveLessonBoardContentHeightPx: (contentHeightPx: number) => void
  extendActiveLessonBoardRunway: (viewportHeightPx: number) => void
  setLessonBoardPageTitle: (pageId: string, title: string | undefined) => boolean
  setLessonBoardPageBookPageHint: (pageId: string, bookPageHint: number) => boolean
  deleteLessonBoardPage: (pageId: string) => boolean
}

export type CreateWhiteboardSessionStoreOptions = {
  storage?: WhiteboardSessionStorageAdapter
  /** Try each key on load (class session + local fallback). */
  storageKeyCandidates?: readonly string[]
  autosaveMs?: number
  now?: () => number
  getSelectionMoveClamp?: () => SelectionMoveClampContext | null
}

function withLessonBoardPageApi(
  store: InkSessionStore<WhiteboardSessionDocument>,
): WhiteboardSessionStore {
  const applyDoc = (next: WhiteboardSessionDocument) => {
    store.replaceDoc(prepareLessonBoardSessionForPersist(next))
  }

  const syncRootCommandsToPages = (commands: readonly AnnotationCommand[]) => {
    const doc = store.getState().doc
    applyDoc(syncLessonBoardCommandsToActivePage({ ...doc, commands: [...commands] }))
  }

  return {
    ...store,
    appendCommand: (cmd) => {
      store.appendCommand(cmd)
      applyDoc(store.getState().doc)
    },
    setCommands: (commands) => {
      store.setCommands(commands)
      applyDoc(store.getState().doc)
    },
    patchCommands: (updater) => {
      store.patchCommands(updater)
      applyDoc(store.getState().doc)
    },
    syncCommands: (commands) => {
      syncRootCommandsToPages(commands)
    },
    appendLessonBoardPage: (opts) => {
      const doc = store.getState().doc
      applyDoc(
        appendLessonBoardPage(doc, opts?.orientation ?? 'standard', {
          viewportHeightPx: opts?.viewportHeightPx,
          slotWidthPx: opts?.slotWidthPx,
          spreadWidthPx: opts?.spreadWidthPx,
          bookPageHint: opts?.bookPageHint,
        }),
      )
    },
    setActiveLessonBoardPage: (pageId) => {
      const next = setLessonBoardActivePageId(store.getState().doc, pageId)
      if (!next) return false
      applyDoc(next)
      return true
    },
    goToAdjacentLessonBoardPage: (delta) => {
      const next = goToAdjacentLessonBoardPage(store.getState().doc, delta)
      if (!next) return false
      applyDoc(next)
      return true
    },
    setActiveLessonBoardContentHeightPx: (contentHeightPx) => {
      applyDoc(setLessonBoardActivePageContentHeight(store.getState().doc, contentHeightPx))
    },
    extendActiveLessonBoardRunway: (viewportHeightPx) => {
      applyDoc(extendLessonBoardActivePageContentHeight(store.getState().doc, viewportHeightPx))
    },
    setLessonBoardPageTitle: (pageId, title) => {
      const next = setLessonBoardPageTitle(store.getState().doc, pageId, title)
      if (!next) return false
      applyDoc(next)
      return true
    },
    setLessonBoardPageBookPageHint: (pageId, bookPageHint) => {
      const next = setLessonBoardPageBookPageHint(store.getState().doc, pageId, bookPageHint)
      if (!next) return false
      applyDoc(next)
      return true
    },
    deleteLessonBoardPage: (pageId) => {
      const next = deleteLessonBoardPage(store.getState().doc, pageId)
      if (!next) return false
      applyDoc(next)
      return true
    },
  }
}

export function createWhiteboardSessionStore(
  key: WhiteboardSessionKey,
  options: CreateWhiteboardSessionStoreOptions = {},
): WhiteboardSessionStore {
  const storage = options.storage
  const candidates = options.storageKeyCandidates ?? [key.storagePageKey]
  const store = createInkSessionStore<WhiteboardSessionDocument>({
    loadInitialDoc: () => loadWhiteboardSessionBestMatch(key, candidates, storage),
    saveCheckpoint: (doc) =>
      saveWhiteboardSessionCheckpoint(prepareLessonBoardSessionForPersist(doc), storage),
    autosaveMs: options.autosaveMs ?? INK_SESSION_AUTOSAVE_MS,
    persistEnabled: true,
    now: options.now,
    getSelectionMoveClamp: options.getSelectionMoveClamp,
  })
  return withLessonBoardPageApi(store)
}
