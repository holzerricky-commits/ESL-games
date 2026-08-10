import { describe, expect, it } from 'vitest'
import { sanitizeAnnotationCommands } from '@/lib/books/annotation-storage'

describe('sanitizeAnnotationCommands flashcard', () => {
  it('keeps valid flashcard commands', () => {
    const src = 'data:image/png;base64,abc'
    const out = sanitizeAnnotationCommands([
      {
        kind: 'flashcard',
        id: 'fc-1',
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.4,
        src,
        english: 'fly',
        chinese: '苍蝇',
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      kind: 'flashcard',
      id: 'fc-1',
      src,
      english: 'fly',
      chinese: '苍蝇',
    })
  })

  it('drops flashcards without english or valid src', () => {
    const out = sanitizeAnnotationCommands([
      {
        kind: 'flashcard',
        id: 'fc-2',
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.4,
        src: 'https://example.com/pic.png',
        english: 'fly',
        chinese: '…',
      },
      {
        kind: 'flashcard',
        id: 'fc-3',
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.4,
        src: 'data:image/png;base64,abc',
        english: '   ',
        chinese: '…',
      },
    ])
    expect(out).toHaveLength(0)
  })
})
