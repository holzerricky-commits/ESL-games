import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  applyEraserLineCommit,
  compactLegacyEraserLineScene,
  computeEraserLineDeadIndices,
  polylineMinDistSq,
  sceneNeedsEraserLineCompaction,
  textCommandBBox,
  textCommandTightBBox,
  textTopYFromCenterAnchor,
  resolveTextTopAnchorOnMultiline,
} from './annotation-geometry'

const widthPx = 800
const heightPx = 600

describe('annotation-geometry', () => {
  it('textTopYFromCenterAnchor preserves the top edge of a single-line box', () => {
    const fontSizeNorm = 0.04
    const centerY = 0.5
    const box = textCommandBBox(
      {
        kind: 'text',
        id: 't0',
        x: 0.1,
        y: centerY,
        yAnchor: 'center',
        text: 'Hi',
        fontSizeNorm,
        color: '#111',
      },
      widthPx,
      heightPx,
    )
    expect(textTopYFromCenterAnchor(centerY, fontSizeNorm, 1, heightPx)).toBeCloseTo(box.y, 5)
  })

  it('resolveTextTopAnchorOnMultiline converts on first hard newline', () => {
    const cmd = {
      yAnchor: 'center' as const,
      y: 0.5,
      fontSizeNorm: 0.04,
    }
    const patch = resolveTextTopAnchorOnMultiline(cmd, {
      heightPx,
      previousText: 'Hello',
      nextText: 'Hello\n',
    })
    expect(patch).not.toBeNull()
    expect(patch!.yAnchor).toBe('top')
    expect(patch!.y).toBeCloseTo(textTopYFromCenterAnchor(0.5, 0.04, 1, heightPx), 5)
  })

  it('resolveTextTopAnchorOnMultiline converts on soft-wrap force', () => {
    const cmd = {
      yAnchor: 'center' as const,
      y: 0.4,
      fontSizeNorm: 0.04,
    }
    const patch = resolveTextTopAnchorOnMultiline(cmd, {
      heightPx,
      previousText: 'long line without break',
      nextText: 'long line without break',
      forceMultiline: true,
    })
    expect(patch?.yAnchor).toBe('top')
    expect(patch!.y).toBeCloseTo(textTopYFromCenterAnchor(0.4, 0.04, 1, heightPx), 5)
  })

  it('resolveTextTopAnchorOnMultiline is a no-op for top-anchored labels', () => {
    expect(
      resolveTextTopAnchorOnMultiline(
        { yAnchor: 'top', y: 0.2, fontSizeNorm: 0.04 },
        { heightPx, previousText: 'a', nextText: 'a\nb' },
      ),
    ).toBeNull()
  })

  it('textCommandBBox shifts top upward when yAnchor is center', () => {
    const cmd = {
      kind: 'text' as const,
      id: 't1',
      x: 0.1,
      y: 0.5,
      yAnchor: 'center' as const,
      text: 'Hi',
      fontSizeNorm: 0.04,
      color: '#111',
    }
    const box = textCommandBBox(cmd, widthPx, heightPx)
    expect(box.h).toBeCloseTo(0.04 * 1.3 + (2 * 4) / heightPx, 5)
    expect(box.y).toBeCloseTo(0.5 - box.h / 2, 5)
  })

  it('textCommandTightBBox uses stored x as left edge regardless of textAlign', () => {
    const cmd = {
      kind: 'text' as const,
      id: 't1',
      x: 0.5,
      y: 0.1,
      textAlign: 'center' as const,
      text: 'Hello',
      fontSizeNorm: 0.04,
      color: '#111',
    }
    const box = textCommandTightBBox(cmd, widthPx, heightPx)
    expect(box.x).toBeCloseTo(0.5, 5)
  })

  it('polylineMinDistSq returns 0 for overlapping segments', () => {
    const a: [number, number][] = [
      [0.2, 0.5],
      [0.8, 0.5],
    ]
    const b: [number, number][] = [
      [0.5, 0.5],
      [0.5, 0.6],
    ]
    expect(polylineMinDistSq(a, b)).toBeLessThan(1e-6)
  })

  it('eraser-line removes pen strokes and shapes in command order', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: '1',
        tool: 'pen',
        points: [
          [0.1, 0.5],
          [0.9, 0.5],
        ],
      },
      {
        kind: 'rect',
        id: '2',
        x: 0.4,
        y: 0.4,
        w: 0.2,
        h: 0.2,
        strokeColor: '#000',
      },
      {
        kind: 'stroke',
        id: '3',
        tool: 'eraser-line',
        points: [
          [0.5, 0.1],
          [0.5, 0.9],
        ],
      },
    ]
    const dead = computeEraserLineDeadIndices(commands)
    expect(dead.has(0)).toBe(true)
    expect(dead.has(1)).toBe(true)
    expect(dead.has(2)).toBe(false)
  })

  it('eraser-line removes all strokes in a hit figure group', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 'a',
        tool: 'pen',
        points: [
          [0.1, 0.5],
          [0.3, 0.5],
        ],
        figureGroupId: 'grp1',
      },
      {
        kind: 'stroke',
        id: 'b',
        tool: 'pen',
        points: [
          [0.3, 0.5],
          [0.5, 0.5],
        ],
        figureGroupId: 'grp1',
      },
      {
        kind: 'stroke',
        id: 'c',
        tool: 'pen',
        points: [
          [0.7, 0.5],
          [0.9, 0.5],
        ],
      },
      {
        kind: 'stroke',
        id: 'e1',
        tool: 'eraser-line',
        points: [
          [0.2, 0.3],
          [0.2, 0.7],
        ],
      },
    ]
    const dead = computeEraserLineDeadIndices(commands)
    expect(dead.has(0)).toBe(true)
    expect(dead.has(1)).toBe(true)
    expect(dead.has(2)).toBe(false)
  })

  it('eraser-line removes stamp and text when path crosses them', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stamp',
        id: 's1',
        variant: 'check',
        center: [0.5, 0.5],
        color: '#0a0',
      },
      {
        kind: 'text',
        id: 't1',
        x: 0.5,
        y: 0.5,
        text: 'Hi',
        fontSizeNorm: 0.04,
        color: '#111',
      },
      {
        kind: 'stroke',
        id: 'e1',
        tool: 'eraser-line',
        points: [
          [0.5, 0.2],
          [0.5, 0.8],
        ],
      },
    ]
    const dead = computeEraserLineDeadIndices(commands)
    expect(dead.has(0)).toBe(true)
    expect(dead.has(1)).toBe(true)
  })

  it('applyEraserLineCommit removes hits without storing eraser-line', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: '1',
        tool: 'pen',
        points: [
          [0.1, 0.5],
          [0.9, 0.5],
        ],
      },
      {
        kind: 'rect',
        id: '2',
        x: 0.4,
        y: 0.4,
        w: 0.2,
        h: 0.2,
        strokeColor: '#000',
      },
    ]
    const { nextCommands, removed } = applyEraserLineCommit(commands, [
      [0.5, 0.1],
      [0.5, 0.9],
    ])
    expect(nextCommands).toHaveLength(0)
    expect(removed).toHaveLength(2)
    expect(nextCommands.some((c) => c.kind === 'stroke' && c.tool === 'eraser-line')).toBe(false)
  })

  it('compactLegacyEraserLineScene collapses stored eraser-line gestures', () => {
    const legacy: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: '1',
        tool: 'pen',
        points: [
          [0.1, 0.5],
          [0.9, 0.5],
        ],
      },
      {
        kind: 'stroke',
        id: 'e1',
        tool: 'eraser-line',
        points: [
          [0.5, 0.1],
          [0.5, 0.9],
        ],
      },
    ]
    expect(sceneNeedsEraserLineCompaction(legacy)).toBe(true)
    const compacted = compactLegacyEraserLineScene(legacy)
    expect(compacted).toHaveLength(0)
    expect(sceneNeedsEraserLineCompaction(compacted)).toBe(false)
  })
})
