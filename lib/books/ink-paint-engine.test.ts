import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  buildAnnotationRenderSlices,
  INK_PAINT_SLICE_BATCH_SIZE,
} from '@/lib/books/annotation-render-slices'
import {
  buildCommandToPaintSliceIndex,
  paintSliceIndexesForCommandIndices,
  planInkSessionPaint,
} from '@/lib/books/ink-paint-engine'

function pen(id: string, y = 0.5): AnnotationCommand {
  return {
    kind: 'stroke',
    id,
    tool: 'pen',
    points: [
      [0.1, y],
      [0.9, y],
    ],
  }
}

describe('buildAnnotationRenderSlices ink batching', () => {
  it('splits long pen runs into multiple ink slices', () => {
    const commands = Array.from({ length: 60 }, (_, i) => pen(`p-${i}`, i * 0.01))
    const slices = buildAnnotationRenderSlices(commands, new Set(), {
      inkBatchSize: INK_PAINT_SLICE_BATCH_SIZE,
    })
    const inkSlices = slices.filter((s) => s.kind === 'ink')
    expect(inkSlices.length).toBe(2)
    expect(inkSlices[0]!.indices.length).toBe(INK_PAINT_SLICE_BATCH_SIZE)
    expect(inkSlices[1]!.indices.length).toBe(12)
  })
})

describe('planInkSessionPaint', () => {
  it('plans append for one new stroke at end', () => {
    const prev = [pen('a'), pen('b')]
    const next = [pen('a'), pen('b'), pen('c')]
    expect(planInkSessionPaint(prev, next)).toEqual({ type: 'append', commandIndex: 2 })
  })

  it('plans full replay for eraser delete (avoids ghost pixels)', () => {
    const prev = [pen('a'), pen('b'), pen('c')]
    const next = [pen('a'), pen('c')]
    expect(planInkSessionPaint(prev, next)).toEqual({ type: 'full_replay' })
  })

  it('plans full replay when erase changes paint slice count', () => {
    const prev = Array.from({ length: 50 }, (_, i) => pen(`p-${i}`, i * 0.01))
    const next = prev.slice(0, 40)
    const plan = planInkSessionPaint(prev, next, {}, new Set(), {
      inkBatchSize: INK_PAINT_SLICE_BATCH_SIZE,
    })
    expect(plan.type).toBe('full_replay')
  })

  it('plans replay slices for undo restore', () => {
    const prev = [pen('a'), pen('c')]
    const next = [pen('a'), pen('b'), pen('c')]
    const plan = planInkSessionPaint(prev, next)
    expect(plan.type).toBe('replay_paint_slices')
    if (plan.type === 'replay_paint_slices') {
      expect(plan.paintSliceIndexes.length).toBeGreaterThan(0)
    }
  })

  it('plans full replay on canvas resize', () => {
    const prev = [pen('a')]
    const next = [pen('a'), pen('b')]
    expect(planInkSessionPaint(prev, next, { canvasResized: true })).toEqual({ type: 'full_replay' })
  })

  it('plans full replay when overlay animation active', () => {
    const prev = [pen('a')]
    const next = [pen('a'), pen('b')]
    expect(planInkSessionPaint(prev, next, { overlayAnimationActive: true })).toEqual({
      type: 'full_replay',
    })
  })

  it('plans full replay when overlay animation active even if commands unchanged', () => {
    const commands = [pen('a')]
    expect(planInkSessionPaint(commands, commands, { overlayAnimationActive: true })).toEqual({
      type: 'full_replay',
    })
  })

  it('plans replay slices for metadata patch', () => {
    const prev = [pen('a')]
    const patched = { ...pen('a'), widthScale: 2 }
    const next = [patched]
    const plan = planInkSessionPaint(prev, next)
    expect(plan.type).toBe('replay_paint_slices')
  })
})

describe('buildCommandToPaintSliceIndex', () => {
  it('maps command indices to paint slice indexes', () => {
    const commands = [pen('a'), pen('b')]
    const slices = buildAnnotationRenderSlices(commands, new Set())
    const map = buildCommandToPaintSliceIndex(slices, true)
    expect(map[0]).toBe(0)
    expect(map[1]).toBe(0)
    expect(paintSliceIndexesForCommandIndices([1], map)).toEqual([0])
  })
})
