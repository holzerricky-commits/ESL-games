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

export function loadWhiteboardSession(
  key: WhiteboardSessionKey,
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter(),
): WhiteboardSessionDocument {
  const root = adapter.readRoot()
  return root[whiteboardSessionDocId(key)] ?? createEmptyWhiteboardSession(key)
}

export function saveWhiteboardSessionCheckpoint(
  doc: WhiteboardSessionDocument,
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter(),
): void {
  const root = adapter.readRoot()
  root[doc.docId] = doc
  adapter.writeRoot(root)
}
