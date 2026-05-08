import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveGeminiApiKey } from '@/lib/gemini'
import { DEFAULT_BOOK_FOCUS_AREAS } from '@/lib/context/types'
import type {
  BookContextDraftRecord,
  BookContextMaterialRecord,
  BookContextScanInput,
  BookContextSourceRecord,
  ContextFieldConfidence,
  LessonContextRecord,
  LessonContextScanInput,
  UnitContextRecord,
  UnitContextScanInput,
} from '@/lib/context/types'
import {
  clampPageRange,
  CONTEXT_VERSION,
  normalizeScanProfile,
  stableId,
  trimList,
} from '@/lib/context/utils'

const BOOK_FOCUS_AREAS_DEFAULT: string[] = [...DEFAULT_BOOK_FOCUS_AREAS]

const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const
const TAVILY_SEARCH_ENDPOINT = 'https://api.tavily.com/search'

interface SearchCredentials { apiKey: string }

interface SearchItem {
  title: string
  link: string
  snippet: string
}

function isLikelyDownloadableUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.endsWith('.pdf') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.ppt') ||
    lower.endsWith('.pptx') ||
    lower.includes('.pdf?') ||
    lower.includes('/download')
  )
}

function classifyMaterialType(item: SearchItem): BookContextMaterialRecord['type'] {
  const text = `${item.title} ${item.snippet}`.toLowerCase()
  if (text.includes('scope and sequence') || text.includes('scope & sequence')) return 'scope-sequence'
  if (text.includes('pacing guide') || text.includes('curriculum map')) return 'pacing-guide'
  if (text.includes('teacher edition') || text.includes('teacher guide')) return 'teacher-edition'
  if (text.includes('assessment') || text.includes('benchmark')) return 'assessment'
  if (text.includes('intervention') || text.includes('rti')) return 'intervention'
  if (text.includes('grammar') || text.includes('writing')) return 'grammar-writing'
  if (text.includes('vocabulary') || text.includes('word list')) return 'vocabulary'
  if (text.includes('resource') || text.includes('digital')) return 'digital-resource'
  return 'other'
}

function isLikelyPaidSource(item: SearchItem): boolean {
  const url = item.link.toLowerCase()
  const text = `${item.title} ${item.snippet}`.toLowerCase()
  if (url.includes('amazon.') || url.includes('ebay.') || url.includes('teacherspayteachers.')) return true
  if (url.includes('/shop/') || url.includes('/product/')) return true
  if (text.includes('add to cart') || text.includes('need to purchase') || text.includes('contact sales') || text.includes('$')) {
    return true
  }
  return false
}

function isLikelyFreeSource(item: SearchItem): boolean {
  const url = item.link.toLowerCase()
  const text = `${item.title} ${item.snippet}`.toLowerCase()
  if (url.endsWith('.pdf') || url.includes('.pdf')) return true
  if (
    text.includes('curriculum map') ||
    text.includes('scope and sequence') ||
    text.includes('lesson plan') ||
    text.includes('teacher guide') ||
    text.includes('free resource') ||
    text.includes('public')
  ) return true
  return false
}

let resolvedSearchCredentials: SearchCredentials | null | undefined

async function resolveGoogleSearchCredentials(): Promise<SearchCredentials | null> {
  if (resolvedSearchCredentials !== undefined) return resolvedSearchCredentials
  const envApiKey = process.env.TAVILY_API_KEY?.trim()
  if (envApiKey) {
    resolvedSearchCredentials = { apiKey: envApiKey }
    return resolvedSearchCredentials
  }
  try {
    const localEnvRaw = await readFile(join(/* turbopackIgnore: true */ process.cwd(), '.env.local'), 'utf8')
    const lines = localEnvRaw.split(/\r?\n/)
    const map = new Map<string, string>()
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      map.set(key, value)
    }
    const apiKey = map.get('TAVILY_API_KEY')?.trim() || ''
    if (apiKey) {
      resolvedSearchCredentials = { apiKey }
      return resolvedSearchCredentials
    }
  } catch {
    // ignore
  }
  resolvedSearchCredentials = null
  return null
}

function scoreSource(item: SearchItem): number {
  const text = `${item.title} ${item.snippet}`.toLowerCase()
  const url = item.link.toLowerCase()
  let score = 0
  if (url.includes('hmhco.com')) score += 4
  if (url.includes('.edu') || url.includes('.gov')) score += 2
  if (url.includes('district') || url.includes('schools')) score += 1
  if (text.includes('journeys')) score += 2
  if (text.includes('grade 3')) score += 2
  if (text.includes('teacher')) score += 1
  if (text.includes('pacing')) score += 1
  if (text.includes('scope and sequence')) score += 1
  if (/(isbn|product code|copyright year)/i.test(text)) score += 1
  return score
}

function trustFromScore(score: number): ContextFieldConfidence {
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

async function searchWebSources(
  query: string,
  options?: {
    limit?: number
    materialTypes?: BookContextMaterialRecord['type'][]
    downloadableOnly?: boolean
    searchMode?: 'official-first' | 'broad'
  },
): Promise<BookContextSourceRecord[]> {
  const creds = await resolveGoogleSearchCredentials()
  if (!creds) throw new Error('Missing Tavily credentials. Set TAVILY_API_KEY.')
  const limit = Math.max(1, Math.min(options?.limit ?? 8, 20))
  const allowedMaterialTypes = new Set((options?.materialTypes ?? []).map((item) => item.trim()))
  const filterByMaterialType = allowedMaterialTypes.size > 0
  const res = await fetch(TAVILY_SEARCH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: creds.apiKey,
      query,
      search_depth: 'basic',
      max_results: limit,
    }),
  })
  if (!res.ok) throw new Error(`Web search failed (${res.status}).`)
  const payload = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> }
  const items = Array.isArray(payload.results)
    ? payload.results.map((item) => ({
      title: item.title,
      link: item.url,
      snippet: item.content,
    }))
    : []
  return items
    .map((raw): SearchItem | null => {
      const title = String(raw.title ?? '').trim()
      const link = String(raw.link ?? '').trim()
      const snippet = String(raw.snippet ?? '').trim()
      if (!title || !link) return null
      return { title, link, snippet }
    })
    .filter((item): item is SearchItem => !!item)
    .filter((item) => !isLikelyPaidSource(item))
    .filter((item) => (options?.downloadableOnly ? isLikelyDownloadableUrl(item.link) : true))
    .filter((item) => {
      if (!filterByMaterialType) return true
      const type = classifyMaterialType(item)
      return allowedMaterialTypes.has(type)
    })
    .map((item) => {
      const trustScore = scoreSource(item)
      const officialBoost =
        options?.searchMode === 'official-first' && /hmhco\.com|\.edu|\.gov|district|schools/.test(item.link.toLowerCase())
          ? 2
          : 0
      const adjustedScore = (isLikelyFreeSource(item) ? trustScore + 1 : trustScore) + officialBoost
      return {
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        trustScore: adjustedScore,
        confidence: trustFromScore(adjustedScore),
      }
    })
    .sort((a, b) => b.trustScore - a.trustScore)
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const key = await resolveGeminiApiKey()
  if (!key) return null
  for (const model of MODEL_CANDIDATES) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      },
    )
    if (!res.ok) continue
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text === 'string' && text.trim()) return text.trim()
  }
  return null
}

function parseJson(text: string): unknown {
  const clean = text.trim().startsWith('```')
    ? text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : text.trim()
  return JSON.parse(clean)
}

function trimSnippet(value: unknown, max = 250): string {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

export async function scanBookContextDraft(input: BookContextScanInput): Promise<BookContextDraftRecord> {
  const bookId = input.bookId.trim()
  const now = new Date().toISOString()
  const range = input.sourcePageRange ? clampPageRange(input.sourcePageRange) : null
  const hintBits = (input.versionHints ?? []).map((v) => v.trim()).filter(Boolean).slice(0, 6)
  const gradePart = input.gradeHint?.trim() ? ` ${input.gradeHint.trim()}` : ''
  const materialHints = (input.materialTypes ?? [])
    .map((type) => {
      if (type === 'pacing-guide') return 'pacing guide'
      if (type === 'scope-sequence') return 'scope and sequence'
      if (type === 'teacher-edition') return 'teacher edition'
      if (type === 'assessment') return 'assessment guide'
      if (type === 'intervention') return 'intervention guide'
      if (type === 'grammar-writing') return 'grammar writing support'
      if (type === 'vocabulary') return 'vocabulary support'
      if (type === 'digital-resource') return 'digital resources'
      return 'teacher resources'
    })
    .slice(0, 4)
  const modeHint = input.searchMode === 'broad' ? 'teacher resources' : 'official teacher guide curriculum map scope and sequence'
  const baseQuery = input.queryOverride?.trim() || `${input.bookTitle ?? bookId}${gradePart} ${modeHint} ${materialHints.join(' ')}`
  const enrichedQuery = hintBits.length ? `${baseQuery} ${hintBits.join(' ')}` : baseQuery
  const sources = await searchWebSources(enrichedQuery, {
    limit: input.maxResults,
    materialTypes: input.materialTypes,
    downloadableOnly: input.downloadableOnly,
    searchMode: input.searchMode,
  })
  if (!sources.length) {
    return {
      kind: 'book-draft',
      bookId,
      summary: '',
      goals: [],
      pacing: [],
      instructionalPriorities: [],
      focusAreas: BOOK_FOCUS_AREAS_DEFAULT,
      sourcePageRange: range,
      materials: [],
      sources: [],
      evidence: [],
      generatedAt: now,
    }
  }
  const systemPrompt = `Return strict JSON with shape:
{
  "summary": "string",
  "goals": ["..."],
  "pacing": ["..."],
  "instructionalPriorities": ["..."],
  "materials": [
    {
      "type": "pacing-guide|scope-sequence|teacher-edition|assessment|intervention|grammar-writing|vocabulary|digital-resource|other",
      "title": "string",
      "url": "https://...",
      "notes": "short usage note",
      "confidence": "high|medium|low"
    }
  ],
  "evidence": [
    {
      "field": "summary|goals|pacing|instructionalPriorities",
      "sourceUrl": "https://...",
      "snippet": "short evidence",
      "confidence": "high|medium|low"
    }
  ]
}
Rules:
- Use only the supplied source list.
- Do not fabricate URLs.
- Keep evidence snippets under 250 chars.
- Prefer free/open resources over paid listings.
- Exclude paid pages, marketplace listings, and purchase-only product pages.
- Include broad useful teacher materials, not only pacing guides.`
  const userPrompt = [
    `Book ID: ${bookId}`,
    `Book title: ${input.bookTitle ?? '(unknown)'}`,
    `Book description: ${input.bookDescription ?? '(none)'}`,
    `Grade hint: ${input.gradeHint ?? '(unknown)'}`,
    `Version hints: ${hintBits.length ? hintBits.join(' | ') : '(none)'}`,
    `Candidate sources:`,
    ...sources.slice(0, 8).map((source, index) => `${index + 1}. ${source.title}\nURL: ${source.url}\nSnippet: ${source.snippet}`),
  ].join('\n\n')

  const fallback: BookContextDraftRecord = {
    kind: 'book-draft',
    bookId,
    summary: '',
    goals: [],
    pacing: [],
    instructionalPriorities: [],
    focusAreas: BOOK_FOCUS_AREAS_DEFAULT,
    sourcePageRange: range,
    materials: [],
    sources,
    evidence: [],
    generatedAt: now,
  }

  try {
    const text = await callGemini(systemPrompt, userPrompt)
    if (!text) return fallback
    const parsed = parseJson(text) as {
      summary?: unknown
      goals?: unknown
      pacing?: unknown
      instructionalPriorities?: unknown
      materials?: Array<{
        type?: unknown
        title?: unknown
        url?: unknown
        notes?: unknown
        confidence?: unknown
      }>
      evidence?: Array<{
        field?: unknown
        sourceUrl?: unknown
        snippet?: unknown
        confidence?: unknown
      }>
    }
    const rawEvidence = Array.isArray(parsed.evidence) ? parsed.evidence : []
    const rawMaterials = Array.isArray(parsed.materials) ? parsed.materials : []
    const materials = rawMaterials
      .map((item): BookContextMaterialRecord | null => {
        const typeRaw = String(item.type ?? '').trim()
        const type = (
          typeRaw === 'pacing-guide' ||
          typeRaw === 'scope-sequence' ||
          typeRaw === 'teacher-edition' ||
          typeRaw === 'assessment' ||
          typeRaw === 'intervention' ||
          typeRaw === 'grammar-writing' ||
          typeRaw === 'vocabulary' ||
          typeRaw === 'digital-resource' ||
          typeRaw === 'other'
        ) ? typeRaw : 'other'
        const title = String(item.title ?? '').trim()
        const url = String(item.url ?? '').trim()
        if (!title || !url) return null
        const notes = String(item.notes ?? '').trim()
        const confidenceRaw = String(item.confidence ?? '').trim()
        const confidence: ContextFieldConfidence =
          confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
            ? confidenceRaw
            : 'low'
        return { type, title, url, notes, confidence }
      })
      .filter((item): item is BookContextMaterialRecord => !!item)
    return {
      kind: 'book-draft',
      bookId,
      summary: String(parsed.summary ?? '').trim(),
      goals: trimList(parsed.goals, 8),
      pacing: trimList(parsed.pacing, 8),
      instructionalPriorities: trimList(parsed.instructionalPriorities, 8),
      focusAreas: BOOK_FOCUS_AREAS_DEFAULT,
      sourcePageRange: range,
      materials,
      sources,
      evidence: rawEvidence
        .map((item) => {
          const fieldRaw = String(item.field ?? '').trim()
          if (
            fieldRaw !== 'summary' &&
            fieldRaw !== 'goals' &&
            fieldRaw !== 'pacing' &&
            fieldRaw !== 'instructionalPriorities'
          ) return null
          const confidenceRaw = String(item.confidence ?? '').trim()
          const confidence: ContextFieldConfidence =
            confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
              ? confidenceRaw
              : 'low'
          return {
            field: fieldRaw,
            sourceUrl: String(item.sourceUrl ?? '').trim(),
            snippet: trimSnippet(item.snippet),
            confidence,
          }
        })
        .filter((item): item is BookContextDraftRecord['evidence'][number] => !!item && !!item.sourceUrl),
      generatedAt: now,
    }
  } catch (err) {
    console.warn('[ContextScan] book draft parse fallback:', err)
    return fallback
  }
}

export async function scanUnitContext(input: UnitContextScanInput): Promise<UnitContextRecord> {
  const pageRange = clampPageRange(input.sourcePageRange)
  const scanProfile = normalizeScanProfile(input.scanProfile)
  const now = new Date().toISOString()
  const id = stableId(`unit:${input.bookId}:${input.unitId}`)

  const fallback: UnitContextRecord = {
    id,
    kind: 'unit',
    bookId: input.bookId.trim(),
    unitId: input.unitId.trim(),
    unitTitle: input.unitTitle?.trim() || undefined,
    theme: input.unitTitle?.trim() || 'Unit theme',
    bigIdeas: trimList([input.sectionSummary ?? 'Students connect reading to community themes.'], 5),
    crossCurricularLinks: ['social studies'],
    targetLanguageDomains: ['vocabulary in context', 'comprehension'],
    sourcePageRange: pageRange,
    scanProfile,
    contextVersion: CONTEXT_VERSION,
    createdAt: now,
    updatedAt: now,
  }

  const systemPrompt = `Return JSON only with shape:
{
  "theme": "string",
  "bigIdeas": ["..."],
  "crossCurricularLinks": ["..."],
  "targetLanguageDomains": ["..."]
}`
  const userPrompt = [
    `Book ID: ${input.bookId}`,
    `Unit ID: ${input.unitId}`,
    `Unit title: ${input.unitTitle ?? '(unknown)'}`,
    `Page range: ${pageRange.startPage}-${pageRange.endPage}`,
    `Scan profile: ${scanProfile}`,
    `Visible lesson summary: ${input.sectionSummary ?? '(none)'}`,
  ].join('\n')

  try {
    const text = await callGemini(systemPrompt, userPrompt)
    if (!text) return fallback
    const parsed = parseJson(text) as {
      theme?: unknown
      bigIdeas?: unknown
      crossCurricularLinks?: unknown
      targetLanguageDomains?: unknown
    }
    return {
      ...fallback,
      theme: String(parsed.theme ?? fallback.theme).trim() || fallback.theme,
      bigIdeas: trimList(parsed.bigIdeas, 6),
      crossCurricularLinks: trimList(parsed.crossCurricularLinks, 6),
      targetLanguageDomains: trimList(parsed.targetLanguageDomains, 8),
      updatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.warn('[ContextScan] unit parse fallback:', err)
    return fallback
  }
}

export async function scanLessonContext(input: LessonContextScanInput): Promise<LessonContextRecord> {
  const pageRange = clampPageRange(input.sourcePageRange)
  const scanProfile = normalizeScanProfile(input.scanProfile)
  const now = new Date().toISOString()
  const id = stableId(`lesson:${input.bookId}:${input.unitId}:${input.lessonId}`)

  const fallback: LessonContextRecord = {
    id,
    kind: 'lesson',
    bookId: input.bookId.trim(),
    unitId: input.unitId.trim(),
    lessonId: input.lessonId.trim(),
    lessonTitle: input.lessonTitle?.trim() || undefined,
    textType: 'story',
    lessonGoals: trimList([input.sectionSummary ?? 'Build reading comprehension and lesson vocabulary.'], 6),
    comprehensionSkill: 'comprehension',
    strategy: 'context clues',
    essentialQuestions: ['What is the main idea of this lesson?'],
    languageFocus: {
      grammarNotes: [],
      writingNotes: [],
    },
    sourcePageRange: pageRange,
    scanProfile,
    contextVersion: CONTEXT_VERSION,
    createdAt: now,
    updatedAt: now,
  }

  const systemPrompt = `Return JSON only with shape:
{
  "textType": "string",
  "lessonGoals": ["..."],
  "comprehensionSkill": "string",
  "strategy": "string",
  "essentialQuestions": ["..."],
  "languageFocus": {
    "grammarNotes": ["..."],
    "writingNotes": ["..."]
  }
}`
  const userPrompt = [
    `Book ID: ${input.bookId}`,
    `Unit ID: ${input.unitId}`,
    `Lesson ID: ${input.lessonId}`,
    `Lesson title: ${input.lessonTitle ?? '(unknown)'}`,
    `Page range: ${pageRange.startPage}-${pageRange.endPage}`,
    `Scan profile: ${scanProfile}`,
    `Visible lesson summary: ${input.sectionSummary ?? '(none)'}`,
  ].join('\n')

  try {
    const text = await callGemini(systemPrompt, userPrompt)
    if (!text) return fallback
    const parsed = parseJson(text) as {
      textType?: unknown
      lessonGoals?: unknown
      comprehensionSkill?: unknown
      strategy?: unknown
      essentialQuestions?: unknown
      languageFocus?: { grammarNotes?: unknown; writingNotes?: unknown }
    }
    return {
      ...fallback,
      textType: String(parsed.textType ?? fallback.textType).trim() || fallback.textType,
      lessonGoals: trimList(parsed.lessonGoals, 8),
      comprehensionSkill:
        String(parsed.comprehensionSkill ?? fallback.comprehensionSkill).trim() || fallback.comprehensionSkill,
      strategy: String(parsed.strategy ?? fallback.strategy).trim() || fallback.strategy,
      essentialQuestions: trimList(parsed.essentialQuestions, 5),
      languageFocus: {
        grammarNotes: trimList(parsed.languageFocus?.grammarNotes, 6),
        writingNotes: trimList(parsed.languageFocus?.writingNotes, 6),
      },
      updatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.warn('[ContextScan] lesson parse fallback:', err)
    return fallback
  }
}
