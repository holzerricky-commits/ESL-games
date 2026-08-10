import { resolveBookFolderForBook } from '@/lib/books/book-cover-path'
import {
  DEFAULT_BOOK_SERIES,
  formatBookDisplayTitle,
  inferBookCatalogLabels,
  resolveBookCatalogIdentity,
} from '@/lib/books/book-catalog-labels'
import type { BookRecord } from '@/lib/books/types'

/** Safe folder/file segment: lowercase ascii kebab. */
export function slugifyDiskSegment(raw: string): string {
  const normalized = raw.normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
  return normalized
    .toLowerCase()
    .trim()
    .replace(/['".,()[\]{}!@#$%^&*+=;:`~?<>\\/|]+/g, ' ')
    .replace(/[_\s-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function seriesSlug(series: string): string {
  const s = series.trim() || DEFAULT_BOOK_SERIES
  const known: Record<string, string> = {
    Journeys: 'journeys',
    Wonders: 'wonders',
    HKMKC: 'hkmkc',
    Presentations: 'presentations',
    Other: 'other',
  }
  return known[s] ?? (slugifyDiskSegment(s) || 'other')
}

function gradeSlug(grade: string | undefined): string | null {
  if (!grade?.trim()) return null
  const g = grade.trim()
  if (g === 'K') return 'k'
  const m = g.match(/^G([1-6])$/i)
  if (m) return `g${m[1]}`
  return slugifyDiskSegment(g) || null
}

function roleFolderSlug(role: string | undefined, title: string, bookId: string): string | null {
  const r = role?.trim() ?? ''
  if (r === 'Workshop') return 'workshop'
  if (r === 'Literature') return 'literature'
  if (r === 'Teacher guide') return 'teacher-guide'
  if (r === 'Starter') return 'starter'
  if (r === 'Basic') return 'basic'
  if (r === 'Intermediate') return 'intermediate'
  if (r === 'Hard') return 'hard'

  const haystack = `${title} ${bookId}`.toLowerCase().replace(/[_-]+/g, ' ')
  const bookNum = haystack.match(/\bbook\s*([1-9]\d*)\b/)
  if (bookNum?.[1]) return `book-${bookNum[1]}`
  if (r === 'Student book') return 'student'
  return null
}

/** Canonical folder under book-library, e.g. journeys-g3-book-1 */
export function buildCanonicalBookFolderName(input: {
  series: string
  grade?: string
  role?: string
  title: string
  bookId: string
}): string {
  const parts = [seriesSlug(input.series)]
  const grade = gradeSlug(input.grade)
  if (grade) parts.push(grade)
  const rolePart = roleFolderSlug(input.role, input.title, input.bookId)
  if (rolePart) parts.push(rolePart)
  return parts.join('-') || 'book'
}

/**
 * Main PDF filename when the book has a single PDF file.
 * Matches the folder slug so the file stays recognizable if moved out of its folder.
 */
export function buildCanonicalMainPdfFileName(folderSlug: string): string {
  const stem = slugifyDiskSegment(folderSlug) || 'book'
  return `${stem}.pdf`
}

/** Strip trailing unit/lesson/chapter/part noise from a download filename stem. */
export function stripUnitSuffixFromFileStem(stem: string): string {
  const stripped =
    stem
      .replace(/\s*[-_]\s*(unit|lesson|chapter|part)\b.*$/i, '')
      .replace(/\s+(unit|lesson|chapter|part)\b.*$/i, '') || stem
  return stripped.trim() || stem.trim()
}

export interface BookUploadNamingPlan {
  originalFileName: string
  sourceStem: string
  series: string
  grade?: string
  role?: string
  title: string
  bookFolder: string
  pdfFileName: string
  /** Suggested stable book id (same as folder slug). */
  bookId: string
  relativeFilePath: string
}

/**
 * Guess series/grade/role from a PDF filename and produce clean disk names.
 * Does not touch the filesystem.
 */
export function planBookUploadFromFileName(originalFileName: string): BookUploadNamingPlan | null {
  const rawName = originalFileName.trim()
  if (!rawName) return null
  const stem = stripUnitSuffixFromFileStem(rawName.replace(/\.pdf$/i, ''))
  if (!stem.trim()) return null

  const inferred = inferBookCatalogLabels({
    title: stem,
    id: slugifyDiskSegment(stem),
    folderName: slugifyDiskSegment(stem),
  })

  const bookFolder = buildCanonicalBookFolderName({
    series: inferred.series,
    grade: inferred.grade,
    role: inferred.role,
    title: stem,
    bookId: slugifyDiskSegment(stem),
  })
  if (!bookFolder) return null

  const pdfFileName = buildCanonicalMainPdfFileName(bookFolder)
  const title = formatBookDisplayTitle({
    series: inferred.series,
    grade: inferred.grade,
    role: inferred.role,
  })

  return {
    originalFileName: rawName,
    sourceStem: stem,
    series: inferred.series,
    ...(inferred.grade ? { grade: inferred.grade } : {}),
    ...(inferred.role ? { role: inferred.role } : {}),
    title,
    bookFolder,
    pdfFileName,
    bookId: bookFolder,
    relativeFilePath: `book-library/${bookFolder}/${pdfFileName}`,
  }
}

export interface BookDiskFileRename {
  fromRelative: string
  toRelative: string
  fromFileName: string
  toFileName: string
}

export interface BookDiskCleanupPlan {
  bookId: string
  currentFolder: string | null
  targetFolder: string
  folderNeedsRename: boolean
  fileRenames: BookDiskFileRename[]
  alreadyClean: boolean
  /** Human lines for preview UI */
  summaryLines: string[]
}

function uniqueUnitPdfPaths(book: BookRecord): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const unit of book.units) {
    const fp = unit.filePath.replaceAll('\\', '/')
    if (!fp || seen.has(fp)) continue
    seen.add(fp)
    out.push(fp)
  }
  return out
}

/**
 * Preview disk cleanup for a book from its catalog identity.
 * Does not touch the filesystem. Never changes book.id.
 */
export function planBookDiskCleanup(book: BookRecord): BookDiskCleanupPlan {
  const identity = resolveBookCatalogIdentity(book)
  const currentFolder = resolveBookFolderForBook(book)
  const targetFolder = buildCanonicalBookFolderName({
    series: identity.series,
    grade: identity.grade,
    role: identity.role,
    title: identity.title || book.title,
    bookId: book.id,
  })

  const folderNeedsRename = Boolean(currentFolder && currentFolder !== targetFolder)
  const pdfPaths = uniqueUnitPdfPaths(book)
  const fileRenames: BookDiskFileRename[] = []

  if (pdfPaths.length === 1) {
    const fromRelative = pdfPaths[0]!
    const fromFileName = fromRelative.split('/').pop() ?? 'book.pdf'
    const toFileName = buildCanonicalMainPdfFileName(targetFolder)
    const toRelative = `book-library/${targetFolder}/${toFileName}`
    if (fromRelative !== toRelative) {
      fileRenames.push({ fromRelative, toRelative, fromFileName, toFileName })
    }
  } else if (pdfPaths.length > 1) {
    pdfPaths.forEach((fromRelative, index) => {
      const fromFileName = fromRelative.split('/').pop() ?? `unit-${index + 1}.pdf`
      const toFileName = `unit-${String(index + 1).padStart(2, '0')}.pdf`
      const toRelative = `book-library/${targetFolder}/${toFileName}`
      if (fromRelative !== toRelative) {
        fileRenames.push({ fromRelative, toRelative, fromFileName, toFileName })
      }
    })
  }

  // Cover path rewrite is handled when rewriting book record (same folder move).

  const alreadyClean = !folderNeedsRename && fileRenames.length === 0
  const summaryLines: string[] = []
  if (!currentFolder) {
    summaryLines.push('No book folder found on disk yet.')
  } else if (folderNeedsRename) {
    summaryLines.push(`Folder: ${currentFolder} → ${targetFolder}`)
  } else {
    summaryLines.push(`Folder: ${currentFolder} (already clean)`)
  }
  for (const rename of fileRenames) {
    summaryLines.push(`PDF: ${rename.fromFileName} → ${rename.toFileName}`)
  }
  if (alreadyClean) {
    summaryLines.push('Nothing to rename.')
  }

  return {
    bookId: book.id,
    currentFolder,
    targetFolder,
    folderNeedsRename,
    fileRenames,
    alreadyClean,
    summaryLines,
  }
}

function remapLibraryPath(
  filePath: string,
  plan: BookDiskCleanupPlan,
  pathMap: Map<string, string>,
): string {
  const normalized = filePath.replaceAll('\\', '/')
  if (pathMap.has(normalized)) return pathMap.get(normalized)!

  if (plan.currentFolder && plan.folderNeedsRename) {
    const prefix = `book-library/${plan.currentFolder}/`
    if (normalized.startsWith(prefix)) {
      return `book-library/${plan.targetFolder}/${normalized.slice(prefix.length)}`
    }
  }
  return normalized
}

function remapPathRecord<T>(
  record: Record<string, T> | undefined,
  plan: BookDiskCleanupPlan,
  pathMap: Map<string, string>,
): Record<string, T> | undefined {
  if (!record) return undefined
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    next[remapLibraryPath(key, plan, pathMap)] = value
  }
  return next
}

/**
 * Rewrite all path fields on a book after a planned disk cleanup.
 * Preserves book.id.
 */
export function applyDiskCleanupPlanToBook(book: BookRecord, plan: BookDiskCleanupPlan): BookRecord {
  if (book.id !== plan.bookId) return book

  const pathMap = new Map<string, string>()
  for (const rename of plan.fileRenames) {
    pathMap.set(rename.fromRelative.replaceAll('\\', '/'), rename.toRelative)
    // Also map intermediate (folder renamed, same file name) then final
    if (plan.currentFolder && plan.folderNeedsRename) {
      const mid = rename.fromRelative.replace(
        `book-library/${plan.currentFolder}/`,
        `book-library/${plan.targetFolder}/`,
      )
      pathMap.set(mid.replaceAll('\\', '/'), rename.toRelative)
    }
  }

  const units = book.units.map((unit) => ({
    ...unit,
    filePath: remapLibraryPath(unit.filePath, plan, pathMap),
  }))

  const next: BookRecord = {
    ...book,
    units,
  }

  const pageAlignmentByFile = remapPathRecord(book.pageAlignmentByFile, plan, pathMap)
  if (pageAlignmentByFile) next.pageAlignmentByFile = pageAlignmentByFile
  else delete next.pageAlignmentByFile

  const spreadGutterByFile = remapPathRecord(book.spreadGutterByFile, plan, pathMap)
  if (spreadGutterByFile) next.spreadGutterByFile = spreadGutterByFile
  else delete next.spreadGutterByFile

  if (book.coverImagePath) {
    next.coverImagePath = remapLibraryPath(book.coverImagePath, plan, pathMap)
  }

  return next
}
