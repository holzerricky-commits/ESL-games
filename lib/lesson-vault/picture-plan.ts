/**
 * How the automatic search should look for one word's picture.
 * `keyword`: plain English word(s) for the meaning in the sentence (pictogram / icon lookup).
 * `phrase`: a stock-image search phrase (Pixabay).
 */
export type VaultPicturePlan = { picturable: boolean; keyword: string; phrase: string; gloss: string }

export type VaultPicturePlanItem = { word: string; sentence: string }

export const MAX_PICTURE_PLAN_ITEMS = 24

/** Words with no sensible picture; skipped without asking Gemini. */
const UNPICTURABLE = new Set(
  `a an the and or but so if then than because although though however therefore also too very really
  just only even still yet already ever never always often sometimes usually maybe perhaps
  is am are was were be been being do does did have has had will would shall should can could may might must
  i me my mine you your yours he him his she her hers it its we us our ours they them their theirs
  this that these those there here who whom whose which what when where why how
  of to at by for from with about than as
  not no yes all some any each every both either neither none much more most less least
  one thing things something anything nothing everything someone anyone nobody everybody`
    .split(/\s+/)
    .filter(Boolean),
)

export function normalizePlanWord(word: string): string {
  return word.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60)
}

export function isObviouslyUnpicturable(word: string): boolean {
  const key = normalizePlanWord(word)
  if (!key || !/\p{L}/u.test(key)) return true
  return UNPICTURABLE.has(key)
}

export const VAULT_PICTURE_PLAN_SYSTEM = `You pick cartoon pictures for ESL vocabulary cards (children aged 6–12).

For EACH word you get the sentence from the book it came from. Decide:
- "picturable": true when a single clear cartoon or clipart picture shows this meaning (objects, animals, places, people, actions, weather, clear emotions with a face). false for function words, abstract ideas, time words and words a picture would only confuse (e.g. "however", "idea", "soon", "important").
- "keyword": the dictionary form of the word, or one or two simple English words naming what to draw for the meaning used IN THAT SENTENCE (e.g. "apples" → "apple", "bank" in a river sentence → "riverbank", "ran" → "run"). Used to look up a learner pictogram. Always fill it, even when not picturable.
- "phrase": a short literal English search phrase for a cartoon/clipart image of that meaning (e.g. "river bank cartoon"). Under 8 words, plain ASCII, no quotes. Use "" when not picturable.
- "gloss": a short meaning a child can read (about 4–12 words) for the sense used IN THAT SENTENCE. Plain English. Do not copy the sentence. Do not start with the word. Use "" when no sentence was given.

Return ONLY valid JSON: { "plans": { "word": { "picturable": true, "keyword": "...", "phrase": "...", "gloss": "..." }, ... } }
Include EVERY input word as a lowercase key.`

export function buildPicturePlanPrompt(items: readonly VaultPicturePlanItem[]): string {
  const lines = items.map((item) => {
    const sentence = item.sentence.replace(/\s+/g, ' ').trim().slice(0, 200)
    return `- "${normalizePlanWord(item.word)}"${sentence ? ` — sentence: ${sentence}` : ''}`
  })
  return `Words:\n${lines.join('\n')}`
}

/** Short learner gloss: at most 18 words, not a copy of the sentence or the word alone. */
export function sanitizeVaultGloss(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const text = raw.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.split(' ').slice(0, 18).join(' ').slice(0, 160)
}

export function usableVaultGloss(gloss: string, sentence: string, word: string): string {
  const source = sentence.replace(/\s+/g, ' ').trim()
  if (!source) return ''
  const text = sanitizeVaultGloss(gloss)
  if (!text) return ''
  const lower = text.toLowerCase()
  if (lower === word.replace(/\s+/g, ' ').trim().toLowerCase()) return ''
  if (lower === source.toLowerCase()) return ''
  return text
}

/** Reads the model's JSON; only words that were asked for, with sane values. */
export function parsePicturePlans(text: string, expected: readonly string[]): Record<string, VaultPicturePlan> {
  const out: Record<string, VaultPicturePlan> = {}
  let jsonText = text.trim()
  if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return out
  }
  const plans = (parsed as { plans?: unknown } | null)?.plans
  if (!plans || typeof plans !== 'object' || Array.isArray(plans)) return out
  const byKey = new Map<string, VaultPicturePlan>()
  for (const [k, v] of Object.entries(plans as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const phrase = typeof o.phrase === 'string' ? o.phrase.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    const keyword = typeof o.keyword === 'string' ? normalizePlanWord(o.keyword).slice(0, 40) : ''
    const picturable = o.picturable !== false && phrase.length >= 2
    byKey.set(normalizePlanWord(k), {
      picturable,
      keyword: keyword || normalizePlanWord(k),
      phrase: picturable ? phrase : '',
      gloss: sanitizeVaultGloss(o.gloss),
    })
  }
  for (const word of expected) {
    const key = normalizePlanWord(word)
    const plan = byKey.get(key)
    if (plan) out[key] = plan
  }
  return out
}

/**
 * Final plan per word: skip list first, then the model (it sees the sentence),
 * then a curated search override, then the plain word (so a Gemini outage still searches).
 */
export function resolvePicturePlans(
  words: readonly string[],
  opts: {
    curated: (word: string) => string | undefined
    model: Record<string, VaultPicturePlan>
  },
): Record<string, VaultPicturePlan> {
  const out: Record<string, VaultPicturePlan> = {}
  for (const word of words) {
    const key = normalizePlanWord(word)
    if (!key || out[key]) continue
    if (isObviouslyUnpicturable(key)) {
      out[key] = { picturable: false, keyword: key, phrase: '', gloss: opts.model[key]?.gloss ?? '' }
      continue
    }
    const curated = opts.curated(key)
    out[key] = opts.model[key] ?? { picturable: true, keyword: key, phrase: curated ?? key, gloss: '' }
  }
  return out
}

/** Words that still need the model (not on the skip list). */
export function wordsNeedingModel(words: readonly string[]): string[] {
  const out = new Set<string>()
  for (const word of words) {
    const key = normalizePlanWord(word)
    if (key && !isObviouslyUnpicturable(key)) out.add(key)
  }
  return [...out]
}
