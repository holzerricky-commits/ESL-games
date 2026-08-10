import { getReaderPrefetchedImageBitmap } from '@/lib/books/reader-page-prefetch-queue'

/** Focus / screen scale above which we prefetch and prefer a sharper cache bitmap. */
export const READER_ZOOM_SHARP_PREFETCH_THRESHOLD = 1.05

/** Max PDF.js render density multiplier (device pixels per CSS pixel). */
export const READER_RENDER_DENSITY_MAX = 3

export function resolveReaderPageScreenScale(scale: number | undefined | null): number {
  if (scale == null || !Number.isFinite(scale) || scale <= 0) return 1
  return scale
}

/** CSS width used for prefetch cache keys when zoom is active. */
export function resolveReaderPagePrefetchWidthPx(
  spreadPageWidth: number,
  screenScale: number | undefined | null,
): number {
  if (!Number.isFinite(spreadPageWidth) || spreadPageWidth <= 0) return spreadPageWidth
  const scale = resolveReaderPageScreenScale(screenScale)
  if (scale <= READER_ZOOM_SHARP_PREFETCH_THRESHOLD) return spreadPageWidth
  return Math.max(1, Math.round(spreadPageWidth * scale))
}

export function resolveReaderPageRenderDensity(
  screenScale: number | undefined | null = 1,
): number {
  const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
    ? window.devicePixelRatio
    : 1
  const scale = resolveReaderPageScreenScale(screenScale)
  return Math.min(READER_RENDER_DENSITY_MAX, dpr * Math.max(1, scale))
}

export type ReaderPageCacheLookup = {
  bitmap: ImageBitmap | null
  prefetchWidthPx: number
  /** Keep showing prefetch cache over live react-pdf while zoomed in. */
  preferSharpCacheOverPdf: boolean
}

export function resolveReaderPageCacheLookup(args: {
  unitId: string
  pageNumber: number
  spreadPageWidth: number
  screenScale: number | undefined | null
}): ReaderPageCacheLookup {
  const prefetchWidthPx = resolveReaderPagePrefetchWidthPx(
    args.spreadPageWidth,
    args.screenScale,
  )
  const zoomedBitmap =
    prefetchWidthPx !== args.spreadPageWidth
      ? getReaderPrefetchedImageBitmap(args.unitId, args.pageNumber, prefetchWidthPx) ?? null
      : null
  const baseBitmap =
    getReaderPrefetchedImageBitmap(args.unitId, args.pageNumber, args.spreadPageWidth) ?? null
  const bitmap = zoomedBitmap ?? baseBitmap
  const preferSharpCacheOverPdf =
    resolveReaderPageScreenScale(args.screenScale) > READER_ZOOM_SHARP_PREFETCH_THRESHOLD &&
    zoomedBitmap != null
  return { bitmap, prefetchWidthPx, preferSharpCacheOverPdf }
}

/** react-pdf render width — matches prefetch width at zoom for sharp live display. */
export function resolveReaderPagePdfRenderWidthPx(
  spreadPageWidth: number,
  screenScale: number | undefined | null,
): number {
  return resolveReaderPagePrefetchWidthPx(spreadPageWidth, screenScale)
}

/** Scale high-res live PDF down into the layout slot (transform on wrapper). */
export function resolveReaderPagePdfFitScale(
  layoutWidthPx: number,
  renderWidthPx: number,
): number {
  if (!(layoutWidthPx > 0) || !(renderWidthPx > 0)) return 1
  if (renderWidthPx <= layoutWidthPx) return 1
  return layoutWidthPx / renderWidthPx
}

export function resolveReaderPagePdfRenderHeightPx(
  layoutWidthPx: number,
  layoutHeightPx: number,
  renderWidthPx: number,
): number {
  if (!(layoutWidthPx > 0) || !(layoutHeightPx > 0)) return layoutHeightPx
  return Math.max(1, Math.round((layoutHeightPx * renderWidthPx) / layoutWidthPx))
}
