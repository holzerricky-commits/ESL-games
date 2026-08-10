import { describe, expect, it, vi } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

vi.mock('@/lib/books/feature-flags', () => ({
  inkSessionPageLayerDemotionEnabled: true,
}))

import {
  pageLayerCommandsForLoad,
  pageLayerCommandsForPersist,
} from '@/lib/books/ink-session-page-persist'

const stroke: AnnotationCommand = {
  kind: 'stroke',
  id: 's1',
  tool: 'pen',
  points: [
    [0.1, 0.1],
    [0.2, 0.2],
  ],
}

const text: AnnotationCommand = {
  kind: 'text',
  id: 't1',
  x: 0.1,
  y: 0.1,
  text: 'hi',
  color: '#000000',
  fontSizeNorm: 0.02,
}

const stamp: AnnotationCommand = {
  kind: 'stamp',
  id: 'st1',
  variant: 'check',
  center: [0.5, 0.5],
  color: '#22c55e',
}

describe('ink-session-page-persist', () => {
  it('spread delegated persist drops all session-owned commands', () => {
    const rows = [stroke, stamp, text]
    expect(
      pageLayerCommandsForPersist(rows, {
        spreadInkDelegated: true,
      }),
    ).toEqual([])
  })

  it('whiteboard delegated persist strips session-owned rows', () => {
    const marker: AnnotationCommand = {
      kind: 'stroke',
      id: 'm1',
      tool: 'marker',
      points: [
        [0, 0],
        [1, 1],
      ],
    }
    const rows = [stroke, marker, text]
    // Empty demoted list is for in-memory paint only — must not replace full board storage.
    expect(
      pageLayerCommandsForPersist(rows, {
        whiteboardInkDelegated: true,
      }),
    ).toEqual([])
    expect(rows.find((c) => c.kind === 'text')).toEqual(text)
  })

  it('spread session paint dedupe drops flushed ids only', () => {
    const flushed: AnnotationCommand = { ...stamp, id: 'st-live' }
    const pageOnly: AnnotationCommand = { ...stamp, id: 'st-old', center: [0.2, 0.3] }
    const rows = [flushed, pageOnly, text]

    expect(
      pageLayerCommandsForPersist(rows, {
        spreadSessionOwnsPagePaint: true,
        spreadSessionPaintCommandIds: ['st-live'],
      }),
    ).toEqual([pageOnly, text])
  })

  it('load uses the same demotion rules as persist', () => {
    expect(
      pageLayerCommandsForLoad([stroke, text], {
        spreadInkDelegated: true,
      }),
    ).toEqual([])
  })
})
