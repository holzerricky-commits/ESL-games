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

  if (!blob.type.startsWith('image/')) return null

  const ext =
    blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/webp'
        ? 'webp'
        : blob.type === 'image/gif'
          ? 'gif'
          : 'jpg'

  return new File([blob], `board-image.${ext}`, { type: blob.type })
}
