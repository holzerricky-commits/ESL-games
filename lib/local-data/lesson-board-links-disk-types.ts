/** Book page → lesson-board page links, keyed by `studentId::bookId::unitId`. */
export type LessonBoardLinksDiskPayload = {
  links: Record<string, unknown[]>
}

export function emptyLessonBoardLinksDiskPayload(): LessonBoardLinksDiskPayload {
  return { links: {} }
}

export function normalizeLessonBoardLinksDiskPayload(raw: unknown): LessonBoardLinksDiskPayload {
  const empty = emptyLessonBoardLinksDiskPayload()
  // Legacy browser shape: bare map of scope → links
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && !('links' in (raw as object))) {
    const links: Record<string, unknown[]> = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!key.trim()) continue
      links[key] = Array.isArray(value) ? value : []
    }
    return { links }
  }
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  const linksRaw = o.links
  if (!linksRaw || typeof linksRaw !== 'object' || Array.isArray(linksRaw)) return empty
  const links: Record<string, unknown[]> = {}
  for (const [key, value] of Object.entries(linksRaw as Record<string, unknown>)) {
    if (!key.trim()) continue
    links[key] = Array.isArray(value) ? value : []
  }
  return { links }
}

export function isLessonBoardLinksDiskPayloadEmpty(payload: LessonBoardLinksDiskPayload): boolean {
  return Object.values(payload.links).every((entries) => entries.length === 0)
}
