import path from 'node:path'
import { access, constants, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { resolveBookFolderForBook } from '@/lib/books/book-cover-path'
import { slugifyDiskSegment } from '@/lib/books/book-disk-naming'
import { dedupeBooksById } from '@/lib/books/dedupe-book-library'
import { isBookLibraryFilePath } from '@/lib/books/manifest-validation'
import {
  STACKED_SOURCE_DIR,
  buildStackedPdfUnitRanges,
  unitPdfFileName,
  type StackedPdfCutInput,
} from '@/lib/books/split-stacked-pdf-ranges'
import { getBookLibraryRoot, loadBookLibrary, saveBookLibraryManifest } from '@/lib/books/server'
import { ensureVolumesForFilePaths } from '@/lib/books/book-volumes'
import type { BookLibraryPayload, BookRecord, BookUnitRecord } from '@/lib/books/types'

export type SplitStackedPdfResult =
  | {
      ok: true
      library: BookLibraryPayload
      bookId: string
      units: BookUnitRecord[]
      sourceArchivedPath: string
    }
  | { ok: false; error: string }

async function pathExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function isBusyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code ?? '') : ''
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES' || code === 'ENOTEMPTY'
}

async function allocateUniquePdfName(targetDir: string, preferredFileName: string): Promise<string> {
  const preferred = preferredFileName.toLowerCase().endsWith('.pdf')
    ? preferredFileName
    : `${preferredFileName}.pdf`
  let candidate = preferred
  let abs = path.resolve(targetDir, candidate)
  if (!abs.startsWith(targetDir)) {
    throw new Error('Invalid target path.')
  }
  if (!(await pathExists(abs))) return candidate

  const stem = slugifyDiskSegment(preferred.replace(/\.pdf$/i, '')) || 'unit'
  let n = 2
  while (n < 5000) {
    candidate = `${stem}-${n}.pdf`
    abs = path.resolve(targetDir, candidate)
    if (!abs.startsWith(targetDir)) {
      throw new Error('Invalid target path.')
    }
    if (!(await pathExists(abs))) return candidate
    n += 1
  }
  throw new Error('Could not allocate unique filename.')
}

async function slicePdfRangeBytes(
  src: PDFDocument,
  startPage: number,
  endPage: number,
): Promise<Uint8Array | null> {
  const n = src.getPageCount()
  const s = Math.max(1, Math.floor(startPage))
  const e = Math.max(s, Math.floor(endPage))
  const indices: number[] = []
  for (let p = s; p <= e; p++) {
    const idx = p - 1
    if (idx >= 0 && idx < n) indices.push(idx)
  }
  if (!indices.length) return null
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, indices)
  for (const page of copied) out.addPage(page)
  return out.save()
}

function unitIdFromFileName(fileName: string, bookId: string, index: number): string {
  const stem = slugifyDiskSegment(fileName.replace(/\.pdf$/i, ''))
  return stem || `${bookId}-unit-${index + 1}`
}

/**
 * Cut a stacked PDF on disk into one file per unit, archive the original under
 * `.stacked-source/`, and replace the book's units in the manifest.
 */
export async function splitStackedPdfIntoUnits(options: {
  bookId: string
  sourceFilePath: string
  cuts: StackedPdfCutInput[]
}): Promise<SplitStackedPdfResult> {
  const bookId = options.bookId.trim()
  const sourceFilePath = options.sourceFilePath.trim().replaceAll('\\', '/')
  if (!bookId) return { ok: false, error: 'bookId is required.' }
  if (!sourceFilePath) return { ok: false, error: 'sourceFilePath is required.' }
  if (!Array.isArray(options.cuts) || options.cuts.length < 2) {
    return { ok: false, error: 'Mark at least two unit starts before cutting.' }
  }

  const cwd = /* turbopackIgnore: true */ process.cwd()
  const libraryRoot = getBookLibraryRoot()
  if (!isBookLibraryFilePath(sourceFilePath, cwd, libraryRoot)) {
    return { ok: false, error: 'Source file must be inside book-library.' }
  }

  const library = await loadBookLibrary()
  const books = dedupeBooksById(library.books)
  const book = books.find((entry) => entry.id === bookId)
  if (!book) return { ok: false, error: 'Book not found.' }

  const folder = resolveBookFolderForBook(book)
  if (!folder) return { ok: false, error: 'Could not resolve this book’s folder.' }

  const knownPaths = new Set(book.units.map((u) => u.filePath.replaceAll('\\', '/')))
  if (!knownPaths.has(sourceFilePath)) {
    return { ok: false, error: 'Source file is not part of this book.' }
  }

  const absSource = path.resolve(cwd, sourceFilePath)
  if (!(await pathExists(absSource))) {
    return { ok: false, error: 'Source PDF is missing on disk.' }
  }

  const absBookDir = path.resolve(libraryRoot, folder)
  if (!absBookDir.startsWith(libraryRoot) || absBookDir === libraryRoot) {
    return { ok: false, error: 'Invalid book folder.' }
  }

  let srcBytes: Buffer
  try {
    srcBytes = await readFile(absSource)
  } catch (error) {
    if (isBusyError(error)) {
      return {
        ok: false,
        error:
          'Could not read the PDF — it may be open. Close the book reader, then try again.',
      }
    }
    const message = error instanceof Error ? error.message : 'Read failed.'
    return { ok: false, error: message }
  }

  let srcDoc: PDFDocument
  try {
    srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  } catch {
    return { ok: false, error: 'Could not open this PDF. It may be damaged or encrypted.' }
  }

  const pageCount = srcDoc.getPageCount()
  const ranged = buildStackedPdfUnitRanges(options.cuts, pageCount)
  if (!ranged.ok) return { ok: false, error: ranged.error }
  if (ranged.ranges.length < 2) {
    return { ok: false, error: 'Mark at least two unit starts before cutting.' }
  }

  const writtenAbsPaths: string[] = []
  const nextUnits: BookUnitRecord[] = []

  try {
    for (const range of ranged.ranges) {
      const preferredName = unitPdfFileName(range.index)
      const fileName = await allocateUniquePdfName(absBookDir, preferredName)
      const absOut = path.resolve(absBookDir, fileName)
      if (!absOut.startsWith(absBookDir)) {
        throw new Error('Invalid output path.')
      }
      const slice = await slicePdfRangeBytes(srcDoc, range.startPage, range.endPage)
      if (!slice) {
        throw new Error(`Could not slice pages ${range.startPage}–${range.endPage}.`)
      }
      await writeFile(absOut, slice)
      writtenAbsPaths.push(absOut)
      const relative = `book-library/${folder}/${fileName}`.replaceAll('\\', '/')
      nextUnits.push({
        id: unitIdFromFileName(fileName, book.id, range.index),
        title: range.title,
        filePath: relative,
      })
    }
  } catch (error) {
    for (const written of writtenAbsPaths) {
      try {
        await unlink(written)
      } catch {
        // best-effort cleanup
      }
    }
    if (isBusyError(error)) {
      return {
        ok: false,
        error:
          'Could not write unit files — a PDF may be open. Close the book reader, then try again.',
      }
    }
    const message = error instanceof Error ? error.message : 'Split failed.'
    return { ok: false, error: message }
  }

  const archiveDir = path.resolve(absBookDir, STACKED_SOURCE_DIR)
  await mkdir(archiveDir, { recursive: true })
  const archiveBase = path.basename(absSource)
  let archiveName = archiveBase
  let absArchive = path.resolve(archiveDir, archiveName)
  let archiveN = 2
  while (await pathExists(absArchive)) {
    const stem = archiveBase.replace(/\.pdf$/i, '')
    archiveName = `${stem}-${archiveN}.pdf`
    absArchive = path.resolve(archiveDir, archiveName)
    archiveN += 1
  }

  try {
    await rename(absSource, absArchive)
  } catch (error) {
    for (const written of writtenAbsPaths) {
      try {
        await unlink(written)
      } catch {
        // best-effort
      }
    }
    if (isBusyError(error)) {
      return {
        ok: false,
        error:
          'Could not archive the original PDF — it may be open. Close the book reader, then try again.',
      }
    }
    const message = error instanceof Error ? error.message : 'Archive failed.'
    return { ok: false, error: message }
  }

  const archivedRelative = `book-library/${folder}/${STACKED_SOURCE_DIR}/${archiveName}`.replaceAll(
    '\\',
    '/',
  )

  const nextBook: BookRecord = ensureVolumesForFilePaths(
    {
      ...book,
      units: nextUnits,
    },
    nextUnits.map((u) => u.filePath),
  )
  delete nextBook.pageAlignmentByFile
  // Drop per-file gutter overrides tied to the old stacked path.
  if (nextBook.spreadGutterByFile) {
    const nextGutters = { ...nextBook.spreadGutterByFile }
    delete nextGutters[sourceFilePath]
    if (Object.keys(nextGutters).length === 0) {
      delete nextBook.spreadGutterByFile
    } else {
      nextBook.spreadGutterByFile = nextGutters
    }
  }

  const nextLibrary: BookLibraryPayload = {
    books: books.map((entry) => (entry.id === book.id ? nextBook : entry)),
  }
  await saveBookLibraryManifest(nextLibrary)

  return {
    ok: true,
    library: nextLibrary,
    bookId: book.id,
    units: nextBook.units,
    sourceArchivedPath: archivedRelative,
  }
}
