import { describe, expect, it } from 'vitest'
import { buildBooksPageHref, parseBookShelfTab } from '@/lib/books/book-setup-copy'

describe('book-setup-copy', () => {
  it('parseBookShelfTab accepts shelf tabs', () => {
    expect(parseBookShelfTab('audio')).toBe('audio')
    expect(parseBookShelfTab('materials')).toBe('materials')
    expect(parseBookShelfTab('lessons')).toBe('lessons')
  })

  it('maps removed Advanced tools tabs and unknown values to Lessons', () => {
    for (const legacy of ['outline', 'stories', 'plan', 'advanced', 'check-pages', 'map', 'ready', 'nope', null]) {
      expect(parseBookShelfTab(legacy)).toBe('lessons')
    }
    expect(parseBookShelfTab('tools')).toBe('materials')
  })

  it('buildBooksPageHref builds query string', () => {
    expect(buildBooksPageHref({ book: 'wonders', tab: 'audio', student: 's1' })).toBe(
      '/books?book=wonders&tab=audio&student=s1',
    )
    expect(buildBooksPageHref({ book: 'wonders', tab: 'lessons' })).toBe('/books?book=wonders')
    expect(buildBooksPageHref({ book: 'wonders', unit: 'u1', lesson: 'l1', part: 'p1' })).toBe(
      '/books?book=wonders&unit=u1&lesson=l1&part=p1',
    )
  })
})
