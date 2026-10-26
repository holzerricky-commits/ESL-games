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

describe('volume ids that share a file-name slug', () => {
  const volume1 = 'book-library/a/Journeys G3 Student Book Volume 1.pdf'
  const volume2 = 'book-library/a/Journeys G3 Student Book Volume 2.pdf'

  it('keeps each PDF when synthesizing volumes', () => {
    const next = migrateBookVolumes(
      book({
        units: [
          { id: 'u1', title: 'Volume 1', filePath: volume1, lessons: [{ id: 'l1', title: 'Lesson 1' }] },
          { id: 'u2', title: 'Volume 2', filePath: volume2 },
        ],
      }),
    )
    expect(next.units.map((unit) => unit.filePath)).toEqual([volume1, volume2])
    expect(next.units[0]?.volumeId).toBeTruthy()
    expect(next.units[0]?.volumeId).not.toBe(next.units[1]?.volumeId)
    expect(new Set(next.volumes?.map((volume) => volume.id)).size).toBe(2)
    expect(unitsForVolume(next, next.units[0]!.volumeId!).map((unit) => unit.id)).toEqual(['u1'])
    expect(next.units[0]?.lessons?.[0]?.id).toBe('l1')
  })

  it('does not retarget units that were saved under one shared volume id', () => {
    const shared = 'vol-journeys-g3-student-book-volume-'
    const next = migrateBookVolumes(
      book({
        volumes: [
          { id: shared, title: 'Volume 1', filePath: volume1 },
          { id: shared, title: 'Volume 2', filePath: volume2 },
        ],
        units: [
          { id: 'u1', title: 'Volume 1', filePath: volume1, volumeId: shared },
          { id: 'u2', title: 'Volume 2', filePath: volume2, volumeId: shared },
        ],
      }),
    )
    expect(next.units.map((unit) => unit.filePath)).toEqual([volume1, volume2])
    expect(next.units[0]?.volumeId).not.toBe(next.units[1]?.volumeId)
    expect(unitsForVolume(next, next.units[1]!.volumeId!).map((unit) => unit.id)).toEqual(['u2'])
  })

  it('keeps each PDF when ensuring volumes on outline save', () => {
    const next = ensureVolumesForFilePaths(
      book({
        units: [
          { id: 'u1', title: 'Volume 1', filePath: volume1 },
          { id: 'u2', title: 'Volume 2', filePath: volume2 },
        ],
      }),
      [volume1, volume2],
    )
    expect(next.units.map((unit) => unit.filePath)).toEqual([volume1, volume2])
    expect(next.units[0]?.volumeId).not.toBe(next.units[1]?.volumeId)
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
