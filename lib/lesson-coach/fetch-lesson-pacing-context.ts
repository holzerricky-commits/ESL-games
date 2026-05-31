import { buildPacingNotes, type LessonPacingContext } from '@/lib/lesson-coach/build-pacing-notes'
import type {
  BookContextRecord,
  LessonContextRecord,
  PartContextRecord,
  UnitContextRecord,
} from '@/lib/context/types'

export type FetchPacingNotesParams = {
  bookId: string
  unitId?: string | null
  lessonId?: string | null
  partId?: string | null
  bookTitle?: string | null
  unitTitle?: string | null
  lessonTitle?: string | null
  partTitle?: string | null
}

type ContextGetResponse = {
  ok?: boolean
  bookRecord?: BookContextRecord | null
  unit?: UnitContextRecord | null
  context?: LessonContextRecord | PartContextRecord | null
  units?: UnitContextRecord[]
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    const data = (await res.json()) as T
    return data
  } catch {
    return null
  }
}

/** Load book / unit / lesson / part context and format coach pacing notes. */
export async function fetchPacingNotesForLesson(
  params: FetchPacingNotesParams,
): Promise<string> {
  const { bookId, unitId, lessonId, partId } = params
  if (!bookId.trim()) return buildPacingNotes({})

  const ctx: LessonPacingContext = {
    bookTitle: params.bookTitle ?? undefined,
    unitTitle: params.unitTitle ?? undefined,
    lessonTitle: params.lessonTitle ?? undefined,
    partTitle: params.partTitle ?? undefined,
  }

  const bookQs = new URLSearchParams({ bookId })
  const bookData = await fetchJson<ContextGetResponse>(`/api/context/get?${bookQs}`)
  if (bookData?.ok && bookData.bookRecord) {
    ctx.book = bookData.bookRecord
  }

  if (unitId) {
    const unitQs = new URLSearchParams({ bookId, unitId })
    const unitData = await fetchJson<{
      ok?: boolean
      unit?: UnitContextRecord | null
    }>(`/api/context/get?${unitQs}`)
    if (unitData?.ok && unitData.unit) {
      ctx.unit = unitData.unit
    }
  }

  if (unitId && lessonId) {
    const lessonQs = new URLSearchParams({ bookId, unitId, lessonId })
    const lessonData = await fetchJson<ContextGetResponse>(
      `/api/context/get?${lessonQs}`,
    )
    if (lessonData?.ok && lessonData.context?.kind === 'lesson') {
      ctx.lesson = lessonData.context
    }
  }

  if (unitId && lessonId && partId) {
    const partQs = new URLSearchParams({ bookId, unitId, lessonId, partId })
    const partData = await fetchJson<ContextGetResponse>(
      `/api/context/get?${partQs}`,
    )
    if (partData?.ok && partData.context?.kind === 'part') {
      ctx.part = partData.context
      if (!ctx.partTitle && partData.context.partTitle) {
        ctx.partTitle = partData.context.partTitle
      }
    }
  }

  return buildPacingNotes(ctx)
}
