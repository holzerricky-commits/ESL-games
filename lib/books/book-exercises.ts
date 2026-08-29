/** Book-level interactive exercises (workbook tasks boxed on a PDF page). */

export const BOOK_EXERCISE_KIND_WORD_BANK = 'word_bank' as const
export const BOOK_EXERCISE_KIND_MULTIPLE_CHOICE = 'multiple_choice' as const
export const BOOK_EXERCISE_KINDS = [
  BOOK_EXERCISE_KIND_WORD_BANK,
  BOOK_EXERCISE_KIND_MULTIPLE_CHOICE,
] as const

/** Default / legacy kind (old saved tasks with no type). */
export const BOOK_EXERCISE_KIND = BOOK_EXERCISE_KIND_WORD_BANK

export type BookExerciseKind = (typeof BOOK_EXERCISE_KINDS)[number]

export type BookExerciseStatus = 'draft' | 'approved'

/** Type `___` (3+ underscores) in a sentence for each gap. */
export const BOOK_EXERCISE_BLANK = '___'

const BLANK_RE = /_{3,}/g

/** Axis-aligned box on one PDF page (0–1, origin top-left). */
export type PageNormRect = {
  x: number
  y: number
  w: number
  h: number
}

export type BookExerciseItem = {
  id: string
  /** Sentence with `___` where a bank word/phrase goes. */
  stem: string
  /** One answer per blank, matching a word-bank entry. */
  answers: string[]
}

/** One choose-the-correct-answer question. Empty in Phase 1. */
export type BookExerciseMcqQuestion = {
  id: string
  prompt: string
  /** 2–4 choices. Phase 1 saves none. */
  choices: string[]
  /** Index of the one right choice. Null until filled. */
  correctIndex: number | null
}

export type BookExerciseTask = {
  id: string
  kind: BookExerciseKind
  status: BookExerciseStatus
  unitId: string
  pdfPage: number
  rect: PageNormRect
  /** Page-normalized icon center. Missing = top-left of `rect`. Does not move the crop box. */
  pin?: [number, number]
  label: string
  wordBank: string[]
  items: BookExerciseItem[]
  questions: BookExerciseMcqQuestion[]
  createdAt: string
  updatedAt: string
  approvedAt: string | null
}

export const BOOK_EXERCISE_MIN_NORM_SIZE = 0.03

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function roundNorm(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function clampPageNormRect(
  rect: PageNormRect,
  minSize = BOOK_EXERCISE_MIN_NORM_SIZE,
): PageNormRect | null {
  const x = clamp01(rect.x)
  const y = clamp01(rect.y)
  const xMax = clamp01(rect.x + rect.w)
  const yMax = clamp01(rect.y + rect.h)
  const w = xMax - x
  const h = yMax - y
  if (w < minSize || h < minSize) return null
  return { x: roundNorm(x), y: roundNorm(y), w: roundNorm(w), h: roundNorm(h) }
}

export function pageNormRectFromNormCorners(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minSize = BOOK_EXERCISE_MIN_NORM_SIZE,
): PageNormRect | null {
  return clampPageNormRect(
    {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    },
    minSize,
  )
}

export function clampBookExercisePinCenter(center: [number, number]): [number, number] {
  const x = Number.isFinite(center[0]) ? center[0] : 0
  const y = Number.isFinite(center[1]) ? center[1] : 0
  return [roundNorm(Math.max(0, Math.min(1, x))), roundNorm(Math.max(0, Math.min(1, y)))]
}

/** Default icon spot: top-left corner of the boxed task. */
export function bookExercisePinCenter(rect: PageNormRect): [number, number] {
  return clampBookExercisePinCenter([rect.x, rect.y])
}

export function resolveBookExercisePinCenter(
  task: Pick<BookExerciseTask, 'rect'> & { pin?: [number, number] | null },
): [number, number] {
  if (task.pin && task.pin.length >= 2) return clampBookExercisePinCenter(task.pin)
  return bookExercisePinCenter(task.rect)
}

function parseBookExercisePin(raw: unknown): [number, number] | undefined {
  if (Array.isArray(raw) && raw.length >= 2) {
    const x = Number(raw[0])
    const y = Number(raw[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
    return clampBookExercisePinCenter([x, y])
  }
  if (raw && typeof raw === 'object') {
    const src = raw as { x?: unknown; y?: unknown }
    const x = Number(src.x)
    const y = Number(src.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
    return clampBookExercisePinCenter([x, y])
  }
  return undefined
}

/** Slightly enlarge a page box so a crop does not clip labels on the edge. */
export function expandPageNormRect(rect: PageNormRect, pad = 0.012): PageNormRect {
  return (
    clampPageNormRect(
      {
        x: rect.x - pad,
        y: rect.y - pad,
        w: rect.w + pad * 2,
        h: rect.h + pad * 2,
      },
      BOOK_EXERCISE_MIN_NORM_SIZE,
    ) ?? rect
  )
}

export function listBookExercisesForPdfPage(
  tasks: readonly BookExerciseTask[],
  pdfPage: number,
): BookExerciseTask[] {
  return tasks.filter((task) => task.pdfPage === pdfPage)
}

export function nextBookExerciseLabel(tasks: readonly { label?: string }[]): string {
  let max = 0
  for (const task of tasks) {
    const match = /^Task\s+(\d+)\s*$/i.exec(task.label?.trim() ?? '')
    if (!match) continue
    const n = Number(match[1])
    if (Number.isFinite(n) && n > max) max = n
  }
  return `Task ${max + 1}`
}

export function sortBookExerciseTasks(tasks: readonly BookExerciseTask[]): BookExerciseTask[] {
  return [...tasks].sort((a, b) => {
    if (a.pdfPage !== b.pdfPage) return a.pdfPage - b.pdfPage
    if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y
    if (a.rect.x !== b.rect.x) return a.rect.x - b.rect.x
    return a.createdAt.localeCompare(b.createdAt)
  })
}

function newExercisePartId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}`
}

export function parseBookExerciseKind(raw: unknown): BookExerciseKind {
  return raw === BOOK_EXERCISE_KIND_MULTIPLE_CHOICE
    ? BOOK_EXERCISE_KIND_MULTIPLE_CHOICE
    : BOOK_EXERCISE_KIND_WORD_BANK
}

export function isBookExerciseMultipleChoice(
  task: Pick<BookExerciseTask, 'kind'> | null | undefined,
): boolean {
  return task?.kind === BOOK_EXERCISE_KIND_MULTIPLE_CHOICE
}

export function bookExerciseKindLabel(kind: BookExerciseKind): string {
  return kind === BOOK_EXERCISE_KIND_MULTIPLE_CHOICE ? 'Choose answer' : 'Word bank'
}

export function createEmptyBookExerciseItem(): BookExerciseItem {
  return { id: newExercisePartId('item'), stem: '', answers: [] }
}

export function createEmptyBookExerciseMcqQuestion(): BookExerciseMcqQuestion {
  return { id: newExercisePartId('q'), prompt: '', choices: ['', ''], correctIndex: null }
}

export const BOOK_EXERCISE_MCQ_MIN_CHOICES = 2
export const BOOK_EXERCISE_MCQ_MAX_CHOICES = 4

export function normalizeBookExerciseMcqChoices(raw: readonly string[]): string[] {
  return raw.map((choice) => choice.trim()).slice(0, BOOK_EXERCISE_MCQ_MAX_CHOICES)
}

export function isBookExerciseMcqQuestionIncomplete(question: BookExerciseMcqQuestion): boolean {
  if (!question.prompt.trim()) return true
  const choices = normalizeBookExerciseMcqChoices(question.choices).filter(Boolean)
  if (choices.length < BOOK_EXERCISE_MCQ_MIN_CHOICES) return true
  const correctIndex = question.correctIndex
  if (correctIndex == null || !Number.isInteger(correctIndex)) return true
  if (correctIndex < 0 || correctIndex >= question.choices.length) return true
  return !question.choices[correctIndex]?.trim()
}

export function sanitizeBookExerciseMcqQuestion(raw: unknown): BookExerciseMcqQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<BookExerciseMcqQuestion>
  const id = typeof src.id === 'string' && src.id.trim() ? src.id.trim() : newExercisePartId('q')
  const prompt = typeof src.prompt === 'string' ? src.prompt : ''
  const choices = normalizeBookExerciseMcqChoices(
    Array.isArray(src.choices) ? src.choices.map((choice) => (typeof choice === 'string' ? choice : '')) : [],
  )
  while (choices.length < BOOK_EXERCISE_MCQ_MIN_CHOICES) choices.push('')
  const correctRaw = src.correctIndex
  const correctIndex =
    typeof correctRaw === 'number' &&
    Number.isInteger(correctRaw) &&
    correctRaw >= 0 &&
    correctRaw < choices.length
      ? correctRaw
      : null
  return { id, prompt, choices, correctIndex }
}

export function countBookExerciseBlanks(stem: string): number {
  const matches = stem.match(BLANK_RE)
  return matches?.length ?? 0
}

export function normalizeWordBank(raw: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    const word = entry.trim().replace(/\s+/g, ' ')
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(word)
  }
  return out
}

export function parseWordBankText(text: string): string[] {
  return normalizeWordBank(text.split(/\r?\n/))
}

export function formatWordBankText(bank: readonly string[]): string {
  return bank.join('\n')
}

export function findWordBankEntry(bank: readonly string[], answer: string): string | null {
  const needle = answer.trim().toLowerCase()
  if (!needle) return null
  return bank.find((word) => word.toLowerCase() === needle) ?? null
}

export function sanitizeBookExerciseItem(raw: unknown, wordBank: readonly string[]): BookExerciseItem | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<BookExerciseItem>
  const id = typeof src.id === 'string' && src.id.trim() ? src.id.trim() : newExercisePartId('item')
  const stem = typeof src.stem === 'string' ? src.stem : ''
  const blanks = countBookExerciseBlanks(stem)
  const answersRaw = Array.isArray(src.answers) ? src.answers : []
  const answers: string[] = []
  for (let i = 0; i < blanks; i += 1) {
    const given = typeof answersRaw[i] === 'string' ? answersRaw[i] : ''
    answers.push(findWordBankEntry(wordBank, given) ?? given.trim())
  }
  return { id, stem, answers }
}

export function isBookExerciseItemIncomplete(
  item: BookExerciseItem,
  wordBank: readonly string[],
): boolean {
  const blanks = countBookExerciseBlanks(item.stem)
  if (blanks < 1) return true
  if (item.answers.length !== blanks) return true
  return item.answers.some((answer) => !findWordBankEntry(wordBank, answer))
}

export function bookExerciseTaskCanApprove(task: BookExerciseTask | null | undefined): boolean {
  if (!task) return false
  if (isBookExerciseMultipleChoice(task)) {
    if (task.questions.length < 1) return false
    return task.questions.every((question) => !isBookExerciseMcqQuestionIncomplete(question))
  }
  if (task.wordBank.length < 1) return false
  if (task.items.length < 1) return false
  return task.items.every((item) => !isBookExerciseItemIncomplete(item, task.wordBank))
}

export type BookExerciseStemPart =
  | { type: 'text'; value: string }
  | { type: 'blank' }

export function splitBookExerciseStem(stem: string): BookExerciseStemPart[] {
  const parts: BookExerciseStemPart[] = []
  const re = /_{3,}/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(stem))) {
    if (match.index > last) {
      parts.push({ type: 'text', value: stem.slice(last, match.index) })
    }
    parts.push({ type: 'blank' })
    last = match.index + match[0].length
  }
  if (last < stem.length) parts.push({ type: 'text', value: stem.slice(last) })
  if (parts.length === 0) parts.push({ type: 'text', value: stem })
  return parts
}

export type BookExercisePlacements = Record<string, Array<string | null>>

export function emptyBookExercisePlacements(task: BookExerciseTask): BookExercisePlacements {
  const out: BookExercisePlacements = {}
  for (const item of task.items) {
    out[item.id] = item.answers.map(() => null)
  }
  return out
}

/** Fill every gap with the keyed answer (bank spelling). */
export function revealedBookExercisePlacements(task: BookExerciseTask): BookExercisePlacements {
  const out: BookExercisePlacements = {}
  for (const item of task.items) {
    out[item.id] = item.answers.map((answer) => findWordBankEntry(task.wordBank, answer) ?? answer)
  }
  return out
}

export function remainingBookExerciseBank(
  wordBank: readonly string[],
  placements: BookExercisePlacements,
): string[] {
  const remaining = [...wordBank]
  for (const slots of Object.values(placements)) {
    for (const word of slots) {
      if (!word) continue
      const index = remaining.findIndex((entry) => entry.toLowerCase() === word.trim().toLowerCase())
      if (index >= 0) remaining.splice(index, 1)
    }
  }
  return remaining
}

export const BOOK_EXERCISE_DRAG_THRESHOLD_PX = 8
export const BOOK_EXERCISE_SNAP_DISTANCE_PX = 56

export type BookExerciseGapCenter<T> = {
  id: T
  x: number
  y: number
}

/** Nearest gap whose center is within maxDistance of the point, or null. */
export function nearestBookExerciseGap<T>(
  point: { x: number; y: number },
  gaps: readonly BookExerciseGapCenter<T>[],
  maxDistance: number,
): T | null {
  let best: T | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const gap of gaps) {
    const dist = Math.hypot(gap.x - point.x, gap.y - point.y)
    if (dist > maxDistance) continue
    if (dist < bestDist) {
      bestDist = dist
      best = gap.id
    }
  }
  return best
}

export function bookExercisePlacementsFilled(
  task: BookExerciseTask,
  placements: BookExercisePlacements,
): boolean {
  return task.items.every((item) => {
    const slots = placements[item.id] ?? []
    return item.answers.length > 0 && slots.length === item.answers.length && slots.every(Boolean)
  })
}

export function gradeBookExercisePlacements(
  task: BookExerciseTask,
  placements: BookExercisePlacements,
): { allCorrect: boolean; byItem: Record<string, boolean[]> } {
  const byItem: Record<string, boolean[]> = {}
  let allCorrect = true
  for (const item of task.items) {
    const slots = placements[item.id] ?? []
    const results = item.answers.map((correct, index) => {
      const got = slots[index]
      return Boolean(got && findWordBankEntry([correct], got))
    })
    if (results.length !== item.answers.length || results.some((ok) => !ok)) allCorrect = false
    byItem[item.id] = results
  }
  return { allCorrect, byItem }
}

/** Selected choice index per question id (choose-answer Check). */
export type BookExerciseMcqSelections = Record<string, number | null>

export function emptyBookExerciseMcqSelections(task: BookExerciseTask): BookExerciseMcqSelections {
  const out: BookExerciseMcqSelections = {}
  for (const question of task.questions) {
    out[question.id] = null
  }
  return out
}

export function bookExerciseMcqSelectionsFilled(
  task: BookExerciseTask,
  selections: BookExerciseMcqSelections,
): boolean {
  return task.questions.every((question) => {
    const pick = selections[question.id]
    if (pick == null || !Number.isInteger(pick)) return false
    if (pick < 0 || pick >= question.choices.length) return false
    return Boolean(question.choices[pick]?.trim())
  })
}

export function gradeBookExerciseMcqSelections(
  task: BookExerciseTask,
  selections: BookExerciseMcqSelections,
): { allCorrect: boolean; byQuestion: Record<string, boolean> } {
  const byQuestion: Record<string, boolean> = {}
  let allCorrect = true
  for (const question of task.questions) {
    const pick = selections[question.id]
    const ok = pick != null && question.correctIndex != null && pick === question.correctIndex
    if (!ok) allCorrect = false
    byQuestion[question.id] = ok
  }
  return { allCorrect, byQuestion }
}

/** Fill every question with the keyed correct choice. */
export function revealedBookExerciseMcqSelections(task: BookExerciseTask): BookExerciseMcqSelections {
  const out: BookExerciseMcqSelections = {}
  for (const question of task.questions) {
    out[question.id] = question.correctIndex
  }
  return out
}

export function isBookExerciseLiveEligible(task: BookExerciseTask | null | undefined): boolean {
  if (!task) return false
  return task.status === 'approved' && bookExerciseTaskCanApprove(task)
}

/** Approved + complete — only these may become a live Check. */
export function getLiveEligibleBookExerciseTasks(
  tasks: readonly BookExerciseTask[],
): BookExerciseTask[] {
  return tasks.filter((task) => isBookExerciseLiveEligible(task))
}

export type BookExerciseGeminiDraft = {
  wordBank: string[]
  items: BookExerciseItem[]
  unusable: boolean
}

export type BookExerciseMcqGeminiDraft = {
  questions: BookExerciseMcqQuestion[]
  unusable: boolean
}

/** Turn Gemini JSON into a word-bank draft. Empty / flagged crops are unusable. */
export function parseBookExerciseGeminiDraft(raw: unknown): BookExerciseGeminiDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as { wordBank?: unknown; items?: unknown; unusable?: unknown }
  const flagged = src.unusable === true
  const wordBank = normalizeWordBank(Array.isArray(src.wordBank) ? src.wordBank.map(String) : [])
  const items = Array.isArray(src.items)
    ? src.items
        .map((item) => sanitizeBookExerciseItem(item, wordBank))
        .filter((item): item is BookExerciseItem => !!item && countBookExerciseBlanks(item.stem) > 0)
    : []
  if (flagged || wordBank.length < 1 || items.length < 1) {
    return { wordBank, items, unusable: true }
  }
  return { wordBank, items, unusable: false }
}

/** Turn Gemini JSON into a choose-answer draft. Empty / flagged crops are unusable. */
export function parseBookExerciseMcqGeminiDraft(raw: unknown): BookExerciseMcqGeminiDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as { questions?: unknown; unusable?: unknown }
  const flagged = src.unusable === true
  const questions = Array.isArray(src.questions)
    ? src.questions
        .map((question) => sanitizeBookExerciseMcqQuestion(question))
        .filter((question): question is BookExerciseMcqQuestion => !!question && question.prompt.trim().length > 0)
    : []
  if (flagged || questions.length < 1) {
    return { questions, unusable: true }
  }
  return { questions, unusable: false }
}

export function bookExerciseContentSummary(task: BookExerciseTask): string {
  if (isBookExerciseMultipleChoice(task)) {
    const count = task.questions.length
    if (count === 0) return 'empty'
    if (task.status === 'approved' && bookExerciseTaskCanApprove(task)) return 'approved'
    if (bookExerciseTaskCanApprove(task)) {
      return count === 1 ? 'ready · 1 question' : `ready · ${count} questions`
    }
    return count === 1 ? 'draft · 1 question' : `draft · ${count} questions`
  }
  const sentences = task.items.length
  const blanks = task.items.reduce((sum, item) => sum + countBookExerciseBlanks(item.stem), 0)
  if (sentences === 0 && task.wordBank.length === 0) return 'empty'
  if (task.status === 'approved' && bookExerciseTaskCanApprove(task)) return 'approved'
  if (sentences === 0) return 'draft · no sentences'
  const gapBit = blanks === 1 ? '1 gap' : `${blanks} gaps`
  return `draft · ${gapBit}`
}

export function demoteBookExerciseTaskToDraft(task: BookExerciseTask): BookExerciseTask {
  if (task.status === 'draft' && task.approvedAt == null) {
    return { ...task, updatedAt: new Date().toISOString() }
  }
  return {
    ...task,
    status: 'draft',
    approvedAt: null,
    updatedAt: new Date().toISOString(),
  }
}

export function approveBookExerciseTask(task: BookExerciseTask): BookExerciseTask | null {
  if (isBookExerciseMultipleChoice(task)) {
    const questions = task.questions
      .map((question) => sanitizeBookExerciseMcqQuestion(question))
      .filter((question): question is BookExerciseMcqQuestion => !!question)
    const sanitized = { ...task, questions }
    if (!bookExerciseTaskCanApprove(sanitized)) return null
    const now = new Date().toISOString()
    return { ...sanitized, status: 'approved', approvedAt: now, updatedAt: now }
  }
  const sanitized = {
    ...task,
    wordBank: normalizeWordBank(task.wordBank),
    items: task.items
      .map((item) => sanitizeBookExerciseItem(item, normalizeWordBank(task.wordBank)))
      .filter((item): item is BookExerciseItem => !!item),
  }
  if (!bookExerciseTaskCanApprove(sanitized)) return null
  const now = new Date().toISOString()
  return { ...sanitized, status: 'approved', approvedAt: now, updatedAt: now }
}

export function parseBookExerciseTask(raw: unknown): BookExerciseTask | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<BookExerciseTask> & { rect?: Partial<PageNormRect> }
  if (typeof src.id !== 'string' || !src.id.trim()) return null
  if (typeof src.unitId !== 'string' || !src.unitId.trim()) return null
  const pdfPage = Math.floor(Number(src.pdfPage))
  if (!Number.isFinite(pdfPage) || pdfPage < 1) return null
  const rect = clampPageNormRect({
    x: Number(src.rect?.x),
    y: Number(src.rect?.y),
    w: Number(src.rect?.w),
    h: Number(src.rect?.h),
  })
  if (!rect) return null
  const kind = parseBookExerciseKind((src as { kind?: unknown }).kind)
  const wordBank = normalizeWordBank(Array.isArray(src.wordBank) ? src.wordBank.map(String) : [])
  const items = Array.isArray(src.items)
    ? src.items
        .map((item) => sanitizeBookExerciseItem(item, wordBank))
        .filter((item): item is BookExerciseItem => !!item)
    : []
  const questionsRaw = (src as { questions?: unknown }).questions
  const questions = Array.isArray(questionsRaw)
    ? questionsRaw
        .map((question) => sanitizeBookExerciseMcqQuestion(question))
        .filter((question): question is BookExerciseMcqQuestion => !!question)
    : []
  const createdAt = typeof src.createdAt === 'string' ? src.createdAt : new Date().toISOString()
  const updatedAt = typeof src.updatedAt === 'string' ? src.updatedAt : createdAt
  let status: BookExerciseStatus = src.status === 'approved' ? 'approved' : 'draft'
  const approvedAt = typeof src.approvedAt === 'string' ? src.approvedAt : null
  const pin = parseBookExercisePin((src as { pin?: unknown }).pin)
  const task: BookExerciseTask = {
    id: src.id.trim(),
    kind,
    status,
    unitId: src.unitId.trim(),
    pdfPage,
    rect,
    ...(pin ? { pin } : {}),
    label: typeof src.label === 'string' && src.label.trim() ? src.label.trim() : 'Task',
    wordBank,
    items,
    questions,
    createdAt,
    updatedAt,
    approvedAt: status === 'approved' ? approvedAt : null,
  }
  if (task.status === 'approved' && !bookExerciseTaskCanApprove(task)) {
    task.status = 'draft'
    task.approvedAt = null
  }
  return task
}
