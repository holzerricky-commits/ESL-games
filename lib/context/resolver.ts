export type LessonRangeSource = 'saved' | 'auto' | 'fallback'

export interface ContextRangeOption {
  bookId: string
  unitId: string
  lessonId?: string
  id: string
  startPageHint?: number
  endPageHint?: number
}

export interface LessonRangeOverride {
  startPage: number
  endPage: number
}

export interface CanonicalLessonRange {
  key: string
  source: LessonRangeSource
  startPage: number
  endPage: number
}

export function createLessonRangeKey(selected: Pick<ContextRangeOption, 'bookId' | 'unitId' | 'lessonId' | 'id'>): string {
  return `${selected.bookId}::${selected.unitId}::${selected.lessonId ?? selected.id}`
}

export function deriveAutoLessonRange(
  options: ContextRangeOption[],
  selected: ContextRangeOption,
): CanonicalLessonRange {
  const key = createLessonRangeKey(selected)
  const lessonId = selected.lessonId
  if (lessonId) {
    const lessonOptions = options.filter(
      (option) =>
        option.bookId === selected.bookId &&
        option.unitId === selected.unitId &&
        option.lessonId === lessonId &&
        Number.isFinite(option.startPageHint) &&
        Number.isFinite(option.endPageHint),
    )
    if (lessonOptions.length > 0) {
      const starts = lessonOptions.map((option) => Number(option.startPageHint))
      const ends = lessonOptions.map((option) => Number(option.endPageHint))
      const startPage = Math.max(1, Math.min(...starts))
      const endPage = Math.max(startPage, Math.max(...ends))
      return { key, source: 'auto', startPage, endPage }
    }
  }
  const startPage = Math.max(1, selected.startPageHint ?? 1)
  const endPage = Math.max(startPage, selected.endPageHint ?? startPage)
  return { key, source: 'fallback', startPage, endPage }
}

export function resolveCanonicalLessonRange(
  options: ContextRangeOption[],
  selected: ContextRangeOption,
  override?: LessonRangeOverride | null,
): CanonicalLessonRange {
  const auto = deriveAutoLessonRange(options, selected)
  if (!override) return auto
  const startPage = Math.max(1, Math.floor(override.startPage))
  const endPage = Math.max(startPage, Math.floor(override.endPage))
  return {
    key: auto.key,
    source: 'saved',
    startPage,
    endPage,
  }
}
