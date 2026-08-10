import { describe, expect, it } from 'vitest'
import { resolveAnnotationRailToolSlot } from '@/lib/books/annotation-rail-tool-slot'

describe('resolveAnnotationRailToolSlot', () => {
  it('maps drawing modes to rail slots', () => {
    expect(resolveAnnotationRailToolSlot('pen')).toBe('pen')
    expect(resolveAnnotationRailToolSlot('marker')).toBe('marker')
    expect(resolveAnnotationRailToolSlot('rect')).toBe('shapes')
    expect(resolveAnnotationRailToolSlot('text')).toBe('text')
    expect(resolveAnnotationRailToolSlot('select')).toBe('select')
  })

  it('maps sticker modes to the stickers slot', () => {
    expect(resolveAnnotationRailToolSlot('sticker', { stickerKind: 'quick' })).toBe('stickers')
    expect(resolveAnnotationRailToolSlot('sticky')).toBe('stickers')
  })

  it('prefers focus slot while drawing a focus box', () => {
    expect(resolveAnnotationRailToolSlot('pen', { focusZoomDrawActive: true })).toBe('focus')
  })
})
