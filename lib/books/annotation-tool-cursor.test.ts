import { describe, expect, it } from 'vitest'
import {
  buildAnnotationToolCursor,
  penCursorWidthPx,
  strokeWidthPxForTool,
} from '@/lib/books/annotation-tool-cursor'

describe('annotation-tool-cursor', () => {
  it('scales marker width with thickness step', () => {
    const thin = strokeWidthPxForTool('marker', {
      strokeWidthScale: 0.5,
      eraserLineStrokeWidthScale: 1,
      penStrokeWidthScale: 1,
    })
    const thick = strokeWidthPxForTool('marker', {
      strokeWidthScale: 1.68,
      eraserLineStrokeWidthScale: 1,
      penStrokeWidthScale: 1,
    })
    expect(thick).toBeGreaterThan(thin)
    expect(thin).toBe(11)
    expect(Math.round(thick)).toBe(37)
  })

  it('builds marker cursor at full selected color', () => {
    const marker = decodeURIComponent(
      buildAnnotationToolCursor({ tool: 'marker', widthPx: 22, color: '#ffeb3b' }),
    )
    expect(marker).toContain('data:image/svg+xml')
    expect(marker).toContain('fill="#ffeb3b"')
    expect(marker).not.toContain('fill-opacity')
    expect(marker).toContain('width="7"')
    expect(marker).toContain('height="22"')
  })

  it('builds a true-size pen disc with a thin white and black edge', () => {
    const pen = decodeURIComponent(
      buildAnnotationToolCursor({ tool: 'pen', widthPx: 8, color: '#2563eb' }),
    )
    expect(pen).toContain('fill="#2563eb"')
    expect(pen).toContain('stroke="#ffffff"')
    expect(pen).toContain('stroke="#000000"')
    expect(pen).not.toContain('fill-opacity="0.35"')
    expect(pen.match(/<circle/g)?.length).toBe(3)
    expect(pen).toContain('r="4"')
    expect(pen).toContain('width="14"')
  })

  it('matches pen cursor fill to stroke size', () => {
    const thin = decodeURIComponent(
      buildAnnotationToolCursor({ tool: 'pen', widthPx: 3, color: '#171717' }),
    )
    const thick = decodeURIComponent(
      buildAnnotationToolCursor({ tool: 'pen', widthPx: 40, color: '#171717' }),
    )
    expect(thin).toContain('r="1.5"')
    expect(thin).toContain('width="9"')
    expect(thick).toContain('r="20"')
    expect(thick).toContain('width="46"')
  })

  it('pen cursor width follows canvas line width and brush outer pass', () => {
    expect(
      strokeWidthPxForTool('pen', {
        strokeWidthScale: 1,
        eraserLineStrokeWidthScale: 1,
        penStrokeWidthScale: 2,
      }),
    ).toBe(5)
    expect(
      strokeWidthPxForTool('pen', {
        strokeWidthScale: 1,
        eraserLineStrokeWidthScale: 1,
        penStrokeWidthScale: 2,
      }, 'brush'),
    ).toBeCloseTo(2.5 * 2 * 1.55, 5)
    expect(penCursorWidthPx(2, 'fine-liner')).toBe(5)
  })
})
