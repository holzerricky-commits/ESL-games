import path from 'node:path'

/** Sidecar folder next to the original unit PDF. Not listed as a library unit. */
export const SEARCHABLE_PDF_DIR = '.searchable'

export function isHiddenLibraryDirName(name: string): boolean {
  return name.startsWith('.')
}

export function isSearchableSidecarAbsPath(absPath: string): boolean {
  const parts = absPath.replaceAll('\\', '/').split('/')
  return parts.includes(SEARCHABLE_PDF_DIR)
}

/**
 * Serve / reuse the OCR sidecar only when it is at least as new as the original PDF.
 * A replaced scan has a newer mtime; the old sidecar must not be shown as the book.
 */
export function shouldServeSearchableSidecar(
  sidecarMtimeMs: number,
  originalMtimeMs: number,
): boolean {
  return sidecarMtimeMs >= originalMtimeMs
}

/**
 * Searchable copy path for an original unit PDF.
 * `book-library/foo/unit.pdf` → `book-library/foo/.searchable/unit.pdf`
 */
export function searchablePdfAbsolutePath(originalAbsPath: string): string {
  if (isSearchableSidecarAbsPath(originalAbsPath)) return originalAbsPath
  const dir = path.dirname(originalAbsPath)
  const base = path.basename(originalAbsPath)
  return path.join(dir, SEARCHABLE_PDF_DIR, base)
}
