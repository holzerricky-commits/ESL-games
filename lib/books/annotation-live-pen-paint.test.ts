import { describe, expect, it } from 'vitest'
import { penStrokeUsesRichLivePaint } from '@/lib/books/annotation-live-pen-paint'

describe('penStrokeUsesRichLivePaint', () => {
  it('uses fast live paint for default solid pen', () => {
    expect(penStrokeUsesRichLivePaint({ penInkStyle: 'solid', penStrokeProfile: 'pen' })).toBe(false)
  })

  it('uses rich live paint for brush soft passes', () => {
    expect(penStrokeUsesRichLivePaint({ penInkStyle: 'solid', penStrokeProfile: 'brush' })).toBe(true)
  })

  it('uses rich live paint for pencil transparency', () => {
    expect(penStrokeUsesRichLivePaint({ penInkStyle: 'solid', penStrokeProfile: 'pencil' })).toBe(true)
  })

  it('uses rich live paint for effect inks', () => {
    expect(penStrokeUsesRichLivePaint({ penInkStyle: 'rainbow', penStrokeProfile: 'effects' })).toBe(true)
  })

  it('uses fast live paint for fine liner', () => {
    expect(penStrokeUsesRichLivePaint({ penInkStyle: 'solid', penStrokeProfile: 'fine-liner' })).toBe(false)
  })
})
