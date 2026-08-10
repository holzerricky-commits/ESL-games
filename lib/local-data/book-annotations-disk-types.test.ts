import { describe, expect, it } from 'vitest'
import {
  emptyBookAnnotationsDiskPayload,
  mergeBrowserInkSafetyNetIntoPayload,
  mergeRichestInkSessionMaps,
  scoreInkSessionDocRichness,
} from '@/lib/local-data/book-annotations-disk-types'

describe('book-annotations-disk-types ink merge', () => {
  it('scores docs with more page ink higher', () => {
    const empty = { pages: [{ commands: [] }], commands: [] }
    const rich = {
      pages: [{ commands: [{ id: 'a' }, { id: 'b' }] }],
      commands: [{ id: 'a' }, { id: 'b' }],
    }
    expect(scoreInkSessionDocRichness(rich)).toBeGreaterThan(scoreInkSessionDocRichness(empty))
  })

  it('mergeRichestInkSessionMaps prefers richer browser mirror', () => {
    const disk = {
      'doc-a': { pages: [{ commands: [] }], commands: [] },
    }
    const browser = {
      'doc-a': {
        pages: [{ commands: [{ id: 'stroke-1' }] }],
        commands: [{ id: 'stroke-1' }],
      },
      'doc-b': { pages: [{ commands: [{ id: 'x' }] }], commands: [{ id: 'x' }] },
    }
    const merged = mergeRichestInkSessionMaps(disk, browser)
    expect(merged.changed).toBe(true)
    expect(merged.map['doc-a']).toBe(browser['doc-a'])
    expect(merged.map['doc-b']).toBe(browser['doc-b'])
  })

  it('mergeBrowserInkSafetyNetIntoPayload keeps disk when richer', () => {
    const disk = {
      ...emptyBookAnnotationsDiskPayload(),
      whiteboardSessions: {
        nb: {
          pages: [{ commands: [{ id: '1' }, { id: '2' }] }],
          commands: [{ id: '1' }, { id: '2' }],
        },
      },
    }
    const browser = {
      ...emptyBookAnnotationsDiskPayload(),
      whiteboardSessions: {
        nb: { pages: [{ commands: [{ id: '1' }] }], commands: [{ id: '1' }] },
      },
    }
    const merged = mergeBrowserInkSafetyNetIntoPayload(disk, browser)
    expect(merged.changed).toBe(false)
    expect(merged.payload).toBe(disk)
  })
})
