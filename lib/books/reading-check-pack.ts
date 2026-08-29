/** Reading check pack (Phase 3): stops + questions, draft vs approved. */

export type ReadingCheckPackStatus = 'draft' | 'approved'

export type ReadingCheckQuestionKind = 'mcq' | 'true_false'

export type ReadingCheckHotspotPageSide = 'left' | 'right'

export interface ReadingCheckHotspotPlacement {
  /**
   * PDF page index (1-based). Preferred source of truth when placing from the book.
   * Null on older drafts that only stored pageSide.
   */
  pdfPage: number | null
  /** Which page in the visible spread (legacy + derived from click side). */
  pageSide: ReadingCheckHotspotPageSide
  /** 0..1 position inside that page. */
  x: number
  /** 0..1 position inside that page. */
  y: number
}

export interface ReadingCheckQuestion {
  id: string
  kind: ReadingCheckQuestionKind
  prompt: string
  /** MCQ choices (2–4). Ignored for true/false. */
  choices: string[]
  /** MCQ: index of correct choice. */
  correctIndex: number | null
  /** True/false: correct answer is true when `true`. */
  correctTrue: boolean | null
  /** Short excerpt from story text that supports the answer (prep review). */
  evidenceSnippet: string | null
  /** Substring inside evidenceSnippet to highlight; null if none/invalid. */
  evidenceHighlight: string | null
}

export interface ReadingCheckStop {
  id: string
  /** Teacher-facing check link label, e.g. "After the market scene". */
  label: string
  /** Printed/display page hint within the story (optional). */
  displayPage: number | null
  /** Short mid-page anchor when the beat ends mid-page. */
  midPageNote: string | null
  /** Optional clickable hotspot position for the live reader. */
  hotspot: ReadingCheckHotspotPlacement | null
  questions: ReadingCheckQuestion[]
}

export interface ReadingCheckPack {
  storyId: string
  bookId: string
  unitId: string
  status: ReadingCheckPackStatus
  stops: ReadingCheckStop[]
  updatedAt: string
  approvedAt: string | null
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}`
}

/**
 * Normalize evidence: keep snippet; keep highlight only when it appears in the snippet
 * (exact match first, then case-insensitive — returns the snippet's actual casing).
 */
export function resolveReadingCheckEvidence(
  snippetRaw: string | null | undefined,
  highlightRaw: string | null | undefined,
): { evidenceSnippet: string | null; evidenceHighlight: string | null } {
  const evidenceSnippet =
    typeof snippetRaw === 'string' && snippetRaw.trim() ? snippetRaw.trim() : null
  if (!evidenceSnippet) {
    return { evidenceSnippet: null, evidenceHighlight: null }
  }
  const highlight =
    typeof highlightRaw === 'string' && highlightRaw.trim() ? highlightRaw.trim() : null
  if (!highlight) {
    return { evidenceSnippet, evidenceHighlight: null }
  }
  if (evidenceSnippet.includes(highlight)) {
    return { evidenceSnippet, evidenceHighlight: highlight }
  }
  const lowerSnippet = evidenceSnippet.toLowerCase()
  const lowerHighlight = highlight.toLowerCase()
  const at = lowerSnippet.indexOf(lowerHighlight)
  if (at < 0) {
    return { evidenceSnippet, evidenceHighlight: null }
  }
  return {
    evidenceSnippet,
    evidenceHighlight: evidenceSnippet.slice(at, at + highlight.length),
  }
}

/** Split a snippet into before / mark / after for UI highlight rendering. */
export function splitEvidenceSnippetForHighlight(
  snippet: string,
  highlight: string | null | undefined,
): { before: string; mark: string; after: string } | null {
  if (!highlight) return null
  const at = snippet.indexOf(highlight)
  if (at < 0) return null
  return {
    before: snippet.slice(0, at),
    mark: snippet.slice(at, at + highlight.length),
    after: snippet.slice(at + highlight.length),
  }
}

export function createEmptyReadingCheckQuestion(
  kind: ReadingCheckQuestionKind = 'true_false',
): ReadingCheckQuestion {
  if (kind === 'mcq') {
    return {
      id: newId('q'),
      kind: 'mcq',
      prompt: '',
      choices: ['', '', '', ''],
      correctIndex: 0,
      correctTrue: null,
      evidenceSnippet: null,
      evidenceHighlight: null,
    }
  }
  return {
    id: newId('q'),
    kind: 'true_false',
    prompt: '',
    choices: [],
    correctIndex: null,
    correctTrue: true,
    evidenceSnippet: null,
    evidenceHighlight: null,
  }
}

export function createEmptyReadingCheckStop(
  displayPage?: number | null,
  kind: ReadingCheckQuestionKind = 'true_false',
): ReadingCheckStop {
  return {
    id: newId('stop'),
    label: '',
    displayPage: typeof displayPage === 'number' && displayPage >= 1 ? Math.floor(displayPage) : null,
    midPageNote: null,
    hotspot: null,
    questions: [createEmptyReadingCheckQuestion(kind)],
  }
}

/** Deep-copy a stop with fresh ids (duplicate in the editor). */
export function duplicateReadingCheckStop(stop: ReadingCheckStop): ReadingCheckStop {
  return {
    ...stop,
    id: newId('stop'),
    hotspot: stop.hotspot ? { ...stop.hotspot } : null,
    questions: stop.questions.map((q) => ({
      ...q,
      id: newId('q'),
      choices: [...q.choices],
    })),
  }
}

/** Primary question on a stop (v0 UI: one question per check). */
export function primaryQuestionOfStop(stop: ReadingCheckStop): ReadingCheckQuestion | null {
  return stop.questions[0] ?? null
}

export function isReadingCheckStopIncomplete(stop: ReadingCheckStop): boolean {
  const q = primaryQuestionOfStop(stop)
  if (!q) return true
  if (!q.prompt.trim()) return true
  if (q.kind === 'mcq') {
    const filled = q.choices.filter((c) => c.trim().length > 0)
    if (filled.length < 2) return true
    if (q.correctIndex == null || q.correctIndex < 0 || q.correctIndex >= q.choices.length) return true
    if (!q.choices[q.correctIndex]?.trim()) return true
  }
  if (q.kind === 'true_false' && typeof q.correctTrue !== 'boolean') return true
  return false
}

export function createEmptyReadingCheckPack(input: {
  storyId: string
  bookId: string
  unitId: string
}): ReadingCheckPack {
  return {
    storyId: input.storyId,
    bookId: input.bookId,
    unitId: input.unitId,
    status: 'draft',
    stops: [],
    updatedAt: new Date().toISOString(),
    approvedAt: null,
  }
}

function sanitizeQuestion(raw: unknown): ReadingCheckQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Partial<ReadingCheckQuestion>
  const id = String(q.id ?? '').trim() || newId('q')
  const kind: ReadingCheckQuestionKind = q.kind === 'mcq' ? 'mcq' : 'true_false'
  const prompt = typeof q.prompt === 'string' ? q.prompt : ''
  const evidence = resolveReadingCheckEvidence(q.evidenceSnippet, q.evidenceHighlight)

  if (kind === 'mcq') {
    const choicesRaw = Array.isArray(q.choices) ? q.choices : []
    const choices = choicesRaw
      .map((c) => (typeof c === 'string' ? c : ''))
      .slice(0, 4)
    while (choices.length < 2) choices.push('')
    let correctIndex =
      typeof q.correctIndex === 'number' && Number.isFinite(q.correctIndex)
        ? Math.floor(q.correctIndex)
        : 0
    if (correctIndex < 0 || correctIndex >= choices.length) correctIndex = 0
    return {
      id,
      kind: 'mcq',
      prompt,
      choices,
      correctIndex,
      correctTrue: null,
      evidenceSnippet: evidence.evidenceSnippet,
      evidenceHighlight: evidence.evidenceHighlight,
    }
  }

  return {
    id,
    kind: 'true_false',
    prompt,
    choices: [],
    correctIndex: null,
    correctTrue: typeof q.correctTrue === 'boolean' ? q.correctTrue : true,
    evidenceSnippet: evidence.evidenceSnippet,
    evidenceHighlight: evidence.evidenceHighlight,
  }
}

function sanitizeStop(raw: unknown): ReadingCheckStop | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<ReadingCheckStop>
  const id = String(s.id ?? '').trim() || newId('stop')
  const label = typeof s.label === 'string' ? s.label : ''
  const displayPage =
    typeof s.displayPage === 'number' && Number.isFinite(s.displayPage) && s.displayPage >= 1
      ? Math.floor(s.displayPage)
      : null
  const midPageNote =
    typeof s.midPageNote === 'string' && s.midPageNote.trim() ? s.midPageNote.trim() : null
  const hotspot = sanitizeHotspot(s.hotspot)
  const questionsRaw = Array.isArray(s.questions) ? s.questions : []
  const questions = questionsRaw
    .map(sanitizeQuestion)
    .filter((q): q is ReadingCheckQuestion => q != null)
  return { id, label, displayPage, midPageNote, hotspot, questions }
}

function clampUnit(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function sanitizeHotspot(raw: unknown): ReadingCheckHotspotPlacement | null {
  if (!raw || typeof raw !== 'object') return null
  const spot = raw as Partial<ReadingCheckHotspotPlacement>
  if (typeof spot.x !== 'number' || !Number.isFinite(spot.x)) return null
  if (typeof spot.y !== 'number' || !Number.isFinite(spot.y)) return null
  const pdfPage =
    typeof spot.pdfPage === 'number' && Number.isFinite(spot.pdfPage) && spot.pdfPage >= 1
      ? Math.floor(spot.pdfPage)
      : null
  const pageSide: ReadingCheckHotspotPageSide =
    spot.pageSide === 'left' ? 'left' : spot.pageSide === 'right' ? 'right' : 'right'
  return {
    pdfPage,
    pageSide,
    x: clampUnit(spot.x),
    y: clampUnit(spot.y),
  }
}

export function createReadingCheckHotspotPlacement(
  patch?: Partial<ReadingCheckHotspotPlacement> | null,
): ReadingCheckHotspotPlacement {
  const next = sanitizeHotspot({
    pageSide: 'right',
    pdfPage: null,
    x: 0.5,
    y: 0.45,
    ...patch,
  })
  if (next) return next
  return { pdfPage: null, pageSide: 'right', x: 0.5, y: 0.45 }
}

export function stopHasReadingCheckHotspot(stop: ReadingCheckStop | null | undefined): boolean {
  return !!stop?.hotspot
}

/** Bottom-center default used when Generate places a pin without a teacher click. */
export const DEFAULT_READING_CHECK_HOTSPOT_X = 0.5
export const DEFAULT_READING_CHECK_HOTSPOT_Y = 0.9

export function isDefaultReadingCheckHotspotCoords(
  hotspot: ReadingCheckHotspotPlacement | null | undefined,
): boolean {
  if (!hotspot) return false
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02
  return near(hotspot.x, DEFAULT_READING_CHECK_HOTSPOT_X) && near(hotspot.y, DEFAULT_READING_CHECK_HOTSPOT_Y)
}

export function readingCheckStopLinkLabel(stop: ReadingCheckStop, index: number): string {
  const label = stop.label.trim()
  if (label) return label
  return `Check ${index + 1}`
}

export type ReadingCheckSpreadPages = {
  leftPdfPage: number | null
  rightPdfPage: number | null
  leftDisplayPage: number | null
  rightDisplayPage: number | null
}

/**
 * Prefer the printed page for Generate’s default bottom pins (those pdf pages
 * can be one off). Teacher-placed pins still follow stored pdfPage.
 */
export function readingCheckHotspotOnSpread(
  stop: ReadingCheckStop,
  args: ReadingCheckSpreadPages,
): ReadingCheckHotspotPageSide | null {
  const hotspot = stop.hotspot
  if (!hotspot) return null
  const hasDisplaySpread = args.leftDisplayPage != null || args.rightDisplayPage != null
  if (isDefaultReadingCheckHotspotCoords(hotspot) && stop.displayPage != null && hasDisplaySpread) {
    if (args.leftDisplayPage === stop.displayPage) return 'left'
    if (args.rightDisplayPage === stop.displayPage) return 'right'
    return null
  }
  if (hotspot.pdfPage != null) {
    if (args.leftPdfPage != null && hotspot.pdfPage === args.leftPdfPage) return 'left'
    if (args.rightPdfPage != null && hotspot.pdfPage === args.rightPdfPage) return 'right'
    return null
  }
  if (stop.displayPage == null) return null
  if (hotspot.pageSide === 'left') {
    return args.leftDisplayPage === stop.displayPage ? 'left' : null
  }
  return args.rightDisplayPage === stop.displayPage ? 'right' : null
}

export type ReadingCheckLivePinOnSpread = {
  stop: ReadingCheckStop
  index: number
  side: ReadingCheckHotspotPageSide
  pdfPage: number
  x: number
  y: number
}

const LIVE_PIN_STAGGER_Y = 0.08

function staggerOverlappingLivePins(
  pins: ReadingCheckLivePinOnSpread[],
): ReadingCheckLivePinOnSpread[] {
  const byPage = new Map<number, ReadingCheckLivePinOnSpread[]>()
  for (const pin of pins) {
    const list = byPage.get(pin.pdfPage) ?? []
    list.push(pin)
    byPage.set(pin.pdfPage, list)
  }
  const moved = new Map<string, ReadingCheckLivePinOnSpread>()
  for (const group of byPage.values()) {
    if (group.length < 2) continue
    const clusters: ReadingCheckLivePinOnSpread[][] = []
    for (const pin of group) {
      const cluster = clusters.find(
        (c) => Math.abs(c[0]!.x - pin.x) < 0.03 && Math.abs(c[0]!.y - pin.y) < 0.03,
      )
      if (cluster) cluster.push(pin)
      else clusters.push([pin])
    }
    for (const cluster of clusters) {
      if (cluster.length < 2) continue
      cluster.sort((a, b) => a.index - b.index)
      const startY = Math.max(0.12, cluster[0]!.y - LIVE_PIN_STAGGER_Y * (cluster.length - 1))
      cluster.forEach((pin, i) => {
        moved.set(pin.stop.id, { ...pin, y: Math.min(0.92, startY + i * LIVE_PIN_STAGGER_Y) })
      })
    }
  }
  if (moved.size === 0) return pins
  return pins.map((pin) => moved.get(pin.stop.id) ?? pin)
}

/** Live ? pins for the visible spread, using stored page-normalized hotspot coords. */
export function listReadingCheckLivePinsOnSpread(
  stops: readonly ReadingCheckStop[],
  spread: ReadingCheckSpreadPages,
): ReadingCheckLivePinOnSpread[] {
  const pins: ReadingCheckLivePinOnSpread[] = []
  stops.forEach((stop, index) => {
    if (!stopHasReadingCheckHotspot(stop) || !stop.hotspot) return
    const question = primaryQuestionOfStop(stop)
    if (!question?.prompt.trim()) return
    const side = readingCheckHotspotOnSpread(stop, spread)
    if (side !== 'left' && side !== 'right') return
    const pdfPage = side === 'left' ? spread.leftPdfPage : spread.rightPdfPage
    if (pdfPage == null) return
    pins.push({
      stop,
      index,
      side,
      pdfPage,
      x: stop.hotspot.x,
      y: stop.hotspot.y,
    })
  })
  return staggerOverlappingLivePins(pins)
}

export function getReadingCheckCorrectAnswerLabel(
  question: ReadingCheckQuestion | null | undefined,
): string | null {
  if (!question) return null
  if (question.kind === 'true_false') {
    return typeof question.correctTrue === 'boolean' ? (question.correctTrue ? 'True' : 'False') : null
  }
  if (question.correctIndex == null || question.correctIndex < 0 || question.correctIndex >= question.choices.length) {
    return null
  }
  const choice = question.choices[question.correctIndex]?.trim()
  if (!choice) return null
  return `${String.fromCharCode(65 + question.correctIndex)}. ${choice}`
}

export function sanitizeReadingCheckPack(
  input: Partial<ReadingCheckPack> & { storyId: string; bookId: string; unitId: string },
): ReadingCheckPack | null {
  const storyId = String(input.storyId ?? '').trim()
  const bookId = String(input.bookId ?? '').trim()
  const unitId = String(input.unitId ?? '').trim()
  if (!storyId || !bookId || !unitId) return null

  const status: ReadingCheckPackStatus = input.status === 'approved' ? 'approved' : 'draft'
  const stopsRaw = Array.isArray(input.stops) ? input.stops : []
  const stops = stopsRaw.map(sanitizeStop).filter((s): s is ReadingCheckStop => s != null)

  const updatedAt =
    typeof input.updatedAt === 'string' && input.updatedAt.trim()
      ? input.updatedAt.trim()
      : new Date().toISOString()
  const approvedAt =
    status === 'approved' && typeof input.approvedAt === 'string' && input.approvedAt.trim()
      ? input.approvedAt.trim()
      : status === 'approved'
        ? updatedAt
        : null

  return {
    storyId,
    bookId,
    unitId,
    status,
    stops,
    updatedAt,
    approvedAt,
  }
}

/** Count stops that have at least one non-empty question prompt. */
export function countUsableReadingCheckStops(pack: ReadingCheckPack | null | undefined): number {
  if (!pack) return 0
  return pack.stops.filter((s) =>
    s.questions.some((q) => q.prompt.trim().length > 0),
  ).length
}

export function readingCheckPackCanApprove(pack: ReadingCheckPack | null | undefined): boolean {
  return countUsableReadingCheckStops(pack) >= 1
}

/**
 * Packs eligible for the live reader (Phase 7). Draft or empty → null.
 * Callers must use this (or equivalent) before showing check links.
 */
export function getLiveEligibleReadingCheckPack(
  pack: ReadingCheckPack | null | undefined,
): ReadingCheckPack | null {
  if (!pack || pack.status !== 'approved') return null
  if (!readingCheckPackCanApprove(pack)) return null
  return pack
}

/** Force draft when content changes after approve (re-edit path). */
export function demoteReadingCheckPackToDraft(pack: ReadingCheckPack): ReadingCheckPack {
  if (pack.status === 'draft') return pack
  return {
    ...pack,
    status: 'draft',
    approvedAt: null,
    updatedAt: new Date().toISOString(),
  }
}

export function approveReadingCheckPack(pack: ReadingCheckPack): ReadingCheckPack | null {
  if (!readingCheckPackCanApprove(pack)) return null
  const now = new Date().toISOString()
  return {
    ...pack,
    status: 'approved',
    approvedAt: now,
    updatedAt: now,
  }
}
