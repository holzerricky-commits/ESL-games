import {
  createEmptyReadingCheckQuestion,
  createEmptyReadingCheckStop,
  resolveReadingCheckEvidence,
  type ReadingCheckQuestion,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'

/** Default upper bound when AI returns more stops than expected. */
export const DEFAULT_PARSE_STOPS_MAX = 12

export type ParseStopsFromAiOptions = {
  maxStops?: number
}

/** Parse AI JSON into reading-check stops (shared by Gemini draft + tests). */
export function parseStopsFromAi(
  parsed: unknown,
  options: ParseStopsFromAiOptions = {},
): ReadingCheckStop[] {
  const maxStops = Math.max(1, Math.floor(options.maxStops ?? DEFAULT_PARSE_STOPS_MAX))
  if (!parsed || typeof parsed !== 'object') return []
  const rows = (parsed as { stops?: unknown }).stops
  if (!Array.isArray(rows)) return []
  const out: ReadingCheckStop[] = []

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const label = typeof r.label === 'string' ? r.label.trim() : ''
    const displayPage =
      typeof r.displayPage === 'number' && Number.isFinite(r.displayPage) && r.displayPage >= 1
        ? Math.floor(r.displayPage)
        : null
    const midPageNote =
      typeof r.midPageNote === 'string' && r.midPageNote.trim() ? r.midPageNote.trim() : null

    const qRaw = r.question
    if (!qRaw || typeof qRaw !== 'object') continue
    const q = qRaw as Record<string, unknown>
    const kind = q.kind === 'mcq' ? 'mcq' : q.kind === 'true_false' ? 'true_false' : null
    if (!kind) continue
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : ''
    if (!prompt) continue

    const evidence = resolveReadingCheckEvidence(
      typeof q.evidenceSnippet === 'string' ? q.evidenceSnippet : null,
      typeof q.evidenceHighlight === 'string' ? q.evidenceHighlight : null,
    )

    let question: ReadingCheckQuestion
    if (kind === 'mcq') {
      const choicesRaw = Array.isArray(q.choices) ? q.choices : []
      const choices = choicesRaw.map((c) => (typeof c === 'string' ? c.trim() : '')).slice(0, 4)
      while (choices.length < 4) choices.push('')
      let correctIndex =
        typeof q.correctIndex === 'number' && Number.isFinite(q.correctIndex)
          ? Math.floor(q.correctIndex)
          : 0
      if (correctIndex < 0 || correctIndex > 3) correctIndex = 0
      question = {
        ...createEmptyReadingCheckQuestion('mcq'),
        prompt,
        choices,
        correctIndex,
        evidenceSnippet: evidence.evidenceSnippet,
        evidenceHighlight: evidence.evidenceHighlight,
      }
    } else {
      question = {
        ...createEmptyReadingCheckQuestion('true_false'),
        prompt,
        correctTrue: typeof q.correctTrue === 'boolean' ? q.correctTrue : true,
        evidenceSnippet: evidence.evidenceSnippet,
        evidenceHighlight: evidence.evidenceHighlight,
      }
    }

    const stop = createEmptyReadingCheckStop(displayPage, kind)
    out.push({
      ...stop,
      label: label || `Check ${out.length + 1}`,
      midPageNote,
      questions: [question],
    })
    if (out.length >= maxStops) break
  }
  return out
}
