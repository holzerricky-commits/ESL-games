import { listBookVolumes, unitsForVolume } from '@/lib/books/book-volumes'
import type { BookLessonRecord, BookRecord, BookUnitRecord, BookVolumeRecord } from '@/lib/books/types'

export type BookOutlineUnitNode = {
  unit: BookUnitRecord
  lessons: BookLessonRecord[]
}

export type BookOutlineVolumeNode = {
  volume: BookVolumeRecord | null
  volumeKey: string
  units: BookOutlineUnitNode[]
}

/** Volume → unit → lesson tree for TOC rails (no parts). */
export function buildBookOutlineTree(book: BookRecord): BookOutlineVolumeNode[] {
  const volumes = listBookVolumes(book)
  const showVolumes = volumes.length >= 2
  if (!showVolumes) {
    return [
      {
        volume: null,
        volumeKey: '__all__',
        units: (book.units ?? []).map((unit) => ({
          unit,
          lessons: unit.lessons ?? [],
        })),
      },
    ]
  }
  return volumes.map((volume) => ({
    volume,
    volumeKey: volume.id,
    units: unitsForVolume(book, volume.id).map((unit) => ({
      unit,
      lessons: unit.lessons ?? [],
    })),
  }))
}

export function bookHasLessonOutline(book: BookRecord | null | undefined): boolean {
  if (!book) return false
  return (book.units ?? []).some((u) => (u.lessons?.length ?? 0) > 0)
}
