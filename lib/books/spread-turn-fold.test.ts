import { describe, expect, it } from 'vitest'
import {
  SPREAD_TURN_FOLD_LIGHTING_END_OPACITY,
  SPREAD_TURN_FOLD_SCALE_X,
  SPREAD_TURN_PAGE_PAPER_COLOR,
  spreadTurnFoldEndTransform,
  spreadTurnFoldLightingGradient,
  spreadTurnFoldLightingOverlayOpacity,
  spreadTurnFoldPageSurfaceStyle,
  spreadTurnFoldSpineOriginX,
  spreadTurnFoldTransformOrigin,
  spreadTurnFoldingPageSide,
} from '@/lib/books/spread-turn-fold'

describe('spread-turn-fold', () => {
  it('hinges the right page forward and the left page backward', () => {
    expect(spreadTurnFoldingPageSide(1)).toBe('right')
    expect(spreadTurnFoldingPageSide(-1)).toBe('left')
    expect(spreadTurnFoldTransformOrigin('right')).toBe('left center')
    expect(spreadTurnFoldTransformOrigin('left')).toBe('right center')
  })

  it('curls toward the spine with directional skew', () => {
    expect(spreadTurnFoldEndTransform(1)).toBe(`scaleX(${SPREAD_TURN_FOLD_SCALE_X}) skewY(-6deg)`)
    expect(spreadTurnFoldEndTransform(-1)).toBe(`scaleX(${SPREAD_TURN_FOLD_SCALE_X}) skewY(6deg)`)
  })

  it('places capture overlay origin on the spread seam', () => {
    expect(spreadTurnFoldSpineOriginX(420, true)).toBe('420px center')
    expect(spreadTurnFoldSpineOriginX(420, false)).toBe('right center')
  })

  it('keeps paper opaque and darkens via shadow overlay only', () => {
    expect(SPREAD_TURN_PAGE_PAPER_COLOR).toBe('#FDFCFB')
    expect(spreadTurnFoldPageSurfaceStyle()).toEqual({
      backgroundColor: '#FDFCFB',
      opacity: 1,
    })
    expect(SPREAD_TURN_FOLD_LIGHTING_END_OPACITY).toBe(0.6)
    expect(spreadTurnFoldLightingOverlayOpacity(false)).toBe(0)
    expect(spreadTurnFoldLightingOverlayOpacity(true)).toBe(0.6)
  })

  it('sweeps asymmetrical inner shadow across the lifting page', () => {
    expect(spreadTurnFoldLightingGradient(1)).toBe(
      'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)',
    )
    expect(spreadTurnFoldLightingGradient(-1)).toBe(
      'linear-gradient(270deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)',
    )
  })
})
