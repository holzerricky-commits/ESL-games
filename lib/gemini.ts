import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getVocabSuggestions } from '@/lib/helpers'
import {
  getSuggestionFetchCount,
  MAX_DISPLAY_PER_DIFFICULTY,
  MAX_FETCH_PER_DIFFICULTY,
  MIN_DISPLAY_PER_DIFFICULTY,
  SUGGESTION_BUFFER,
} from '@/lib/suggestion-constants'

export {
  MAX_DISPLAY_PER_DIFFICULTY,
  MAX_FETCH_PER_DIFFICULTY,
  MIN_DISPLAY_PER_DIFFICULTY,
  getSuggestionFetchCount,
} from '@/lib/suggestion-constants'

const CACHE_TTL_MS = 90_000
const CACHE_MAX_ENTRIES = 64
const suggestionCache = new Map<string, { expires: number; data: VocabularySuggestions }>()
const MODELS_CACHE_TTL_MS = 10 * 60_000
let cachedModelCandidates: { expires: number; models: string[] } | null = null

const DATA_DIR = join(process.cwd(), 'data')
const DISK_CACHE_PATH = join(DATA_DIR, 'vocab-suggestions.json')
const DISK_CACHE_MAX_KEYS = 200

type DiskStore = Record<string, VocabularySuggestions>

let diskWriteChain: Promise<void> = Promise.resolve()

function pruneSuggestionCache() {
  const now = Date.now()
  for (const [k, v] of suggestionCache) {
    if (v.expires <= now) suggestionCache.delete(k)
  }
  while (suggestionCache.size > CACHE_MAX_ENTRIES) {
    const first = suggestionCache.keys().next().value
    if (first === undefined) break
    suggestionCache.delete(first)
  }
}

function cacheKeyForSuggestions(
  quiz: string,
  notes: string,
  fetchCount: number,
  exclude: ExcludeWords | undefined
): string {
  const e = exclude ?? { easy: [], medium: [], hard: [] }
  return JSON.stringify({
    q: quiz,
    n: notes,
    fetchCount,
    easy: e.easy ?? [],
    medium: e.medium ?? [],
    hard: e.hard ?? [],
  })
}

/** Map full cache key -> stable id for disk file keys (shorter JSON root keys). */
function diskKeyFromCacheKey(ck: string): string {
  return createHash('sha256').update(ck).digest('hex').slice(0, 32)
}

async function readDiskSuggestions(ck: string): Promise<VocabularySuggestions | null> {
  try {
    const raw = await readFile(DISK_CACHE_PATH, 'utf8')
    const store = JSON.parse(raw) as DiskStore
    const id = diskKeyFromCacheKey(ck)
    const hit = store[id]
    if (
      hit &&
      Array.isArray(hit.easy) &&
      Array.isArray(hit.medium) &&
      Array.isArray(hit.hard)
    ) {
      return {
        easy: [...hit.easy],
        medium: [...hit.medium],
        hard: [...hit.hard],
      }
    }
  } catch {
    /* no file or invalid */
  }
  return null
}

function persistSuggestionsToDisk(ck: string, data: VocabularySuggestions): void {
  const id = diskKeyFromCacheKey(ck)
  diskWriteChain = diskWriteChain
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true })
      let store: DiskStore = {}
      try {
        const raw = await readFile(DISK_CACHE_PATH, 'utf8')
        store = JSON.parse(raw) as DiskStore
      } catch {
        /* start fresh */
      }
      store[id] = data
      const keys = Object.keys(store)
      if (keys.length > DISK_CACHE_MAX_KEYS) {
        keys.slice(0, keys.length - DISK_CACHE_MAX_KEYS).forEach((k) => {
          delete store[k]
        })
      }
      const tmp = `${DISK_CACHE_PATH}.tmp`
      await writeFile(tmp, JSON.stringify(store), 'utf8')
      await rename(tmp, DISK_CACHE_PATH)
    })
    .catch((err) => {
      console.warn('[Gemini] Disk cache write failed:', err)
    })
}

/** Prefer newest Flash ids; unversioned `gemini-1.5-flash` often 404s on v1beta. */
const GEMINI_MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash-002',
] as const

function isTransientGeminiStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

type GeminiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; model?: string }

export interface VocabularySuggestions {
  easy: string[]
  medium: string[]
  hard: string[]
}

/** Result of `generateVocabularySuggestions` — `fromCache` is true only for memory/disk hits (no Gemini call). */
export interface SuggestionGenerationResult {
  suggestions: VocabularySuggestions
  fromCache: boolean
}

export type ExcludeWords = {
  easy?: string[]
  medium?: string[]
  hard?: string[]
}

type StrictProfile = {
  strict: boolean
  topicTokens: string[]
  bannedTokens: Set<string>
  seedWords: string[]
}

function normalizeWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
}

function sanitizeList(words: unknown, count: number): string[] {
  if (!Array.isArray(words)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of words) {
    if (typeof raw !== 'string') continue
    const w = normalizeWord(raw)
    if (!w || seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= count) break
  }
  return out
}

let resolvedApiKey: string | null | undefined

/** Shared for Gemini-backed API routes (vocabulary and prep helpers). */
export async function resolveGeminiApiKey(): Promise<string | null> {
  if (resolvedApiKey !== undefined) return resolvedApiKey

  const fromEnv = process.env.GEMINI_API_KEY?.trim()
  if (fromEnv) {
    resolvedApiKey = fromEnv
    return resolvedApiKey
  }

  try {
    const localEnvRaw = await readFile(join(process.cwd(), '.env.local'), 'utf8')
    const trimmed = localEnvRaw.trim()
    if (!trimmed) {
      resolvedApiKey = null
      return null
    }
    if (trimmed.startsWith('GEMINI_API_KEY=')) {
      resolvedApiKey = trimmed.replace(/^GEMINI_API_KEY=/, '').trim()
      return resolvedApiKey
    }
    resolvedApiKey = trimmed
    return resolvedApiKey
  } catch {
    resolvedApiKey = null
    return null
  }
}

const SYSTEM_PROMPT = `You are a strict ESL vocabulary expert for Chinese children aged 8-14.

Task: Generate vocabulary words ONLY for the given quiz topic.

Rules you MUST follow:
- All words MUST be highly relevant to the quiz name.
- Never suggest unrelated words.
- Strictly follow any special notes/restrictions.

**Concrete examples vs. loose associations (critical):**
- When the quiz name names a **category of things** (foods, drinks, sodas, animals, cars, emotions, bridge types, etc.), list **specific members of that category**: product names, brands, flavors, breeds, species, types, famous examples—not loose adjectives or vague related words.
- Do NOT pad lists with generic adjectives (sweet, cold, fizzy, big) or ultra-generic nouns (drink, taste, thing) unless the quiz title or special notes explicitly ask for describing qualities or feelings.
- Good pattern for "Sodas": cola, lemon-lime, root beer, ginger ale, grape soda, cream soda (concrete kinds/names). Bad pattern: sweet, cold, fizzy, drink, carbonated (descriptors without naming kinds).
- When the topic is already a single concrete item, normal lemma choices apply.

Difficulty levels (for category-style quizzes, interpret as familiarity/rarity of the **example**, not "harder adjectives"):
- Easy: the most familiar, common examples for young learners.
- Medium: more specific types, regional names, or less universal picks.
- Hard: specialized, regional, or advanced vocabulary names (still concrete members when the topic is a category).

- Return ONLY valid JSON in this exact format, no extra text:
{
  "easy": ["word1", "word2", ...],
  "medium": ["word1", "word2", ...],
  "hard": ["word1", "word2", ...]
}
- Generate exactly the requested number of words per level.
- If quizName is empty or very short (< 4 characters), return empty arrays for all levels.`

async function callGeminiJson(
  key: string,
  userText: string,
  model: string,
  systemPrompt: string = SYSTEM_PROMPT
): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          maxOutputTokens: 1536,
        },
      }),
    }
  )
  if (!res.ok) return { ok: false, status: res.status }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string' || !text.trim()) return { ok: false, status: 204 }
  return { ok: true, text: text.trim() }
}

function normalizeModelName(name: string): string {
  return name.startsWith('models/') ? name.replace(/^models\//, '') : name
}

async function resolveModelCandidates(key: string): Promise<string[]> {
  if (cachedModelCandidates && cachedModelCandidates.expires > Date.now()) {
    return cachedModelCandidates.models
  }

  const fallback = [...GEMINI_MODEL_CANDIDATES]
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
    )
    if (!res.ok) {
      cachedModelCandidates = { expires: Date.now() + MODELS_CACHE_TTL_MS, models: fallback }
      return fallback
    }
    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
    }
    const available = (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => normalizeModelName(m.name ?? ''))
      .filter((m) => m.includes('flash'))

    const priority = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-flash-002',
    ]
    const ordered = [
      ...priority.filter((p) => available.includes(p)),
      ...available.filter((m) => !priority.includes(m)),
    ]

    const finalModels = ordered.length > 0 ? ordered : fallback
    cachedModelCandidates = { expires: Date.now() + MODELS_CACHE_TTL_MS, models: finalModels }
    return finalModels
  } catch {
    cachedModelCandidates = { expires: Date.now() + MODELS_CACHE_TTL_MS, models: fallback }
    return fallback
  }
}

async function callGeminiWithFallback(
  key: string,
  userText: string,
  modelCandidates: string[],
  systemPrompt: string = SYSTEM_PROMPT
): Promise<GeminiResult> {
  let lastStatus = 404
  for (const model of modelCandidates) {
    const r = await callGeminiJson(key, userText, model, systemPrompt)
    if (r.ok) return { ok: true, text: r.text, model }
    lastStatus = r.status
    if (r.status === 404 || isTransientGeminiStatus(r.status)) continue
    return { ok: false, status: r.status, model }
  }
  return { ok: false, status: lastStatus }
}

function parseSuggestions(text: string, fetchCount: number): VocabularySuggestions | null {
  const clean = text.trim()
  let jsonText = clean
  // Allow fenced JSON from model responses.
  if (clean.startsWith('```')) {
    jsonText = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  const parsed = JSON.parse(jsonText)
  const easy = sanitizeList(parsed?.easy, fetchCount)
  const medium = sanitizeList(parsed?.medium, fetchCount)
  const hard = sanitizeList(parsed?.hard, fetchCount)
  // Accept partial lists; completeness is handled later by validator/fallback fill.
  if (easy.length === 0 && medium.length === 0 && hard.length === 0) return null
  return { easy, medium, hard }
}

/** Single-bucket regenerate: model returns `{ "words": [...] }` only. */
function parseSingleBucketWords(text: string, fetchCount: number): string[] | null {
  const clean = text.trim()
  let jsonText = clean
  if (clean.startsWith('```')) {
    jsonText = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  const parsed = JSON.parse(jsonText)
  const words = sanitizeList(parsed?.words, fetchCount)
  return words.length > 0 ? words : null
}

export type SuggestionBucket = 'easy' | 'medium' | 'hard'

function otherBucketsWordSet(bucket: SuggestionBucket, current: VocabularySuggestions): Set<string> {
  const s = new Set<string>()
  const add = (arr: string[]) => {
    for (const raw of arr) {
      const w = normalizeWord(raw)
      if (w) s.add(w)
    }
  }
  if (bucket !== 'easy') add(current.easy)
  if (bucket !== 'medium') add(current.medium)
  if (bucket !== 'hard') add(current.hard)
  return s
}

function validateBucketWords(
  source: string[],
  level: SuggestionBucket,
  fetchCount: number,
  exclude: ExcludeWords | undefined,
  quiz: string,
  notes: string,
  noDupLower: Set<string>
): string[] {
  const exSet =
    level === 'easy'
      ? new Set((exclude?.easy ?? []).map(normalizeWord))
      : level === 'medium'
        ? new Set((exclude?.medium ?? []).map(normalizeWord))
        : new Set((exclude?.hard ?? []).map(normalizeWord))
  const profile = buildStrictProfile(quiz, notes)
  const out: string[] = []
  for (const raw of source) {
    const w = normalizeWord(raw)
    if (!w || noDupLower.has(w) || exSet.has(w)) continue
    if (!isLikelyRelevant(w, profile)) continue
    const syll = estimateSyllables(w)
    if (level === 'easy' && (w.length > 12 || syll > 4)) continue
    if (level === 'hard' && w.length < 4 && syll < 2) continue
    out.push(w)
    if (out.length >= fetchCount) break
  }
  return out
}

function fallbackFillSingleBucket(
  current: string[],
  level: SuggestionBucket,
  fetchCount: number,
  quiz: string,
  notes: string,
  reserved: Set<string>
): string[] {
  const profile = buildStrictProfile(quiz, notes)
  const normalizedTopicText = normalizeTopicTypos(`${quiz} ${notes}`)
  const topicSuggested = getVocabSuggestions(normalizedTopicText)
  const topicFirst = Array.from(
    new Set([...profile.seedWords, ...topicSuggested, ...profile.topicTokens])
  )
    .map(normalizeWord)
    .filter(Boolean)
  const seen = new Set<string>(reserved)
  const minLen = level === 'easy' ? 2 : level === 'medium' ? 3 : 5
  const maxLen = level === 'easy' ? 10 : undefined
  const out: string[] = []
  for (const raw of current) {
    const w = normalizeWord(raw)
    if (!w || seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= fetchCount) break
  }
  for (const w of topicFirst) {
    if (!w || seen.has(w) || w.length < minLen) continue
    if (typeof maxLen === 'number' && w.length > maxLen) continue
    if (!isLikelyRelevant(w, profile)) continue
    const syll = estimateSyllables(w)
    if (level === 'easy' && (w.length > 12 || syll > 4)) continue
    if (level === 'hard' && w.length < 4 && syll < 2) continue
    seen.add(w)
    out.push(w)
    if (out.length >= fetchCount) break
  }
  return profile.strict ? out.slice(0, fetchCount) : out.slice(0, fetchCount)
}

function bucketDifficultyHint(level: SuggestionBucket): string {
  if (level === 'easy') {
    return 'EASY: the most familiar, common examples for young learners (short, simple).'
  }
  if (level === 'medium') {
    return 'MEDIUM: more specific types, regional names, or less universal examples.'
  }
  return 'HARD: specialized, regional, or advanced vocabulary (still concrete members when the topic is a category).'
}

function estimateSyllables(word: string): number {
  const groups = word.toLowerCase().match(/[aeiouy]+/g)
  return Math.max(1, groups?.length ?? 1)
}

function topicTokens(quiz: string, notes: string): string[] {
  return `${quiz} ${notes}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3)
}

function buildStrictProfile(quiz: string, notes: string): StrictProfile {
  const combined = `${quiz} ${notes}`.toLowerCase()
  const strict = /\b(only|just|strict|exactly|no|without|exclude|avoid)\b/.test(combined)
  const topic = topicTokens(quiz, notes).filter(
    (t) => !['only', 'just', 'strict', 'exactly', 'with', 'without'].includes(t)
  )
  const bannedTokens = new Set<string>()
  for (const m of combined.matchAll(/\b(?:no|without|exclude|avoid)\s+([a-z0-9\s-]{2,60})/g)) {
    const phrase = m[1] ?? ''
    for (const t of phrase.split(/[^a-z0-9]+/).filter((x) => x.length >= 3)) {
      if (!['and', 'like', 'such', 'that', 'this'].includes(t)) bannedTokens.add(t)
    }
  }
  const seedWords: string[] = []
  if (/\bcoffee\b/.test(combined)) {
    seedWords.push(
      'espresso',
      'latte',
      'cappuccino',
      'americano',
      'macchiato',
      'mocha',
      'flat white',
      'cortado',
      'ristretto',
      'lungo',
      'affogato'
    )
    for (const x of ['sugar', 'milk', 'cup', 'mug', 'machine', 'grinder', 'filter', 'bean']) {
      bannedTokens.add(x)
    }
  }
  return { strict, topicTokens: topic, bannedTokens, seedWords: Array.from(new Set(seedWords)) }
}

function normalizeTopicTypos(text: string): string {
  const lower = text.toLowerCase()
  const replacements: Array<[RegExp, string]> = [
    [/\bdrings\b/g, 'drinks'],
    [/\bvegitables\b/g, 'vegetables'],
    [/\bvegitables\b/g, 'vegetables'],
    [/\banimalss\b/g, 'animals'],
    [/\bcolours\b/g, 'colors'],
  ]
  let out = lower
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement)
  }
  return out
}

function containsBannedToken(word: string, bannedTokens: Set<string>): boolean {
  if (bannedTokens.size === 0) return false
  const w = word.toLowerCase()
  for (const t of bannedTokens) {
    if (w.includes(t) || t.includes(w)) return true
  }
  return false
}

function isLikelyRelevant(word: string, profile: StrictProfile): boolean {
  const tokens = profile.topicTokens
  // Keep this permissive for generic topics ("fruits", "music instruments") to avoid false negatives.
  if (containsBannedToken(word, profile.bannedTokens)) return false
  if (profile.seedWords.some((s) => normalizeWord(s) === normalizeWord(word))) return true
  if (!profile.strict && tokens.length < 3) return true
  const w = word.toLowerCase()
  if (tokens.some((t) => w.includes(t) || t.includes(w))) return true
  if (!profile.strict && w.length <= 8) return true
  return false
}

function validateAndRepairBuckets(
  parsed: VocabularySuggestions,
  fetchCount: number,
  exclude: ExcludeWords | undefined,
  quiz: string,
  notes: string
): { valid: VocabularySuggestions; complete: boolean } {
  const exEasy = new Set((exclude?.easy ?? []).map(normalizeWord))
  const exMedium = new Set((exclude?.medium ?? []).map(normalizeWord))
  const exHard = new Set((exclude?.hard ?? []).map(normalizeWord))
  const globalSeen = new Set<string>()
  const profile = buildStrictProfile(quiz, notes)

  const pick = (source: string[], level: 'easy' | 'medium' | 'hard'): string[] => {
    const out: string[] = []
    for (const raw of source) {
      const w = normalizeWord(raw)
      if (!w || globalSeen.has(w)) continue
      if (level === 'easy' && exEasy.has(w)) continue
      if (level === 'medium' && exMedium.has(w)) continue
      if (level === 'hard' && exHard.has(w)) continue
      if (!isLikelyRelevant(w, profile)) continue

      const syll = estimateSyllables(w)
      if (level === 'easy' && (w.length > 12 || syll > 4)) continue
      if (level === 'hard' && w.length < 4 && syll < 2) continue

      globalSeen.add(w)
      out.push(w)
      if (out.length >= fetchCount) break
    }
    return out
  }

  const easy = pick(parsed.easy, 'easy')
  const medium = pick(parsed.medium, 'medium')
  const hard = pick(parsed.hard, 'hard')
  const complete = easy.length === fetchCount && medium.length === fetchCount && hard.length === fetchCount
  return { valid: { easy, medium, hard }, complete }
}

function fallbackFill(
  current: VocabularySuggestions,
  fetchCount: number,
  quiz: string,
  notes: string
): VocabularySuggestions {
  const profile = buildStrictProfile(quiz, notes)
  const normalizedTopicText = normalizeTopicTypos(`${quiz} ${notes}`)
  const topic = profile.topicTokens
  const topicSuggested = getVocabSuggestions(normalizedTopicText)
  const seen = new Set([...current.easy, ...current.medium, ...current.hard].map(normalizeWord))
  const topicFirst = Array.from(new Set([...profile.seedWords, ...topicSuggested, ...topic]))
    .map(normalizeWord)
    .filter(Boolean)

  const fill = (arr: string[], minLen: number, maxLen?: number): string[] => {
    const out = [...arr]
    for (const w of topicFirst) {
      if (!w || seen.has(w) || w.length < minLen) continue
      if (typeof maxLen === 'number' && w.length > maxLen) continue
      if (!isLikelyRelevant(w, profile)) continue
      seen.add(w)
      out.push(w)
      if (out.length >= fetchCount) break
    }
    // In strict mode, prefer fewer-but-relevant words over forced unrelated fill.
    return profile.strict ? out : out.slice(0, fetchCount)
  }

  return {
    easy: fill(current.easy, 2, 10).slice(0, fetchCount),
    medium: fill(current.medium, 3).slice(0, fetchCount),
    hard: fill(current.hard, 5).slice(0, fetchCount),
  }
}

function buildRepairPrompt(
  valid: VocabularySuggestions,
  fetchCount: number,
  quiz: string,
  notes: string,
  excludeEasy: string[],
  excludeMedium: string[],
  excludeHard: string[]
): string {
  return `Repair vocabulary JSON for this quiz.
Quiz: ${quiz}
Special notes: ${notes || '(none)'}

Need exactly ${fetchCount} words in each level.
Current accepted words:
easy: ${JSON.stringify(valid.easy)}
medium: ${JSON.stringify(valid.medium)}
hard: ${JSON.stringify(valid.hard)}

Do not include excludes:
easy excludes: ${excludeEasy.join(', ') || '(none)'}
medium excludes: ${excludeMedium.join(', ') || '(none)'}
hard excludes: ${excludeHard.join(', ') || '(none)'}

Rules:
- Return only JSON { "easy":[], "medium":[], "hard":[] }.
- Keep existing accepted words where possible.
- Fill missing slots only.
- Keep easy simpler than medium; medium simpler than hard (for categories: easier = more familiar examples).
- Prefer concrete category members over adjectives when the quiz names a class of things.
- Avoid unrelated words.`
}

function totalWords(v: VocabularySuggestions): number {
  return v.easy.length + v.medium.length + v.hard.length
}

function dedupeBucketOrder(words: string[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of words) {
    const w = normalizeWord(raw)
    if (!w || seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= max) break
  }
  return out
}

function finalizeSuggestions(parsed: VocabularySuggestions, ck: string): VocabularySuggestions {
  const copy = {
    easy: [...parsed.easy],
    medium: [...parsed.medium],
    hard: [...parsed.hard],
  }
  suggestionCache.set(ck, {
    expires: Date.now() + CACHE_TTL_MS,
    data: copy,
  })
  persistSuggestionsToDisk(ck, copy)
  return {
    easy: [...copy.easy],
    medium: [...copy.medium],
    hard: [...copy.hard],
  }
}

/**
 * `numPerDifficulty` is the UI display count (slider). Server adds a buffer for extra suggestions.
 * Optional `exclude` avoids dismissed/selected words per difficulty bucket.
 */
export async function generateVocabularySuggestions(
  quizName: string,
  specialNotes: string,
  numPerDifficulty: number,
  exclude?: ExcludeWords
): Promise<SuggestionGenerationResult> {
  const fetchCount = getSuggestionFetchCount(numPerDifficulty)
  const safeQuiz = quizName.trim()
  const safeNotes = specialNotes.trim()

  if (safeQuiz.length < 4) {
    return { suggestions: { easy: [], medium: [], hard: [] }, fromCache: false }
  }

  const key = await resolveGeminiApiKey()
  if (!key) {
    console.warn('[Gemini] No GEMINI_API_KEY (or readable .env.local). Returning empty suggestions.')
    return { suggestions: { easy: [], medium: [], hard: [] }, fromCache: false }
  }

  const ck = cacheKeyForSuggestions(safeQuiz, safeNotes, fetchCount, exclude)
  pruneSuggestionCache()
  const hit = suggestionCache.get(ck)
  if (hit && hit.expires > Date.now()) {
    return {
      suggestions: {
        easy: [...hit.data.easy],
        medium: [...hit.data.medium],
        hard: [...hit.data.hard],
      },
      fromCache: true,
    }
  }

  const diskHit = await readDiskSuggestions(ck)
  if (diskHit) {
    suggestionCache.set(ck, {
      expires: Date.now() + CACHE_TTL_MS,
      data: {
        easy: [...diskHit.easy],
        medium: [...diskHit.medium],
        hard: [...diskHit.hard],
      },
    })
    return { suggestions: diskHit, fromCache: true }
  }

  const excludeEasy = exclude?.easy ?? []
  const excludeMedium = exclude?.medium ?? []
  const excludeHard = exclude?.hard ?? []

  const userMessage = `Quiz name: ${safeQuiz}
Special notes: ${safeNotes || '(none)'}
Generate exactly ${fetchCount} words for each difficulty level (easy, medium, hard).

If the quiz name is a category (e.g. sodas, fruits, car brands), output specific examples (names, types, brands)—not only adjectives or loose related words.

Do not include any of these words (already shown, removed, or selected):
Easy bucket excludes: ${excludeEasy.length ? excludeEasy.join(', ') : '(none)'}
Medium bucket excludes: ${excludeMedium.length ? excludeMedium.join(', ') : '(none)'}
Hard bucket excludes: ${excludeHard.length ? excludeHard.join(', ') : '(none)'}`

  const modelCandidates = await resolveModelCandidates(key)
  let first = await callGeminiWithFallback(key, userMessage, modelCandidates)
  if (!first.ok) {
    console.warn(`[Gemini] Generation failed on initial request (${first.status}).`)
    const fastFallback = fallbackFill(
      { easy: [], medium: [], hard: [] },
      fetchCount,
      safeQuiz,
      safeNotes
    )
    return { suggestions: finalizeSuggestions(fastFallback, ck), fromCache: false }
  }

  let validated: { valid: VocabularySuggestions; complete: boolean } | null = null
  try {
    const parsed = parseSuggestions(first.text, fetchCount)
    if (!parsed) throw new Error('structure')
    validated = validateAndRepairBuckets(parsed, fetchCount, exclude, safeQuiz, safeNotes)
  } catch {
    const sample = first.text.replace(/\s+/g, ' ').slice(0, 180)
    console.warn(`[Gemini] Initial parse/validation failed for ${first.model}. Sample: ${sample}`)
  }

  // One lightweight retry with simplified prompt when model returns empty arrays or near-empty output.
  if (!validated || totalWords(validated.valid) === 0) {
    const simplePrompt = `Topic: ${safeQuiz}. Notes: ${safeNotes || '(none)'}.
Return only JSON with easy, medium, hard arrays and exactly ${fetchCount} words per array.
If the topic is a category of things, list concrete examples (brands, types, species)—not only adjectives like sweet or cold.
Avoid unrelated words.`
    const second = await callGeminiWithFallback(key, simplePrompt, modelCandidates)
    if (second.ok) {
      try {
        const parsed2 = parseSuggestions(second.text, fetchCount)
        if (parsed2) {
          const validated2 = validateAndRepairBuckets(parsed2, fetchCount, exclude, safeQuiz, safeNotes)
          if (totalWords(validated2.valid) > totalWords(validated?.valid ?? { easy: [], medium: [], hard: [] })) {
            first = second
            validated = validated2
          }
        }
      } catch {
        /* ignore simplified retry parse errors */
      }
    }
  }

  if (validated?.complete) {
    return { suggestions: finalizeSuggestions(validated.valid, ck), fromCache: false }
  }

  // If initial parse/validation fully failed, skip extra model call and return fast conservative fill.
  if (!validated) {
    const fastFallback = fallbackFill(
      { easy: [], medium: [], hard: [] },
      fetchCount,
      safeQuiz,
      safeNotes
    )
    return { suggestions: finalizeSuggestions(fastFallback, ck), fromCache: false }
  }

  // Reliability-first: if too few validated words remain, avoid another slow LLM round trip.
  if (totalWords(validated.valid) < Math.ceil(fetchCount * 1.5)) {
    const quickFilled = fallbackFill(validated.valid, fetchCount, safeQuiz, safeNotes)
    return { suggestions: finalizeSuggestions(quickFilled, ck), fromCache: false }
  }

  // One bounded repair call only (for partial-but-valid outputs).
  const repairPrompt = buildRepairPrompt(
    validated.valid,
    fetchCount,
    safeQuiz,
    safeNotes,
    excludeEasy,
    excludeMedium,
    excludeHard
  )
  const repair = await callGeminiWithFallback(key, repairPrompt, modelCandidates)
  if (repair.ok) {
    try {
      const repaired = parseSuggestions(repair.text, fetchCount)
      if (repaired) {
        const checked = validateAndRepairBuckets(repaired, fetchCount, exclude, safeQuiz, safeNotes)
        if (checked.complete)
          return { suggestions: finalizeSuggestions(checked.valid, ck), fromCache: false }
        const filled = fallbackFill(checked.valid, fetchCount, safeQuiz, safeNotes)
        return { suggestions: finalizeSuggestions(filled, ck), fromCache: false }
      }
    } catch {
      console.warn('[Gemini] Repair parse failed; using fallback fill.')
    }
  } else {
    console.warn(`[Gemini] Repair request failed (${repair.status}).`)
  }

  const fallback = fallbackFill(
    validated.valid,
    fetchCount,
    safeQuiz,
    safeNotes
  )
  return { suggestions: finalizeSuggestions(fallback, ck), fromCache: false }
}

/**
 * Regenerate one difficulty bucket via Gemini, merge with `current` for the other two,
 * and refresh disk + memory cache for this quiz/exclude key (skips stale read cache).
 */
export async function regenerateVocabularyBucket(
  quizName: string,
  specialNotes: string,
  numPerDifficulty: number,
  bucket: SuggestionBucket,
  current: VocabularySuggestions,
  exclude?: ExcludeWords
): Promise<VocabularySuggestions> {
  const fetchCount = getSuggestionFetchCount(numPerDifficulty)
  const safeQuiz = quizName.trim()
  const safeNotes = specialNotes.trim()

  if (safeQuiz.length < 4) {
    return {
      easy: [...current.easy],
      medium: [...current.medium],
      hard: [...current.hard],
    }
  }

  const key = await resolveGeminiApiKey()
  if (!key) {
    console.warn('[Gemini] No API key; bucket regen skipped.')
    return {
      easy: [...current.easy],
      medium: [...current.medium],
      hard: [...current.hard],
    }
  }

  const ck = cacheKeyForSuggestions(safeQuiz, safeNotes, fetchCount, exclude)
  pruneSuggestionCache()

  const nx = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  const base: VocabularySuggestions = {
    easy: nx(current.easy),
    medium: nx(current.medium),
    hard: nx(current.hard),
  }

  const excludeList =
    bucket === 'easy'
      ? exclude?.easy ?? []
      : bucket === 'medium'
        ? exclude?.medium ?? []
        : exclude?.hard ?? []

  const reserved = otherBucketsWordSet(bucket, base)

  const userMessage = `Quiz name: ${safeQuiz}
Special notes: ${safeNotes || '(none)'}

Regenerate ONLY the ${bucket.toUpperCase()} difficulty row with NEW vocabulary (fresh ideas).
Difficulty target: ${bucketDifficultyHint(bucket)}

If the quiz name is a category (e.g. sodas, fruits), list concrete examples (names, types, brands)—not only adjectives.

Return ONLY valid JSON in this exact shape (one array, exactly ${fetchCount} words):
{ "words": ["word1", "word2", ...] }

Do not include any of these (already dismissed or selected for this row):
${excludeList.length ? excludeList.join(', ') : '(none)'}`

  const modelCandidates = await resolveModelCandidates(key)
  let words: string[] | null = null

  const first = await callGeminiWithFallback(key, userMessage, modelCandidates)
  if (first.ok) {
    try {
      words = parseSingleBucketWords(first.text, fetchCount)
    } catch {
      const sample = first.text.replace(/\s+/g, ' ').slice(0, 180)
      console.warn(`[Gemini] Bucket ${bucket} parse failed (${first.model}). Sample: ${sample}`)
    }
  } else {
    console.warn(`[Gemini] Bucket regen failed (${first.status}).`)
  }

  if (!words || words.length === 0) {
    const simplePrompt = `Topic: ${safeQuiz}. Notes: ${safeNotes || '(none)'}.
Return only JSON: { "words": [] } with exactly ${fetchCount} English vocabulary words for ${bucket} difficulty.
Concrete examples if the topic is a category (brands, types, species)—not only adjectives.
Exclude: ${excludeList.length ? excludeList.join(', ') : 'none'}.`
    const second = await callGeminiWithFallback(key, simplePrompt, modelCandidates)
    if (second.ok) {
      try {
        const w2 = parseSingleBucketWords(second.text, fetchCount)
        if (w2 && w2.length > 0) words = w2
      } catch {
        /* ignore */
      }
    }
  }

  let filled = words
    ? validateBucketWords(words, bucket, fetchCount, exclude, safeQuiz, safeNotes, reserved)
    : []
  if (filled.length < fetchCount) {
    filled = fallbackFillSingleBucket(filled, bucket, fetchCount, safeQuiz, safeNotes, reserved)
  }

  const merged: VocabularySuggestions = {
    easy: bucket === 'easy' ? filled : [...base.easy],
    medium: bucket === 'medium' ? filled : [...base.medium],
    hard: bucket === 'hard' ? filled : [...base.hard],
  }

  return finalizeSuggestions(merged, ck)
}

/**
 * After rotating off visible words, append Gemini words to refill one bucket up to `fetchCount`.
 */
export async function topUpVocabularyBucket(
  quizName: string,
  specialNotes: string,
  numPerDifficulty: number,
  bucket: SuggestionBucket,
  needCount: number,
  current: VocabularySuggestions,
  exclude?: ExcludeWords
): Promise<VocabularySuggestions> {
  const fetchCount = getSuggestionFetchCount(numPerDifficulty)
  const safeQuiz = quizName.trim()
  const safeNotes = specialNotes.trim()
  const n = Math.max(0, Math.min(MAX_FETCH_PER_DIFFICULTY, Math.floor(needCount)))

  const nx = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  const base: VocabularySuggestions = {
    easy: nx(current.easy),
    medium: nx(current.medium),
    hard: nx(current.hard),
  }

  if (safeQuiz.length < 4 || n === 0) {
    return {
      easy: [...base.easy],
      medium: [...base.medium],
      hard: [...base.hard],
    }
  }

  const key = await resolveGeminiApiKey()
  if (!key) {
    console.warn('[Gemini] No API key; top-up skipped.')
    return {
      easy: [...base.easy],
      medium: [...base.medium],
      hard: [...base.hard],
    }
  }

  const ck = cacheKeyForSuggestions(safeQuiz, safeNotes, fetchCount, exclude)
  pruneSuggestionCache()

  const existingBucket =
    bucket === 'easy' ? base.easy : bucket === 'medium' ? base.medium : base.hard

  const reserved = otherBucketsWordSet(bucket, base)
  const noDup = new Set<string>(reserved)
  for (const w of existingBucket) {
    const x = normalizeWord(w)
    if (x) noDup.add(x)
  }

  const baseExclude =
    bucket === 'easy'
      ? exclude?.easy ?? []
      : bucket === 'medium'
        ? exclude?.medium ?? []
        : exclude?.hard ?? []
  const combinedExclude = Array.from(new Set([...baseExclude, ...existingBucket.map((w) => w.trim())]))

  const augmentedExclude: ExcludeWords = {
    ...exclude,
    ...(bucket === 'easy'
      ? { easy: combinedExclude }
      : bucket === 'medium'
        ? { medium: combinedExclude }
        : { hard: combinedExclude }),
  }

  const userMessage = `Quiz name: ${safeQuiz}
Special notes: ${safeNotes || '(none)'}

Add exactly ${n} NEW vocabulary words for the ${bucket.toUpperCase()} difficulty only (same quiz topic).
Difficulty target: ${bucketDifficultyHint(bucket)}
If the topic is a category, use concrete examples (names, types, brands)—not only adjectives.

Return ONLY valid JSON in this exact shape (exactly ${n} words):
{ "words": ["word1", "word2", ...] }

Do not repeat or include any of these:
${combinedExclude.length ? combinedExclude.join(', ') : '(none)'}`

  const modelCandidates = await resolveModelCandidates(key)
  let words: string[] | null = null

  const first = await callGeminiWithFallback(key, userMessage, modelCandidates)
  if (first.ok) {
    try {
      words = parseSingleBucketWords(first.text, n)
    } catch {
      const sample = first.text.replace(/\s+/g, ' ').slice(0, 180)
      console.warn(`[Gemini] Top-up ${bucket} parse failed (${first.model}). Sample: ${sample}`)
    }
  }

  if (!words || words.length === 0) {
    const simplePrompt = `Topic: ${safeQuiz}. Notes: ${safeNotes || '(none)'}.
Return only JSON: { "words": [] } with exactly ${n} NEW English words for ${bucket} difficulty (same quiz topic).
Do not use: ${combinedExclude.slice(0, 48).join(', ') || 'none'}.`
    const second = await callGeminiWithFallback(key, simplePrompt, modelCandidates)
    if (second.ok) {
      try {
        const w2 = parseSingleBucketWords(second.text, n)
        if (w2 && w2.length > 0) words = w2
      } catch {
        /* ignore */
      }
    }
  }

  let newWords = words
    ? validateBucketWords(words, bucket, n, augmentedExclude, safeQuiz, safeNotes, noDup)
    : []

  if (newWords.length < n) {
    newWords = fallbackFillSingleBucket(newWords, bucket, n, safeQuiz, safeNotes, noDup)
  }

  const mergedList = dedupeBucketOrder([...existingBucket, ...newWords], fetchCount)
  const merged: VocabularySuggestions = {
    easy: bucket === 'easy' ? mergedList : [...base.easy],
    medium: bucket === 'medium' ? mergedList : [...base.medium],
    hard: bucket === 'hard' ? mergedList : [...base.hard],
  }

  return finalizeSuggestions(merged, ck)
}

const IMAGE_PHRASE_SYSTEM = `You write English stock-photo search phrases for ESL vocabulary (ages 8–14).

Rules:
- For EACH word, give the single most common, literal, concrete meaning — what most people picture first.
- No metaphor, slang, brands, or secondary meanings (e.g. "art" → painting, palette, artist — NOT camera, graphic design, or museum only).
- Phrase should work in Pixabay search: clear subject, simple or white background when possible, "stock photo" style.
- Short: under 18 words per phrase. Plain ASCII letters, numbers, spaces. No quotes inside phrases.
- Return ONLY valid JSON: { "phrases": { "word": "phrase here", ... } }
- Include EVERY input word as a key (lowercase).`

function normalizePhraseWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 60)
}

function parseImagePhrases(
  text: string,
  expected: Set<string>
): Record<string, string> {
  const out: Record<string, string> = {}
  const clean = text.trim()
  let jsonText = clean
  if (clean.startsWith('```')) {
    jsonText = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return out
  }
  const phrases = (parsed as { phrases?: unknown })?.phrases
  if (!phrases || typeof phrases !== 'object') return out
  const byNorm = new Map<string, string>()
  for (const [k, v] of Object.entries(phrases as Record<string, unknown>)) {
    const nk = normalizePhraseWord(k)
    if (!nk || typeof v !== 'string') continue
    const p = v.replace(/\s+/g, ' ').trim().slice(0, 220)
    if (p.length >= 3) byNorm.set(nk, p)
  }
  for (const key of expected) {
    const p = byNorm.get(key)
    if (p) out[key] = p
  }
  return out
}

/**
 * One Gemini call: map vocabulary lemmas (no curated override) → literal stock-search phrases.
 */
export async function generateImageSearchPhrases(
  words: string[]
): Promise<Record<string, string>> {
  const normalized = [...new Set(words.map(normalizePhraseWord))].filter(Boolean).slice(0, 36)
  if (normalized.length === 0) return {}

  const key = await resolveGeminiApiKey()
  if (!key) return {}

  const userText = `Each lemma needs one literal English stock-photo search phrase (most common concrete meaning for young ESL learners).

Lemmas: ${normalized.join(', ')}

Return only valid JSON: {"phrases":{"lemma":"phrase",...}} with every lemma above as a lowercase key.`

  const modelCandidates = await resolveModelCandidates(key)
  const result = await callGeminiWithFallback(key, userText, modelCandidates, IMAGE_PHRASE_SYSTEM)
  if (!result.ok) return {}

  const expected = new Set(normalized)
  const parsed = parseImagePhrases(result.text, expected)
  return parsed
}

export interface ClassPrepSuggestionInput {
  studentName: string
  classTitle: string
  scheduledFor: string
  classDurationMin: number
  plannedVocabulary: string[]
  goals: string[]
  activities: string[]
  selectedSection?: {
    id: string
    type: 'unit' | 'lesson' | 'part'
    bookId: string
    bookTitle: string
    unitId: string
    unitTitle: string
    lessonId?: string
    lessonTitle?: string
    partId?: string
    partTitle?: string
    title: string
  }
  sectionContext?: {
    title: string
    type: 'unit' | 'lesson' | 'part'
    pathLabel: string
    startPageHint?: number
    endPageHint?: number
    sectionVocabulary: string[]
    checkpointIdeas: string[]
    contentSummary: string
  }
  studentSnapshot: {
    levelLabel: string
    motivation: 'low' | 'medium' | 'high'
    firstOrEarlyClasses: boolean
  }
  recentHistory: Array<{
    title: string
    status: string
    scheduledFor: string
    selectedSectionTitle?: string
    introducedWords: string[]
    practicedWords: string[]
    reviewedWords: string[]
    learnedWords: string[]
    notes?: string
  }>
}

export interface ClassPrepSuggestionResult {
  priorities: string[]
  activities: string[]
  timeBlocks: Array<{
    label: string
    minutes: number
    objective: string
    activityType: string
    teacherMoves?: string[]
    studentOutput?: string
    checkForUnderstanding?: string
  }>
  checkpointMoments: string[]
  differentiationTips: string[]
  homeworkOrCarryOver: string[]
  wordsToRevisit: Array<{ word: string; reason: string }>
  summary: string
}

const CLASS_PREP_SYSTEM_PROMPT = `You are an ESL teaching assistant helping a teacher prepare one lesson.

Return ONLY valid JSON with this shape:
{
  "priorities": ["..."],
  "activities": ["..."],
  "timeBlocks": [{ "label": "...", "minutes": 0, "objective": "...", "activityType": "...", "teacherMoves": ["..."], "studentOutput": "...", "checkForUnderstanding": "..." }],
  "checkpointMoments": ["..."],
  "differentiationTips": ["..."],
  "homeworkOrCarryOver": ["..."],
  "wordsToRevisit": [{ "word": "...", "reason": "..." }],
  "summary": "..."
}

Rules:
- Keep responses concise and practical for one class session.
- Priorities: 2-5 items.
- Activities: 2-5 items with concrete in-class actions.
- TimeBlocks: 3-8 blocks and total minutes close to class duration.
- For 25-30 minute lessons: compact pacing with quick review + one high-value checkpoint.
- For 50-60 minute lessons: include deeper guided practice and a final quest/challenge.
- Each TimeBlock should include short teacher moves, expected student output, and one quick check for understanding.
- CheckpointMoments: 1-4 quick checks tied to the selected section.
- DifferentiationTips: 1-4 tips adapted to student level and motivation.
- HomeworkOrCarryOver: 1-3 actionable next-step tasks.
- WordsToRevisit: include important words that need reinforcement based on history.
- Summary: 1-2 sentences, max 300 characters.
- Use plain ASCII text only.`

function normalizeSuggestionLines(values: unknown, max: number): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    if (typeof raw !== 'string') continue
    const line = raw.trim()
    if (!line) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= max) break
  }
  return out
}

function parseClassPrepSuggestion(text: string): ClassPrepSuggestionResult | null {
  const clean = text.trim()
  let jsonText = clean
  if (clean.startsWith('```')) {
    jsonText = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  const parsed = JSON.parse(jsonText) as {
    priorities?: unknown
    activities?: unknown
    timeBlocks?: unknown
    checkpointMoments?: unknown
    differentiationTips?: unknown
    homeworkOrCarryOver?: unknown
    wordsToRevisit?: unknown
    summary?: unknown
  }
  const priorities = normalizeSuggestionLines(parsed.priorities, 5)
  const activities = normalizeSuggestionLines(parsed.activities, 5)
  const checkpointMoments = normalizeSuggestionLines(parsed.checkpointMoments, 4)
  const differentiationTips = normalizeSuggestionLines(parsed.differentiationTips, 4)
  const homeworkOrCarryOver = normalizeSuggestionLines(parsed.homeworkOrCarryOver, 3)
  const timeBlocks = Array.isArray(parsed.timeBlocks)
    ? parsed.timeBlocks
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const label = String((entry as { label?: unknown }).label ?? '').trim()
          const minutes = Number((entry as { minutes?: unknown }).minutes ?? 0)
          const objective = String((entry as { objective?: unknown }).objective ?? '').trim()
          const activityType = String((entry as { activityType?: unknown }).activityType ?? '').trim()
          if (!label || !objective || !activityType || !Number.isFinite(minutes) || minutes <= 0) return null
          const teacherMoves = normalizeSuggestionLines((entry as { teacherMoves?: unknown }).teacherMoves, 4)
          const studentOutput = String((entry as { studentOutput?: unknown }).studentOutput ?? '').trim() || undefined
          const checkForUnderstanding =
            String((entry as { checkForUnderstanding?: unknown }).checkForUnderstanding ?? '').trim() || undefined
          return {
            label,
            minutes: Math.floor(minutes),
            objective,
            activityType,
            teacherMoves,
            studentOutput,
            checkForUnderstanding,
          }
        })
        .filter(
          (
            entry,
          ): entry is {
            label: string
            minutes: number
            objective: string
            activityType: string
            teacherMoves?: string[]
            studentOutput?: string
            checkForUnderstanding?: string
          } => !!entry,
        )
        .slice(0, 8)
    : []
  const wordsToRevisit = Array.isArray(parsed.wordsToRevisit)
    ? parsed.wordsToRevisit
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const word = String((entry as { word?: unknown }).word ?? '').trim()
          const reason = String((entry as { reason?: unknown }).reason ?? '').trim()
          if (!word || !reason) return null
          return { word, reason }
        })
        .filter((entry): entry is { word: string; reason: string } => !!entry)
        .slice(0, 8)
    : []
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  if (
    !summary &&
    priorities.length === 0 &&
    activities.length === 0 &&
    wordsToRevisit.length === 0 &&
    timeBlocks.length === 0
  )
    return null
  return {
    priorities,
    activities,
    timeBlocks,
    checkpointMoments,
    differentiationTips,
    homeworkOrCarryOver,
    wordsToRevisit,
    summary: summary || 'Focus on high-value review words and active speaking practice this class.',
  }
}

export async function generateClassPrepSuggestion(
  input: ClassPrepSuggestionInput,
): Promise<ClassPrepSuggestionResult> {
  const key = await resolveGeminiApiKey()
  if (!key) {
    return {
      priorities: ['Review key words from previous classes.', 'Keep speaking practice in short loops.'],
      activities: ['3-minute warm-up recap', 'Pair sentence building with target words'],
      timeBlocks: [
        {
          label: 'Warm-up review',
          minutes: 6,
          objective: 'Activate previous vocabulary.',
          activityType: 'review',
          teacherMoves: ['Prompt open speaking with 2 easy questions.'],
          studentOutput: '2-3 spoken responses using known words.',
          checkForUnderstanding: 'Can student answer without heavy prompting?',
        },
        {
          label: 'Guided practice',
          minutes: 14,
          objective: 'Practice target section skills.',
          activityType: 'practice',
          teacherMoves: ['Model one item, then guide two examples.'],
          studentOutput: 'Reads and uses key words in short sentences.',
          checkForUnderstanding: '1 quick comprehension check at midpoint.',
        },
        {
          label: 'Quick check and close',
          minutes: 5,
          objective: 'Check understanding and set next step.',
          activityType: 'checkpoint',
          teacherMoves: ['Ask one transfer question and summarize next step.'],
          studentOutput: 'One short recap statement.',
          checkForUnderstanding: 'Exit ticket: one correct answer and one sentence.',
        },
      ],
      checkpointMoments: ['Midpoint comprehension check with one multiple-choice question.'],
      differentiationTips: ['Use sentence frames if the student needs scaffolding.'],
      homeworkOrCarryOver: ['Review five key words and create one sentence per word.'],
      wordsToRevisit: [],
      summary: 'Use a short review cycle and reinforce words that appeared recently but are not stable yet.',
    }
  }

  const modelCandidates = await resolveModelCandidates(key)
  const prompt = `Student: ${input.studentName}
Class: ${input.classTitle}
Scheduled: ${input.scheduledFor}
Class duration (minutes): ${input.classDurationMin}
Planned vocabulary: ${input.plannedVocabulary.join(', ') || '(none)'}
Goals: ${input.goals.join(' | ') || '(none)'}
Planned activities: ${input.activities.join(' | ') || '(none)'}
Selected section: ${input.selectedSection ? `${input.selectedSection.title} [${input.selectedSection.type}]` : '(none)'}
Selected section path: ${input.sectionContext?.pathLabel || '(none)'}
Section content summary: ${input.sectionContext?.contentSummary || '(none)'}
Section target vocabulary: ${input.sectionContext?.sectionVocabulary.join(', ') || '(none)'}
Section checkpoint ideas: ${input.sectionContext?.checkpointIdeas.join(' | ') || '(none)'}
Student level: ${input.studentSnapshot.levelLabel}
Student motivation: ${input.studentSnapshot.motivation}
First or early classes: ${input.studentSnapshot.firstOrEarlyClasses ? 'yes' : 'no'}

Recent class history:
${input.recentHistory
  .map(
    (entry, idx) =>
      `${idx + 1}) ${entry.title} [${entry.status}] ${entry.scheduledFor}
section: ${entry.selectedSectionTitle || '(none)'}
introduced: ${entry.introducedWords.join(', ') || '(none)'}
practiced: ${entry.practicedWords.join(', ') || '(none)'}
reviewed: ${entry.reviewedWords.join(', ') || '(none)'}
learned: ${entry.learnedWords.join(', ') || '(none)'}
notes: ${entry.notes || '(none)'}`,
  )
  .join('\n\n')}`

  const result = await callGeminiWithFallback(key, prompt, modelCandidates, CLASS_PREP_SYSTEM_PROMPT)
  if (!result.ok) {
    return {
      priorities: ['Review high-value words from recent sessions.', 'Prioritize speaking output over passive recognition.'],
      activities: ['Target-word role-play', 'Quick exit ticket with 3 sentences'],
      timeBlocks: [
        {
          label: 'Warm-up',
          minutes: 8,
          objective: 'Reactivate previous learning.',
          activityType: 'review',
          teacherMoves: ['Lead free speaking around previous lesson keywords.'],
          studentOutput: 'Short spoken answers with target vocabulary.',
          checkForUnderstanding: 'Quick recall check on 3 prior words.',
        },
        {
          label: 'Main section task',
          minutes: 18,
          objective: 'Practice the selected section actively.',
          activityType: 'guided-practice',
          teacherMoves: ['Model, then shift to student-led responses.'],
          studentOutput: 'Reads and produces target language in context.',
          checkForUnderstanding: 'MCQ or prompt question after key chunk.',
        },
        {
          label: 'Mini challenge',
          minutes: 8,
          objective: 'Apply skills in a short challenge.',
          activityType: 'challenge',
          teacherMoves: ['Run time-boxed challenge and give immediate feedback.'],
          studentOutput: 'Completes challenge task with minimal help.',
          checkForUnderstanding: 'Score or correctness check at challenge end.',
        },
        {
          label: 'Wrap-up',
          minutes: 6,
          objective: 'Assess understanding and set carry-over.',
          activityType: 'reflection',
          teacherMoves: ['Prompt recap and assign one carry-over task.'],
          studentOutput: 'States one key takeaway and one next action.',
          checkForUnderstanding: 'Exit prompt in one sentence.',
        },
      ],
      checkpointMoments: ['Ask one key comprehension question after the main task.'],
      differentiationTips: ['Increase support by modeling one answer before independent work.'],
      homeworkOrCarryOver: ['Prepare three sentences using today’s target words.'],
      wordsToRevisit: [],
      summary: 'Run a review-heavy class and keep students producing target vocabulary in context.',
    }
  }

  try {
    const parsed = parseClassPrepSuggestion(result.text)
    if (parsed) return parsed
  } catch {
    /* fall through */
  }
  return {
    priorities: ['Review high-value words from recent sessions.', 'Prioritize speaking output over passive recognition.'],
    activities: ['Target-word role-play', 'Quick exit ticket with 3 sentences'],
    timeBlocks: [
      {
        label: 'Warm-up',
        minutes: 8,
        objective: 'Reactivate previous learning.',
        activityType: 'review',
        teacherMoves: ['Lead free speaking around previous lesson keywords.'],
        studentOutput: 'Short spoken answers with target vocabulary.',
        checkForUnderstanding: 'Quick recall check on 3 prior words.',
      },
      {
        label: 'Main section task',
        minutes: 18,
        objective: 'Practice the selected section actively.',
        activityType: 'guided-practice',
        teacherMoves: ['Model, then shift to student-led responses.'],
        studentOutput: 'Reads and produces target language in context.',
        checkForUnderstanding: 'MCQ or prompt question after key chunk.',
      },
      {
        label: 'Mini challenge',
        minutes: 8,
        objective: 'Apply skills in a short challenge.',
        activityType: 'challenge',
        teacherMoves: ['Run time-boxed challenge and give immediate feedback.'],
        studentOutput: 'Completes challenge task with minimal help.',
        checkForUnderstanding: 'Score or correctness check at challenge end.',
      },
      {
        label: 'Wrap-up',
        minutes: 6,
        objective: 'Assess understanding and set carry-over.',
        activityType: 'reflection',
        teacherMoves: ['Prompt recap and assign one carry-over task.'],
        studentOutput: 'States one key takeaway and one next action.',
        checkForUnderstanding: 'Exit prompt in one sentence.',
      },
    ],
    checkpointMoments: ['Ask one key comprehension question after the main task.'],
    differentiationTips: ['Increase support by modeling one answer before independent work.'],
    homeworkOrCarryOver: ['Prepare three sentences using today’s target words.'],
    wordsToRevisit: [],
    summary: 'Run a review-heavy class and keep students producing target vocabulary in context.',
  }
}
