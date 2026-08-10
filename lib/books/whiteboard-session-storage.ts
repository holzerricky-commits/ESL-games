import {
  normalizeLessonBoardSessionDocument,
  prepareLessonBoardSessionForPersist,
} from '@/lib/books/lesson-board-types'
import {
  compactLegacyEraserLineScene,
  sceneNeedsEraserLineCompaction,
} from '@/lib/books/annotation-geometry'
import {
  createEmptyWhiteboardSession,
  whiteboardSessionDocId,
  type WhiteboardSessionDocument,
  type WhiteboardSessionKey,
} from '@/lib/books/whiteboard-session-types'
import {
  BOOK_ANNOTATIONS_HYDRATED_EVENT,
  getBookAnnotationsDiskCache,
  isBookAnnotationsDiskActive,
  setWhiteboardSessionsOnDiskCache,
  WHITEBOARD_INK_SESSION_STORAGE_KEY,
} from '@/lib/local-data/book-annotations-disk-client'
import { inkSessionPersistV2Enabled } from '@/lib/books/feature-flags'

type WhiteboardSessionRoot = Record<string, WhiteboardSessionDocument>

let whiteboardSessionRootCache: WhiteboardSessionRoot | null = null

export function invalidateWhiteboardSessionRootCache(): void {
  whiteboardSessionRootCache = null
}

export type WhiteboardSessionStorageAdapter = {
  readRoot: () => WhiteboardSessionRoot
  writeRoot: (root: WhiteboardSessionRoot) => void
}

function createBrowserStorageAdapter(): WhiteboardSessionStorageAdapter {
  return {
    readRoot: () => {
      if (typeof window === 'undefined') return {}
      if (isBookAnnotationsDiskActive()) {
        const disk = getBookAnnotationsDiskCache()
        return (disk?.whiteboardSessions ?? {}) as WhiteboardSessionRoot
      }
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
      // Sync browser mirror first so refresh can recover if the PC write is cut off.
      try {
        localStorage.setItem(WHITEBOARD_INK_SESSION_STORAGE_KEY, JSON.stringify(root))
      } catch {
        /* ignore quota/private mode */
      }
      if (isBookAnnotationsDiskActive()) {
        setWhiteboardSessionsOnDiskCache(root)
        return
      }
    },
  }
}

/** Singleton so root-cache only applies to real browser/disk storage, not memory test adapters. */
const browserStorageAdapter = createBrowserStorageAdapter()

function readWhiteboardSessionRoot(adapter: WhiteboardSessionStorageAdapter): WhiteboardSessionRoot {
  const useCache = inkSessionPersistV2Enabled && adapter === browserStorageAdapter
  if (useCache && whiteboardSessionRootCache) {
    return whiteboardSessionRootCache
  }
  const root = adapter.readRoot()
  if (useCache) {
    whiteboardSessionRootCache = root
  }
  return root
}

if (typeof window !== 'undefined') {
  window.addEventListener(BOOK_ANNOTATIONS_HYDRATED_EVENT, () => {
    invalidateWhiteboardSessionRootCache()
  })
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
  const normalized = normalizeLessonBoardSessionDocument(withKey) as WhiteboardSessionDocument
  let commands = normalized.commands
  if (sceneNeedsEraserLineCompaction(commands)) {
    commands = compactLegacyEraserLineScene(commands)
  }
  const pages = normalized.pages?.map((page) => {
    if (!sceneNeedsEraserLineCompaction(page.commands)) return page
    return { ...page, commands: compactLegacyEraserLineScene(page.commands) }
  })
  if (commands === normalized.commands && pages === normalized.pages) return normalized
  return { ...normalized, commands, pages }
}

export function loadWhiteboardSession(
  key: WhiteboardSessionKey,
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter,
): WhiteboardSessionDocument {
  const root = readWhiteboardSessionRoot(adapter)
  const raw = root[whiteboardSessionDocId(key)] as WhiteboardSessionDocument | undefined
  return normalizeLoadedWhiteboardSession(raw, key)
}

/** Existing lasting board only — null when this student/book/unit has never been saved. */
export function peekWhiteboardSession(
  key: WhiteboardSessionKey,
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter,
): WhiteboardSessionDocument | null {
  const root = readWhiteboardSessionRoot(adapter)
  const raw = root[whiteboardSessionDocId(key)] as WhiteboardSessionDocument | undefined
  if (!raw) return null
  return normalizeLoadedWhiteboardSession(raw, key)
}

export function scoreWhiteboardSessionRichness(doc: WhiteboardSessionDocument): number {
  const pages = doc.pages ?? []
  const pageInk = pages.reduce((n, p) => n + p.commands.length, 0)
  return pages.length * 10_000 + pageInk * 10 + doc.commands.length
}

const WHITEBOARD_DOC_ID_SUFFIX = '::wb::'

/** Storage page keys already on disk for this student/book/unit (legacy class boards + local). */
export function listStoredWhiteboardStoragePageKeys(
  scope: Pick<WhiteboardSessionKey, 'studentId' | 'bookId' | 'unitId'>,
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter,
): string[] {
  const prefix = `${scope.studentId}::${scope.bookId}::${scope.unitId}${WHITEBOARD_DOC_ID_SUFFIX}`
  const root = readWhiteboardSessionRoot(adapter)
  const keys: string[] = []
  for (const docId of Object.keys(root)) {
    if (!docId.startsWith(prefix)) continue
    const storagePageKey = docId.slice(prefix.length).trim()
    if (storagePageKey.startsWith('wb:session:')) keys.push(storagePageKey)
  }
  return keys
}

/**
 * Load the richest session among candidate storage keys (plus any sibling boards found on disk),
 * then bind to `primaryKey` so the next checkpoint writes to the lasting notebook key.
 */
export function loadWhiteboardSessionBestMatch(
  primaryKey: WhiteboardSessionKey,
  storagePageKeyCandidates: readonly string[],
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter,
): WhiteboardSessionDocument {
  const keys = [
    ...new Set(
      [
        ...storagePageKeyCandidates,
        ...listStoredWhiteboardStoragePageKeys(primaryKey, adapter),
        primaryKey.storagePageKey,
      ]
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    ),
  ]

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
  adapter: WhiteboardSessionStorageAdapter = browserStorageAdapter,
): void {
  const root = readWhiteboardSessionRoot(adapter)
  root[doc.docId] = normalizeLessonBoardSessionDocument(
    prepareLessonBoardSessionForPersist(doc),
  ) as WhiteboardSessionDocument
  adapter.writeRoot(root)
  if (inkSessionPersistV2Enabled && adapter === browserStorageAdapter) {
    whiteboardSessionRootCache = root
  }
}
