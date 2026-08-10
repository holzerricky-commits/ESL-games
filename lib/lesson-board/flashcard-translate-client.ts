export type FlashcardTranslation = {
  chinese: string
  pinyin: string
  partOfSpeech?: string
}

export type FlashcardTranslationResult = {
  primary: FlashcardTranslation
  alternatives: FlashcardTranslation[]
}

type TranslateApiAlternative = {
  chinese?: string
  pinyin?: string
  partOfSpeech?: string
}

type TranslateApiResponse = {
  ok?: boolean
  chinese?: string
  pinyin?: string
  alternatives?: TranslateApiAlternative[]
  error?: string
}

function normalizeTranslation(raw: TranslateApiAlternative | undefined): FlashcardTranslation | null {
  if (!raw) return null
  const chinese = raw.chinese?.trim()
  if (!chinese) return null
  return {
    chinese,
    pinyin: typeof raw.pinyin === 'string' ? raw.pinyin.trim() : '',
    partOfSpeech:
      typeof raw.partOfSpeech === 'string' && raw.partOfSpeech.trim()
        ? raw.partOfSpeech.trim()
        : undefined,
  }
}

/** English → Chinese for lesson-board flashcards (same API as translate dock). */
export async function fetchFlashcardTranslation(
  text: string,
  context?: string,
): Promise<FlashcardTranslation | null> {
  const result = await fetchFlashcardTranslationWithAlternatives(text, context)
  return result?.primary ?? null
}

/** Includes alternative meanings when the API returns them (single-word lookups). */
export async function fetchFlashcardTranslationWithAlternatives(
  text: string,
  context?: string,
): Promise<FlashcardTranslationResult | null> {
  const trimmed = text.trim().slice(0, 240)
  if (!trimmed) return null

  const ctx = context?.trim().slice(0, 360)

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: trimmed,
        ...(ctx ? { context: ctx } : {}),
      }),
    })
    const data = (await res.json()) as TranslateApiResponse
    const primary = normalizeTranslation(data)
    if (!res.ok || !data.ok || !primary) return null

    const alternatives: FlashcardTranslation[] = []
    for (const alt of data.alternatives ?? []) {
      const normalized = normalizeTranslation(alt)
      if (!normalized) continue
      if (normalized.chinese === primary.chinese && normalized.pinyin === primary.pinyin) continue
      alternatives.push(normalized)
    }

    return { primary, alternatives }
  } catch {
    return null
  }
}

/** Primary first, then distinct alternatives — for homonym picker UI. */
export function flashcardMeaningOptions(result: FlashcardTranslationResult): FlashcardTranslation[] {
  const out: FlashcardTranslation[] = [result.primary]
  const seen = new Set<string>([`${result.primary.chinese}\0${result.primary.pinyin}`])

  for (const alt of result.alternatives) {
    const key = `${alt.chinese}\0${alt.pinyin}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(alt)
  }

  return out
}

/** Prefer Chinese; optionally append pinyin in parentheses when both exist. */
export function formatFlashcardChineseLine(
  translation: FlashcardTranslation,
  options?: { showPinyin?: boolean },
): string {
  const { chinese, pinyin } = translation
  const showPinyin = options?.showPinyin !== false
  if (!showPinyin || !pinyin) return chinese
  return `${chinese} (${pinyin})`
}

export function flashcardMeaningLabel(
  option: FlashcardTranslation,
  options?: { showPinyin?: boolean },
): string {
  const line = formatFlashcardChineseLine(option, options)
  if (option.partOfSpeech) return `${line} — ${option.partOfSpeech}`
  return line
}

/** Split a flashcard footer line like `苍蝇 (cāng yíng)` into parts for vocab storage. */
export function parseFlashcardChineseLineParts(
  line: string,
): { chinese: string; pinyin: string } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed === '…') return null
  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenMatch) {
    return { chinese: parenMatch[1]!.trim(), pinyin: parenMatch[2]!.trim() }
  }
  return { chinese: trimmed, pinyin: '' }
}
