/**
 * Phase 2a/2b — infer PDF “not counted” pages from printed folio samples,
 * and build checkpoint jumps for teacher confirm.
 *
 * Uses the same cover model as `page-alignment.ts`: PDF page 1 is never a
 * printed Arabic page; counted pages start at PDF page 2.
 *
 * Prefer later body folios + consecutive consistency over early blank front matter.
 */

import {
  normalizeNotCountedPdfPages,
  pdfPageToPrintedPage,
  printedPageToPdfPage,
} from '@/lib/books/page-alignment'

/** Dense early band (books that number from the start). */
export const ALIGN_DETECT_EARLY_BAND_END = 24
/** Stride through later pages where folios usually appear. */
export const ALIGN_DETECT_LATER_STRIDE = 2
/** Cap later scan so detect stays responsive. */
export const ALIGN_DETECT_LATER_MAX = 120
/** @deprecated Prefer EARLY_BAND + LATER_MAX; kept as alias for callers. */
export const ALIGN_DETECT_DEFAULT_MAX_SCAN = ALIGN_DETECT_LATER_MAX
/** Skip pages that look like TOC grids (many lone numbers). */
export const ALIGN_DETECT_TOC_LIKE_STANDALONE_NUMBERS = 5
/**
 * Hard cap for one-tap sync: never auto-build a not-counted list longer than this.
 * Stops “PDF 109 = printed 1 → ghost 2–108” disasters.
 */
export const ALIGN_SYNC_MAX_NOT_COUNTED = 20

export type FolioSample = {
  pdfPage: number
  printedPage: number
}

export type AlignDetectProposal = {
  notCountedPdfPages: number[]
  confidence: 'high' | 'medium' | 'low'
  firstArabicPdfPage: number | null
  matchingSamples: number
  sampleCount: number
  /** True when suggestion is empty — PDF page 2 already reads as printed 1. */
  pagesAlreadyMatch: boolean
  /** Lowest printed folio among samples that matched the winner (for checkpoints). */
  firstObservedPrintedPage: number | null
  consecutivePairs: number
}

export type AlignmentCheckpoint = {
  id: string
  label: string
  printedPage: number
  pdfPage: number
}

/**
 * PDF pages to probe: dense early band, then stride through later body pages.
 */
export function listAlignDetectScanPages(numPages: number): number[] {
  const total = Math.max(0, Math.floor(numPages))
  if (total < 2) return []
  const pages = new Set<number>()
  const earlyEnd = Math.min(ALIGN_DETECT_EARLY_BAND_END, total)
  for (let p = 2; p <= earlyEnd; p++) pages.add(p)
  const laterEnd = Math.min(ALIGN_DETECT_LATER_MAX, total)
  const strideStart = Math.max(earlyEnd + 1, 2)
  for (let p = strideStart; p <= laterEnd; p += ALIGN_DETECT_LATER_STRIDE) {
    pages.add(p)
  }
  // Always include the last page of the later band when stride would skip it.
  if (laterEnd >= 2) pages.add(laterEnd)
  return [...pages].sort((a, b) => a - b)
}

function standaloneNumberLines(rawText: string): number[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const out: number[] = []
  for (const line of lines) {
    if (!/^\d{1,3}$/.test(line)) continue
    const n = Number(line)
    if (!Number.isFinite(n) || n < 1 || n > 999) continue
    // Years / ISBN-ish noise
    if (n >= 1900) continue
    out.push(n)
  }
  return out
}

/**
 * Pick a likely footer/header folio from selectable page text.
 * Returns null on TOC-like pages or when no clean candidate exists.
 */
export function pickPrintedFolioFromPageText(rawText: string): number | null {
  const text = rawText.replace(/\s+/g, ' ').trim()
  if (text.length < 1) return null

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  const allStandalone = standaloneNumberLines(rawText)
  if (allStandalone.length >= ALIGN_DETECT_TOC_LIKE_STANDALONE_NUMBERS) {
    return null
  }

  const edgeLines = [...lines.slice(0, 2), ...lines.slice(-4)]
  const edgeCandidates: number[] = []
  for (const line of edgeLines) {
    if (!/^\d{1,3}$/.test(line)) continue
    const n = Number(line)
    if (!Number.isFinite(n) || n < 1 || n > 400) continue
    edgeCandidates.push(n)
  }

  if (edgeCandidates.length === 0) return null

  const unique = [...new Set(edgeCandidates)]
  if (unique.length === 1) return unique[0]!

  // Prefer a number that appears in the last lines (footer folio).
  const footerLines = lines.slice(-3)
  for (let i = footerLines.length - 1; i >= 0; i--) {
    const line = footerLines[i]!
    if (/^\d{1,3}$/.test(line)) {
      const n = Number(line)
      if (n >= 1 && n <= 400) return n
    }
  }

  return unique.sort((a, b) => a - b)[0] ?? null
}

/**
 * Contiguous early ghost list so PDF `firstArabicPdfPage` maps to printed 1.
 * PDF page 1 (cover) is never listed — `printedPageToPdfPage` already skips it.
 */
export function notCountedForFirstArabicPdfPage(firstArabicPdfPage: number): number[] {
  const first = Math.floor(firstArabicPdfPage)
  if (!Number.isFinite(first) || first <= 2) return []
  const out: number[] = []
  for (let p = 2; p < first; p++) out.push(p)
  return out
}

export type SyncPointResult =
  | {
      ok: true
      notCountedPdfPages: number[]
      firstArabicPdfPage: number
      pagesAlreadyMatch: boolean
    }
  | { ok: false; reason: 'invalid' | 'too_large' }

/**
 * One teacher sync point: “this PDF page shows printed page N.”
 * Builds contiguous early not-counted pages, or rejects unsafe sizes.
 */
export function notCountedFromSyncPoint(
  pdfPage: number,
  printedPage: number,
  options?: { maxNotCounted?: number; totalPdfPages?: number },
): SyncPointResult {
  const pdf = Math.floor(pdfPage)
  const printed = Math.floor(printedPage)
  const maxNotCounted = options?.maxNotCounted ?? ALIGN_SYNC_MAX_NOT_COUNTED
  const total = options?.totalPdfPages

  if (!Number.isFinite(pdf) || !Number.isFinite(printed)) return { ok: false, reason: 'invalid' }
  if (pdf < 2 || printed < 1) return { ok: false, reason: 'invalid' }
  if (total != null && pdf > total) return { ok: false, reason: 'invalid' }

  const firstArabic = impliedFirstArabicPdfPage({ pdfPage: pdf, printedPage: printed })
  if (firstArabic == null) return { ok: false, reason: 'invalid' }

  const notCountedPdfPages = notCountedForFirstArabicPdfPage(firstArabic)
  if (notCountedPdfPages.length > maxNotCounted) {
    return { ok: false, reason: 'too_large' }
  }

  return {
    ok: true,
    notCountedPdfPages,
    firstArabicPdfPage: firstArabic,
    pagesAlreadyMatch: notCountedPdfPages.length === 0,
  }
}

/**
 * Each sample implies where printed page 1 should sit:
 * firstArabic = pdfPage - printedPage + 1
 */
export function impliedFirstArabicPdfPage(sample: FolioSample): number | null {
  const pdf = Math.floor(sample.pdfPage)
  const printed = Math.floor(sample.printedPage)
  if (!Number.isFinite(pdf) || !Number.isFinite(printed)) return null
  if (pdf < 2 || printed < 1) return null
  const first = pdf - printed + 1
  if (first < 2) return null
  return first
}

function matchingSamplesForCandidate(
  samples: FolioSample[],
  notCounted: number[],
  totalPdfPages?: number,
): FolioSample[] {
  const ignored = normalizeNotCountedPdfPages(notCounted, totalPdfPages)
  return samples.filter((sample) => pdfPageToPrintedPage(sample.pdfPage, ignored) === sample.printedPage)
}

/** Count pairs that keep the same Δpdf === Δprinted under this candidate. */
export function countConsecutiveMatchingPairs(matching: FolioSample[]): number {
  const sorted = [...matching].sort((a, b) => a.pdfPage - b.pdfPage)
  let pairs = 0
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!
      const b = sorted[j]!
      const dPdf = b.pdfPage - a.pdfPage
      const dPrinted = b.printedPage - a.printedPage
      if (dPdf > 0 && dPdf === dPrinted) pairs += 1
    }
  }
  return pairs
}

function emptyProposal(sampleCount: number): AlignDetectProposal {
  return {
    notCountedPdfPages: [],
    confidence: 'low',
    firstArabicPdfPage: null,
    matchingSamples: 0,
    sampleCount,
    pagesAlreadyMatch: false,
    firstObservedPrintedPage: null,
    consecutivePairs: 0,
  }
}

/**
 * Pick firstArabic by multi-sample + consecutive consistency (not earliest PDF page).
 */
export function inferNotCountedFromFolioSamples(
  samples: FolioSample[],
  totalPdfPages?: number,
): AlignDetectProposal {
  const clean = samples.filter((s) => {
    const pdf = Math.floor(s.pdfPage)
    const printed = Math.floor(s.printedPage)
    return Number.isFinite(pdf) && Number.isFinite(printed) && pdf >= 2 && printed >= 1 && printed <= 999
  })

  if (clean.length === 0) return emptyProposal(0)

  const candidateSet = new Set<number>()
  for (const sample of clean) {
    const first = impliedFirstArabicPdfPage(sample)
    if (first == null) continue
    if (totalPdfPages != null && first > totalPdfPages) continue
    candidateSet.add(first)
  }

  if (candidateSet.size === 0) return emptyProposal(clean.length)

  type Scored = {
    firstArabic: number
    matching: FolioSample[]
    consecutivePairs: number
    maxPrinted: number
    score: number
  }

  let best: Scored | null = null
  for (const firstArabic of candidateSet) {
    const notCounted = notCountedForFirstArabicPdfPage(firstArabic)
    const matching = matchingSamplesForCandidate(clean, notCounted, totalPdfPages)
    const consecutivePairs = countConsecutiveMatchingPairs(matching)
    const maxPrinted = matching.reduce((m, s) => Math.max(m, s.printedPage), 0)
    // Prefer consistent later body evidence over a lonely early vote.
    const score = matching.length * 10 + consecutivePairs * 25 + Math.min(maxPrinted, 80)
    const next: Scored = { firstArabic, matching, consecutivePairs, maxPrinted, score }
    if (
      !best ||
      next.score > best.score ||
      (next.score === best.score && next.matching.length > best.matching.length) ||
      (next.score === best.score &&
        next.matching.length === best.matching.length &&
        next.maxPrinted > best.maxPrinted)
    ) {
      best = next
    }
  }

  if (!best || best.matching.length === 0) return emptyProposal(clean.length)

  const notCountedPdfPages = notCountedForFirstArabicPdfPage(best.firstArabic)
  const matchingSamples = best.matching.length
  const pagesAlreadyMatch = notCountedPdfPages.length === 0
  const firstObservedPrintedPage = best.matching.reduce(
    (min, s) => Math.min(min, s.printedPage),
    Number.POSITIVE_INFINITY,
  )
  const observed =
    Number.isFinite(firstObservedPrintedPage) && firstObservedPrintedPage !== Number.POSITIVE_INFINITY
      ? firstObservedPrintedPage
      : null

  const laterOnlyEvidence = observed != null && observed >= 4
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (matchingSamples >= 3 && best.consecutivePairs >= 1 && matchingSamples / clean.length >= 0.5) {
    confidence = 'high'
  } else if (matchingSamples >= 2) {
    confidence = 'medium'
  } else if (matchingSamples === 1 && !laterOnlyEvidence) {
    confidence = 'medium'
  } else if (matchingSamples >= 1) {
    confidence = 'low'
  }

  return {
    notCountedPdfPages,
    confidence,
    firstArabicPdfPage: best.firstArabic,
    matchingSamples,
    sampleCount: clean.length,
    pagesAlreadyMatch,
    firstObservedPrintedPage: observed,
    consecutivePairs: best.consecutivePairs,
  }
}

/**
 * Build 2–4 jump targets so the teacher can confirm printed ↔ PDF sync.
 * Prefer visible folios (4, 10, observed) over unnumbered printed page 1.
 */
export function buildAlignmentCheckpoints(options: {
  notCountedPdfPages: number[]
  totalPdfPages: number | null
  /** Printed page hints from TOC drafts (unit/lesson starts). */
  printedPageHints?: number[]
  /** Printed folios actually seen during detect (or first observed). */
  observedPrintedPages?: number[]
}): AlignmentCheckpoint[] {
  const total = options.totalPdfPages
  if (total == null || total < 2) return []

  const notCounted = normalizeNotCountedPdfPages(options.notCountedPdfPages, total)
  const checkpoints: AlignmentCheckpoint[] = []
  const usedPdf = new Set<number>()
  const usedPrinted = new Set<number>()

  const push = (id: string, label: string, printedPage: number) => {
    if (usedPrinted.has(printedPage)) return
    const pdfPage = printedPageToPdfPage(printedPage, notCounted, total)
    if (pdfPage == null || usedPdf.has(pdfPage)) return
    usedPdf.add(pdfPage)
    usedPrinted.add(printedPage)
    checkpoints.push({ id, label, printedPage, pdfPage })
  }

  const observed = (options.observedPrintedPages ?? [])
    .map((n) => Math.floor(n))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b)

  const firstObserved = observed[0] ?? null
  if (firstObserved != null && firstObserved > 1) {
    push(`observed-${firstObserved}`, `Printed page ${firstObserved}`, firstObserved)
  } else {
    push('printed-1', 'Printed page 1', 1)
  }

  push('printed-4', 'Printed page 4', 4)
  push('printed-10', 'Printed page 10', 10)

  for (const folio of observed) {
    if (checkpoints.length >= 4) break
    push(`observed-${folio}`, `Printed page ${folio}`, folio)
  }

  const hints = (options.printedPageHints ?? [])
    .map((n) => Math.floor(n))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b)

  for (const hint of hints) {
    if (checkpoints.length >= 4) break
    push(`hint-${hint}`, `Printed page ${hint}`, hint)
  }

  if (checkpoints.length < 3) {
    const midPrinted = Math.max(2, Math.floor((total - 1) / 2))
    push('mid', `Printed page ${midPrinted}`, midPrinted)
  }

  // If we never showed printed 1 and have room, add it last for teachers who want it.
  if (checkpoints.length < 4 && firstObserved != null && firstObserved > 1) {
    push('printed-1', 'Printed page 1', 1)
  }

  return checkpoints.slice(0, 4)
}
