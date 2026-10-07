/** studentId → bookId → unitId → pageKey → commands (shape matches BookAnnotationsRoot). */
export type BookAnnotationsDiskRoot = Record<
  string,
  Record<string, Record<string, Record<string, unknown[]>>>
>

/** On-disk payload for book marks (page ink + live session checkpoints). */
export type BookAnnotationsDiskPayload = {
  annotations: BookAnnotationsDiskRoot
  spreadSessions: Record<string, unknown>
  whiteboardSessions: Record<string, unknown>
}

export function emptyBookAnnotationsDiskPayload(): BookAnnotationsDiskPayload {
  return {
    annotations: {},
    spreadSessions: {},
    whiteboardSessions: {},
  }
}

export function normalizeBookAnnotationsDiskPayload(raw: unknown): BookAnnotationsDiskPayload {
  const empty = emptyBookAnnotationsDiskPayload()
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  const annotations =
    o.annotations && typeof o.annotations === 'object' && !Array.isArray(o.annotations)
      ? (o.annotations as BookAnnotationsDiskRoot)
      : empty.annotations
  const spreadSessions =
    o.spreadSessions && typeof o.spreadSessions === 'object' && !Array.isArray(o.spreadSessions)
      ? (o.spreadSessions as Record<string, unknown>)
      : empty.spreadSessions
  const whiteboardSessions =
    o.whiteboardSessions &&
    typeof o.whiteboardSessions === 'object' &&
    !Array.isArray(o.whiteboardSessions)
      ? (o.whiteboardSessions as Record<string, unknown>)
      : empty.whiteboardSessions
  return { annotations, spreadSessions, whiteboardSessions }
}

export function isBookAnnotationsDiskPayloadEmpty(payload: BookAnnotationsDiskPayload): boolean {
  return (
    Object.keys(payload.annotations).length === 0 &&
    Object.keys(payload.spreadSessions).length === 0 &&
    Object.keys(payload.whiteboardSessions).length === 0
  )
}

/** Rough ink richness for preferring browser vs disk session docs after a refresh race. */
export function scoreInkSessionDocRichness(doc: unknown): number {
  if (!doc || typeof doc !== 'object') return 0
  const d = doc as { pages?: unknown; commands?: unknown }
  const pages = Array.isArray(d.pages) ? d.pages : []
  let pageInk = 0
  for (const page of pages) {
    if (!page || typeof page !== 'object') continue
    const commands = (page as { commands?: unknown }).commands
    if (Array.isArray(commands)) pageInk += commands.length
  }
  const rootInk = Array.isArray(d.commands) ? d.commands.length : 0
  return pages.length * 10_000 + pageInk * 10 + rootInk
}

/**
 * Prefer the richer doc per id (disk vs browser mirror), so a unfinished disk write
 * does not wipe notes that already made it into localStorage.
 */
export function mergeRichestInkSessionMaps(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
): { map: Record<string, unknown>; changed: boolean } {
  let changed = false
  const out: Record<string, unknown> = { ...primary }
  for (const [id, secondaryDoc] of Object.entries(secondary)) {
    const primaryDoc = out[id]
    if (!primaryDoc) {
      out[id] = secondaryDoc
      changed = true
      continue
    }
    if (scoreInkSessionDocRichness(secondaryDoc) > scoreInkSessionDocRichness(primaryDoc)) {
      out[id] = secondaryDoc
      changed = true
    }
  }
  return { map: changed ? out : primary, changed }
}

/** Command-list length for preferring browser vs disk page marks after a refresh race. */
export function scoreAnnotationPageRichness(commands: unknown): number {
  return Array.isArray(commands) ? commands.length : 0
}

/**
 * Prefer the richer page array per student/book/unit/pageKey so a hydrate that
 * already has whiteboard/spread data cannot drop page marks still only in the browser.
 */
export function mergeRichestAnnotationRoots(
  primary: BookAnnotationsDiskRoot,
  secondary: BookAnnotationsDiskRoot,
): { root: BookAnnotationsDiskRoot; changed: boolean } {
  let changed = false
  let out: BookAnnotationsDiskRoot | null = null

  const ensureOut = (): BookAnnotationsDiskRoot => {
    if (!out) out = { ...primary }
    return out
  }

  for (const [studentId, books] of Object.entries(secondary)) {
    if (!books || typeof books !== 'object' || Array.isArray(books)) continue
    for (const [bookId, units] of Object.entries(books)) {
      if (!units || typeof units !== 'object' || Array.isArray(units)) continue
      for (const [unitId, pages] of Object.entries(units)) {
        if (!pages || typeof pages !== 'object' || Array.isArray(pages)) continue
        for (const [pageKey, commands] of Object.entries(pages)) {
          const primaryCommands = primary[studentId]?.[bookId]?.[unitId]?.[pageKey]
          const secondaryScore = scoreAnnotationPageRichness(commands)
          const primaryScore = scoreAnnotationPageRichness(primaryCommands)
          if (primaryScore >= secondaryScore) continue
          const root = ensureOut()
          const student = { ...(root[studentId] ?? {}) }
          const book = { ...(student[bookId] ?? {}) }
          const unit = { ...(book[unitId] ?? {}) }
          unit[pageKey] = commands as unknown[]
          book[unitId] = unit
          student[bookId] = book
          root[studentId] = student
          changed = true
        }
      }
    }
  }

  return { root: out ?? primary, changed }
}

/** Merge browser safety-net ink into a disk payload when browser has newer board/spread/page ink. */
export function mergeBrowserInkSafetyNetIntoPayload(
  disk: BookAnnotationsDiskPayload,
  browser: BookAnnotationsDiskPayload,
): { payload: BookAnnotationsDiskPayload; changed: boolean } {
  const annotations = mergeRichestAnnotationRoots(disk.annotations, browser.annotations)
  const whiteboard = mergeRichestInkSessionMaps(disk.whiteboardSessions, browser.whiteboardSessions)
  const spread = mergeRichestInkSessionMaps(disk.spreadSessions, browser.spreadSessions)
  const changed = annotations.changed || whiteboard.changed || spread.changed
  if (!changed) return { payload: disk, changed: false }
  return {
    payload: {
      annotations: annotations.root,
      whiteboardSessions: whiteboard.map,
      spreadSessions: spread.map,
    },
    changed: true,
  }
}
