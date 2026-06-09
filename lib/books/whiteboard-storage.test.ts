import { describe, expect, it } from 'vitest'
import {
  annotationStorageLocalWhiteboardKey,
  annotationStorageSessionKey,
  listWhiteboardStorageKeyCandidates,
  resolveWhiteboardStorageKey,
} from '@/lib/books/whiteboard-storage'

describe('whiteboard-storage', () => {
  it('builds session key', () => {
    expect(annotationStorageSessionKey('cls-1')).toBe('wb:session:cls-1')
  })

  it('builds local fallback key', () => {
    expect(annotationStorageLocalWhiteboardKey('book-a', 'unit-b')).toBe('wb:session:local:book-a:unit-b')
  })

  it('prefers class session over local', () => {
    expect(
      resolveWhiteboardStorageKey({
        classSessionId: 'live-9',
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toBe('wb:session:live-9')
  })

  it('falls back to local when no session', () => {
    expect(
      resolveWhiteboardStorageKey({
        classSessionId: null,
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toBe('wb:session:local:book-a:unit-b')
  })

  it('listWhiteboardStorageKeyCandidates includes class and local keys', () => {
    expect(
      listWhiteboardStorageKeyCandidates({
        classSessionId: 'live-9',
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toEqual(['wb:session:live-9', 'wb:session:local:book-a:unit-b'])
    expect(
      listWhiteboardStorageKeyCandidates({
        classSessionId: null,
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toEqual(['wb:session:local:book-a:unit-b'])
  })
})
