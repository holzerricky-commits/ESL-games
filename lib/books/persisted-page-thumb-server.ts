import 'server-only'

import path from 'node:path'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { getBookLibraryRoot } from '@/lib/books/server'
import { isBookLibraryFilePath } from '@/lib/books/manifest-validation'
import {
  clampPageThumbPage,
  normalizeLibraryRelativePath,
  persistedPageThumbRelativePath,
} from '@/lib/books/persisted-page-thumb-path'

export class PersistedPageThumbError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'PersistedPageThumbError'
    this.status = status
  }
}

async function fileStatOrNull(absPath: string) {
  try {
    return await stat(absPath)
  } catch {
    return null
  }
}

function resolveThumbLocations(pdfRelativePath: string, pageNumber: number) {
  const cwd = /* turbopackIgnore: true */ process.cwd()
  const libraryRoot = getBookLibraryRoot()
  const normalized = normalizeLibraryRelativePath(pdfRelativePath)
  const page = clampPageThumbPage(pageNumber)
  if (page == null) {
    throw new PersistedPageThumbError('Invalid page.', 400)
  }
  if (!normalized.toLowerCase().endsWith('.pdf')) {
    throw new PersistedPageThumbError('Path must be a PDF.', 400)
  }
  if (!isBookLibraryFilePath(normalized, cwd, libraryRoot)) {
    throw new PersistedPageThumbError('Path must be inside book-library.', 400)
  }

  const relativeThumb = persistedPageThumbRelativePath(normalized, page)
  if (!relativeThumb) {
    throw new PersistedPageThumbError('Could not resolve thumb path.', 400)
  }

  const absPdf = path.resolve(cwd, normalized)
  const absThumb = path.resolve(cwd, relativeThumb)
  const rootPrefix = libraryRoot.endsWith(path.sep) ? libraryRoot : `${libraryRoot}${path.sep}`
  if (!absPdf.startsWith(rootPrefix) || !absThumb.startsWith(rootPrefix)) {
    throw new PersistedPageThumbError('Path must be inside book-library.', 400)
  }

  return { absPdf, absThumb, relativeThumb, page, normalized }
}

/** Existing saved JPEG, or null when missing/stale. Does not open the PDF. */
export async function findExistingPersistedPageThumb(
  pdfRelativePath: string,
  pageNumber: number,
): Promise<string | null> {
  const { absPdf, absThumb } = resolveThumbLocations(pdfRelativePath, pageNumber)
  const pdfStat = await fileStatOrNull(absPdf)
  if (!pdfStat?.isFile()) {
    throw new PersistedPageThumbError('PDF not found.', 404)
  }
  const thumbStat = await fileStatOrNull(absThumb)
  if (thumbStat?.isFile() && thumbStat.size > 0 && thumbStat.mtimeMs >= pdfStat.mtimeMs) {
    return absThumb
  }
  return null
}

/** Save a browser-drawn JPEG next to the book. */
export async function savePersistedPageThumbJpeg(
  pdfRelativePath: string,
  pageNumber: number,
  jpeg: Buffer,
): Promise<string> {
  const { absPdf, absThumb } = resolveThumbLocations(pdfRelativePath, pageNumber)
  const pdfStat = await fileStatOrNull(absPdf)
  if (!pdfStat?.isFile()) {
    throw new PersistedPageThumbError('PDF not found.', 404)
  }
  await mkdir(path.dirname(absThumb), { recursive: true })
  await writeFile(absThumb, jpeg)
  return absThumb
}

export function isJpegBuffer(bytes: Buffer): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}
