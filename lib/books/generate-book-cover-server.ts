import 'server-only'

import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

/** Saved cover width — ~2× launcher mockup for crisp display on retina screens. */
export const BOOK_COVER_JPEG_WIDTH = 480
export const BOOK_COVER_JPEG_QUALITY = 0.9

let pdfWorkerConfigured = false

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

/**
 * Renders PDF page 1 to a JPEG buffer (server-side, for persisted book covers).
 */
export async function renderPdfPageOneToJpegBuffer(
  absPdfPath: string,
  width: number = BOOK_COVER_JPEG_WIDTH,
): Promise<Buffer> {
  const pdfjs = await loadPdfJs()
  const { createCanvas } = await import('@napi-rs/canvas')
  const bytes = await readFile(absPdfPath)
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
    stopAtErrors: false,
  })
  const doc = await loadingTask.promise

  try {
    const page = await doc.getPage(1)
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

    return await canvas.encode('jpeg', Math.round(BOOK_COVER_JPEG_QUALITY * 100))
  } finally {
    await doc.destroy()
  }
}
