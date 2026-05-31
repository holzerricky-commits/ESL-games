import { SymSpell, Verbosity } from '@/lib/writing-assist/symspell-browser'

const DICT_URL = '/writing-assist/en-us-50k.json'
const FREQ_MARGIN = 3
const MAX_EDIT_DISTANCE = 2

/** Two-letter transpose fixes when SymSpell has no hit. */
const TRANSPOSE_2: Record<string, string> = {
  si: 'is',
  is: 'si',
  teh: 'the',
  yuo: 'you',
  taht: 'that',
}

export type CorrectionResult = { from: string; to: string }

type ScoredCandidate = { term: string; distance: number; count: number }

/** Typo looks like an incomplete adverb (-ly) or similar suffix. */
export function typoSuggestsAdverbSuffix(typoLower: string): boolean {
  return /(?:ally|ily|ely|ingly|aly|ly|li)$/i.test(typoLower) && typoLower.length >= 5
}

/** Rank corrections: avoid shortening, boost -ly targets, then log-frequency. */
export function pickBestCandidate(
  typoLower: string,
  candidates: ScoredCandidate[],
  freqByWord: Map<string, number>,
  lessonWords: Set<string>,
): ScoredCandidate | null {
  if (!candidates.length) return null

  const scored = candidates.map((c) => {
    const freq = c.count || freqByWord.get(c.term) || 1
    let score = Math.log10(freq + 10)
    if (c.term.length >= typoLower.length) score += 2.5
    else score -= 4
    if (typoSuggestsAdverbSuffix(typoLower) && c.term.endsWith('ly')) score += 3
    if (lessonWords.has(c.term)) score += 6
    return { c, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]!
  const second = scored[1]

  if (second && second.score >= top.score - 0.35) {
    const a = top.c.term
    const b = second.c.term
    const shorter = a.length <= b.length ? a : b
    const longer = a.length > b.length ? a : b
    if (longer.startsWith(shorter) && shorter !== longer) {
      if (typoLower.length >= longer.length - 2) {
        return candidates.find((x) => x.term === longer) ?? top.c
      }
      return null
    }
    const topFreq = top.c.count || freqByWord.get(top.c.term) || 1
    const secondFreq = second.c.count || freqByWord.get(second.c.term) || 1
    if (secondFreq * FREQ_MARGIN > topFreq && Math.abs(top.score - second.score) < 0.5) {
      return null
    }
  }

  return top.c
}

let initPromise: Promise<SpellEngine> | null = null

export class SpellEngine {
  private readonly symSpell: SymSpell
  private readonly validWords = new Set<string>()
  private readonly freqByWord = new Map<string, number>()
  private readonly wordsByPrefix1 = new Map<string, string[]>()
  private readonly wordsByPrefix2 = new Map<string, string[]>()
  private lessonWords = new Set<string>()

  private constructor(symSpell: SymSpell) {
    this.symSpell = symSpell
  }

  private indexWord(lower: string): void {
    const p1 = lower[0]
    if (p1) {
      const a1 = this.wordsByPrefix1.get(p1) ?? []
      a1.push(lower)
      this.wordsByPrefix1.set(p1, a1)
    }
    if (lower.length >= 2) {
      const p2 = lower.slice(0, 2)
      const a2 = this.wordsByPrefix2.get(p2) ?? []
      a2.push(lower)
      this.wordsByPrefix2.set(p2, a2)
    }
  }

  getWordFrequency(word: string): number {
    return this.freqByWord.get(word.toLowerCase()) ?? 0
  }

  /** Fast prefix completion for ghost typing (uses bucket index). */
  findWordsWithPrefix(prefix: string, limit = 16): string[] {
    const lower = prefix.toLowerCase()
    if (lower.length < 1) return []

    let pool: string[] = []
    if (lower.length >= 2) {
      pool = this.wordsByPrefix2.get(lower.slice(0, 2)) ?? []
    } else {
      pool = this.wordsByPrefix1.get(lower) ?? []
    }

    const matches = pool.filter((w) => w.startsWith(lower) && w.length > lower.length)
    matches.sort((a, b) => (this.freqByWord.get(b) ?? 0) - (this.freqByWord.get(a) ?? 0))
    return matches.slice(0, limit)
  }

  static async load(): Promise<SpellEngine> {
    if (!initPromise) {
      initPromise = (async () => {
        const res = await fetch(DICT_URL)
        if (!res.ok) throw new Error(`Writing assist dictionary fetch failed: ${res.status}`)
        const entries = (await res.json()) as [string, number][]
        const symSpell = new SymSpell(Math.max(50000, entries.length + 1000), MAX_EDIT_DISTANCE, 7)
        const lines = entries.map(([w, c]) => `${w.toLowerCase()} ${c}`).join('\n')
        symSpell.loadDictionary(lines, 0, 1)
        const engine = new SpellEngine(symSpell)
        for (const [w, c] of entries) {
          const lower = w.toLowerCase()
          engine.validWords.add(lower)
          engine.freqByWord.set(lower, c)
          engine.indexWord(lower)
        }
        return engine
      })()
    }
    return initPromise
  }

  setLessonWords(words: Iterable<string>): void {
    this.lessonWords = new Set()
    for (const w of words) {
      const t = normalizeToken(w)
      if (t) {
        this.lessonWords.add(t)
        this.validWords.add(t)
      }
    }
  }

  isValidWord(word: string): boolean {
    const t = normalizeToken(word)
    return t.length > 0 && this.validWords.has(t)
  }

  suggestCorrection(rawWord: string): CorrectionResult | null {
    const word = rawWord.trim()
    if (!word) return null
    const lower = word.toLowerCase()
    if (lower.length === 1) return null

    if (this.isValidWord(word)) return null

    if (lower.length === 2 && TRANSPOSE_2[lower]) {
      const to = preserveCase(word, TRANSPOSE_2[lower])
      if (to.toLowerCase() !== lower) return { from: word, to }
    }

    const suggestions = this.symSpell.lookup(lower, Verbosity.Closest, MAX_EDIT_DISTANCE)
    if (!suggestions.length) return null

    const minDist = suggestions[0].distance
    const atMin = suggestions.filter((s) => s.distance === minDist && s.term !== lower)
    if (!atMin.length) return null

    if (lower.length === 2 && atMin.length > 1) return null
    if (minDist > MAX_EDIT_DISTANCE) return null

    const pool: ScoredCandidate[] = atMin.map((s) => ({
      term: s.term,
      distance: s.distance,
      count: s.count,
    }))
    const best = pickBestCandidate(lower, pool, this.freqByWord, this.lessonWords)
    if (!best) return null

    const to = preserveCase(word, best.term)
    if (to === word) return null
    return { from: word, to }
  }
}

export function normalizeToken(word: string): string {
  return word.replace(/^['']+|['']+$/g, '').toLowerCase()
}

export function preserveCase(original: string, replacement: string): string {
  if (!original) return replacement
  if (original === original.toUpperCase()) return replacement.toUpperCase()
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  }
  return replacement
}

export async function getSpellEngine(): Promise<SpellEngine> {
  return SpellEngine.load()
}

/** Reset for tests only. */
export function resetSpellEngineForTests(): void {
  initPromise = null
}

/** Build engine from word list without fetch (tests). */
export function createSpellEngineForTest(entries: [string, number][]): SpellEngine {
  const symSpell = new SymSpell(Math.max(1000, entries.length + 100), MAX_EDIT_DISTANCE, 7)
  const lines = entries.map(([w, c]) => `${w.toLowerCase()} ${c}`).join('\n')
  symSpell.loadDictionary(lines, 0, 1)
  const engine = Object.create(SpellEngine.prototype) as SpellEngine
  ;(engine as unknown as { symSpell: SymSpell }).symSpell = symSpell
  ;(engine as unknown as { validWords: Set<string> }).validWords = new Set(
    entries.map(([w]) => w.toLowerCase()),
  )
  ;(engine as unknown as { freqByWord: Map<string, number> }).freqByWord = new Map(
    entries.map(([w, c]) => [w.toLowerCase(), c]),
  )
  ;(engine as unknown as { lessonWords: Set<string> }).lessonWords = new Set()
  ;(engine as unknown as { wordsByPrefix1: Map<string, string[]> }).wordsByPrefix1 = new Map()
  ;(engine as unknown as { wordsByPrefix2: Map<string, string[]> }).wordsByPrefix2 = new Map()
  const wordsByPrefix1 = (engine as unknown as { wordsByPrefix1: Map<string, string[]> }).wordsByPrefix1
  const wordsByPrefix2 = (engine as unknown as { wordsByPrefix2: Map<string, string[]> }).wordsByPrefix2
  for (const [w] of entries) {
    const lower = w.toLowerCase()
    const p1 = lower[0]
    if (p1) {
      const a1 = wordsByPrefix1.get(p1) ?? []
      a1.push(lower)
      wordsByPrefix1.set(p1, a1)
    }
    if (lower.length >= 2) {
      const p2 = lower.slice(0, 2)
      const a2 = wordsByPrefix2.get(p2) ?? []
      a2.push(lower)
      wordsByPrefix2.set(p2, a2)
    }
  }
  engine.setLessonWords = SpellEngine.prototype.setLessonWords.bind(engine)
  engine.getWordFrequency = SpellEngine.prototype.getWordFrequency.bind(engine)
  engine.findWordsWithPrefix = SpellEngine.prototype.findWordsWithPrefix.bind(engine)
  return engine
}
