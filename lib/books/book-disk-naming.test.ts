import { describe, expect, it } from 'vitest'
import {
  applyDiskCleanupPlanToBook,
  buildCanonicalBookFolderName,
  buildCanonicalMainPdfFileName,
  planBookDiskCleanup,
  planBookUploadFromFileName,
  remapCleanupLibraryPath,
  slugifyDiskSegment,
} from '@/lib/books/book-disk-naming'
import { migrateBookVolumes } from '@/lib/books/book-volumes'
import type { BookRecord } from '@/lib/books/types'

describe('slugifyDiskSegment', () => {
  it('kebabs messy names', () => {
    expect(slugifyDiskSegment('JOURNEYS G3 BOOK 1')).toBe('journeys-g3-book-1')
  })
})

describe('buildCanonicalBookFolderName', () => {
  it('builds journeys-g3-book-1', () => {
    expect(
      buildCanonicalBookFolderName({
        series: 'Journeys',
        grade: 'G3',
        role: 'Student book',
        title: 'JOURNEYS G3 BOOK 1',
        bookId: 'journeys-g3-book-1',
      }),
    ).toBe('journeys-g3-book-1')
  })

  it('builds wonders-g3-workshop', () => {
    expect(
      buildCanonicalBookFolderName({
        series: 'Wonders',
        grade: 'G3',
        role: 'Workshop',
        title: 'Wonders G3 Workshop',
        bookId: 'wonders-g3-workshop',
      }),
    ).toBe('wonders-g3-workshop')
  })
})

describe('buildCanonicalMainPdfFileName', () => {
  it('matches the folder slug', () => {
    expect(buildCanonicalMainPdfFileName('journeys-g3-book-1')).toBe('journeys-g3-book-1.pdf')
    expect(buildCanonicalMainPdfFileName('wonders-g3-workshop')).toBe('wonders-g3-workshop.pdf')
    expect(buildCanonicalMainPdfFileName('wonders-g3-literature')).toBe('wonders-g3-literature.pdf')
  })
})

describe('planBookUploadFromFileName', () => {
  it('plans clean Journeys names from a messy download', () => {
    const plan = planBookUploadFromFileName('JOURNEYS G3 BOOK 1.pdf')
    expect(plan).toMatchObject({
      series: 'Journeys',
      grade: 'G3',
      role: 'Student book',
      bookFolder: 'journeys-g3-book-1',
      pdfFileName: 'journeys-g3-book-1.pdf',
      bookId: 'journeys-g3-book-1',
      relativeFilePath: 'book-library/journeys-g3-book-1/journeys-g3-book-1.pdf',
    })
    expect(plan?.title).toContain('Journeys')
  })

  it('plans Wonders Workshop names', () => {
    const plan = planBookUploadFromFileName('Wonders Grade 3 Workshop.pdf')
    expect(plan).toMatchObject({
      series: 'Wonders',
      grade: 'G3',
      role: 'Workshop',
      bookFolder: 'wonders-g3-workshop',
      pdfFileName: 'wonders-g3-workshop.pdf',
    })
  })

  it('strips unit suffixes from the stem', () => {
    const plan = planBookUploadFromFileName('journeys-g4-unit-3.pdf')
    expect(plan?.bookFolder).toBe('journeys-g4')
  })
})

describe('planBookDiskCleanup', () => {
  it('plans folder + single PDF rename', () => {
    const book: BookRecord = {
      id: 'journeys-g3-book-1',
      title: 'JOURNEYS G3 BOOK 1',
      series: 'Journeys',
      grade: 'G3',
      role: 'Student book',
      units: [
        {
          id: 'u1',
          title: 'Unit 1',
          filePath: 'book-library/JOURNEYS G3 BOOK 1/JOURNEYS G3 BOOK 1.pdf',
        },
      ],
    }
    const plan = planBookDiskCleanup(book)
    expect(plan.currentFolder).toBe('JOURNEYS G3 BOOK 1')
    expect(plan.targetFolder).toBe('journeys-g3-book-1')
    expect(plan.folderNeedsRename).toBe(true)
    expect(plan.fileRenames).toEqual([
      {
        fromRelative: 'book-library/JOURNEYS G3 BOOK 1/JOURNEYS G3 BOOK 1.pdf',
        toRelative: 'book-library/journeys-g3-book-1/journeys-g3-book-1.pdf',
        fromFileName: 'JOURNEYS G3 BOOK 1.pdf',
        toFileName: 'journeys-g3-book-1.pdf',
      },
    ])
    expect(plan.alreadyClean).toBe(false)
  })

  it('reports already clean when names match', () => {
    const book: BookRecord = {
      id: 'journeys-g3-book-1',
      title: 'Journeys Grade 3 — Student book',
      series: 'Journeys',
      grade: 'G3',
      role: 'Student book',
      units: [
        {
          id: 'u1',
          title: 'Unit 1',
          filePath: 'book-library/journeys-g3-book-1/journeys-g3-book-1.pdf',
        },
      ],
    }
    const plan = planBookDiskCleanup(book)
    expect(plan.alreadyClean).toBe(true)
    expect(plan.folderNeedsRename).toBe(false)
    expect(plan.fileRenames).toHaveLength(0)
  })
})

describe('applyDiskCleanupPlanToBook', () => {
  it('rewrites unit paths, alignment keys, and cover; keeps id', () => {
    const book: BookRecord = {
      id: 'journeys-g3-book-1',
      title: 'JOURNEYS G3 BOOK 1',
      series: 'Journeys',
      grade: 'G3',
      role: 'Student book',
      coverImagePath: 'book-library/JOURNEYS G3 BOOK 1/cover.jpg',
      pageAlignmentByFile: {
        'book-library/JOURNEYS G3 BOOK 1/JOURNEYS G3 BOOK 1.pdf': {
          notCountedPdfPages: [2],
        },
      },
      units: [
        {
          id: 'u1',
          title: 'Unit 1',
          filePath: 'book-library/JOURNEYS G3 BOOK 1/JOURNEYS G3 BOOK 1.pdf',
        },
        {
          id: 'u2',
          title: 'Unit 2',
          filePath: 'book-library/JOURNEYS G3 BOOK 1/JOURNEYS G3 BOOK 1.pdf',
        },
      ],
    }
    const plan = planBookDiskCleanup(book)
    const next = applyDiskCleanupPlanToBook(book, plan)
    expect(next.id).toBe('journeys-g3-book-1')
    expect(next.units[0]?.filePath).toBe('book-library/journeys-g3-book-1/journeys-g3-book-1.pdf')
    expect(next.units[1]?.filePath).toBe('book-library/journeys-g3-book-1/journeys-g3-book-1.pdf')
    expect(next.coverImagePath).toBe('book-library/journeys-g3-book-1/cover.jpg')
    expect(next.pageAlignmentByFile).toEqual({
      'book-library/journeys-g3-book-1/journeys-g3-book-1.pdf': {
        notCountedPdfPages: [2],
      },
    })
  })

  it('keeps each volume on the renamed files so reload does not point units at the old folder', () => {
    const book: BookRecord = {
      id: 'wonders-g3-workshop',
      title: 'Wonders G3 Workshop',
      series: 'Wonders',
      grade: 'G3',
      role: 'Workshop',
      volumes: [
        {
          id: 'vol-a',
          title: 'Book A',
          filePath: 'book-library/Wonders G3 Workshop/book-a.pdf',
        },
        {
          id: 'vol-b',
          title: 'Book B',
          filePath: 'book-library/Wonders G3 Workshop/book-b.pdf',
        },
      ],
      units: [
        {
          id: 'u1',
          title: 'Unit 1',
          volumeId: 'vol-a',
          filePath: 'book-library/Wonders G3 Workshop/book-a.pdf',
        },
        {
          id: 'u2',
          title: 'Unit 2',
          volumeId: 'vol-b',
          filePath: 'book-library/Wonders G3 Workshop/book-b.pdf',
        },
      ],
    }
    const plan = planBookDiskCleanup(book)
    const next = applyDiskCleanupPlanToBook(book, plan)
    const reloaded = migrateBookVolumes(next)

    expect(reloaded.volumes?.map((volume) => volume.filePath)).toEqual([
      'book-library/wonders-g3-workshop/unit-01.pdf',
      'book-library/wonders-g3-workshop/unit-02.pdf',
    ])
    expect(reloaded.units.map((unit) => unit.filePath)).toEqual([
      'book-library/wonders-g3-workshop/unit-01.pdf',
      'book-library/wonders-g3-workshop/unit-02.pdf',
    ])
    expect(
      remapCleanupLibraryPath('book-library/Wonders G3 Workshop/audio/track-1.mp3', plan),
    ).toBe('book-library/wonders-g3-workshop/audio/track-1.mp3')
  })
})
