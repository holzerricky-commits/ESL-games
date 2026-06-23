import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  applyInkSessionSelectionLivePreview,
  computeInkSessionSelectionChrome,
} from '@/lib/books/ink-session-selection-display'

describe('ink-session-selection-display', () => {
  const commands: AnnotationCommand[] = [
    {
      kind: 'stroke',
      id: 'a',
      tool: 'pen',
      points: [
        [0.1, 0.1],
        [0.2, 0.2],
      ],
    },
    {
      kind: 'stroke',
      id: 'b',
      tool: 'pen',
      points: [
        [0.6, 0.6],
        [0.7, 0.7],
      ],
    },
  ]

  it('computeInkSessionSelectionChrome shows union outline for multi-box selection', () => {
    const chrome = computeInkSessionSelectionChrome({
      displayCommands: commands,
      selectedIds: ['a', 'b'],
      widthPx: 800,
      heightPx: 600,
      enabled: true,
      editingId: null,
      marqueeRect: null,
      selectRotationLiveDelta: null,
      selectRotationStartFrame: null,
      rotateCommitFrame: null,
      selectScaleLiveFrame: null,
      hoverTargetIds: [],
    })
    expect(chrome.selectionOutlineFramesList.length).toBeGreaterThan(1)
    expect(chrome.showUnionOutline).toBe(true)
  })

  it('applyInkSessionSelectionLivePreview translates on drag live', () => {
    const next = applyInkSessionSelectionLivePreview(
      commands,
      ['a', 'b'],
      800,
      600,
      {
        selectRotationLiveDelta: null,
        selectRotateIds: [],
        selectRotationPivot: null,
        selectRotationBaseCommands: null,
        selectRotationStartFrame: null,
        selectScaleStartFrame: null,
        selectScaleLiveFrame: null,
        selectScaleIds: [],
        selectDragLive: { dx: 0.05, dy: 0.05 },
        selectMoveIds: ['a', 'b'],
      },
    )
    const stroke = next.find((c) => c.id === 'a')
    expect(stroke?.kind).toBe('stroke')
    if (stroke?.kind === 'stroke') {
      expect(stroke.points[0]![0]).toBeCloseTo(0.15)
      expect(stroke.points[0]![1]).toBeCloseTo(0.15)
    }
  })
})
