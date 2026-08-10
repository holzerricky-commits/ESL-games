import { describe, expect, it } from 'vitest'
import { resolveLauncherBookCovers } from '@/lib/books/resolve-initial-book-reader-selection'
import type { BookLibraryPayload } from '@/lib/books/types'

const library: BookLibraryPayload = {
  books: [
    {
      id: 'workshop',
      title: 'Workshop',
      units: [{ id: 'w-u1', title: 'U1', filePath: 'workshop/u1.pdf' }],
    },
    {
      id: 'literature',
      title: 'Literature',
      coverImagePath: 'literature/cover.png',
      units: [
        { id: 'l-u1', title: 'U1', filePath: 'literature/u1.pdf' },
        { id: 'l-u2', title: 'U2', filePath: 'literature/u2.pdf' },
      ],
    },
  ],
}

describe('resolveLauncherBookCovers', () => {
  it('returns one cover per assigned book in assignment order', () => {
    const covers = resolveLauncherBookCovers({
      library,
      assignedBookIds: ['literature', 'workshop'],
      assignedUnitRefs: [],
    })
    expect(covers.map((c) => c.bookId)).toEqual(['literature', 'workshop'])
    expect(covers[0]?.unitId).toBe('l-u1')
    expect(covers[0]?.imagePath).toBe('literature/cover.png')
    expect(covers[1]?.bookTitle).toBe('Workshop')
  })

  it('prefers the first assigned unit ref for each book', () => {
    const covers = resolveLauncherBookCovers({
      library,
      assignedBookIds: ['literature'],
      assignedUnitRefs: [{ bookId: 'literature', unitId: 'l-u2' }],
    })
    expect(covers).toHaveLength(1)
    expect(covers[0]?.unitId).toBe('l-u2')
    // Cover art still uses the first unit PDF when no imagePath on that path — imagePath present here
    expect(covers[0]?.imagePath).toBe('literature/cover.png')
  })

  it('skips unknown book ids', () => {
    const covers = resolveLauncherBookCovers({
      library,
      assignedBookIds: ['missing', 'workshop'],
      assignedUnitRefs: [],
    })
    expect(covers.map((c) => c.bookId)).toEqual(['workshop'])
  })
})
