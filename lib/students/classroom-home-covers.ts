/** Cover fields the classroom-home start screen needs for Continue vs Open. */
export interface ClassroomHomeCoverLike {
  bookId: string
  isTodayPlan?: boolean
  lastStopLabel?: string
  unitLabel?: string
  lessonLabel?: string
}

export function classroomHomeCoverAction(
  cover: Pick<ClassroomHomeCoverLike, 'isTodayPlan' | 'lastStopLabel'>,
): 'Continue' | 'Open' {
  if (cover.isTodayPlan || cover.lastStopLabel?.trim()) return 'Continue'
  return 'Open'
}

/** Unit · lesson · page — skip empty bits. */
export function classroomHomeCoverMeta(
  cover: Pick<ClassroomHomeCoverLike, 'unitLabel' | 'lessonLabel' | 'lastStopLabel'>,
): string | null {
  const bits = [cover.unitLabel, cover.lessonLabel, cover.lastStopLabel]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  if (bits.length === 0) return null
  const unique: string[] = []
  const seen = new Set<string>()
  for (const bit of bits) {
    const key = bit.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(bit)
  }
  return unique.join(' · ')
}

/**
 * First non-empty lesson/part/title that is not the same as the unit name.
 */
export function classroomHomeLessonLabel(input: {
  unitLabel?: string | null
  lessonTitle?: string | null
  partTitle?: string | null
  title?: string | null
}): string | undefined {
  const unitKey = input.unitLabel?.trim().toLowerCase() ?? ''
  for (const raw of [input.lessonTitle, input.partTitle, input.title]) {
    const value = raw?.trim()
    if (!value) continue
    if (unitKey && value.toLowerCase() === unitKey) continue
    return value
  }
  return undefined
}

/**
 * Today’s book (or the only book) is featured; others sit beside it on the shelf.
 * Equal row when several books and none is marked as today’s plan.
 */
export function splitClassroomHomeCovers<T extends ClassroomHomeCoverLike>(
  covers: T[],
): { featured: T | null; others: T[] } {
  if (covers.length === 0) return { featured: null, others: [] }
  const today = covers.find((cover) => cover.isTodayPlan)
  if (today) {
    return {
      featured: today,
      others: covers.filter((cover) => cover.bookId !== today.bookId),
    }
  }
  if (covers.length === 1) {
    return { featured: covers[0] ?? null, others: [] }
  }
  return { featured: null, others: covers }
}
