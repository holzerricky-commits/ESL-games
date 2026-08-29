function fileFromImageBlob(blob: Blob, name: string): File | null {
  if (!blob.type.startsWith('image/')) return null
  const ext =
    blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/webp'
        ? 'webp'
        : blob.type === 'image/gif'
          ? 'gif'
          : 'jpg'
  return new File([blob], `${name}.${ext}`, { type: blob.type })
}

/**
 * Fetch a remote board-search image through `/api/board-image-import` and return a File
 * suitable for `downscaleImageFile` (lesson board insert).
 */
export async function fetchBoardImageAsFile(sourceUrl: string): Promise<File | null> {
  const trimmed = sourceUrl.trim()
  if (!trimmed) return null

  let res: Response
  try {
    res = await fetch(`/api/board-image-import?url=${encodeURIComponent(trimmed)}`)
  } catch {
    return null
  }

  if (!res.ok) return null

  let blob: Blob
  try {
    blob = await res.blob()
  } catch {
    return null
  }

  return fileFromImageBlob(blob, 'board-image')
}

/**
 * Resolve a Translate / quiz-image src (redirect or Pixabay URL) into a File we can stamp
 * onto the book or lesson board.
 */
export async function fetchPlacedImageAsFile(sourceUrl: string): Promise<File | null> {
  const trimmed = sourceUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:image/')) {
    try {
      const res = await fetch(trimmed)
      if (!res.ok) return null
      return fileFromImageBlob(await res.blob(), 'placed-image')
    } catch {
      return null
    }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.href : 'http://localhost/')
  } catch {
    return fetchBoardImageAsFile(trimmed)
  }

  if (parsed.pathname === '/api/quiz-image') {
    try {
      const res = await fetch(`${parsed.pathname}${parsed.search}`)
      if (res.ok) {
        const direct = fileFromImageBlob(await res.blob(), 'placed-image')
        if (direct) return direct
      }
      if (res.url && res.url !== parsed.toString()) {
        return fetchBoardImageAsFile(res.url)
      }
    } catch {
      return null
    }
    return null
  }

  return fetchBoardImageAsFile(parsed.toString())
}
