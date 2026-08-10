export const BOARD_IMAGE_IMPORT_MAX_BYTES = 8_000_000
export const BOARD_IMAGE_IMPORT_TIMEOUT_MS = 15_000

const ALLOWED_HOST_SUFFIXES = ['pixabay.com', 'giphy.com', 'giphy.net', 'tenor.com'] as const

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type BoardImageImportParseResult =
  | { ok: true; url: URL }
  | { ok: false; reason: 'invalid' | 'blocked' }

export function isAllowedBoardImageImportHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host || host === 'localhost' || host.endsWith('.local')) return false
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

export function parseBoardImageImportUrl(raw: string): BoardImageImportParseResult {
  const trimmed = raw.trim().slice(0, 2048)
  if (!trimmed) return { ok: false, reason: 'invalid' }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'blocked' }
  if (!isAllowedBoardImageImportHost(url.hostname)) return { ok: false, reason: 'blocked' }
  return { ok: true, url }
}

export function normalizeBoardImageMimeType(raw: string | null | undefined): string | null {
  const base = (raw ?? '').split(';')[0]?.trim().toLowerCase()
  if (!base || !ALLOWED_MIME_TYPES.has(base)) return null
  return base
}

export type BoardImageImportFetchResult =
  | { ok: true; bytes: Uint8Array; mimeType: string }
  | { ok: false; reason: 'fetch_failed' | 'too_large' | 'invalid_type' | 'empty' }

export async function fetchBoardImageBytes(
  url: URL,
  options: {
    fetchImpl?: typeof fetch
    maxBytes?: number
    timeoutMs?: number
  } = {},
): Promise<BoardImageImportFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const maxBytes = options.maxBytes ?? BOARD_IMAGE_IMPORT_MAX_BYTES
  const timeoutMs = options.timeoutMs ?? BOARD_IMAGE_IMPORT_TIMEOUT_MS

  let res: Response
  try {
    res = await fetchImpl(url.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    return { ok: false, reason: 'fetch_failed' }
  }

  if (!res.ok) return { ok: false, reason: 'fetch_failed' }

  const mimeType = normalizeBoardImageMimeType(res.headers.get('content-type'))
  if (!mimeType) return { ok: false, reason: 'invalid_type' }

  const lengthHeader = res.headers.get('content-length')
  if (lengthHeader) {
    const declared = Number.parseInt(lengthHeader, 10)
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, reason: 'too_large' }
    }
  }

  let buffer: ArrayBuffer
  try {
    buffer = await res.arrayBuffer()
  } catch {
    return { ok: false, reason: 'fetch_failed' }
  }

  if (buffer.byteLength === 0) return { ok: false, reason: 'empty' }
  if (buffer.byteLength > maxBytes) return { ok: false, reason: 'too_large' }

  return { ok: true, bytes: new Uint8Array(buffer), mimeType }
}
