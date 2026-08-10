import { describe, expect, it } from 'vitest'
import type { AnnotationCommand, StickyAnnotationCommand, TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  commonShapeStrokeColor,
  commonTextStrokeColor,
  commonTextVisualStyle,
  commonTextAlign,
  isInkStrokeOnlySelection,
  isMarkerStrokeOnlySelection,
  isPenStrokeOnlySelection,
  isShapeOnlySelection,
  isStickyOnlySelection,
  isTextOnlySelection,
  resolveSelectionContext,
} from '@/lib/books/selection-context'
import { clampSelectionBarCenterX, resolveSelectionBarPlacement } from '@/lib/books/selection-context-anchor'

const widthPx = 800
const heightPx = 600

function textCmd(overrides: Partial<TextAnnotationCommand> = {}): TextAnnotationCommand {
  return {
    kind: 'text',
    id: 't1',
    x: 0.2,
    y: 0.2,
    text: 'hello',
    color: '#111827',
    fontSizeNorm: 0.04,
    ...overrides,
  }
}

function rectCmd(id: string): AnnotationCommand {
  return {
    kind: 'rect',
    id,
    x: 0.1,
    y: 0.1,
    w: 0.2,
    h: 0.15,
    strokeColor: '#111827',
  }
}

function lineCmd(id: string): AnnotationCommand {
  return {
    kind: 'line',
    id,
    a: [0.1, 0.1],
    b: [0.3, 0.2],
    color: '#2563eb',
  }
}

function penStrokeCmd(id: string): AnnotationCommand {
  return {
    kind: 'stroke',
    id,
    tool: 'pen',
    points: [
      [0.1, 0.1],
      [0.25, 0.15],
    ],
    color: '#1e293b',
  }
}

function markerStrokeCmd(id: string): AnnotationCommand {
  return {
    kind: 'stroke',
    id,
    tool: 'marker',
    points: [
      [0.2, 0.2],
      [0.35, 0.25],
    ],
    color: '#ffff00',
  }
}

describe('resolveSelectionBarPlacement', () => {
  it('places below when anchor is not near bottom edge', () => {
    expect(resolveSelectionBarPlacement({ x: 0.2, y: 0.3, w: 0.2, h: 0.1 })).toBe('below')
  })

  it('places below when anchor is near top edge', () => {
    expect(resolveSelectionBarPlacement({ x: 0.2, y: 0.02, w: 0.2, h: 0.05 })).toBe('below')
  })

  it('places above when anchor is near bottom edge', () => {
    expect(resolveSelectionBarPlacement({ x: 0.2, y: 0.88, w: 0.2, h: 0.1 })).toBe('above')
  })
})

describe('clampSelectionBarCenterX', () => {
  it('clamps centers near the left edge inward', () => {
    expect(clampSelectionBarCenterX(0.02)).toBeGreaterThan(0.05)
  })

  it('clamps centers near the right edge inward', () => {
    expect(clampSelectionBarCenterX(0.98)).toBeLessThan(0.95)
  })

  it('shifts left when selection sits under the annotation dock', () => {
    const clamped = clampSelectionBarCenterX(0.92, { barHalfWidthNorm: 0.1 })
    expect(clamped).toBeLessThan(0.8)
  })

  it('leaves centered anchors unchanged', () => {
    expect(clampSelectionBarCenterX(0.5)).toBe(0.5)
  })
})

function stickyCmd(overrides: Partial<StickyAnnotationCommand> = {}): StickyAnnotationCommand {
  return {
    kind: 'sticky',
    id: 's1',
    x: 0.2,
    y: 0.2,
    w: 0.2,
    h: 0.12,
    text: 'note',
    fontSizeNorm: 0.024,
    fillColor: '#fef3c7',
    ...overrides,
  }
}

describe('resolveSelectionContext', () => {
  it('returns text kind for a single text label', () => {
    const commands = [textCmd()]
    const ctx = resolveSelectionContext({
      commands,
      selectedIds: ['t1'],
      widthPx,
      heightPx,
    })
    expect(ctx).not.toBeNull()
    expect(ctx!.kind).toBe('text')
    expect(ctx!.textCommands).toHaveLength(1)
    expect(ctx!.stickyCommands).toHaveLength(0)
    expect(ctx!.visible).toBe(true)
    expect(ctx!.anchorRect.w).toBeGreaterThan(0)
  })

  it('returns sticky kind for a single note', () => {
    const ctx = resolveSelectionContext({
      commands: [stickyCmd()],
      selectedIds: ['s1'],
      widthPx,
      heightPx,
    })
    expect(ctx?.kind).toBe('sticky')
    expect(ctx?.stickyCommands).toHaveLength(1)
  })

  it('returns shape kind for a rectangle', () => {
    const ctx = resolveSelectionContext({
      commands: [rectCmd('r1')],
      selectedIds: ['r1'],
      widthPx,
      heightPx,
    })
    expect(ctx?.kind).toBe('shape')
    expect(ctx?.shapeCommands).toHaveLength(1)
  })

  it('returns stroke kind for pen strokes', () => {
    const ctx = resolveSelectionContext({
      commands: [penStrokeCmd('p1')],
      selectedIds: ['p1'],
      widthPx,
      heightPx,
    })
    expect(ctx?.kind).toBe('stroke')
    expect(ctx?.strokeCommands).toHaveLength(1)
  })

  it('returns mixed when text and shape are selected', () => {
    const ctx = resolveSelectionContext({
      commands: [textCmd(), rectCmd('r1')],
      selectedIds: ['t1', 'r1'],
      widthPx,
      heightPx,
    })
    expect(ctx?.kind).toBe('mixed')
    expect(ctx?.visible).toBe(true)
    expect(ctx?.anchorRect.w).toBeGreaterThan(0)
  })

  it('returns null while editing', () => {
    const ctx = resolveSelectionContext({
      commands: [textCmd()],
      selectedIds: ['t1'],
      widthPx,
      heightPx,
      editingId: 't1',
    })
    expect(ctx).toBeNull()
  })

  it('returns null when nothing is selected', () => {
    expect(
      resolveSelectionContext({
        commands: [textCmd()],
        selectedIds: [],
        widthPx,
        heightPx,
      }),
    ).toBeNull()
  })
})

describe('commonTextStrokeColor', () => {
  it('returns shared color when all labels match', () => {
    expect(
      commonTextStrokeColor([
        textCmd({ color: '#111827' }),
        textCmd({ id: 't2', color: '#111827' }),
      ]),
    ).toBe('#111827')
  })

  it('returns mixed when colors differ', () => {
    expect(
      commonTextStrokeColor([
        textCmd({ color: '#111827' }),
        textCmd({ id: 't2', color: '#dc2626' }),
      ]),
    ).toBe('mixed')
  })
})

describe('isTextOnlySelection', () => {
  it('is true for text-only ids', () => {
    expect(isTextOnlySelection([textCmd()], ['t1'])).toBe(true)
  })

  it('is false when a shape is included', () => {
    expect(isTextOnlySelection([textCmd(), rectCmd('r1')], ['t1', 'r1'])).toBe(false)
  })
})

describe('commonTextVisualStyle', () => {
  it('detects mixed styles', () => {
    expect(
      commonTextVisualStyle([
        textCmd({ visualStyle: 'plain' }),
        textCmd({ id: 't2', visualStyle: 'filled', fillColor: '#fff' }),
      ]),
    ).toBe('mixed')
  })
})

describe('commonTextAlign', () => {
  it('defaults missing align to left', () => {
    expect(commonTextAlign([textCmd()])).toBe('left')
  })

  it('returns mixed when alignments differ', () => {
    expect(
      commonTextAlign([
        textCmd({ textAlign: 'left' }),
        textCmd({ id: 't2', textAlign: 'center' }),
      ]),
    ).toBe('mixed')
  })
})

describe('isShapeOnlySelection', () => {
  it('is true for shape-only ids', () => {
    expect(isShapeOnlySelection([rectCmd('r1'), lineCmd('l1')], ['r1', 'l1'])).toBe(true)
  })

  it('is false when text is included', () => {
    expect(isShapeOnlySelection([rectCmd('r1'), textCmd()], ['r1', 't1'])).toBe(false)
  })
})

describe('commonShapeStrokeColor', () => {
  it('matches stroke on rects and color on lines', () => {
    expect(
      commonShapeStrokeColor([
        rectCmd('r1') as import('@/lib/books/shape-selection').ShapeSelectionCommand,
        lineCmd('l1') as import('@/lib/books/shape-selection').ShapeSelectionCommand,
      ]),
    ).toBe('mixed')
  })
})

describe('isPenStrokeOnlySelection', () => {
  it('is true for pen-only ids', () => {
    expect(isPenStrokeOnlySelection([penStrokeCmd('p1')], ['p1'])).toBe(true)
  })

  it('is false when marker is included', () => {
    expect(isPenStrokeOnlySelection([penStrokeCmd('p1'), markerStrokeCmd('m1')], ['p1', 'm1'])).toBe(
      false,
    )
  })
})

describe('isMarkerStrokeOnlySelection', () => {
  it('is true for marker-only ids', () => {
    expect(isMarkerStrokeOnlySelection([markerStrokeCmd('m1')], ['m1'])).toBe(true)
  })
})

describe('isInkStrokeOnlySelection', () => {
  it('is true for pen and marker together', () => {
    expect(
      isInkStrokeOnlySelection([penStrokeCmd('p1'), markerStrokeCmd('m1')], ['p1', 'm1']),
    ).toBe(true)
  })
})

describe('isStickyOnlySelection', () => {
  it('is true for sticky-only ids', () => {
    expect(isStickyOnlySelection([stickyCmd()], ['s1'])).toBe(true)
  })

  it('is false when text is included', () => {
    expect(isStickyOnlySelection([stickyCmd(), textCmd()], ['s1', 't1'])).toBe(false)
  })
})
