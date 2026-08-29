'use client'

import { expandPageNormRect, type PageNormRect } from '@/lib/books/book-exercises'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'

const PAGE_LONG_EDGE = 1600
const MIN_CROP_LONG_EDGE = 720
const MAX_CROP_LONG_EDGE = 1600
const JPEG_QUALITY = 0.82

function canvasToJpegBase64(canvas: HTMLCanvasElement, quality: number): string {
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

/**
 * Picture of one boxed region on a PDF page, using the same browser PDF engine as the reader.
 */
export async function capturePdfPageNormRectJpeg(args: {
  fileUrl: string
  pdfPage: number
  rect: PageNormRect
}): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Draft from box needs the open book.')
  }
  const pdf = await loadCachedPdfDocument(args.fileUrl)
  const pageIndex = Math.max(1, Math.floor(args.pdfPage))
  if (pageIndex > pdf.numPages) {
    throw new Error('That page is not in this PDF.')
  }
  const page = await pdf.getPage(pageIndex)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(PAGE_LONG_EDGE / Math.max(base.width, base.height), 2.5)
  const viewport = page.getViewport({ scale: Math.max(0.5, scale) })
  const pageCanvas = document.createElement('canvas')
  const pageCtx = pageCanvas.getContext('2d')
  if (!pageCtx) throw new Error('Could not take a picture of that box.')
  pageCanvas.width = Math.ceil(viewport.width)
  pageCanvas.height = Math.ceil(viewport.height)
  await page.render({
    canvas: pageCanvas,
    canvasContext: pageCtx,
    viewport,
  }).promise

  const cropRect = expandPageNormRect(args.rect)
  const sx = Math.max(0, Math.floor(cropRect.x * pageCanvas.width))
  const sy = Math.max(0, Math.floor(cropRect.y * pageCanvas.height))
  const sw = Math.max(1, Math.min(pageCanvas.width - sx, Math.ceil(cropRect.w * pageCanvas.width)))
  const sh = Math.max(1, Math.min(pageCanvas.height - sy, Math.ceil(cropRect.h * pageCanvas.height)))
  if (sw < 8 || sh < 8) {
    throw new Error('That box is too small to read.')
  }

  const longEdge = Math.max(sw, sh)
  let outW = sw
  let outH = sh
  if (longEdge < MIN_CROP_LONG_EDGE) {
    const scaleUp = MIN_CROP_LONG_EDGE / longEdge
    outW = Math.round(sw * scaleUp)
    outH = Math.round(sh * scaleUp)
  } else if (longEdge > MAX_CROP_LONG_EDGE) {
    const scaleDown = MAX_CROP_LONG_EDGE / longEdge
    outW = Math.round(sw * scaleDown)
    outH = Math.round(sh * scaleDown)
  }

  const crop = document.createElement('canvas')
  crop.width = outW
  crop.height = outH
  const cropCtx = crop.getContext('2d')
  if (!cropCtx) throw new Error('Could not take a picture of that box.')
  cropCtx.drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, outW, outH)
  return canvasToJpegBase64(crop, JPEG_QUALITY)
}
