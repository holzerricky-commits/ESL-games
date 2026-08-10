import { describe, expect, it } from 'vitest'
import {
  BOOK_FOCUS_ZOOM_FILL,
  clientPointToSpreadNorm,
  clientToSpreadNormFromRect,
  computeFocusSpreadLayout,
  focusSpreadLayoutWithPan,
  focusZoomHoleForRegion,
  focusZoomSpotlightClipPath,
  focusZoomTheaterClipPath,
  holeRectToClientRect,
  measuredSpreadScreenScale,
  normalizeSpreadNormRect,
  spreadNormPointToClient,
  spreadNormRectFromClientDrag,
} from '@/lib/books/focus-zoom-transform'

describe('focus-zoom-transform', () => {
  it('normalizes spread norm rect', () => {
    const rect = normalizeSpreadNormRect(0.2, 0.3, 0.5, 0.7)
    expect(rect).not.toBeNull()
    expect(rect!.x).toBe(0.2)
    expect(rect!.y).toBe(0.3)
    expect(rect!.w).toBeCloseTo(0.3, 5)
    expect(rect!.h).toBeCloseTo(0.4, 5)
  })

  it('rejects tiny rects', () => {
    expect(normalizeSpreadNormRect(0.1, 0.1, 0.105, 0.2)).toBeNull()
  })

  it('maps client drag to spread norm rect', () => {
    const spreadRect = { left: 100, top: 50, width: 800, height: 600 }
    const rect = spreadNormRectFromClientDrag(spreadRect, 200, 150, 500, 400)
    expect(rect).not.toBeNull()
    expect(rect!.x).toBeCloseTo(0.125, 5)
    expect(rect!.y).toBeCloseTo(1 / 6, 5)
    expect(rect!.w).toBeCloseTo(0.375, 5)
    expect(rect!.h).toBeCloseTo(5 / 12, 5)
  })

  it('clientToSpreadNormFromRect clamps', () => {
    const spreadRect = { left: 0, top: 0, width: 100, height: 100 }
    expect(clientToSpreadNormFromRect(spreadRect, -10, 50)).toEqual([0, 0.5])
    expect(clientToSpreadNormFromRect(spreadRect, 150, 50)).toEqual([1, 0.5])
  })

  it('computeFocusSpreadLayout aligns region to WYSIWYG hole', () => {
    const normRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }
    const layout = computeFocusSpreadLayout({
      pageAreaW: 1000,
      pageAreaH: 800,
      spreadW: 900,
      spreadH: 600,
      baseScale: 1,
      normRect,
      fill: BOOK_FOCUS_ZOOM_FILL,
    })
    expect(layout).not.toBeNull()
    const regionOriginX = normRect.x * 900
    const regionOriginY = normRect.y * 600
    expect(layout!.translateX + regionOriginX * layout!.scale).toBeCloseTo(layout!.holeRect.x, 4)
    expect(layout!.translateY + regionOriginY * layout!.scale).toBeCloseTo(layout!.holeRect.y, 4)
    const regionScreenW = normRect.w * 900
    const regionScreenH = normRect.h * 600
    expect(regionScreenW * layout!.scale).toBeCloseTo(layout!.holeRect.w, 3)
    expect(regionScreenH * layout!.scale).toBeCloseTo(layout!.holeRect.h, 3)
    expect(layout!.panX).toBe(0)
    expect(layout!.panY).toBe(0)
  })

  it('focusZoomHoleForRegion preserves selection aspect ratio', () => {
    const pageAreaW = 1000
    const pageAreaH = 800
    const spreadW = 900
    const spreadH = 600
    const wideStrip = { x: 0.1, y: 0.4, w: 0.7, h: 0.12 }
    const hole = focusZoomHoleForRegion({
      pageAreaW,
      pageAreaH,
      spreadW,
      spreadH,
      baseScale: 1,
      normRect: wideStrip,
      fill: BOOK_FOCUS_ZOOM_FILL,
    })!
    const regionAspect = (wideStrip.w * spreadW) / (wideStrip.h * spreadH)
    expect(hole.w / hole.h).toBeCloseTo(regionAspect, 4)
    expect(hole.w).toBeLessThanOrEqual(pageAreaW * BOOK_FOCUS_ZOOM_FILL + 0.01)
    expect(hole.h).toBeLessThanOrEqual(pageAreaH * BOOK_FOCUS_ZOOM_FILL + 0.01)
    expect(hole.x).toBeGreaterThanOrEqual(0)
    expect(hole.y).toBeGreaterThanOrEqual(0)
  })

  it('wide strip hole is wider than tall (not viewport slab)', () => {
    const hole = focusZoomHoleForRegion({
      pageAreaW: 1000,
      pageAreaH: 800,
      spreadW: 900,
      spreadH: 600,
      baseScale: 1,
      normRect: { x: 0.05, y: 0.45, w: 0.8, h: 0.1 },
      fill: BOOK_FOCUS_ZOOM_FILL,
    })!
    expect(hole.w).toBeGreaterThan(hole.h)
    const viewportSlabH = 800 * BOOK_FOCUS_ZOOM_FILL
    expect(hole.h).toBeLessThan(viewportSlabH)
  })

  it('clampFocusPanOffset keeps visible spread region inside bounds', () => {
    const baseLayout = computeFocusSpreadLayout({
      pageAreaW: 1000,
      pageAreaH: 800,
      spreadW: 900,
      spreadH: 600,
      baseScale: 1,
      normRect: { x: 0.2, y: 0.2, w: 0.35, h: 0.35 },
    })!
    const spreadW = 900
    const spreadH = 600
    const merged = focusSpreadLayoutWithPan(baseLayout, spreadW, spreadH, 500, -400)
    const { translateX, translateY, scale, holeRect } = merged
    const visibleLeft = (holeRect.x - translateX) / scale
    const visibleRight = (holeRect.x + holeRect.w - translateX) / scale
    const visibleTop = (holeRect.y - translateY) / scale
    const visibleBottom = (holeRect.y + holeRect.h - translateY) / scale
    expect(visibleLeft).toBeGreaterThanOrEqual(-0.01)
    expect(visibleRight).toBeLessThanOrEqual(spreadW + 0.01)
    expect(visibleTop).toBeGreaterThanOrEqual(-0.01)
    expect(visibleBottom).toBeLessThanOrEqual(spreadH + 0.01)
  })

  it('measuredSpreadScreenScale prefers DOM rect', () => {
    expect(measuredSpreadScreenScale({ width: 1800 }, 900, 1)).toBe(2)
    expect(measuredSpreadScreenScale(null, 900, 1.25)).toBe(1.25)
  })

  it('small box fills the hole with no max-extra ceiling', () => {
    const normRect = { x: 0.4, y: 0.4, w: 0.12, h: 0.12 }
    const layout = computeFocusSpreadLayout({
      pageAreaW: 1000,
      pageAreaH: 800,
      spreadW: 900,
      spreadH: 600,
      baseScale: 1,
      normRect,
    })!
    const regionScreenW = normRect.w * 900
    const regionScreenH = normRect.h * 600
    expect(regionScreenW * layout.scale).toBeCloseTo(layout.holeRect.w, 3)
    expect(regionScreenH * layout.scale).toBeCloseTo(layout.holeRect.h, 3)
    expect(layout.holeRect.w).toBeCloseTo(
      focusZoomHoleForRegion({
        pageAreaW: 1000,
        pageAreaH: 800,
        spreadW: 900,
        spreadH: 600,
        baseScale: 1,
        normRect,
      })!.w,
      3,
    )
  })

  it('tiny box still fills the full 92% hole (uncapped zoom)', () => {
    const normRect = { x: 0.45, y: 0.45, w: 0.05, h: 0.05 }
    const layout = computeFocusSpreadLayout({
      pageAreaW: 1000,
      pageAreaH: 800,
      spreadW: 900,
      spreadH: 600,
      baseScale: 1,
      normRect,
    })!
    const ideal = focusZoomHoleForRegion({
      pageAreaW: 1000,
      pageAreaH: 800,
      spreadW: 900,
      spreadH: 600,
      baseScale: 1,
      normRect,
    })!
    const regionScreenW = normRect.w * 900
    const regionScreenH = normRect.h * 600
    expect(layout.holeRect.w).toBeCloseTo(ideal.w, 3)
    expect(layout.holeRect.h).toBeCloseTo(ideal.h, 3)
    expect(regionScreenW * layout.scale).toBeCloseTo(layout.holeRect.w, 3)
    expect(regionScreenH * layout.scale).toBeCloseTo(layout.holeRect.h, 3)
    expect(layout.scale).toBeGreaterThan(4)
  })

  it('focusZoomSpotlightClipPath builds even-odd hole cutout', () => {
    const clip = focusZoomSpotlightClipPath({ x: 100, y: 50, w: 400, h: 300 }, 1000, 800)
    expect(clip).toContain('polygon(evenodd,')
    expect(clip).toContain('10% 6.25%')
    expect(clip).toContain('50% 43.75%')
    expect(focusZoomSpotlightClipPath(null, 1000, 800)).toBeUndefined()
    expect(focusZoomSpotlightClipPath({ x: 0, y: 0, w: 0, h: 0 }, 1000, 800)).toBeUndefined()
  })

  it('focusZoomTheaterClipPath cuts a hole relative to the overlay container', () => {
    const clip = focusZoomTheaterClipPath(
      { left: 120, top: 80, width: 400, height: 300 },
      { left: 0, top: 0, width: 1280, height: 720 },
    )
    expect(clip).toContain('polygon(evenodd,')
    expect(clip).toContain(`${(120 / 1280) * 100}%`)
    expect(clip).toContain(`${(80 / 720) * 100}%`)
    expect(holeRectToClientRect({ x: 50, y: 30, w: 200, h: 100 }, { left: 100, top: 40 })).toEqual({
      left: 150,
      top: 70,
      width: 200,
      height: 100,
    })
  })

  it('client and spread norm round-trip under scaled rect (focus zoom ink parity)', () => {
    const spreadRect = { left: 120, top: 80, width: 1600, height: 900 }
    const clientX = 520
    const clientY = 380
    const [nx, ny] = clientPointToSpreadNorm(spreadRect, clientX, clientY)
    const [backX, backY] = spreadNormPointToClient(spreadRect, nx, ny)
    expect(backX).toBeCloseTo(clientX, 4)
    expect(backY).toBeCloseTo(clientY, 4)
    expect(nx).toBeCloseTo(0.25, 4)
    expect(ny).toBeCloseTo(1 / 3, 4)
  })
})
