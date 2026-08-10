import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { inkEngineV2Enabled } from '@/lib/books/feature-flags'
import {
  assertInkEngineV2SceneInvariants,
  collectInkEngineV2SceneInvariantViolations,
  expectedSelectAllIds,
  hiddenCommandIndicesLegacy,
  legacySpreadSessionSelectAllIds,
  sceneHasHiddenCommandsLegacy,
  sceneHasStoredEraserLineCommands,
  selectAllIdsSubsetOfVisibleScene,
  selectAllMatchesVisibleScene,
  v2IncrementalCommittedPaintAllowed,
} from '@/lib/books/ink-engine-v2-contract'

const penA: AnnotationCommand = {
  kind: 'stroke',
  id: 'pen-a',
  tool: 'pen',
  points: [
    [0.1, 0.5],
    [0.3, 0.5],
  ],
}

const penB: AnnotationCommand = {
  kind: 'stroke',
  id: 'pen-b',
  tool: 'pen',
  points: [
    [0.4, 0.5],
    [0.6, 0.5],
  ],
}

const stamp: AnnotationCommand = {
  kind: 'stamp',
  id: 'stamp-1',
  variant: 'check',
  center: [0.5, 0.5],
}

describe('inkEngineV2Enabled', () => {
  it('defaults false in R0 (no runtime v2 paths)', () => {
    expect(inkEngineV2Enabled).toBe(false)
  })
})

describe('InkEngineV2 scene invariants (valid scenes)', () => {
  it('accepts a plain pen + stamp scene', () => {
    const scene = { commands: [penA, stamp] }
    expect(() => assertInkEngineV2SceneInvariants(scene)).not.toThrow()
    expect(collectInkEngineV2SceneInvariantViolations(scene)).toEqual([])
  })

  it('select-all ⊆ visible for v2 scenes', () => {
    const scene = { commands: [penA, penB, stamp] }
    const ids = expectedSelectAllIds(scene, false)
    expect(selectAllIdsSubsetOfVisibleScene(scene, ids)).toBe(true)
    expect(selectAllMatchesVisibleScene(scene, ids, false)).toBe(true)
  })

  it('empty scene → select-all is empty', () => {
    const scene = { commands: [] }
    expect(expectedSelectAllIds(scene, false)).toEqual([])
    expect(selectAllMatchesVisibleScene(scene, [], false)).toBe(true)
  })
})

describe('v2IncrementalCommittedPaintAllowed', () => {
  it('allows append-one when only one command added', () => {
    expect(v2IncrementalCommittedPaintAllowed([penA], [penA, penB])).toBe(true)
  })

  it('blocks during overlay animation (stamp pop-in must not full-replay committed layer)', () => {
    expect(
      v2IncrementalCommittedPaintAllowed([penA], [penA, penB], { overlayAnimationActive: true }),
    ).toBe(false)
  })

  it('allows append after eraser would have run in legacy (no dead-index gate)', () => {
    const eraserLine: AnnotationCommand = {
      kind: 'stroke',
      id: 'erase-1',
      tool: 'eraser-line',
      points: [
        [0, 0.5],
        [1, 0.5],
      ],
    }
    const legacyScene = [penA, penB, eraserLine]
    expect(sceneHasHiddenCommandsLegacy(legacyScene)).toBe(true)
    expect(hiddenCommandIndicesLegacy(legacyScene).size).toBeGreaterThan(0)
    // v2 committed path: adding a new stamp after erase does not care about legacy dead set
    expect(v2IncrementalCommittedPaintAllowed([penA, stamp], [penA, stamp, penB])).toBe(true)
  })
})

describe('legacy gaps documented until R2', () => {
  it('legacy spread selectAll includes eraser-hidden commands', () => {
    const eraserLine: AnnotationCommand = {
      kind: 'stroke',
      id: 'erase-1',
      tool: 'eraser-line',
      points: [
        [0, 0.5],
        [1, 0.5],
      ],
    }
    const commands = [penA, penB, eraserLine]
    expect(sceneHasHiddenCommandsLegacy(commands)).toBe(true)

    const legacyIds = legacySpreadSessionSelectAllIds(commands)
    expect(legacyIds).toContain('pen-a')
    expect(legacyIds).toContain('pen-b')
    expect(legacyIds).toContain('erase-1')

    const visibleOnly = commands.filter((_, i) => !hiddenCommandIndicesLegacy(commands).has(i))
    const v2Scene = {
      commands: visibleOnly.filter((c) => !(c.kind === 'stroke' && c.tool === 'eraser-line')),
    }
    const v2Ids = expectedSelectAllIds(v2Scene, false)
    expect(v2Ids).toEqual([])
  })

  it('legacy scene with eraser-line fails v2 invariants', () => {
    const eraserLine: AnnotationCommand = {
      kind: 'stroke',
      id: 'erase-1',
      tool: 'eraser-line',
      points: [
        [0, 0.5],
        [1, 0.5],
      ],
    }
    const scene = { commands: [penA, penB, eraserLine] }
    const violations = collectInkEngineV2SceneInvariantViolations(scene)
    expect(violations.map((v) => v.code)).toContain('stored_eraser_line_command')
    expect(violations.map((v) => v.code)).toContain('hidden_commands_in_scene')
    expect(() => assertInkEngineV2SceneInvariants(scene)).toThrow(/InkEngineV2 scene invariant/)
  })
})
