import { describe, expect, it } from 'vitest'
import {
  isReaderPageSharpReady,
  readerPageHasDrawablePixelsFromLayers,
  resolveReaderPageLayerVisibility,
  resolveReaderPageShowSharpCache,
  shouldShowReaderPagePlaceholder,
} from '@/lib/books/reader-page-display'

describe('isReaderPageSharpReady', () => {
  it('is true when full-res cache exists', () => {
    expect(isReaderPageSharpReady({ cacheBitmap: {} as ImageBitmap, pdfDisplayReady: false })).toBe(true)
  })

  it('is true when PDF composited', () => {
    expect(isReaderPageSharpReady({ cacheBitmap: null, pdfDisplayReady: true })).toBe(true)
  })

  it('is false when neither cache nor PDF', () => {
    expect(isReaderPageSharpReady({ cacheBitmap: null, pdfDisplayReady: false })).toBe(false)
  })
})

describe('shouldShowReaderPagePlaceholder', () => {
  const placeholder = {
    kind: 'thumbnail' as const,
    dataUrl: 'data:image/png;base64,abc',
    sourceWidth: 76,
  }

  it('shows placeholder only when sharp is not ready', () => {
    expect(shouldShowReaderPagePlaceholder({ sharpReady: false, placeholder })).toBe(true)
    expect(shouldShowReaderPagePlaceholder({ sharpReady: true, placeholder })).toBe(false)
    expect(shouldShowReaderPagePlaceholder({ sharpReady: false, placeholder: null })).toBe(false)
  })
})

describe('resolveReaderPageShowSharpCache', () => {
  const bitmap = {} as ImageBitmap

  it('hides cache once live PDF is ready in primary mode', () => {
    expect(
      resolveReaderPageShowSharpCache({
        livePdfPrimaryEnabled: true,
        cacheBitmap: bitmap,
        pdfDisplayReady: true,
        preferSharpCacheOverPdf: true,
      }),
    ).toBe(false)
  })

  it('shows cache while live PDF loads in primary mode', () => {
    expect(
      resolveReaderPageShowSharpCache({
        livePdfPrimaryEnabled: true,
        cacheBitmap: bitmap,
        pdfDisplayReady: false,
        preferSharpCacheOverPdf: false,
      }),
    ).toBe(true)
  })

  it('keeps zoomed cache over live PDF in legacy cache-first mode', () => {
    expect(
      resolveReaderPageShowSharpCache({
        livePdfPrimaryEnabled: false,
        cacheBitmap: bitmap,
        pdfDisplayReady: true,
        preferSharpCacheOverPdf: true,
      }),
    ).toBe(true)
  })
})

describe('resolveReaderPageLayerVisibility', () => {
  it('keeps sharp cache visible when text select is active', () => {
    expect(
      resolveReaderPageLayerVisibility({
        bookTextSelectActive: true,
        pageHasSelectableText: true,
        showSharpCache: true,
      }),
    ).toEqual({
      pdfTextLayerActive: true,
      pdfTextOverCache: true,
      pdfHiddenBehindCache: false,
      showSharpCacheLayer: true,
    })
  })

  it('hides PDF wrapper behind cache when text select is off', () => {
    expect(
      resolveReaderPageLayerVisibility({
        bookTextSelectActive: false,
        pageHasSelectableText: true,
        showSharpCache: true,
      }),
    ).toEqual({
      pdfTextLayerActive: false,
      pdfTextOverCache: false,
      pdfHiddenBehindCache: true,
      showSharpCacheLayer: true,
    })
  })

  it('shows live PDF when cache handoff completed', () => {
    expect(
      resolveReaderPageLayerVisibility({
        bookTextSelectActive: true,
        pageHasSelectableText: true,
        showSharpCache: false,
      }),
    ).toEqual({
      pdfTextLayerActive: true,
      pdfTextOverCache: false,
      pdfHiddenBehindCache: false,
      showSharpCacheLayer: false,
    })
  })
})

describe('readerPageHasDrawablePixelsFromLayers', () => {
  it('counts placeholder as drawable', () => {
    expect(
      readerPageHasDrawablePixelsFromLayers({
        showSharpCache: false,
        pdfDisplayReady: false,
        showPlaceholder: true,
      }),
    ).toBe(true)
  })

  it('is false with no layers', () => {
    expect(
      readerPageHasDrawablePixelsFromLayers({
        showSharpCache: false,
        pdfDisplayReady: false,
        showPlaceholder: false,
      }),
    ).toBe(false)
  })
})
