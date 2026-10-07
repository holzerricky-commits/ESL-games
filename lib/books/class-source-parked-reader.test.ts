import { describe, expect, it } from 'vitest'
import type { ClassSourceBookChip } from '@/lib/books/class-source-strip'
import {
  classSourceRetainUnitIds,
  listParkedClassSourceWarmTargets,
  shouldEvictParkedReaderUnitCache,
} from '@/lib/books/class-source-parked-reader'

function chip(partial: Partial<ClassSourceBookChip> & Pick<ClassSourceBookChip, 'bookId' | 'unitId'>): ClassSourceBookChip {
  return {
    displayLabel: partial.displayLabel ?? partial.bookId,
    bookTitle: partial.bookTitle ?? partial.bookId,
    accentColor: partial.accentColor ?? '#000',
    page: partial.page ?? 1,
    bookId: partial.bookId,
    unitId: partial.unitId,
  }
}

describe('class-source-parked-reader', () => {
  const workshop = chip({ bookId: 'ws', unitId: 'ws-u1' })
  const literature = chip({ bookId: 'lit', unitId: 'lit-u1' })

  it('classSourceRetainUnitIds lists unique assigned units', () => {
    expect(classSourceRetainUnitIds([workshop, literature, workshop])).toEqual(['ws-u1', 'lit-u1'])
  })

  it('keeps the previous unit when it is still on the strip', () => {
    expect(
      shouldEvictParkedReaderUnitCache({
        previousUnitId: 'ws-u1',
        retainUnitIds: ['ws-u1', 'lit-u1'],
      }),
    ).toBe(false)
  })

  it('evicts a unit that is not on the strip', () => {
    expect(
      shouldEvictParkedReaderUnitCache({
        previousUnitId: 'old-u',
        retainUnitIds: ['ws-u1', 'lit-u1'],
      }),
    ).toBe(true)
  })

  it('evicts when there is no strip retain list (workshop / single reader)', () => {
    expect(
      shouldEvictParkedReaderUnitCache({
        previousUnitId: 'ws-u1',
        retainUnitIds: [],
      }),
    ).toBe(true)
  })

  it('listParkedClassSourceWarmTargets skips the focused book', () => {
    expect(listParkedClassSourceWarmTargets([workshop, literature], 'ws')).toEqual([literature])
    expect(listParkedClassSourceWarmTargets([workshop, literature], 'lit')).toEqual([workshop])
    expect(listParkedClassSourceWarmTargets([workshop], 'ws')).toEqual([])
  })
})
