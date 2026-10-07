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
  pdfPage: number
  createdAt: string
  updatedAt: string
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
}

export function emptyLessonVaultDiskPayload(): LessonVaultDiskPayload {
  return { byStudent: {} }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
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
  return word.trim().toLowerCase()
}

export function isCardInLesson(card: LessonVaultCard, ref: LessonVaultLessonRef): boolean {
  return card.bookId === ref.bookId && card.unitId === ref.unitId && card.lessonId === ref.lessonId
}

export function cardsForLesson(cards: readonly LessonVaultCard[], ref: LessonVaultLessonRef): LessonVaultCard[] {
  return cards.filter((card) => isCardInLesson(card, ref))
}

/** Adds a card, or updates the existing card when the same word is already in that lesson. */
export function upsertLessonVaultCard(
  cards: readonly LessonVaultCard[],
  input: LessonVaultSaveInput,
  options: { now: string; createId: () => string },
): { cards: LessonVaultCard[]; mode: 'added' | 'updated'; card: LessonVaultCard } {
  const word = input.word.trim()
  const sentence = input.sentence.trim()
  const key = wordKey(word)
  const index = cards.findIndex((card) => isCardInLesson(card, input) && wordKey(card.word) === key)
  if (index >= 0) {
    const prev = cards[index]!
    const card: LessonVaultCard = {
      ...prev,
      sentence: sentence || prev.sentence,
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
    pdfPage: input.pdfPage,
    createdAt: options.now,
    updatedAt: options.now,
  }
  return { cards: [...cards, card], mode: 'added', card }
}
