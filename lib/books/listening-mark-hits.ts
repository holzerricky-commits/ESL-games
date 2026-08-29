/** Pure helpers for listening-mark Gemini hits (no server-only). */

export type ListeningMarkHit = {
  /** 1-based PDF page number after remapping. */
  pdfPage: number
  /** Printed track number / label next to the mark. */
  label: string
  /** Normalized page center x in 0–1. */
  x: number
  /** Normalized page center y in 0–1. */
  y: number
}

export type ListeningMarkHitSampleReason =
  | 'placed'
  | 'unmatched'
  | 'ambiguous'
  | 'duplicate'
  | 'queued_duplicate'

export type ListeningMarkHitSample = {
  pdfPage: number
  label: string
  matchedFileName: string | null
  reason: ListeningMarkHitSampleReason
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5
  return Math.max(0, Math.min(1, n))
}

/**
 * Map a model-reported page to a real PDF page in this chunk.
 * - Already an allowed PDF page → keep
 * - 1-based index into chunk images (1…N) → map to that image’s pdfPage
 * - Else null (drop)
 */
export function resolveListeningMarkPdfPage(
  reported: number,
  chunkPdfPagesInOrder: readonly number[],
): number | null {
  if (!Number.isFinite(reported)) return null
  const n = Math.floor(reported)
  if (chunkPdfPagesInOrder.includes(n)) return n
  if (n >= 1 && n <= chunkPdfPagesInOrder.length) {
    return chunkPdfPagesInOrder[n - 1]!
  }
  return null
}

/**
 * Parse Gemini JSON hits and remap image-order page numbers to real PDF pages.
 */
export function parseListeningMarkHits(
  raw: unknown,
  chunkPdfPagesInOrder: readonly number[],
): ListeningMarkHit[] {
  if (!raw || typeof raw !== 'object') return []
  const hitsRaw = (raw as { hits?: unknown }).hits
  if (!Array.isArray(hitsRaw)) return []
  const out: ListeningMarkHit[] = []
  for (const row of hitsRaw) {
    if (!row || typeof row !== 'object') continue
    const src = row as Record<string, unknown>
    const resolved = resolveListeningMarkPdfPage(Number(src.pdfPage), chunkPdfPagesInOrder)
    const label = String(src.label ?? '').trim()
    const x = clamp01(Number(src.x))
    const y = clamp01(Number(src.y))
    if (resolved == null || !label) continue
    out.push({ pdfPage: resolved, label, x, y })
  }
  return out
}
