import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { projectSpreadMarkerCommandsToPage } from '@/lib/books/spread-page-marker-projection'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'

describe('projectSpreadMarkerCommandsToPage', () => {
  const layout: SpreadInkLayout = {
    spreadOverlayWidthPx: 200,
    spreadPageWidthPx: 100,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 100,
    seamNormX: 0.5,
  }

  it('splits a seam-crossing marker stroke into non-empty left and right page chains', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'm1',
        tool: 'marker',
        points: [
          [0.2, 0.5],
          [0.5, 0.5],
          [0.8, 0.5],
        ],
        color: '#facc15',
      },
    ]

    const left = projectSpreadMarkerCommandsToPage(commands, 'left', layout)
    const right = projectSpreadMarkerCommandsToPage(commands, 'right', layout)

    expect(left.length).toBeGreaterThan(0)
    expect(right.length).toBeGreaterThan(0)
    expect(left[0]?.points.length).toBeGreaterThan(0)
    expect(right[0]?.points.length).toBeGreaterThan(0)

    for (const cmd of left) {
      for (const [x] of cmd.points) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(1)
      }
    }
    for (const cmd of right) {
      for (const [x] of cmd.points) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(1)
      }
    }
  })
})
