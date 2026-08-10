import type { BookLibraryPayload } from '@/lib/books/types'

let cachedLibrary: BookLibraryPayload | null = null
let inflightFast: Promise<BookLibraryPayload> | null = null

export type FetchBooksLibraryOptions = {
  /** Run server-side cover generation (slow). Use on the Library page only. */
  syncCovers?: boolean
}

/** Synchronous read of the last successful library load (same payload for all students). */
export function getBooksLibraryCached(): BookLibraryPayload | null {
  return cachedLibrary
}

function booksApiUrl(options?: FetchBooksLibraryOptions): string {
  return options?.syncCovers ? '/api/books?syncCovers=1' : '/api/books'
}

async function fetchBooksLibraryFromNetwork(options?: FetchBooksLibraryOptions): Promise<BookLibraryPayload> {
  const res = await fetch(booksApiUrl(options))
  const payload = (await res.json()) as BookLibraryPayload | { error: string }
  if (!res.ok) {
    const message = 'error' in payload ? payload.error : 'Could not load books.'
    throw new Error(message)
  }
  const lib = payload as BookLibraryPayload
  cachedLibrary = lib
  return lib
}

/**
 * Single-flight fetch for GET `/api/books` with an in-memory cache for the session.
 * Default is the fast path (no cover sync). Pass `{ syncCovers: true }` on the Library page.
 */
export function fetchBooksLibraryCached(options?: FetchBooksLibraryOptions): Promise<BookLibraryPayload> {
  if (options?.syncCovers) {
    return fetchBooksLibraryFromNetwork(options)
  }
  if (cachedLibrary) return Promise.resolve(cachedLibrary)
  if (inflightFast) return inflightFast

  inflightFast = fetchBooksLibraryFromNetwork()
    .catch((error) => {
      cachedLibrary = null
      throw error
    })
    .finally(() => {
      inflightFast = null
    })

  return inflightFast
}
