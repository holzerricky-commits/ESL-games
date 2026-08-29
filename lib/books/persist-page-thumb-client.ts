import { normalizeLibraryRelativePath } from '@/lib/books/persisted-page-thumb-path'

const posted = new Set<string>()
const posting = new Map<string, Promise<void>>()

function saveKey(filePath: string, pageNumber: number): string {
  return `${normalizeLibraryRelativePath(filePath)}|${pageNumber}`
}

async function dataUrlToJpegBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  if (blob.type && blob.type !== 'image/jpeg' && !dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Expected a JPEG thumbnail.')
  }
  return blob
}

/** Save a browser-drawn page picture next to the book (once per page). */
export function persistPageThumbFromDataUrl(
  filePath: string,
  pageNumber: number,
  dataUrl: string,
): Promise<void> {
  const key = saveKey(filePath, pageNumber)
  if (posted.has(key)) return Promise.resolve()
  const pending = posting.get(key)
  if (pending) return pending

  const run = (async () => {
    const blob = await dataUrlToJpegBlob(dataUrl)
    const file = new File([blob], 'thumb.jpg', { type: 'image/jpeg' })
    const form = new FormData()
    form.set('path', normalizeLibraryRelativePath(filePath))
    form.set('page', String(pageNumber))
    form.set('file', file)
    const res = await fetch('/api/books/page-thumb', { method: 'POST', body: form })
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? `Save failed (${res.status})`)
    }
    posted.add(key)
  })().finally(() => {
    posting.delete(key)
  })

  posting.set(key, run)
  return run
}
