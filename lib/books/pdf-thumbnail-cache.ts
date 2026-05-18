import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'

/** Compact sidebar preview width */
export const PDF_THUMB_WIDTH = 76
/** Larger in-class preview width for the Next Class spread */
export const PDF_HERO_THUMB_WIDTH = 240

const dataUrlCache = new Map<string, string>()
const pdfLoadCache = new Map<string, Promise<PDFDocumentProxy>>()
const PDFJS_WASM_URL = '/wasm/'

let queueRunning = 0
const MAX_CONCURRENT = 2
const pendingRuns: Array<() => void> = []

function pumpQueue() {
  while (queueRunning < MAX_CONCURRENT && pendingRuns.length > 0) {
    const run = pendingRuns.shift()!
    run()
  }
}

function enqueuePdfWork<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pendingRuns.push(() => {
      queueRunning++
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          queueRunning--
          pumpQueue()
        })
    })
    pumpQueue()
  })
}

function cacheKey(unitId: string, pageNumber: number, width: number): string {
  return `${unitId}|${pageNumber}|${width}`
}

export function peekCachedThumbnailDataUrl(
  unitId: string,
  pageNumber: number,
  width: number = PDF_THUMB_WIDTH,
): string | undefined {
  return dataUrlCache.get(cacheKey(unitId, pageNumber, width))
}

export function clearThumbnailCacheForUnit(unitId: string): void {
  const prefix = `${unitId}|`
  for (const key of dataUrlCache.keys()) {
    if (key.startsWith(prefix)) {
      dataUrlCache.delete(key)
    }
  }
}

export function clearPdfLoadCacheForFileUrl(fileUrl: string): void {
  pdfLoadCache.delete(fileUrl)
}

/**
 * Single `pdfjs.getDocument` promise per `fileUrl` for the session (thumbnails + fullscreen reader).
 * `react-pdf` `<Document file={url}>` would call `getDocument` again — use `PdfPage pdf={await loadCachedPdfDocument(url)}` instead.
 */
export async function loadCachedPdfDocument(fileUrl: string): Promise<PDFDocumentProxy> {
  let p = pdfLoadCache.get(fileUrl)
  if (!p) {
    await ensureReactPdfWorker()
    const { pdfjs } = await import('react-pdf')
    p = pdfjs.getDocument({ url: fileUrl, wasmUrl: PDFJS_WASM_URL }).promise as Promise<PDFDocumentProxy>
    pdfLoadCache.set(fileUrl, p)
  }
  return await p
}

async function loadPdf(fileUrl: string): Promise<PDFDocumentProxy> {
  return loadCachedPdfDocument(fileUrl)
}

export async function getPdfTotalPages(fileUrl: string): Promise<number> {
  const pdf = await loadPdf(fileUrl)
  return Number.isFinite(pdf.numPages) && pdf.numPages > 0 ? Math.floor(pdf.numPages) : 1
}

async function renderPageToDataUrlInner(
  fileUrl: string,
  pageNumber: number,
  width: number,
): Promise<string> {
  const pdf = await loadPdf(fileUrl)
  const page = await pdf.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = width / baseViewport.width
  // Render slightly above target width to keep upscaled previews crisp.
  const renderDensity = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const finalScale = scale * renderDensity
  const viewport = page.getViewport({ scale: finalScale })
  const canvas = document.createElement('canvas')
  const w = Math.floor(viewport.width)
  const h = Math.floor(viewport.height)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')
  const renderTask = page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  })
  await renderTask.promise
  return canvas.toDataURL('image/jpeg', 0.9)
}

export async function getThumbnailDataUrl(
  fileUrl: string,
  unitId: string,
  pageNumber: number,
  width: number = PDF_THUMB_WIDTH,
): Promise<string> {
  const key = cacheKey(unitId, pageNumber, width)
  const hit = dataUrlCache.get(key)
  if (hit) return hit
  const dataUrl = await enqueuePdfWork(() => renderPageToDataUrlInner(fileUrl, pageNumber, width))
  dataUrlCache.set(key, dataUrl)
  return dataUrl
}
