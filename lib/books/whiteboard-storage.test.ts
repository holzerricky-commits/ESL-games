import { describe, expect, it } from 'vitest'
import {
  annotationStorageLocalWhiteboardKey,
  annotationStorageSessionKey,
  listWhiteboardStorageKeyCandidates,
  resolveWhiteboardStorageKey,
} from '@/lib/books/whiteboard-storage'

describe('whiteboard-storage', () => {
  it('builds session key (legacy migration)', () => {
    expect(annotationStorageSessionKey('cls-1')).toBe('wb:session:cls-1')
  })

  it('builds lasting local key', () => {
    expect(annotationStorageLocalWhiteboardKey('book-a', 'unit-b')).toBe('wb:session:local:book-a:unit-b')
  })

  it('always resolves to lasting local key even with a live class', () => {
    expect(
      resolveWhiteboardStorageKey({
        classSessionId: 'live-9',
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toBe('wb:session:local:book-a:unit-b')
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

  it('listWhiteboardStorageKeyCandidates prefers local then legacy class key', () => {
    expect(
      listWhiteboardStorageKeyCandidates({
        classSessionId: 'live-9',
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toEqual(['wb:session:local:book-a:unit-b', 'wb:session:live-9'])
    expect(
      listWhiteboardStorageKeyCandidates({
        classSessionId: null,
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toEqual(['wb:session:local:book-a:unit-b'])
  })
})
