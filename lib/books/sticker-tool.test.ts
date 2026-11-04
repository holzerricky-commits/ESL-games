import { describe, expect, it } from 'vitest'
import {
  isCenteredWritableStickerVariant,
  isQuickStickerInteraction,
  isWritableStickerInteraction,
  isWritableStickerVariant,
  normalizeWritableStickerVariant,
  resolveStickerKindFromLegacyMode,
} from './sticker-tool'
import {
  defaultWritableStickerFill,
  writableStickerChrome,
  writableStickerLayoutMetrics,
} from './writable-sticker-visuals'

describe('sticker-tool writable variants (legacy render)', () => {
  it('recognizes speech and thought as writable variants', () => {
    expect(isWritableStickerVariant('speech')).toBe(true)
    expect(isWritableStickerVariant('thought')).toBe(true)
  })

  it('normalizeWritableStickerVariant preserves legacy speech/thought values', () => {
    expect(normalizeWritableStickerVariant('speech')).toBe('speech')
    expect(normalizeWritableStickerVariant('thought')).toBe('thought')
    expect(normalizeWritableStickerVariant('note')).toBe('note')
    expect(normalizeWritableStickerVariant('caption')).toBe('caption')
    expect(normalizeWritableStickerVariant(undefined)).toBe('note')
  })

  it('isCenteredWritableStickerVariant includes caption and bubbles', () => {
    expect(isCenteredWritableStickerVariant('caption')).toBe(true)
    expect(isCenteredWritableStickerVariant('speech')).toBe(true)
    expect(isCenteredWritableStickerVariant('thought')).toBe(true)
    expect(isCenteredWritableStickerVariant('note')).toBe(false)
  })
})

describe('sticker-tool writable creation retired', () => {
  it('never enables writable sticker interaction', () => {
    expect(isWritableStickerInteraction('sticker', 'writable')).toBe(false)
    expect(isWritableStickerInteraction('sticky', 'writable')).toBe(false)
    expect(isWritableStickerInteraction('sticker', 'quick')).toBe(false)
  })

  it('resolves sticker kind to quick only', () => {
    expect(resolveStickerKindFromLegacyMode('sticky', 'writable')).toBe('quick')
    expect(resolveStickerKindFromLegacyMode('sticker', 'writable')).toBe('quick')
    expect(resolveStickerKindFromLegacyMode('stamp', undefined)).toBe('quick')
  })

  it('treats sticker mode as quick regardless of stored kind', () => {
    expect(isQuickStickerInteraction('sticker', 'writable')).toBe(true)
    expect(isQuickStickerInteraction('sticker', 'quick')).toBe(true)
  })
})

describe('writable-sticker-visuals bubble layout', () => {
  it('speech and thought default to white fill', () => {
    expect(defaultWritableStickerFill('speech', '#fef3c7')).toBe('#ffffff')
    expect(defaultWritableStickerFill('thought', '#fef3c7')).toBe('#ffffff')
    expect(defaultWritableStickerFill('note', '#fef3c7')).toBe('#fef3c7')
  })

  it('speech and thought tails render inside the body (no vertical reserve)', () => {
    const speech = writableStickerChrome('speech', '#ffffff')
    const thought = writableStickerChrome('thought', '#ffffff')
    expect(speech.tailReservePx).toBe(0)
    expect(thought.tailReservePx).toBe(0)
    expect(speech.strokeColor).toBe('#1e293b')
    expect(thought.strokeColor).toBe('#1e293b')
  })

  it('writableStickerLayoutMetrics uses body height only for bubbles', () => {
    const speech = writableStickerLayoutMetrics('speech', 0.05, 800)
    const thought = writableStickerLayoutMetrics('thought', 0.05, 800)
    expect(speech.tailReservePx).toBe(0)
    expect(thought.tailReservePx).toBe(0)
    expect(speech.shellMinPx).toBe(speech.bodyMinPx)
    expect(thought.shellMinPx).toBe(thought.bodyMinPx)
  })
})
