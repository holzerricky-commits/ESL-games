import {
  normalizeLessonBoardSessionDocument,
  prepareLessonBoardSessionForPersist,
} from '@/lib/books/lesson-board-types'
import {
  createEmptyWhiteboardSession,
  whiteboardSessionDocId,
  type WhiteboardSessionDocument,
  type WhiteboardSessionKey,
} from '@/lib/books/whiteboard-session-types'

const WHITEBOARD_INK_SESSION_STORAGE_KEY = 'bookWhiteboardInkSessionV1'

type WhiteboardSessionRoot = Record<string, WhiteboardSessionDocument>

export type WhiteboardSessionStorageAdapter = {
  readRoot: () => WhiteboardSessionRoot
  writeRoot: (root: WhiteboardSessionRoot) => void
}

function browserStorageAdapter(): WhiteboardSessionStorageAdapter {
  return {
    readRoot: () => {
      if (typeof window === 'undefined') return {}
      try {
        const raw = localStorage.getItem(WHITEBOARD_INK_SESSION_STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') return {}
        return parsed as WhiteboardSessionRoot
      } catch {
        return {}
      }
    },
    writeRoot: (root: WhiteboardSessionRoot) => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(WHITEBOARD_INK_SESSION_STORAGE_KEY, JSON.stringify(root))
      } catch {
        /* ignore quota/private mode */
      }
    },
  }
}

export function createMemoryWhiteboardSessionStorage(
  initial: WhiteboardSessionRoot = {},
): WhiteboardSessionStorageAdapter {
  let root: WhiteboardSessionRoot = { ...initial }
  return {
    readRoot: () => ({ ...root }),
    writeRoot: (next) => {
      root = { ...next }
    },
  }
}

function normalizeLoadedWhiteboardSession(
  raw: WhiteboardSessionDocument | undefined,
  key: WhiteboardSessionKey,
): WhiteboardSessionDocument {
  if (!raw) return createEmptyWhiteboardSession(key)
  const withKey: WhiteboardSessionDocument = { ...raw, key: raw.key ?? key, docId: raw.docId ?? whiteboardSessionDocId(key) }
  return normalizeLessonBoardSessionDocument(withKey) as WhiteboardSessionDocument
}

export function loadWhiteboardSession(
  key: WhiteboardSessionKey,
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter(),
): WhiteboardSessionDocument {
  const root = adapter.readRoot()
  const raw = root[whiteboardSessionDocId(key)] as WhiteboardSessionDocument | undefined
  return normalizeLoadedWhiteboardSession(raw, key)
}

export function scoreWhiteboardSessionRichness(doc: WhiteboardSessionDocument): number {
  const pages = doc.pages ?? []
  const pageInk = pages.reduce((n, p) => n + p.commands.length, 0)
  return pages.length * 10_000 + pageInk * 10 + doc.commands.length
}

function whiteboardSessionHasUserContent(doc: WhiteboardSessionDocument): boolean {
  const pages = doc.pages ?? []
  if (doc.commands.length > 0) return true
  if (pages.length > 1) return true
  return pages.some((page) => page.commands.length > 0 || (page.title?.trim().length ?? 0) > 0)
}

/**
 * Keep the canonical session when it already has work; otherwise load the richest
 * fallback and bind it to `primaryKey` for the next checkpoint.
 */
export function loadWhiteboardSessionBestMatch(
  primaryKey: WhiteboardSessionKey,
  storagePageKeyCandidates: readonly string[],
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter(),
): WhiteboardSessionDocument {
  const keys = [
    ...new Set(
      storagePageKeyCandidates.map((k) => k.trim()).filter((k) => k.length > 0),
    ),
  ]
  if (keys.length === 0) keys.push(primaryKey.storagePageKey)

  const primaryDoc = loadWhiteboardSession(primaryKey, adapter)
  if (whiteboardSessionHasUserContent(primaryDoc)) {
    return primaryDoc
  }

  let best: WhiteboardSessionDocument | null = null
  let bestScore = -1

  for (const storagePageKey of keys) {
    const candidateKey = { ...primaryKey, storagePageKey }
    const doc = loadWhiteboardSession(candidateKey, adapter)
    const score = scoreWhiteboardSessionRichness(doc)
    if (score > bestScore) {
      bestScore = score
      best = doc
    }
  }

  const loaded = best ?? createEmptyWhiteboardSession(primaryKey)
  return {
    ...loaded,
    key: primaryKey,
    docId: whiteboardSessionDocId(primaryKey),
  }
}

export function saveWhiteboardSessionCheckpoint(
  doc: WhiteboardSessionDocument,
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter(),
): void {
  const root = adapter.readRoot()
  root[doc.docId] = normalizeLessonBoardSessionDocument(
    prepareLessonBoardSessionForPersist(doc),
  ) as WhiteboardSessionDocument
  adapter.writeRoot(root)
}
