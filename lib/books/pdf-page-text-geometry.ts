import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PdfTextItem } from '@/lib/books/toc-import'

/** One selectable text run in page-normalized coordinates (0–1, top-left origin). */
export type PdfPageTextRun = {
  index: number
  text: string
  x: number
  y: number
  w: number
  h: number
}

export type PdfPageTextRuns = {
  pageNumber: number
  pageWidth: number
  pageHeight: number
  runs: PdfPageTextRun[]
}

export type NormRect = {
  x: number
  y: number
  w: number
  h: number
}

function itemPdfX(item: PdfTextItem): number {
  return item.transform.length >= 6 ? item.transform[4] : 0
}

/** Prefer vertical scale (t[3]) so horizontal stretch does not inflate hit height. */
function itemFontSize(item: PdfTextItem): number {
  const t = item.transform
  if (t.length < 6) return 12
  const sy = Math.abs(t[3]!)
  if (sy > 0.01) return sy
  return Math.abs(t[0]!) || 12
}

function itemPdfYTop(item: PdfTextItem, pageHeight: number): number {
  const t = item.transform
  if (t.length < 6) return 0
  const fontSize = itemFontSize(item)
  return pageHeight - t[5]! - fontSize
}

function itemPdfWidth(item: PdfTextItem): number {
  if (typeof item.width === 'number' && item.width > 0) return item.width
  const t = item.transform
  const sx = Math.abs(t[0]!) || itemFontSize(item)
  return sx * (item.str?.length ?? 1) * 0.5
}

function itemPdfHeight(item: PdfTextItem): number {
  if (typeof item.height === 'number' && item.height > 0) return item.height
  return itemFontSize(item)
}

function sortItemsReadingOrder(items: readonly PdfTextItem[], pageHeight: number): PdfTextItem[] {
  return [...items].sort((a, b) => {
    const dy = itemPdfYTop(a, pageHeight) - itemPdfYTop(b, pageHeight)
    if (Math.abs(dy) > 4) return dy
    return itemPdfX(a) - itemPdfX(b)
  })
}

/** Map pdf.js text items to normalized runs for overlay hit-testing. */
export function pdfTextItemsToRuns(
  items: readonly PdfTextItem[],
  pageWidth: number,
  pageHeight: number,
): PdfPageTextRun[] {
  if (!(pageWidth > 0) || !(pageHeight > 0)) return []
  const runs: PdfPageTextRun[] = []
  let index = 0
  for (const item of sortItemsReadingOrder(items, pageHeight)) {
    const text = item.str ?? ''
    if (!text.trim()) continue
    const xPx = itemPdfX(item)
    const yPx = itemPdfYTop(item, pageHeight)
    const wPx = itemPdfWidth(item)
    const hPx = itemPdfHeight(item)
    const pad = hPx * 0.08
    runs.push({
      index,
      text,
      x: Math.max(0, (xPx - pad) / pageWidth),
      y: Math.max(0, (yPx - pad) / pageHeight),
      w: Math.min(1, (wPx + pad * 2) / pageWidth),
      h: Math.min(1, (hPx + pad * 2) / pageHeight),
    })
    index += 1
  }
  return runs
}

export async function extractPdfPageTextRuns(
  pdf: PDFDocumentProxy,
  pageNumber: number,
): Promise<PdfPageTextRuns | null> {
  if (pageNumber < 1 || pageNumber > pdf.numPages) return null
  try {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()
    const items: PdfTextItem[] = []
    for (const raw of textContent.items ?? []) {
      if (!raw || typeof raw !== 'object' || !('str' in raw)) continue
      const str = (raw as { str?: string }).str
      if (typeof str !== 'string') continue
      const transform = (raw as { transform?: number[] }).transform
      if (!Array.isArray(transform) || transform.length < 6) continue
      items.push({
        str,
        transform,
        width: (raw as { width?: number }).width,
        height: (raw as { height?: number }).height,
      })
    }
    return {
      pageNumber,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      runs: pdfTextItemsToRuns(items, viewport.width, viewport.height),
    }
  } catch {
    return null
  }
}

export function normPointInRun(run: PdfPageTextRun, nx: number, ny: number): boolean {
  return nx >= run.x && nx <= run.x + run.w && ny >= run.y && ny <= run.y + run.h
}

/** Hit-test a page-normalized point; returns run index or null. */
export function hitTestNormPoint(runs: readonly PdfPageTextRun[], nx: number, ny: number): number | null {
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i]!
    if (normPointInRun(run, nx, ny)) return run.index
  }
  return null
}

export function clampRunIndex(runs: readonly PdfPageTextRun[], index: number): number | null {
  if (runs.length === 0) return null
  const clamped = Math.max(0, Math.min(index, runs.length - 1))
  return runs[clamped]?.index ?? null
}

/** Inclusive selection between two run indices in reading order. */
export function selectRunsBetween(
  runs: readonly PdfPageTextRun[],
  anchorIndex: number,
  focusIndex: number,
): PdfPageTextRun[] {
  if (runs.length === 0) return []
  const anchorPos = runs.findIndex((r) => r.index === anchorIndex)
  const focusPos = runs.findIndex((r) => r.index === focusIndex)
  if (anchorPos < 0 || focusPos < 0) return []
  const start = Math.min(anchorPos, focusPos)
  const end = Math.max(anchorPos, focusPos)
  return runs.slice(start, end + 1)
}

/** Runs whose boxes intersect a page-normalized marquee. */
export function selectRunsInNormRect(
  runs: readonly PdfPageTextRun[],
  rect: NormRect,
): PdfPageTextRun[] {
  const rx2 = rect.x + rect.w
  const ry2 = rect.y + rect.h
  return runs.filter((run) => {
    const runX2 = run.x + run.w
    const runY2 = run.y + run.h
    return run.x < rx2 && runX2 > rect.x && run.y < ry2 && runY2 > rect.y
  })
}

/** Join selected runs into copyable plain text. */
export function runsToPlainText(runs: readonly PdfPageTextRun[]): string {
  let out = ''
  for (const run of runs) {
    const t = run.text
    if (!t) continue
    if (out && !/\s$/.test(out) && !/^\s/.test(t)) {
      out += ' '
    }
    out += t
  }
  return out.replace(/\s+/g, ' ').trim()
}

export function clientPointToNorm(
  clientX: number,
  clientY: number,
  pageRect: DOMRectReadOnly,
): { nx: number; ny: number } | null {
  if (!(pageRect.width > 0) || !(pageRect.height > 0)) return null
  const nx = (clientX - pageRect.left) / pageRect.width
  const ny = (clientY - pageRect.top) / pageRect.height
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null
  return { nx, ny }
}

export function runsToClientRects(
  runs: readonly PdfPageTextRun[],
  pageRect: DOMRectReadOnly,
): { left: number; top: number; width: number; height: number }[] {
  return runs.map((run) => ({
    left: pageRect.left + run.x * pageRect.width,
    top: pageRect.top + run.y * pageRect.height,
    width: run.w * pageRect.width,
    height: run.h * pageRect.height,
  }))
}
