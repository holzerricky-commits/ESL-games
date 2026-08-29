import 'server-only'

import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/** Saved cover width — ~2× launcher mockup for crisp display on retina screens. */
export const BOOK_COVER_JPEG_WIDTH = 480
export const BOOK_COVER_JPEG_QUALITY = 0.9

const PDF_IDLE_MS = 30_000

let pdfWorkerConfigured = false
let napiDomGlobalsReady = false

/** pdf.js draws Path2D; @napi-rs/canvas only accepts its own Path2D class. */
function ensureNapiCanvasDomGlobals(napi: {
  Path2D?: unknown
  DOMMatrix?: unknown
  DOMPoint?: unknown
  DOMRect?: unknown
}) {
  if (napiDomGlobalsReady) return
  const g = globalThis as unknown as Record<string, unknown>
  if (napi.Path2D) g.Path2D = napi.Path2D
  if (napi.DOMMatrix) g.DOMMatrix = napi.DOMMatrix
  if (napi.DOMPoint) g.DOMPoint = napi.DOMPoint
  if (napi.DOMRect) g.DOMRect = napi.DOMRect
  napiDomGlobalsReady = true
}

type CachedPdf = {
  promise: Promise<PDFDocumentProxy>
  refs: number
  idleTimer: ReturnType<typeof setTimeout> | null
}

const pdfDocs = new Map<string, CachedPdf>()

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (!pdfWorkerConfigured) {
    const workerAbsPath = path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'legacy',
      'build',
      'pdf.worker.mjs',
    )
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerAbsPath).toString()
    pdfWorkerConfigured = true
  }
  return pdfjs
}

function schedulePdfIdle(absPdfPath: string) {
  const entry = pdfDocs.get(absPdfPath)
  if (!entry || entry.refs > 0) return
  if (entry.idleTimer) clearTimeout(entry.idleTimer)
  entry.idleTimer = setTimeout(() => {
    const current = pdfDocs.get(absPdfPath)
    if (current !== entry || entry.refs > 0) return
    pdfDocs.delete(absPdfPath)
    void entry.promise.then((doc) => doc.destroy()).catch(() => {})
  }, PDF_IDLE_MS)
}

async function acquireCachedPdfDocument(absPdfPath: string): Promise<PDFDocumentProxy> {
  let entry = pdfDocs.get(absPdfPath)
  if (!entry) {
    const promise = (async () => {
      const pdfjs = await loadPdfJs()
      const bytes = await readFile(absPdfPath)
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(bytes),
        useSystemFonts: true,
        isEvalSupported: false,
        stopAtErrors: false,
      })
      return loadingTask.promise as Promise<PDFDocumentProxy>
    })()
    entry = { promise, refs: 0, idleTimer: null }
    pdfDocs.set(absPdfPath, entry)
    promise.catch(() => {
      if (pdfDocs.get(absPdfPath) === entry) pdfDocs.delete(absPdfPath)
    })
  }
  entry.refs += 1
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer)
    entry.idleTimer = null
  }
  try {
    return await entry.promise
  } catch (error) {
    entry.refs = Math.max(0, entry.refs - 1)
    throw error
  }
}

function releaseCachedPdfDocument(absPdfPath: string) {
  const entry = pdfDocs.get(absPdfPath)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  if (entry.refs === 0) schedulePdfIdle(absPdfPath)
}

/**
 * Renders one PDF page to a JPEG buffer (server-side, for saved covers and thumbs).
 */
export async function renderPdfPageToJpegBuffer(
  absPdfPath: string,
  pageNumber: number,
  width: number = BOOK_COVER_JPEG_WIDTH,
  quality: number = BOOK_COVER_JPEG_QUALITY,
): Promise<Buffer> {
  const pageIndex = Math.max(1, Math.floor(pageNumber))
  const { createCanvas, Path2D, DOMMatrix, DOMPoint, DOMRect } = await import('@napi-rs/canvas')
  ensureNapiCanvasDomGlobals({ Path2D, DOMMatrix, DOMPoint, DOMRect })
  const doc = await acquireCachedPdfDocument(absPdfPath)
  try {
    if (pageIndex > doc.numPages) {
      throw new Error(`PDF page ${pageIndex} is out of range (${doc.numPages} pages).`)
    }

    const page = await doc.getPage(pageIndex)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = width / baseViewport.width
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    const renderTask = page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    })
    await renderTask.promise

    return await canvas.encode('jpeg', Math.round(quality * 100))
  } finally {
    releaseCachedPdfDocument(absPdfPath)
  }
}

/** Renders one PDF page to PNG for OCR (returns pixel size for box mapping). */
export async function renderPdfPageToPngBuffer(
  absPdfPath: string,
  pageNumber: number,
  width: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const pageIndex = Math.max(1, Math.floor(pageNumber))
  const { createCanvas, Path2D, DOMMatrix, DOMPoint, DOMRect } = await import('@napi-rs/canvas')
  ensureNapiCanvasDomGlobals({ Path2D, DOMMatrix, DOMPoint, DOMRect })
  const doc = await acquireCachedPdfDocument(absPdfPath)
  try {
    if (pageIndex > doc.numPages) {
      throw new Error(`PDF page ${pageIndex} is out of range (${doc.numPages} pages).`)
    }

    const page = await doc.getPage(pageIndex)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = width / baseViewport.width
    const viewport = page.getViewport({ scale })
    const pixelWidth = Math.ceil(viewport.width)
    const pixelHeight = Math.ceil(viewport.height)
    const canvas = createCanvas(pixelWidth, pixelHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    const renderTask = page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    })
    await renderTask.promise

    const buffer = Buffer.from(await canvas.encode('png'))
    return { buffer, width: pixelWidth, height: pixelHeight }
  } finally {
    releaseCachedPdfDocument(absPdfPath)
  }
}

/**
 * Renders PDF page 1 to a JPEG buffer (server-side, for persisted book covers).
 */
export async function renderPdfPageOneToJpegBuffer(
  absPdfPath: string,
  width: number = BOOK_COVER_JPEG_WIDTH,
): Promise<Buffer> {
  return renderPdfPageToJpegBuffer(absPdfPath, 1, width, BOOK_COVER_JPEG_QUALITY)
}
