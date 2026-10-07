import { describe, expect, it } from 'vitest'
import {
  emptyBookAnnotationsDiskPayload,
  mergeBrowserInkSafetyNetIntoPayload,
  mergeRichestAnnotationRoots,
  mergeRichestInkSessionMaps,
  scoreAnnotationPageRichness,
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

  it('mergeRichestAnnotationRoots keeps disk pages that already have more marks', () => {
    const disk = {
      stu: { book: { unit: { '3': [{ id: 'a' }, { id: 'b' }] } } },
    }
    const browser = {
      stu: { book: { unit: { '3': [{ id: 'a' }] } } },
    }
    const merged = mergeRichestAnnotationRoots(disk, browser)
    expect(merged.changed).toBe(false)
    expect(merged.root).toBe(disk)
  })

  it('mergeRichestAnnotationRoots recovers page marks that only exist in the browser', () => {
    const disk = {
      stu: { book: { unit: { '3': [] } } },
    }
    const browser = {
      stu: { book: { unit: { '3': [{ id: 'stroke-1' }, { id: 'text-1' }] } } },
    }
    const merged = mergeRichestAnnotationRoots(disk, browser)
    expect(merged.changed).toBe(true)
    expect(scoreAnnotationPageRichness(merged.root.stu?.book?.unit?.['3'])).toBe(2)
  })

  it('mergeBrowserInkSafetyNetIntoPayload restores page marks when disk already has a board', () => {
    const disk = {
      ...emptyBookAnnotationsDiskPayload(),
      annotations: {},
      whiteboardSessions: {
        nb: {
          pages: [{ commands: [{ id: '1' }] }],
          commands: [{ id: '1' }],
        },
      },
    }
    const browser = {
      ...emptyBookAnnotationsDiskPayload(),
      annotations: {
        ella: { book: { unit: { '12': [{ id: 'note-1' }] } } },
      },
    }
    const merged = mergeBrowserInkSafetyNetIntoPayload(disk, browser)
    expect(merged.changed).toBe(true)
    expect(merged.payload.annotations.ella?.book?.unit?.['12']).toEqual([{ id: 'note-1' }])
    expect(merged.payload.whiteboardSessions).toBe(disk.whiteboardSessions)
  })
})
