import { NextResponse } from 'next/server'
import { getContextStore } from '@/lib/context/file-store'
import type {
  BookContextRecord,
  LessonContextRecord,
  PartContextRecord,
  UnitContextRecord,
} from '@/lib/context/types'
import { CONTEXT_VERSION, stableId, trimList } from '@/lib/context/utils'

interface FrameworkRowInput {
  unitId: string
  unitTitle?: string
  lessonId: string
  lessonTitle?: string
  sourcePageRange?: { startPage?: number; endPage?: number }
}

interface LessonPartInput {
  lessonId: string
  parts: Array<{
    partId: string
    partTitle?: string
    sourcePageRange?: { startPage?: number; endPage?: number }
  }>
}

interface FrameworkApplyInput {
  bookId: string
  focusAreas: string[]
  focusNotesByLesson: Record<string, Record<string, string>>
  rows: FrameworkRowInput[]
  lessonParts: LessonPartInput[]
  dryRun?: boolean
}

interface LabelBlock {
  label: string | null
  content: string
}

const DEPRECATED_LABELS = new Set(['read aloud', 'anchor text', 'paired selection'])
const LESSON_LABELS = new Set([
  'selection',
  'genre',
  'essential question',
  'comprehension target',
  'grammar/vocab targets',
  'weekly assessments',
])
const UNIT_LABELS = new Set([
  'unit theme',
  'big idea',
  'big ideas',
  'cross curricular',
  'cross-curricular',
  'target language domains',
  'unit assessment',
  'unit assessments',
])

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function sanitizeRange(range: { startPage?: number; endPage?: number } | undefined): { startPage: number; endPage: number } {
  const start = Number(range?.startPage)
  const end = Number(range?.endPage)
  if (Number.isFinite(start) && Number.isFinite(end)) {
    const left = Math.max(1, Math.floor(start))
    const right = Math.max(left, Math.floor(end))
    return { startPage: left, endPage: right }
  }
  return { startPage: 1, endPage: 1 }
}

function parseBlocks(raw: string): LabelBlock[] {
  const normalized = String(raw ?? '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []
  const lines = normalized.split('\n')
  const out: LabelBlock[] = []
  let current: LabelBlock | null = null
  for (const lineRaw of lines) {
    const line = lineRaw.trim()
    if (!line) continue
    const labelMatch = line.match(/^([^:\n]{1,80}):\s*(.*)$/)
    if (labelMatch) {
      if (current) out.push(current)
      current = { label: normalizeLabel(labelMatch[1] ?? ''), content: (labelMatch[2] ?? '').trim() }
      continue
    }
    if (!current) current = { label: null, content: line }
    else current.content = `${current.content} ${line}`.trim()
  }
  if (current) out.push(current)
  return out
}

function splitToList(value: string, max = 10): string[] {
  return trimList(
    value
      .split(/\n|;|•|\u2022|,/g)
      .map((item) => item.trim())
      .filter(Boolean),
    max,
  )
}

function pushUnique(target: string[], value: string) {
  const next = value.trim()
  if (!next) return
  if (!target.some((item) => item.toLowerCase() === next.toLowerCase())) target.push(next)
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  )
}

function partMatchScore(partTitle: string, block: LabelBlock): number {
  const partTokens = tokenSet(partTitle)
  if (!partTokens.size) return 0
  const textTokens = tokenSet(`${block.label ?? ''} ${block.content}`)
  if (!textTokens.size) return 0
  let overlap = 0
  for (const token of partTokens) {
    if (textTokens.has(token)) overlap += 1
  }
  return overlap
}

function parseInput(body: unknown): FrameworkApplyInput | null {
  const src = body as Partial<FrameworkApplyInput> | undefined
  if (!src || typeof src.bookId !== 'string') return null
  return {
    bookId: src.bookId.trim(),
    focusAreas: Array.isArray(src.focusAreas) ? src.focusAreas.map((item) => String(item ?? '').trim()).filter(Boolean) : [],
    focusNotesByLesson: src.focusNotesByLesson && typeof src.focusNotesByLesson === 'object'
      ? (src.focusNotesByLesson as Record<string, Record<string, string>>)
      : {},
    rows: Array.isArray(src.rows)
      ? src.rows
        .map((row) => ({
          unitId: String(row?.unitId ?? '').trim(),
          unitTitle: String(row?.unitTitle ?? '').trim(),
          lessonId: String(row?.lessonId ?? '').trim(),
          lessonTitle: String(row?.lessonTitle ?? '').trim(),
          sourcePageRange: row?.sourcePageRange,
        }))
        .filter((row) => row.unitId && row.lessonId)
      : [],
    lessonParts: Array.isArray(src.lessonParts)
      ? src.lessonParts.map((entry) => ({
        lessonId: String(entry?.lessonId ?? '').trim(),
        parts: Array.isArray(entry?.parts)
          ? entry.parts
            .map((part) => ({
              partId: String(part?.partId ?? '').trim(),
              partTitle: String(part?.partTitle ?? '').trim(),
              sourcePageRange: part?.sourcePageRange,
            }))
            .filter((part) => part.partId)
          : [],
      }))
      : [],
    dryRun: Boolean(src.dryRun),
  }
}

export async function POST(req: Request) {
  try {
    const parsed = parseInput(await req.json())
    if (!parsed?.bookId) {
      return NextResponse.json({ ok: false, error: 'Invalid framework apply payload.' }, { status: 400 })
    }
    const now = new Date().toISOString()
    const dryRun = Boolean(parsed.dryRun)
    const store = getContextStore()
    const rowByLesson = new Map(parsed.rows.map((row) => [row.lessonId, row] as const))
    const partsByLesson = new Map(parsed.lessonParts.map((entry) => [entry.lessonId, entry.parts] as const))

    const unitAccum = new Map<string, { unitTitle?: string; theme: string[]; bigIdeas: string[]; cross: string[]; domains: string[]; range: { startPage: number; endPage: number } }>()
    const lessonRecords: LessonContextRecord[] = []
    const partRecords: PartContextRecord[] = []
    let deprecatedSkipped = 0

    for (const [lessonId, areaMapRaw] of Object.entries(parsed.focusNotesByLesson)) {
      const row = rowByLesson.get(lessonId)
      if (!row) continue
      const areaMap = areaMapRaw && typeof areaMapRaw === 'object' ? areaMapRaw : {}
      const lessonRange = sanitizeRange(row.sourcePageRange)

      const lessonGoals: string[] = []
      const essentialQuestions: string[] = []
      const grammarNotes: string[] = []
      const writingNotes: string[] = []
      const assessments: string[] = []
      let comprehensionSkill = ''
      let strategy = ''
      let textType = ''

      let unitEntry = unitAccum.get(row.unitId)
      if (!unitEntry) {
        unitEntry = {
          unitTitle: row.unitTitle,
          theme: [],
          bigIdeas: [],
          cross: [],
          domains: [],
          range: lessonRange,
        }
        unitAccum.set(row.unitId, unitEntry)
      } else {
        unitEntry.range = {
          startPage: Math.min(unitEntry.range.startPage, lessonRange.startPage),
          endPage: Math.max(unitEntry.range.endPage, lessonRange.endPage),
        }
      }

      const parts = partsByLesson.get(lessonId) ?? []
      const partScratch = new Map<string, { partId: string; partTitle?: string; notes: string[]; goals: string[]; grammar: string[]; writing: string[]; range: { startPage: number; endPage: number } }>()
      for (const part of parts) {
        partScratch.set(part.partId, {
          partId: part.partId,
          partTitle: part.partTitle,
          notes: [],
          goals: [],
          grammar: [],
          writing: [],
          range: sanitizeRange(part.sourcePageRange),
        })
      }

      for (const [areaRaw, noteRaw] of Object.entries(areaMap)) {
        const area = String(areaRaw ?? '').trim()
        const note = String(noteRaw ?? '').trim()
        if (!note) continue
        const areaNorm = normalizeLabel(area)
        if (areaNorm) pushUnique(unitEntry.domains, area)
        pushUnique(lessonGoals, `${area}: ${note}`)

        const blocks = parseBlocks(note)
        if (!blocks.length) {
          if (areaNorm === 'grammar') grammarNotes.push(...splitToList(note, 12))
          if (areaNorm === 'writing') writingNotes.push(...splitToList(note, 12))
          continue
        }

        for (const block of blocks) {
          const label = block.label ?? ''
          const content = block.content.trim()
          if (!content) continue
          if (label && DEPRECATED_LABELS.has(label)) {
            deprecatedSkipped += 1
            continue
          }
          if (!label) {
            if (areaNorm === 'grammar') grammarNotes.push(...splitToList(content, 12))
            if (areaNorm === 'writing') writingNotes.push(...splitToList(content, 12))
            continue
          }

          if (UNIT_LABELS.has(label)) {
            if (label.includes('theme')) pushUnique(unitEntry.theme, content)
            else if (label.includes('cross')) pushUnique(unitEntry.cross, content)
            else if (label.includes('domain')) pushUnique(unitEntry.domains, content)
            else pushUnique(unitEntry.bigIdeas, content)
            continue
          }

          if (LESSON_LABELS.has(label) || label === areaNorm) {
            if (label === 'essential question') pushUnique(essentialQuestions, content)
            if (label === 'comprehension target' && !comprehensionSkill) comprehensionSkill = content
            if (label === 'grammar/vocab targets') grammarNotes.push(...splitToList(content, 12))
            if (label === 'weekly assessments') assessments.push(...splitToList(content, 8))
            if (label === 'genre' && !textType) textType = content
            if (label === 'selection') pushUnique(lessonGoals, `Selection: ${content}`)
            continue
          }

          let best: { id: string; score: number } | null = null
          for (const part of parts) {
            const score = partMatchScore(part.partTitle ?? '', block)
            if (!best || score > best.score) best = { id: part.partId, score }
          }
          if (best && best.score > 0 && partScratch.has(best.id)) {
            const scratch = partScratch.get(best.id)!
            pushUnique(scratch.notes, `${label}: ${content}`)
            if (label.includes('grammar')) scratch.grammar.push(...splitToList(content, 10))
            else if (label.includes('writing')) scratch.writing.push(...splitToList(content, 10))
            else scratch.goals.push(content)
          } else {
            pushUnique(lessonGoals, `${label}: ${content}`)
          }
        }
      }

      strategy = strategy || assessments[0] || lessonGoals[0] || ''
      const lessonIdStable = stableId(`lesson:${parsed.bookId}:${row.unitId}:${lessonId}`)
      const existingLesson = await store.getLessonContext(parsed.bookId, row.unitId, lessonId)
      const lessonRecord: LessonContextRecord = {
        id: lessonIdStable,
        kind: 'lesson',
        bookId: parsed.bookId,
        unitId: row.unitId,
        lessonId,
        lessonTitle: row.lessonTitle || undefined,
        textType: textType || 'mixed',
        lessonGoals: trimList(lessonGoals, 20),
        comprehensionSkill: comprehensionSkill || 'Not specified',
        strategy: strategy || 'Not specified',
        essentialQuestions: trimList(essentialQuestions, 10),
        languageFocus: {
          grammarNotes: trimList(grammarNotes, 20),
          writingNotes: trimList(writingNotes, 20),
        },
        sourcePageRange: lessonRange,
        scanProfile: 'balanced',
        contextVersion: CONTEXT_VERSION,
        createdAt: existingLesson?.createdAt ?? now,
        updatedAt: now,
      }
      lessonRecords.push(lessonRecord)
      if (!dryRun) await store.saveLessonContext(lessonRecord)

      for (const scratch of partScratch.values()) {
        if (!scratch.notes.length && !scratch.goals.length && !scratch.grammar.length && !scratch.writing.length) continue
        const existingPart = await store.getPartContext(parsed.bookId, row.unitId, lessonId, scratch.partId)
        const partRecord: PartContextRecord = {
          id: stableId(`part:${parsed.bookId}:${row.unitId}:${lessonId}:${scratch.partId}`),
          kind: 'part',
          bookId: parsed.bookId,
          unitId: row.unitId,
          lessonId,
          partId: scratch.partId,
          partTitle: scratch.partTitle || undefined,
          partGoals: trimList(scratch.goals, 20),
          activityNotes: trimList(scratch.notes, 30),
          languageFocus: {
            grammarNotes: trimList(scratch.grammar, 20),
            writingNotes: trimList(scratch.writing, 20),
          },
          sourcePageRange: scratch.range,
          scanProfile: 'balanced',
          contextVersion: CONTEXT_VERSION,
          createdAt: existingPart?.createdAt ?? now,
          updatedAt: now,
        }
        partRecords.push(partRecord)
        if (!dryRun) await store.savePartContext(partRecord)
      }
    }

    const unitRecords: UnitContextRecord[] = []
    for (const [unitId, unitData] of unitAccum.entries()) {
      const existingUnit = await store.getUnitContext(parsed.bookId, unitId)
      const unitRecord: UnitContextRecord = {
        id: stableId(`unit:${parsed.bookId}:${unitId}`),
        kind: 'unit',
        bookId: parsed.bookId,
        unitId,
        unitTitle: unitData.unitTitle,
        theme: unitData.theme[0] ?? existingUnit?.theme ?? 'Not specified',
        bigIdeas: trimList(unitData.bigIdeas, 12),
        crossCurricularLinks: trimList(unitData.cross, 12),
        targetLanguageDomains: trimList(unitData.domains, 12),
        sourcePageRange: unitData.range,
        scanProfile: 'balanced',
        contextVersion: CONTEXT_VERSION,
        createdAt: existingUnit?.createdAt ?? now,
        updatedAt: now,
      }
      unitRecords.push(unitRecord)
      if (!dryRun) await store.saveUnitContext(unitRecord)
    }

    const existingBook = await store.getBookContext(parsed.bookId)
    const instructionalPriorities = trimList(
      Object.values(parsed.focusNotesByLesson)
        .flatMap((areaMap) => Object.entries(areaMap ?? {}))
        .filter(([, value]) => String(value ?? '').trim())
        .map(([area]) => String(area ?? '').trim()),
      20,
    )
    const bookRecord: BookContextRecord = {
      id: stableId(`book:${parsed.bookId}`),
      kind: 'book',
      bookId: parsed.bookId,
      summary: existingBook?.summary ?? 'Framework notes mapped to context layers.',
      goals: existingBook?.goals ?? [],
      pacing: existingBook?.pacing ?? [],
      instructionalPriorities: instructionalPriorities.length ? instructionalPriorities : (existingBook?.instructionalPriorities ?? []),
      focusAreas: parsed.focusAreas.length ? parsed.focusAreas : (existingBook?.focusAreas ?? []),
      focusNotesByLesson: parsed.focusNotesByLesson,
      sourcePageRange: existingBook?.sourcePageRange ?? null,
      materials: existingBook?.materials ?? [],
      evidence: existingBook?.evidence ?? [],
      contextVersion: CONTEXT_VERSION,
      createdAt: existingBook?.createdAt ?? now,
      updatedAt: now,
    }
    if (!dryRun) await store.saveBookContext(bookRecord)

    const summary = {
      bookUpdated: dryRun ? 0 : 1,
      unitsUpdated: unitRecords.length,
      lessonsUpdated: lessonRecords.length,
      partsUpdated: partRecords.length,
      deprecatedLabelsSkipped: deprecatedSkipped,
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        summary,
        preview: {
          units: unitRecords.map((u) => ({
            unitId: u.unitId,
            unitTitle: u.unitTitle,
            theme: u.theme,
            bigIdeas: u.bigIdeas,
            crossCurricularLinks: u.crossCurricularLinks,
            targetLanguageDomains: u.targetLanguageDomains,
            sourcePageRange: u.sourcePageRange,
          })),
          lessons: lessonRecords.map((l) => ({
            lessonId: l.lessonId,
            lessonTitle: l.lessonTitle,
            unitId: l.unitId,
            textType: l.textType,
            comprehensionSkill: l.comprehensionSkill,
            strategy: l.strategy,
            essentialQuestions: l.essentialQuestions,
            lessonGoals: l.lessonGoals,
            grammarNotes: l.languageFocus.grammarNotes,
            writingNotes: l.languageFocus.writingNotes,
            sourcePageRange: l.sourcePageRange,
          })),
          parts: partRecords.map((p) => ({
            lessonId: p.lessonId,
            partId: p.partId,
            partTitle: p.partTitle,
            partGoals: p.partGoals,
            activityNotes: p.activityNotes,
            grammarNotes: p.languageFocus.grammarNotes,
            writingNotes: p.languageFocus.writingNotes,
            sourcePageRange: p.sourcePageRange,
          })),
          book: {
            focusAreas: bookRecord.focusAreas,
            instructionalPriorities: bookRecord.instructionalPriorities,
            summaryNote: 'Book summary and materials are unchanged unless empty defaults apply.',
          },
        },
      })
    }

    return NextResponse.json({
      ok: true,
      summary,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to apply framework context layers.' }, { status: 500 })
  }
}
