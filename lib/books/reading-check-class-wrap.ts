import type { ReadingCheckPack } from '@/lib/books/reading-check-pack'
import {
  formatReadingCheckWrapLine,
  listReadingCheckLiveMarks,
  summarizeReadingCheckLiveMarksForClass,
  type ReadingCheckClassWrapSummary,
} from '@/lib/books/reading-check-live-marks'

/** Load check packs for story ids (fail soft). Client-only. */
export async function fetchReadingCheckPacksByStoryIds(
  storyIds: string[],
): Promise<Record<string, ReadingCheckPack>> {
  const unique = [...new Set(storyIds.map((id) => id.trim()).filter(Boolean))]
  const out: Record<string, ReadingCheckPack> = {}
  await Promise.all(
    unique.map(async (storyId) => {
      try {
        const res = await fetch(`/api/reading-stories/checks?storyId=${encodeURIComponent(storyId)}`)
        const data = (await res.json()) as { ok?: boolean; pack?: ReadingCheckPack | null }
        if (data.ok && data.pack) out[storyId] = data.pack
      } catch {
        // ignore — summary works without totals
      }
    }),
  )
  return out
}

/** Build end-of-class wrap summary (+ optional teacher line) for one live session. */
export async function buildReadingCheckClassWrapSummary(opts: {
  classSessionId: string
  studentId: string
}): Promise<{ summary: ReadingCheckClassWrapSummary; wrapLine: string | undefined }> {
  const classSessionId = opts.classSessionId.trim()
  const studentId = opts.studentId.trim()
  const storyIds = [
    ...new Set(
      listReadingCheckLiveMarks()
        .filter((m) => (m.classSessionId?.trim() || '') === classSessionId)
        .filter((m) => !studentId || (m.studentId?.trim() || '') === studentId)
        .map((m) => m.storyId),
    ),
  ]
  const packsByStoryId = await fetchReadingCheckPacksByStoryIds(storyIds)
  const summary = summarizeReadingCheckLiveMarksForClass({
    classSessionId,
    studentId,
    packsByStoryId,
  })
  return { summary, wrapLine: formatReadingCheckWrapLine(summary) }
}
