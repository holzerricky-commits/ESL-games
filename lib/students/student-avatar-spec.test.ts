import { describe, expect, it } from 'vitest'
import {
  STUDENT_AVATAR_DICEBEAR_STYLES,
  STUDENT_AVATAR_BACKGROUND_COLORS,
  buildStudentAvatarDiceBearSpec,
  buildStudentAvatarDiceBearUrl,
  studentAvatarPublicPath,
} from '@/lib/students/student-avatar-spec'

describe('student-avatar-spec', () => {
  it('buildStudentAvatarDiceBearSpec is deterministic for fixed inputs', () => {
    const a = buildStudentAvatarDiceBearSpec('stu_test123', 'Ella')
    const b = buildStudentAvatarDiceBearSpec('stu_test123', 'Ella')
    expect(a).toEqual(b)
  })

  it('buildStudentAvatarDiceBearSpec varies by student id or name', () => {
    const base = buildStudentAvatarDiceBearSpec('stu_a', 'Ella')
    const otherId = buildStudentAvatarDiceBearSpec('stu_b', 'Ella')
    const otherName = buildStudentAvatarDiceBearSpec('stu_a', 'Parker')
    expect(otherId).not.toEqual(base)
    expect(otherName).not.toEqual(base)
  })

  it('uses known DiceBear styles and background palette', () => {
    const spec = buildStudentAvatarDiceBearSpec('stu_po0okz4fmnqbgdqo', 'Bubi')
    expect(STUDENT_AVATAR_DICEBEAR_STYLES).toContain(spec.style)
    expect(STUDENT_AVATAR_BACKGROUND_COLORS).toContain(spec.backgroundColor)
    expect(spec.seed.length).toBeGreaterThan(0)
  })

  it('buildStudentAvatarDiceBearUrl points at DiceBear PNG API', () => {
    const spec = buildStudentAvatarDiceBearSpec('stu_x', 'Sam')
    const url = buildStudentAvatarDiceBearUrl(spec)
    expect(url).toMatch(/^https:\/\/api\.dicebear\.com\/9\.x\//)
    expect(url).toContain('size=256')
    expect(url).toContain(`seed=${encodeURIComponent(spec.seed)}`)
  })

  it('studentAvatarPublicPath follows on-disk convention', () => {
    expect(studentAvatarPublicPath('stu_abc')).toBe('/student-avatars/stu_abc.png')
  })
})
