import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_NEUTRAL_BLACK,
  ANNOTATION_NEUTRAL_WHITE,
  DEFAULT_STICKY_FILL_COLOR,
} from '@/lib/books/annotation-palettes'
import {
  buildWritableStickerPreviewFill,
  buildWritableStickerPreviewFontSizePx,
  buildWritableStickerPreviewLayout,
} from '@/lib/books/writable-sticker-preview-style'

describe('buildWritableStickerPreviewFill', () => {
  it('uses toolbar fill for note variant', () => {
    expect(buildWritableStickerPreviewFill('note', '#aabbcc')).toBe('#aabbcc')
  })

  it('uses fixed defaults for caption and bubbles', () => {
    expect(buildWritableStickerPreviewFill('caption', '#aabbcc')).toBe(ANNOTATION_NEUTRAL_BLACK)
    expect(buildWritableStickerPreviewFill('speech', '#aabbcc')).toBe(ANNOTATION_NEUTRAL_WHITE)
    expect(buildWritableStickerPreviewFill('thought', '#aabbcc')).toBe(ANNOTATION_NEUTRAL_WHITE)
  })

  it('falls back sticky note color when toolbar fill empty', () => {
    expect(buildWritableStickerPreviewFill('note', '')).toBe(DEFAULT_STICKY_FILL_COLOR)
  })
})

describe('buildWritableStickerPreviewFontSizePx', () => {
  it('grows with thickness step', () => {
    const small = buildWritableStickerPreviewFontSizePx(0, 600)
    const large = buildWritableStickerPreviewFontSizePx(7, 600)
    expect(large).toBeGreaterThan(small)
  })
})

describe('buildWritableStickerPreviewLayout', () => {
  it('derives height from variant aspect ratio', () => {
    const note = buildWritableStickerPreviewLayout('note')
    const caption = buildWritableStickerPreviewLayout('caption')
    expect(note.widthPx).toBe(220)
    expect(caption.widthPx).toBe(220)
    expect(note.heightPx).toBeGreaterThan(caption.heightPx)
  })
})
