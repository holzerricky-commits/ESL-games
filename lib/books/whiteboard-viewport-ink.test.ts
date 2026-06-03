import { describe, expect, it } from 'vitest'
import {
  clientToWhiteboardDocumentNorm,
  projectCommandsForWhiteboardViewport,
} from '@/lib/books/whiteboard-viewport-ink'

const config = {
  contentHeightPx: 2400,
  viewportHeightPx: 800,
  scrollTopPx: 400,
}

describe('whiteboard-viewport-ink', () => {
  it('clientToWhiteboardDocumentNorm maps viewport pointer into document space', () => {
    const rect = { left: 0, top: 100, width: 400, height: 800 }
    const [, ny] = clientToWhiteboardDocumentNorm(config, rect, 200, 500)
    // mid viewport Y → scrollTop + 0.5*viewport = 400+400 = 800px → 800/2400
    expect(ny).toBeCloseTo(800 / 2400, 5)
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
})
