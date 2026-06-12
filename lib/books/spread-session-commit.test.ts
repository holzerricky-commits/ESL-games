import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  hydrateSpreadSessionFromOwnerPages,
  projectSpreadSessionToOwnerPages,
  splitSpreadSessionCommandsViaClientRects,
} from '@/lib/books/spread-session-commit'

describe('splitSpreadSessionCommandsViaClientRects', () => {
  const spreadRect = { left: 0, top: 0, width: 200, height: 100 }
  const leftRect = { left: 0, top: 0, width: 100, height: 100 }
  const rightRect = { left: 100, top: 0, width: 100, height: 100 }

  it('splits crossing stroke and preserves shared id', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 's1',
        tool: 'pen',
        color: '#111827',
        points: [
          [0.45, 0.2],
          [0.55, 0.8],
        ],
      },
    ]
    const { left, right } = splitSpreadSessionCommandsViaClientRects(commands, spreadRect, leftRect, rightRect)
    expect(left).toHaveLength(1)
    expect(right).toHaveLength(1)
    expect(left[0]?.id).toBe('s1')
    expect(right[0]?.id).toBe('s1')
  })

  it('splits line and keeps original id on both halves', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'line',
        id: 'l1',
        a: [0.25, 0.3],
        b: [0.75, 0.7],
        color: '#111827',
        widthScale: 1,
      },
    ]
    const { left, right } = splitSpreadSessionCommandsViaClientRects(commands, spreadRect, leftRect, rightRect)
    expect(left).toHaveLength(1)
    expect(right).toHaveLength(1)
    expect(left[0]?.id).toBe('l1')
    expect(right[0]?.id).toBe('l1')
  })
})

describe('projectSpreadSessionToOwnerPages', () => {
  const layout = {
    spreadOverlayWidthPx: 200,
    spreadPageWidthPx: 100,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 100,
    seamNormX: 0.5,
  }

  it('assigns crossing stroke to owner page (start side)', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 's1',
        tool: 'pen',
        color: '#111827',
        points: [
          [0.2, 0.4],
          [0.7, 0.6],
        ],
      },
    ]
    const projected = projectSpreadSessionToOwnerPages(commands, layout)
    expect(projected.left).toHaveLength(1)
    expect(projected.right).toHaveLength(0)
  })

  it('assigns right-origin shape to right page only', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'line',
        id: 'l1',
        a: [0.8, 0.2],
        b: [0.3, 0.8],
        color: '#111827',
      },
    ]
    const projected = projectSpreadSessionToOwnerPages(commands, layout)
    expect(projected.left).toHaveLength(0)
    expect(projected.right).toHaveLength(1)
  })
})

describe('hydrateSpreadSessionFromOwnerPages', () => {
  const layout = {
    spreadOverlayWidthPx: 200,
    spreadPageWidthPx: 100,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 100,
    seamNormX: 0.5,
  }

  it('maps owner page commands back into spread coordinates', () => {
    const leftCommands: AnnotationCommand[] = [
      {
        kind: 'line',
        id: 'l1',
        a: [0.2, 0.3],
        b: [0.8, 0.7],
        color: '#111827',
      },
    ]
    const hydrated = hydrateSpreadSessionFromOwnerPages(leftCommands, [], layout)
    expect(hydrated).toHaveLength(1)
    const line = hydrated[0]
    if (line?.kind === 'line') {
      expect(line.a[0]).toBeCloseTo(0.1, 6)
      expect(line.b[0]).toBeCloseTo(0.4, 6)
    }
  })

  it('keeps page-layer notes out of the spread session', () => {
    const leftCommands: AnnotationCommand[] = [
      {
        kind: 'text',
        id: 'note-1',
        x: 0.2,
        y: 0.3,
        text: 'Keep on page layer',
        fontSizeNorm: 0.03,
        color: '#111827',
      },
      {
        kind: 'stroke',
        id: 'ink-1',
        tool: 'pen',
        points: [
          [0.2, 0.3],
          [0.4, 0.5],
        ],
      },
    ]
    const hydrated = hydrateSpreadSessionFromOwnerPages(leftCommands, [], layout)
    expect(hydrated.map((c) => c.id)).toEqual(['ink-1'])
  })
})
