/** Lesson frame fuel for skill-aware reading checks (Phase 9a). */

export type LessonFrameStatus = 'draft' | 'ready'

export type LessonFrameSource = 'gemini' | 'paste' | 'pdf'

export interface LessonFramePageRange {
  startPdfPage: number
  endPdfPage: number
}

/** One outline section that contributed to a saved frame draft. */
export interface LessonFrameScannedSection {
  title: string
  tag: string
  startDisplayPage: number
  endDisplayPage: number
}

export interface LessonFrameRecord {
  id: string
  bookId: string
  unitId: string
  lessonId: string
  lessonTitle?: string
  /** e.g. "Cause and Effect" */
  comprehensionSkill: string
  /** e.g. "Make Predictions" */
  readingStrategy: string
  essentialQuestion: string
  lessonGoals: string[]
  targetVocabulary: string[]
  /** Verbatim teaching blurb from the comprehension / opener pages. */
  teachingNotes: string
  sourcePageRange: LessonFramePageRange
  startDisplayPage: number | null
  endDisplayPage: number | null
  /** Discrete sections that successfully contributed (for UI). */
  scannedSections?: LessonFrameScannedSection[]
  status: LessonFrameStatus
  source: LessonFrameSource
  updatedAt: string
}

export function lessonFrameId(bookId: string, unitId: string, lessonId: string): string {
  return `frame:${bookId.trim()}:${unitId.trim()}:${lessonId.trim()}`
}

export function lessonFrameStatusLabel(frame: LessonFrameRecord | null | undefined): string {
  if (!frame) return 'Needs frame'
  if (frame.status === 'ready') {
    const skill = frame.comprehensionSkill.trim()
    return skill ? `Frame ready · ${skill}` : 'Frame ready'
  }
  return 'Frame draft'
}

export function isLessonFrameReady(frame: LessonFrameRecord | null | undefined): boolean {
  return Boolean(frame && frame.status === 'ready')
}

function trimList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const s = typeof item === 'string' ? item.trim() : ''
    if (!s) continue
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

function toPage(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const n = Math.floor(v)
  return n >= 1 ? n : null
}

export function sanitizeLessonFrameRecord(
  input: Partial<LessonFrameRecord> & {
    bookId: string
    unitId: string
    lessonId: string
  },
): LessonFrameRecord | null {
  const bookId = String(input.bookId ?? '').trim()
  const unitId = String(input.unitId ?? '').trim()
  const lessonId = String(input.lessonId ?? '').trim()
  if (!bookId || !unitId || !lessonId) return null

  const startPdf =
    toPage(input.sourcePageRange?.startPdfPage) ??
    toPage((input as { startPdfPage?: unknown }).startPdfPage) ??
    1
  const endPdf =
    toPage(input.sourcePageRange?.endPdfPage) ??
    toPage((input as { endPdfPage?: unknown }).endPdfPage) ??
    startPdf

  const source: LessonFrameSource =
    input.source === 'paste' ? 'paste' : input.source === 'pdf' ? 'pdf' : 'gemini'

  const status: LessonFrameStatus = input.status === 'ready' ? 'ready' : 'draft'

  const scannedSections = sanitizeScannedSections(input.scannedSections)

  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : lessonFrameId(bookId, unitId, lessonId),
    bookId,
    unitId,
    lessonId,
    lessonTitle:
      typeof input.lessonTitle === 'string' && input.lessonTitle.trim()
        ? input.lessonTitle.trim()
        : undefined,
    comprehensionSkill:
      typeof input.comprehensionSkill === 'string' ? input.comprehensionSkill.trim() : '',
    readingStrategy: typeof input.readingStrategy === 'string' ? input.readingStrategy.trim() : '',
    essentialQuestion:
      typeof input.essentialQuestion === 'string' ? input.essentialQuestion.trim() : '',
    lessonGoals: trimList(input.lessonGoals, 8),
    targetVocabulary: trimList(input.targetVocabulary, 24),
    teachingNotes: typeof input.teachingNotes === 'string' ? input.teachingNotes.trim() : '',
    sourcePageRange: {
      startPdfPage: Math.min(startPdf, endPdf),
      endPdfPage: Math.max(startPdf, endPdf),
    },
    startDisplayPage: toPage(input.startDisplayPage),
    endDisplayPage: toPage(input.endDisplayPage),
    scannedSections: scannedSections.length > 0 ? scannedSections : undefined,
    status,
    source,
    updatedAt:
      typeof input.updatedAt === 'string' && input.updatedAt.trim()
        ? input.updatedAt.trim()
        : new Date().toISOString(),
  }
}

function sanitizeScannedSections(raw: unknown): LessonFrameScannedSection[] {
  if (!Array.isArray(raw)) return []
  const out: LessonFrameScannedSection[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const tag = typeof row.tag === 'string' ? row.tag.trim() : ''
    const start = toPage(row.startDisplayPage)
    const end = toPage(row.endDisplayPage)
    if (!title || start == null || end == null) continue
    out.push({
      title,
      tag: tag || 'unspecified',
      startDisplayPage: Math.min(start, end),
      endDisplayPage: Math.max(start, end),
    })
    if (out.length >= 16) break
  }
  return out
}

/** Human-readable list of discrete scanned parts, e.g. "Vocab p20–21 · Skill p28–29". */
export function lessonFrameScannedSectionsLine(frame: LessonFrameRecord): string | null {
  const sections = frame.scannedSections
  if (!sections?.length) {
    if (frame.startDisplayPage != null && frame.endDisplayPage != null) {
      return `Scanned pages p${frame.startDisplayPage}–${frame.endDisplayPage}`
    }
    return null
  }
  const bits = sections.map((s) => {
    const short = lessonFrameSectionShortLabel(s.title, s.tag)
    const range =
      s.startDisplayPage === s.endDisplayPage
        ? `p${s.startDisplayPage}`
        : `p${s.startDisplayPage}–${s.endDisplayPage}`
    return `${short} ${range}`
  })
  return bits.join(' · ')
}

export type LessonFrameSectionKind =
  | 'vocab'
  | 'strategy'
  | 'skill'
  | 'genre'
  | 'vocab_strategy'
  | 'other'

export function lessonFrameSectionKind(title: string, tag: string): LessonFrameSectionKind {
  if (/vocabulary\s+strategy/i.test(title) || tag === 'vocabulary_strategy') return 'vocab_strategy'
  if (
    /^vocabulary\b/i.test(title) ||
    tag === 'vocabulary_in_context' ||
    tag === 'vocabulary_background'
  ) {
    return 'vocab'
  }
  if (/comprehension\s+skill/i.test(title)) return 'skill'
  if (/comprehension\s+strategy/i.test(title)) return 'strategy'
  if (/^genre\b/i.test(title) || tag === 'genre') return 'genre'
  if (tag === 'literary_element') return 'genre'
  if (tag === 'comprehension') {
    if (/strateg/i.test(title)) return 'strategy'
    if (/skill/i.test(title)) return 'skill'
    return 'other'
  }
  return 'other'
}

export function lessonFrameSectionShortLabel(title: string, tag: string): string {
  switch (lessonFrameSectionKind(title, tag)) {
    case 'vocab_strategy':
      return 'Vocab strategy'
    case 'vocab':
      return 'Vocab'
    case 'skill':
      return 'Skill'
    case 'strategy':
      return 'Strategy'
    case 'genre':
      return tag === 'literary_element' ? 'Lit. element' : 'Genre'
    default: {
      const t = title.replace(/\s+/g, ' ').trim()
      return t.length > 28 ? `${t.slice(0, 26)}…` : t || 'Section'
    }
  }
}

/** Page range label, e.g. "p20–21". */
export function lessonFrameSectionPageLabel(section: LessonFrameScannedSection): string {
  if (section.startDisplayPage === section.endDisplayPage) {
    return `p${section.startDisplayPage}`
  }
  return `p${section.startDisplayPage}–${section.endDisplayPage}`
}

/**
 * Split teaching notes into known labeled lines (Genre / Vocab strategy) vs leftover free text.
 * Used so those parts can show on their own cards instead of one Notes dump.
 */
export function splitLessonFrameTeachingNotes(notes: string): {
  genre: string
  vocabularyStrategy: string
  other: string
} {
  let genre = ''
  let vocabularyStrategy = ''
  const otherLines: string[] = []
  for (const raw of notes.split(/\n+/)) {
    const line = raw.trim()
    if (!line) continue
    const genreMatch = line.match(/^genre\s*[:\-–—]\s*(.+)$/i)
    if (genreMatch?.[1]) {
      genre = genreMatch[1].trim()
      continue
    }
    const vsMatch = line.match(/^vocabulary\s+strategy\s*[:\-–—]\s*(.+)$/i)
    if (vsMatch?.[1]) {
      vocabularyStrategy = vsMatch[1].trim()
      continue
    }
    otherLines.push(line)
  }
  return { genre, vocabularyStrategy, other: otherLines.join('\n\n') }
}

/** Rebuild teaching notes from structured pieces (keeps Genre / Vocab strategy as labeled lines). */
export function joinLessonFrameTeachingNotes(parts: {
  genre?: string
  vocabularyStrategy?: string
  other?: string
}): string {
  const lines: string[] = []
  const genre = (parts.genre ?? '').trim()
  const vs = (parts.vocabularyStrategy ?? '').trim()
  const other = (parts.other ?? '').trim()
  if (vs) lines.push(`Vocabulary strategy: ${vs}`)
  if (genre) lines.push(`Genre: ${genre}`)
  if (other) lines.push(other)
  return lines.join('\n\n')
}

/** Short preview for a scanned-part card from current frame fields (full page text comes later). */
export function lessonFrameSectionCardPreview(
  frame: LessonFrameRecord,
  section: LessonFrameScannedSection,
): string {
  const kind = lessonFrameSectionKind(section.title, section.tag)
  const notes = splitLessonFrameTeachingNotes(frame.teachingNotes)
  switch (kind) {
    case 'vocab':
      return frame.targetVocabulary.length > 0
        ? frame.targetVocabulary.join(', ')
        : 'No words yet — re-scan this part or fill by hand.'
    case 'strategy':
      return frame.readingStrategy.trim() || 'No strategy label yet.'
    case 'skill':
      return frame.comprehensionSkill.trim() || 'No skill label yet.'
    case 'genre':
      return notes.genre || 'No genre label yet.'
    case 'vocab_strategy':
      return notes.vocabularyStrategy || 'No vocab strategy label yet.'
    default:
      return notes.other || section.title
  }
}

/** Compact block for Generate (Phase 9b) and UI summaries. */
export function formatLessonFrameForPrompt(frame: LessonFrameRecord): string {
  const lines = [
    'Lesson frame (use this when writing checks):',
    `- Comprehension skill: ${frame.comprehensionSkill.trim() || '(unknown)'}`,
    `- Reading strategy: ${frame.readingStrategy.trim() || '(unknown)'}`,
    `- Essential question: ${frame.essentialQuestion.trim() || '(none)'}`,
  ]
  if (frame.lessonGoals.length > 0) {
    lines.push(`- Lesson goals: ${frame.lessonGoals.join('; ')}`)
  }
  if (frame.targetVocabulary.length > 0) {
    lines.push(`- Target vocabulary: ${frame.targetVocabulary.join(', ')}`)
  }
  if (frame.teachingNotes.trim()) {
    lines.push('- Teaching notes (from book):')
    lines.push(frame.teachingNotes.trim().slice(0, 2000))
  }
  return lines.join('\n')
}

export function lessonFrameSummaryLine(frame: LessonFrameRecord): string {
  const bits = [
    frame.comprehensionSkill.trim() || null,
    frame.readingStrategy.trim() || null,
    frame.essentialQuestion.trim() ? `EQ: ${frame.essentialQuestion.trim()}` : null,
  ].filter(Boolean)
  return bits.join(' · ') || 'Frame saved — add skill details'
}

/** Fields a single section scan may contribute. */
export type LessonFrameSectionPatch = {
  comprehensionSkill?: string
  readingStrategy?: string
  essentialQuestion?: string
  lessonGoals?: string[]
  targetVocabulary?: string[]
  teachingNotes?: string
}

export function lessonFrameHasContent(frame: LessonFrameRecord | null | undefined): boolean {
  if (!frame) return false
  return Boolean(
    frame.comprehensionSkill.trim() ||
      frame.readingStrategy.trim() ||
      frame.essentialQuestion.trim() ||
      frame.targetVocabulary.length > 0 ||
      frame.teachingNotes.trim() ||
      frame.lessonGoals.length > 0,
  )
}

export function lessonFrameSectionPatchHasContent(patch: LessonFrameSectionPatch): boolean {
  return Boolean(
    (patch.comprehensionSkill ?? '').trim() ||
      (patch.readingStrategy ?? '').trim() ||
      (patch.essentialQuestion ?? '').trim() ||
      (patch.targetVocabulary ?? []).some((w) => w.trim()) ||
      (patch.teachingNotes ?? '').trim() ||
      (patch.lessonGoals ?? []).some((g) => g.trim()),
  )
}

/**
 * Seed fields from outline titles like "Comprehension Skill: Key Details."
 * Used when page OCR/AI returns little text.
 */
export function seedLessonFramePatchFromSectionTitle(
  title: string,
  tag?: string,
): LessonFrameSectionPatch {
  const t = title.replace(/\s+/g, ' ').trim()
  if (!t) return {}

  const skillMatch = t.match(/comprehension\s+skill\s*[:\-–—]\s*(.+)$/i)
  if (skillMatch?.[1]) {
    return { comprehensionSkill: skillMatch[1].replace(/\.+$/, '').trim() }
  }

  const strategyMatch = t.match(/comprehension\s+strategy\s*[:\-–—]\s*(.+)$/i)
  if (strategyMatch?.[1]) {
    return { readingStrategy: strategyMatch[1].replace(/\.+$/, '').trim() }
  }

  const genreMatch = t.match(/^genre\s*[:\-–—]\s*(.+)$/i)
  if (genreMatch?.[1]) {
    return { teachingNotes: `Genre: ${genreMatch[1].replace(/\.+$/, '').trim()}` }
  }

  const litMatch = t.match(/literary\s+element\s*[:\-–—]\s*(.+)$/i)
  if (litMatch?.[1]) {
    return { teachingNotes: `Literary element: ${litMatch[1].replace(/\.+$/, '').trim()}` }
  }

  const vocabStrat = t.match(/vocabulary\s+strategy\s*[:\-–—]\s*(.+)$/i)
  if (vocabStrat?.[1]) {
    return { teachingNotes: `Vocabulary strategy: ${vocabStrat[1].replace(/\.+$/, '').trim()}` }
  }

  if (tag === 'comprehension' && !/^comprehension$/i.test(t)) {
    return { teachingNotes: t }
  }

  return {}
}

/** Prefer non-empty model fields; fill gaps from title seed. */
export function combineLessonFrameSectionPatches(
  primary: LessonFrameSectionPatch,
  fallback: LessonFrameSectionPatch,
): LessonFrameSectionPatch {
  return {
    comprehensionSkill: (primary.comprehensionSkill ?? '').trim() || (fallback.comprehensionSkill ?? ''),
    readingStrategy: (primary.readingStrategy ?? '').trim() || (fallback.readingStrategy ?? ''),
    essentialQuestion: (primary.essentialQuestion ?? '').trim() || (fallback.essentialQuestion ?? ''),
    lessonGoals:
      (primary.lessonGoals ?? []).filter((g) => g.trim()).length > 0
        ? primary.lessonGoals
        : fallback.lessonGoals,
    targetVocabulary:
      (primary.targetVocabulary ?? []).filter((w) => w.trim()).length > 0
        ? primary.targetVocabulary
        : fallback.targetVocabulary,
    teachingNotes: (primary.teachingNotes ?? '').trim() || (fallback.teachingNotes ?? ''),
  }
}

function preferExisting(existing: string, incoming: string | undefined): string {
  const next = typeof incoming === 'string' ? incoming.trim() : ''
  if (existing.trim()) return existing
  return next
}

function unionWords(existing: string[], incoming: string[] | undefined, max: number): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const w of [...existing, ...(incoming ?? [])]) {
    const t = w.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

/**
 * Merge a section scan into an existing draft without wiping earlier fields.
 * Vocabulary and goals are unioned; other strings fill only when empty.
 */
export function mergeLessonFrameSection(
  existing: LessonFrameRecord | null,
  patch: LessonFrameSectionPatch,
  meta: {
    bookId: string
    unitId: string
    lessonId: string
    lessonTitle?: string
    startPdfPage: number
    endPdfPage: number
    startDisplayPage?: number | null
    endDisplayPage?: number | null
    source?: LessonFrameSource
    sectionTitle?: string
    sectionTag?: string
  },
): LessonFrameRecord | null {
  const base =
    existing ??
    sanitizeLessonFrameRecord({
      bookId: meta.bookId,
      unitId: meta.unitId,
      lessonId: meta.lessonId,
      lessonTitle: meta.lessonTitle,
      status: 'draft',
      source: meta.source ?? 'gemini',
      sourcePageRange: {
        startPdfPage: meta.startPdfPage,
        endPdfPage: meta.endPdfPage,
      },
      startDisplayPage: meta.startDisplayPage ?? null,
      endDisplayPage: meta.endDisplayPage ?? null,
    })
  if (!base) return null

  const pdfStart = Math.min(base.sourcePageRange.startPdfPage, meta.startPdfPage)
  const pdfEnd = Math.max(base.sourcePageRange.endPdfPage, meta.endPdfPage)
  const displayStarts = [base.startDisplayPage, meta.startDisplayPage ?? null].filter(
    (n): n is number => typeof n === 'number' && n >= 1,
  )
  const displayEnds = [base.endDisplayPage, meta.endDisplayPage ?? null].filter(
    (n): n is number => typeof n === 'number' && n >= 1,
  )

  const notesIncoming = typeof patch.teachingNotes === 'string' ? patch.teachingNotes.trim() : ''
  let teachingNotes = base.teachingNotes
  if (notesIncoming) {
    if (!teachingNotes.trim()) {
      teachingNotes = notesIncoming
    } else if (!teachingNotes.includes(notesIncoming)) {
      teachingNotes = `${teachingNotes.trim()}\n\n${notesIncoming}`.slice(0, 4000)
    }
  }

  let scannedSections = [...(base.scannedSections ?? [])]
  const secStart = meta.startDisplayPage ?? null
  const secEnd = meta.endDisplayPage ?? null
  if (meta.sectionTitle && secStart != null && secEnd != null) {
    const key = `${meta.sectionTitle}::${secStart}::${secEnd}`
    const already = scannedSections.some(
      (s) => `${s.title}::${s.startDisplayPage}::${s.endDisplayPage}` === key,
    )
    if (!already) {
      scannedSections.push({
        title: meta.sectionTitle,
        tag: meta.sectionTag ?? 'unspecified',
        startDisplayPage: Math.min(secStart, secEnd),
        endDisplayPage: Math.max(secStart, secEnd),
      })
    }
  }
  scannedSections = scannedSections
    .slice()
    .sort((a, b) => a.startDisplayPage - b.startDisplayPage || a.endDisplayPage - b.endDisplayPage)

  return sanitizeLessonFrameRecord({
    ...base,
    lessonTitle: base.lessonTitle ?? meta.lessonTitle,
    comprehensionSkill: preferExisting(base.comprehensionSkill, patch.comprehensionSkill),
    readingStrategy: preferExisting(base.readingStrategy, patch.readingStrategy),
    essentialQuestion: preferExisting(base.essentialQuestion, patch.essentialQuestion),
    lessonGoals: unionWords(base.lessonGoals, patch.lessonGoals, 8),
    targetVocabulary: unionWords(base.targetVocabulary, patch.targetVocabulary, 24),
    teachingNotes,
    sourcePageRange: { startPdfPage: pdfStart, endPdfPage: pdfEnd },
    startDisplayPage: displayStarts.length ? Math.min(...displayStarts) : null,
    endDisplayPage: displayEnds.length ? Math.max(...displayEnds) : null,
    scannedSections,
    status: 'draft',
    source: meta.source ?? base.source,
    updatedAt: new Date().toISOString(),
  })
}
