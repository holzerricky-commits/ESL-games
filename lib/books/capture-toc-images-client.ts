'use client'

export type TocPageImagePayload = {
  pdfPage: number
  mimeType: string
  base64: string
}

type PdfPageForRender = {
  getViewport: (options: { scale: number }) => { width: number; height: number }
  render: (params: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
  }) => { promise: Promise<void> }
}

type PdfDocForCapture = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPageForRender>
  destroy: () => Promise<void>
}

const PDFJS_WASM_URL = '/wasm/'

async function renderPageToCanvas(page: PdfPageForRender, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const task = page.render({ canvasContext: ctx, viewport })
  await task.promise
  return canvas
}

export async function captureTocRangeAsJpegs(
  fileUrl: string,
  from: number,
  to: number,
  options?: { maxLongEdge?: number; quality?: number; onProgress?: (message: string) => void },
): Promise<{ images: TocPageImagePayload[]; numPages: number }> {
  if (typeof document === 'undefined') {
    throw new Error('TOC image capture requires a browser.')
  }
  const maxLongEdge = options?.maxLongEdge ?? 1280
  const quality = options?.quality ?? 0.78

  const { pdfjs } = await import('react-pdf')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  }

  const loadingTask = pdfjs.getDocument({ url: fileUrl, wasmUrl: PDFJS_WASM_URL })
  const pdf = (await loadingTask.promise) as unknown as PdfDocForCapture
  const numPages = pdf.numPages
  const start = Math.max(1, Math.min(Math.floor(from), numPages))
  const end = Math.max(start, Math.min(Math.floor(to), numPages))
  const out: TocPageImagePayload[] = []

  try {
    const total = end - start + 1
    for (let i = 0, p = start; p <= end; p++, i++) {
      options?.onProgress?.(`Rendering TOC page ${i + 1} of ${total} for AI...`)
      const page = await pdf.getPage(p)
      const vp1 = page.getViewport({ scale: 1 })
      const scale = Math.min(maxLongEdge / Math.max(vp1.width, vp1.height), 2.5)
      const canvas = await renderPageToCanvas(page, Math.max(0.4, scale))
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const comma = dataUrl.indexOf(',')
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
      out.push({ pdfPage: p, mimeType: 'image/jpeg', base64 })
    }
  } finally {
    await pdf.destroy().catch(() => {})
  }
  return { images: out, numPages }
}
