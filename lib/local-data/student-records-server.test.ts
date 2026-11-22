import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { StudentRecord } from '@/lib/types'
import {
  __setStudentsJsonPathForTests,
  readStudentsFromDisk,
  updateStudentsOnDisk,
  writeStudentsToDisk,
} from '@/lib/local-data/student-records-server'

function student(overrides: Partial<StudentRecord> = {}): StudentRecord {
  return {
    id: 'stu_anna',
    name: 'Anna',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('updateStudentsOnDisk', () => {
  let dir = ''

  afterEach(async () => {
    __setStudentsJsonPathForTests(null)
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = ''
  })

  it('keeps a book place saved while an earlier roster snapshot is still being patched', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'students-roster-'))
    __setStudentsJsonPathForTests(path.join(dir, 'students.json'))

    const opened = student()
    await writeStudentsToDisk([opened])
    const stale = await readStudentsFromDisk()

    const taught = student({
      note: 'taught today',
      bookPlaces: {
        journeys: { unitId: 'unit-1', pdfPage: 12, updatedAt: '2026-11-22T11:00:00.000Z' },
      },
      updatedAt: '2026-11-22T11:00:00.000Z',
    })
    const placeSave = writeStudentsToDisk([taught])
    const avatarPatch = updateStudentsOnDisk((latest) =>
      latest.map((row) =>
        row.id === stale[0]?.id ? { ...row, avatarUrl: '/student-avatars/stu_anna.png' } : row,
      ),
    )
    await Promise.all([placeSave, avatarPatch])

    const [saved] = await readStudentsFromDisk()
    expect(saved?.bookPlaces?.journeys).toEqual({
      unitId: 'unit-1',
      pdfPage: 12,
      updatedAt: '2026-11-22T11:00:00.000Z',
    })
    expect(saved?.note).toBe('taught today')
    expect(saved?.avatarUrl).toBe('/student-avatars/stu_anna.png')
  })

  it('does not drop a student saved while an avatar patch was waiting', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'students-roster-'))
    __setStudentsJsonPathForTests(path.join(dir, 'students.json'))

    await writeStudentsToDisk([student()])
    const added = writeStudentsToDisk([
      student(),
      student({
        id: 'stu_ben',
        name: 'Ben',
        bookPlaces: { journeys: { unitId: 'u', pdfPage: 3, updatedAt: 't' } },
      }),
    ])
    const patch = updateStudentsOnDisk((latest) =>
      latest.map((row) => (row.id === 'stu_anna' ? { ...row, avatarUrl: '/student-avatars/stu_anna.png' } : row)),
    )
    await Promise.all([added, patch])

    const saved = await readStudentsFromDisk()
    expect(saved.map((row) => row.id).sort()).toEqual(['stu_anna', 'stu_ben'])
    expect(saved.find((row) => row.id === 'stu_ben')?.bookPlaces?.journeys.pdfPage).toBe(3)
    expect(saved.find((row) => row.id === 'stu_anna')?.avatarUrl).toBe('/student-avatars/stu_anna.png')
  })
})
