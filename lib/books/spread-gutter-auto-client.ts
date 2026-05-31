import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import {
  estimateSpreadGutterPullRatioFromPageImages,
  medianSpreadGutterPullRatio,
  SPREAD_GUTTER_AUTO_ANALYSIS_WIDTH_PX,
} from '@/lib/books/spread-gutter-auto'

export async function renderPdfPageToImageData(
  fileUrl: string,
  pageNumber: number,
  targetWidth: number = SPREAD_GUTTER_AUTO_ANALYSIS_WIDTH_PX,
): Promise<ImageData> {
  const pdf = await loadCachedPdfDocument(fileUrl)
  const page = await pdf.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = targetWidth / baseViewport.width
  const viewport = page.getViewport({ scale })
  const w = Math.floor(viewport.width)
  const h = Math.floor(viewport.height)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not get canvas context for gutter analysis')
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return ctx.getImageData(0, 0, w, h)
}

export type SpreadPagePair = { leftPage: number; rightPage: number }

/**
 * Estimate seam overlap from one or more spreads (median when multiple).
 */
export async function estimateSpreadGutterPullRatioFromPdf(
  fileUrl: string,
  spreads: SpreadPagePair[],
): Promise<number> {
  const ratios: number[] = []
  for (const { leftPage, rightPage } of spreads) {
    const [leftImg, rightImg] = await Promise.all([
      renderPdfPageToImageData(fileUrl, leftPage),
      renderPdfPageToImageData(fileUrl, rightPage),
    ])
    if (leftImg.height !== rightImg.height) {
      const targetH = Math.min(leftImg.height, rightImg.height)
      ratios.push(
        estimateSpreadGutterPullRatioFromPageImages(
          cropImageDataHeight(leftImg, targetH),
          cropImageDataHeight(rightImg, targetH),
        ),
      )
    } else {
      ratios.push(estimateSpreadGutterPullRatioFromPageImages(leftImg, rightImg))
    }
  }
  return medianSpreadGutterPullRatio(ratios)
}

function cropImageDataHeight(source: ImageData, targetHeight: number): ImageData {
  if (source.height <= targetHeight) return source
  const cropped = new ImageData(source.width, targetHeight)
  const rowBytes = source.width * 4
  for (let y = 0; y < targetHeight; y++) {
    cropped.data.set(
      source.data.subarray(y * rowBytes, y * rowBytes + rowBytes),
      y * rowBytes,
    )
  }
  return cropped
}

/** Build up to `maxSpreads` consecutive spread pairs from visible left-page indices. */
export function pickSpreadPairsForAutoAnalysis(
  visibleLeftPages: number[],
  focusLeftPage: number,
  maxSpreads = 3,
): SpreadPagePair[] {
  if (visibleLeftPages.length < 2) return []
  const pairs: SpreadPagePair[] = []
  for (let i = 0; i < visibleLeftPages.length - 1; i++) {
    const left = visibleLeftPages[i]!
    const right = visibleLeftPages[i + 1]!
    pairs.push({ leftPage: left, rightPage: right })
  }
  if (!pairs.length) return []

  const focusIdx = Math.max(0, pairs.findIndex((p) => p.leftPage === focusLeftPage))
  const start = Math.max(0, focusIdx - Math.floor(maxSpreads / 2))
  return pairs.slice(start, start + maxSpreads)
}
