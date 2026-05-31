import {
  createEmptySpreadSession,
  spreadSessionDocId,
  type SpreadSessionDocument,
  type SpreadSessionKey,
} from '@/lib/books/spread-session-types'

const SPREAD_SESSION_STORAGE_KEY = 'bookSpreadSessionV1'

type SpreadSessionRoot = Record<string, SpreadSessionDocument>

export type SpreadSessionStorageAdapter = {
  readRoot: () => SpreadSessionRoot
  writeRoot: (root: SpreadSessionRoot) => void
}

function browserStorageAdapter(): SpreadSessionStorageAdapter {
  return {
    readRoot: () => {
      if (typeof window === 'undefined') return {}
      try {
        const raw = localStorage.getItem(SPREAD_SESSION_STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') return {}
        return parsed as SpreadSessionRoot
      } catch {
        return {}
      }
    },
    writeRoot: (root: SpreadSessionRoot) => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(SPREAD_SESSION_STORAGE_KEY, JSON.stringify(root))
      } catch {
        /* ignore quota/private mode */
      }
    },
  }
}

export function createMemorySpreadSessionStorage(
  initial: SpreadSessionRoot = {},
): SpreadSessionStorageAdapter {
  let root: SpreadSessionRoot = { ...initial }
  return {
    readRoot: () => ({ ...root }),
    writeRoot: (next) => {
      root = { ...next }
    },
  }
}

export function loadSpreadSession(
  key: SpreadSessionKey,
  adapter: SpreadSessionStorageAdapter = browserStorageAdapter(),
): SpreadSessionDocument {
  const root = adapter.readRoot()
  return root[spreadSessionDocId(key)] ?? createEmptySpreadSession(key)
}

export function saveSpreadSessionCheckpoint(
  doc: SpreadSessionDocument,
  adapter: SpreadSessionStorageAdapter = browserStorageAdapter(),
): void {
  const root = adapter.readRoot()
  root[doc.docId] = doc
  adapter.writeRoot(root)
}

export function clearSpreadSession(
  key: SpreadSessionKey,
  adapter: SpreadSessionStorageAdapter = browserStorageAdapter(),
): void {
  const root = adapter.readRoot()
  delete root[spreadSessionDocId(key)]
  adapter.writeRoot(root)
}
