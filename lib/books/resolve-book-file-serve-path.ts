import { stat } from 'node:fs/promises'
import {
  isSearchableSidecarAbsPath,
  searchablePdfAbsolutePath,
  shouldServeSearchableSidecar,
} from '@/lib/books/searchable-pdf-path'

/**
 * Pick the PDF bytes `/api/book-file` should stream.
 * Prefer a fresh `.searchable/` sidecar (hidden OCR text). If the teacher replaced
 * the original scan, the sidecar is stale — serve the new original instead.
 */
export async function resolveBookFileServeAbsolutePath(absOriginal: string): Promise<string> {
  if (!absOriginal.toLowerCase().endsWith('.pdf') || isSearchableSidecarAbsPath(absOriginal)) {
    return absOriginal
  }

  const sidecar = searchablePdfAbsolutePath(absOriginal)
  let sidecarMtimeMs: number | null = null
  try {
    const sidecarStat = await stat(sidecar)
    if (!sidecarStat.isFile()) return absOriginal
    sidecarMtimeMs = sidecarStat.mtimeMs
  } catch {
    return absOriginal
  }

  try {
    const originalStat = await stat(absOriginal)
    if (
      originalStat.isFile() &&
      !shouldServeSearchableSidecar(sidecarMtimeMs, originalStat.mtimeMs)
    ) {
      return absOriginal
    }
  } catch {
    // Original missing — still serve an existing sidecar (same as before this check).
  }

  return sidecar
}
