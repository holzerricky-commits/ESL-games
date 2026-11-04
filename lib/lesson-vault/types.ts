import { dictionaryForm, preferredVaultWord, vaultWordKey } from '@/lib/lesson-vault/dictionary-form'

/** One word saved while reading, kept in a student's vault for one lesson. */
export type LessonVaultCard = {
  id: string
  bookId: string
  unitId: string
  lessonId: string
  lessonTitle: string
  partId: string
  partTitle: string
  word: string
  sentence: string
  /** Optional short English meaning (Word ↔ meaning game / editor). */
  meaning: string
  /** Simplified Chinese translation for the flashcard front; empty until filled. */
  chinese: string
  /** Picture on the front (from picture search); empty when none. */
  imageUrl: string
  /** Where the current picture came from; '' when there is none. */
  pictureSource: LessonVaultPictureSource
  /** Alternatives from the automatic search (one-click swap). */
  pictureChoices: LessonVaultPictureChoice[]
  pictureChoiceIndex: number
  /** Result of the automatic picture search; '' = not tried yet. */
  autoPicture: LessonVaultAutoPicture
  pdfPage: number
  /** Saved review label. Older saves without one count as not checked. */
  reviewStatus: LessonVaultReviewStatus
  createdAt: string
  updatedAt: string
}

export type LessonVaultPictureSource = '' | 'auto' | 'search' | 'own'
export type LessonVaultAutoPicture = '' | 'found' | 'not-found' | 'abstract'
export type LessonVaultPictureChoice = { thumb: string; full: string }

/**
 * Not checked until review starts.
 * Practising → Learned climb from games; Mastered is reserved for a later production check.
 */
export type LessonVaultReviewStatus = 'unchecked' | 'practising' | 'learned' | 'mastered'

export const MAX_PICTURE_CHOICES = 5

const PICTURE_SOURCES: readonly LessonVaultPictureSource[] = ['', 'auto', 'search', 'own']
const AUTO_PICTURE_STATES: readonly LessonVaultAutoPicture[] = ['', 'found', 'not-found', 'abstract']

export function lessonVaultReviewStatus(value: unknown): LessonVaultReviewStatus {
  return value === 'practising' || value === 'learned' || value === 'mastered' ? value : 'unchecked'
}

export type LessonVaultPictureMetaPatch = {
  autoPicture?: LessonVaultAutoPicture
  pictureChoices?: LessonVaultPictureChoice[]
  pictureChoiceIndex?: number
}

export type LessonVaultCardTextPatch = {
  sentence: string
  meaning: string
  /** Fixed spelling of the word; ignored when empty. */
  word?: string
}

export type LessonVaultDiskPayload = {
  byStudent: Record<string, LessonVaultCard[]>
}

export type LessonVaultLessonRef = {
  bookId: string
  unitId: string
  lessonId: string
}

export type LessonVaultSaveInput = LessonVaultLessonRef & {
  lessonTitle: string
  partId: string
  partTitle: string
  word: string
  sentence: string
  pdfPage: number
  /** Picture already chosen for this word; kept off the card when empty. */
  imageUrl?: string
  /** Optional gloss on create / fill-if-empty on update (e.g. vocab seed). */
  meaning?: string
}

export function emptyLessonVaultDiskPayload(): LessonVaultDiskPayload {
  return { byStudent: {} }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : allowed[0]!
}

function sanitizePictureChoices(raw: unknown): LessonVaultPictureChoice[] {
  if (!Array.isArray(raw)) return []
  const out: LessonVaultPictureChoice[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const full = str((entry as Record<string, unknown>).full).trim()
    const thumb = str((entry as Record<string, unknown>).thumb).trim() || full
    if (full) out.push({ thumb, full })
    if (out.length >= MAX_PICTURE_CHOICES) break
  }
  return out
}

export function sanitizeLessonVaultCard(raw: unknown): LessonVaultCard | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id).trim()
  const word = str(o.word).trim()
  const bookId = str(o.bookId).trim()
  const unitId = str(o.unitId).trim()
  const lessonId = str(o.lessonId).trim()
  if (!id || !word || !bookId || !unitId || !lessonId) return null
  const createdAt = str(o.createdAt) || new Date().toISOString()
  const imageUrl = str(o.imageUrl).trim()
  const pictureChoices = sanitizePictureChoices(o.pictureChoices)
  const choiceIndex = typeof o.pictureChoiceIndex === 'number' ? Math.floor(o.pictureChoiceIndex) : 0
  const source = oneOf(o.pictureSource, PICTURE_SOURCES)
  return {
    id,
    bookId,
    unitId,
    lessonId,
    lessonTitle: str(o.lessonTitle),
    partId: str(o.partId),
    partTitle: str(o.partTitle),
    word,
    sentence: str(o.sentence).trim(),
    meaning: str(o.meaning).trim(),
    chinese: str(o.chinese).trim(),
    imageUrl,
    pictureSource: imageUrl ? source || 'search' : '',
    pictureChoices,
    pictureChoiceIndex: choiceIndex >= 0 && choiceIndex < pictureChoices.length ? choiceIndex : 0,
    autoPicture: oneOf(o.autoPicture, AUTO_PICTURE_STATES),
    reviewStatus: lessonVaultReviewStatus(o.reviewStatus),
    pdfPage: typeof o.pdfPage === 'number' && Number.isFinite(o.pdfPage) ? o.pdfPage : 0,
    createdAt,
    updatedAt: str(o.updatedAt) || createdAt,
  }
}

export function normalizeLessonVaultDiskPayload(raw: unknown): LessonVaultDiskPayload {
  const empty = emptyLessonVaultDiskPayload()
  if (!raw || typeof raw !== 'object') return empty
  const byStudentRaw = (raw as Record<string, unknown>).byStudent
  if (!byStudentRaw || typeof byStudentRaw !== 'object' || Array.isArray(byStudentRaw)) return empty
  const byStudent: Record<string, LessonVaultCard[]> = {}
  for (const [studentId, entries] of Object.entries(byStudentRaw as Record<string, unknown>)) {
    if (!studentId.trim() || !Array.isArray(entries)) continue
    byStudent[studentId] = entries
      .map((entry) => sanitizeLessonVaultCard(entry))
      .filter((card): card is LessonVaultCard => card != null)
  }
  return { byStudent }
}

function wordKey(word: string): string {
  return vaultWordKey(word)
}

/** Loose key for matching a picture search to a saved word ("Seastars" ↔ "seastar"). */
export function pictureWordKey(word: string): string {
  const key = word
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
  if (key.length > 3 && key.endsWith('es') && /(s|x|z|ch|sh)es$/.test(key)) return key.slice(0, -2)
  if (key.length > 3 && key.endsWith('s') && !key.endsWith('ss')) return key.slice(0, -1)
  return key
}

export function isCardInLesson(card: LessonVaultCard, ref: LessonVaultLessonRef): boolean {
  return card.bookId === ref.bookId && card.unitId === ref.unitId && card.lessonId === ref.lessonId
}

export function cardsForLesson(cards: readonly LessonVaultCard[], ref: LessonVaultLessonRef): LessonVaultCard[] {
  return cards.filter((card) => isCardInLesson(card, ref))
}

/** Cards for every lesson in a teaching week. Earlier refs win, and each card is included once. */
export function cardsForLessons(
  cards: readonly LessonVaultCard[],
  refs: readonly LessonVaultLessonRef[],
): LessonVaultCard[] {
  const seen = new Set<string>()
  const out: LessonVaultCard[] = []
  for (const ref of refs) {
    for (const card of cardsForLesson(cards, ref)) {
      if (seen.has(card.id)) continue
      seen.add(card.id)
      out.push(card)
    }
  }
  return out
}

/** Adds a card, or updates the existing card when the same dictionary word is already in that lesson. */
export function upsertLessonVaultCard(
  cards: readonly LessonVaultCard[],
  input: LessonVaultSaveInput,
  options: { now: string; createId: () => string },
): { cards: LessonVaultCard[]; mode: 'added' | 'updated'; card: LessonVaultCard } {
  const sentence = input.sentence.trim()
  const word = dictionaryForm(input.word, sentence)
  const imageUrl = input.imageUrl?.trim() ?? ''
  const key = wordKey(word)
  const index = cards.findIndex((card) => isCardInLesson(card, input) && wordKey(card.word) === key)
  const meaning = (input.meaning ?? '').replace(/\s+/g, ' ').trim()
  if (index >= 0) {
    const prev = cards[index]!
    const card: LessonVaultCard = {
      ...prev,
      word: preferredVaultWord(prev.word, word),
      sentence: sentence || prev.sentence,
      meaning: prev.meaning.trim() || meaning,
      imageUrl: prev.imageUrl || imageUrl,
      pictureSource: prev.imageUrl ? prev.pictureSource : imageUrl ? 'search' : '',
      partId: input.partId,
      partTitle: input.partTitle,
      lessonTitle: input.lessonTitle || prev.lessonTitle,
      pdfPage: input.pdfPage,
      updatedAt: options.now,
    }
    const next = [...cards]
    next[index] = card
    return { cards: next, mode: 'updated', card }
  }
  const card: LessonVaultCard = {
    id: options.createId(),
    bookId: input.bookId,
    unitId: input.unitId,
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle,
    partId: input.partId,
    partTitle: input.partTitle,
    word,
    sentence,
    meaning,
    chinese: '',
    imageUrl,
    pictureSource: imageUrl ? 'search' : '',
    pictureChoices: [],
    pictureChoiceIndex: 0,
    autoPicture: '',
    reviewStatus: 'unchecked',
    pdfPage: input.pdfPage,
    createdAt: options.now,
    updatedAt: options.now,
  }
  return { cards: [...cards, card], mode: 'added', card }
}

/**
 * Writes a gloss onto a card that still has no meaning.
 * Leaves a meaning the teacher already saved, and ignores a blank gloss.
 */
export function fillLessonVaultCardMeaningIfEmpty(
  cards: readonly LessonVaultCard[],
  cardId: string,
  meaning: string,
  now: string,
): { cards: LessonVaultCard[]; card: LessonVaultCard } | null {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index < 0) return null
  const prev = cards[index]!
  const nextMeaning = meaning.replace(/\s+/g, ' ').trim()
  if (!nextMeaning || prev.meaning.trim()) return null
  const card: LessonVaultCard = { ...prev, meaning: nextMeaning, updatedAt: now }
  const next = [...cards]
  next[index] = card
  return { cards: next, card }
}

/**
 * Writes Simplified Chinese onto a card that still has none.
 * Leaves a translation already saved, and ignores a blank string.
 */
export function fillLessonVaultCardChineseIfEmpty(
  cards: readonly LessonVaultCard[],
  cardId: string,
  chinese: string,
  now: string,
): { cards: LessonVaultCard[]; card: LessonVaultCard } | null {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index < 0) return null
  const prev = cards[index]!
  const nextChinese = chinese.replace(/\s+/g, ' ').trim()
  if (!nextChinese || prev.chinese.trim()) return null
  const card: LessonVaultCard = { ...prev, chinese: nextChinese, updatedAt: now }
  const next = [...cards]
  next[index] = card
  return { cards: next, card }
}

/** Replaces the back-of-card text (sentence + meaning) for one card. */
export function updateLessonVaultCardText(
  cards: readonly LessonVaultCard[],
  cardId: string,
  patch: LessonVaultCardTextPatch,
  now: string,
): { cards: LessonVaultCard[]; card: LessonVaultCard } | null {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index < 0) return null
  const prev = cards[index]!
  const word = (patch.word ?? '').replace(/\s+/g, ' ').trim()
  const nextWord = word || prev.word
  const nextSentence = patch.sentence.replace(/\s+/g, ' ').trim()
  const senseChanged = nextWord !== prev.word || nextSentence !== prev.sentence
  const card: LessonVaultCard = {
    ...prev,
    word: nextWord,
    sentence: nextSentence,
    meaning: patch.meaning.replace(/\s+/g, ' ').trim(),
    // Drop stale Chinese when the English sense changes so auto-translate can refill.
    chinese: senseChanged ? '' : prev.chinese,
    updatedAt: now,
  }
  const next = [...cards]
  next[index] = card
  return { cards: next, card }
}

/** Writes saved review labels. Cards not in `updates` stay as they are. */
export function applyLessonVaultReviewStatuses(
  cards: readonly LessonVaultCard[],
  updates: readonly { cardId: string; status: LessonVaultReviewStatus }[],
  now: string,
): { cards: LessonVaultCard[]; updated: number } {
  const byId = new Map(updates.map((update) => [update.cardId, lessonVaultReviewStatus(update.status)]))
  let updated = 0
  const next = cards.map((card) => {
    const status = byId.get(card.id)
    if (!status) return card
    updated += 1
    return { ...card, reviewStatus: status, updatedAt: now }
  })
  return { cards: next, updated }
}

/** Takes one card out; `index` lets undo put it back in the same place. */
export function removeLessonVaultCard(
  cards: readonly LessonVaultCard[],
  cardId: string,
): { cards: LessonVaultCard[]; removed: LessonVaultCard; index: number } | null {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index < 0) return null
  return { cards: cards.filter((card) => card.id !== cardId), removed: cards[index]!, index }
}

/** Puts a removed card back (undo). No-op when it is already there. */
export function restoreLessonVaultCard(
  cards: readonly LessonVaultCard[],
  card: LessonVaultCard,
  index: number,
): LessonVaultCard[] {
  if (cards.some((c) => c.id === card.id)) return [...cards]
  const next = [...cards]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, card)
  return next
}

/** Moves a card to another lesson of the same unit. The part label is cleared (it belonged to the old lesson). */
export function moveLessonVaultCardToLesson(
  cards: readonly LessonVaultCard[],
  cardId: string,
  target: { lessonId: string; lessonTitle: string },
  now: string,
): { ok: true; cards: LessonVaultCard[]; card: LessonVaultCard } | { ok: false; reason: 'missing' | 'duplicate' } {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index < 0) return { ok: false, reason: 'missing' }
  const prev = cards[index]!
  const ref = { bookId: prev.bookId, unitId: prev.unitId, lessonId: target.lessonId }
  const key = wordKey(prev.word)
  if (cards.some((c) => c.id !== cardId && isCardInLesson(c, ref) && wordKey(c.word) === key)) {
    return { ok: false, reason: 'duplicate' }
  }
  const card: LessonVaultCard = {
    ...prev,
    lessonId: target.lessonId,
    lessonTitle: target.lessonTitle,
    partId: '',
    partTitle: '',
    updatedAt: now,
  }
  const next = [...cards]
  next[index] = card
  return { ok: true, cards: next, card }
}

/** Sets (or replaces) the front picture of one card. */
export function setLessonVaultCardImage(
  cards: readonly LessonVaultCard[],
  cardId: string,
  imageUrl: string,
  now: string,
  source: Exclude<LessonVaultPictureSource, ''> = 'own',
): { cards: LessonVaultCard[]; card: LessonVaultCard } | null {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index < 0) return null
  const url = imageUrl.trim()
  const card: LessonVaultCard = { ...cards[index]!, imageUrl: url, pictureSource: url ? source : '', updatedAt: now }
  const next = [...cards]
  next[index] = card
  return { cards: next, card }
}

/** Updates automatic-picture bookkeeping (state, choices) without touching the picture itself. */
export function patchLessonVaultCardPictureMeta(
  cards: readonly LessonVaultCard[],
  cardId: string,
  patch: LessonVaultPictureMetaPatch,
): { cards: LessonVaultCard[]; card: LessonVaultCard } | null {
  const index = cards.findIndex((card) => card.id === cardId)
  if (index < 0) return null
  const prev = cards[index]!
  const pictureChoices = patch.pictureChoices
    ? patch.pictureChoices.slice(0, MAX_PICTURE_CHOICES)
    : prev.pictureChoices
  const rawIndex = patch.pictureChoiceIndex ?? prev.pictureChoiceIndex
  const card: LessonVaultCard = {
    ...prev,
    autoPicture: patch.autoPicture ?? prev.autoPicture,
    pictureChoices,
    pictureChoiceIndex: rawIndex >= 0 && rawIndex < pictureChoices.length ? rawIndex : 0,
  }
  const next = [...cards]
  next[index] = card
  return { cards: next, card }
}

/** Blank cards the automatic search has not tried yet. */
export function cardsNeedingAutoPicture(cards: readonly LessonVaultCard[]): LessonVaultCard[] {
  return cards.filter((card) => !card.imageUrl && card.autoPicture === '')
}

/** Blank cards worth another automatic try (not ones judged hard to picture). */
export function cardsMissingPicture(cards: readonly LessonVaultCard[]): LessonVaultCard[] {
  return cards.filter((card) => !card.imageUrl && card.autoPicture !== 'abstract')
}
