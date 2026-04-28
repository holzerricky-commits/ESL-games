import type { BookLessonPartRecord, BookLessonRecord, BookUnitRecord } from '@/lib/books/types'

/** Minimal pdf.js text item shape from getTextContent().items */
export interface PdfTextItem {
  str: string
  transform: number[]
  width?: number
  height?: number
}

export interface ParsedTocRow {
  title: string
  /** Arabic printed page from TOC line, if detected */
  printedPage: number | null
  needsReview: boolean
  rawLine: string
}

export interface TocUnitDraft {
  id: string
  title: string
  needsReview: boolean
  startPageHint?: number
  endPageHint?: number
  anchorConfidence?: 'high' | 'medium' | 'low'
  anchorSource?: 'toc' | 'heading' | 'fallback'
}

const LINE_Y_TOLERANCE = 4

function itemY(item: PdfTextItem): number {
  const t = item.transform
  return t.length >= 6 ? -t[5] : 0
}

function itemX(item: PdfTextItem): number {
  const t = item.transform
  return t.length >= 6 ? t[4] : 0
}

/**
 * Merge pdf.js text items into reading-order lines (top-to-bottom, left-to-right).
 */
export interface StructuredTextLine {
  text: string
  /** 1 ≈ top of page, 0 ≈ bottom — for header-band heuristics. */
  yNormTop: number
}

function mergeItemsToLineRows(items: PdfTextItem[]): { y: number; parts: { x: number; str: string }[] }[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => {
    const dy = itemY(a) - itemY(b)
    if (Math.abs(dy) > LINE_Y_TOLERANCE) return dy
    return itemX(a) - itemX(b)
  })
  const lines: { y: number; parts: { x: number; str: string }[] }[] = []
  for (const item of sorted) {
    const s = item.str?.trim() ?? ''
    if (!s) continue
    const y = itemY(item)
    const x = itemX(item)
    let row = lines.find((l) => Math.abs(l.y - y) <= LINE_Y_TOLERANCE)
    if (!row) {
      row = { y, parts: [] }
      lines.push(row)
    }
    row.parts.push({ x, str: item.str })
  }
  lines.sort((a, b) => b.y - a.y)
  return lines
}

export function mergePdfTextItemsToLines(items: PdfTextItem[]): string[] {
  return mergeItemsToLineRows(items).map((row) =>
    [...row.parts]
      .sort((a, b) => a.x - b.x)
      .map((p) => p.str)
      .join('')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

/**
 * Same reading order as {@link mergePdfTextItemsToLines}, plus a normalized vertical
 * position so callers can treat the top band of the page as headers (e.g. "Unit 3").
 */
export function mergePdfTextItemsToStructuredLines(items: PdfTextItem[]): StructuredTextLine[] {
  const rows = mergeItemsToLineRows(items)
  if (rows.length === 0) return []
  const ys = rows.map((r) => r.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const span = Math.max(maxY - minY, 1e-6)
  return rows.map((row) => {
    const text = [...row.parts]
      .sort((a, b) => a.x - b.x)
      .map((p) => p.str)
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    const yNormTop = (maxY - row.y) / span
    return { text, yNormTop }
  })
}

/** Strip common TOC dot leaders between title and page number. */
export function stripLeaderDots(s: string): string {
  return s.replace(/\.{2,}\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

/**
 * Parse merged lines: trailing Arabic page number; title is the rest.
 */
export function parseTocLines(lines: string[]): ParsedTocRow[] {
  const rows: ParsedTocRow[] = []
  for (const raw of lines) {
    const line = stripLeaderDots(raw)
    if (!line) continue
    const m = /^(.+?)\s+(\d{1,4})\s*$/.exec(line)
    if (!m) {
      rows.push({
        title: line,
        printedPage: null,
        needsReview: true,
        rawLine: raw,
      })
      continue
    }
    const title = m[1].replace(/\s+$/g, '').trim()
    const num = Number.parseInt(m[2], 10)
    if (!title || !Number.isFinite(num) || num < 1) {
      rows.push({
        title: line,
        printedPage: null,
        needsReview: true,
        rawLine: raw,
      })
      continue
    }
    rows.push({
      title,
      printedPage: num,
      needsReview: false,
      rawLine: raw,
    })
  }
  return rows
}

function slugBase(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || `unit-${index + 1}`
}

export function buildUnitRangesFromToc(parsed: ParsedTocRow[]): TocUnitDraft[] {
  const usable = parsed.filter((r) => r.title.trim().length > 0)
  return usable.map((row, i) => ({
    id: `${slugBase(row.title, i)}-${i + 1}`,
    title: row.title,
    needsReview: row.needsReview || row.printedPage == null,
  }))
}

function trimLesson(l: BookLessonRecord): BookLessonRecord | null {
  const title = l.title.trim()
  if (!title) return null

  const parts =
    l.parts
      ?.map((p) => {
        const pt = p.title.trim()
        if (!pt) return null
        const rec: BookLessonPartRecord = {
          id: p.id,
          title: pt,
          ...(typeof p.startPageHint === 'number' ? { startPageHint: p.startPageHint } : {}),
          ...(typeof p.endPageHint === 'number' ? { endPageHint: p.endPageHint } : {}),
          ...(p.anchorConfidence ? { anchorConfidence: p.anchorConfidence } : {}),
          ...(p.anchorSource ? { anchorSource: p.anchorSource } : {}),
        }
        return rec
      })
      .filter((x): x is BookLessonPartRecord => x != null) ?? []

  return {
    id: l.id,
    title,
    ...(typeof l.startPageHint === 'number' ? { startPageHint: l.startPageHint } : {}),
    ...(typeof l.endPageHint === 'number' ? { endPageHint: l.endPageHint } : {}),
    ...(l.anchorConfidence ? { anchorConfidence: l.anchorConfidence } : {}),
    ...(l.anchorSource ? { anchorSource: l.anchorSource } : {}),
    ...(parts.length ? { parts } : {}),
  }
}

export function draftsToUnits(
  filePath: string,
  drafts: TocUnitDraft[],
  lessonsPerUnit?: BookLessonRecord[][] | null,
): BookUnitRecord[] {
  return drafts.map((d, i) => {
    const rawLessons = lessonsPerUnit?.[i]
    const lessons = rawLessons
      ?.map((lesson) => trimLesson(lesson))
      .filter((x): x is BookLessonRecord => x != null)
    return {
      id: d.id,
      title: d.title,
      filePath,
      ...(typeof d.startPageHint === 'number' ? { startPageHint: d.startPageHint } : {}),
      ...(typeof d.endPageHint === 'number' ? { endPageHint: d.endPageHint } : {}),
      ...(d.anchorConfidence ? { anchorConfidence: d.anchorConfidence } : {}),
      ...(d.anchorSource ? { anchorSource: d.anchorSource } : {}),
      ...(lessons?.length ? { lessons } : {}),
    }
  })
}
