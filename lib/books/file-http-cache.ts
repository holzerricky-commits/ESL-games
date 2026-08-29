export const IMAGE_REVALIDATE_CACHE_CONTROL = 'private, max-age=0, must-revalidate'

export function fileEtag(stat: { size: number; mtimeMs: number }): string {
  return `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`
}

export function ifNoneMatchHits(headerValue: string | null, etag: string): boolean {
  if (!headerValue) return false
  return headerValue
    .split(',')
    .map((part) => part.trim())
    .some((part) => part === etag || part === `W/${etag}`)
}
