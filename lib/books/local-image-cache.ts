const CACHE_NAME = 'esl-book-images-v1'

/** Session object URLs so remounts are instant without waiting on Cache API. */
const memoryObjectUrls = new Map<string, string>()

function cacheApiAvailable(): boolean {
  return typeof caches !== 'undefined'
}

export function peekCachedBookImageUrl(src: string): string | undefined {
  return memoryObjectUrls.get(src)
}

export async function forgetCachedBookImage(src: string): Promise<void> {
  const existing = memoryObjectUrls.get(src)
  if (existing) {
    URL.revokeObjectURL(existing)
    memoryObjectUrls.delete(src)
  }
  if (!cacheApiAvailable()) return
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(src)
  } catch {
    // Private mode / blocked storage — ignore.
  }
}

function rememberObjectUrl(src: string, objectUrl: string): string {
  const previous = memoryObjectUrls.get(src)
  if (previous && previous !== objectUrl) URL.revokeObjectURL(previous)
  memoryObjectUrls.set(src, objectUrl)
  return objectUrl
}

async function objectUrlFromResponse(src: string, response: Response): Promise<string> {
  const blob = await response.blob()
  return rememberObjectUrl(src, URL.createObjectURL(blob))
}

/** Load a saved book image. Returns null on 404 (not saved yet). */
export async function tryLoadSavedBookImage(src: string): Promise<string | null> {
  const memory = memoryObjectUrls.get(src)
  if (memory) return memory

  if (cacheApiAvailable()) {
    try {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(src)
      if (cached?.ok) return await objectUrlFromResponse(src, cached)
    } catch {
      // Continue to network.
    }
  }

  const res = await fetch(src, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Image failed (${res.status})`)

  if (cacheApiAvailable()) {
    try {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(src, res.clone())
    } catch {
      // Ignore quota / private mode.
    }
  }

  return objectUrlFromResponse(src, res)
}

export async function loadCachedBookImage(
  src: string,
  onUrl: (objectUrl: string) => void,
): Promise<void> {
  const memory = memoryObjectUrls.get(src)
  if (memory) onUrl(memory)

  let cachedEtag: string | null = null
  if (cacheApiAvailable()) {
    try {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(src)
      if (cached) {
        cachedEtag = cached.headers.get('ETag')
        if (!memory) onUrl(await objectUrlFromResponse(src, cached))
      }
    } catch {
      // Continue to network.
    }
  }

  const headers: HeadersInit = {}
  if (cachedEtag) headers['If-None-Match'] = cachedEtag
  const res = await fetch(src, { cache: 'no-store', headers })
  if (res.status === 304) return
  if (!res.ok) {
    if (memoryObjectUrls.has(src)) return
    throw new Error(`Image failed (${res.status})`)
  }

  if (cacheApiAvailable()) {
    try {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(src, res.clone())
    } catch {
      // Ignore quota / private mode.
    }
  }

  onUrl(await objectUrlFromResponse(src, res))
}
