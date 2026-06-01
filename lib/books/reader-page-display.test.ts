import { describe, expect, it } from 'vitest'
import {
  isReaderPageSharpReady,
  readerPageHasDrawablePixelsFromLayers,
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
