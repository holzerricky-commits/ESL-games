import { describe, expect, it } from 'vitest'
import {
  BINDING_GUTTER_LEFT_FALLOFF_PX,
  BINDING_GUTTER_LIGHTING_WIDTH_PX,
  BINDING_GUTTER_RIGHT_FALLOFF_PX,
  BINDING_SEAM_SHADOW_WIDTH_PX,
  bookBindingGutterLeftPageShadowBackground,
  bookBindingGutterLeftPageShadowStyle,
  bookBindingGutterRightPageHighlightBackground,
  bookBindingGutterRightPageHighlightStyle,
  bookBindingGutterRightPageShadowBackground,
  bookBindingGutterRightPageShadowStyle,
  bookBindingGutterLightingOverlayStyle,
  bookBindingSeamColumnLeftPx,
} from '@/lib/books/book-binding-seam-shadow'

describe('bookBindingGutterLeftPageShadowBackground', () => {
  it('uses transparent black only for multiply shading', () => {
    const bg = bookBindingGutterLeftPageShadowBackground()
    expect(bg).toContain('rgba(0, 0, 0, 0.25)')
    expect(bg).toContain('transparent')
    expect(bg).not.toMatch(/rgba\(255/)
    expect(bg).not.toMatch(/#[fF]{3,6}/)
  })
})

describe('bookBindingGutterRightPageShadowBackground', () => {
  it('renders a sharp 2px ambient occlusion line at the joint', () => {
    const bg = bookBindingGutterRightPageShadowBackground()
    expect(bg).toContain('rgba(0, 0, 0, 0.3) 2px')
    expect(bg).toContain('transparent 2px')
  })
})

describe('bookBindingGutterRightPageHighlightBackground', () => {
  it('uses transparent white for a screen-blended crest sheen', () => {
    const bg = bookBindingGutterRightPageHighlightBackground()
    expect(bg).toContain('rgba(255, 255, 255, 0.18)')
    expect(bg).toContain('transparent 2px')
    expect(bg).not.toMatch(/rgba\(0,\s*0,\s*0/)
  })
})

describe('gutter lighting layer styles', () => {
  it('splits asymmetric falloff widths on each page side', () => {
    expect(BINDING_GUTTER_LIGHTING_WIDTH_PX).toBe(
      BINDING_GUTTER_LEFT_FALLOFF_PX + BINDING_GUTTER_RIGHT_FALLOFF_PX,
    )
    expect(bookBindingGutterLeftPageShadowStyle(640).width).toBe(BINDING_GUTTER_LEFT_FALLOFF_PX)
    expect(bookBindingGutterRightPageShadowStyle(640).width).toBe(BINDING_GUTTER_RIGHT_FALLOFF_PX)
    expect(bookBindingGutterRightPageHighlightStyle(640).mixBlendMode).toBe('screen')
    expect(bookBindingGutterLeftPageShadowStyle(640).mixBlendMode).toBe('multiply')
  })

  it('keeps a wider clear column constant for page-stack masking', () => {
    expect(BINDING_SEAM_SHADOW_WIDTH_PX).toBe(140)
  })

  it('centers the seam column on spreadPageWidth', () => {
    expect(bookBindingSeamColumnLeftPx(500)).toBe(500 - 70)
    expect(bookBindingSeamColumnLeftPx(500) + BINDING_SEAM_SHADOW_WIDTH_PX / 2).toBe(500)
  })

  it('centers the lighting overlay on the spread canvas when overlap is off', () => {
    const style = bookBindingGutterLightingOverlayStyle(640)
    expect(style.width).toBe(BINDING_SEAM_SHADOW_WIDTH_PX)
    expect(style.transform).toBe('translateX(-50%)')
  })
})
