import path from 'node:path'
import { access, constants, mkdir, writeFile } from 'node:fs/promises'
import {
  buildCanonicalBookFolderName,
  buildCanonicalMainPdfFileName,
  planBookUploadFromFileName,
  slugifyDiskSegment,
} from '@/lib/books/book-disk-naming'
import { resolveBookFolderForBook } from '@/lib/books/book-cover-path'
import {
  looksLikePresentationCatalogName,
  PRESENTATIONS_SERIES,
} from '@/lib/books/book-catalog-labels'
import {
  dedupeBooksById,
  findBookByIdOrFolder,
} from '@/lib/books/dedupe-book-library'
import {
  buildPresentationLevelBookShell,
  findPresentationLevelBook,
  normalizePresentationDifficultyLevel,
  presentationLevelBookId,
  titleFromPresentationDeckFileName,
  type PresentationDifficultyLevel,
} from '@/lib/books/presentation-levels'
import {
  getBookLibraryRoot,
  loadBookLibrary,
  saveBookLibraryManifest,
} from '@/lib/books/server'
import type { BookLibraryPayload, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function allocateUniquePdfName(
  targetDir: string,
  preferredFileName: string,
): Promise<string> {
  const preferred = preferredFileName.toLowerCase().endsWith('.pdf')
    ? preferredFileName
    : `${preferredFileName}.pdf`
  let candidate = preferred
  let abs = path.resolve(targetDir, candidate)
  if (!abs.startsWith(targetDir)) {
    throw new Error('Invalid target path.')
  }
  if (!(await fileExists(abs))) return candidate

  const stem = slugifyDiskSegment(preferred.replace(/\.pdf$/i, '')) || 'book'
  let n = 2
  while (n < 5000) {
    candidate = `${stem}-${n}.pdf`
    abs = path.resolve(targetDir, candidate)
    if (!abs.startsWith(targetDir)) {
      throw new Error('Invalid target path.')
    }
    if (!(await fileExists(abs))) return candidate
    n += 1
  }
  throw new Error('Could not allocate unique filename.')
}

function titleFromPdf(pdfFileName: string): string {
  return (
    pdfFileName
      .replace(/\.pdf$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'Unit 1'
  )
}

function appendUnitToBook(
  book: BookRecord,
  unit: BookUnitRecord,
): BookRecord {
  const normalizedPath = unit.filePath.replaceAll('\\', '/')
  const knownPaths = new Set(book.units.map((entry) => entry.filePath.replaceAll('\\', '/')))
  if (knownPaths.has(normalizedPath)) return book

  let unitId = unit.id
  if (book.units.some((entry) => entry.id === unitId)) {
    unitId = `${unit.id}-${book.units.length + 1}`
  }

  return {
    ...book,
    units: [...book.units, { ...unit, id: unitId, filePath: normalizedPath }],
  }
}

function upsertUploadedBook(options: {
  library: BookLibraryPayload
  bookId: string
  bookFolder: string
  title: string
  series: string
  grade?: string
  role?: string
  contentFormat?: BookRecord['contentFormat']
  relativeFilePath: string
  pdfFileName: string
  unitTitle?: string
}): BookLibraryPayload {
  const {
    library,
    bookId,
    bookFolder,
    title,
    series,
    grade,
    role,
    contentFormat,
    relativeFilePath,
    pdfFileName,
    unitTitle,
  } = options

  const books = dedupeBooksById(library.books)
  const existing = findBookByIdOrFolder(books, bookId, bookFolder)

  const resolvedUnitTitle = unitTitle?.trim() || titleFromPdf(pdfFileName)
  const unitId = slugifyDiskSegment(pdfFileName.replace(/\.pdf$/i, '')) || `${bookId}-unit-1`
  const newUnit: BookUnitRecord = {
    id: unitId,
    title: resolvedUnitTitle,
    filePath: relativeFilePath,
  }

  if (!existing) {
    const book: BookRecord = {
      id: bookId,
      title,
      series,
      units: [newUnit],
    }
    if (grade) book.grade = grade
    if (role) book.role = role
    if (contentFormat === 'presentation') book.contentFormat = 'presentation'
    return { books: [...books, book] }
  }

  const next = appendUnitToBook(existing, newUnit)
  const withMeta: BookRecord = {
    ...next,
    title: existing.title?.trim() ? existing.title : title,
    series: existing.series?.trim() ? existing.series : series,
  }
  if (existing.grade === undefined && grade) withMeta.grade = grade
  if (existing.role === undefined && role) withMeta.role = role
  if (existing.contentFormat === undefined && contentFormat === 'presentation') {
    withMeta.contentFormat = 'presentation'
  }

  return {
    books: books.map((book) => (book.id === existing.id ? withMeta : book)),
  }
}

function resolveLevelTarget(options: {
  library: BookLibraryPayload
  level: PresentationDifficultyLevel
}): { bookId: string; bookFolder: string; title: string; series: string; role: string } {
  const existing = findPresentationLevelBook(options.library.books, options.level)
  if (existing) {
    const folder =
      resolveBookFolderForBook(existing) ||
      presentationLevelBookId(options.level)
    return {
      bookId: existing.id,
      bookFolder: folder,
      title: existing.title.trim() || options.level,
      series: existing.series?.trim() || PRESENTATIONS_SERIES,
      role: existing.role?.trim() || options.level,
    }
  }

  const shell = buildPresentationLevelBookShell(options.level)
  return {
    bookId: shell.id,
    bookFolder: shell.id,
    title: shell.title,
    series: PRESENTATIONS_SERIES,
    role: options.level,
  }
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Missing or empty file.' }, { status: 400 })
  }

  const originalName = 'name' in file && typeof file.name === 'string' ? file.name : ''
  const isPdfByName = originalName.toLowerCase().endsWith('.pdf')
  const mimeType = file.type.split(';')[0]?.trim().toLowerCase() ?? ''
  const isPdfByMime = mimeType === 'application/pdf'
  if (!isPdfByName && !isPdfByMime) {
    return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
  }

  const presentationLevel = normalizePresentationDifficultyLevel(form.get('presentationLevel'))
  const targetBookIdRaw = String(form.get('targetBookId') ?? '').trim()
  const asPresentationFlag = String(form.get('asPresentation') ?? '')
    .trim()
    .toLowerCase()
  const forcePresentation =
    asPresentationFlag === '1' ||
    asPresentationFlag === 'true' ||
    asPresentationFlag === 'yes' ||
    Boolean(presentationLevel)

  let library: BookLibraryPayload
  try {
    library = await loadBookLibrary()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load library.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  let uploadSeries: string
  let uploadTitle: string
  let uploadBookFolder: string
  let uploadBookId: string
  let uploadRole: string | undefined
  let uploadGrade: string | undefined
  let preferredPdfName: string
  let unitTitle: string | undefined
  let markAsPresentation = forcePresentation

  if (targetBookIdRaw) {
    const target = library.books.find((book) => book.id === targetBookIdRaw)
    if (!target) {
      return NextResponse.json({ error: 'Target book was not found.' }, { status: 404 })
    }
    const folder =
      resolveBookFolderForBook(target) ||
      buildCanonicalBookFolderName({
        series: target.series || PRESENTATIONS_SERIES,
        grade: target.grade,
        role: target.role,
        title: target.title,
        bookId: target.id,
      }) ||
      slugifyDiskSegment(target.id) ||
      'book'
    uploadBookId = target.id
    uploadBookFolder = folder
    uploadTitle = target.title
    uploadSeries = target.series?.trim() || PRESENTATIONS_SERIES
    uploadRole = target.role
    uploadGrade = target.grade
    markAsPresentation = target.contentFormat === 'presentation' || forcePresentation
    unitTitle = titleFromPresentationDeckFileName(originalName || 'deck.pdf')
    preferredPdfName = `${slugifyDiskSegment(originalName.replace(/\.pdf$/i, '')) || 'deck'}.pdf`
  } else if (presentationLevel) {
    const levelTarget = resolveLevelTarget({ library, level: presentationLevel })
    uploadBookId = levelTarget.bookId
    uploadBookFolder = levelTarget.bookFolder
    uploadTitle = levelTarget.title
    uploadSeries = levelTarget.series
    uploadRole = levelTarget.role
    markAsPresentation = true
    unitTitle = titleFromPresentationDeckFileName(originalName || 'deck.pdf')
    preferredPdfName = `${slugifyDiskSegment(originalName.replace(/\.pdf$/i, '')) || 'deck'}.pdf`
  } else {
    const naming = planBookUploadFromFileName(originalName || 'book.pdf')
    if (!naming) {
      return NextResponse.json(
        { error: 'Could not infer a valid book name from this filename.' },
        { status: 400 },
      )
    }

    markAsPresentation =
      forcePresentation ||
      looksLikePresentationCatalogName({
        title: naming.sourceStem,
        id: naming.bookId,
        folderName: naming.bookFolder,
      })

    uploadSeries = naming.series
    uploadTitle = naming.title
    uploadBookFolder = naming.bookFolder
    uploadBookId = naming.bookId
    uploadRole = naming.role
    uploadGrade = naming.grade
    preferredPdfName = naming.pdfFileName

    if (markAsPresentation) {
      const cleanedStemTitle = naming.sourceStem
        .replace(/[-_]+/g, ' ')
        .replace(/\b(presentation|presentations|slides?|deck|pptx?)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      uploadTitle =
        cleanedStemTitle || naming.sourceStem.replace(/[-_]+/g, ' ').trim() || naming.title

      if (!naming.series.trim() || naming.series === 'Other') {
        uploadSeries = PRESENTATIONS_SERIES
        uploadBookFolder = buildCanonicalBookFolderName({
          series: PRESENTATIONS_SERIES,
          grade: naming.grade,
          role: naming.role,
          title: uploadTitle,
          bookId: slugifyDiskSegment(naming.sourceStem) || 'presentation',
        })
        uploadBookId = uploadBookFolder
        preferredPdfName = buildCanonicalMainPdfFileName(uploadBookFolder)
      }
    }
  }

  const root = getBookLibraryRoot()
  const targetDir = path.resolve(root, uploadBookFolder)
  if (!targetDir.startsWith(root)) {
    return NextResponse.json({ error: 'Invalid target folder.' }, { status: 400 })
  }
  await mkdir(targetDir, { recursive: true })

  let fileName: string
  try {
    fileName = await allocateUniquePdfName(targetDir, preferredPdfName)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not allocate unique filename.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const absTargetFile = path.resolve(targetDir, fileName)
  if (!absTargetFile.startsWith(targetDir)) {
    return NextResponse.json({ error: 'Invalid target path.' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(absTargetFile, bytes)
  const filePath = `book-library/${uploadBookFolder}/${fileName}`.replaceAll('\\', '/')

  const nextLibrary = upsertUploadedBook({
    library,
    bookId: uploadBookId,
    bookFolder: uploadBookFolder,
    title: uploadTitle,
    series: uploadSeries,
    grade: uploadGrade,
    role: uploadRole,
    contentFormat: markAsPresentation ? 'presentation' : undefined,
    relativeFilePath: filePath,
    pdfFileName: fileName,
    unitTitle,
  })

  try {
    await saveBookLibraryManifest(nextLibrary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save library list.'
    return NextResponse.json(
      {
        ok: true,
        filePath,
        fileName,
        bookFolder: uploadBookFolder,
        warning: `${message} File was saved, but the library list was not updated.`,
      },
      { status: 200 },
    )
  }

  const savedBook = nextLibrary.books.find((book) => book.id === uploadBookId)

  return NextResponse.json({
    ok: true,
    filePath,
    fileName,
    bookFolder: uploadBookFolder,
    bookId: uploadBookId,
    title: savedBook?.title ?? uploadTitle,
    series: savedBook?.series ?? uploadSeries,
    grade: savedBook?.grade ?? uploadGrade ?? null,
    role: savedBook?.role ?? uploadRole ?? null,
    contentFormat: markAsPresentation ? 'presentation' : 'book',
    presentationLevel: presentationLevel,
    unitTitle: unitTitle ?? titleFromPdf(fileName),
    unitCount: savedBook?.units.length ?? null,
    library: nextLibrary,
  })
}
