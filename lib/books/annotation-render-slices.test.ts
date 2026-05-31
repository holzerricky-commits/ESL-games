import { describe, expect, it } from 'vitest'

import { buildAnnotationRenderSlices, draftOverlayZIndex } from '@/lib/books/annotation-render-slices'

import type { AnnotationCommand } from '@/lib/books/annotation-command-types'



function stroke(id: string, tool: 'pen' | 'marker' = 'pen'): AnnotationCommand {

  return { kind: 'stroke', id, tool, points: [[0.1, 0.1], [0.2, 0.2]] }

}



function text(id: string): AnnotationCommand {

  return {

    kind: 'text',

    id,

    x: 0.3,

    y: 0.3,

    text: 'hi',

    color: '#000',

    fillColor: '#fef08a',

    fontSizeNorm: 0.02,

  }

}



describe('buildAnnotationRenderSlices', () => {

  it('merges consecutive ink commands into one slice', () => {

    const commands: AnnotationCommand[] = [stroke('a'), stroke('b')]

    const slices = buildAnnotationRenderSlices(commands, new Set())

    expect(slices).toHaveLength(1)

    expect(slices[0]).toMatchObject({ kind: 'ink', indices: [0, 1], zIndex: 0 })

  })



  it('gives each marker stroke its own multiply slice for cross-stroke stacking', () => {

    const commands: AnnotationCommand[] = [stroke('m1', 'marker'), stroke('m2', 'marker')]

    const slices = buildAnnotationRenderSlices(commands, new Set())

    expect(slices).toHaveLength(2)

    expect(slices[0]).toMatchObject({ kind: 'marker', indices: [0], zIndex: 0 })

    expect(slices[1]).toMatchObject({ kind: 'marker', indices: [1], zIndex: 1 })

  })



  it('alternates ink / text / marker into three slices in command order', () => {

    const commands: AnnotationCommand[] = [stroke('a'), text('t'), stroke('m', 'marker')]

    const slices = buildAnnotationRenderSlices(commands, new Set())

    expect(slices.map((s) => s.kind)).toEqual(['ink', 'dom', 'marker'])

    expect(slices[0]).toMatchObject({ indices: [0], zIndex: 0 })

    expect(slices[1]).toMatchObject({ indices: [1], zIndex: 1 })

    expect(slices[2]).toMatchObject({ indices: [2], zIndex: 2 })

  })



  it('alternates stroke / text / stroke into three slices', () => {

    const commands: AnnotationCommand[] = [stroke('a'), text('t'), stroke('b')]

    const slices = buildAnnotationRenderSlices(commands, new Set())

    expect(slices.map((s) => s.kind)).toEqual(['ink', 'dom', 'ink'])

    expect(slices[0]).toMatchObject({ indices: [0], zIndex: 0 })

    expect(slices[1]).toMatchObject({ indices: [1], zIndex: 1 })

    expect(slices[2]).toMatchObject({ indices: [2], zIndex: 2 })

  })



  it('omits dead indices and does not leave holes in runs', () => {

    const commands: AnnotationCommand[] = [stroke('a'), stroke('b'), text('t'), stroke('c')]

    const slices = buildAnnotationRenderSlices(commands, new Set([1]))

    expect(slices).toHaveLength(3)

    expect(slices[0]).toMatchObject({ kind: 'ink', indices: [0] })

    expect(slices[1]).toMatchObject({ kind: 'dom', indices: [2] })

    expect(slices[2]).toMatchObject({ kind: 'ink', indices: [3] })

  })



  it('keeps eraser-line in ink slice indices (draw skips it)', () => {

    const commands: AnnotationCommand[] = [

      stroke('a'),

      { kind: 'stroke', id: 'e', tool: 'eraser-line', points: [[0, 0], [1, 1]] },

      text('t'),

    ]

    const slices = buildAnnotationRenderSlices(commands, new Set())

    expect(slices[0]).toMatchObject({ kind: 'ink', indices: [0, 1] })

  })

})



describe('draftOverlayZIndex', () => {

  it('sits above last command index', () => {

    expect(draftOverlayZIndex(5)).toBe(5)

  })

})

