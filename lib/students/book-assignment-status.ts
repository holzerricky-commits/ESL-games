import type { StudentBookAssignmentStatus } from '@/lib/types'

export type StudentBookAssignmentStatusMap = Record<string, StudentBookAssignmentStatus>

const STATUSES = new Set<StudentBookAssignmentStatus>(['in_class', 'paused', 'finished'])

export function sanitizeBookAssignmentStatus(raw: unknown): StudentBookAssignmentStatusMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: StudentBookAssignmentStatusMap = {}
  for (const [rawId, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = rawId.trim()
    if (!id || typeof value !== 'string' || !STATUSES.has(value as StudentBookAssignmentStatus)) continue
    out[id] = value as StudentBookAssignmentStatus
  }
  return out
}

/** Missing and unknown values stay in class so existing assignments do not move. */
export function bookAssignmentStatusFor(
  status: StudentBookAssignmentStatusMap | null | undefined,
  bookId: string,
): StudentBookAssignmentStatus {
  const id = bookId.trim()
  if (!id) return 'in_class'
  const value = status?.[id]
  if (value === 'paused' || value === 'finished' || value === 'in_class') return value
  return 'in_class'
}

/** Assigned order, keeping only books that still belong on the class desk. */
export function inClassBookIds(
  assignedBookIds: readonly string[] | null | undefined,
  status: StudentBookAssignmentStatusMap | null | undefined,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of assignedBookIds ?? []) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    if (bookAssignmentStatusFor(status, id) === 'in_class') out.push(id)
  }
  return out
}

export function bookSeriesGradeKey(
  book: { series?: string | null; grade?: string | null } | null | undefined,
): string | null {
  const series = book?.series?.trim() ?? ''
  const grade = book?.grade?.trim() ?? ''
  if (!series || !grade) return null
  return `${series}\u001f${grade}`
}

/** Teacher-facing series and grade, for example "Journeys G3". */
export function bookSeriesGradeLabel(
  book: { series?: string | null; grade?: string | null } | null | undefined,
): string | null {
  const series = book?.series?.trim() ?? ''
  const grade = book?.grade?.trim() ?? ''
  if (!series || !grade) return null
  return `${series} ${grade}`
}

/**
 * Other in-class books that share this book's series and grade.
 * Books missing either label are not grouped.
 */
export function inClassSiblingBookIds(args: {
  books: readonly { id: string; series?: string | null; grade?: string | null }[]
  assignedBookIds: readonly string[]
  status: StudentBookAssignmentStatusMap | null | undefined
  bookId: string
}): string[] {
  const sourceId = args.bookId.trim()
  const source = args.books.find((book) => book.id === sourceId)
  const key = bookSeriesGradeKey(source)
  if (!key) return []
  return inClassBookIds(args.assignedBookIds, args.status).filter((id) => {
    if (id === sourceId) return false
    const book = args.books.find((item) => item.id === id)
    return bookSeriesGradeKey(book) === key
  })
}

/** Drop removed books. In-class stays unset so new books default to the desk. */
export function pruneBookAssignmentStatus(
  status: StudentBookAssignmentStatusMap | null | undefined,
  assignedBookIds: readonly string[],
): StudentBookAssignmentStatusMap | undefined {
  const allowed = new Set(assignedBookIds.map((id) => id.trim()).filter(Boolean))
  const next: StudentBookAssignmentStatusMap = {}
  for (const [id, value] of Object.entries(sanitizeBookAssignmentStatus(status))) {
    if (!allowed.has(id) || value === 'in_class') continue
    next[id] = value
  }
  return Object.keys(next).length > 0 ? next : undefined
}
