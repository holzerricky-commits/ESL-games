import {
  createEmptySpreadSession,
  spreadSessionDocId,
  type SpreadSessionDocument,
  type SpreadSessionKey,
} from '@/lib/books/spread-session-types'
import {
  compactLegacyEraserLineScene,
  sceneNeedsEraserLineCompaction,
} from '@/lib/books/annotation-geometry'
import {
  BOOK_ANNOTATIONS_HYDRATED_EVENT,
  getBookAnnotationsDiskCache,
  isBookAnnotationsDiskActive,
  setSpreadSessionsOnDiskCache,
  SPREAD_SESSION_STORAGE_KEY,
} from '@/lib/local-data/book-annotations-disk-client'
import { inkSessionPersistV2Enabled } from '@/lib/books/feature-flags'

type SpreadSessionRoot = Record<string, SpreadSessionDocument>

/** In-memory root while a session is open — avoids re-parse on every checkpoint (R5). */
let spreadSessionRootCache: SpreadSessionRoot | null = null

export function invalidateSpreadSessionRootCache(): void {
  spreadSessionRootCache = null
}

export type SpreadSessionStorageAdapter = {
  readRoot: () => SpreadSessionRoot
  writeRoot: (root: SpreadSessionRoot) => void
}

/** Singleton so root-cache only applies to real browser/disk storage, not memory test adapters. */
function createBrowserStorageAdapter(): SpreadSessionStorageAdapter {
  return {
    readRoot: () => {
      if (typeof window === 'undefined') return {}
      if (isBookAnnotationsDiskActive()) {
        const disk = getBookAnnotationsDiskCache()
        return (disk?.spreadSessions ?? {}) as SpreadSessionRoot
      }
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
      if (isBookAnnotationsDiskActive()) {
        setSpreadSessionsOnDiskCache(root)
      }
    },
  }
}

const browserStorageAdapter = createBrowserStorageAdapter()

function readSpreadSessionRoot(adapter: SpreadSessionStorageAdapter): SpreadSessionRoot {
  const useCache = inkSessionPersistV2Enabled && adapter === browserStorageAdapter
  if (useCache && spreadSessionRootCache) {
    return spreadSessionRootCache
  }
  const root = adapter.readRoot()
  if (useCache) {
    spreadSessionRootCache = root
  }
  return root
}

if (typeof window !== 'undefined') {
  window.addEventListener(BOOK_ANNOTATIONS_HYDRATED_EVENT, () => {
    invalidateSpreadSessionRootCache()
  })
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
  adapter: SpreadSessionStorageAdapter = browserStorageAdapter,
): SpreadSessionDocument {
  const root = readSpreadSessionRoot(adapter)
  const doc = root[spreadSessionDocId(key)] ?? createEmptySpreadSession(key)
  if (!sceneNeedsEraserLineCompaction(doc.commands)) return doc
  return { ...doc, commands: compactLegacyEraserLineScene(doc.commands) }
}

export function saveSpreadSessionCheckpoint(
  doc: SpreadSessionDocument,
  adapter: SpreadSessionStorageAdapter = browserStorageAdapter,
): void {
  const root = readSpreadSessionRoot(adapter)
  root[doc.docId] = doc
  adapter.writeRoot(root)
  if (inkSessionPersistV2Enabled && adapter === browserStorageAdapter) {
    spreadSessionRootCache = root
  }
}

export function clearSpreadSession(
  key: SpreadSessionKey,
  adapter: SpreadSessionStorageAdapter = browserStorageAdapter,
): void {
  const root = readSpreadSessionRoot(adapter)
  delete root[spreadSessionDocId(key)]
  adapter.writeRoot(root)
  if (inkSessionPersistV2Enabled && adapter === browserStorageAdapter) {
    spreadSessionRootCache = root
  }
}
