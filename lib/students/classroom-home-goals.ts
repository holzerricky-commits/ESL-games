export const CLASSROOM_HOME_GOAL_KINDS = ['vocabulary', 'grammar', 'speaking', 'listening'] as const

export type ClassroomHomeGoalKind = (typeof CLASSROOM_HOME_GOAL_KINDS)[number]

export interface ClassroomHomeGoals {
  vocabulary?: string
  grammar?: string
  speaking?: string
  listening?: string
}

export const CLASSROOM_HOME_GOAL_LABELS: Record<ClassroomHomeGoalKind, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  speaking: 'Speaking',
  listening: 'Listening',
}

export interface ClassroomHomeGoalLine {
  kind?: ClassroomHomeGoalKind
  label?: string
  text: string
  detail?: string
}

export interface ClassroomHomeAgendaPart {
  id?: string
  title?: string | null
  kindLabel?: string | null
  skipped?: boolean
  tag?: string | null
}

export interface ClassroomHomeAgendaBlock {
  id?: string
  label?: string | null
  objective?: string | null
  activityType?: string | null
}

const GOAL_MAX = 120
const WORD_CAP = 8
const PART_CAP = 8
const DETAIL_MAX = 80
const VOCAB_RE = /vocab|word study|words to know|word list/i
const GRAMMAR_RE = /\bgrammar\b/i

export function sanitizeClassroomHomeGoals(raw: unknown): ClassroomHomeGoals | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Record<string, unknown>
  const out: ClassroomHomeGoals = {}
  for (const kind of CLASSROOM_HOME_GOAL_KINDS) {
    const value = typeof src[kind] === 'string' ? src[kind].trim() : ''
    if (!value) continue
    out[kind] = value.slice(0, GOAL_MAX)
  }
  return CLASSROOM_HOME_GOAL_KINDS.some((kind) => out[kind]) ? out : undefined
}

export function classroomHomeContextLine(parts: Array<string | null | undefined>): string | null {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const raw of parts) {
    const value = raw?.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(value)
  }
  return unique.length > 0 ? unique.join(' · ') : null
}

function uniqueWords(words: string[] | null | undefined, cap = WORD_CAP): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of words ?? []) {
    const word = raw.trim()
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(word)
    if (out.length >= cap) break
  }
  return out
}

function clipDetail(value: string | null | undefined): string | undefined {
  const text = value?.trim()
  if (!text) return undefined
  if (text.length <= DETAIL_MAX) return text
  return `${text.slice(0, DETAIL_MAX - 1).trimEnd()}…`
}

function blobOf(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function isVocabAgendaItem(input: { tag?: string | null; label?: string | null; title?: string | null; activityType?: string | null }): boolean {
  const tag = input.tag?.trim() ?? ''
  if (tag === 'vocabulary_in_context' || tag === 'vocabulary_background' || tag === 'vocabulary_strategy') {
    return true
  }
  return VOCAB_RE.test(blobOf(input.label, input.title, input.activityType))
}

function isGrammarAgendaItem(input: { tag?: string | null; label?: string | null; title?: string | null; activityType?: string | null }): boolean {
  if (input.tag?.trim() === 'grammar') return true
  return GRAMMAR_RE.test(blobOf(input.label, input.title, input.activityType))
}

function agendaLine(input: {
  kind?: ClassroomHomeGoalKind
  label: string
  detail?: string
}): ClassroomHomeGoalLine {
  const detail = input.detail?.trim()
  return {
    ...(input.kind ? { kind: input.kind } : {}),
    label: input.label,
    text: detail || input.label,
    ...(detail ? { detail } : {}),
  }
}

function linesFromParts(
  parts: ClassroomHomeAgendaPart[],
  words: string[],
  grammarTarget?: string,
): ClassroomHomeGoalLine[] {
  const hadVocabPart = parts.some((part) =>
    isVocabAgendaItem({ tag: part.tag, label: part.kindLabel, title: part.title }),
  )
  const active = parts.filter((part) => !part.skipped).slice(0, PART_CAP)
  const lines: ClassroomHomeGoalLine[] = []
  let attachedWords = false
  let attachedGrammar = false

  for (const part of active) {
    const label = part.kindLabel?.trim() || part.title?.trim()
    if (!label) continue
    const vocab = isVocabAgendaItem({ tag: part.tag, label: part.kindLabel, title: part.title })
    const grammar = isGrammarAgendaItem({ tag: part.tag, label: part.kindLabel, title: part.title })
    let detail: string | undefined
    let kind: ClassroomHomeGoalKind | undefined
    if (vocab && !attachedWords && words.length > 0) {
      detail = words.join(', ')
      kind = 'vocabulary'
      attachedWords = true
    } else if (grammar && !attachedGrammar && grammarTarget) {
      detail = grammarTarget
      kind = 'grammar'
      attachedGrammar = true
    } else if (vocab) {
      kind = 'vocabulary'
    } else if (grammar) {
      kind = 'grammar'
    }
    lines.push(agendaLine({ kind, label, detail }))
  }

  if (lines.length === 0) return []

  if (!attachedWords && words.length > 0 && !hadVocabPart) {
    lines.unshift(
      agendaLine({
        kind: 'vocabulary',
        label: CLASSROOM_HOME_GOAL_LABELS.vocabulary,
        detail: words.join(', '),
      }),
    )
  }

  return lines.slice(0, PART_CAP)
}

function linesFromBlocks(
  blocks: ClassroomHomeAgendaBlock[],
  words: string[],
  grammarTarget?: string,
): ClassroomHomeGoalLine[] {
  const lines: ClassroomHomeGoalLine[] = []
  let attachedWords = false
  let attachedGrammar = false

  for (const block of blocks.slice(0, PART_CAP)) {
    const label = block.label?.trim()
    if (!label) continue
    const vocab = isVocabAgendaItem({ label, activityType: block.activityType })
    const grammar = isGrammarAgendaItem({ label, activityType: block.activityType })
    let detail: string | undefined
    let kind: ClassroomHomeGoalKind | undefined
    if (vocab && !attachedWords && words.length > 0) {
      detail = words.join(', ')
      kind = 'vocabulary'
      attachedWords = true
    } else if (grammar && !attachedGrammar) {
      detail = grammarTarget || clipDetail(block.objective)
      kind = 'grammar'
      attachedGrammar = Boolean(detail)
    }
    lines.push(agendaLine({ kind, label, detail }))
  }

  if (!attachedWords && words.length > 0) {
    lines.unshift(
      agendaLine({
        kind: 'vocabulary',
        label: CLASSROOM_HOME_GOAL_LABELS.vocabulary,
        detail: words.join(', '),
      }),
    )
  }

  return lines.slice(0, PART_CAP)
}

export function buildClassroomHomeLessonLines(input: {
  parts?: ClassroomHomeAgendaPart[] | null
  prepTimeBlocks?: ClassroomHomeAgendaBlock[] | null
  words?: string[] | null
  grammarTarget?: string | null
  prepPriorities?: string[] | null
  sessionGoals?: string[] | null
}): ClassroomHomeGoalLine[] {
  const words = uniqueWords(input.words)
  const grammarTarget = clipDetail(input.grammarTarget)

  const fromParts = linesFromParts(input.parts ?? [], words, grammarTarget)
  if (fromParts.length > 0) return fromParts

  const fromBlocks = linesFromBlocks(input.prepTimeBlocks ?? [], words, grammarTarget)
  if (fromBlocks.length > 0) return fromBlocks

  if (words.length > 0) {
    return [
      agendaLine({
        kind: 'vocabulary',
        label: CLASSROOM_HOME_GOAL_LABELS.vocabulary,
        detail: words.join(', '),
      }),
    ]
  }

  if (grammarTarget) {
    return [
      agendaLine({
        kind: 'grammar',
        label: CLASSROOM_HOME_GOAL_LABELS.grammar,
        detail: grammarTarget,
      }),
    ]
  }

  const fallback = (input.prepPriorities?.length ? input.prepPriorities : input.sessionGoals) ?? []
  const lines: ClassroomHomeGoalLine[] = []
  for (const raw of fallback) {
    const text = raw.trim()
    if (!text) continue
    lines.push({ text })
    if (lines.length >= 4) break
  }
  return lines
}

export function classroomHomeLessonHasContent(input: {
  contextLine?: string | null
  lines: ClassroomHomeGoalLine[]
}): boolean {
  return Boolean(input.contextLine?.trim()) || input.lines.length > 0
}
