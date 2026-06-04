import { describe, expect, it } from 'vitest'
import {
  clientToWhiteboardDocumentNorm,
  projectCommandsForWhiteboardViewport,
} from '@/lib/books/whiteboard-viewport-ink'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

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

  it('projectCommandsForWhiteboardViewport keeps visible shapes in viewport norm space', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'line',
        id: 'line-visible',
        a: [0.1, 500 / 2400],
        b: [0.5, 700 / 2400],
        color: '#111827',
      },
      {
        kind: 'rect',
        id: 'rect-visible',
        x: 0.2,
        y: 600 / 2400,
        w: 0.2,
        h: 200 / 2400,
        strokeColor: '#111827',
      },
      {
        kind: 'arrow',
        id: 'arrow-offscreen',
        from: [0.2, 1700 / 2400],
        to: [0.4, 1800 / 2400],
        color: '#111827',
      },
    ]
    const projected = projectCommandsForWhiteboardViewport(commands, config)
    expect(projected.map((cmd) => cmd.id)).toEqual(['line-visible', 'rect-visible'])
    const line = projected[0]
    expect(line?.kind).toBe('line')
    if (line?.kind === 'line') {
      expect(line.a[1]).toBeCloseTo((500 - 400) / 800, 5)
      expect(line.b[1]).toBeCloseTo((700 - 400) / 800, 5)
    }
    const rect = projected[1]
    expect(rect?.kind).toBe('rect')
    if (rect?.kind === 'rect') {
      expect(rect.y).toBeCloseTo((600 - 400) / 800, 5)
      expect(rect.h).toBeCloseTo(200 / 800, 5)
    }
  })
})
