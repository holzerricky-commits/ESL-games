import { describe, expect, it } from 'vitest'
import { parseStudentWorkUploadMeta } from '@/lib/students/student-work-upload-meta'

describe('parseStudentWorkUploadMeta', () => {
  it('accepts book capture meta including unitTitle', () => {
    const result = parseStudentWorkUploadMeta({
      bookId: 'book-1',
      unitId: 'unit-1',
      page: 12,
      captureKind: 'page',
      format: 'png',
      watermarked: true,
      studentName: 'Alex',
      exportedAt: '2026-08-04T11:00:00.000Z',
      unitTitle: 'Unit 3',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.unitTitle).toBe('Unit 3')
  })

  it('accepts whiteboard notebook meta including classSessionId', () => {
    const result = parseStudentWorkUploadMeta({
      bookId: 'book-1',
      unitId: 'unit-1',
      page: 4,
      captureKind: 'whiteboard-notebook',
      classSessionId: 'session-42',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.classSessionId).toBe('session-42')
  })

  it('rejects unknown meta keys', () => {
    const result = parseStudentWorkUploadMeta({ bookId: 'b1', unexpected: true })
    expect(result.ok).toBe(false)
  })
})
