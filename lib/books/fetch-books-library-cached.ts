import type { BookLibraryPayload } from '@/lib/books/types'

let cachedLibrary: BookLibraryPayload | null = null
let inflight: Promise<BookLibraryPayload> | null = null

/** Synchronous read of the last successful library load (same payload for all students). */
export function getBooksLibraryCached(): BookLibraryPayload | null {
  return cachedLibrary
}

/**
 * Single-flight fetch for GET `/api/books` with an in-memory cache for the session.
 * Map route and book overlay share this so opening the reader does not repeat network work.
 */
export function fetchBooksLibraryCached(): Promise<BookLibraryPayload> {
  if (cachedLibrary) return Promise.resolve(cachedLibrary)
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const res = await fetch('/api/books')
      const payload = (await res.json()) as BookLibraryPayload | { error: string }
      if (!res.ok) {
        const message = 'error' in payload ? payload.error : 'Could not load books.'
        throw new Error(message)
      }
      const lib = payload as BookLibraryPayload
      cachedLibrary = lib
      return lib
    } finally {
      inflight = null
    }
  })()

  return inflight
}
