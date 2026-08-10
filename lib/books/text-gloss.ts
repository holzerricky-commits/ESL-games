import type { AnnotationCommand, TextGlossAnchor } from '@/lib/books/annotation-command-types'

export const TEXT_GLOSS_MAX_PER_COMMAND = 48
export const TEXT_GLOSS_SOURCE_MAX_CHARS = 120
export const TEXT_GLOSS_TRANSLATION_MAX_CHARS = 120

export type GlossTextSegment = {
  text: string
  gloss?: TextGlossAnchor
}

export type AppendTextGlossParams = {
  commandId: string
  start: number
  end: number
  source: string
  chinese: string
  pinyin: string
}

export function newTextGlossId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `gloss-${crypto.randomUUID().slice(0, 8)}`
  }
  return `gloss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function normalizeTextGlossRange(start: number, end: number): { start: number; end: number } {
  const a = Math.max(0, Math.floor(start))
  const b = Math.max(0, Math.floor(end))
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

export function sanitizeTextGlosses(raw: unknown): TextGlossAnchor[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: TextGlossAnchor[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim().slice(0, 64) : newTextGlossId()
    if (typeof rec.start !== 'number' || typeof rec.end !== 'number') continue
    const { start, end } = normalizeTextGlossRange(rec.start, rec.end)
    if (end <= start) continue
    const source =
      typeof rec.source === 'string' ? rec.source.trim().slice(0, TEXT_GLOSS_SOURCE_MAX_CHARS) : ''
    const chinese =
      typeof rec.chinese === 'string' ? rec.chinese.trim().slice(0, TEXT_GLOSS_TRANSLATION_MAX_CHARS) : ''
    if (!source || !chinese) continue
    const pinyin =
      typeof rec.pinyin === 'string' ? rec.pinyin.trim().slice(0, TEXT_GLOSS_TRANSLATION_MAX_CHARS) : ''
    out.push({ id, start, end, source, chinese, pinyin })
    if (out.length >= TEXT_GLOSS_MAX_PER_COMMAND) break
  }
  return out.length > 0 ? out : undefined
}

export function pruneInvalidTextGlosses(
  text: string,
  glosses: readonly TextGlossAnchor[],
): TextGlossAnchor[] {
  return glosses.filter((g) => {
    if (g.start < 0 || g.end <= g.start || g.end > text.length) return false
    const slice = text.slice(g.start, g.end)
    return slice === g.source || slice.trim() === g.source.trim()
  })
}

/** Shift gloss indices after leading trim on text labels. */
export function reconcileTextGlossesAfterTrim(
  raw: string,
  trimmed: string,
  glosses: readonly TextGlossAnchor[],
): TextGlossAnchor[] {
  if (!glosses.length) return []
  const leadingTrim = raw.length - raw.trimStart().length
  if (raw.trim() !== trimmed) {
    return pruneInvalidTextGlosses(trimmed, glosses)
  }
  return pruneInvalidTextGlosses(
    trimmed,
    glosses.map((g) => ({
      ...g,
      start: g.start - leadingTrim,
      end: g.end - leadingTrim,
    })),
  )
}

/** Drop glosses that extend past trailing trim on stickies. */
export function reconcileTextGlossesAfterTrimEnd(
  raw: string,
  trimmed: string,
  glosses: readonly TextGlossAnchor[],
): TextGlossAnchor[] {
  if (!glosses.length) return []
  if (raw === trimmed) return pruneInvalidTextGlosses(trimmed, glosses)
  return pruneInvalidTextGlosses(
    trimmed,
    glosses.filter((g) => g.end <= trimmed.length),
  )
}

export function upsertTextGloss(
  glosses: readonly TextGlossAnchor[],
  incoming: Omit<TextGlossAnchor, 'id'> & { id?: string },
): TextGlossAnchor[] {
  const { start, end } = normalizeTextGlossRange(incoming.start, incoming.end)
  const withoutSameRange = glosses.filter((g) => !(g.start === start && g.end === end))
  const next: TextGlossAnchor = {
    id: incoming.id ?? newTextGlossId(),
    start,
    end,
    source: incoming.source,
    chinese: incoming.chinese,
    pinyin: incoming.pinyin,
  }
  return [...withoutSameRange, next].slice(-TEXT_GLOSS_MAX_PER_COMMAND)
}

export function buildGlossTextSegments(
  text: string,
  glosses: readonly TextGlossAnchor[] | undefined,
): GlossTextSegment[] {
  if (!text) return [{ text: '' }]
  if (!glosses?.length) return [{ text }]
  const valid = pruneInvalidTextGlosses(text, glosses)
  if (!valid.length) return [{ text }]
  const sorted = [...valid].sort((a, b) => a.start - b.start || a.end - b.end)
  const segments: GlossTextSegment[] = []
  let cursor = 0
  for (const gloss of sorted) {
    if (gloss.end <= cursor) continue
    if (gloss.start > cursor) {
      segments.push({ text: text.slice(cursor, gloss.start) })
    }
    const segStart = Math.max(gloss.start, cursor)
    segments.push({ text: text.slice(segStart, gloss.end), gloss })
    cursor = gloss.end
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) })
  }
  return segments.length > 0 ? segments : [{ text }]
}

export function appendTextGlossToCommands(
  commands: readonly AnnotationCommand[],
  params: AppendTextGlossParams,
): AnnotationCommand[] {
  const { start, end } = normalizeTextGlossRange(params.start, params.end)
  const source = params.source.trim().slice(0, TEXT_GLOSS_SOURCE_MAX_CHARS)
  const chinese = params.chinese.trim().slice(0, TEXT_GLOSS_TRANSLATION_MAX_CHARS)
  const pinyin = params.pinyin.trim().slice(0, TEXT_GLOSS_TRANSLATION_MAX_CHARS)
  if (!source || !chinese) return [...commands]

  let changed = false
  const next = commands.map((cmd) => {
    if (cmd.id !== params.commandId) return cmd
    if (cmd.kind !== 'text' && cmd.kind !== 'sticky') return cmd
    const glosses = upsertTextGloss(cmd.glosses ?? [], {
      start,
      end,
      source,
      chinese,
      pinyin,
    })
    changed = true
    return { ...cmd, glosses }
  })
  if (!changed) return commands as AnnotationCommand[]
  return next
}

export function commitTextGlossesForLabel(
  raw: string,
  trimmed: string,
  glosses: readonly TextGlossAnchor[] | undefined,
): TextGlossAnchor[] | undefined {
  if (!glosses?.length) return undefined
  const next = reconcileTextGlossesAfterTrim(raw, trimmed, glosses)
  return next.length > 0 ? next : undefined
}

export function commitTextGlossesForSticky(
  raw: string,
  trimmed: string,
  glosses: readonly TextGlossAnchor[] | undefined,
): TextGlossAnchor[] | undefined {
  if (!glosses?.length) return undefined
  const next = reconcileTextGlossesAfterTrimEnd(raw, trimmed, glosses)
  return next.length > 0 ? next : undefined
}
