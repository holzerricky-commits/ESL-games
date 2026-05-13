import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import type { BookRecord } from '@/lib/books/types'
import {
  resolveBookFolderFromLibraryFilePath,
  resolveBookLibraryFilePath,
} from '@/lib/books/manifest-validation'
import { getBookLibraryRoot, loadBookLibrary } from '@/lib/books/server'
import { resolveGeminiApiKey } from '@/lib/gemini'

export interface StoredBookMaterial {
  id: string
  url: string
  title: string
  materialType: string
  fileName: string
  filePath: string
  sizeBytes: number
  contentType: string
  savedAt: string
}

export interface MaterialLinkMapping {
  materialId: string
  bookId: string
  unitId?: string
  lessonId?: string
  partId?: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
  sourceFilePath?: string
  evidenceSnippet?: string
  evidencePage?: number | null
  lessonProfileSnapshot?: MaterialLessonProfile
  mappedAt: string
}

export interface MaterialEvidence {
  field: string
  snippet: string
  page: number | null
  confidence: 'high' | 'medium' | 'low'
}

export interface MaterialLessonSignals {
  phonics: string[]
  fluency: string[]
  comprehension: string[]
  listening: string[]
  vocabulary: string[]
  grammar: string[]
  writing: string[]
  speaking: string[]
  assessment: string[]
  extensions: string[]
}

export interface MaterialLessonSections {
  readAloud: string[]
  anchorText: string[]
  pairedSelection: string[]
  selection: string[]
  targetVocabulary: string[]
  spelling: string[]
  grammar: string[]
  writing: string[]
  essentialQuestion: string[]
  comprehensionTargets: string[]
  grammarVocabTargets: string[]
  weeklyAssessments: string[]
}

export interface MaterialLessonProfile {
  lessonTitle: string
  lessonNumber: number | null
  inferredUnitId?: string
  inferredLessonId?: string
  inferredPartId?: string
  inferredPathLabel?: string
  confidence: 'high' | 'medium' | 'low'
  sectionFields?: MaterialLessonSections
  signals: MaterialLessonSignals
  evidence: MaterialEvidence[]
}

export interface MaterialAnalysisResult {
  materialId: string
  materialTitle: string
  materialFilePath: string
  parsedAt: string
  parseStatus: 'ok' | 'partial' | 'failed'
  extractionMode: 'pdf' | 'text' | 'metadata'
  detectedUnits: string[]
  lessonProfiles: MaterialLessonProfile[]
  errors: string[]
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeWhitespace(input: string): string {
  return input.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function tokens(input: string): string[] {
  return normalizeText(input).split(/\s+/).filter((token) => token.length >= 2)
}

function tokenOverlapScore(a: string, b: string): number {
  const left = new Set(tokens(a))
  const right = new Set(tokens(b))
  if (!left.size || !right.size) return 0
  let common = 0
  for (const token of left) {
    if (right.has(token)) common += 1
  }
  return common / Math.max(left.size, right.size)
}

function resolveBookFolderFromUnitPath(filePath: string): string | null {
  return resolveBookFolderFromLibraryFilePath(
    filePath,
    /* turbopackIgnore: true */ process.cwd(),
    getBookLibraryRoot(),
  )
}

function indexPathFor(bookFolder: string): string {
  return path.resolve(getBookLibraryRoot(), bookFolder, 'supporting', 'materials-index.json')
}

function mapPathFor(bookFolder: string): string {
  return path.resolve(getBookLibraryRoot(), bookFolder, 'supporting', 'materials-map.json')
}

function analysisPathFor(bookFolder: string): string {
  return path.resolve(getBookLibraryRoot(), bookFolder, 'supporting', 'materials-analysis.json')
}

async function readJsonArray<T>(absPath: string): Promise<T[]> {
  try {
    const raw = await readFile(absPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

async function writeJson(absPath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(absPath), { recursive: true })
  await writeFile(absPath, JSON.stringify(value, null, 2), 'utf8')
}

export async function resolveBookAndFolder(bookId: string): Promise<{ book: BookRecord; bookFolder: string } | null> {
  const library = await loadBookLibrary()
  const book = library.books.find((row) => row.id === bookId)
  if (!book) return null
  const unitPath = book.units[0]?.filePath ?? ''
  const bookFolder = resolveBookFolderFromUnitPath(unitPath)
  if (!bookFolder) return null
  return { book, bookFolder }
}

export async function readStoredMaterials(bookFolder: string): Promise<StoredBookMaterial[]> {
  const raw = await readJsonArray<StoredBookMaterial>(indexPathFor(bookFolder))
  return raw.filter((item) => item && typeof item.id === 'string' && typeof item.filePath === 'string')
}

export async function readMaterialMappings(bookFolder: string): Promise<MaterialLinkMapping[]> {
  const raw = await readJsonArray<MaterialLinkMapping>(mapPathFor(bookFolder))
  return raw.filter((item) => item && typeof item.materialId === 'string' && typeof item.bookId === 'string')
}

export async function saveMaterialMappings(bookFolder: string, mappings: MaterialLinkMapping[]): Promise<void> {
  await writeJson(mapPathFor(bookFolder), mappings)
}

export async function readMaterialAnalyses(bookFolder: string): Promise<MaterialAnalysisResult[]> {
  const raw = await readJsonArray<MaterialAnalysisResult>(analysisPathFor(bookFolder))
  return raw.filter((item) => item && typeof item.materialId === 'string' && typeof item.materialFilePath === 'string')
}

export async function saveMaterialAnalyses(bookFolder: string, items: MaterialAnalysisResult[]): Promise<void> {
  await writeJson(analysisPathFor(bookFolder), items)
}

interface TargetRef {
  unitId: string
  unitTitle: string
  lessonId?: string
  lessonTitle?: string
  partId?: string
  partTitle?: string
  pathLabel: string
}

function isCoreLessonTitle(title?: string): boolean {
  if (!title) return false
  return /\blesson\s+[0-9]{1,2}\b/i.test(title)
}

interface ScoredTarget {
  target: TargetRef
  score: number
  reason: string
  evidenceSnippet: string
  evidencePage: number | null
}

interface MaterialChunk {
  text: string
  page: number | null
}

export interface MaterialScanSkipRecord {
  materialId: string
  materialTitle: string
  reason: string
  code?: 'file-not-found' | 'pdf-parse-failed' | 'empty-text' | 'unsupported-type' | 'llm-failed' | 'mapping-low-confidence'
}

export interface MaterialScanResult {
  suggestions: MaterialMappingSuggestion[]
  processedCount: number
  skipped: MaterialScanSkipRecord[]
  errors: string[]
  analysisByMaterial: MaterialAnalysisResult[]
}

interface MaterialExtractedText {
  chunks: MaterialChunk[]
  extractionMode: 'pdf' | 'text' | 'metadata'
  errorCode?: MaterialScanSkipRecord['code']
  errorMessage?: string
}

const MAX_PDF_PAGES = 60
const MAX_TEXT_BYTES = 600_000
const CHUNK_WORD_TARGET = 130
const GEMINI_CHUNK_LIMIT = 22
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'] as const
let pdfWorkerConfigured = false

const AI_LESSON_SCHEMA = z.object({
  lessonTitle: z.string().min(1).max(180),
  lessonNumber: z.number().int().min(1).nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  signals: z.object({
    phonics: z.array(z.string()).default([]),
    fluency: z.array(z.string()).default([]),
    comprehension: z.array(z.string()).default([]),
    listening: z.array(z.string()).default([]),
    vocabulary: z.array(z.string()).default([]),
    grammar: z.array(z.string()).default([]),
    writing: z.array(z.string()).default([]),
    speaking: z.array(z.string()).default([]),
    assessment: z.array(z.string()).default([]),
    extensions: z.array(z.string()).default([]),
  }),
  evidence: z.array(z.object({
    field: z.string().min(2).max(40),
    snippet: z.string().min(5).max(500),
    page: z.number().int().min(1).nullable().optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
  })).default([]),
})

const AI_RESPONSE_SCHEMA = z.object({
  lessons: z.array(AI_LESSON_SCHEMA).max(40).default([]),
})

function metadataText(material: StoredBookMaterial): string {
  return [material.title, material.fileName, material.materialType, material.url].join(' ')
}

function extensionOf(filePath: string): string {
  const parsed = path.parse(filePath)
  return parsed.ext.toLowerCase()
}

async function extractPdfText(absFilePath: string, pageLimit = MAX_PDF_PAGES): Promise<MaterialChunk[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (!pdfWorkerConfigured) {
    const workerAbsPath = path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'legacy',
      'build',
      'pdf.worker.mjs',
    )
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerAbsPath).toString()
    pdfWorkerConfigured = true
  }
  const bytes = await readFile(absFilePath)
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
    stopAtErrors: false,
  })
  const doc = await task.promise
  const maxPages = Math.min(doc.numPages, Math.max(1, pageLimit))
  const chunks: MaterialChunk[] = []
  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const page = await doc.getPage(pageNo)
    const textContent = await page.getTextContent()
    const rows = textContent.items
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const src = item as { str?: unknown; transform?: unknown }
        const str = typeof src.str === 'string' ? src.str : ''
        const transform = Array.isArray(src.transform) ? src.transform : []
        const x = typeof transform[4] === 'number' ? transform[4] : 0
        const y = typeof transform[5] === 'number' ? transform[5] : 0
        if (!str.trim()) return null
        return { str: str.trim(), x, y }
      })
      .filter((item): item is { str: string; x: number; y: number } => !!item)
      .sort((a, b) => (Math.abs(b.y - a.y) < 1.5 ? a.x - b.x : b.y - a.y))
    const lines: string[] = []
    let lastY: number | null = null
    for (const row of rows) {
      if (lastY === null || Math.abs(row.y - lastY) > 2.2) {
        lines.push(row.str)
        lastY = row.y
      } else {
        lines[lines.length - 1] = `${lines[lines.length - 1]} ${row.str}`
      }
    }
    const raw = normalizeWhitespace(lines.join('\n'))
    if (raw) {
      chunks.push(...splitIntoChunks(raw, pageNo))
    }
  }
  return chunks
}

function splitIntoChunks(text: string, page: number | null): MaterialChunk[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const out: MaterialChunk[] = []
  out.push({
    text: normalizeWhitespace(text),
    page,
  })
  for (let i = 0; i < words.length; i += CHUNK_WORD_TARGET) {
    out.push({
      text: words.slice(i, i + CHUNK_WORD_TARGET).join(' ').trim(),
      page,
    })
  }
  return out
}

async function extractMaterialText(material: StoredBookMaterial): Promise<MaterialExtractedText> {
  const absPath = resolveBookLibraryFilePath(
    material.filePath,
    /* turbopackIgnore: true */ process.cwd(),
    getBookLibraryRoot(),
  )
  if (!absPath) {
    return {
      chunks: [],
      extractionMode: 'metadata',
      errorCode: 'file-not-found',
      errorMessage: 'File path is outside the book library.',
    }
  }
  const ext = extensionOf(absPath)
  try {
    await readFile(absPath)
  } catch {
    return { chunks: [], extractionMode: 'metadata', errorCode: 'file-not-found', errorMessage: 'File not found on disk.' }
  }
  if (ext === '.pdf') {
    try {
      const chunks = await extractPdfText(absPath)
      if (chunks.length > 0) return { chunks, extractionMode: 'pdf' }
      return { chunks: [], extractionMode: 'pdf', errorCode: 'empty-text', errorMessage: 'PDF parsed but no text extracted.' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PDF parse error.'
      return { chunks: [], extractionMode: 'pdf', errorCode: 'pdf-parse-failed', errorMessage: message }
    }
  }
  if (ext === '.txt' || ext === '.md') {
    try {
      const raw = await readFile(absPath, 'utf8')
      const limited = raw.slice(0, MAX_TEXT_BYTES)
      const chunks = splitIntoChunks(limited, null)
      if (!chunks.length) {
        return { chunks: [], extractionMode: 'text', errorCode: 'empty-text', errorMessage: 'Text file is empty.' }
      }
      return { chunks, extractionMode: 'text' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown text parse error.'
      return { chunks: [], extractionMode: 'text', errorCode: 'empty-text', errorMessage: message }
    }
  }
  return { chunks: [], extractionMode: 'metadata', errorCode: 'unsupported-type', errorMessage: `Unsupported file type: ${ext || 'none'}` }
}

function extractLessonNumber(text: string): string | null {
  const match = normalizeText(text).match(/\blesson\s+([0-9]+)\b/)
  return match?.[1] ?? null
}

function emptySections(): MaterialLessonSections {
  return {
    readAloud: [],
    anchorText: [],
    pairedSelection: [],
    selection: [],
    targetVocabulary: [],
    spelling: [],
    grammar: [],
    writing: [],
    essentialQuestion: [],
    comprehensionTargets: [],
    grammarVocabTargets: [],
    weeklyAssessments: [],
  }
}

function lessonNumberFromTitle(title?: string): number | null {
  if (!title) return null
  const match = normalizeText(title).match(/\blesson\s+([0-9]+)\b/)
  if (!match?.[1]) return null
  const num = Number(match[1])
  return Number.isFinite(num) && num > 0 ? num : null
}

function toList(value: string): string[] {
  return value
    .split(/\n|•|·|;|,/)
    .map((v) => v.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function extractLabeledSection(block: string, label: string): string[] {
  const labelPattern = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const allLabels = [
    'Read Aloud',
    'Anchor Text',
    'Paired Selection',
    'Essential Question',
    'Comprehension Targets',
    'Grammar/Vocab Targets',
    'Weekly Assessments',
    'Lesson\\s+[0-9]{1,2}',
  ].join('|')
  const rx = new RegExp(`${labelPattern}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${allLabels})\\s*:?)`, 'i')
  const matched = block.match(rx)
  if (!matched?.[1]) return []
  return toList(matched[1])
}

function mergeUniqueValues(...inputs: Array<string[] | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const input of inputs) {
    for (const value of input ?? []) {
      const cleaned = normalizeWhitespace(value)
      if (!cleaned) continue
      const key = cleaned.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(cleaned)
    }
  }
  return out
}

function mergeSignals(left: MaterialLessonSignals, right: MaterialLessonSignals): MaterialLessonSignals {
  return {
    phonics: mergeUniqueValues(left.phonics, right.phonics),
    fluency: mergeUniqueValues(left.fluency, right.fluency),
    comprehension: mergeUniqueValues(left.comprehension, right.comprehension),
    listening: mergeUniqueValues(left.listening, right.listening),
    vocabulary: mergeUniqueValues(left.vocabulary, right.vocabulary),
    grammar: mergeUniqueValues(left.grammar, right.grammar),
    writing: mergeUniqueValues(left.writing, right.writing),
    speaking: mergeUniqueValues(left.speaking, right.speaking),
    assessment: mergeUniqueValues(left.assessment, right.assessment),
    extensions: mergeUniqueValues(left.extensions, right.extensions),
  }
}

function mergeSections(left?: MaterialLessonSections, right?: MaterialLessonSections): MaterialLessonSections | undefined {
  if (!left && !right) return undefined
  const a = left ?? emptySections()
  const b = right ?? emptySections()
  return {
    readAloud: mergeUniqueValues(a.readAloud, b.readAloud),
    anchorText: mergeUniqueValues(a.anchorText, b.anchorText),
    pairedSelection: mergeUniqueValues(a.pairedSelection, b.pairedSelection),
    selection: mergeUniqueValues(a.selection, b.selection),
    targetVocabulary: mergeUniqueValues(a.targetVocabulary, b.targetVocabulary),
    spelling: mergeUniqueValues(a.spelling, b.spelling),
    grammar: mergeUniqueValues(a.grammar, b.grammar),
    writing: mergeUniqueValues(a.writing, b.writing),
    essentialQuestion: mergeUniqueValues(a.essentialQuestion, b.essentialQuestion),
    comprehensionTargets: mergeUniqueValues(a.comprehensionTargets, b.comprehensionTargets),
    grammarVocabTargets: mergeUniqueValues(a.grammarVocabTargets, b.grammarVocabTargets),
    weeklyAssessments: mergeUniqueValues(a.weeklyAssessments, b.weeklyAssessments),
  }
}

function mergeProfilesByLesson(profiles: MaterialLessonProfile[]): MaterialLessonProfile[] {
  const merged = new Map<string, MaterialLessonProfile>()
  for (const profile of profiles) {
    const pageKey = typeof profile.evidence[0]?.page === 'number' ? `page-${profile.evidence[0]?.page}` : 'page-?'
    const lessonKey =
      typeof profile.lessonNumber === 'number' && Number.isFinite(profile.lessonNumber)
        ? `num:${profile.inferredUnitId ?? pageKey}:${profile.lessonNumber}`
        : `title:${profile.inferredUnitId ?? pageKey}:${normalizeText(profile.lessonTitle)}`
    const existing = merged.get(lessonKey)
    if (!existing) {
      merged.set(lessonKey, profile)
      continue
    }
    merged.set(lessonKey, {
      ...existing,
      confidence:
        existing.confidence === 'high' || profile.confidence === 'high'
          ? 'high'
          : existing.confidence === 'medium' || profile.confidence === 'medium'
            ? 'medium'
            : 'low',
      lessonTitle: existing.lessonTitle.length >= profile.lessonTitle.length ? existing.lessonTitle : profile.lessonTitle,
      inferredUnitId: existing.inferredUnitId ?? profile.inferredUnitId,
      inferredLessonId: existing.inferredLessonId ?? profile.inferredLessonId,
      inferredPartId: existing.inferredPartId ?? profile.inferredPartId,
      inferredPathLabel: existing.inferredPathLabel ?? profile.inferredPathLabel,
      sectionFields: mergeSections(existing.sectionFields, profile.sectionFields),
      signals: mergeSignals(existing.signals, profile.signals),
      evidence: [...existing.evidence, ...profile.evidence].slice(0, 12),
    })
  }
  return [...merged.values()].sort((a, b) => (a.lessonNumber ?? 999) - (b.lessonNumber ?? 999))
}

function parseCurriculumMapProfiles(chunks: MaterialChunk[]): { profiles: MaterialLessonProfile[]; detectedUnits: string[] } {
  const pageChunks = chunks.filter((chunk) => typeof chunk.page === 'number')
  const fullPageChunks = pageChunks.filter((chunk) => chunk.text.includes('\n') && chunk.text.length > 300)
  const profiles: MaterialLessonProfile[] = []
  const detectedUnits: string[] = []
  const sectionLabels = [
    'Read Aloud',
    'Anchor Text',
    'Paired Selection',
    'Essential Question',
    'Comprehension Targets',
    'Grammar/Vocab Targets',
    'Weekly Assessments',
  ] as const
  type SectionLabel = typeof sectionLabels[number]
  function canonicalizeSectionLabel(input: string): SectionLabel | null {
    const normalized = normalizeText(input)
    if (normalized.includes('read aloud')) return 'Read Aloud'
    if (normalized.includes('anchor text')) return 'Anchor Text'
    if (normalized.includes('paired selection')) return 'Paired Selection'
    if (normalized.includes('essential question') || normalized.includes('essencial question')) return 'Essential Question'
    if (normalized.includes('comprehension target')) return 'Comprehension Targets'
    if (normalized.includes('grammar vocab target')) return 'Grammar/Vocab Targets'
    if (normalized.includes('weekly assessment')) return 'Weekly Assessments'
    return null
  }
  const cleanValue = (value: string): string =>
    normalizeWhitespace(value)
      .replace(/^[:\-•\s]+/, '')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim()

  function buildMarkerValues(pageText: string): Record<SectionLabel, string[]> {
    const markerRegex =
      /(Read\s*Aloud|A\s*n\s*c?\s*h?o?r\s*Text|Paired\s*Selection|Ess?e?n?t?i?a?l\s*Question|Comprehension\s*Targets?|Grammar\s*\/\s*Vocab\s*Targets?|Weekly\s*Assessments?[A-Za-z]*)\s*:/gi
    const markers: Array<{ label: SectionLabel; start: number; contentStart: number }> = []
    for (const match of pageText.matchAll(markerRegex)) {
      const rawLabel = String(match[1] ?? '').trim().replace(/\s+/g, ' ')
      const label = canonicalizeSectionLabel(rawLabel)
      if (!label) continue
      const start = match.index ?? 0
      markers.push({
        label,
        start,
        contentStart: start + String(match[0] ?? '').length,
      })
    }
    const grouped = Object.fromEntries(sectionLabels.map((label) => [label, [] as string[]])) as Record<SectionLabel, string[]>
    for (let i = 0; i < markers.length; i += 1) {
      const current = markers[i]
      const next = markers[i + 1]
      const value = cleanValue(pageText.slice(current.contentStart, next?.start ?? pageText.length))
      if (value) grouped[current.label].push(value)
    }
    return grouped
  }

  const pages = [...fullPageChunks].sort((a, b) => (a.page ?? 0) - (b.page ?? 0))
  for (const pageChunk of pages) {
    const pageText = normalizeWhitespace(pageChunk.text)
    const unitMatch = pageText.match(/\bUnit\s+([0-9]{1,2})\b/i)
    if (unitMatch?.[0]) detectedUnits.push(unitMatch[0])
    const inferredUnitId = unitMatch?.[1] ? `unit-${unitMatch[1]}` : undefined
    const lessonNumbers = [...new Set(
      [...pageText.matchAll(/\bLesson\s+([0-9]{1,2})\b/gi)]
        .map((match) => Number(match[1] ?? ''))
        .filter((num) => Number.isFinite(num) && num > 0),
    )].slice(0, 8)
    if (!lessonNumbers.length) continue
    const byLabel = buildMarkerValues(pageText)
    for (let idx = 0; idx < lessonNumbers.length; idx += 1) {
      const lessonNumber = lessonNumbers[idx]
      const sections = emptySections()
      sections.readAloud = toList(byLabel['Read Aloud'][idx] ?? '').slice(0, 6)
      sections.anchorText = toList(byLabel['Anchor Text'][idx] ?? '').slice(0, 6)
      sections.pairedSelection = toList(byLabel['Paired Selection'][idx] ?? '').slice(0, 6)
      sections.essentialQuestion = toList(byLabel['Essential Question'][idx] ?? '').slice(0, 6)
      sections.comprehensionTargets = toList(byLabel['Comprehension Targets'][idx] ?? '').slice(0, 10)
      sections.grammarVocabTargets = toList(byLabel['Grammar/Vocab Targets'][idx] ?? '').slice(0, 10)
      sections.weeklyAssessments = toList(byLabel['Weekly Assessments'][idx] ?? '').slice(0, 10)
      sections.selection = mergeUniqueValues(sections.anchorText, sections.pairedSelection)
      const hasUsefulContent =
        sections.readAloud.length > 0 ||
        sections.anchorText.length > 0 ||
        sections.essentialQuestion.length > 0 ||
        sections.comprehensionTargets.length > 0
      if (!hasUsefulContent) continue
      const lessonHeader = sections.anchorText[0]
        ? `Lesson ${lessonNumber}: ${sections.anchorText[0]}`
        : `Lesson ${lessonNumber}`
      const signals = emptySignals()
      signals.comprehension = sections.comprehensionTargets
      signals.grammar = sections.grammarVocabTargets
      signals.vocabulary = sections.grammarVocabTargets
      signals.assessment = sections.weeklyAssessments
      const evidence: MaterialEvidence[] = []
      if (sections.essentialQuestion[0]) {
        evidence.push({
          field: 'essential-question',
          snippet: sections.essentialQuestion[0],
          page: pageChunk.page,
          confidence: 'high',
        })
      } else {
        evidence.push({
          field: 'lesson',
          snippet: pageText.slice(0, 260),
          page: pageChunk.page,
          confidence: 'medium',
        })
      }
      profiles.push({
        lessonTitle: lessonHeader,
        lessonNumber,
        inferredUnitId,
        confidence: sections.comprehensionTargets.length > 0 ? 'high' : 'medium',
        sectionFields: sections,
        signals,
        evidence,
      })
    }

    // Journeys two-page unit spread support:
    // right page often carries vocabulary/spelling/grammar/writing by lesson row.
    const lessonRows = [...pageText.matchAll(/(?:^|\n)\s*([1-9]|1[0-9]|2[0-9])\s*(?=\n)/g)]
      .map((m) => Number(m[1] ?? ''))
      .filter((v, i, arr) => Number.isFinite(v) && v > 0 && arr.indexOf(v) === i)
      .slice(0, 8)
    if (lessonRows.length) {
      const markerRegex =
        /(Main\s*Selection|Paired\s*Selection|Target\s*Vocabulary|Vocabulary\s*Strategies|Spelling\s*Principle|Spelling\s*Words|Writing\s*Mode|Focus\s*Trait)\s*:?/gi
      const markers = [...pageText.matchAll(markerRegex)].map((m) => ({
        label: String(m[1] ?? ''),
        start: m.index ?? 0,
        end: (m.index ?? 0) + String(m[0] ?? '').length,
      }))
      const byLabel = new Map<string, string[]>()
      for (let i = 0; i < markers.length; i += 1) {
        const current = markers[i]
        const next = markers[i + 1]
        const label = normalizeText(current.label)
        const chunkText = normalizeWhitespace(pageText.slice(current.end, next?.start ?? pageText.length))
        if (!chunkText) continue
        byLabel.set(label, [...(byLabel.get(label) ?? []), chunkText])
      }
      for (let idx = 0; idx < lessonRows.length; idx += 1) {
        const lessonNumber = lessonRows[idx]
        const sections = emptySections()
        sections.selection = mergeUniqueValues(
          toList(byLabel.get('main selection')?.[idx] ?? ''),
          toList(byLabel.get('paired selection')?.[idx] ?? ''),
        ).slice(0, 8)
        sections.targetVocabulary = mergeUniqueValues(
          toList(byLabel.get('target vocabulary')?.[idx] ?? ''),
          toList(byLabel.get('vocabulary strategies')?.[idx] ?? ''),
        ).slice(0, 10)
        sections.spelling = mergeUniqueValues(
          toList(byLabel.get('spelling principle')?.[idx] ?? ''),
          toList(byLabel.get('spelling words')?.[idx] ?? ''),
        ).slice(0, 12)
        sections.writing = mergeUniqueValues(
          toList(byLabel.get('writing mode')?.[idx] ?? ''),
          toList(byLabel.get('focus trait')?.[idx] ?? ''),
        ).slice(0, 10)
        const hasTableContent = sections.selection.length || sections.targetVocabulary.length || sections.spelling.length || sections.writing.length
        if (!hasTableContent) continue
        const signals = emptySignals()
        signals.vocabulary = sections.targetVocabulary
        signals.extensions = sections.spelling
        signals.writing = sections.writing
        const evidence: MaterialEvidence[] = [{
          field: 'lesson-row',
          snippet: (sections.selection[0] ?? sections.targetVocabulary[0] ?? sections.spelling[0] ?? sections.writing[0] ?? '').slice(0, 260),
          page: pageChunk.page,
          confidence: 'medium',
        }]
        profiles.push({
          lessonTitle: sections.selection[0] ? `Lesson ${lessonNumber}: ${sections.selection[0]}` : `Lesson ${lessonNumber}`,
          lessonNumber,
          inferredUnitId,
          confidence: 'medium',
          sectionFields: sections,
          signals,
          evidence,
        })
      }
    }
  }
  return { profiles: mergeProfilesByLesson(profiles), detectedUnits: [...new Set(detectedUnits)] }
}

function buildTargets(book: BookRecord): TargetRef[] {
  const out: TargetRef[] = []
  for (const unit of book.units) {
    const lessons = unit.lessons ?? []
    if (!lessons.length) {
      out.push({
        unitId: unit.id,
        unitTitle: unit.title,
        pathLabel: `${unit.title}`,
      })
      continue
    }
    for (const lesson of lessons) {
      if (!isCoreLessonTitle(lesson.title)) {
        continue
      }
      const parts = lesson.parts ?? []
      out.push({
        unitId: unit.id,
        unitTitle: unit.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        pathLabel: `${unit.title} / ${lesson.title}`,
      })
      for (const part of parts) {
        out.push({
          unitId: unit.id,
          unitTitle: unit.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          partId: part.id,
          partTitle: part.title,
          pathLabel: `${unit.title} / ${lesson.title} / ${part.title}`,
        })
      }
    }
  }
  return out
}

function scoreTarget(chunk: MaterialChunk, target: TargetRef): ScoredTarget {
  const materialText = chunk.text
  const targetText = [target.unitTitle, target.lessonTitle ?? '', target.partTitle ?? ''].join(' ')
  let score = tokenOverlapScore(materialText, targetText) * 10
  const normalizedMaterial = normalizeText(materialText)
  const normalizedPath = normalizeText(target.pathLabel)
  if (normalizedMaterial.includes(normalizeText(target.lessonTitle ?? '')) && (target.lessonTitle ?? '').trim()) score += 2
  if (normalizedMaterial.includes(normalizeText(target.partTitle ?? '')) && (target.partTitle ?? '').trim()) score += 2
  if (normalizedMaterial.includes(normalizeText(target.unitTitle))) score += 1
  const mLessonNum = extractLessonNumber(materialText)
  const tLessonNum = extractLessonNumber(target.lessonTitle ?? '')
  if (mLessonNum && tLessonNum && mLessonNum === tLessonNum) score += 3
  if (normalizedMaterial.includes(normalizedPath)) score += 1
  const snippet = materialText.length > 220 ? `${materialText.slice(0, 220)}...` : materialText
  return {
    target,
    score,
    reason:
      mLessonNum && tLessonNum && mLessonNum === tLessonNum
        ? `Lesson number ${mLessonNum} matched + title overlap`
        : 'Title/token overlap match',
    evidenceSnippet: snippet,
    evidencePage: chunk.page,
  }
}

export interface MaterialMappingSuggestion extends MaterialLinkMapping {
  materialTitle: string
  materialFilePath: string
  pathLabel: string
  score: number
  detectedSignals: string[]
  extractedLessonTitle?: string
}

export function suggestMappings(bookId: string, book: BookRecord, materials: StoredBookMaterial[]): MaterialMappingSuggestion[] {
  const targets = buildTargets(book)
  const suggestions: MaterialMappingSuggestion[] = []
  for (const material of materials) {
    if (!targets.length) continue
    const fallbackChunk: MaterialChunk = { text: metadataText(material), page: null }
    const scored = targets.map((target) => scoreTarget(fallbackChunk, target)).sort((a, b) => b.score - a.score)
    const best = scored[0]
    if (!best || best.score < 1.5) continue
    const confidence: 'high' | 'medium' | 'low' = best.score >= 8 ? 'high' : best.score >= 4 ? 'medium' : 'low'
    suggestions.push({
      materialId: material.id,
      materialTitle: material.title,
      materialFilePath: material.filePath,
      bookId,
      unitId: best.target.unitId,
      lessonId: best.target.lessonId,
      partId: best.target.partId,
      confidence,
      reason: best.reason,
      sourceFilePath: material.filePath,
      evidenceSnippet: best.evidenceSnippet,
      evidencePage: best.evidencePage,
      pathLabel: best.target.pathLabel,
      score: Math.round(best.score * 100) / 100,
      mappedAt: new Date().toISOString(),
      detectedSignals: [],
    })
  }
  return suggestions
}

function parseGeminiJson(raw: string): unknown {
  const trimmed = raw.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed
  const first = withoutFence.indexOf('{')
  const last = withoutFence.lastIndexOf('}')
  const candidate = first >= 0 && last > first ? withoutFence.slice(first, last + 1) : withoutFence
  return JSON.parse(candidate)
}

async function callGeminiJson(key: string, prompt: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text:
                  'Extract lesson-level instructional structure from curriculum documents. Return strict JSON only.',
              }],
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              maxOutputTokens: 4096,
            },
          }),
        },
      )
      if (!res.ok) {
        continue
      }
      const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (text) return { ok: true, text }
    } catch {
      continue
    }
  }
  return { ok: false, error: 'Gemini extraction request failed for all model candidates.' }
}

function collectSignalTags(signals: MaterialLessonSignals): string[] {
  const out: string[] = []
  const pushIf = (key: keyof MaterialLessonSignals) => {
    if (signals[key].length > 0) out.push(key)
  }
  pushIf('phonics')
  pushIf('fluency')
  pushIf('comprehension')
  pushIf('listening')
  pushIf('vocabulary')
  pushIf('grammar')
  pushIf('writing')
  pushIf('speaking')
  pushIf('assessment')
  pushIf('extensions')
  return out
}

function buildExtractionPrompt(book: BookRecord, material: StoredBookMaterial, chunks: MaterialChunk[]): string {
  const chunkLines = chunks.slice(0, GEMINI_CHUNK_LIMIT).map((chunk, idx) => {
    const p = typeof chunk.page === 'number' ? `p${chunk.page}` : 'p?'
    return `Chunk ${idx + 1} (${p}): ${chunk.text}`
  })
  const units = book.units.map((unit) => ({
    unitTitle: unit.title,
    lessons: (unit.lessons ?? [])
      .map((lesson) => lesson.title)
      .filter((title): title is string => typeof title === 'string' && isCoreLessonTitle(title)),
  }))
  return [
    'Extract lesson profiles and pedagogical parameters from this ESL support material.',
    'Layout hint: this document often has one Unit per page and five Lesson columns on the same page.',
    'Each lesson may contain repeated labeled blocks like Essential Question, Comprehension Targets, Grammar/Vocab Targets, Weekly Assessments, Phonics, Fluency, Listening.',
    'Use only evidence present in chunks.',
    'Return JSON with shape: { lessons: [{ lessonTitle, lessonNumber, confidence, signals, evidence[] }] }.',
    'Signals keys: phonics, fluency, comprehension, listening, vocabulary, grammar, writing, speaking, assessment, extensions.',
    `Material title: ${material.title || material.fileName}`,
    `Book units/lessons context: ${JSON.stringify(units).slice(0, 8000)}`,
    'Content chunks:',
    ...chunkLines,
  ].join('\n')
}

function emptySignals(): MaterialLessonSignals {
  return {
    phonics: [],
    fluency: [],
    comprehension: [],
    listening: [],
    vocabulary: [],
    grammar: [],
    writing: [],
    speaking: [],
    assessment: [],
    extensions: [],
  }
}

async function extractLessonProfilesWithGemini(
  book: BookRecord,
  material: StoredBookMaterial,
  chunks: MaterialChunk[],
): Promise<{ profiles: MaterialLessonProfile[]; errors: string[] }> {
  const key = await resolveGeminiApiKey()
  if (!key) return { profiles: [], errors: ['Gemini API key is missing.'] }
  const prompt = buildExtractionPrompt(book, material, chunks)
  const ai = await callGeminiJson(key, prompt)
  if (!ai.ok) return { profiles: [], errors: [ai.error] }
  try {
    const parsed = AI_RESPONSE_SCHEMA.parse(parseGeminiJson(ai.text))
    const profiles: MaterialLessonProfile[] = parsed.lessons.map((lesson) => ({
      lessonTitle: lesson.lessonTitle.trim(),
      lessonNumber: lesson.lessonNumber ?? null,
      confidence: lesson.confidence ?? 'medium',
      signals: {
        phonics: lesson.signals.phonics.map((v) => v.trim()).filter(Boolean),
        fluency: lesson.signals.fluency.map((v) => v.trim()).filter(Boolean),
        comprehension: lesson.signals.comprehension.map((v) => v.trim()).filter(Boolean),
        listening: lesson.signals.listening.map((v) => v.trim()).filter(Boolean),
        vocabulary: lesson.signals.vocabulary.map((v) => v.trim()).filter(Boolean),
        grammar: lesson.signals.grammar.map((v) => v.trim()).filter(Boolean),
        writing: lesson.signals.writing.map((v) => v.trim()).filter(Boolean),
        speaking: lesson.signals.speaking.map((v) => v.trim()).filter(Boolean),
        assessment: lesson.signals.assessment.map((v) => v.trim()).filter(Boolean),
        extensions: lesson.signals.extensions.map((v) => v.trim()).filter(Boolean),
      },
      evidence: lesson.evidence.map((row) => ({
        field: row.field.trim(),
        snippet: row.snippet.trim(),
        page: row.page ?? null,
        confidence: row.confidence ?? 'medium',
      })).filter((row) => row.snippet.length >= 5),
    }))
    return { profiles, errors: [] }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate Gemini lesson extraction response.'
    return { profiles: [], errors: [message] }
  }
}

function chooseMappingForProfile(profile: MaterialLessonProfile, targets: TargetRef[]): ScoredTarget | null {
  const profileText = [
    profile.lessonTitle,
    ...collectSignalTags(profile.signals),
    ...profile.evidence.map((e) => e.snippet),
  ].join(' ')
  const chunk: MaterialChunk = { text: profileText, page: profile.evidence[0]?.page ?? null }
  const scored = targets
    .map((target) => {
      const base = scoreTarget(chunk, target)
      const targetLessonNum = lessonNumberFromTitle(target.lessonTitle)
      const profileLessonNum = profile.lessonNumber
      if (profileLessonNum && targetLessonNum && profileLessonNum === targetLessonNum) {
        return {
          ...base,
          score: base.score + 8,
          reason: `Lesson number ${profileLessonNum} matched target lesson`,
        }
      }
      return base
    })
    .sort((a, b) => b.score - a.score)
  return scored[0] ?? null
}

function fallbackRuleProfiles(chunks: MaterialChunk[]): MaterialLessonProfile[] {
  const out: MaterialLessonProfile[] = []
  const seen = new Set<string>()
  const splitRegex = /(?:^|\n)\s*(lesson\s+[0-9]{1,2}[^\n]*)/gi
  const section = (block: string, label: string): string[] => {
    const rx = new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, 'i')
    const m = block.match(rx)
    if (!m?.[1]) return []
    return m[1].split(/[;,]/).map((v) => v.trim()).filter(Boolean)
  }
  for (const chunk of chunks.slice(0, 30)) {
    const full = normalizeWhitespace(chunk.text)
    const parts = full.split(splitRegex).filter(Boolean)
    for (const part of parts) {
      const header = part.match(/lesson\s+([0-9]{1,2})(.*)$/i)
      if (!header) continue
      const lessonNumber = Number(header[1] ?? '')
      if (!Number.isFinite(lessonNumber) || lessonNumber < 1) continue
      const titleSuffix = (header[2] ?? '').trim()
      const lessonTitle = titleSuffix ? `Lesson ${lessonNumber} ${titleSuffix}` : `Lesson ${lessonNumber}`
      if (seen.has(lessonTitle.toLowerCase())) continue
      seen.add(lessonTitle.toLowerCase())
      const signals = emptySignals()
      signals.comprehension = section(part, 'Comprehension Targets')
      signals.grammar = section(part, 'Grammar\\/Vocab Targets')
      signals.vocabulary = section(part, 'Grammar\\/Vocab Targets')
      signals.assessment = section(part, 'Weekly Assessments')
      signals.listening = section(part, 'Listening')
      signals.phonics = section(part, 'Phonics')
      signals.fluency = section(part, 'Fluency')
      const essential = section(part, 'Essential Question')
      const evidenceSnippet = part.slice(0, 320)
      out.push({
        lessonTitle,
        lessonNumber,
        confidence: essential.length > 0 || signals.comprehension.length > 0 ? 'medium' : 'low',
        signals,
        evidence: [{
          field: 'lesson',
          snippet: evidenceSnippet,
          page: chunk.page,
          confidence: 'low',
        }, ...essential.map((q) => ({
          field: 'essential-question',
          snippet: q,
          page: chunk.page,
          confidence: 'medium' as const,
        }))],
      })
      if (out.length >= 20) return out
    }
  }
  return out
}

export async function analyzeMaterialsForMappings(
  bookId: string,
  book: BookRecord,
  materials: StoredBookMaterial[],
  bookFolder?: string,
): Promise<MaterialScanResult> {
  const targets = buildTargets(book)
  const suggestions: MaterialMappingSuggestion[] = []
  const skipped: MaterialScanSkipRecord[] = []
  const errors: string[] = []
  const analysisByMaterial: MaterialAnalysisResult[] = []
  let processedCount = 0
  for (const material of materials) {
    if (!targets.length) {
      skipped.push({
        materialId: material.id,
        materialTitle: material.title || material.fileName,
        reason: 'Book has no unit/lesson targets to map against.',
        code: 'mapping-low-confidence',
      })
      continue
    }
    const extracted = await extractMaterialText(material)
    if (!extracted.chunks.length) {
      skipped.push({
        materialId: material.id,
        materialTitle: material.title || material.fileName,
        reason: extracted.errorMessage ?? 'No readable text extracted.',
        code: extracted.errorCode ?? 'empty-text',
      })
      analysisByMaterial.push({
        materialId: material.id,
        materialTitle: material.title || material.fileName,
        materialFilePath: material.filePath,
        parsedAt: new Date().toISOString(),
        parseStatus: 'failed',
        extractionMode: extracted.extractionMode,
        detectedUnits: [],
        lessonProfiles: [],
        errors: [extracted.errorMessage ?? 'No readable text extracted.'],
      })
      continue
    }
    processedCount += 1
    const structured = parseCurriculumMapProfiles(extracted.chunks)
    const ai = await extractLessonProfilesWithGemini(book, material, extracted.chunks)
    let profiles =
      structured.profiles.length > 0
        ? mergeProfilesByLesson([...structured.profiles, ...ai.profiles])
        : ai.profiles
    const profileErrors = [...ai.errors]
    if (profiles.length === 0) {
      const fallback = fallbackRuleProfiles(extracted.chunks)
      if (fallback.length > 0) {
        profiles = fallback
      } else {
        skipped.push({
          materialId: material.id,
          materialTitle: material.title || material.fileName,
          reason: profileErrors[0] ?? 'No lesson profiles extracted.',
          code: 'llm-failed',
        })
        analysisByMaterial.push({
          materialId: material.id,
          materialTitle: material.title || material.fileName,
          materialFilePath: material.filePath,
          parsedAt: new Date().toISOString(),
          parseStatus: 'failed',
          extractionMode: extracted.extractionMode,
          detectedUnits: structured.detectedUnits,
          lessonProfiles: [],
          errors: profileErrors.length ? profileErrors : ['No lesson profiles extracted.'],
        })
        errors.push(`${material.fileName}: ${profileErrors[0] ?? 'No lesson profiles extracted.'}`)
        continue
      }
    }
    let bestSuggestion: MaterialMappingSuggestion | null = null
    const enrichedProfiles: MaterialLessonProfile[] = []
    for (const profile of profiles) {
      const mapped = chooseMappingForProfile(profile, targets)
      if (!mapped) {
        // Keep extracted profile for downstream consumers (framework table populate),
        // even when structural mapping confidence is low.
        enrichedProfiles.push(profile)
        continue
      }
      const confidence: 'high' | 'medium' | 'low' = mapped.score >= 8 ? 'high' : mapped.score >= 4.5 ? 'medium' : 'low'
      const signalTags = collectSignalTags(profile.signals)
      const profileWithMap: MaterialLessonProfile = {
        ...profile,
        inferredUnitId: mapped.target.unitId,
        inferredLessonId: mapped.target.lessonId,
        inferredPartId: mapped.target.partId,
        inferredPathLabel: mapped.target.pathLabel,
      }
      enrichedProfiles.push(profileWithMap)
      const candidate: MaterialMappingSuggestion = {
        materialId: material.id,
        materialTitle: material.title || material.fileName,
        materialFilePath: material.filePath,
        bookId,
        unitId: mapped.target.unitId,
        lessonId: mapped.target.lessonId,
        partId: mapped.target.partId,
        confidence,
        reason: mapped.reason,
        sourceFilePath: material.filePath,
        evidenceSnippet: profile.evidence[0]?.snippet ?? mapped.evidenceSnippet,
        evidencePage: profile.evidence[0]?.page ?? mapped.evidencePage,
        lessonProfileSnapshot: profileWithMap,
        pathLabel: mapped.target.pathLabel,
        score: Math.round(mapped.score * 100) / 100,
        detectedSignals: signalTags,
        extractedLessonTitle: profile.lessonTitle,
        mappedAt: new Date().toISOString(),
      }
      if (!bestSuggestion || candidate.score > bestSuggestion.score) {
        bestSuggestion = candidate
      }
    }
    if (!bestSuggestion) {
      skipped.push({
        materialId: material.id,
        materialTitle: material.title || material.fileName,
        reason: 'Lesson profiles extracted but no confident Unit/Lesson/Part mapping found.',
        code: 'mapping-low-confidence',
      })
      analysisByMaterial.push({
        materialId: material.id,
        materialTitle: material.title || material.fileName,
        materialFilePath: material.filePath,
        parsedAt: new Date().toISOString(),
        parseStatus: 'partial',
        extractionMode: extracted.extractionMode,
        detectedUnits: structured.detectedUnits,
        lessonProfiles: enrichedProfiles.length ? enrichedProfiles : profiles,
        errors: profileErrors,
      })
      continue
    }
    suggestions.push(bestSuggestion)
    analysisByMaterial.push({
      materialId: material.id,
      materialTitle: material.title || material.fileName,
      materialFilePath: material.filePath,
      parsedAt: new Date().toISOString(),
      parseStatus: profileErrors.length ? 'partial' : 'ok',
      extractionMode: extracted.extractionMode,
      detectedUnits: structured.detectedUnits,
      lessonProfiles: enrichedProfiles.length ? enrichedProfiles : profiles,
      errors: profileErrors,
    })
  }
  if (bookFolder) {
    const existing = await readMaterialAnalyses(bookFolder)
    const nextById = new Map<string, MaterialAnalysisResult>()
    for (const item of existing) nextById.set(item.materialId, item)
    for (const item of analysisByMaterial) nextById.set(item.materialId, item)
    await saveMaterialAnalyses(bookFolder, [...nextById.values()])
  }
  return { suggestions, processedCount, skipped, errors, analysisByMaterial }
}
