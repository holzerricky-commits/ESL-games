export type TranslationAlternative = {
  chinese: string
  pinyin: string
  partOfSpeech: string
  exampleEn: string
  exampleZh: string
}

export type TranslationResult = {
  source: string
  chinese: string
  pinyin: string
  exampleEn: string
  exampleZh: string
  alternatives: TranslationAlternative[]
}

export type FetchTranslationOutcome =
  | { ok: true; result: TranslationResult }
  | { ok: false; error: string }

type TranslateApiResponse = {
  ok?: boolean
  chinese?: string
  pinyin?: string
  exampleEn?: string
  exampleZh?: string
  alternatives?: Array<{
    chinese?: string
    pinyin?: string
    partOfSpeech?: string
    exampleEn?: string
    exampleZh?: string
  }>
  error?: string
}

const clientCache = new Map<string, TranslationResult>()

export function translationCacheKey(text: string, context = ''): string {
  const t = text.trim().toLowerCase()
  const c = context.trim().toLowerCase()
  return c ? `${t}::ctx:${c}` : t
}

function normalizeAlternative(
  item: NonNullable<TranslateApiResponse['alternatives']>[number],
): TranslationAlternative | null {
  const chinese = typeof item?.chinese === 'string' ? item.chinese.trim() : ''
  const pinyin = typeof item?.pinyin === 'string' ? item.pinyin.trim() : ''
  const partOfSpeech = typeof item?.partOfSpeech === 'string' ? item.partOfSpeech.trim() : ''
  const exampleEn = typeof item?.exampleEn === 'string' ? item.exampleEn.trim() : ''
  const exampleZh = typeof item?.exampleZh === 'string' ? item.exampleZh.trim() : ''
  if (!chinese) return null
  return { chinese, pinyin, partOfSpeech, exampleEn, exampleZh }
}

export function contextFromWindowSelection(query: string): string {
  if (typeof window === 'undefined') return ''
  const selected = window.getSelection()?.toString().trim() ?? ''
  if (!selected) return ''
  if (selected.length < 4) return ''
  if (selected.length > 360) return selected.slice(0, 360)
  const q = query.trim().toLowerCase()
  if (!q) return ''
  const s = selected.toLowerCase()
  if (!s.includes(q) && s.length <= q.length + 8) return ''
  return selected
}

export async function fetchTranslation(
  raw: string,
  context = '',
  options?: { cache?: Map<string, TranslationResult>; retryWithoutContext?: boolean },
): Promise<FetchTranslationOutcome> {
  const text = raw.trim()
  if (!text) {
    return { ok: false, error: 'Enter a word or phrase to translate.' }
  }

  const ctx = context.trim().slice(0, 360)
  const outcome = await fetchTranslationOnce(text, ctx, options?.cache)
  if (outcome.ok || !ctx || options?.retryWithoutContext === false) {
    return outcome
  }
  return fetchTranslationOnce(text, '', options?.cache)
}

async function fetchTranslationOnce(
  text: string,
  ctx: string,
  cacheOverride?: Map<string, TranslationResult>,
): Promise<FetchTranslationOutcome> {
  const cacheId = translationCacheKey(text, ctx)
  const cache = cacheOverride ?? clientCache
  const cached = cache.get(cacheId)
  if (cached) {
    return { ok: true, result: cached }
  }

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context: ctx }),
    })
    const data = (await res.json()) as TranslateApiResponse
    if (!res.ok || !data.ok || !data.chinese) {
      return { ok: false, error: data.error ?? 'Translation failed.' }
    }

    const entry: TranslationResult = {
      source: text,
      chinese: data.chinese,
      pinyin: data.pinyin ?? '',
      exampleEn: typeof data.exampleEn === 'string' ? data.exampleEn.trim() : '',
      exampleZh: typeof data.exampleZh === 'string' ? data.exampleZh.trim() : '',
      alternatives: Array.isArray(data.alternatives)
        ? data.alternatives
            .map((item) => normalizeAlternative(item))
            .filter((item): item is TranslationAlternative => item != null)
            .slice(0, 3)
        : [],
    }
    cache.set(cacheId, entry)
    return { ok: true, result: entry }
  } catch {
    return { ok: false, error: 'Translation failed. Check your connection.' }
  }
}
