import { describe, expect, it } from 'vitest'
import {
  clientToWhiteboardDocumentNorm,
  clientToWhiteboardDocumentNormFromContent,
  clientToWhiteboardDocumentNormFromScrollport,
  isWhiteboardDocumentScrollPaint,
  projectCommandsForWhiteboardViewport,
} from '@/lib/books/whiteboard-viewport-ink'

const config = {
  contentHeightPx: 2400,
  viewportHeightPx: 800,
  scrollTopPx: 400,
}

describe('whiteboard-viewport-ink', () => {
  it('clientToWhiteboardDocumentNorm maps viewport pointer into document space when scrollable', () => {
    const rect = { left: 0, top: -400, width: 400, height: 2400 }
    const [, ny] = clientToWhiteboardDocumentNorm(config, rect, 200, 400)
    expect(ny).toBeCloseTo(800 / 2400, 5)
  })

  it('clientToWhiteboardDocumentNorm maps directly on fixed-height canvas', () => {
    const fixed = { contentHeightPx: 620, viewportHeightPx: 850, scrollTopPx: 0 }
    const rect = { left: 0, top: 115, width: 1100, height: 620 }
    const [, midY] = clientToWhiteboardDocumentNorm(fixed, rect, 550, 115 + 310)
    const [, bottomY] = clientToWhiteboardDocumentNorm(fixed, rect, 550, 115 + 620)
    expect(midY).toBeCloseTo(0.5, 5)
    expect(bottomY).toBeCloseTo(1, 5)
  })

  it('clientToWhiteboardDocumentNormFromContent tracks scrolled content without scrollTop state', () => {
    const content = { left: 0, top: -400, width: 400, height: 2400 }
    const [, ny] = clientToWhiteboardDocumentNormFromContent(config, content, 200, 400)
    expect(ny).toBeCloseTo(800 / 2400, 5)
  })

  it('clientToWhiteboardDocumentNormFromScrollport maps through scrollTop', () => {
    const scrollport = { left: 10, top: 50, width: 400 }
    const [, ny] = clientToWhiteboardDocumentNormFromScrollport(config, scrollport, 210, 450)
    expect(ny).toBeCloseTo(800 / 2400, 5)
  })

  it('uses display-sized config for shrunk floating board', () => {
    const shrunk = {
      contentHeightPx: 1200,
      viewportHeightPx: 400,
      scrollTopPx: 200,
    }
    const content = { left: 0, top: -200, width: 200, height: 1200 }
    const [, ny] = clientToWhiteboardDocumentNormFromContent(shrunk, content, 100, 100)
    expect(ny).toBeCloseTo(300 / 1200, 5)
  })

  it('clientToWhiteboardDocumentNormFromContent uses measured content height for Y', () => {
    const content = { left: 0, top: 0, width: 400, height: 2500 }
    const tallConfig = { ...config, contentHeightPx: 2400 }
    const [, ny] = clientToWhiteboardDocumentNormFromContent(tallConfig, content, 200, 1250)
    expect(ny).toBeCloseTo(0.5, 5)
  })

  it('isWhiteboardDocumentScrollPaint treats tall canvases as document scroll paint', () => {
    const tallCanvas = config.viewportHeightPx + 100
    expect(isWhiteboardDocumentScrollPaint(config, tallCanvas)).toBe(true)
  })

  it('projectCommandsForWhiteboardViewport shifts stroke into viewport norm space', () => {
    const commands = [
      {
        kind: 'stroke' as const,
        id: 's1',
        tool: 'pen' as const,
        points: [
          [0.1, 400 / 2400],
          [0.2, 600 / 2400],
        ],
      },
    ]
    const projected = projectCommandsForWhiteboardViewport(commands, config)
    expect(projected).toHaveLength(1)
    expect(projected[0]?.kind).toBe('stroke')
    if (projected[0]?.kind === 'stroke') {
      expect(projected[0].points[0]?.[1]).toBeCloseTo(0, 5)
      expect(projected[0].points[1]?.[1]).toBeCloseTo((600 - 400) / 800, 5)
    }
  })

  it('projectCommandsForWhiteboardViewport keeps and shifts shapes in viewport norm space', () => {
    const commands = [
      {
        kind: 'rect' as const,
        id: 'r1',
        x: 0.1,
        y: 500 / 2400,
        w: 0.2,
        h: 200 / 2400,
        strokeColor: '#111111',
      },
      {
        kind: 'arrow' as const,
        id: 'a1',
        from: [0.6, 450 / 2400] as [number, number],
        to: [0.7, 650 / 2400] as [number, number],
        color: '#222222',
      },
    ]

    const projected = projectCommandsForWhiteboardViewport(commands, config)

    expect(projected).toHaveLength(2)
    expect(projected[0]?.kind).toBe('rect')
    if (projected[0]?.kind === 'rect') {
      expect(projected[0].y).toBeCloseTo((500 - 400) / 800, 5)
      expect(projected[0].h).toBeCloseTo(200 / 800, 5)
    }
    expect(projected[1]?.kind).toBe('arrow')
    if (projected[1]?.kind === 'arrow') {
      expect(projected[1].from[1]).toBeCloseTo((450 - 400) / 800, 5)
      expect(projected[1].to[1]).toBeCloseTo((650 - 400) / 800, 5)
    }
  })

  it('projectCommandsForWhiteboardViewport drops shapes outside the viewport band', () => {
    const projected = projectCommandsForWhiteboardViewport(
      [
        {
          kind: 'ellipse' as const,
          id: 'e1',
          x: 0.1,
          y: 1300 / 2400,
          w: 0.2,
          h: 100 / 2400,
          strokeColor: '#111111',
        },
      ],
      config,
    )

    expect(projected).toHaveLength(0)
  })
})
