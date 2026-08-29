import { describe, expect, it } from 'vitest'
import {
  bookHasMultipleVolumes,
  ensureVolumesForFilePaths,
  firstVolumeNeedingOutline,
  listBookVolumes,
  migrateBookVolumes,
  unitsForVolume,
  volumeNeedsOutline,
} from '@/lib/books/book-volumes'
import type { BookRecord } from '@/lib/books/types'

function book(partial: Partial<BookRecord> & Pick<BookRecord, 'units'>): BookRecord {
  return {
    id: 'wonders-g1',
    title: 'Wonders G1',
    ...partial,
  }
}

describe('migrateBookVolumes', () => {
  it('leaves single-file books without volumes', () => {
    const next = migrateBookVolumes(
      book({
        units: [{ id: 'u1', title: 'Unit 1', filePath: 'book-library/a/book.pdf' }],
      }),
    )
    expect(next.volumes).toBeUndefined()
    expect(next.units[0]?.volumeId).toBeUndefined()
  })

  it('synthesizes volumes for multi-file books', () => {
    const next = migrateBookVolumes(
      book({
        units: [
          { id: 'u1', title: 'Unit 1', filePath: 'book-library/a/unit-01.pdf' },
          { id: 'u2', title: 'Unit 2', filePath: 'book-library/a/unit-02.pdf' },
          {
            id: 'u4',
            title: 'Unit 4',
            filePath: 'book-library/a/units-4-6.pdf',
          },
          {
            id: 'u5',
            title: 'Unit 5',
            filePath: 'book-library/a/units-4-6.pdf',
            startPageHint: 110,
          },
        ],
      }),
    )
    expect(next.volumes).toHaveLength(3)
    expect(unitsForVolume(next, next.volumes![2]!.id)).toHaveLength(2)
    expect(next.volumes![2]!.title).toMatch(/Units 3–4|Units 4–5/)
  })
})

describe('listBookVolumes / volumeNeedsOutline', () => {
  it('reports outline need per volume', () => {
    const migrated = migrateBookVolumes(
      book({
        units: [
          {
            id: 'u1',
            title: 'Unit 1',
            filePath: 'book-library/a/u1.pdf',
            lessons: [{ id: 'l1', title: 'Lesson 1' }],
          },
          { id: 'u2', title: 'Unit 2', filePath: 'book-library/a/u2.pdf' },
        ],
      }),
    )
    expect(bookHasMultipleVolumes(migrated)).toBe(true)
    const vols = listBookVolumes(migrated)
    expect(volumeNeedsOutline(migrated, vols[0]!.id)).toBe(false)
    expect(volumeNeedsOutline(migrated, vols[1]!.id)).toBe(true)
    expect(firstVolumeNeedingOutline(migrated)?.id).toBe(vols[1]!.id)
  })
})

describe('ensureVolumesForFilePaths', () => {
  it('creates volumes after cut into multiple files', () => {
    const next = ensureVolumesForFilePaths(
      book({
        units: [
          { id: 'u1', title: 'Unit 1', filePath: 'book-library/a/unit-01.pdf' },
          { id: 'u2', title: 'Unit 2', filePath: 'book-library/a/unit-02.pdf' },
        ],
      }),
      ['book-library/a/unit-01.pdf', 'book-library/a/unit-02.pdf'],
    )
    expect(next.volumes).toHaveLength(2)
    expect(next.units.every((u) => Boolean(u.volumeId))).toBe(true)
  })
})
