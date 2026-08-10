import { describe, expect, it } from 'vitest'
import {
  READER_ZOOM_SHARP_PREFETCH_THRESHOLD,
  resolveReaderPagePdfFitScale,
  resolveReaderPagePdfRenderHeightPx,
  resolveReaderPagePdfRenderWidthPx,
  resolveReaderPagePrefetchWidthPx,
  resolveReaderPageRenderDensity,
  resolveReaderPageScreenScale,
} from '@/lib/books/reader-page-render-width'

describe('resolveReaderPageScreenScale', () => {
  it('defaults invalid values to 1', () => {
    expect(resolveReaderPageScreenScale(undefined)).toBe(1)
    expect(resolveReaderPageScreenScale(0)).toBe(1)
    expect(resolveReaderPageScreenScale(-2)).toBe(1)
  })
})

describe('resolveReaderPagePrefetchWidthPx', () => {
  it('uses layout width at 1x zoom', () => {
    expect(resolveReaderPagePrefetchWidthPx(640, 1)).toBe(640)
    expect(resolveReaderPagePrefetchWidthPx(640, READER_ZOOM_SHARP_PREFETCH_THRESHOLD)).toBe(640)
  })

  it('scales prefetch width when focus zoom is active', () => {
    expect(resolveReaderPagePrefetchWidthPx(400, 2)).toBe(800)
    expect(resolveReaderPagePrefetchWidthPx(401, 1.5)).toBe(602)
  })
})

describe('resolveReaderPageRenderDensity', () => {
  it('caps density at READER_RENDER_DENSITY_MAX', () => {
    expect(resolveReaderPageRenderDensity(10)).toBe(3)
  })
})

describe('resolveReaderPagePdfFitScale', () => {
  it('scales down when render width exceeds layout slot', () => {
    expect(resolveReaderPagePdfFitScale(400, 800)).toBe(0.5)
    expect(resolveReaderPagePdfFitScale(400, 400)).toBe(1)
  })
})

describe('resolveReaderPagePdfRenderWidthPx', () => {
  it('matches prefetch width at zoom', () => {
    expect(resolveReaderPagePdfRenderWidthPx(400, 2)).toBe(800)
  })
})

describe('resolveReaderPagePdfRenderHeightPx', () => {
  it('preserves aspect ratio for scaled render height', () => {
    expect(resolveReaderPagePdfRenderHeightPx(400, 600, 800)).toBe(1200)
  })
})
