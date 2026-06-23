import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  hydrateSpreadSessionFromOwnerPages,
  mapCommandPageToSpread,
  mergeSpreadSessionPageOwnedFromOwnerPages,
  mergeSpreadSessionStampCalloutsFromOwnerPages,
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

  it('maps stamp center from left page into spread coordinates', () => {
    const leftCommands: AnnotationCommand[] = [
      {
        kind: 'stamp',
        id: 'st1',
        variant: 'check',
        center: [0.5, 0.4],
        color: '#22c55e',
      },
    ]
    const hydrated = hydrateSpreadSessionFromOwnerPages(leftCommands, [], layout)
    expect(hydrated).toHaveLength(1)
    const stamp = hydrated[0]
    if (stamp?.kind === 'stamp') {
      expect(stamp.center[0]).toBeCloseTo(0.25, 6)
      expect(stamp.center[1]).toBeCloseTo(0.4, 6)
    }
  })

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
})

describe('text and sticky coordinate mapping', () => {
  const layout = {
    spreadOverlayWidthPx: 200,
    spreadPageWidthPx: 100,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 100,
    seamNormX: 0.5,
  }

  it('maps left-page text into spread coordinates', () => {
    const cmd: AnnotationCommand = {
      kind: 'text',
      id: 't1',
      x: 0.5,
      y: 0.3,
      text: 'hello',
      color: '#111',
      fontSizeNorm: 0.02,
      maxWidthNorm: 0.4,
    }
    const spread = mapCommandPageToSpread(cmd, 'left', layout)
    expect(spread.kind).toBe('text')
    if (spread.kind === 'text') {
      expect(spread.x).toBeCloseTo(0.25, 6)
      expect(spread.y).toBeCloseTo(0.3, 6)
      expect(spread.maxWidthNorm).toBeCloseTo(0.2, 6)
    }
  })

  it('round-trips sticky w/h through project and hydrate', () => {
    const spreadCmd: AnnotationCommand = {
      kind: 'sticky',
      id: 'n1',
      x: 0.6,
      y: 0.2,
      w: 0.11,
      h: 0.11,
      text: 'note',
      fontSizeNorm: 0.02,
      fillColor: '#fef3c7',
    }
    const projected = projectSpreadSessionToOwnerPages([spreadCmd], layout)
    expect(projected.right).toHaveLength(1)
    const hydrated = hydrateSpreadSessionFromOwnerPages([], projected.right, layout)
    expect(hydrated).toHaveLength(1)
    const sticky = hydrated[0]
    if (sticky?.kind === 'sticky') {
      expect(sticky.x).toBeCloseTo(0.6, 5)
      expect(sticky.y).toBeCloseTo(0.2, 5)
      expect(sticky.w).toBeCloseTo(0.11, 5)
      expect(sticky.h).toBeCloseTo(0.11, 5)
    }
  })
})

describe('mergeSpreadSessionPageOwnedFromOwnerPages', () => {
  const layout = {
    spreadOverlayWidthPx: 200,
    spreadPageWidthPx: 100,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 100,
    seamNormX: 0.5,
  }

  it('merges text from page storage and drops session duplicate', () => {
    const session: AnnotationCommand[] = [
      { kind: 'line', id: 'l1', a: [0.1, 0.2], b: [0.3, 0.4], color: '#111' },
      { kind: 'text', id: 't1', x: 0.9, y: 0.5, text: 'stale', color: '#111', fontSizeNorm: 0.02 },
    ]
    const left: AnnotationCommand[] = [
      { kind: 'text', id: 't1', x: 0.5, y: 0.4, text: 'fresh', color: '#111', fontSizeNorm: 0.02 },
    ]
    const merged = mergeSpreadSessionPageOwnedFromOwnerPages(session, left, [], layout)
    expect(merged).toHaveLength(2)
    const text = merged.find((c) => c.kind === 'text')
    if (text?.kind === 'text') {
      expect(text.text).toBe('fresh')
      expect(text.x).toBeCloseTo(0.25, 6)
    }
  })
})

describe('mergeSpreadSessionStampCalloutsFromOwnerPages', () => {
  const layout = {
    spreadOverlayWidthPx: 200,
    spreadPageWidthPx: 100,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 100,
    seamNormX: 0.5,
  }

  it('replaces checkpoint stamp/callout with page-mapped versions', () => {
    const session: AnnotationCommand[] = [
      {
        kind: 'line',
        id: 'l1',
        a: [0.1, 0.2],
        b: [0.3, 0.4],
        color: '#111',
      },
      {
        kind: 'stamp',
        id: 'st1',
        variant: 'check',
        center: [0.5, 0.5],
        color: '#22c55e',
      },
    ]
    const left: AnnotationCommand[] = [
      {
        kind: 'stamp',
        id: 'st1',
        variant: 'check',
        center: [0.5, 0.4],
        color: '#22c55e',
      },
    ]
    const merged = mergeSpreadSessionStampCalloutsFromOwnerPages(session, left, [], layout)
    expect(merged).toHaveLength(2)
    const stamp = merged.find((c) => c.kind === 'stamp')
    if (stamp?.kind === 'stamp') {
      expect(stamp.center[0]).toBeCloseTo(0.25, 6)
    }
  })
})
